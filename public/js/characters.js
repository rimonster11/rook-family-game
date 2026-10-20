// Regular avatars: continuous silhouettes, surface-fitted facial features, and coordinated outfits.
// The special Barbarian uses its existing GLB unchanged.
import * as THREE from '../vendor/three.module.min.js';
import { charOf, shade } from './art.js';
import { createModelCharacter, disposeModelCharacter, animateModelCharacter } from './model-characters.js';

const materials = new Map();
function material(color, kind = 'cloth') {
  const key = `${color}:${kind}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshPhysicalMaterial({
    color, roughness: kind === 'eyes' ? .48 : kind === 'metal' ? .38 : kind === 'hair' ? .69 : .82,
    metalness: kind === 'metal' ? .65 : 0,
    clearcoat: 0,
    clearcoatRoughness: .45, sheen: kind === 'cloth' ? .5 : .12,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), .3),
    sheenRoughness: .8, side: THREE.DoubleSide,
  }));
  return materials.get(key);
}
function mesh(parent, geometry, mat, position = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(...position); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function oval(parent, mat, position, scale, segments = 28) {
  return mesh(parent, new THREE.SphereGeometry(1, segments, 20), mat, position, scale);
}
function curve(parent, points, radius, mat, closed = false) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed), 32, radius, 10, closed), mat);
}
function ring(parent, radius, tube, mat, position) {
  const m = mesh(parent, new THREE.TorusGeometry(radius, tube, 12, 48), mat, position); m.rotation.x = Math.PI / 2; return m;
}
function roundedFrame(width, height, radius) {
  const s = new THREE.Shape(), x = -width / 2, y = -height / 2;
  s.moveTo(x + radius, y); s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius); s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius); s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y); return s;
}

function garmentDepth(x,y) {
  const profile=[[-.40,.34],[-.29,.40],[.06,.43],[.34,.48],[.46,.41],[.56,.19]];
  let width=.34;
  for(let i=1;i<profile.length;i++) if(y<=profile[i][0]) {
    const [a,w]=profile[i-1],[b,v]=profile[i];const t=Math.max(0,Math.min(1,(y-a)/(b-a)));width=w+(v-w)*t;break;
  }
  return .66*Math.sqrt(Math.max(.001,width*width-x*x));
}
const jawWidth = (y) => y < -.12 ? 1 - (-y-.12)*.42 : 1;
const noseDepth = (x,y) => .035*Math.exp(-(x*x/.0028 + (y+.055)**2/.006));
function faceDepth(x,y) {
  return .38*Math.sqrt(Math.max(.025,1-(x/(.435*jawWidth(y)))**2-(y/.49)**2))+noseDepth(x,y);
}
function facePatch(parent,shape,mat,cx=0,cy=0,lift=.006) {
  const outline=new THREE.ShapeGeometry(shape,24);
  const flat=outline.index ? outline.toNonIndexed() : outline;
  const source=flat.attributes.position, triangles=[];
  function split(a,b,c,depth) {
    if(depth<3 && Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>.045) {
      const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
      split(a,ab,ca,depth+1);split(ab,b,bc,depth+1);split(ca,bc,c,depth+1);split(ab,bc,ca,depth+1);
    } else for(const v of [a,b,c]) triangles.push(v.x,v.y,0);
  }
  for(let i=0;i<source.count;i+=3) split(new THREE.Vector2(source.getX(i),source.getY(i)),new THREE.Vector2(source.getX(i+1),source.getY(i+1)),new THREE.Vector2(source.getX(i+2),source.getY(i+2)),0);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));
  outline.dispose();if(flat!==outline)flat.dispose();
  const p=geo.attributes.position;
  const origin=cx||cy ? faceDepth(cx,cy) : 0;
  for(let i=0;i<p.count;i++) p.setZ(i,faceDepth(p.getX(i)+cx,p.getY(i)+cy)+lift-origin);
  geo.computeVertexNormals(); return mesh(parent,geo,mat);
}
function faceLine(parent,points,radius,mat,cx=0,cy=0,lift=.009) {
  const origin=cx||cy ? faceDepth(cx,cy) : 0;
  return curve(parent,points.map(([x,y])=>[x,y,faceDepth(x+cx,y+cy)+lift-origin]),radius,mat);
}
function buildHair(parent,c,mat) {
  if(c.style==='bald') return;
  const covered=['cap','beanie'].includes(c.hat);
  const style=covered ? 'short' : c.style;
  const curly=style==='curly'||style==='afro'||style==='columbus';
  const broad=style==='afro' ? 1.17 : style==='columbus' ? 1.08 : 1;
  const verts=[], indices=[], rows=24, sides=64;
  for(let j=0;j<=rows;j++) for(let i=0;i<=sides;i++) {
    const a=i/sides*Math.PI*2, front=Math.max(0,Math.sin(a));
    const long=style==='long'?2.45:style==='bob'?2.1:1.82;
    const edge=long+(1.22-long)*Math.min(1,front*2.3)+(style==='swept'?.22*Math.cos(a)*front:0);
    const t=j/rows*edge;
    const ripple=curly ? .009*Math.sin(a*18+t*7)*Math.sin(t*15) : 0;
    const r=(style==='long'||style==='bob') && t>1.4 ? Math.max(.97,Math.sin(t)) : Math.sin(t);
    verts.push(Math.cos(a)*r*(.47*broad+ripple),.035+Math.cos(t)*(.53*broad+ripple),Math.sin(a)*r*(.44*broad+ripple)-.015);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  mesh(parent,geo,mat).name='hair-'+style;
  if(style==='columbus') {
    // Shoulder-length corkscrew curls around the sides and back of one scalp.
    for(let i=0;i<18;i++) {
      const a=Math.PI*.83+i/17*Math.PI*1.34, points=[];
      for(let j=0;j<=64;j++) {
        const t=j/64, spin=t*Math.PI*12+i*.7;
        points.push([Math.cos(a)*.44+Math.cos(spin)*.038, .22-t*(.63+.04*Math.sin(i)), Math.sin(a)*.38+Math.sin(spin)*.038-.025]);
      }
      curve(parent,points,.026,mat).name='melissa-ringlet';
    }
  }
  if(style==='bun') {oval(parent,mat,[0,.56,-.13],[.20,.21,.18]);ring(parent,.15,.018,material(c.palette.accent),[0,.48,-.13]);}
}

export function disposeCharacter(character) {
  if (character?.userData.modelCharacter) { disposeModelCharacter(character); return; }
  character?.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}

export function buildCharacter(idx, appearance = {}, { seated = false } = {}) {
  if (charOf(idx).model) return createModelCharacter(charOf(idx));
  const c = charOf(idx, appearance), G = new THREE.Group(); G.name = 'char';
  const skin = material(c.skin, 'skin'), shirt = material(c.palette.primary), hair = material(c.hair, 'hair');
  const trim = material(c.palette.secondary), cream = material(c.palette.accent), gold = material('#d4af72', 'metal');
  const eyeWhite = material('#fffaf0', 'eyes'), pupil = material('#17233c', 'eyes');
  const iris = material(c.eyeColor, 'eyes');
  const torso = new THREE.LatheGeometry([[0,-.40],[.34,-.40],[.40,-.29],[.43,.06],[.48,.34],[.41,.46],[.19,.56],[0,.56]].map(([x,y]) => new THREE.Vector2(x,y)), 48);
  mesh(G, torso, shirt, [0,0,0], [1,1,.66]).name = 'torso';
  oval(G, skin, [0, .66, 0], [.12, .18, .12]);
  ring(G, .17, .025, trim, [0, .56, 0]);
  curve(G, [[-.31, -.30, .18], [0, -.33, .255], [.31, -.30, .18]], .012, trim);
  if (c.outfit === 'hoodie') {
    oval(G, trim, [0,.50,-.16], [.29,.16,.19]);
    for (const side of [-1,1]) {
      curve(G, [[side*.13,.53,.15],[side*.15,.35,.28],[side*.12,.22,.29]], .009, cream);
      oval(G, cream, [side*.12,.21,.29],[.012,.026,.012],16);
    }
    curve(G, [[-.20,-.13,.257],[-.16,.02,.285],[.16,.02,.285],[.20,-.13,.257]], .012, trim);
  } else if (c.outfit === 'jacket' || c.outfit === 'cardigan') {
    const panel = new THREE.Shape();panel.moveTo(-.16,.44);panel.lineTo(.16,.44);
    if(c.outfit==='cardigan') panel.lineTo(0,.02);
    else {panel.lineTo(.075,-.3);panel.lineTo(-.075,-.3);}
    panel.closePath();
    const insert=facePatch(G,panel,cream),p=insert.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,garmentDepth(p.getX(i),p.getY(i))+.008);
    insert.geometry.computeVertexNormals();
    for (const side of [-1,1]) {
      const edge=c.outfit==='jacket'?[[side*.16,.44],[side*.13,.18],[side*.075,-.29]]:[[side*.16,.44],[side*.09,.21],[side*.02,.02],[side*.02,-.29]];
      curve(G,edge.map(([x,y])=>[x,y,garmentDepth(x,y)+.012]),.012,trim);
      curve(G, [[side*.20,-.12,.255],[side*.32,-.08,.225]],.012,trim);
    }
    if (c.outfit === 'cardigan') for (let i=0;i<3;i++) oval(G,gold,[.065,-.02-i*.10,.307],[.017,.017,.009],16);
    else curve(G,[[0,.1,.31],[0,-.29,.28]],.007,gold);
  } else {
    // Small two-tone chest stripe; the rest of the base stays uncluttered.
    curve(G,[[-.30,.25,.245],[0,.25,.306],[.30,.25,.245]],.015,cream);
    curve(G,[[-.30,.20,.252],[0,.20,.307],[.30,.20,.252]],.007,trim);
  }
  for (const s of [-1, 1]) {
    // Table pose reaches over the rail; the preview keeps its relaxed pose.
    const lift = seated ? .48 : 0, reach = seated ? .35 : 0;
    curve(G, [[s * .28, .35, 0], [s * .44, .34, .06], [s * .54, .16+lift*.65, .17+reach*.3], [s * .49, -.06+lift, .48+reach*.8], [s * .35, -.12+lift, .72+reach]], .123, c.outfit === 'jacket' ? trim : shirt);
    oval(G, trim, [s * .36, -.11+lift, .69+reach], [.144, .12, .105]);
    oval(G, skin, [s * .34, -.12+lift, .80+reach], [.145, .093, .17]).name = 'hand';
    oval(G, skin, [s * .23, -.085+lift, .79+reach], [.06, .065, .10], 24);
    for (let f = 0; f < 2; f++) curve(G, [[s * (.30 + f * .055), -.045+lift, .83+reach], [s * (.30 + f * .055), -.04+lift, .88+reach]], .004, material(shade(c.skin, -.15), 'skin'));
  }

  const H = new THREE.Group(); H.position.y = 1.13; G.add(H); G.userData.head = H;
  // One uninterrupted head surface. The nose is a small deformation of that surface.
  const headGeometry = new THREE.SphereGeometry(1, 64, 48), vertices = headGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i)*.49, jaw = jawWidth(y);
    const x = vertices.getX(i)*.435*jaw, z = vertices.getZ(i)*.38;
    vertices.setXYZ(i,x,y,z + (z > 0 ? noseDepth(x,y) : 0));
  }
  headGeometry.computeVertexNormals(); mesh(H,headGeometry,skin).name = 'smooth-face';
  for (const side of [-1,1]) oval(H,skin,[side*.426,-.015,-.01],[.065,.10,.05]);
  G.userData.eyes = [];
  const faceStroke = material(shade(c.skin,-.48));
  for (const side of [-1,1]) {
    const cx=side*.16, cy=.055;
    const eye=new THREE.Group(); eye.position.set(cx,cy,faceDepth(cx,cy)); H.add(eye); G.userData.eyes.push(eye);
    if (c.expression === 'happy' || (c.expression === 'wink' && side===1)) {
      faceLine(eye,[[-.075,0],[0,.027],[.075,0]],.009,pupil,cx,cy);
    } else {
      const h=c.expression==='calm' ? .028 : .044;
      const shape=new THREE.Shape(); shape.moveTo(-.077,0); shape.quadraticCurveTo(0,h*1.9,.077,0); shape.quadraticCurveTo(0,-h*1.35,-.077,0);
      facePatch(eye,shape,eyeWhite,cx,cy,.006);
      const disc=(r,mat,x=0,y=0,lift=.010)=>{const sh=new THREE.Shape();sh.absellipse(x,y,r,r*1.1,0,Math.PI*2,false,0);facePatch(eye,sh,mat,cx,cy,lift);};
      disc(h*.83,iris); disc(h*.49,pupil,0,0,.014); disc(.009,eyeWhite,-.012,.014,.018);
      faceLine(eye,[[-.077,0],[0,h*.95],[.077,0]],.006,material(shade(c.hair,-.15)),cx,cy,.012);
    }
    const raised=c.expression==='wink' && side===1 ? .02 : 0;
    faceLine(H,[[cx-.07,.16+raised],[cx,.18+raised],[cx+.065,.165+raised]],.009,hair);
  }
  faceLine(H,[[-.025,-.09],[0,-.10],[.025,-.09]],.004,material(shade(c.skin,-.16)));
  if (c.expression==='grin' || c.expression==='happy') {
    const smile=new THREE.Shape();smile.moveTo(-.09,-.16);smile.quadraticCurveTo(0,-.18,.09,-.16);smile.quadraticCurveTo(.065,-.24,0,-.24);smile.quadraticCurveTo(-.065,-.24,-.09,-.16);
    facePatch(H,smile,faceStroke);
    const teeth=new THREE.Shape();teeth.moveTo(-.073,-.17);teeth.quadraticCurveTo(0,-.185,.073,-.17);teeth.lineTo(.059,-.195);teeth.quadraticCurveTo(0,-.21,-.059,-.195);teeth.closePath();
    facePatch(H,teeth,eyeWhite,0,0,.01);
  } else {
    const depth=c.expression==='calm' ? -.18 : -.205;
    faceLine(H,[[-.08,-.17],[0,depth],[.08,c.expression==='wink' ? -.155 : -.17]],.0065,faceStroke);
  }
  if (c.facialHair==='mustache') {
    for (const side of [-1,1]) faceLine(H,[[side*.012,-.125],[side*.055,-.12],[side*.095,-.14]],.015,hair);
  } else if (c.facialHair==='beard') {
    const beard=new THREE.Shape();beard.moveTo(-.31,-.07);beard.quadraticCurveTo(-.27,-.36,0,-.39);beard.quadraticCurveTo(.27,-.36,.31,-.07);beard.lineTo(.22,-.24);beard.quadraticCurveTo(0,-.34,-.22,-.24);beard.closePath();
    facePatch(H,beard,hair,0,0,.009);
  }
  buildHair(H,c,hair);
  if (c.accessory==='studs' || c.accessory==='hoops') for (const side of [-1,1]) {
    if (c.accessory==='studs') oval(H,gold,[side*.442,-.085,.035],[.021,.021,.018],16);
    else { const e=mesh(H,new THREE.TorusGeometry(.038,.008,8,24),gold,[side*.444,-.13,.025]);e.rotation.y=side*.3; }
  }
  if (c.accessory==='necklace') {
    curve(G,[[-.16,.53,.14],[-.10,.31,.29],[0,.24,.31],[.10,.31,.29],[.16,.53,.14]],.007,gold);
    oval(G,gold,[0,.22,.32],[.026,.034,.009],20);
  }
  if (c.accessory==='scarf') {
    ring(G,.18,.05,cream,[0,.59,0]);
    curve(G,[[.12,.56,.14],[.20,.36,.30],[.22,.15,.29]],.055,cream);
  }

  const hat = material(c.hatColor), hatTrim = material(shade(c.hatColor, -.2));
  if (c.hat === 'beanie' || c.hat === 'cap') {
    const m = mesh(H, new THREE.SphereGeometry(.51, 40, 24, 0, Math.PI * 2, 0, Math.PI * .47), hat, [0, .10, -.02]); m.rotation.x = -.12;
    ring(H, .485, .048, hatTrim, [0, .155, -.02]);
    if (c.hat === 'beanie') {
      oval(H, cream, [0, .65, -.08], [.105, .105, .105]);
      for (let j = 0; j < 12; j++) { const a = j / 12 * Math.PI * 2; curve(H, [[Math.cos(a) * .48, .18, Math.sin(a) * .48 - .02], [Math.cos(a) * .41, .40, Math.sin(a) * .41 - .02], [Math.cos(a) * .19, .58, Math.sin(a) * .19 - .02]], .008, hatTrim); }
    } else { const brim = oval(H, hat, [0, .16, .40], [.37, .032, .30], 40); brim.rotation.x = .12; oval(H, gold, [0, .36, .46], [.065, .065, .009]); }
  }
  if (['bowler', 'tophat', 'cowboy'].includes(c.hat)) {
    oval(H, hatTrim, [0, .32, 0], [c.hat === 'cowboy' ? .73 : .62, .035, .52], 48);
    if (c.hat === 'tophat') mesh(H, new THREE.CylinderGeometry(.35, .39, .58, 48), hat, [0, .61, 0]);
    else oval(H, hat, [0, .37, 0], [.4, c.hat === 'cowboy' ? .3 : .25, .37], 40);
    ring(H, .387, .035, gold, [0, .37, 0]);
  }
  if (c.hat === 'headband') { const b = ring(H, .47, .036, hat, [0, .23, 0]); b.rotation.x -= .18; }

  if (c.glasses && c.glasses !== 'none') {
    const frame = material(c.glasses === 'square' ? '#305488' : '#43342e', 'metal');
    for (const s of [-1, 1]) {
      const shape = roundedFrame(.238, .247, c.glasses === 'round' ? .115 : .055);
      const points = shape.getSpacedPoints(48).slice(0, -1).map((p) => [p.x + s * .165, p.y + .065, .435]);
      curve(H, points, .014, frame, true);
      if (c.glasses === 'shades') mesh(H, new THREE.ShapeGeometry(shape, 24), material('#24374d', 'eyes'), [s * .165, .065, .433]);
      curve(H, [[s * .285, .08, .43], [s * .40, .08, .27], [s * .46, .04, .04]], .012, frame);
    }
    curve(H, [[-.04, .075, .435], [0, .09, .51], [.04, .075, .435]], .013, frame);
  }
  G.userData.blinkOffset = idx * .47;
  return G;
}

export function animateCharacter(character, seconds, active = false, reducedMotion = false) {
  if (!character) return;
  if (character.userData.modelCharacter) { animateModelCharacter(character, seconds, active, reducedMotion); return; }
  const phase = (seconds + character.userData.blinkOffset) % 4.6;
  const blink = reducedMotion ? 1 : phase < .16 ? Math.max(.08, Math.abs(phase - .08) / .08) : 1;
  for (const eye of character.userData.eyes || []) eye.scale.y = blink;
  const head = character.userData.head;
  if (head) { head.rotation.y = reducedMotion ? 0 : Math.sin(seconds * (active ? 1.1 : .55)) * .07; head.rotation.z = reducedMotion ? 0 : Math.sin(seconds * .7) * .025; head.rotation.x = active ? -.07 : 0; }
}

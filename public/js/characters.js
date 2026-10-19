// Soft sculpted toy characters. Geometry is procedural and shares the wardrobe
// with the SVG portraits; no external model or texture dependencies.
import * as THREE from '../vendor/three.module.min.js';
import { charOf, shade } from './art.js';
import { createModelCharacter, disposeModelCharacter, animateModelCharacter } from './model-characters.js';

const materials = new Map();
function material(color, kind = 'cloth') {
  const key = `${color}:${kind}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshPhysicalMaterial({
    color, roughness: kind === 'eyes' ? .19 : kind === 'metal' ? .28 : kind === 'hair' ? .48 : .62,
    metalness: kind === 'metal' ? .65 : 0,
    clearcoat: kind === 'skin' ? .15 : kind === 'eyes' ? .65 : .04,
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

export function disposeCharacter(character) {
  if (character?.userData.modelCharacter) { disposeModelCharacter(character); return; }
  character?.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}

export function buildCharacter(idx, appearance = {}) {
  if (charOf(idx).model) return createModelCharacter(charOf(idx));
  const c = charOf(idx, appearance), G = new THREE.Group(); G.name = 'char';
  const skin = material(c.skin, 'skin'), shirt = material(c.shirt), hair = material(c.hair, 'hair');
  const trim = material(shade(c.shirt, -.25)), cream = material('#fff3dc'), gold = material('#efc779', 'metal');
  const eyeWhite = material('#fffaf0', 'eyes'), pupil = material('#17233c', 'eyes');
  const iris = material(['#537c86', '#795035', '#658365', '#8a623f'][idx % 4], 'eyes');
  // Rounded sweater silhouette, rolled collar, cuffs, seams and stitched buttons.
  oval(G, shirt, [0, .14, -.015], [.49, .59, .32], 40);
  ring(G, .155, .06, trim, [0, .64, 0]);
  oval(G, skin, [0, .68, 0], [.14, .21, .14]);
  curve(G, [[-.32, -.23, .22], [0, -.28, .3], [.32, -.23, .22]], .018, trim);
  for (let j = 0; j < 3; j++) oval(G, cream, [0, .41 - j * .13, .312], [.026, .026, .012], 16);
  oval(G, gold, [-.245, .39, .27], [.055, .055, .014], 24);
  curve(G, [[-.26, .38, .29], [-.245, .405, .293], [-.22, .385, .29]], .009, cream);
  for (const s of [-1, 1]) {
    curve(G, [[s * .38, .45, 0], [s * .56, .2, .16], [s * .49, -.06, .48], [s * .35, -.12, .72]], .135, shirt);
    oval(G, trim, [s * .36, -.11, .69], [.144, .12, .105]);
    oval(G, skin, [s * .34, -.12, .80], [.145, .093, .17]);
    oval(G, skin, [s * .23, -.085, .79], [.06, .065, .10], 24);
    for (let f = 0; f < 2; f++) curve(G, [[s * (.30 + f * .055), -.045, .83], [s * (.30 + f * .055), -.04, .88]], .004, material(shade(c.skin, -.15), 'skin'));
  }

  const H = new THREE.Group(); H.position.y = 1.13; G.add(H); G.userData.head = H;
  // Smooth pear-shaped face with a soft jaw, rather than a primitive sphere.
  const headGeometry = new THREE.SphereGeometry(1, 48, 36), vertices = headGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i), jaw = y < -.2 ? 1 - (-y - .2) * .22 : 1;
    vertices.setXYZ(i, vertices.getX(i) * .46 * jaw, y * .51, vertices.getZ(i) * .425);
  }
  headGeometry.computeVertexNormals(); mesh(H, headGeometry, skin);
  for (const s of [-1, 1]) {
    oval(H, skin, [s * .445, -.015, -.005], [.095, .13, .085]);
    oval(H, material(shade(c.skin, -.17), 'skin'), [s * .48, -.02, .058], [.04, .069, .023]);
    oval(H, skin, [s * .255, -.12, .32], [.115, .105, .09]);
    const cheekColor = new THREE.Color(c.skin).lerp(new THREE.Color('#df8790'), .24);
    oval(H, material('#' + cheekColor.getHexString(), 'skin'), [s * .27, -.095, .391], [.061, .038, .009]);
  }
  G.userData.eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * .165, .065, .395); H.add(eye); G.userData.eyes.push(eye);
    oval(eye, eyeWhite, [0, 0, 0], [.105, .126, .059], 32);
    oval(eye, iris, [-s * .008, -.005, .052], [.06, .077, .019]);
    oval(eye, pupil, [-s * .008, -.005, .068], [.032, .049, .011]);
    oval(eye, eyeWhite, [-.02, .03, .078], [.019, .023, .008], 20);
    oval(eye, eyeWhite, [.022, -.027, .078], [.008, .009, .004], 16);
    curve(H, [[s * .07, .225, .368], [s * .155, .257, .358], [s * .25, .225, .335]], .021, hair);
  }
  oval(H, skin, [0, -.055, .443], [.074, .071, .074], 32);
  oval(H, material(shade(c.skin, .08), 'skin'), [-.015, -.035, .501], [.025, .019, .01], 20);
  const smile = new THREE.Shape(); smile.moveTo(-.118, -.155); smile.quadraticCurveTo(0, -.195, .118, -.155); smile.quadraticCurveTo(.085, -.245, 0, -.247); smile.quadraticCurveTo(-.085, -.245, -.118, -.155);
  mesh(H, new THREE.ExtrudeGeometry(smile, { depth: .005, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .008, bevelThickness: .006, curveSegments: 20 }), material('#70353e'), [0, 0, .39]);
  oval(H, eyeWhite, [0, -.17, .408], [.087, .024, .012]);
  oval(H, material('#cc7783'), [0, -.224, .402], [.044, .012, .008], 20);

  // Sculpted hair: rounded swept locks and curls with subtle highlights.
  const hairHighlight = material(shade(c.hair, .10), 'hair');
  const crown = () => { const m = mesh(H, new THREE.SphereGeometry(.49, 40, 24, 0, Math.PI * 2, 0, Math.PI * .48), hair, [0, .05, -.035]); m.rotation.x = -.22; return m; };
  if (c.style !== 'bald') crown();
  if (['short', 'spiky', 'bob', 'long'].includes(c.style)) {
    for (let j = 0; j < 4; j++) {
      const x = -.29 + j * .14;
      curve(H, [[x - .04, .44, .17], [x, .46 + (j === 2 ? .07 : 0), .28], [x + .10, .36, .36], [x + .12, .26 + j * .018, .352]], .065, j % 2 ? hairHighlight : hair);
    }
  }
  if (['long', 'bob'].includes(c.style)) {
    const length = c.style === 'long' ? -.51 : -.2;
    oval(H, hair, [0, .01, -.25], [.475, .49, .25], 36);
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) curve(H, [[s * .36, .35, -.1 + j * .08], [s * .46, .02, -.09 + j * .08], [s * .40, length, -.04 + j * .07]], .075, j === 1 ? hairHighlight : hair);
  }
  if (c.style === 'bun') { oval(H, hair, [0, .48, -.24], [.23, .22, .22]); ring(H, .17, .025, gold, [0, .43, -.24]); }
  if (c.style === 'afro' || c.style === 'curly') {
    if (c.style === 'afro') oval(H, hair, [0, .20, -.2], [.58, .53, .44], 36);
    for (let j = 0; j < 18; j++) {
      const a = j * 2.39996, radius = .17 + .26 * Math.sqrt(j / 18);
      oval(H, j % 3 ? hair : hairHighlight, [Math.cos(a) * radius, .34 + Math.sin(a) * .16, .18 + Math.sin(j * 1.7) * .13], [.115, .12, .115], 24);
    }
  }
  if (c.extra === 'beard') {
    curve(H, [[-.35, -.10, .25], [-.28, -.32, .25], [0, -.40, .26], [.28, -.32, .25], [.35, -.10, .25]], .10, hair);
  }
  if (c.extra === 'mustache') for (const s of [-1, 1]) curve(H, [[0, -.118, .45], [s * .07, -.12, .45], [s * .12, -.15, .42]], .026, hair);
  if (c.extra === 'earrings') for (const s of [-1, 1]) {
    const e = mesh(H, new THREE.TorusGeometry(.048, .012, 10, 32), gold, [s * .47, -.125, .035]); e.rotation.y = s * .2;
  }
  if (c.extra === 'bowtie') for (const s of [-1, 1]) { const tie = oval(G, material('#dc5b6b'), [s * .085, .56, .26], [.10, .065, .04]); tie.rotation.z = s * .25; }

  const hat = material(c.hatColor), hatTrim = material(shade(c.hatColor, -.2));
  if (c.hat === 'beanie' || c.hat === 'cap') {
    const m = mesh(H, new THREE.SphereGeometry(.51, 40, 24, 0, Math.PI * 2, 0, Math.PI * .47), hat, [0, .12, -.02]); m.rotation.x = -.12;
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
      const points = shape.getSpacedPoints(48).slice(0, -1).map((p) => [p.x + s * .165, p.y + .065, .497]);
      curve(H, points, .014, frame, true);
      if (c.glasses === 'shades') mesh(H, new THREE.ShapeGeometry(shape, 24), material('#24374d', 'eyes'), [s * .165, .065, .495]);
      curve(H, [[s * .285, .08, .49], [s * .40, .08, .27], [s * .46, .04, .04]], .012, frame);
    }
    curve(H, [[-.04, .075, .497], [0, .09, .51], [.04, .075, .497]], .013, frame);
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

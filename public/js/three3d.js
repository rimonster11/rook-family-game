// 3D table, local GLB and procedural characters, card animations.
import * as THREE from '../vendor/three.module.min.js';
import { charOf, drawCardFace, drawCardBack, drawFeltEmblem, CW, CH, shade } from './art.js';

export const TEAM_HEX = ['#4cc2ff', '#e2e8f0'];
const POS = ['bottom', 'left', 'top', 'right'];
const SEAT_R = 4.5; // Clear the 3.75 outer rail with both cushion and torso.
const tableLayouts = new WeakMap();
// Read-only rendered geometry, used by local visual regression checks.
export const inspectTableLayout = canvas => tableLayouts.get(canvas)?.();
const posVec = { bottom: new THREE.Vector3(0, 0, 1), left: new THREE.Vector3(-1, 0, 0), top: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0) };

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

// ---------- materials / textures ----------
const matCache = new Map();
function mat(hex, o = {}) {
  const k = hex + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.65, metalness: o.m ?? 0, ...(o.e ? { emissive: o.e, emissiveIntensity: o.ei ?? 1 } : {}), ...(o.t ? { transparent: true, opacity: o.t } : {}) }));
  return matCache.get(k);
}
let backTex = null; const faceTex = new Map(); let maxAniso = 4, texScale = 1.5;
function canvasTex(draw, w = CW, h = CH) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
// Card art is drawn above nominal size so numbers stay sharp at an angle; faces are released when a card leaves the table.
const cardTex = (draw) => {
  const scale=texScale, texture=canvasTex(ctx=>{ctx.scale(scale,scale);draw(ctx);},Math.round(CW*scale),Math.round(CH*scale));
  document.fonts.ready.then(()=>{const ctx=texture.image.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);draw(ctx);texture.needsUpdate=true;});
  return texture;
};
const getBack = () => backTex || (backTex = cardTex(drawCardBack));
function getFace(card) { if (!faceTex.has(card.id)) faceTex.set(card.id, cardTex((ctx) => drawCardFace(ctx, card))); return faceTex.get(card.id); }
function dropFace(id) { faceTex.get(id)?.dispose(); faceTex.delete(id); }
let glowTex = null;
const getGlow = () => glowTex || (glowTex = canvasTex((ctx, w) => {
  const h = Math.round(w * CH / CW), mx = w * 0.12, my = h * 0.12, r = w * 0.09;
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = w * 0.08;
  ctx.beginPath(); ctx.moveTo(mx + r, my); ctx.arcTo(w - mx, my, w - mx, h - my, r); ctx.arcTo(w - mx, h - my, mx, h - my, r); ctx.arcTo(mx, h - my, mx, my, r); ctx.arcTo(mx, my, w - mx, my, r); ctx.fill();
}, 128, Math.round(128 * CH / CW)));

const CARD_W = 0.92, CARD_H = CARD_W * CH / CW;
const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
// A little self-light keeps white faces bright under the tone-mapped spotlight.
const cardMat = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.62, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.22, transparent: true, alphaTest: 0.5 });
function makeCard(card, trick = false) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(cardGeo, cardMat(card ? getFace(card) : getBack()));
  const b = new THREE.Mesh(cardGeo, cardMat(getBack()));
  b.rotation.y = Math.PI; f.castShadow = true; b.castShadow = true;
  g.add(f, b);
  if (trick) {
    // Played cards get a soft contact shadow, plus a gold glow that lights up under the trick winner.
    const glow = (color, opacity, scale, x, y, z) => { const m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: getGlow(), color, transparent: true, opacity, depthWrite: false })); m.scale.set(scale, scale, 1); m.position.set(x, y, z); g.add(m); return m; };
    glow('#000000', 0.6, 1.3, 0.03, -0.06, -0.012);
    g.userData.halo = glow('#ffd36e', 1, 1.44, 0, 0, -0.006); g.userData.halo.visible = false;
  }
  return g;
}

// Character geometry is shared by the preview and table.
export { buildCharacter } from './characters.js';
import { buildCharacter, disposeCharacter, animateCharacter } from './characters.js';
const motionPreference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!motionPreference?.matches;

// ---------- preview (sign-in) ----------
export function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 1.10, 4.65); cam.lookAt(0, 0.75, 0);
  scene.add(new THREE.HemisphereLight('#fff3e4', '#506491', 2.0));
  const key = new THREE.DirectionalLight('#fff0dd', 3.0); key.position.set(2, 4, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#7fb2ff', 1.6); rim.position.set(-3, 2, -3); scene.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.12, 48), mat('#123a9c', { r: 0.5 })); base.position.y = -0.45; scene.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.025, 8, 64), mat('#ffffff', { e: '#9cc8ff', ei: 0.6 })); baseRing.rotation.x = Math.PI / 2; baseRing.position.y = -0.39; scene.add(baseRing);
  let ch = null, raf = 0, t0 = performance.now(), spin = 0, alive = true;
  const set = (i, appearance) => { if (ch) { scene.remove(ch); disposeCharacter(ch); } ch = buildCharacter(i, appearance); ch.position.y = ch.userData.modelCharacter ? .06 : -.3; scene.add(ch); t0 = performance.now(); };
  const resize = () => { const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const loop = (t) => { if (!alive) return; raf = requestAnimationFrame(loop); if (document.hidden) return; const k = (t - t0) / 1000; spin += 0.004; if (ch) { animateCharacter(ch, t / 1000, false, reducedMotion()); ch.rotation.y = reducedMotion() ? 0 : Math.sin(spin * 2) * 0.30; ch.position.y = (ch.userData.modelCharacter ? .06 : -.3) + (reducedMotion() ? 0 : Math.sin(k * 2.2) * 0.02); if (k < 0.5 && !reducedMotion()) { const s = 0.8 + 0.2 * (1 - Math.pow(1 - k / 0.5, 3)); ch.scale.setScalar(s); } else ch.scale.setScalar(1); } renderer.render(scene, cam); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(canvas); raf = requestAnimationFrame(loop);
  return { set, resize, dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); disposeCharacter(ch); base.geometry.dispose(); baseRing.geometry.dispose(); renderer.dispose(); } };
}

// ---------- table ----------
const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createTable(container, { quality = 'high', onFps } = {}) {
  const canvas = document.createElement('canvas'); canvas.className = 'gl'; container.prepend(canvas);
  const hi = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: hi, powerPreference: hi ? 'high-performance' : 'low-power' });
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()); texScale = hi ? 2 : 1.5;
  renderer.setPixelRatio(Math.min(hi ? 2 : 1.25, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = hi; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#061232'); scene.fog = new THREE.Fog('#061232', 24, 55);
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 80);

  scene.add(new THREE.HemisphereLight('#c9dbff', '#0a1838', 0.9));
  const spot = new THREE.SpotLight('#ffffff', 70, 26, 0.8, 0.65, 1.5); spot.position.set(0.5, 9, 1.5); spot.target.position.set(0, 0, 0); spot.castShadow = hi;
  spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.radius = 4; scene.add(spot, spot.target);
  const fill = new THREE.DirectionalLight('#8fb6ff', 0.6); fill.position.set(-6, 5, 6); scene.add(fill);
  const warmRim = new THREE.DirectionalLight('#f7d3a0', 1.1); warmRim.position.set(4, 5, -5); scene.add(warmRim);

  // floor
  const floorTex = canvasTex((ctx, S) => { const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, '#173a85'); g.addColorStop(0.55, '#0a1d4d'); g.addColorStop(1, '#061232'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); }, 512, 512);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.6; floor.receiveShadow = hi; scene.add(floor);
  // table
  const R = 3.3;
  const woodGrain = canvasTex((ctx, S) => {
    ctx.fillStyle = '#785034'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 3) {
      ctx.strokeStyle = y % 9 === 0 ? '#37271955' : '#d8a76a33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(S * .3, y + Math.sin(y) * 12, S * .7, y - 8, S, y + 4); ctx.stroke();
    }
  }, 512, 512);
  const wood = new THREE.MeshStandardMaterial({ map: woodGrain, roughness: 0.38, metalness: 0.05 });
  const leather = new THREE.MeshStandardMaterial({ color: '#7a4322', roughness: 0.42, metalness: 0.05 });
  const brass = new THREE.MeshStandardMaterial({ color: '#e7c27e', roughness: 0.3, metalness: 0.65 });
  const feltTex = canvasTex((ctx, S) => { const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, '#2457d0'); g.addColorStop(0.62, '#173fa6'); g.addColorStop(1, '#0d2d7e'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); const n = ctx.getImageData(0, 0, S, S); for (let i = 0; i < n.data.length; i += 4) { const v = (Math.random() - 0.5) * 9; n.data[i] += v; n.data[i + 1] += v; n.data[i + 2] += v; } ctx.putImageData(n, 0, 0); drawFeltEmblem(ctx, S); }, 1024, 1024);
  const felt = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 })); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
  // Padded leather rail with brass stitching over a turned wooden skirt.
  const ring = (radius, tube, m, y, segs = 128, flat = 1) => { const o = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 20, segs), m); o.rotation.x = Math.PI / 2; o.position.y = y; o.scale.z = flat; scene.add(o); return o; };
  const rail = ring(R + 0.2, 0.25, leather, 0.07, 160, 0.72); rail.castShadow = hi; rail.receiveShadow = hi;
  ring(R + 0.2, 0.007, brass, 0.25, 200);
  ring(R - 0.09, 0.02, brass, 0.008);
  ring(R + 0.42, 0.06, wood, -0.05);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.44, R + 0.3, 0.36, 96, 1, true), wood); skirt.position.y = -0.24; scene.add(skirt);
  ring(R + 0.31, 0.05, wood, -0.42);
  const ped = new THREE.Mesh(new THREE.LatheGeometry([[0, -0.4], [0.68, -0.42], [0.5, -0.62], [0.36, -1.0], [0.42, -1.5], [0.33, -1.95], [0.6, -2.3], [1.0, -2.45], [0, -2.45]].map(([x, y]) => new THREE.Vector2(x, y)), 40), wood); scene.add(ped);
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 1.5), wood); foot.position.set(Math.sin(a) * 0.95, -2.52, Math.cos(a) * 0.95); foot.rotation.y = a; foot.receiveShadow = hi; scene.add(foot); }

  function buildChair(woodM, shadows) {
    // Local +z faces the table; the seated character's torso rests on the cushion.
    const c = new THREE.Group(); const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadows; c.add(o); return o; };
    const fabric = new THREE.MeshStandardMaterial({ color: '#1b3f86', roughness: 0.82, side: THREE.DoubleSide });
    const trim = new THREE.MeshStandardMaterial({ color: '#4cc2ff', roughness: 0.4, emissive: '#4cc2ff', emissiveIntensity: 0.3 });
    add(new THREE.CylinderGeometry(0.64, 0.6, 0.1, 36), woodM, 0, -0.47, -0.14);
    add(new THREE.CylinderGeometry(0.57, 0.61, 0.14, 36), fabric, 0, -0.35, -0.14);
    add(new THREE.TorusGeometry(0.6, 0.026, 6, 40), trim, 0, -0.35, -0.14).rotation.x = Math.PI / 2;
    for (const [x, z] of [[-0.44, 0.26], [0.44, 0.26], [-0.44, -0.54], [0.44, -0.54]]) add(new THREE.CylinderGeometry(0.045, 0.034, 2.1, 10), woodM, x, -1.55, z).rotation.set(z > 0 ? -0.03 : 0.03, 0, x > 0 ? 0.03 : -0.03);
    // Curved upholstered back between two posts, capped with a wooden rail and team piping.
    const BR = 1.4, span = 0.9, cz = 0.66;
    add(new THREE.CylinderGeometry(BR, BR, 0.92, 24, 1, true, Math.PI - span / 2, span), fabric, 0, 0.42, cz);
    const arc = (r, tube, m, y) => add(new THREE.TorusGeometry(r, tube, 8, 28, span), m, 0, y, cz).rotation.set(-Math.PI / 2, 0, Math.PI / 2 - span / 2);
    arc(BR, 0.065, woodM, 0.92); arc(BR - 0.03, 0.024, trim, 0.83); arc(BR - 0.03, 0.024, trim, 0.0);
    for (const sx of [-1, 1]) { const x = sx * BR * Math.sin(span / 2), z = cz - BR * Math.cos(span / 2); add(new THREE.CylinderGeometry(0.055, 0.06, 1.5, 12), woodM, x, 0.2, z); add(new THREE.SphereGeometry(0.085, 14, 10), woodM, x, 1.0, z); }
    c.userData.trim = { material: trim }; return c;
  }

  // seats
  const seats = POS.map((pos) => {
    const dir = posVec[pos]; const grp = new THREE.Group(); grp.position.copy(dir).multiplyScalar(SEAT_R); grp.lookAt(0, 0, 0); scene.add(grp);
    const chair = buildChair(wood, hi); const trim = chair.userData.trim; grp.add(chair);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 48), new THREE.MeshBasicMaterial({ color: '#9fdcff', transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(dir).multiplyScalar(2.45); ring.position.y = 0.012; scene.add(ring);
    return { pos, dir, grp, chair, trim, ring, ch: null, charIdx: -1, fan: new THREE.Group(), fanCount: -1, anchor: new THREE.Vector3().copy(dir).multiplyScalar(SEAT_R).setY(2.25) };
  });
  seats.forEach((s) => s.grp.add(s.fan));
  const dealerChip = (() => { const t = canvasTex((ctx, S) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, 7); ctx.fill(); ctx.strokeStyle = '#123a9c'; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.4, 0, 7); ctx.stroke(); ctx.fillStyle = '#0b2470'; ctx.font = `900 ${S * 0.5}px Inter,Arial,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('D', S / 2, S / 2 + S * 0.03); }, 128, 128);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 32), [new THREE.MeshStandardMaterial({ color: '#e8eef8' }), new THREE.MeshStandardMaterial({ map: t }), new THREE.MeshStandardMaterial({ color: '#e8eef8' })]); m.castShadow = hi; m.visible = false; scene.add(m); return m; })();

  const nestGrp = new THREE.Group(); scene.add(nestGrp); let nestKey = '';

  // ---- camera fitting ----
  let W = 1, Hh = 1;
  function resize() {
    W = container.clientWidth || 1; Hh = container.clientHeight || 1; renderer.setSize(W, Hh, false); cam.aspect = W / Hh;
    container.classList.toggle('compact-seats', !!container.closest('.mobile-table') && Hh < 240);
    // Seat geometry never changes to accommodate a screen: only the camera does.
    fitScene();
    refitTrick();
  }
  // Fit the actual seating envelope, including chair backs/legs and raised hands.
  const FIT_PTS = [];
  for (let i=0;i<32;i++) { const a=i/32*Math.PI*2; FIT_PTS.push(new THREE.Vector3(Math.cos(a)*(R+.46),.25,Math.sin(a)*(R+.46))); }
  for(const st of seats.filter(s=>s.pos!=='bottom')) {
    st.grp.updateMatrixWorld(true);
    for(const x of [-.8,.8]) for(const y of [-2.6,2.35]) for(const z of [-.9,1.5]) FIT_PTS.push(st.grp.localToWorld(new THREE.Vector3(x,y,z)));
  }
  const fitV = new THREE.Vector3(), fitTarget = new THREE.Vector3(0, 0.0, -0.35), fitDir = new THREE.Vector3();
  function fitScene() {
    const el = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(36 + (Hh / W - 0.7) * 45, 36, 56));
    fitDir.set(0, Math.sin(el), Math.cos(el)); cam.fov = 34; cam.updateProjectionMatrix();
    const labelMargin = container.closest('.mobile-table') ? 48 : 90;
    const mt = 2 * Math.min(labelMargin,Hh*.45) / Hh, mb = 2 * 8 / Hh, mx = 2 * 12 / W;
    const measure = (d) => {
      cam.position.copy(fitTarget).addScaledVector(fitDir, d); cam.lookAt(fitTarget); cam.updateMatrixWorld(true);
      let x = 0, y0 = Infinity, y1 = -Infinity;
      for (const p of FIT_PTS) { fitV.copy(p).project(cam); x = Math.max(x, Math.abs(fitV.x)); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y); }
      return { x, y0, y1 };
    };
    let lo = 4, hi = 80;
    for (let i = 0; i < 26; i++) { const d = (lo + hi) / 2, m = measure(d); if (m.x <= 1 - mx && m.y1 - m.y0 <= 2 - mt - mb) hi = d; else lo = d; }
    const m = measure(hi);
    // Off-axis shift centres the content in the band between the top and bottom HUD margins.
    cam.projectionMatrix.elements[9] -= (mb - mt) / 2 - (m.y1 + m.y0) / 2;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  let refitTrick = () => {};
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  // ---- state ----
  let mySeat = 0; const rel = (seat) => (seat - mySeat + 4) % 4;
  const cards = new Map(); // id -> {obj, anim, seat, trickNo, state}
  const anims = new Set();
  let plateEls = {}; let turnPos = null;
  function tween(obj, to, dur, opts = {}) {
    const from = { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.x };
    const a = { obj, from, to, dur, t0: performance.now() + (opts.delay || 0), arc: opts.arc || 0, done: opts.done, ease: opts.ease || ease };
    anims.add(a); return a;
  }
  const flatQ = (yaw) => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, yaw, 'YXZ'));
  const flatQFace = (yaw) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)); return q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))); };
  // Played cards land large, nearly square to the viewer, and spaced so corner numbers are never covered.
  // The portrait camera sits farther back, so phones get bigger cards than the desktop view.
  function slotFor(seat, order, trickNo) {
    const d = posVec[POS[rel(seat)]]; const jitter = ((trickNo * 7 + seat * 13) % 10 - 5) * 0.01; const k = cam.aspect < 1 ? 1.5 : 1.08;
    return { p: new THREE.Vector3(d.x * 1.03 * k, 0.03 + order * 0.008, d.z * 0.82 * k), q: flatQFace(jitter + d.x * 0.05), s: k };
  }
  const discard = (id, e) => { scene.remove(e.obj); e.obj.traverse((o) => o.material && o.material.dispose()); dropFace(id); cards.delete(id); };
  // Phase panels can reshape the table after a card is thrown; landed cards follow the current camera.
  const settle = (e) => { const sl = slotFor(e.seat, e.order, e.trickNo); e.obj.position.copy(sl.p); e.obj.quaternion.copy(sl.q); e.obj.scale.setScalar(sl.s); };
  refitTrick = () => { for (const e of cards.values()) if (e.state === 'landed') settle(e); };
  function addCard(play, order, trickNo) {
    const obj = makeCard(play.card, true); const r = rel(play.seat); const d = posVec[POS[r]];
    if (r === 0) { obj.position.set(0, 2.2, 5.2); obj.quaternion.setFromEuler(new THREE.Euler(-0.9, 0, 0)); }
    else { obj.position.copy(d).multiplyScalar(SEAT_R - 0.8).setY(1.0); obj.quaternion.copy(flatQFace(Math.atan2(d.x, d.z))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))); }
    scene.add(obj); const slot = slotFor(play.seat, order, trickNo);
    const entry = { obj, seat: play.seat, order, trickNo, state: 'flying', landAt: performance.now() + 450 };
    tween(obj, slot, 450, { arc: 0.8, done: () => { entry.state = 'landed'; settle(entry); } });
    cards.set(play.card.id, entry);
  }
  function collect(trickNo, winner) {
    const list = [...cards.entries()].filter(([, e]) => e.trickNo === trickNo && e.state !== 'collecting');
    const d = posVec[POS[rel(winner)]];
    list.forEach(([id, e], i) => {
      e.state = 'collecting';
      const to = { p: new THREE.Vector3(d.x * 2.6, 0.03 + i * 0.01, d.z * 2.4), q: flatQFace(Math.atan2(d.x, d.z) + Math.PI), s: 0.55 };
      tween(e.obj, to, 520, { delay: i * 40, arc: 0.3, ease: easeIO, done: () => discard(id, e) });
    });
  }
  let collectTimer = null, pendingCollect = null;

  function setSeatChar(s, seatInfo, team) {
    const idx = seatInfo ? seatInfo.character ?? 0 : -1;
    if (s.pos === 'bottom') { if (s.ch) { s.grp.remove(s.ch); disposeCharacter(s.ch); s.ch = null; } s.charIdx = idx; s.chair.visible = false; return; }
    s.chair.visible = true;
    const lookKey = JSON.stringify([idx, seatInfo?.appearance || {}]);
    if (s.lookKey !== lookKey) { if (s.ch) { s.grp.remove(s.ch); disposeCharacter(s.ch); } s.ch = idx >= 0 ? buildCharacter(idx, seatInfo.appearance, {seated:true}) : null; if (s.ch) { s.ch.position.set(0, 0.15, 0.05); s.grp.add(s.ch); } s.charIdx = idx; s.lookKey = lookKey; }
    s.trim.material.color.set(TEAM_HEX[team]); s.trim.material.emissive.set(TEAM_HEX[team]);
  }
  function setFan(s, n) {
    if (s.pos === 'bottom' || s.fanCount === n) return; s.fanCount = n; s.fan.clear();
    for (let i = 0; i < n; i++) { const c = makeCard(null); c.scale.setScalar(0.62); const a = (i - (n - 1) / 2) * 0.12; c.position.set(Math.sin(a) * 0.55, 0.96 + (Math.cos(a)-1) * 0.25, 1.18 + i * 0.004); c.rotation.set(-0.35, Math.PI, a); s.fan.add(c); }
  }

  function update({ g, seats: roomSeats, mySeat: ms, plays, won }) {
    if (ms !== mySeat) { mySeat = ms; for (const s of seats) { s.charIdx = -2; s.fanCount = -1; } }
    for (let seat = 0; seat < 4; seat++) {
      const s = seats[rel(seat)]; setSeatChar(s, roomSeats[seat], seat % 2); setFan(s, g ? g.handCounts[seat] : 0);
    }
    turnPos = g && g.turn != null && g.phase !== 'handOver' && g.phase !== 'gameOver' ? POS[rel(g.turn)] : null;
    if (g && g.dealer != null) { const d = posVec[POS[rel(g.dealer)]]; const side = new THREE.Vector3(d.z, 0, -d.x); dealerChip.position.copy(d).multiplyScalar(2.6).addScaledVector(side, 0.9).setY(0.04); dealerChip.visible = true; } else dealerChip.visible = false;
    // nest
    const nk = g && g.phase === 'bidding' ? g.nestCount + '|' + (g.nestFaceUp?.id || '') : '';
    if (nk !== nestKey) { nestKey = nk; nestGrp.clear(); if (nk) { for (let i = 0; i < g.nestCount; i++) { const faceUp = g.nestFaceUp && i === g.nestCount - 1; const c = makeCard(faceUp ? g.nestFaceUp : null); c.quaternion.copy(faceUp ? flatQFace(0.05) : flatQFace(0.03 * i).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)))); c.position.set(faceUp ? 0.95 : 0, 0.02 + i * 0.012, 0); nestGrp.add(c); } } }
    // trick cards
    // A trick in progress is numbered one past the completed count, matching lastTrick.no once it is won.
    plays = plays || []; const tn = won ? won.no : g ? g.trickNo + 1 : 0; const ids = new Set(plays.map((p) => p.card.id));
    for (const [id, e] of cards) if (!ids.has(id) && e.state !== 'collecting') { if (pendingCollect && pendingCollect.no === e.trickNo) { clearTimeout(collectTimer); const pc = pendingCollect; pendingCollect = null; collect(pc.no, pc.winner); } else discard(id, e); }
    plays.forEach((p, i) => { if (!cards.has(p.card.id)) addCard(p, i, tn); });
    for (const e of cards.values()) e.obj.userData.halo.visible = !!won && e.trickNo === won.no && e.seat === won.winner;
    if (won && (!pendingCollect || pendingCollect.no !== won.no) && [...cards.values()].some((e) => e.trickNo === won.no && e.state !== 'collecting')) {
      const land = Math.max(...[...cards.values()].map((e) => e.landAt)); pendingCollect = { no: won.no, winner: won.winner };
      clearTimeout(collectTimer); collectTimer = setTimeout(() => { if (pendingCollect && pendingCollect.no === won.no) { const pc = pendingCollect; pendingCollect = null; collect(pc.no, pc.winner); } }, Math.max(0, land - performance.now()) + 850);
    }
  }

  // ---- loop ----
  const v = new THREE.Vector3(), tags = {}; let raf = 0, alive = true, last = performance.now(), frames = 0, fpsT = performance.now(), lowSkip = !hi;
  function frame(now) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    if (document.hidden || !container.offsetParent) return;
    if (lowSkip && anims.size === 0 && (frames & 1)) { frames++; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const k = now / 1000;
    for (const a of anims) {
      const t = Math.min(1, Math.max(0, (now - a.t0) / a.dur)); if (now < a.t0) continue; const e = a.ease(t);
      a.obj.position.lerpVectors(a.from.p, a.to.p, e); a.obj.position.y += Math.sin(Math.PI * e) * a.arc;
      a.obj.quaternion.slerpQuaternions(a.from.q, a.to.q, e); if (a.to.s) a.obj.scale.setScalar(a.from.s + (a.to.s - a.from.s) * e);
      if (t >= 1) { anims.delete(a); a.done && a.done(); }
    }
    for (const s of seats) {
      const on = s.pos === turnPos && s.pos !== 'bottom'; s.ring.material.opacity += ((on ? 0.55 + 0.3 * Math.sin(k * 4) : 0) - s.ring.material.opacity) * Math.min(1, dt * 8);
      if (s.ch) { s.ch.position.y = 0.15 + (reducedMotion() ? 0 : Math.sin(k * 1.6 + s.dir.x * 2 + s.dir.z) * 0.015 + (on ? Math.abs(Math.sin(k * 3)) * 0.04 : 0)); animateCharacter(s.ch, k, on, reducedMotion()); }
      const el = plateEls[s.pos];
      // Name tags ride just above each player's head; phone tags are compact, so they need less headroom.
      if (el && s.pos !== 'bottom') {
        const phone = !!container.closest('.mobile-table'), compact=container.classList.contains('compact-seats');
        v.copy(s.anchor).project(cam);
        const x=(v.x*.5+.5)*W,y=(-v.y*.5+.5)*Hh,ew=el.offsetWidth,eh=el.offsetHeight;
        tags[s.pos]={el,ew,eh,cx:compact?W*(['left','top','right'].indexOf(s.pos)+.5)/3:Math.min(W-ew/2-6,Math.max(ew/2+6,x)),
          cy:compact?eh+6:Math.min(Hh-12,Math.max(eh+(phone?6:30),y))};
      }
      else tags[s.pos] = null;
    }
    // On short or narrow tables a side tag can meet the top tag; drop it just below instead of overlapping.
    const top = tags.top;
    for (const pos of ['left', 'right']) {
      const t = tags[pos];
      if (!container.classList.contains('compact-seats') && top && t && Math.abs(t.cx - top.cx) < (t.ew + top.ew) / 2 + 4 && t.cy > top.cy - top.eh - 4 && t.cy - t.eh < top.cy + 4) t.cy = Math.min(Hh - 12, top.cy + t.eh + 6);
    }
    for (const t of Object.values(tags)) if (t) t.el.style.transform = `translate(${t.cx.toFixed(1)}px, ${t.cy.toFixed(1)}px) translate(-50%, -100%)`;
    renderer.render(scene, cam);
    frames++; if (now - fpsT > 3000) { onFps && onFps(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  }
  raf = requestAnimationFrame(frame);
  tableLayouts.set(canvas, () => {
    scene.updateMatrixWorld(true);
    const box = object => new THREE.Box3().setFromObject(object);
    const near = (bounds, dir) => dir.x ? (dir.x > 0 ? bounds.min.x : -bounds.max.x) : -bounds.max.z;
    return seats.filter(s => s.pos !== 'bottom' && s.ch).map(s => {
      const torso=s.ch.getObjectByName('torso'), hands=[];
      s.ch.traverse(o=>{if(o.name==='hand')hands.push(box(o).min.y);});
      const bounds=box(s.grp), projected=[];
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const p=new THREE.Vector3(x,y,z).project(cam);projected.push([p.x,p.y]);
      }
      return {position:s.pos,chairClearance:near(box(s.chair),s.dir)-(R+.45),
        torsoClearance:torso?near(box(torso),s.dir)-(R+.45):null,
        handsAboveRail:hands.length?Math.min(...hands)-.25:null,
        cardsAboveRail:s.fan.children.length?box(s.fan).min.y-.25:null,
        projected};
    });
  });
  return {
    update, resize,
    setPlates(map) { plateEls = map; requestAnimationFrame(() => { for (const el of Object.values(map)) { el._w = el.offsetWidth; el._h = el.offsetHeight; } }); },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(collectTimer); renderer.dispose(); canvas.remove(); },
  };
}

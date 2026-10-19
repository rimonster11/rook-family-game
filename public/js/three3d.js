// 3D table, local GLB and procedural characters, card animations.
import * as THREE from '../vendor/three.module.min.js';
import { charOf, drawCardFace, drawCardBack, drawFeltEmblem, CW, CH, shade } from './art.js';

export const TEAM_HEX = ['#4cc2ff', '#e2e8f0'];
const POS = ['bottom', 'left', 'top', 'right'];
const SEAT_R = 4.15;
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
let backTex = null; const faceTex = new Map(); let maxAniso = 4;
function canvasTex(draw, w = CW, h = CH) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; }
const getBack = () => backTex || (backTex = canvasTex(drawCardBack));
function getFace(card) { if (!faceTex.has(card.id)) faceTex.set(card.id, canvasTex((ctx) => drawCardFace(ctx, card))); return faceTex.get(card.id); }

const CARD_W = 0.92, CARD_H = CARD_W * CH / CW;
const cardGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
function makeCard(card) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: card ? getFace(card) : getBack(), roughness: 0.45, transparent: true, alphaTest: 0.5 }));
  const b = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ map: getBack(), roughness: 0.45, transparent: true, alphaTest: 0.5 }));
  b.rotation.y = Math.PI; f.castShadow = true; b.castShadow = true;
  g.add(f, b); return g;
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
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  renderer.setPixelRatio(Math.min(hi ? 2 : 1.25, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = hi; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#061232'); scene.fog = new THREE.Fog('#061232', 14, 30);
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
  const feltTex = canvasTex((ctx, S) => { const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, '#1d4fc4'); g.addColorStop(0.7, '#123a9c'); g.addColorStop(1, '#0b2a78'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); const n = ctx.getImageData(0, 0, S, S); for (let i = 0; i < n.data.length; i += 4) { const v = (Math.random() - 0.5) * 10; n.data[i] += v; n.data[i + 1] += v; n.data[i + 2] += v; } ctx.putImageData(n, 0, 0); drawFeltEmblem(ctx, S); }, 1024, 1024);
  const felt = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 })); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; scene.add(felt);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.2, 20, 96), wood); rim.rotation.x = Math.PI / 2; rim.position.y = 0.02; rim.castShadow = hi; rim.receiveShadow = hi; scene.add(rim);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(R - 0.12, 0.018, 6, 96), new THREE.MeshStandardMaterial({ color: '#edc581', roughness: 0.3, metalness: 0.6 })); inlay.rotation.x = Math.PI / 2; inlay.position.y = 0.006; scene.add(inlay);
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.2, R - 0.1, 0.45, 72, 1, true), wood); apron.position.y = -0.24; scene.add(apron);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 2.2, 32), wood); ped.position.y = -1.5; scene.add(ped);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.18, 40), wood); foot.position.y = -2.52; foot.receiveShadow = hi; scene.add(foot);

  // seats
  const seats = POS.map((pos) => {
    const dir = posVec[pos]; const grp = new THREE.Group(); grp.position.copy(dir).multiplyScalar(SEAT_R); grp.lookAt(0, 0, 0); scene.add(grp);
    const chair = new THREE.Group();
    const backM = new THREE.MeshStandardMaterial({ color: '#0a1f5c', roughness: 0.8 });
    backM.side = THREE.DoubleSide;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 1.5, 28, 1, true, Math.PI / 2 + 0.25, Math.PI - 0.5), backM); back.position.set(0, 0.25, -0.05); back.castShadow = hi;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 28, Math.PI - 0.5), new THREE.MeshStandardMaterial({ color: '#4cc2ff', roughness: 0.4, emissive: '#4cc2ff', emissiveIntensity: 0.25 })); trim.rotation.set(-Math.PI / 2, 0, 0.25); trim.position.set(0, 1.0, -0.05);
    chair.add(back, trim); grp.add(chair);
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
    const portrait = cam.aspect < 1;
    cam.position.set(0, portrait ? 7.6 : 5.6, portrait ? 7.2 : 6.6);
    const target = new THREE.Vector3(0, portrait ? 0.2 : 0.9, portrait ? 0.1 : -0.6); cam.lookAt(target);
    const dist = cam.position.distanceTo(target); const needHalfW = portrait ? 4.5 : 6.2;
    const hf = 2 * Math.atan(needHalfW / dist); let vf = 2 * Math.atan(Math.tan(hf / 2) / cam.aspect) * 180 / Math.PI;
    cam.fov = Math.min(portrait ? 80 : 60, Math.max(38, vf)); cam.updateProjectionMatrix();
    for (const st of seats) if (st.dir.x) { const r = portrait ? 3.35 : SEAT_R; st.grp.position.set(st.dir.x * r, 0, 0); st.grp.lookAt(0, 0, 0); st.anchor.set(st.dir.x * r, 2.25, 0); }
  }
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
  function slotFor(seat, order, trickNo) {
    const d = posVec[POS[rel(seat)]]; const jitter = ((trickNo * 7 + seat * 13) % 10 - 5) * 0.03;
    return { p: new THREE.Vector3(d.x * 0.82, 0.02 + order * 0.006, d.z * 0.72), q: flatQFace(jitter + (d.x ? 0.1 * d.x : 0)) };
  }
  function addCard(play, order, trickNo) {
    const obj = makeCard(play.card); const r = rel(play.seat); const d = posVec[POS[r]];
    if (r === 0) { obj.position.set(0, 2.2, 5.2); obj.quaternion.setFromEuler(new THREE.Euler(-0.9, 0, 0)); }
    else { obj.position.copy(d).multiplyScalar(SEAT_R - 0.8).setY(1.0); obj.quaternion.copy(flatQFace(Math.atan2(d.x, d.z))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))); }
    scene.add(obj); const slot = slotFor(play.seat, order, trickNo);
    const entry = { obj, seat: play.seat, trickNo, state: 'flying', landAt: performance.now() + 450 };
    tween(obj, slot, 450, { arc: 0.8, done: () => { entry.state = 'landed'; } });
    cards.set(play.card.id, entry);
  }
  function collect(trickNo, winner) {
    const list = [...cards.entries()].filter(([, e]) => e.trickNo === trickNo && e.state !== 'collecting');
    const d = posVec[POS[rel(winner)]];
    list.forEach(([id, e], i) => {
      e.state = 'collecting';
      const to = { p: new THREE.Vector3(d.x * 2.6, 0.03 + i * 0.01, d.z * 2.4), q: flatQFace(Math.atan2(d.x, d.z) + Math.PI), s: 0.55 };
      tween(e.obj, to, 520, { delay: i * 40, arc: 0.3, ease: easeIO, done: () => { scene.remove(e.obj); e.obj.traverse((o) => o.material && o.material.dispose()); cards.delete(id); } });
    });
  }
  let collectTimer = null, pendingCollect = null;

  function setSeatChar(s, seatInfo, team) {
    const idx = seatInfo ? seatInfo.character ?? 0 : -1;
    if (s.pos === 'bottom') { if (s.ch) { s.grp.remove(s.ch); disposeCharacter(s.ch); s.ch = null; } s.charIdx = idx; s.chair.visible = false; return; }
    s.chair.visible = true;
    const lookKey = JSON.stringify([idx, seatInfo?.appearance || {}]);
    if (s.lookKey !== lookKey) { if (s.ch) { s.grp.remove(s.ch); disposeCharacter(s.ch); } s.ch = idx >= 0 ? buildCharacter(idx, seatInfo.appearance) : null; if (s.ch) { s.ch.position.set(0, 0.15, 0.05); s.grp.add(s.ch); } s.charIdx = idx; s.lookKey = lookKey; }
    s.trim.material.color.set(TEAM_HEX[team]); s.trim.material.emissive.set(TEAM_HEX[team]);
  }
  function setFan(s, n) {
    if (s.pos === 'bottom' || s.fanCount === n) return; s.fanCount = n; s.fan.clear();
    for (let i = 0; i < n; i++) { const c = makeCard(null); c.scale.setScalar(0.62); const a = (i - (n - 1) / 2) * 0.12; c.position.set(Math.sin(a) * 0.55, 0.5 + Math.cos(a) * 0.55 - 0.55 + 0.02 * 0, 0.95 + i * 0.004); c.rotation.set(-0.35, Math.PI, a); s.fan.add(c); }
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
    plays = plays || []; const tn = won ? won.no : g ? g.trickNo : 0; const ids = new Set(plays.map((p) => p.card.id));
    for (const [id, e] of cards) if (!ids.has(id) && e.state !== 'collecting') { if (pendingCollect && pendingCollect.no === e.trickNo) { clearTimeout(collectTimer); const pc = pendingCollect; pendingCollect = null; collect(pc.no, pc.winner); } else { scene.remove(e.obj); cards.delete(id); } }
    plays.forEach((p, i) => { if (!cards.has(p.card.id)) addCard(p, i, tn); });
    if (won && (!pendingCollect || pendingCollect.no !== won.no) && [...cards.values()].some((e) => e.trickNo === won.no && e.state !== 'collecting')) {
      const land = Math.max(...[...cards.values()].map((e) => e.landAt)); pendingCollect = { no: won.no, winner: won.winner };
      clearTimeout(collectTimer); collectTimer = setTimeout(() => { if (pendingCollect && pendingCollect.no === won.no) { const pc = pendingCollect; pendingCollect = null; collect(pc.no, pc.winner); } }, Math.max(0, land - performance.now()) + 850);
    }
  }

  // ---- loop ----
  const v = new THREE.Vector3(); let raf = 0, alive = true, last = performance.now(), frames = 0, fpsT = performance.now(), lowSkip = !hi;
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
      const on = s.pos === turnPos; s.ring.material.opacity += ((on ? 0.55 + 0.3 * Math.sin(k * 4) : 0) - s.ring.material.opacity) * Math.min(1, dt * 8);
      if (s.ch) { s.ch.position.y = 0.15 + (reducedMotion() ? 0 : Math.sin(k * 1.6 + s.dir.x * 2 + s.dir.z) * 0.015 + (on ? Math.abs(Math.sin(k * 3)) * 0.04 : 0)); animateCharacter(s.ch, k, on, reducedMotion()); }
      const el = plateEls[s.pos];
      if (el && s.pos !== 'bottom') { v.copy(s.anchor).project(cam); const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * Hh; const ew = el._w || 120, eh = el._h || 48; const cx = Math.min(W - ew / 2 - 6, Math.max(ew / 2 + 6, x)), cy = Math.min(Hh - 60, Math.max(eh + 30, y)); el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px) translate(-50%, -100%)`; }
    }
    renderer.render(scene, cam);
    frames++; if (now - fpsT > 3000) { onFps && onFps(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; }
  }
  raf = requestAnimationFrame(frame);
  return {
    update, resize,
    setPlates(map) { plateEls = map; requestAnimationFrame(() => { for (const el of Object.values(map)) { el._w = el.offsetWidth; el._h = el.offsetHeight; } }); },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(collectTimer); renderer.dispose(); canvas.remove(); },
  };
}

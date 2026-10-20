// Shared art: rook bird emblem, card faces (HTML + canvas), characters (spec + SVG portraits).
export const BIRD_PATH = 'M5 35 L22 28.5 C26 22 34 19 42 21.5 C48 23.5 51.5 28.5 53.5 34 C61 38 71 42.5 81 48 L97 56 L94.5 62.5 L77 59.5 C70.5 63.5 62 67 52.5 68 L55 85.5 L61 87.5 L61 90 L49.5 90 L48 69 C46.8 69 45.6 69 44.3 68.6 L42.2 85.5 L48 87.5 L48 90 L36.5 90 L38.8 67 C31.5 64 27 57.5 25.2 49.5 C24.3 45.5 23.5 42 22.2 39.5 Z';
export const WING_PATH = 'M37 44 C47 39.5 62 41.5 74 49.5 C80 53.5 86 56.5 92 58.5 C80 60 70.5 60.5 62 60 C51.5 59 41.5 54 37 44 Z';
export const EYE = { cx: 31.5, cy: 28.5, r: 2.4 };
export function birdSVG(fill = '#0b1e4d', eye = '#fff', wing = 'rgba(255,255,255,.18)') {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${BIRD_PATH}" fill="${fill}"/><path d="${WING_PATH}" fill="${wing}"/><circle cx="${EYE.cx}" cy="${EYE.cy}" r="${EYE.r}" fill="${eye}"/></svg>`;
}
export const SUIT = {
  R: { name: 'Red', hex: '#d42a3a', dark: '#8f1424' },
  B: { name: 'Black', hex: '#1d2330', dark: '#05070c' },
  G: { name: 'Green', hex: '#13894f', dark: '#085a31' },
  Y: { name: 'Yellow', hex: '#e8c000', dark: '#8f7600' },
};
export const cardPts = (c) => (c.id === 'ROOK' ? 20 : c.rank === 5 ? 5 : c.rank === 10 || c.rank === 14 ? 10 : 0);

export function cardHTML(c, cls = '', trump = null, style = '') {
  if (!c) return '';
  if (c.id === 'ROOK') return `<div class="card rookcard ${cls}" data-id="ROOK" style="${style}" title="The Rook — 20 pts, highest trump"><div class="rk-top">ROOK</div><div class="rk-bird">${birdSVG('#fff', '#0b2a7a', 'rgba(11,42,122,.25)')}</div><div class="rk-pts">20</div></div>`;
  const p = cardPts(c);
  const tr = trump && c.color === trump ? ' trump' : '';
  return `<div class="card face s-${c.color}${tr} ${cls}" data-id="${c.id}" title="${SUIT[c.color].name} ${c.rank}${p ? ` · ${p} pts` : ''}" style="--sc:${SUIT[c.color].hex};${style}">
<span class="idx tl">${c.rank}</span><span class="idx br">${c.rank}</span><div class="frame"><span class="num">${c.rank}</span><span class="mini">${birdSVG('currentColor', '#fff', 'transparent')}</span></div>${p ? `<span class="ptb">${p}</span>` : ''}</div>`;
}
export const backHTML = (cls = '') => `<div class="card back ${cls}"><div class="bk-in">${birdSVG('#fff', '#123a9c', 'rgba(18,58,156,.2)')}</div></div>`;

// ---------- canvas drawing (for 3D textures) ----------
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawBird(ctx, x, y, size, fill, eye, wing) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = fill; ctx.fill(new Path2D(BIRD_PATH));
  if (wing) { ctx.fillStyle = wing; ctx.fill(new Path2D(WING_PATH)); }
  ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(EYE.cx, EYE.cy, EYE.r, 0, 7); ctx.fill(); ctx.restore();
}
export const CW = 256, CH = 360;
export function drawCardFace(ctx, c) {
  ctx.clearRect(0, 0, CW, CH);
  const font = '"Rook Display","Trebuchet MS",sans-serif';
  if (c.id === 'ROOK') {
    rr(ctx, 4, 4, CW - 8, CH - 8, 22); const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, '#1f4fd1'); g.addColorStop(1, '#0a2470'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; rr(ctx, 16, 16, CW - 32, CH - 32, 14); ctx.stroke();
    drawBird(ctx, 28, 80, 200, '#fff', '#0b2a7a', 'rgba(11,42,122,.25)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `900 46px ${font}`; ctx.fillText('ROOK', CW / 2, 66);
    ctx.font = `800 30px ${font}`; ctx.fillText('20', CW / 2, CH - 34);
    return;
  }
  const s = SUIT[c.color];
  rr(ctx, 4, 4, CW - 8, CH - 8, 22); ctx.fillStyle = '#fbfcff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#c9d3e6'; ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = s.hex; rr(ctx, 40, 40, CW - 80, CH - 80, 14); ctx.stroke();
  ctx.fillStyle = s.hex; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${c.rank >= 10 ? 116 : 140}px ${font}`; ctx.fillText(String(c.rank), CW / 2, CH / 2 + 6);
  ctx.font = `800 40px ${font}`; ctx.fillText(String(c.rank), 22 + (c.rank >= 10 ? 4 : 0), 26);
  ctx.save(); ctx.translate(CW - 22 - (c.rank >= 10 ? 4 : 0), CH - 26); ctx.rotate(Math.PI); ctx.fillText(String(c.rank), 0, 0); ctx.restore();
  drawBird(ctx, CW / 2 - 18, CH - 92, 36, s.hex, '#fff');
  const p = cardPts(c);
  if (p) { ctx.fillStyle = '#0d2a6e'; ctx.beginPath(); ctx.arc(CW - 30, 30, 20, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 20px ${font}`; ctx.fillText(String(p), CW - 30, 31); }
}
export function drawCardBack(ctx) {
  ctx.clearRect(0, 0, CW, CH);
  rr(ctx, 4, 4, CW - 8, CH - 8, 22); ctx.fillStyle = '#fff'; ctx.fill();
  rr(ctx, 14, 14, CW - 28, CH - 28, 14); const g = ctx.createRadialGradient(CW / 2, CH / 2, 20, CW / 2, CH / 2, 220); g.addColorStop(0, '#2457d6'); g.addColorStop(1, '#0b2470'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
  for (let i = -CH; i < CW + CH; i += 18) { ctx.beginPath(); ctx.moveTo(i, 14); ctx.lineTo(i + CH, CH + 14); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 82, 0, 7); ctx.fill();
  ctx.strokeStyle = '#0b2470'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(CW / 2, CH / 2, 74, 0, 7); ctx.stroke();
  drawBird(ctx, CW / 2 - 60, CH / 2 - 62, 120, '#0b2470', '#fff', 'rgba(255,255,255,.2)');
}
export function drawFeltEmblem(ctx, S) {
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = S * 0.006;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.26, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.44, 0, 7); ctx.stroke();
  drawBird(ctx, S / 2 - S * 0.17, S / 2 - S * 0.18, S * 0.34, 'rgba(255,255,255,.07)', 'rgba(255,255,255,.0)');
}

// ---------- characters ----------
export const CHARACTERS = [
  { label: 'Robin', skin: '#f1c7a5', hair: '#6b4423', style: 'short', shirt: '#2563eb' },
  { label: 'Jules', skin: '#a86b49', hair: '#24170f', style: 'afro', shirt: '#0f766e' },
  { label: 'Sage', skin: '#f1c7a5', hair: '#b5482b', style: 'bun', shirt: '#e11d48' },
  { label: 'Morgan', skin: '#6f4630', hair: '#16100c', style: 'short', shirt: '#f1f5f9' },
  { label: 'Avery', skin: '#ffdcc2', hair: '#c9a46a', style: 'bob', shirt: '#8b5cf6' },
  { label: 'Kai', skin: '#c68863', hair: '#24170f', style: 'swept', shirt: '#2563eb' },
  { label: 'Rowan', skin: '#a86b49', hair: '#cfd2d6', style: 'short', shirt: '#0f766e' },
  { label: 'Quinn', skin: '#f1c7a5', hair: '#16100c', style: 'long', shirt: '#e11d48' },
  { label: 'Ellis', skin: '#6f4630', hair: '#24170f', style: 'bald', shirt: '#f1f5f9' },
  { label: 'Harper', skin: '#c68863', hair: '#b5482b', style: 'curly', shirt: '#e3ae55' },
  { label: 'Tatum', skin: '#3e2618', hair: '#16100c', style: 'long', shirt: '#8b5cf6' },
  { label: 'Ash', skin: '#c68863', hair: '#cfd2d6', style: 'bob', shirt: '#0f766e' },
  { label: 'Barbarian', model: 'barbarian', portrait: '/models/barbarian/portrait.png', skin: '#e5ad80', hair: '#f6c629', shirt: '#795039' },
  { label: 'Melissa', skin: '#f1c7a5', hair: '#e6c16a', style: 'columbus', shirt: '#8b5cf6', outfit: 'cardigan' },
];
import './style-options.js';
export const charOf = (i, appearance = {}) => globalThis.RookStyle.apply(CHARACTERS[((Number(i) || 0) % CHARACTERS.length + CHARACTERS.length) % CHARACTERS.length], appearance);
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1); };
export { shade };

export function avatarSVG(i, { ring = null, bg = true, appearance = {} } = {}) {
  const c = charOf(i, appearance); const H = c.hair, sk = c.skin;
  if (c.model) return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.label}">${bg ? '<circle cx="50" cy="50" r="48" fill="#10294f"/>' : ''}<image href="${c.portrait}" x="3" y="3" width="94" height="94"/>${ring ? `<circle cx="50" cy="50" r="47" fill="none" stroke="${ring}" stroke-width="3"/>` : ''}</svg>`;
  const id = 'cl' + Math.random().toString(36).slice(2, 8);
  let back = '', front = '', hat = '', face = '';
  switch (c.style) {
    case 'columbus':
      back = `<path d="M24 44Q18 66 29 80L37 75L63 75L71 80Q82 66 76 44Z" fill="${H}"/>`;
      front = `<path d="M26 45Q19 20 49 21Q80 19 75 45L64 34Q48 42 35 34Z" fill="${H}"/>`;
      front += Array.from({length:18},(_,i)=>{const side=i%2?1:-1, y=34+Math.floor(i/2)*4.5,x=50+side*(24+Math.sin(i)*2);return `<path d="M${x} ${y}c-5-5-7 4-2 5s7-5 2-6" fill="none" stroke="${shade(H,-.22)}" stroke-width="1.5"/>`;}).join('');
      break;
    case 'long': back = `<path d="M27 46 C25 72 30 86 38 88 L62 88 C70 86 75 72 73 46 Z" fill="${H}"/>`; front = `<path d="M29 46 C29 30 38 24 50 24 C62 24 71 30 71 46 C64 38 52 36 40 38 C35 40 31 43 29 46Z" fill="${H}"/>`; break;
    case 'bun': back = `<circle cx="50" cy="20" r="9" fill="${H}"/>`; front = `<path d="M29 46 C28 30 38 25 50 25 C62 25 72 30 71 46 C66 37 56 34 46 35 C38 36 32 40 29 46Z" fill="${H}"/>`; break;
    case 'afro': back = `<circle cx="50" cy="38" r="26" fill="${H}"/>`; front = `<path d="M30 44 C32 34 40 31 50 31 C60 31 68 34 70 44 C66 38 58 36 50 36 C42 36 34 38 30 44Z" fill="${H}"/>`; break;
    case 'curly': front = [[33, 34], [40, 28], [49, 26], [58, 28], [66, 34], [30, 42], [70, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${H}"/>`).join(''); break;
    case 'swept': front = `<path d="M29 45C26 30 40 20 55 25C65 20 73 33 71 44L65 37Q49 43 35 36Z" fill="${H}"/>`; break;
    case 'spiky': front = `<path d="M29 46 L30 30 L36 34 L39 22 L45 30 L50 19 L55 30 L61 22 L64 34 L70 30 L71 46 C64 38 36 38 29 46Z" fill="${H}"/>`; break;
    case 'bob': back = `<path d="M27 44 C26 60 28 68 34 70 L66 70 C72 68 74 60 73 44 Z" fill="${H}"/>`; front = `<path d="M29 46 C28 30 38 24 50 24 C62 24 72 30 71 46 C66 40 64 36 60 34 C52 38 40 40 29 46Z" fill="${H}"/>`; break;
    case 'bald': break;
    default: front = `<path d="M29 45 C28 31 38 25 50 25 C62 25 72 31 71 45 C68 38 62 34 54 34 C44 34 34 38 29 45Z" fill="${H}"/>`;
  }
  const hc = c.hatColor || '#334155';
  switch (c.hat) {
    case 'beanie': hat = `<path d="M28 42 C28 26 38 20 50 20 C62 20 72 26 72 42 Z" fill="${hc}"/><rect x="27" y="38" width="46" height="8" rx="4" fill="${shade(hc, -0.25)}"/><circle cx="50" cy="18" r="5" fill="#fff"/>`; break;
    case 'cap': hat = `<path d="M29 40 C29 26 38 21 50 21 C62 21 71 26 71 40 Z" fill="${hc}"/><path d="M50 38 C60 36 76 36 82 41 L70 43 C62 41 56 41 50 42Z" fill="${shade(hc, -0.25)}"/>`; break;
    case 'bowler': hat = `<ellipse cx="50" cy="35" rx="27" ry="5" fill="${hc}"/><path d="M34 35 C34 20 66 20 66 35Z" fill="${hc}"/><rect x="34" y="31" width="32" height="3" fill="#94a3b8"/>`; break;
    case 'tophat': hat = `<ellipse cx="50" cy="32" rx="26" ry="5" fill="${hc}"/><rect x="36" y="8" width="28" height="25" rx="2" fill="${hc}"/><rect x="36" y="25" width="28" height="4" fill="#e11d48"/>`; break;
    case 'headband': hat = `<rect x="29" y="35" width="42" height="6" rx="3" fill="${hc}"/>`; break;
    case 'cowboy': hat = `<path d="M18 36 C28 42 72 42 82 36 C78 44 22 44 18 36Z" fill="${shade(hc, -0.2)}"/><path d="M33 37 C32 22 40 18 50 22 C60 18 68 22 67 37 Z" fill="${hc}"/><rect x="33" y="32" width="34" height="3" fill="#1f2937"/>`; break;
  }
  const closed = (x) => `<path d="M${x-4} 50q4-4 8 0" fill="none" stroke="#302a28" stroke-width="1.5" stroke-linecap="round"/>`;
  face += [42,58].map((x,j) => {
    const brow=`<path d="M${x-4} 43q4-2 8 0" fill="none" stroke="${H}" stroke-width="1.3" stroke-linecap="round"/>`;
    if(c.expression==='happy'||(c.expression==='wink'&&j===1)) return closed(x)+brow;
    const h=c.expression==='calm'?2:3;
    return `<path d="M${x-4.6} 50q4.6-${h*2} 9.2 0q-4.6 ${h*1.7}-9.2 0" fill="#fff8ee"/><ellipse cx="${x}" cy="50" rx="2.2" ry="${h*.85}" fill="${c.eyeColor}"/><ellipse cx="${x}" cy="50" rx="1.2" ry="${h*.6}" fill="#302a28"/><circle cx="${x-.7}" cy="49" r=".6" fill="#fff"/>${brow}`;
  }).join('');
  face += `<path d="M48 56q2 1.5 4 0" fill="none" stroke="${shade(sk,-.18)}" stroke-width="1" stroke-linecap="round"/>`;
  if(c.facialHair==='beard') face += `<path d="M33 55q2 18 17 18t17-18l-7 12q-10 5-20 0Z" fill="${H}"/>`;
  if(c.expression==='grin'||c.expression==='happy') face += `<path d="M44 62q6 2 12 0q-1 7-6 7t-6-7" fill="${shade(sk,-.48)}"/><path d="M45 62.5q5 1.5 10 0l-1 2q-4 1-8 0Z" fill="#fff8ee"/>`;
  else face += `<path d="M45 63q5 ${c.expression==='calm'?1:4} 10 ${c.expression==='wink'?-1:0}" fill="none" stroke="${shade(sk,-.48)}" stroke-width="1.3" stroke-linecap="round"/>`;
  if(c.facialHair==='mustache') face += `<path d="M44 59q3-2 6 0q3-2 6 0" fill="none" stroke="${H}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (c.glasses === 'round') face += `<g stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,.15)"><circle cx="42" cy="50" r="6"/><circle cx="58" cy="50" r="6"/><path d="M48 50 L52 50"/></g>`;
  if (c.glasses === 'square') face += `<g stroke="#1e3a8a" stroke-width="2" fill="rgba(255,255,255,.15)"><rect x="35" y="45" width="13" height="10" rx="2"/><rect x="52" y="45" width="13" height="10" rx="2"/><path d="M48 50 L52 50"/></g>`;
  if (c.glasses === 'shades') face += `<g fill="#0f172a"><rect x="34" y="45" width="14" height="9" rx="3"/><rect x="52" y="45" width="14" height="9" rx="3"/><rect x="47" y="47" width="6" height="2"/></g>`;
  if (c.accessory === 'studs') face += `<circle cx="29" cy="60" r="1.4" fill="#e9cd82"/><circle cx="71" cy="60" r="1.4" fill="#e9cd82"/>`;
  if (c.accessory === 'hoops') face += `<g fill="none" stroke="#e9cd82" stroke-width="1.2"><ellipse cx="29" cy="62" rx="2" ry="3"/><ellipse cx="71" cy="62" rx="2" ry="3"/></g>`;
  const cloth=c.palette;
  let outfit = c.outfit==='crew' ? `<path d="M29 89h42" stroke="${cloth.accent}" stroke-width="4"/><path d="M29 93h42" stroke="${cloth.secondary}" stroke-width="2"/>` : '';
  if(c.outfit==='hoodie') outfit = `<path d="M41 81l-2 13m20-13 2 13" stroke="${cloth.accent}" stroke-width="1.5"/><path d="M39 101l3-5h16l3 5" fill="none" stroke="${cloth.secondary}" stroke-width="2"/>`;
  if(c.outfit==='cardigan'||c.outfit==='jacket') outfit=`<path d="M41 81h18l-3 20H44Z" fill="${cloth.accent}"/><path d="M40 80l7 11v11m13-22-7 11v11" fill="none" stroke="${cloth.secondary}" stroke-width="3"/>${c.outfit==='cardigan'?'<circle cx="54" cy="94" r="1" fill="#b99361"/><circle cx="54" cy="99" r="1" fill="#b99361"/>':''}`;
  if(c.accessory==='necklace') outfit+=`<path d="M43 80q7 15 14 0" fill="none" stroke="#d4af72" stroke-width="1.2"/><path d="M50 88l2 3-2 3-2-3Z" fill="#d4af72"/>`;
  if(c.accessory==='scarf') outfit+=`<path d="M40 78q10 5 20 0l-1 6H41Z M55 82h5l2 15h-6Z" fill="${cloth.accent}"/>`;
  const ringEl = ring ? `<circle cx="50" cy="50" r="48" fill="none" stroke="${ring}" stroke-width="4"/>` : '';
  return `<svg class="ava" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="48"/></clipPath><radialGradient id="${id}g" cx=".4" cy=".3" r=".8"><stop stop-color="#9fcee0"/><stop offset="1" stop-color="#2b6394"/></radialGradient><radialGradient id="${id}skin" cx=".35" cy=".25" r=".8"><stop stop-color="${shade(sk,.15)}"/><stop offset=".7" stop-color="${sk}"/><stop offset="1" stop-color="${shade(sk,-.17)}"/></radialGradient><linearGradient id="${id}shirt" x2=".8" y2="1"><stop stop-color="${shade(cloth.primary,.12)}"/><stop offset="1" stop-color="${shade(cloth.primary,-.12)}"/></linearGradient><linearGradient id="${id}hair" x2=".7" y2="1"><stop stop-color="${shade(H,.2)}"/><stop offset="1" stop-color="${H}"/></linearGradient></defs>
<g clip-path="url(#${id})">${bg ? `<rect width="100" height="100" fill="url(#${id}g)"/>` : ''}${back}<path d="M18 104 C18 84 30 78 50 78 C70 78 82 84 82 104Z" fill="url(#${id}shirt)"/><path d="M39 80q11 10 22 0" fill="none" stroke="${cloth.secondary}" stroke-width="4"/><rect x="45" y="68" width="10" height="12" fill="${shade(sk, -0.12)}"/>${outfit}
<ellipse cx="29" cy="52" rx="4" ry="6" fill="${shade(sk, -0.08)}"/><ellipse cx="71" cy="52" rx="4" ry="6" fill="${shade(sk, -0.08)}"/><path d="M28 47C28 18 72 18 72 47C72 65 64 75 50 75C36 75 28 65 28 47" fill="url(#${id}skin)"/>${face}${front}${hat}</g>${ringEl}<circle cx="50" cy="50" r="47" fill="none" stroke="#ffffff33" stroke-width="2"/></svg>`.replaceAll(`fill="${H}"`, `fill="url(#${id}hair)"`);
}

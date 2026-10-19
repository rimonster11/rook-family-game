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
  const font = '"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
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
  { label: 'Robin', skin: '#f1c7a5', hair: '#6b4423', style: 'short', shirt: '#2563eb', glasses: 'round' },
  { label: 'Jules', skin: '#8d5a3b', hair: '#1b1410', style: 'afro', shirt: '#10b981' },
  { label: 'Sage', skin: '#e3ae84', hair: '#b5482b', style: 'bun', shirt: '#e11d48', extra: 'earrings' },
  { label: 'Morgan', skin: '#5c3a24', hair: '#16100c', style: 'short', shirt: '#f1f5f9', hat: 'beanie', hatColor: '#3b82f6', extra: 'beard' },
  { label: 'Avery', skin: '#ffdcc2', hair: '#c9a46a', style: 'bob', shirt: '#8b5cf6', glasses: 'square' },
  { label: 'Kai', skin: '#c68863', hair: '#24170f', style: 'spiky', shirt: '#0ea5e9', hat: 'cap', hatColor: '#ef4444' },
  { label: 'Rowan', skin: '#a86b49', hair: '#cfd2d6', style: 'short', shirt: '#166534', hat: 'bowler', hatColor: '#1f2937', glasses: 'round', extra: 'mustache' },
  { label: 'Quinn', skin: '#f5d0b5', hair: '#1f2937', style: 'long', shirt: '#ec4899', hat: 'headband', hatColor: '#22d3ee' },
  { label: 'Ellis', skin: '#6f4630', hair: '#000', style: 'bald', shirt: '#64748b', glasses: 'shades', extra: 'bowtie' },
  { label: 'Harper', skin: '#edb990', hair: '#8b4513', style: 'curly', shirt: '#22c55e' },
  { label: 'Tatum', skin: '#3e2618', hair: '#111', style: 'long', shirt: '#a5b4fc', hat: 'tophat', hatColor: '#0f172a' },
  { label: 'Ash', skin: '#d9a07a', hair: '#e5e7eb', style: 'bob', shirt: '#0f766e', glasses: 'square', hat: 'cowboy', hatColor: '#7c4a2a' },
];
export const charOf = (i) => CHARACTERS[((Number(i) || 0) % CHARACTERS.length + CHARACTERS.length) % CHARACTERS.length];
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1); };
export { shade };

export function avatarSVG(i, { ring = null, bg = true } = {}) {
  const c = charOf(i); const H = c.hair, sk = c.skin;
  let back = '', front = '', hat = '', face = '';
  switch (c.style) {
    case 'long': back = `<path d="M27 46 C25 72 30 86 38 88 L62 88 C70 86 75 72 73 46 Z" fill="${H}"/>`; front = `<path d="M29 46 C29 30 38 24 50 24 C62 24 71 30 71 46 C64 38 52 36 40 38 C35 40 31 43 29 46Z" fill="${H}"/>`; break;
    case 'bun': back = `<circle cx="50" cy="20" r="9" fill="${H}"/>`; front = `<path d="M29 46 C28 30 38 25 50 25 C62 25 72 30 71 46 C66 37 56 34 46 35 C38 36 32 40 29 46Z" fill="${H}"/>`; break;
    case 'afro': back = `<circle cx="50" cy="38" r="26" fill="${H}"/>`; front = `<path d="M30 44 C32 34 40 31 50 31 C60 31 68 34 70 44 C66 38 58 36 50 36 C42 36 34 38 30 44Z" fill="${H}"/>`; break;
    case 'curly': front = [[33, 34], [40, 28], [49, 26], [58, 28], [66, 34], [30, 42], [70, 42]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${H}"/>`).join(''); break;
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
  face += `<circle cx="42" cy="50" r="2.6" fill="#1b1b22"/><circle cx="58" cy="50" r="2.6" fill="#1b1b22"/><circle cx="43" cy="49" r=".8" fill="#fff"/><circle cx="59" cy="49" r=".8" fill="#fff"/>`;
  face += `<circle cx="37" cy="57" r="3.5" fill="#ff7a8a" opacity=".35"/><circle cx="63" cy="57" r="3.5" fill="#ff7a8a" opacity=".35"/>`;
  if (c.extra === 'beard') face += `<path d="M32 52 C32 70 42 76 50 76 C58 76 68 70 68 52 C64 62 58 64 50 64 C42 64 36 62 32 52Z" fill="${H}"/>`;
  face += `<path d="M43 60 C46 64 54 64 57 60" stroke="#7a2e2e" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (c.extra === 'mustache') face += `<path d="M41 58 C45 55 49 57 50 58 C51 57 55 55 59 58 C55 61 52 59 50 59 C48 59 45 61 41 58Z" fill="${H}"/>`;
  if (c.glasses === 'round') face += `<g stroke="#1f2937" stroke-width="1.8" fill="rgba(255,255,255,.15)"><circle cx="42" cy="50" r="6"/><circle cx="58" cy="50" r="6"/><path d="M48 50 L52 50"/></g>`;
  if (c.glasses === 'square') face += `<g stroke="#1e3a8a" stroke-width="2" fill="rgba(255,255,255,.15)"><rect x="35" y="45" width="13" height="10" rx="2"/><rect x="52" y="45" width="13" height="10" rx="2"/><path d="M48 50 L52 50"/></g>`;
  if (c.glasses === 'shades') face += `<g fill="#0f172a"><rect x="34" y="45" width="14" height="9" rx="3"/><rect x="52" y="45" width="14" height="9" rx="3"/><rect x="47" y="47" width="6" height="2"/></g>`;
  if (c.extra === 'earrings') face += `<circle cx="29" cy="60" r="2.2" fill="#e5e7eb"/><circle cx="71" cy="60" r="2.2" fill="#e5e7eb"/>`;
  const bow = c.extra === 'bowtie' ? `<path d="M42 82 L50 86 L58 82 L58 90 L50 86 L42 90Z" fill="#e11d48"/>` : '';
  const ringEl = ring ? `<circle cx="50" cy="50" r="48" fill="none" stroke="${ring}" stroke-width="4"/>` : '';
  const id = 'cl' + Math.random().toString(36).slice(2, 8);
  return `<svg class="ava" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="48"/></clipPath><radialGradient id="${id}g" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#2a5bd7"/><stop offset="1" stop-color="#0a1f5c"/></radialGradient></defs>
<g clip-path="url(#${id})">${bg ? `<rect width="100" height="100" fill="url(#${id}g)"/>` : ''}${back}<path d="M18 104 C18 84 30 78 50 78 C70 78 82 84 82 104Z" fill="${c.shirt}"/><rect x="45" y="68" width="10" height="12" fill="${shade(sk, -0.12)}"/>${bow}
<ellipse cx="29" cy="52" rx="4" ry="6" fill="${shade(sk, -0.08)}"/><ellipse cx="71" cy="52" rx="4" ry="6" fill="${shade(sk, -0.08)}"/><ellipse cx="50" cy="50" rx="21" ry="23" fill="${sk}"/>${face}${front}${hat}</g>${ringEl}</svg>`;
}

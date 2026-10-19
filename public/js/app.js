/* Rook Night client */
import { cardHTML, backHTML, birdSVG, SUIT, cardPts, CHARACTERS, charOf, avatarSVG } from './art.js';
import './hand-progress.js';
import { icon, wordmark } from './ui-art.js';
const Style = globalThis.RookStyle;
let appearance = {};
try { appearance = Style.normalize(JSON.parse(localStorage.getItem('rook.appearance') || '{}')); } catch { /* Use preset if stored data is invalid. */ }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POS = ['bottom', 'left', 'top', 'right'];
const TEAM_HEX = ['#4cc2ff', '#e2e8f0'];
const NCH = CHARACTERS.length;

let playerId = localStorage.getItem('rook.playerId');
if (!playerId) { playerId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('rook.playerId', playerId); }
let charIdx = Number(localStorage.getItem('rook.char') ?? (NCH - 1));
if (!(charIdx >= 0 && charIdx < NCH)) charIdx = Math.floor(Math.random() * NCH);
if (new URLSearchParams(location.search).get('character') === 'barbarian') charIdx = NCH - 1;
let S = null, picked = new Set(), pickedTrump = null, lastTrickShownNo = 0, lastTrickUntil = 0, shownRecapHand = 0, chatSeen = 0, drawerOpen = false;
let prevHandIds = null, nestIds = new Set(), bidChoice = null, lastHandNo = 0;

// ---------- graphics mode ----------
const isWeak = () => matchMedia('(pointer:coarse)').matches || (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
let gfx = localStorage.getItem('rook.gfx') || (isWeak() ? 'low' : 'high');
if (new URLSearchParams(location.search).get('gfx')) gfx = new URLSearchParams(location.search).get('gfx');
let T3 = null, table = null, t3Promise = null, preview = null;
const load3D = () => (t3Promise ||= Promise.all([import('./three3d.js'), document.fonts.load('16px "Rook Display"')]).then(([m]) => (m.webglOK() ? (T3 = m) : null)).catch((e) => { console.warn('3D unavailable', e); return null; }));

const socket = io({ reconnection: true });
const urlCode = new URLSearchParams(location.search).get('room');
$('#nameInput').value = localStorage.getItem('rook.name') || '';
if (urlCode) $('#codeInput').value = urlCode.toUpperCase();
$('#logoBird').innerHTML = birdSVG('#fff', '#0a1f5c', 'rgba(10,31,92,.25)');
$('.wordmark').innerHTML = wordmark();
$$('[data-art]').forEach((el) => { el.innerHTML = icon(el.dataset.art); });
$$('.mini-bird').forEach((e) => (e.innerHTML = birdSVG('#fff', '#0a1f5c', 'rgba(10,31,92,.25)')));
$('#heroCards').innerHTML = [{ id: 'G14', color: 'G', rank: 14 }, { id: 'R10', color: 'R', rank: 10 }, { id: 'ROOK' }, { id: 'Y5', color: 'Y', rank: 5 }, { id: 'B1', color: 'B', rank: 13 }].map((c, i) => cardHTML(c, 'hc hc' + i)).join('');

socket.on('connect', () => {
  $('#conn').classList.add('hidden');
  const code = S?.room.code || new URLSearchParams(location.search).get('room') || localStorage.getItem('rook.room');
  if (code) socket.emit('hello', { playerId, code, character: charIdx, appearance });
});
socket.on('disconnect', () => { if (S) $('#conn').classList.remove('hidden'); });
socket.on('noRoom', () => { localStorage.removeItem('rook.room'); if (urlCode) toast('That table has closed — start a new one!'); show('home'); });
socket.on('errorMsg', (m) => toast(m));
socket.on('state', (st) => { S = st; localStorage.setItem('rook.room', st.room.code); if (!new URLSearchParams(location.search).get('room')) history.replaceState(null, '', '?room=' + st.room.code); render(); });

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2600); }
let curScreen = 'home';
function show(id) {
  curScreen = id;
  for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id);
  if (id === 'home') startPreview(); else stopPreview();
}
const getName = () => { const n = $('#nameInput').value.trim(); if (n) localStorage.setItem('rook.name', n); return n; };
const inviteLink = () => location.origin + location.pathname + '?room=' + S.room.code;
const copyInvite = () => { const link = inviteLink(); if (navigator.share && matchMedia('(pointer:coarse)').matches) return navigator.share({ title: 'Join my Rook table', text: `Join my Rook table — code ${S.room.code}`, url: link }).catch(() => {}); (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => toast('Invite link copied!'), () => prompt('Copy this link:', link)); };
const leave = () => { if (confirm('Leave this table?')) { socket.emit('leave'); localStorage.removeItem('rook.room'); history.replaceState(null, '', location.pathname); S = null; closeDrawer(); show('home'); } };

$('#createBtn').onclick = () => { const name = getName(); if (!name) { $('#nameInput').focus(); return toast('Tell us your name first 🙂'); } socket.emit('createRoom', { name, playerId, character: charIdx, appearance }); };
$('#joinBtn').onclick = () => { const name = getName(); const code = $('#codeInput').value.trim().toUpperCase(); if (!name) { $('#nameInput').focus(); return toast('Tell us your name first 🙂'); } if (code.length !== 4) return toast('Table codes are 4 characters'); socket.emit('joinRoom', { name, playerId, code, character: charIdx, appearance }); };
$('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#codeInput').value.trim().length === 4 ? $('#joinBtn') : $('#createBtn')).click(); });
$('#leaveBtn').onclick = leave; $('#drawerLeave').onclick = leave;
$('#copyLink').onclick = copyInvite; $('#drawerInvite').onclick = copyInvite;
$('#fillBotsBtn').onclick = () => socket.emit('fillBots');
$('#startBtn').onclick = () => socket.emit('start');
const closeDrawer = () => { drawerOpen = false; $('#drawer').classList.remove('open'); };
$('#chatToggle').onclick = () => { drawerOpen = !drawerOpen; $('#drawer').classList.toggle('open', drawerOpen); renderChat(); };
$('#closeDrawer').onclick = closeDrawer;
$('#scoreBtn').onclick = () => showScorecard();
$('#lobbyCharBtn').onclick = () => openCharModal();
$('#drawerCharacter').onclick = () => openCharModal();
$$('[data-chatform]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); const i = $('input', f); if (i.value.trim()) socket.emit('chat', { text: i.value }); i.value = ''; }));
$$('#gfxSeg button').forEach((b) => (b.onclick = () => { setGfx(b.dataset.gfx); }));
function setGfx(m) { gfx = m; localStorage.setItem('rook.gfx', m); if (table) { table.dispose(); table = null; } renderGfxSeg(); if (S?.game) renderGame(); }
function renderGfxSeg() { $$('#gfxSeg button').forEach((b) => b.classList.toggle('on', b.dataset.gfx === gfx)); }
renderGfxSeg();

// ---------- character select ----------
function renderCharGrid(el, onPick) {
  el.innerHTML = CHARACTERS.map((c, i) => `<button class="char-opt ${i === charIdx ? 'sel' : ''}" data-ch="${i}" aria-pressed="${i === charIdx}" aria-label="${c.label}" title="${c.label}">${avatarSVG(i, { appearance: i === charIdx ? appearance : {} })}<span>${c.label}</span></button>`).join('');
  $$('[data-ch]', el).forEach((b) => (b.onclick = () => onPick(+b.dataset.ch)));
}
function pickChar(i) {
  charIdx = ((i % NCH) + NCH) % NCH; localStorage.setItem('rook.char', charIdx);
  renderCharGrid($('#charGrid'), pickChar); $('#charLabel').textContent = charOf(charIdx).label;
  $('#preview2d').innerHTML = avatarSVG(charIdx, { appearance }); if (preview) preview.set(charIdx, appearance);
  renderAppearance($('#appearanceControls'), () => pickChar(charIdx));
}
$('#charPrev').onclick = () => pickChar(charIdx - 1); $('#charNext').onclick = () => pickChar(charIdx + 1);
pickChar(charIdx);
function startPreview() {
  if (preview || gfx === '2d') { $('#charPreview').classList.toggle('flat', !preview); return; }
  $('#charPreview').classList.add('flat');
  load3D().then((m) => { if (!m || preview || curScreen !== 'home') return; try { preview = m.createPreview($('#previewCanvas')); preview.set(charIdx, appearance); $('#charPreview').classList.remove('flat'); } catch (e) { console.warn(e); } });
}
function stopPreview() { if (preview) { preview.dispose(); preview = null; $('#charPreview').classList.add('flat'); } }
function renderAppearance(el, changed) {
  if (charOf(charIdx).model) {
    el.innerHTML = '<div class="model-look"><strong>Classic Barbarian</strong><span>Golden hair · leather armor · steel sword</span></div>';
    return;
  }
  const labels = { skin: 'Skin tone', shirt: 'Outfit', hair: 'Hair color', hat: 'Headwear', glasses: 'Eyewear' };
  const colors = { skin: ['Porcelain', 'Peach', 'Tan', 'Bronze', 'Brown', 'Deep'], shirt: ['Royal', 'Teal', 'Ruby', 'Violet', 'Ivory', 'Honey'], hair: ['Espresso', 'Chestnut', 'Blond', 'Copper', 'Silver', 'Black'] };
  el.innerHTML = Object.entries(Style.options).map(([key, values]) => `<fieldset class="style-row"><legend>${icon(key === 'shirt' ? 'shirt' : key === 'hat' ? 'hat' : key === 'glasses' ? 'glasses' : 'palette')}${labels[key]}</legend><div class="style-choices">${values.map((value, i) => `<button type="button" class="style-choice ${value.startsWith('#') ? 'swatch' : ''}" data-style="${key}" data-value="${i}" aria-label="${colors[key]?.[i] || value}" title="${colors[key]?.[i] || value}" aria-pressed="${(charOf(charIdx, appearance)[key] || 'none') === value}" ${value.startsWith('#') ? `style="--swatch:${value}"` : ''}>${value.startsWith('#') ? '<span aria-hidden="true">✓</span>' : `${avatarSVG(charIdx, { appearance: { ...appearance, [key]: i } })}<span>${value === 'none' ? 'None' : value}</span>`}</button>`).join('')}</div></fieldset>`).join('') + '<button type="button" class="btn tiny ghost" data-reset>Reset to character preset</button>';
  $$('[data-style]', el).forEach((button) => button.onclick = () => { appearance[button.dataset.style] = +button.dataset.value; saveAppearance(); renderAppearance(el, changed); changed(); });
  $('[data-reset]', el).onclick = () => { appearance = {}; saveAppearance(); renderAppearance(el, changed); changed(); };
}
function saveAppearance() {
  localStorage.setItem('rook.appearance', JSON.stringify(appearance));
  if (S) socket.emit('setCharacter', { character: charIdx, appearance });
}
renderAppearance($('#appearanceControls'), () => pickChar(charIdx));
function openCharModal() {
  openModal(`<h2>${icon('palette')} Dress up!</h2><div class="modal-avatar" id="mAvatar"></div><div class="char-grid modal-grid" id="mGrid"></div><div id="mAppearance"></div><div class="modal-btns"><button class="btn primary" id="mDone">Looking good</button></div>`, 'char');
  const refresh = () => { renderAppearance($('#mAppearance'), refresh); renderCharGrid($('#mGrid'), pick); $('#mAvatar').innerHTML = avatarSVG(charIdx, { appearance }); pickChar(charIdx); renderAppearance($('#appearanceControls'), () => pickChar(charIdx)); };
  const pick = (i) => { pickChar(i); saveAppearance(); refresh(); };
  refresh(); renderAppearance($('#mAppearance'), refresh); $('#mDone').onclick = closeModal;
}

// ---------- PWA ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('#installBtn').classList.add('hidden'); };
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// ---------- helpers ----------
const mySeat = () => (S && S.you.seat >= 0 ? S.you.seat : 0);
const relPos = (seat) => POS[(seat - mySeat() + 4) % 4];
const seatName = (seat) => (S.room.seats[seat]?.name || `Seat ${seat + 1}`);
const teamName = (t) => S.room.teams?.[t]?.name || `Team ${t + 1}`;
const ava = (seat, ring) => avatarSVG(S.room.seats[seat]?.character ?? 0, { ring, appearance: S.room.seats[seat]?.appearance });
const pill = (col) => `<span class="pill s-${col}">${SUIT[col].name}</span>`;

// ---------- render ----------
function render() {
  if (!S) return show('home');
  renderChat();
  if (!S.game) { if (table) { table.dispose(); table = null; } show('lobby'); renderLobby(); return; }
  show('game'); renderGame();
}

function renderChat() {
  if (!S) return;
  const html = S.room.chat.map((m) => m.from ? `<div class="m"><b>${esc(m.from)}</b> ${esc(m.text)}</div>` : `<div class="m sys">${esc(m.text)}</div>`).join('');
  $$('[data-chat]').forEach((el) => { el.innerHTML = html; el.scrollTop = el.scrollHeight; });
  const n = S.room.chat.filter((m) => m.from).length;
  if (drawerOpen || !S.game) chatSeen = n;
  $('#chatBadge').classList.toggle('hidden', n <= chatSeen);
}

const SETTINGS_FIELDS = [
  ['minBid', 'number', 'Minimum / opening bid', 'Player left of dealer must open at this amount.'],
  ['bidIncrement', 'number', 'Bids in multiples of', 'Players may jump to any higher multiple.'],
  ['maxBid', 'number', 'Maximum bid'],
  ['targetScore', 'number', 'Play to'],
  ['openerMustBid', 'checkbox', 'Opener must bid (no all-pass)', 'Off: opener may pass; see all-pass rule.'],
  ['allPassRule', ['dealerStuck', 'redeal'], 'If everyone passes', 'Only applies when the opener may pass.'],
  ['rookAnytime', 'checkbox', 'Rook may be played any time', 'Rook is always part of trump; if trump is led and it is your only trump you must play it.'],
  ['bidderLeads', 'checkbox', 'Winning bidder leads first trick', 'Off: player left of dealer leads.'],
  ['winRule', ['bidderMustMake', 'anyReach'], 'How to win', 'bidderMustMake: you can only win on a hand where your team took the bid and made it.'],
  ['flipNestCard', 'checkbox', 'Flip top nest card during bidding'],
  ['botDelayMs', 'number', 'Bot thinking time (ms)'],
];
function renderSettings() {
  const f = $('#settingsForm'); const s = S.room.settings; const locked = !S.you.isHost;
  if (f.contains(document.activeElement)) return;
  f.innerHTML = SETTINGS_FIELDS.map(([k, type, label, help]) => {
    let inp;
    if (Array.isArray(type)) inp = `<select name="${k}" ${locked ? 'disabled' : ''}>${type.map((o) => `<option ${s[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (type === 'checkbox') inp = `<label class="switch"><input type="checkbox" name="${k}" ${s[k] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span></span></label>`;
    else inp = `<input type="number" name="${k}" value="${s[k]}" step="${k === 'botDelayMs' ? 100 : 5}" ${locked ? 'disabled' : ''}>`;
    return `<div class="set-row ${type === 'checkbox' ? 'inline' : ''}"><div class="set-l">${label}${help ? `<div class="help">${help}</div>` : ''}</div>${inp}</div>`;
  }).join('') + (locked ? '<div class="help center">Only the host can change these.</div>' : '');
  $$('input,select', f).forEach((el) => el.addEventListener('change', () => {
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    socket.emit('settings', { [el.name]: v });
  }));
}

function renderLobby() {
  renderTeams($('#teamCards'));
  $('#lobbyCode').textContent = S.room.code;
  const host = S.you.isHost;
  $('#lobbySeats').innerHTML = [0, 1, 2, 3].map((i) => {
    const s = S.room.seats[i]; const mine = S.you.seat === i;
    const who = s ? `<div class="lava">${ava(i, TEAM_HEX[i % 2])}</div><div class="who">${esc(s.name)}${s.type === 'bot' ? '<span class="botbadge">BOT</span>' : ''}${s.isHost ? '<span class="hostbadge">HOST</span>' : ''}</div><div class="sub">${esc(charOf(s.character).label)}${s.type === 'human' && !s.connected ? ' · away' : ''}</div>`
      : `<div class="lava empty">+</div><div class="who muted">Empty chair</div><div class="sub">&nbsp;</div>`;
    let btns = '';
    if (!s || (s.type === 'bot' && !mine)) btns += `<button class="btn tiny primary" data-sit="${i}">${icon('people')}Sit here</button>`;
    if (mine) btns += `<button class="btn tiny outline" data-stand>Stand up</button>`;
    if (host && !s) btns += `<button class="btn tiny outline" data-bot="${i}">${icon('bot')}Add bot</button>`;
    if (host && s?.type === 'bot') btns += `<button class="btn tiny ghost" data-clear="${i}">Remove</button>`;
    return `<div class="lseat t${i % 2} ${mine ? 'mine' : ''}" style="--seat-order:${[0, 2, 1, 3][i]}"><div class="seatno">Seat ${i + 1}${mine ? ' · You' : ''}</div><div class="seat-team"><span class="tdot t${i % 2}"></span>${esc(teamName(i % 2))}</div>${who}<div class="btns">${btns}</div></div>`;
  }).join('');
  $$('[data-sit]').forEach((b) => (b.onclick = () => socket.emit('sit', { seat: +b.dataset.sit })));
  $$('[data-stand]').forEach((b) => (b.onclick = () => socket.emit('stand')));
  $$('[data-bot]').forEach((b) => (b.onclick = () => socket.emit('addBot', { seat: +b.dataset.bot })));
  $$('[data-clear]').forEach((b) => (b.onclick = () => socket.emit('clearSeat', { seat: +b.dataset.clear })));
  const full = S.room.seats.every(Boolean);
  $('#startBtn').classList.toggle('hidden', !host); $('#fillBotsBtn').classList.toggle('hidden', !host || full);
  $('#startBtn').disabled = !full;
  $('#lobbyHint').innerHTML = host ? (full ? 'Everyone\'s seated. Deal when ready!' : `Share code <b>${S.room.code}</b> or the invite link, or fill empty chairs with bots.`) : 'Waiting for the host to deal…' + (S.room.spectators.length ? `<br>Watching: ${S.room.spectators.map(esc).join(', ')}` : '');
  renderSettings();
}

function renderTeams(el) {
  const signature = JSON.stringify([S.room.teams, S.room.seats.map((s) => s && [s.name, s.type]), S.you.seat]);
  if (el.dataset.signature === signature) return;
  el.dataset.signature = signature;
  el.innerHTML = [0, 1].map((t) => {
    const team = S.room.teams?.[t], p = team?.proposal;
    const mine = S.you.seat >= 0 && S.you.seat % 2 === t;
    const ready = S.room.seats[t] && S.room.seats[t + 2];
    return `<section class="team-card t${t}"><div class="team-card-heading">${icon('trophy')}<strong>${esc(teamName(t))}</strong>${mine ? '<span class="you-tag">YOUR TEAM</span>' : ''}</div><div class="team-partners">${[t, t + 2].map((i) => esc(S.room.seats[i]?.name || 'Open seat')).join(' + ')}</div>${p ? `<div class="name-proposal"><span>Proposed: <b>${esc(p.name)}</b></span>${mine ? p.approvals.includes(S.you.seat) ? '<small>Waiting for your teammate</small>' : `<button class="btn tiny primary" data-approve="${esc(p.id)}">${icon('check')}Accept</button>` : '<small>Awaiting teammate approval</small>'}${mine ? `<button class="btn tiny ghost" data-reject="${esc(p.id)}">${p.approvals.includes(S.you.seat) ? 'Cancel' : 'Decline'}</button>` : ''}</div>` : ''}${mine ? `<form class="team-name-form" data-team-form><input aria-label="Propose a team name" maxlength="24" placeholder="Name your team" ${ready ? '' : 'disabled'}><button class="btn tiny outline" ${ready ? '' : 'disabled'}>Propose</button></form><small class="team-help">${ready ? 'Both teammates agree. Bots approve automatically.' : 'Your partner sits across, two seats away.'}</small>` : ''}</section>`;
  }).join('');
  $$('[data-team-form]', el).forEach((form) => form.onsubmit = (event) => { event.preventDefault(); const name = $('input', form).value.trim(); if (name) socket.emit('proposeTeamName', { name }); });
  $$('[data-approve]', el).forEach((b) => b.onclick = () => socket.emit('respondTeamName', { id: b.dataset.approve, accept: true }));
  $$('[data-reject]', el).forEach((b) => b.onclick = () => socket.emit('respondTeamName', { id: b.dataset.reject, accept: false }));
}

function renderHandTracker(g) {
  const p = globalThis.rookHandProgress(g);
  let label = 'Choose the bid. Set the pace.';
  if (p.status === 'secured') label = `${teamName(p.team)} · Bid secured`;
  else if (p.status === 'set') label = `${teamName(p.team)} · Set — cannot make ${p.amount}`;
  else if (p.status === 'chasing') label = `${teamName(p.team)} · Need ${p.needed} to make ${p.amount}`;
  const detail = p.status === 'chasing' ? `Can give up ${p.cushion} more points` : p.status === 'secured' ? `${p.points[p.team] - p.amount} above the bid` : p.status === 'set' ? 'Keep playing for the final score' : 'Captured points appear after each trick';
  $('#handTracker').innerHTML = `<div class="hand-label"><span class="eyebrow">HAND ${g.handNo}</span><span>${g.trickNo} / 9 tricks</span></div>${[0, 1].map((t) => `<div class="hand-team t${t}"><div><span>${esc(teamName(t))}${g.bid?.team === t ? ' · bidding' : ''}</span><b>${p.points[t]}<small> pts</small></b></div><div class="points-track" role="progressbar" aria-label="${esc(teamName(t))} captured points" aria-valuemin="0" aria-valuemax="120" aria-valuenow="${p.points[t]}"><span style="width:${p.points[t] / 1.2}%"></span>${g.bid?.team === t ? `<i style="left:${g.bid.amount / 1.2}%" title="Bid ${g.bid.amount}"></i>` : ''}</div></div>`).join('')}<div class="bid-tracker ${p.status}" role="status"><strong>${esc(label)}</strong><span>${esc(detail)} · ${p.remaining} unawarded</span></div><span class="nest-note">Nest awarded on last trick</span>`;
}

function statusText(g) {
  const me = S.you.seat; const t = g.turn; const mine = t === me && me >= 0;
  const who = t !== null && t !== undefined ? (mine ? 'You' : seatName(t)) : '';
  switch (g.phase) {
    case 'bidding': return [mine ? 'Your bid' : `${who} is bidding…`, mine];
    case 'nest': return [mine ? 'You won the bid — bury 5 cards and name trump' : `${who} is looking at the nest…`, mine];
    case 'playing': return [mine ? (g.trick.length ? 'Your turn — follow the led color if you can' : 'Your lead') : `${who}'s turn`, mine];
    case 'handOver': return ['Hand complete', false];
    case 'gameOver': return [`Game over — ${teamName(g.winner)} win!`, false];
  }
  return ['', false];
}

function ensureTable() {
  const area = $('#tableArea');
  const want3d = gfx !== '2d';
  if (want3d && !table && T3) {
    try { table = T3.createTable(area, { quality: gfx, onFps: (f) => { if (gfx === 'high' && f < 22) { toast('Switching to 3D Lite for smoother play'); setGfx('low'); } } }); }
    catch (e) { console.warn('3D init failed', e); gfx = '2d'; renderGfxSeg(); }
  }
  if (want3d && !T3) load3D().then((m) => { if (m && S?.game) renderGame(); else if (!m && gfx !== '2d') { gfx = '2d'; renderGfxSeg(); if (S?.game) renderGame(); } });
  area.classList.toggle('mode3d', !!table); area.classList.toggle('mode2d', !table);
}

function plateHTML(seat, g) {
  const s = S.room.seats[seat]; const me = S.you.seat;
  const chips = [];
  if (g.dealer === seat) chips.push('<span class="chip dealer" title="Dealer">D</span>');
  if (g.bid && g.bid.seat === seat) chips.push(`<span class="chip bid" title="Winning bid">${g.bid.amount}</span>`);
  let bubble = '';
  if (g.phase === 'bidding') {
    const h = [...g.bidding.history].reverse().find((x) => x.seat === seat);
    if (g.bidding.passed?.[seat]) bubble = '<span class="bubble off">Pass</span>';
    else if (h) bubble = `<span class="bubble">${h.bid}</span>`;
  }
  const away = s?.type === 'human' && !s.connected;
  return `<div class="plate t${seat % 2} ${g.turn === seat && g.phase !== 'handOver' && g.phase !== 'gameOver' ? 'turn' : ''} ${away ? 'away' : ''}">${bubble}
    <div class="pava">${ava(seat, TEAM_HEX[seat % 2])}</div><div class="pinfo"><div class="nmrow"><span class="nm">${esc(s?.name)}${seat === me ? ' (you)' : ''}</span>${s?.type === 'bot' ? '<span class="botbadge">BOT</span>' : ''}</div>
    <div class="meta">${chips.join('')}<span>${g.handCounts[seat]} cards${away ? ' · away' : ''}</span></div></div></div>`;
}

function renderGame() {
  const g = S.game; const me = S.you.seat;
  renderHandTracker(g); renderTeams($('#drawerTeams'));
  ensureTable();
  if (g.handNo !== lastHandNo) { lastHandNo = g.handNo; lastTrickShownNo = g.lastTrick?.no ?? 0; bidChoice = null; }
  $('#gameCode').textContent = S.room.code;
  $('#scoreboard').innerHTML = [0, 1].map((t) => `<div class="score t${t} ${g.scores[t] < 0 ? 'neg' : ''} ${me >= 0 && me % 2 === t ? 'mine' : ''}"><div class="n">${g.scores[t]}</div><div class="l">${esc(teamName(t))}</div></div>`).join('<div class="vs">of ' + g.settings.targetScore + '</div>');
  const plates = {};
  for (let seat = 0; seat < 4; seat++) {
    const pos = relPos(seat); const el = $('#seat-' + pos);
    const backs = !table && pos !== 'bottom' ? `<div class="backs">${'<div class="cb"></div>'.repeat(Math.min(g.handCounts[seat], 14))}</div>` : '';
    el.innerHTML = pos === 'top' ? backs + plateHTML(seat, g) : plateHTML(seat, g) + backs;
    el.style.transform = ''; plates[pos] = el;
  }
  // trick logic
  let plays = g.trick, won = null;
  if (g.phase === 'playing' || g.phase === 'handOver' || g.phase === 'gameOver') {
    if (g.lastTrick && g.lastTrick.no > lastTrickShownNo) { lastTrickShownNo = g.lastTrick.no; lastTrickUntil = Date.now() + 1900; setTimeout(() => S?.game && renderGame(), 1950); }
    if (!plays.length && g.lastTrick && Date.now() < lastTrickUntil) { plays = g.lastTrick.plays; won = g.lastTrick; }
  } else plays = [];
  const center = $('#center'); let html = '';
  if (!table) {
    if (g.phase === 'bidding') html += `<div class="nestbox"><div class="lbl">The nest</div><div class="cards">${g.nestFaceUp ? cardHTML(g.nestFaceUp, 'sm') : ''}${backHTML('sm').repeat(Math.max(0, g.nestCount - (g.nestFaceUp ? 1 : 0)))}</div></div>`;
    else html += plays.map((p) => `<div class="slot s-${relPos(p.seat)}">${cardHTML(p.card, '', g.trump)}</div>`).join('');
  }
  center.innerHTML = html;
  const banner = $('#banner');
  if (won) banner.innerHTML = `<div class="won">${esc(won.winner === me ? 'You take' : seatName(won.winner) + ' takes')} the trick${won.points ? ` · <b>${won.points}</b> pts` : ''}${won.last ? ' + nest' : ''}</div>`;
  else if (g.phase === 'nest') banner.innerHTML = `<div class="won soft">${esc(seatName(g.bid.seat))} took the nest for <b>${g.bid.amount}</b></div>`;
  else if (g.phase === 'bidding') banner.innerHTML = `<div class="won soft">${g.bidding.highBid ? `High bid <b>${g.bidding.highBid}</b> · ${esc(seatName(g.bidding.highBidder))}` : 'No bids yet'}${g.nestFaceUp ? ` · nest shows ${SUIT[g.nestFaceUp.color]?.name || 'the Rook'}${g.nestFaceUp.rank ? ' ' + g.nestFaceUp.rank : ''}` : ''}</div>`;
  else banner.innerHTML = '';
  const tb = $('#trumpBadge');
  if (g.trump) { tb.classList.remove('hidden'); tb.innerHTML = `<span class="tl">Trump</span>${pill(g.trump)}<span class="tb">Bid ${g.bid.amount} · ${esc(seatName(g.bid.seat))}</span>`; } else tb.classList.add('hidden');
  if (table) { table.setPlates(plates); table.update({ g, seats: S.room.seats, mySeat: me >= 0 ? me : 0, plays, won }); }
  const [st, mine] = statusText(g); const status = $('#status'); status.textContent = st; status.classList.toggle('me', mine); status.classList.toggle('hidden', !st);
  renderHand(g); renderAction(g); renderLog(g); renderHostTools(g);
  if ((g.phase === 'handOver' || g.phase === 'gameOver') && g.recap && shownRecapHand !== g.recap.handNo) {
    const delay = Math.max(0, lastTrickUntil - Date.now()) + 300;
    const hn = g.recap.handNo; shownRecapHand = hn;
    setTimeout(() => { if (S.game && S.game.recap?.handNo === hn) showRecap(); }, delay);
  } else if (g.phase !== 'handOver' && g.phase !== 'gameOver' && $('#modal').dataset.kind === 'recap') closeModal();
}

function layoutFan(el) {
  const cards = $$('.card', el); const n = cards.length; if (!n) return;
  const W = el.clientWidth || 360; const cw = cards[0].offsetWidth || 70;
  const step = Math.min(cw * 0.78, (W - cw - 28) / Math.max(1, n - 1));
  const spread = Math.min(3.2, 26 / n);
  cards.forEach((c, i) => {
    const o = i - (n - 1) / 2; c.style.setProperty('--x', `${o * step}px`); c.style.setProperty('--r', `${o * spread}deg`); c.style.setProperty('--y', `${Math.min(18, o * o * 0.45)}px`); c.style.zIndex = i + 1;
  });
}
window.addEventListener('resize', () => layoutFan($('#hand')));

function renderHand(g) {
  const me = S.you.seat; const el = $('#hand');
  if (me < 0) { el.innerHTML = '<div class="watching">You\'re watching. Open the menu to take over a bot\'s seat.</div>'; return; }
  const ids = g.hand.map((c) => c.id);
  if (g.phase === 'nest' && g.turn === me) { if (prevHandIds && prevHandIds.length === 9 && nestIds.size === 0) nestIds = new Set(ids.filter((i) => !prevHandIds.includes(i))); }
  else nestIds = new Set();
  if (g.phase !== 'nest') { picked = new Set(); pickedTrump = null; }
  const newIds = prevHandIds && ids.length > prevHandIds.length + 1 ? new Set(ids) : null; // freshly dealt
  prevHandIds = ids;
  const legal = new Set(g.legal); const playing = g.phase === 'playing' && g.turn === me; const nesting = g.phase === 'nest' && g.turn === me;
  el.classList.toggle('active', playing || nesting);
  el.innerHTML = g.hand.map((c, i) => {
    let cls = '';
    if (playing) cls = legal.has(c.id) ? 'legal' : 'illegal';
    if (nesting) cls = 'legal' + (picked.has(c.id) ? ' picked' : '') + (nestIds.has(c.id) ? ' fromnest' : '');
    if (newIds) cls += ' deal';
    return cardHTML(c, cls, g.trump, `--i:${i}`);
  }).join('');
  layoutFan(el);
  $$('.card', el).forEach((cEl) => cEl.addEventListener('click', () => {
    const id = cEl.dataset.id;
    if (playing && legal.has(id)) { socket.emit('play', { card: id }); cEl.classList.add('played'); el.classList.remove('active'); }
    else if (playing) toast('You must follow the led color');
    else if (nesting) { if (picked.has(id)) picked.delete(id); else if (picked.size < 5) picked.add(id); else toast('Only 5 go back in the nest'); renderHand(g); renderAction(g); }
  }));
}

function renderAction(g) {
  const me = S.you.seat; const a = $('#action'); const myTurn = g.turn === me && me >= 0;
  a.className = 'action';
  if (g.phase === 'bidding' && myTurn) {
    const vb = g.validBids; const hb = g.bidding.highBid;
    if (!vb.includes(bidChoice)) bidChoice = vb[0];
    a.classList.add('panelish');
    a.innerHTML = `<div class="bidpanel"><div class="bp-info"><div class="bp-k">High bid</div><div class="bp-v">${hb || '—'}</div><div class="bp-s">${hb ? esc(seatName(g.bidding.highBidder)) : (g.canPass ? 'No bids yet' : `You open · min ${g.settings.minBid}`)}</div></div>
      <div class="stepper"><button class="btn icon outline" id="bidDn" aria-label="Lower bid">−</button><div class="bidval" id="bidVal">${bidChoice ?? '—'}</div><button class="btn icon outline" id="bidUp" aria-label="Raise bid">+</button></div>
      <div class="bp-btns"><button class="btn primary" id="bidBtn" ${vb.length ? '' : 'disabled'}>Bid ${bidChoice ?? ''}</button><button class="btn outline" id="passBtn" ${g.canPass ? '' : 'disabled title="The opener must bid"'}>Pass</button></div></div>`;
    const step = (d) => { const i = vb.indexOf(bidChoice) + d; if (i >= 0 && i < vb.length) { bidChoice = vb[i]; $('#bidVal').textContent = bidChoice; $('#bidBtn').textContent = 'Bid ' + bidChoice; } };
    $('#bidDn').onclick = () => step(-1); $('#bidUp').onclick = () => step(1);
    $('#bidBtn').onclick = () => socket.emit('bid', { amount: bidChoice });
    $('#passBtn').onclick = () => socket.emit('pass');
  } else if (g.phase === 'nest' && myTurn) {
    const selPts = g.hand.filter((c) => picked.has(c.id)).reduce((s, c) => s + cardPts(c), 0);
    a.classList.add('panelish');
    a.innerHTML = `<div class="nestpanel"><div class="np-l"><div class="bp-k">Bury</div><div class="bp-v">${picked.size}<small>/5</small></div><div class="bp-s">${selPts ? `${selPts} pts → last trick` : 'Tap cards to bury'}</div></div>
      <div class="np-t"><div class="bp-k">Name trump</div><div class="trumps">${['R', 'B', 'G', 'Y'].map((c) => `<button class="trumpbtn s-${c} ${pickedTrump === c ? 'sel' : ''}" data-trump="${c}" aria-label="${SUIT[c].name}"><span>${SUIT[c].name}</span><em>${g.hand.filter((x) => x.color === c && !picked.has(x.id)).length}</em></button>`).join('')}</div></div>
      <button class="btn primary" id="discardBtn" ${picked.size === 5 && pickedTrump ? '' : 'disabled'}>Confirm</button></div>`;
    $$('[data-trump]', a).forEach((b) => (b.onclick = () => { pickedTrump = b.dataset.trump; renderAction(g); renderHand(g); }));
    $('#discardBtn').onclick = () => socket.emit('discard', { cards: [...picked], trump: pickedTrump });
  } else if (g.phase === 'playing' && g.bid?.seat === me && g.myDiscard?.length) {
    a.innerHTML = `<details class="buried"><summary>Your buried nest</summary><div class="cardrow">${g.myDiscard.map((c) => cardHTML(c, 'xs')).join('')}</div></details>`;
  } else if ((g.phase === 'handOver' || g.phase === 'gameOver') && $('#modal').classList.contains('hidden') && shownRecapHand === g.recap?.handNo) {
    a.innerHTML = `<button class="btn primary" id="reopen">${g.phase === 'gameOver' ? 'See final results' : 'See hand recap'}</button>`; $('#reopen').onclick = showRecap;
  } else a.innerHTML = '';
}

function renderLog(g) { const el = $('#log'); el.innerHTML = g.log.map((l) => `<div>${esc(l.replace(/Seat (\d)/g, (_, n) => seatName(n - 1)))}</div>`).join(''); el.scrollTop = el.scrollHeight; }

function renderHostTools(g) {
  const el = $('#hostTools'); let h = '';
  if (S.you.seat < 0) h += S.room.seats.map((s, i) => s?.type === 'bot' ? `<button class="btn tiny outline" data-take="${i}">Take over ${esc(s.name)} (seat ${i + 1})</button>` : '').join(' ');
  if (S.you.isHost) {
    h += S.room.seats.map((s, i) => s?.type === 'human' && !s.connected ? `<button class="btn tiny outline" data-bot="${i}">Replace ${esc(s.name)} with a bot</button>` : '').join(' ');
    h += `<div><button class="btn tiny ghost" id="toLobby">End game &amp; back to lobby</button></div>`;
  }
  el.innerHTML = h;
  $$('[data-take]', el).forEach((b) => (b.onclick = () => socket.emit('sit', { seat: +b.dataset.take })));
  $$('[data-bot]', el).forEach((b) => (b.onclick = () => socket.emit('addBot', { seat: +b.dataset.bot })));
  const tl = $('#toLobby', el); if (tl) tl.onclick = () => confirm('End this game for everyone?') && socket.emit('backToLobby');
}

// ---------- modals ----------
function openModal(html, kind) { $('#modalCard').innerHTML = html; $('#modalCard').className = 'modal-card k-' + kind; $('#modal').dataset.kind = kind; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').dataset.kind = ''; if (S?.game) renderAction(S.game); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && ['score', 'char'].includes($('#modal').dataset.kind)) closeModal(); });

function showRecap() {
  const g = S.game, r = g.recap; const bt = r.bid.team;
  const over = g.phase === 'gameOver';
  const myTeam = S.you.seat >= 0 ? S.you.seat % 2 : null;
  let html = '';
  if (over) {
    const win = myTeam === g.winner;
    html += `<div class="go-head ${win ? 'win' : ''}"><div class="trophy">${birdSVG('#fff', '#0a1f5c', 'rgba(10,31,92,.25)')}</div><div class="go-k">${myTeam === null ? 'Game over' : win ? 'Victory!' : 'Good game!'}</div><h2>${esc(teamName(g.winner))} win</h2>
      <div class="go-avas">${[g.winner, g.winner + 2].map((s) => `<div>${ava(s, TEAM_HEX[g.winner])}<span>${esc(seatName(s))}</span></div>`).join('')}</div></div>`;
    if (win) html += `<div class="confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--d:${(i * 37) % 100}%;--t:${(i % 7) * 0.25}s;--c:${['#4cc2ff', '#ffffff', '#1d4fc4', '#c7d2fe'][i % 4]}"></i>`).join('')}</div>`;
  } else html += `<div class="rc-k">Hand ${r.handNo}</div><h2>Hand recap</h2>`;
  html += `<div class="rc-bid">${esc(seatName(r.bid.seat))} bid <b>${r.bid.amount}</b> with ${pill(r.trump)} trump <span class="made ${r.made ? 'yes' : 'no'}">${r.made ? 'Made it' : 'Set'}</span></div>`;
  html += `<div class="recap-grid">${[0, 1].map((t) => `<div class="recap-team t${t}"><div class="rt-n">${esc(teamName(t))}${t === bt ? ' <span class="tag-b">bidders</span>' : ''}</div>
    <div class="rt-s">${r.points[t]} pts · ${r.tricksWon[t]} tricks</div><div class="delta ${r.delta[t] >= 0 ? 'pos' : 'neg'}">${r.delta[t] >= 0 ? '+' : ''}${r.delta[t]}</div><div class="big">${r.scores[t]}</div></div>`).join('')}</div>`;
  html += `<div class="rc-nest">Buried nest (${r.discardPoints} pts) went to ${esc(seatName(r.lastTrickSeat))} for the last trick</div><div class="cardrow">${r.discard.map((c) => cardHTML(c, 'xs')).join('')}</div>`;
  if (!over && !r.made) html += `<div class="note">Bidders lose their bid when they fall short.</div>`;
  if (over && g.settings.winRule === 'bidderMustMake') html += `<div class="note">Wins only count on a made bid.</div>`;
  const seated = S.you.seat >= 0;
  html += `<div class="modal-btns">`;
  if (!over) html += seated ? `<button class="btn primary" id="nextHandBtn">${icon('cards')}Next hand!</button>` : '<i>Waiting for players…</i>';
  else { html += `<button class="btn outline" id="scBtn">Scorecard</button>`; if (S.you.isHost) html += `<button class="btn primary" id="againBtn">${icon('cards')}Play again!</button><button class="btn outline" id="lobbyBtn">Lobby</button>`; else html += '<i>Waiting for host…</i>'; }
  html += `<button class="btn ghost" id="closeRecap">View table</button></div>`;
  openModal(html, over ? 'over' : 'recap');
  const nb = $('#nextHandBtn'); if (nb) nb.onclick = () => { socket.emit('nextHand'); closeModal(); };
  const ab = $('#againBtn'); if (ab) ab.onclick = () => { socket.emit('start'); closeModal(); };
  const lb = $('#lobbyBtn'); if (lb) lb.onclick = () => { socket.emit('backToLobby'); closeModal(); };
  const sb = $('#scBtn'); if (sb) sb.onclick = showScorecard;
  $('#closeRecap').onclick = closeModal;
}

function showScorecard() {
  if (!S?.game) return;
  const g = S.game;
  const rows = g.history.map((h) => `<tr><td>${h.handNo}</td><td>${esc(seatName(h.bid.seat))}</td><td>${h.bid.amount} ${pill(h.trump)}</td><td>${h.points[0]}–${h.points[1]}</td><td><span class="made ${h.made ? 'yes' : 'no'}">${h.made ? 'made' : 'set'}</span></td><td>${h.delta.map((d) => (d >= 0 ? '+' : '') + d).join(' / ')}</td><td><b>${h.scores[0]}–${h.scores[1]}</b></td></tr>`).join('');
  openModal(`<h2>Scorecard</h2><div class="sc-teams"><span><span class="tdot t0"></span>${esc(teamName(0))}</span><span><span class="tdot t1"></span>${esc(teamName(1))}</span><span>Play to ${g.settings.targetScore}</span></div>
    <div class="sc-wrap"><table class="sc"><thead><tr><th>#</th><th>Bidder</th><th>Bid</th><th>Pts</th><th></th><th>Δ</th><th>Score</th></tr></thead><tbody>${rows || '<tr><td colspan=7 class="muted">No hands yet</td></tr>'}</tbody></table></div>
    <div class="modal-btns"><button class="btn outline" id="closeSc">Close</button></div>`, 'score');
  $('#closeSc').onclick = () => { closeModal(); if (g.phase === 'handOver' || g.phase === 'gameOver') showRecap(); };
}
window.__rook = { get state() { return S; } };
show("home");

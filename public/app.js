/* Rook Night client */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLOR_NAMES = { R: 'Red', B: 'Black', G: 'Green', Y: 'Yellow' };
const AVATAR_COLORS = ['#e2884a', '#7fae7a', '#5f8fb4', '#c4699a', '#9a7bc4', '#d9a441', '#4fa3a0', '#c95f5f'];
const POS = ['bottom', 'left', 'top', 'right'];

let playerId = localStorage.getItem('rook.playerId');
if (!playerId) { playerId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); localStorage.setItem('rook.playerId', playerId); }
let S = null;            // latest state from server
let picked = new Set();  // nest discard selection
let pickedTrump = null;
let lastTrickShownNo = 0, lastTrickUntil = 0;
let shownRecapHand = 0;
let chatSeen = 0;
let drawerOpen = false;
let prevHandIds = null, nestIds = new Set();

const socket = io({ reconnection: true });
const urlCode = new URLSearchParams(location.search).get('room');
$('#nameInput').value = localStorage.getItem('rook.name') || '';
if (urlCode) $('#codeInput').value = urlCode.toUpperCase();

socket.on('connect', () => {
  const code = urlCode || localStorage.getItem('rook.room');
  if (code) socket.emit('hello', { playerId, code });
});
socket.on('noRoom', () => { localStorage.removeItem('rook.room'); show('home'); });
socket.on('errorMsg', (m) => toast(m));
socket.on('state', (st) => { S = st; localStorage.setItem('rook.room', st.room.code); if (!new URLSearchParams(location.search).get('room')) history.replaceState(null, '', '?room=' + st.room.code); render(); });

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2600); }
function show(id) { for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id); }
const getName = () => { const n = $('#nameInput').value.trim(); if (n) localStorage.setItem('rook.name', n); return n; };

$('#createBtn').onclick = () => { const name = getName(); if (!name) return toast('Tell us your name first 🙂'); socket.emit('createRoom', { name, playerId }); };
$('#joinBtn').onclick = () => { const name = getName(); const code = $('#codeInput').value.trim().toUpperCase(); if (!name) return toast('Tell us your name first 🙂'); if (code.length !== 4) return toast('Codes are 4 letters'); socket.emit('joinRoom', { name, playerId, code }); };
$('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });
$('#leaveBtn').onclick = () => { if (confirm('Leave this table?')) { socket.emit('leave'); localStorage.removeItem('rook.room'); history.replaceState(null, '', location.pathname); S = null; show('home'); } };
$('#copyLink').onclick = () => { const link = location.origin + location.pathname + '?room=' + S.room.code; (navigator.clipboard?.writeText(link) || Promise.reject()).then(() => toast('Invite link copied!'), () => prompt('Copy this link:', link)); };
$('#fillBotsBtn').onclick = () => socket.emit('fillBots');
$('#startBtn').onclick = () => socket.emit('start');
$('#chatToggle').onclick = () => { drawerOpen = !drawerOpen; $('#drawer').classList.toggle('open', drawerOpen); renderChat(); };
$('#closeDrawer').onclick = () => { drawerOpen = false; $('#drawer').classList.remove('open'); };
$('#scoreBtn').onclick = () => showScorecard();
$$('[data-chatform]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); const i = $('input', f); if (i.value.trim()) socket.emit('chat', { text: i.value }); i.value = ''; }));

// ---------- helpers ----------
const mySeat = () => (S && S.you.seat >= 0 ? S.you.seat : 0);
const relPos = (seat) => POS[(seat - mySeat() + 4) % 4];
const seatName = (seat) => (S.room.seats[seat]?.name || `Seat ${seat + 1}`);
const teamName = (t) => { const a = S.room.seats[t], b = S.room.seats[t + 2]; return a && b ? `${a.name} & ${b.name}` : `Team ${t + 1}`; };
function avatarColor(name) { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }
function avatar(seat) { const s = S.room.seats[seat]; const n = s?.name || '?'; return `<span class="avatar" style="background:${avatarColor(n)}">${s?.type === 'bot' ? '🤖' : esc(n[0].toUpperCase())}</span>`; }
const pts = (c) => (c.id === 'ROOK' ? 20 : c.rank === 5 ? 5 : c.rank === 10 || c.rank === 14 ? 10 : 0);
function cardHTML(c, cls = '') {
  if (!c) return '';
  const trumpCls = S?.game?.trump && (c.color === S.game.trump) ? ' trumpcard' : '';
  if (c.id === 'ROOK') return `<div class="card rook ${cls}" data-id="ROOK" title="The Rook (20 pts, highest card)"><span class="corner">R</span><span class="big">🐦</span><span class="rk">ROOK</span><span class="pts"><span>20</span></span></div>`;
  const p = pts(c);
  return `<div class="card c-${c.color}${trumpCls} ${cls}" data-id="${c.id}" title="${COLOR_NAMES[c.color]} ${c.rank}${p ? ` (${p} pts)` : ''}"><span class="corner">${c.rank}</span><span class="big">${c.rank}</span><span class="corner br">${c.rank}</span>${p ? `<span class="pts"><span>${p}</span></span>` : ''}</div>`;
}
const pill = (col) => `<span class="pill bg-${col}">${COLOR_NAMES[col]}</span>`;

// ---------- render ----------
function render() {
  if (!S) return show('home');
  renderChat();
  if (!S.game) { show('lobby'); renderLobby(); return; }
  show('game'); renderGame();
}

function renderChat() {
  if (!S) return;
  const html = S.room.chat.map((m) => m.from ? `<div class="m"><b>${esc(m.from)}:</b> ${esc(m.text)}</div>` : `<div class="m sys">${esc(m.text)}</div>`).join('');
  $$('[data-chat]').forEach((el) => { const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30; el.innerHTML = html; if (atBottom || true) el.scrollTop = el.scrollHeight; });
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
  const f = $('#settingsForm'); const s = S.room.settings; const host = S.you.isHost; const locked = !host;
  if (f.contains(document.activeElement)) return; // don't clobber while editing
  f.innerHTML = SETTINGS_FIELDS.map(([k, type, label, help]) => {
    let inp;
    if (Array.isArray(type)) inp = `<select name="${k}" ${locked ? 'disabled' : ''}>${type.map((o) => `<option ${s[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (type === 'checkbox') inp = `<input type="checkbox" name="${k}" ${s[k] ? 'checked' : ''} ${locked ? 'disabled' : ''}>`;
    else inp = `<input type="number" name="${k}" value="${s[k]}" step="${k === 'botDelayMs' ? 100 : 5}" ${locked ? 'disabled' : ''}>`;
    return `<label for="">${label}</label>${inp}${help ? `<div class="help">${help}</div>` : ''}`;
  }).join('') + (host ? '' : '<div class="help">Only the host can change these.</div>');
  $$('input,select', f).forEach((el) => el.addEventListener('change', () => {
    const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
    socket.emit('settings', { [el.name]: v });
  }));
}

function renderLobby() {
  $('#lobbyCode').textContent = S.room.code;
  const host = S.you.isHost;
  $('#lobbySeats').innerHTML = [0, 1, 2, 3].map((i) => {
    const s = S.room.seats[i]; const mine = S.you.seat === i;
    let who = s ? `${avatar(i)}<div class="who">${esc(s.name)}${s.type === 'bot' ? '<span class="botbadge">BOT</span>' : ''}${s.isHost ? ' 👑' : ''}</div>` : `<div class="avatar" style="background:#d8c7b0">+</div><div class="who" style="color:#a8927a">Empty chair</div>`;
    let btns = '';
    if (!s || (s.type === 'bot' && !mine)) btns += `<button class="btn tiny primary" data-sit="${i}">${mine ? '' : 'Sit here'}</button>`;
    if (mine) btns += `<button class="btn tiny" data-stand>Stand up</button>`;
    if (host && !s) btns += `<button class="btn tiny" data-bot="${i}">Add bot</button>`;
    if (host && s?.type === 'bot') btns += `<button class="btn tiny" data-clear="${i}">Remove bot</button>`;
    return `<div class="lseat ls${i} t${i % 2}">${who}<div class="sub">Seat ${i + 1} · Team ${(i % 2) + 1}${mine ? ' · you' : ''}</div><div class="btns">${btns}</div></div>`;
  }).join('');
  $$('[data-sit]').forEach((b) => (b.onclick = () => socket.emit('sit', { seat: +b.dataset.sit })));
  $$('[data-stand]').forEach((b) => (b.onclick = () => socket.emit('stand')));
  $$('[data-bot]').forEach((b) => (b.onclick = () => socket.emit('addBot', { seat: +b.dataset.bot })));
  $$('[data-clear]').forEach((b) => (b.onclick = () => socket.emit('clearSeat', { seat: +b.dataset.clear })));
  const full = S.room.seats.every(Boolean);
  $('#startBtn').classList.toggle('hidden', !host); $('#fillBotsBtn').classList.toggle('hidden', !host || full);
  $('#startBtn').disabled = !full;
  $('#lobbyHint').innerHTML = host ? (full ? 'Everyone\'s seated. Deal when ready!' : 'Share the code or link, or fill empty chairs with bots.') : 'Waiting for the host to deal…' + (S.room.spectators.length ? `<br>Watching: ${S.room.spectators.map(esc).join(', ')}` : '');
  renderSettings();
}

function statusText(g) {
  const me = S.you.seat; const t = g.turn; const mine = t === me && me >= 0;
  const who = t !== null && t !== undefined ? (mine ? 'You' : seatName(t)) : '';
  switch (g.phase) {
    case 'bidding': return [mine ? `Your bid! High bid: ${g.bidding.highBid || '—'}` : `${who} is bidding… (high ${g.bidding.highBid || '—'})`, mine];
    case 'nest': return [mine ? 'You won the bid! Pick 5 cards to discard and name trump' : `${who} is looking at the nest…`, mine];
    case 'playing': return [mine ? (g.trick.length ? 'Your turn - follow the led color if you can' : 'Your lead!') : `${who}'s turn`, mine];
    case 'handOver': return ['Hand over', false];
    case 'gameOver': return [`Game over - ${teamName(g.winner)} win!`, false];
  }
  return ['', false];
}

function renderGame() {
  const g = S.game; const me = S.you.seat;
  $('#gameCode').textContent = S.room.code;
  // scoreboard
  $('#scoreboard').innerHTML = [0, 1].map((t) => `<div class="score t${t} ${g.scores[t] < 0 ? 'neg' : ''}"><div class="n">${g.scores[t]}</div><div class="l">${esc(teamName(t))}${me >= 0 && me % 2 === t ? ' (you)' : ''}</div></div>`).join('');
  // seats
  for (let seat = 0; seat < 4; seat++) {
    const s = S.room.seats[seat]; const pos = relPos(seat);
    const chips = [];
    if (g.dealer === seat) chips.push('<span class="chip dealer" title="Dealer">D</span>');
    if (g.bid && g.bid.seat === seat) chips.push(`<span class="chip bid" title="Bidder">${g.bid.amount}</span>`);
    if (g.phase === 'bidding') {
      const h = [...g.bidding.history].reverse().find((x) => x.seat === seat);
      if (g.bidding.passed?.[seat]) chips.push('<span class="chip off">pass</span>');
      else if (h) chips.push(`<span class="chip bid">${h.bid}</span>`);
    }
    const meta = `${g.handCounts[seat]} cards${s?.type === 'human' && !s.connected ? ' · away' : ''}`;
    const plate = `<div class="plate t${seat % 2} ${g.turn === seat ? 'turn' : ''}">${avatar(seat)}<div><div style="display:flex;align-items:center"><span class="nm">${esc(s?.name)}${seat === me ? ' (you)' : ''}</span>${s?.type === 'bot' ? '<span class="botbadge">BOT</span>' : ''}<span class="chips">${chips.join('')}</span>${s?.type === 'human' && !s.connected ? '<span class="dc" title="Disconnected"></span>' : ''}</div><div class="meta">${meta}</div></div></div>`;
    const backs = pos !== 'bottom' ? `<div class="backs">${'<div class="cb"></div>'.repeat(Math.min(g.handCounts[seat], 14))}</div>` : '';
    $('#seat-' + pos).innerHTML = pos === 'top' ? backs + plate : plate + backs;
  }
  // center
  const center = $('#center'); let html = '';
  if (g.trump) html += `<div class="trumpbadge">Trump: ${pill(g.trump)} · Bid ${g.bid.amount} by ${esc(seatName(g.bid.seat))}</div>`;
  if (g.phase === 'bidding') {
    html += `<div class="nestbox">The nest<div class="cards">${g.nestFaceUp ? cardHTML(g.nestFaceUp) : ''}${'<div class="cbig"></div>'.repeat(g.nestCount - (g.nestFaceUp ? 1 : 0))}</div></div>`;
  } else if (g.phase === 'nest') {
    html += `<div class="nestbox">${esc(seatName(g.bid.seat))} took the nest<br>for ${g.bid.amount}</div>`;
  } else {
    let plays = g.trick, won = null;
    if (g.lastTrick && g.lastTrick.no > lastTrickShownNo) { lastTrickShownNo = g.lastTrick.no; lastTrickUntil = Date.now() + 1700; setTimeout(render, 1750); }
    if (!plays.length && g.lastTrick && Date.now() < lastTrickUntil) { plays = g.lastTrick.plays; won = g.lastTrick; }
    html += plays.map((p) => `<div class="slot s-${relPos(p.seat)}">${cardHTML(p.card)}</div>`).join('');
    if (won) html += `<div class="won">${esc(won.winner === me ? 'You take' : seatName(won.winner) + ' takes')} it${won.points ? ` · ${won.points} pts` : ''}${won.last ? ' + nest' : ''}</div>`;
  }
  center.innerHTML = html; center.classList.toggle('fading', false);
  const [st, mine] = statusText(g); const status = $('#status'); status.textContent = st; status.classList.toggle('me', mine);
  renderHand(g); renderAction(g); renderLog(g); renderHostTools(g);
  // recap / game over
  if ((g.phase === 'handOver' || g.phase === 'gameOver') && g.recap && shownRecapHand !== g.recap.handNo) {
    const delay = Math.max(0, lastTrickUntil - Date.now());
    const hn = g.recap.handNo; shownRecapHand = hn;
    setTimeout(() => { if (S.game && S.game.recap?.handNo === hn) showRecap(); }, delay);
  } else if (g.phase !== 'handOver' && g.phase !== 'gameOver' && $('#modal').dataset.kind === 'recap') closeModal();
}

function renderHand(g) {
  const me = S.you.seat; const el = $('#hand');
  if (me < 0) { el.innerHTML = '<div style="color:var(--cream);font-weight:800;padding:20px">You\'re watching. Grab a seat from a bot via the menu 💬.</div>'; return; }
  const ids = g.hand.map((c) => c.id);
  if (g.phase === 'nest' && g.turn === me) { if (prevHandIds && prevHandIds.length === 9 && nestIds.size === 0) nestIds = new Set(ids.filter((i) => !prevHandIds.includes(i))); }
  else nestIds = new Set();
  if (g.phase !== 'nest') { picked = new Set(); pickedTrump = null; }
  prevHandIds = ids;
  const legal = new Set(g.legal); const playing = g.phase === 'playing' && g.turn === me; const nesting = g.phase === 'nest' && g.turn === me;
  el.innerHTML = g.hand.map((c) => {
    let cls = '';
    if (playing) cls = legal.has(c.id) ? 'legal' : 'illegal';
    if (nesting) cls = 'legal' + (picked.has(c.id) ? ' picked' : '') + (nestIds.has(c.id) ? ' fromnest' : '');
    return cardHTML(c, cls);
  }).join('');
  $$('.card', el).forEach((cEl) => cEl.addEventListener('click', () => {
    const id = cEl.dataset.id;
    if (playing && legal.has(id)) { socket.emit('play', { card: id }); cEl.style.transform = 'translateY(-30px)'; }
    else if (playing) toast('You must follow the led color');
    else if (nesting) { if (picked.has(id)) picked.delete(id); else if (picked.size < 5) picked.add(id); else toast('Only 5 go back in the nest'); renderHand(g); renderAction(g); }
  }));
}

function renderAction(g) {
  const me = S.you.seat; const a = $('#action'); const myTurn = g.turn === me && me >= 0;
  if (g.phase === 'bidding' && myTurn) {
    const vb = g.validBids; const hb = g.bidding.highBid;
    const quick = [];
    if (vb.length) quick.push(vb[0]);
    if (hb) { for (const inc of [5, 10]) { const v = hb + inc; if (vb.includes(v) && !quick.includes(v)) quick.push(v); } }
    else if (vb.includes(vb[0] + 5)) quick.push(vb[0] + 5);
    a.innerHTML = `<span class="lbl">High bid: ${hb ? `${hb} (${esc(seatName(g.bidding.highBidder))})` : 'none yet'}</span>
      ${quick.map((v) => `<button class="btn primary" data-bid="${v}">Bid ${v}</button>`).join('')}
      <select id="bidPick">${vb.map((v) => `<option>${v}</option>`).join('')}</select><button class="btn green" id="bidPickBtn">Bid</button>
      <button class="btn" id="passBtn" ${g.canPass ? '' : 'disabled title="The opener must bid"'}>Pass</button>
      ${g.canPass ? '' : `<span class="lbl" style="font-size:12px;color:var(--muted)">You open: minimum ${g.settings.minBid}</span>`}`;
    $$('[data-bid]', a).forEach((b) => (b.onclick = () => socket.emit('bid', { amount: +b.dataset.bid })));
    $('#bidPickBtn').onclick = () => socket.emit('bid', { amount: +$('#bidPick').value });
    $('#passBtn').onclick = () => socket.emit('pass');
  } else if (g.phase === 'nest' && myTurn) {
    const selPts = g.hand.filter((c) => picked.has(c.id)).reduce((s, c) => s + pts(c), 0);
    a.innerHTML = `<span class="lbl">Discard ${picked.size}/5${selPts ? ` (${selPts} pts - winner of last trick gets them)` : ''}</span>
      <span class="lbl">Trump:</span>${['R', 'B', 'G', 'Y'].map((c) => `<button class="trumpbtn bg-${c} ${pickedTrump === c ? 'sel' : ''}" data-trump="${c}" title="${COLOR_NAMES[c]}">${COLOR_NAMES[c][0]}</button>`).join('')}
      <button class="btn primary" id="discardBtn" ${picked.size === 5 && pickedTrump ? '' : 'disabled'}>Bury 5 &amp; name ${pickedTrump ? COLOR_NAMES[pickedTrump] : 'trump'}</button>`;
    $$('[data-trump]', a).forEach((b) => (b.onclick = () => { pickedTrump = b.dataset.trump; renderAction(g); renderHand(g); }));
    $('#discardBtn').onclick = () => socket.emit('discard', { cards: [...picked], trump: pickedTrump });
  } else if (g.phase === 'playing' && g.bid?.seat === me && g.myDiscard?.length) {
    a.innerHTML = `<span class="lbl" style="font-size:13px">Your buried nest:</span><div class="cardrow">${g.myDiscard.map((c) => cardHTML(c, 'sm')).join('')}</div>`;
  } else a.innerHTML = '';
}

function renderLog(g) { const el = $('#log'); el.innerHTML = g.log.map((l) => `<div>${esc(l.replace(/Seat (\d)/g, (_, n) => seatName(n - 1)))}</div>`).join(''); el.scrollTop = el.scrollHeight; }

function renderHostTools(g) {
  const el = $('#hostTools'); let h = '';
  if (S.you.seat < 0) h += S.room.seats.map((s, i) => s?.type === 'bot' ? `<button class="btn tiny" data-take="${i}">Take over ${esc(s.name)} (seat ${i + 1})</button>` : '').join(' ');
  if (S.you.isHost) {
    h += S.room.seats.map((s, i) => s?.type === 'human' && !s.connected ? `<button class="btn tiny" data-bot="${i}">Replace ${esc(s.name)} with a bot</button>` : '').join(' ');
    h += `<div><button class="btn tiny ghost" id="toLobby">End game &amp; back to lobby</button></div>`;
  }
  el.innerHTML = h;
  $$('[data-take]', el).forEach((b) => (b.onclick = () => socket.emit('sit', { seat: +b.dataset.take })));
  $$('[data-bot]', el).forEach((b) => (b.onclick = () => socket.emit('addBot', { seat: +b.dataset.bot })));
  const tl = $('#toLobby', el); if (tl) tl.onclick = () => confirm('End this game for everyone?') && socket.emit('backToLobby');
}

// ---------- modals ----------
function openModal(html, kind) { $('#modalCard').innerHTML = html; $('#modal').dataset.kind = kind; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').dataset.kind = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal').dataset.kind === 'score') closeModal(); });

function showRecap() {
  const g = S.game, r = g.recap; const bt = r.bid.team;
  const over = g.phase === 'gameOver';
  const myTeam = S.you.seat >= 0 ? S.you.seat % 2 : null;
  let html = over ? `<div class="confetti">${myTeam === g.winner ? '🎉🏆🎉' : myTeam === null ? '🏆' : '🍪☕'}</div><h2>${esc(teamName(g.winner))} win the game!</h2>` : `<h2>Hand ${r.handNo} recap</h2>`;
  html += `<div>${esc(seatName(r.bid.seat))} bid <b>${r.bid.amount}</b> with ${pill(r.trump)} trump - <span class="made ${r.made ? 'yes' : 'no'}">${r.made ? 'Made it!' : 'Got set!'}</span></div>`;
  html += `<div class="recap-grid">${[0, 1].map((t) => `<div class="recap-team t${t}"><div style="font-weight:800">${esc(teamName(t))}${t === bt ? ' (bidders)' : ''}</div>
    <div>took <b>${r.points[t]}</b> pts · ${r.tricksWon[t]} tricks</div><div class="delta ${r.delta[t] >= 0 ? 'pos' : 'neg'}">${r.delta[t] >= 0 ? '+' : ''}${r.delta[t]}</div><div class="big">${r.scores[t]}</div></div>`).join('')}</div>`;
  html += `<div style="font-size:14px">Buried nest (${r.discardPoints} pts) went to ${esc(seatName(r.lastTrickSeat))} for winning the last trick:</div><div class="cardrow">${r.discard.map((c) => cardHTML(c, 'sm')).join('')}</div>`;
  if (!over && !r.made) html += `<div style="font-size:13px;color:var(--muted)">Bidders lose their bid when they fall short.</div>`;
  if (over && g.settings.winRule === 'bidderMustMake') html += `<div style="font-size:13px;color:var(--muted)">Wins only count on a made bid.</div>`;
  const seated = S.you.seat >= 0;
  html += `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">`;
  if (!over) html += seated ? `<button class="btn primary" id="nextHandBtn">Deal next hand</button>` : '<i>Waiting for players…</i>';
  else { html += `<button class="btn" id="scBtn">Scorecard</button>`; if (S.you.isHost) html += `<button class="btn primary" id="againBtn">Play again</button><button class="btn" id="lobbyBtn">Lobby</button>`; else html += '<i>Waiting for host…</i>'; }
  html += `<button class="btn ghost" style="color:var(--ink)" id="closeRecap">Look at table</button></div>`;
  openModal(html, 'recap');
  const nb = $('#nextHandBtn'); if (nb) nb.onclick = () => { socket.emit('nextHand'); closeModal(); };
  const ab = $('#againBtn'); if (ab) ab.onclick = () => { socket.emit('start'); closeModal(); };
  const lb = $('#lobbyBtn'); if (lb) lb.onclick = () => { socket.emit('backToLobby'); closeModal(); };
  const sb = $('#scBtn'); if (sb) sb.onclick = showScorecard;
  $('#closeRecap').onclick = () => { closeModal(); if (S.game.phase === 'handOver' || S.game.phase === 'gameOver') renderReopen(); };
}
function renderReopen() { const a = $('#action'); a.innerHTML = `<button class="btn primary" id="reopen">${S.game.phase === 'gameOver' ? 'Game over - see results' : 'See hand recap'}</button>`; $('#reopen').onclick = showRecap; }

function showScorecard() {
  if (!S?.game) return;
  const g = S.game;
  const rows = g.history.map((h) => `<tr><td>${h.handNo}</td><td>${esc(seatName(h.bid.seat))}</td><td>${h.bid.amount} ${pill(h.trump)}</td><td>${h.points[0]}–${h.points[1]}</td><td class="${h.made ? 'delta pos' : 'delta neg'}">${h.made ? 'made' : 'set'}</td><td>${h.delta.map((d) => (d >= 0 ? '+' : '') + d).join(' / ')}</td><td><b>${h.scores[0]}–${h.scores[1]}</b></td></tr>`).join('');
  openModal(`<h2>Scorecard</h2><div style="font-size:13px;margin-bottom:6px">Team 1: ${esc(teamName(0))} · Team 2: ${esc(teamName(1))} · Play to ${g.settings.targetScore}</div>
    <table class="sc"><tr><th>#</th><th>Bidder</th><th>Bid</th><th>Pts</th><th></th><th>Δ</th><th>Score</th></tr>${rows || '<tr><td colspan=7>No hands yet</td></tr>'}</table>
    <div style="text-align:center;margin-top:10px"><button class="btn" id="closeSc">Close</button></div>`, 'score');
  $('#closeSc').onclick = () => { closeModal(); if (g.phase === 'handOver' || g.phase === 'gameOver') showRecap(); };
}
})();

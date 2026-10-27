'use strict';
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const E = require('./engine');
const Bot = require('./bot');
const Style = require('../public/js/style-options');
const Teams = require('./teams');
const { proveFinish } = require('./auto-finish');
const { botLine } = require('./banter');

const PORT = Number(process.env.PORT || 3000);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const BOT_NAMES = ['Sam', 'Jordan', 'Casey', 'Taylor', 'Jamie', 'Avery', 'Quinn', 'Morgan', 'Alex', 'Charlie', 'Jesse', 'Drew', 'Robin', 'Skyler', 'Frankie', 'Kendall'];
const rooms = new Map(); // code -> room

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
const N_CHARS = Style.characterCount;
const cleanChar = (c) => { const v = Math.floor(Number(c)); return Number.isFinite(v) && v >= 0 && v < N_CHARS ? v : 0; };
const randChar = (room) => { const used = new Set(room.seats.filter(Boolean).map((s) => s.character)); const free = [...Array(N_CHARS).keys()].filter((i) => !used.has(i)); return free.length ? free[crypto.randomInt(free.length)] : crypto.randomInt(N_CHARS); };
const makeBot = (room, selected) => { const character = selected === 13 ? 13 : randChar(room); return { type: 'bot', name: character === 13 ? 'Melissa' : pickBotName(room), character }; };
const clean = (s, n = 20) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);

function pickBotName(room) {
  const used = new Set(room.seats.filter(Boolean).map((s) => s.name));
  const free = BOT_NAMES.filter((n) => !used.has(n));
  return free.length ? free[crypto.randomInt(free.length)] : 'Bot ' + crypto.randomInt(100);
}

function sanitizeSettings(input, base) {
  const s = { ...base };
  const num = (k, lo, hi) => { if (input[k] !== undefined) { const v = Math.round(Number(input[k])); if (Number.isFinite(v)) s[k] = Math.min(hi, Math.max(lo, v)); } };
  num('minBid', 5, 120); num('bidIncrement', 5, 20); num('maxBid', 5, 120); num('targetScore', 100, 2000); num('botDelayMs', 200, 3000);
  s.bidIncrement = Math.max(5, Math.round(s.bidIncrement / 5) * 5);
  s.minBid = Math.round(s.minBid / 5) * 5; s.maxBid = Math.max(s.minBid, Math.round(s.maxBid / 5) * 5);
  for (const k of ['openerMustBid', 'allowLowCard', 'bidderLeads', 'flipNestCard']) if (input[k] !== undefined) s[k] = !!input[k];
  if (['dealerStuck', 'redeal'].includes(input.allPassRule)) s.allPassRule = input.allPassRule;
  if (['bidderMustMake', 'anyReach'].includes(input.winRule)) s.winRule = input.winRule;
  s.rookAnytime = false;
  return E.settingsFor(s);
}

function seatOf(room, playerId) { return room.seats.findIndex((s) => s && s.type === 'human' && s.playerId === playerId); }

function publicRoom(room) {
  return {
    code: room.code, mode: room.settings.mode, hostId: room.hostPublic, settings: room.settings, started: !!room.game,
    teams: Teams.publicTeams(room),
    seats: room.seats.map((s) => s && { type: s.type, name: s.name, character: s.character ?? 0, appearance: s.appearance || {}, connected: s.type === 'bot' || s.connected, isHost: s.playerId === room.hostId }),
    spectators: [...room.members.values()].filter((m) => seatOf(room, m.playerId) < 0).map((m) => m.name),
    chat: room.chat.slice(-50),
  };
}

function broadcast(room) {
  const g = room.game;
  if (g?.phase === 'playing' && E.profile(g.settings).autoFinish && !g.autoFinish && !g.trick.length && g.turn === g.bid.seat && g._proofAt !== g.played.length) {
    g._proofAt = g.played.length;
    g._autoPlan = proveFinish(g);
    if (g._autoPlan) { g.autoFinish = true; g.queued.fill(null); g.log.push('Bidder lays down guaranteed winners.'); }
  }
  const pr = publicRoom(room);
  for (const m of room.members.values()) {
    if (!m.socketId) continue;
    const seat = seatOf(room, m.playerId);
    io.to(m.socketId).emit('state', {
      room: pr, you: { seat, playerId: m.playerId, name: m.name, isHost: m.playerId === room.hostId },
      game: room.game ? E.viewFor(room.game, seat >= 0 ? seat : null) : null,
    });
  }
  scheduleBots(room);
}

function scheduleBots(room) {
  const g = room.game;
  if (!g || room.botTimer) return;
  if (g.phase === 'handOver') {
    if (!room.seats.every(s => s?.type === 'bot')) return;
    room.botTimer = setTimeout(() => { room.botTimer = null; if (room.game === g && g.phase === 'handOver') { E.nextHand(g); broadcast(room); } }, 2500);
    return;
  }
  if (!['playing', 'bidding', 'nest'].includes(g.phase)) return;
  const seat = g.turn, bot = room.seats[seat]?.type === 'bot';
  const queued = g.phase === 'playing' && g.queued[seat];
  if (!bot && !queued && !g.autoFinish) return;
  const stamp = `${g.handNo}:${g.phase}:${g.turn}:${g.played.length}:${g.bidding.history.length}`;
  let delay = g.autoFinish ? 260 : queued ? 350 : g.settings.botDelayMs;
  if (g.phase === 'playing' && !g.trick.length && g.lastTrick) delay += g.autoFinish ? 700 : 900;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.game !== g) return broadcast(room);
    const current = `${g.handNo}:${g.phase}:${g.turn}:${g.played.length}:${g.bidding.history.length}`;
    if (stamp !== current) return broadcast(room);
    try {
      if (g.autoFinish && g.phase === 'playing') {
        const card = g._autoPlan.choose(g);
        if (!card) throw new Error('Missing proven continuation');
        E.applyPlay(g, seat, card);
      } else if (g.phase === 'playing' && g.queued[seat]) {
        const card = E.takeQueuedPlay(g);
        if (card) E.applyPlay(g, seat, card);
      } else if (room.seats[seat]?.type === 'bot') {
        if (Date.now() - (room.lastBanter || 0) > 12000 && Math.random() < .22) {
          const text = botLine(room.seats[seat].character, g.phase);
          if (text) { room.lastBanter = Date.now(); playerChat(room, seat, room.seats[seat].name, text); }
        }
        Bot.act(g, seat);
      }
    } catch (e) { console.error('automated play error', e); g.autoFinish = false; g._autoPlan = null; }
    broadcast(room);
  }, delay);
}
function playerChat(room, seat, from, text) {
  room.chat.push({ id: crypto.randomUUID(), seat, from, text, t: Date.now() });
  if (room.chat.length > 100) room.chat.shift();
}

function sysChat(room, text) { room.chat.push({ from: null, text, t: Date.now() }); if (room.chat.length > 100) room.chat.shift(); }

io.on('connection', (socket) => {
  let room = null, me = null;
  const fail = (msg) => socket.emit('errorMsg', msg);
  const attach = (r, playerId, name, character, appearance) => {
    room = r;
    me = r.members.get(playerId);
    if (!me) { me = { playerId, name, socketId: socket.id, character: character ?? 0 }; r.members.set(playerId, me); }
    me.socketId = socket.id; if (name) me.name = name; if (character !== undefined) me.character = character;
    if (appearance !== undefined) me.appearance = Style.normalize(appearance);
    const currentSeat = seatOf(r, playerId); if (currentSeat >= 0) r.seats[currentSeat].appearance = me.appearance || {};
    const s = seatOf(r, playerId); if (s >= 0) { r.seats[s].connected = true; r.seats[s].name = me.name; r.seats[s].character = me.character; }
    socket.join(r.code);
    broadcast(r);
  };

  socket.on('hello', ({ playerId, code, character, appearance } = {}) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (r && r.members.has(playerId)) attach(r, playerId, r.members.get(playerId).name, character === undefined ? undefined : cleanChar(character), appearance);
    else socket.emit('noRoom');
  });

  socket.on('createRoom', ({ name, playerId, character, appearance, mode = 'family4' } = {}) => {
    let settings;
    try { settings = E.settingsFor({ mode }); } catch { return fail('Unsupported game mode'); }
    name = clean(name) || 'Player'; character = cleanChar(character); playerId = clean(playerId, 64) || crypto.randomUUID();
    const code = makeCode();
    const r = { code, hostId: playerId, hostPublic: crypto.randomUUID(), settings, modeSettings: {}, seats: Array(E.profile(settings).players).fill(null), members: new Map(), chat: [], game: null, botTimer: null, created: Date.now() };
    rooms.set(code, r);
    r.seats[0] = { type: 'human', playerId, name, character, connected: true };
    sysChat(r, `${name} created the table.`);
    attach(r, playerId, name, character, appearance);
  });

  socket.on('joinRoom', ({ name, playerId, code, character, appearance } = {}) => {
    const r = rooms.get(String(code || '').toUpperCase().trim());
    if (!r) return fail('No table with that code.');
    name = clean(name) || 'Player'; playerId = clean(playerId, 64) || crypto.randomUUID(); character = cleanChar(character);
    const isNew = !r.members.has(playerId);
    if (isNew && !r.game) { const free = r.seats.findIndex((s) => !s); if (free >= 0) r.seats[free] = { type: 'human', playerId, name, character, connected: true }; }
    if (isNew) sysChat(r, `${name} joined.`);
    attach(r, playerId, name, character, appearance);
  });

  const guard = (fn) => (data = {}) => { if (!room || !me) return fail('Not in a room'); const r0 = room; try { fn(data); if (room) broadcast(room); else if (r0) broadcast(r0); } catch (e) { if (e instanceof E.RuleError) fail(e.message); else { console.error(e); fail('Server error'); } } };
  const isHost = () => me.playerId === room.hostId;
  const mySeat = () => seatOf(room, me.playerId);

  socket.on('sit', guard(({ seat }) => {
    seat = Number(seat); if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) return fail('Invalid seat');
    const cur = mySeat();
    const target = room.seats[seat];
    if (room.game && cur < 0 && target && target.type === 'bot') { // take over a bot mid-game
      room.game.queued[seat] = null;
      room.seats[seat] = { type: 'human', playerId: me.playerId, name: me.name, character: me.character ?? 0, appearance: me.appearance || {}, connected: true }; sysChat(room, `${me.name} took over seat ${seat + 1}.`); return;
    }
    if (room.game) return fail('Game in progress - seats are locked');
    if (target && target.type === 'human') return fail('Seat taken');
    if (cur >= 0) room.seats[cur] = null;
    room.seats[seat] = { type: 'human', playerId: me.playerId, name: me.name, character: me.character ?? 0, appearance: me.appearance || {}, connected: true };
  }));
  socket.on('setCharacter', guard(({ character, appearance }) => {
    me.character = cleanChar(character); me.appearance = Style.normalize(appearance);
    const c = mySeat(); if (c >= 0) Object.assign(room.seats[c], { character: me.character, appearance: me.appearance });
  }));
  socket.on('proposeTeamName', guard(({ name }) => {
    try { Teams.propose(room, mySeat(), name); } catch (e) { fail(e.message); }
  }));
  socket.on('respondTeamName', guard(({ id, accept }) => {
    try { Teams.respond(room, mySeat(), id, accept === true); } catch (e) { fail(e.message); }
  }));
  socket.on('stand', guard(() => { if (room.game) return fail('Game in progress'); const c = mySeat(); if (c >= 0) room.seats[c] = null; }));
  socket.on('addBot', guard(({ seat, character }) => {
    if (!isHost()) return fail('Only the host can add bots');
    seat = Number(seat);
    if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) return fail('Invalid seat');
    const t = room.seats[seat];
    if (t && t.type === 'human' && (!room.game || t.connected)) return fail('Seat taken');
    if (t && t.type === 'human') sysChat(room, `${t.name} was replaced by a bot.`);
    room.seats[seat] = makeBot(room, character);
    if (room.game) room.game.queued[seat] = null;
  }));
  socket.on('fillBots', guard(() => { if (!isHost()) return; for (let i = 0; i < room.seats.length; i++) if (!room.seats[i]) room.seats[i] = makeBot(room); }));
  socket.on('clearSeat', guard(({ seat }) => { if (!isHost() || room.game) return; if (room.seats[seat]?.type === 'bot') room.seats[seat] = null; }));
  socket.on('setMode', guard(({ mode }) => {
    if (!isHost()) return fail('Only the host can change modes');
    if (room.game) return fail('Return to the lobby before changing modes');
    const next = E.settingsFor({ mode });
    if (room.seats.some(s => s && s.playerId !== room.hostId)) return fail('Other players must stand and bots must be removed before changing modes');
    const count = E.profile(next).players;
    if (room.seats.slice(count).some(Boolean)) return fail('Move to an earlier seat before changing modes');
    room.modeSettings ||= {};
    room.modeSettings[room.settings.mode] = { ...room.settings };
    room.settings = E.settingsFor(room.modeSettings[mode] || next);
    room.seats = Array.from({ length: count }, (_, i) => room.seats[i] || null);
    room.teams = [];
    sysChat(room, `Mode: ${E.profile(room.settings).label}.`);
  }));
  socket.on('settings', guard((s) => { if (!isHost()) return fail('Only the host can change settings'); if (room.game && room.game.phase !== 'gameOver') return fail('Settings are locked during a game'); room.settings = sanitizeSettings(s, room.settings); }));
  socket.on('start', guard(() => {
    if (!isHost()) return fail('Only the host can start');
    if (room.game && room.game.phase !== 'gameOver') return fail('Game already in progress');
    if (room.seats.some((s) => !s)) return fail(`Fill all ${room.seats.length} seats (add bots for empty ones)`);
    room.game = E.newGame(room.settings, { dealer: crypto.randomInt(room.seats.length) });
    sysChat(room, 'Game started - good luck!');
  }));
  socket.on('bid', guard(({ amount }) => E.applyBid(room.game, mySeat(), amount)));
  socket.on('pass', guard(() => E.applyPass(room.game, mySeat())));
  socket.on('discard', guard(({ cards, trump, mode = 'high', moon = false }) => E.applyDiscard(room.game, mySeat(), cards, trump, mode, moon)));
  socket.on('queuePlay', guard(({ card }) => E.queuePlay(room.game, mySeat(), card)));
  socket.on('play', guard(({ card }) => { if (room.game?.autoFinish) return fail('Playing out guaranteed winners'); E.applyPlay(room.game, mySeat(), card); }));
  socket.on('nextHand', guard(() => { if (room.game?.phase === 'handOver' && mySeat() >= 0) E.nextHand(room.game); }));
  socket.on('backToLobby', guard(() => { if (!isHost()) return; if (room.botTimer) { clearTimeout(room.botTimer); room.botTimer = null; } room.game = null; sysChat(room, 'Back to the lobby.'); }));
  socket.on('chat', guard(({ text }) => { text = clean(text, 200); if (text && Date.now() - (me.lastChat || 0) >= 800) { me.lastChat = Date.now(); playerChat(room, mySeat(), me.name, text); } }));
  socket.on('leave', guard(() => {
    const c = mySeat();
    if (c >= 0) { if (room.game) { room.game.queued[c] = null; room.seats[c] = makeBot(room); } else room.seats[c] = null; }
    room.members.delete(me.playerId); sysChat(room, `${me.name} left.`);
    if (me.playerId === room.hostId) { const next = [...room.members.values()][0]; if (next) room.hostId = next.playerId; }
    socket.leave(room.code); const r = room; room = null; me = null; broadcast(r);
  }));

  socket.on('disconnect', () => {
    if (!room || !me) return;
    if (me.socketId === socket.id) {
      me.socketId = null;
      const s = seatOf(room, me.playerId); if (s >= 0) room.seats[s].connected = false;
      broadcast(room);
    }
  });
});

// clean up idle rooms (no connected members for 2h)
setInterval(() => {
  for (const [code, r] of rooms) {
    const anyone = [...r.members.values()].some((m) => m.socketId);
    if (!anyone) { r.idleSince = r.idleSince || Date.now(); if (Date.now() - r.idleSince > 2 * 3600e3) { if (r.botTimer) clearTimeout(r.botTimer); rooms.delete(code); } }
    else r.idleSince = null;
  }
}, 10 * 60e3).unref();

server.listen(PORT, () => console.log(`Rook server listening on http://localhost:${server.address().port}`));

'use strict';
// End-to-end smoke test against a running server: 1 human (this script) + 3 bots, play a full game.
// Usage: node test/e2e-socket.js [url]
const { io } = require('socket.io-client');
const url = process.argv[2] || 'http://localhost:3000';
const s = io(url, { transports: ['websocket'] });
let started = false, done = false, lastKey = '';
const t0 = Date.now();
s.on('errorMsg', (m) => console.log('server error:', m)); let n=0;
s.on('connect', () => s.emit('createRoom', { name: 'Tester', playerId: 'e2e-' + Date.now() }));
s.on('state', (st) => {
  if (!st.game) {
    if (!started) {
      if (st.room.seats.some((x) => !x)) { s.emit('fillBots'); s.emit('settings', { botDelayMs: 200, allowLowCard: process.env.ROOK_E2E_MODE === 'low' }); return; }
      started = true; console.log('room', st.room.code, 'seats:', st.room.seats.map((x) => x.name + (x.type === 'bot' ? '(bot)' : '')).join(', '));
      s.emit('start');
    }
    return;
  }
  const g = st.game, me = st.you.seat; if (process.env.DBG && n++ < 400) console.log(g.phase, 'turn', g.turn, 'me', me, 'trick', g.trick.length, 'hand', g.hand.length, 'hn', g.handNo);
  // privacy check: never more than own cards
  if (JSON.stringify(g).includes('"hands"')) throw new Error('leak');
  if (g.phase === 'gameOver' && !done) {
    done = true;
    console.log(`GAME OVER: Team ${g.winner + 1} wins ${g.scores.join('-')} after ${g.history.length} hands in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    s.close(); process.exit(0);
  }
  if (g.phase === 'playing' && g.autoFinish) return;
  const key = g.phase + g.turn + g.trick.length + g.handNo + g.trickNo + g.hand.length + '|' + (g.bidding.history || []).length;
  if (key === lastKey) return; 
  if (g.phase === 'handOver') { lastKey = key; return setTimeout(() => s.emit('nextHand'), 50); }
  if (g.turn !== me) return;
  lastKey = key;
  if (g.phase === 'bidding') { if (g.canPass && Math.random() < 0.6) s.emit('pass'); else s.emit('bid', { amount: g.validBids[0] }); }
  else if (g.phase === 'nest') s.emit('discard', { cards: g.hand.slice(-5).map((c) => c.id), trump: 'R', mode: process.env.ROOK_E2E_MODE === 'low' ? 'low' : 'high' });
  else if (g.phase === 'playing') s.emit('play', { card: g.legal[Math.floor(Math.random() * g.legal.length)] });
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 240000);

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');
const Teams = require('../src/teams');
const Style = require('../public/js/style-options');
const progress = require('../public/js/hand-progress');
const E = require('../src/engine');
const Bot = require('../src/bot');

const room = () => ({ seats: [0, 1, 2, 3].map((i) => ({ type: 'human', playerId: `p${i}` })) });
test('team names need both opposite players; opponents and stale approvals cannot approve', () => {
  const r = room(); Teams.propose(r, 0, 'Nest Friends');
  const id = r.teams[0].proposal.id;
  assert.equal(r.teams[0].name, 'Blue Jays');
  Teams.respond(r, 0, id, true);
  assert.equal(r.teams[0].name, 'Blue Jays');
  assert.throws(() => Teams.respond(r, 1, id, true));
  Teams.propose(r, 2, 'Rook Stars');
  assert.throws(() => Teams.respond(r, 0, id, true));
  Teams.respond(r, 0, r.teams[0].proposal.id, true);
  assert.equal(r.teams[0].name, 'Rook Stars');
  assert.equal(r.teams[0].proposal, null);
});
test('declines retain the approved name; changed partners clear old approvals', () => {
  const r = room(); Teams.propose(r, 0, 'First'); Teams.respond(r, 2, r.teams[0].proposal.id, true);
  Teams.propose(r, 2, 'Second'); Teams.respond(r, 0, r.teams[0].proposal.id, false);
  assert.equal(r.teams[0].name, 'First');
  Teams.propose(r, 0, 'Third'); const id = r.teams[0].proposal.id;
  r.seats[2] = { type: 'human', playerId: 'new-player' }; Teams.reconcile(r);
  assert.equal(r.teams[0].name, 'Blue Jays'); assert.equal(r.teams[0].proposal, null);
  assert.throws(() => Teams.respond(r, 2, id, true));
});
test('bots approve, empty partners and spectators cannot propose, names are bounded', () => {
  const r = room(); r.seats[2] = null;
  assert.throws(() => Teams.propose(r, 0, 'Solo'));
  assert.throws(() => Teams.propose(r, -1, 'Spectator'));
  r.seats[2] = { type: 'bot', name: 'Sam' };
  Teams.propose(r, 0, '<Birds>\n together');
  assert.equal(r.teams[0].name, 'Birds together');
  Teams.propose(r, 0, 'x'.repeat(50)); assert.equal(r.teams[0].name.length, 24);
});
test('appearance accepts only bounded choices and preserves preset defaults', () => {
  assert.deepEqual(Style.normalize({ skin: 2, shirt: 99, hair: '#fff', hat: -1, glasses: 1, extra: '<x>' }), { skin: 2, glasses: 1 });
  assert.deepEqual(Style.normalize(null), {});
  const base = { skin: '#abc', shirt: '#def', hat: 'cap' };
  assert.equal(Style.apply(base, { hat: 0 }).hat, 'none');
  assert.equal(Style.apply(base, {}).shirt, '#def'); assert.equal(base.hat, 'cap');
});
test('hand tracker handles bid boundary, cushion, made and set without hidden nest data', () => {
  const g = { bid: { team: 0, amount: 90 }, capturedPoints: [65, 20] };
  assert.deepEqual(progress(g), { points: [65, 20], remaining: 35, needed: 25, cushion: 10, team: 0, amount: 90, status: 'chasing' });
  assert.equal(progress({ ...g, capturedPoints: [65, 30] }).status, 'chasing');
  assert.equal(progress({ ...g, capturedPoints: [65, 35] }).status, 'set');
  assert.equal(progress({ ...g, capturedPoints: [90, 0] }).status, 'secured');
  assert.equal(progress({ bid: { team: 1, amount: 120 }, capturedPoints: [5, 0] }).status, 'set');
  assert.equal(progress({ capturedPoints: [0, 0] }).status, 'bidding');
});
test('every preset can wear every headwear/eyewear choice in both 3D and 2D', async () => {
  // Geometry can be checked without a browser or WebGL renderer.
  globalThis.RookStyle = Style;
  const { buildCharacter } = await import('../public/js/three3d.js');
  const { avatarSVG } = await import('../public/js/art.js');
  for (let i = 0; i < 12; i++) {
    for (let hat = 0; hat < Style.options.hat.length; hat++) {
      for (let glasses = 0; glasses < Style.options.glasses.length; glasses++) {
        const appearance = { hat, glasses, shirt: 4, skin: 3, hair: 1 };
        const character = buildCharacter(i, appearance);
        assert.ok(character.children.length > 0);
        character.traverse((o) => {
          if (o.isMesh) {
            o.geometry.computeBoundingSphere();
            assert.ok(Number.isFinite(o.geometry.boundingSphere.radius), 'Character geometry must remain finite');
            o.geometry.dispose();
          }
        });
        assert.match(avatarSVG(i, { appearance }), /<svg/);
      }
    }
  }
});
test('character blinking respects reduced motion', async () => {
  globalThis.RookStyle = Style;
  const { buildCharacter, animateCharacter, disposeCharacter } = await import('../public/js/characters.js');
  const character = buildCharacter(0);
  animateCharacter(character, .08);
  assert.equal(character.userData.eyes.length, 2);
  assert.ok(character.userData.eyes.every((eye) => eye.scale.y < .1));
  animateCharacter(character, .08, false, true);
  assert.ok(character.userData.eyes.every((eye) => eye.scale.y === 1));
  assert.equal(character.userData.head.rotation.y, 0);
  disposeCharacter(character);
});
test('captured points update only on completed tricks, include nest at the end, reset next hand', () => {
  const g = E.newGame({ targetScore: 2000 }, { dealer: 0 });
  let previous = [0, 0], trick = 0;
  while (g.phase !== 'handOver') {
    Bot.act(g, g.turn);
    const v = E.viewFor(g, null);
    if (v.trickNo === trick) assert.deepEqual(v.capturedPoints, previous);
    assert.equal('hands' in v, false); assert.equal('myDiscard' in v, false);
    if (v.phase !== 'handOver') assert.equal(v.recap, null);
    previous = v.capturedPoints; trick = v.trickNo;
  }
  assert.equal(previous[0] + previous[1], 120);
  assert.deepEqual(previous, g.recap.points);
  E.nextHand(g); assert.deepEqual(E.viewFor(g, null).capturedPoints, [0, 0]);
});

function event(socket, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(type, onEvent); reject(new Error(`Timed out waiting for ${type}`)); }, 4000);
    function onEvent(data) { if (predicate(data)) { clearTimeout(timer); socket.off(type, onEvent); resolve(data); } }
    socket.on(type, onEvent);
  });
}
test('live sockets: appearance sync, teammate approval, spectator rejection and reconnect', { timeout: 20000 }, async (t) => {
  const server = spawn(process.execPath, ['src/server.js'], { cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => server.kill());
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start')), 5000);
    server.once('error', (e) => { clearTimeout(timer); reject(e); });
    server.stdout.on('data', (data) => { const match = String(data).match(/http:\/\/localhost:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  const sockets = [];
  const connect = async () => { const s = io(url, { transports: ['websocket'], forceNew: true }); sockets.push(s); await event(s, 'connect'); return s; };
  t.after(() => sockets.forEach((s) => s.close()));
  let host = await connect(); let pending = event(host, 'state');
  host.emit('createRoom', { playerId: 'host', name: 'Host', character: 3, appearance: { shirt: 2, hat: 1, skin: 100 } });
  let state = await pending; const code = state.room.code;
  assert.deepEqual(state.room.seats[0].appearance, { shirt: 2, hat: 1 });
  pending = event(host, 'state', (s) => s.room.seats.every(Boolean)); host.emit('fillBots'); await pending;
  const partner = await connect(); pending = event(partner, 'state'); partner.emit('joinRoom', { code, playerId: 'partner', name: 'Partner' }); await pending;
  pending = event(partner, 'state', (s) => s.you.seat === 2); partner.emit('sit', { seat: 2 }); await pending;
  pending = event(partner, 'state', (s) => s.room.teams[0].proposal?.name === 'Nest Friends'); host.emit('proposeTeamName', { name: 'Nest Friends' }); state = await pending;
  assert.equal(state.room.teams[0].name, 'Blue Jays'); const id = state.room.teams[0].proposal.id;
  const spectator = await connect(); pending = event(spectator, 'state'); spectator.emit('joinRoom', { code, playerId: 'watcher', name: 'Watcher' }); await pending;
  pending = event(spectator, 'errorMsg'); spectator.emit('respondTeamName', { id, accept: true }); assert.match(await pending, /teammates/);
  pending = event(host, 'state', (s) => s.room.teams[0].name === 'Nest Friends'); partner.emit('respondTeamName', { id, accept: true }); await pending;
  pending = event(partner, 'state', (s) => s.room.seats[0].appearance.shirt === 4); host.emit('setCharacter', { character: 5, appearance: { shirt: 4, glasses: 3 } }); state = await pending;
  assert.equal(state.room.seats[0].character, 5);
  const studio = { style: 7, expression: 4, outfit: 3, accessory: 2, facialHair: 2, eyeColor: 3, shirt: 5, skin: 4, hair: 2 };
  pending = event(partner, 'state', (s) => s.room.seats[0].appearance.style === 7);
  host.emit('setCharacter', { character: 0, appearance: studio }); state = await pending;
  assert.deepEqual(state.room.seats[0].appearance, studio);
  host.disconnect(); host = await connect(); pending = event(host, 'state');
  host.emit('hello', { code, playerId: 'host' }); state = await pending;
  assert.deepEqual(state.room.seats[0].appearance, studio, 'All studio choices survive reconnect');
  pending = event(partner, 'state', (s) => s.room.seats[0].character === 12);
  host.emit('setCharacter', { character: 12, appearance: { shirt: 4 } }); state = await pending;
  assert.equal(state.room.seats[0].character, 12, 'Barbarian selection reaches other players');
  host.disconnect(); const reconnected = await connect(); pending = event(reconnected, 'state'); reconnected.emit('hello', { code, playerId: 'host' }); state = await pending;
  assert.equal(state.you.seat, 0); assert.equal(state.room.teams[0].name, 'Nest Friends'); assert.equal(state.room.seats[0].appearance.shirt, 4);
  assert.equal(state.room.seats[0].character, 12, 'Barbarian selection survives reconnect');
});

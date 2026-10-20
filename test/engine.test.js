'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');
const { simulateGame } = require('../src/sim');

const C = (id) => E.cardFromId(id);
const P = (seat, id) => ({ seat, card: C(id) });
const ids = (cards) => cards.map((c) => c.id).sort();

// deterministic rng
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

test('deck: 41 cards, 5-14 in four colors plus Rook, 120 points', () => {
  const d = E.makeDeck();
  assert.equal(d.length, 41);
  assert.equal(new Set(d.map((c) => c.id)).size, 41);
  for (const col of E.COLORS) {
    const ranks = d.filter((c) => c.color === col).map((c) => c.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  }
  assert.ok(d.some((c) => c.id === 'ROOK'));
  assert.ok(!d.some((c) => c.rank < 5));
  assert.equal(E.sumPoints(d), 120);
  assert.equal(E.cardPoints(C('R5')), 5);
  assert.equal(E.cardPoints(C('G10')), 10);
  assert.equal(E.cardPoints(C('Y14')), 10);
  assert.equal(E.cardPoints(C('ROOK')), 20);
  assert.equal(E.cardPoints(C('B13')), 0);
});

test('deal: 9 each, 5 in nest, top nest card face up, opener is left of dealer', () => {
  const g = E.newGame({}, { rng: seeded(1), dealer: 2 });
  assert.deepEqual(g.hands.map((h) => h.length), [9, 9, 9, 9]);
  assert.equal(g.nest.length, 5);
  assert.equal(g.nestFaceUp.id, g.nest[0].id);
  assert.equal(g.turn, 3);
  const all = [...g.hands.flat(), ...g.nest].map((c) => c.id);
  assert.equal(new Set(all).size, 41);
});

test('trick winner: highest of led color when no trump', () => {
  assert.equal(E.trickWinner([P(0, 'R9'), P(1, 'R13'), P(2, 'B14'), P(3, 'R10')], 'G'), 1);
});
test('trick winner: any trump beats led color; highest trump wins', () => {
  assert.equal(E.trickWinner([P(0, 'R14'), P(1, 'G5'), P(2, 'R13'), P(3, 'G6')], 'G'), 3);
});
test('trick winner: off-color non-trump never wins', () => {
  assert.equal(E.trickWinner([P(0, 'R5'), P(1, 'Y14'), P(2, 'B14'), P(3, 'R6')], 'G'), 3);
});
test('trick winner: Rook always highest, beats 14 of trump', () => {
  assert.equal(E.trickWinner([P(0, 'G14'), P(1, 'G13'), P(2, 'ROOK'), P(3, 'G12')], 'G'), 2);
  assert.equal(E.trickWinner([P(0, 'R14'), P(1, 'ROOK'), P(2, 'G14'), P(3, 'R5')], 'G'), 1);
});
test('trick winner: Rook led wins; trump-led semantics', () => {
  assert.equal(E.trickWinner([P(0, 'ROOK'), P(1, 'G14'), P(2, 'R14'), P(3, 'G5')], 'G'), 0);
});

test('legal: must follow led color if able', () => {
  const hand = ['R5', 'R9', 'B7', 'G14'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'R10')], 'G')), ['R5', 'R9']);
});
test('legal: void in led color may play anything', () => {
  const hand = ['B7', 'G14', 'Y5'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'R10')], 'G')), ['B7', 'G14', 'Y5']);
});
test('legal: Rook must follow suit by default', () => {
  const hand = ['R5', 'B7', 'ROOK'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'R10')], 'G')), ['R5']);
});
test('legal: with rookAnytime=false the Rook must follow like a trump card', () => {
  const hand = ['R5', 'B7', 'ROOK'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'R10')], 'G', { ...E.DEFAULT_SETTINGS, rookAnytime: false })), ['R5']);
});
test('legal: trump led and Rook is your only trump -> MUST play the Rook', () => {
  const hand = ['R5', 'B7', 'Y12', 'ROOK'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'G9')], 'G')), ['ROOK']);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'G9')], 'G', { ...E.DEFAULT_SETTINGS, rookAnytime: false })), ['ROOK']);
});
test('legal: Rook led -> trump must be followed', () => {
  const hand = ['R5', 'G7', 'G12', 'Y12'].map(C);
  assert.deepEqual(ids(E.legalPlays(hand, [P(0, 'ROOK')], 'G')), ['G12', 'G7']);
  const noTrump = ['R5', 'Y12'].map(C);
  assert.deepEqual(ids(E.legalPlays(noTrump, [P(0, 'ROOK')], 'G')), ['R5', 'Y12']);
});
test('engine rejects illegal play (renege)', () => {
  const g = E.newGame({}, { rng: seeded(3) });
  g.phase = 'playing'; g.trump = 'G'; g.turn = 1;
  g.hands[1] = ['R5', 'B7'].map(C); g.trick = [P(0, 'R10')];
  assert.throws(() => E.applyPlay(g, 1, 'B7'), E.RuleError);
});

test('bidding: opener must bid min; jumps by multiples of 5 allowed; passers cannot re-enter', () => {
  const g = E.newGame({}, { rng: seeded(5), dealer: 0 });
  assert.equal(g.turn, 1);
  assert.throws(() => E.applyPass(g, 1), /Opening bidder/);
  assert.throws(() => E.applyBid(g, 1, 65), /Minimum/);
  assert.throws(() => E.applyBid(g, 1, 72), /multiple/);
  E.applyBid(g, 1, 70);
  E.applyBid(g, 2, 90); // jump
  E.applyPass(g, 3);
  assert.throws(() => E.applyBid(g, 0, 90), /higher/);
  E.applyBid(g, 0, 95);
  E.applyPass(g, 1);
  assert.equal(g.turn, 2); // seat 3 skipped
  E.applyPass(g, 2);
  assert.equal(g.phase, 'nest');
  assert.deepEqual(g.bid, { seat: 0, amount: 95, team: 0 });
  assert.equal(g.hands[0].length, 14);
  assert.equal(g.nestFaceUp, null);
});
test('bidding: if everyone else passes the opener is stuck at the minimum', () => {
  const g = E.newGame({}, { rng: seeded(6), dealer: 3 });
  E.applyBid(g, 0, 70); E.applyPass(g, 1); E.applyPass(g, 2); E.applyPass(g, 3);
  assert.deepEqual(g.bid, { seat: 0, amount: 70, team: 0 });
});
test('bidding: min bid is a setting', () => {
  const g = E.newGame({ minBid: 80 }, { rng: seeded(6) });
  assert.equal(E.validBids(g)[0], 80);
  assert.throws(() => E.applyBid(g, 1, 75));
});
test('nest: discard 5 (counters and Rook allowed), name trump, bidder leads', () => {
  const g = E.newGame({}, { rng: seeded(7), dealer: 0 });
  E.applyBid(g, 1, 70); E.applyPass(g, 2); E.applyPass(g, 3); E.applyPass(g, 0);
  const h = g.hands[1];
  const disc = h.slice(0, 5).map((c) => c.id);
  assert.throws(() => E.applyDiscard(g, 1, disc.slice(0, 4), 'R'));
  E.applyDiscard(g, 1, disc, 'Y');
  assert.equal(g.hands[1].length, 9);
  assert.equal(g.trump, 'Y');
  assert.equal(g.turn, 1);
});

test('scoring: made bid scores points taken; defenders score theirs', () => {
  const r = E.computeHandScore({ seat: 0, amount: 80, team: 0 }, [85, 35]);
  assert.deepEqual(r.delta, [85, 35]); assert.equal(r.made, true);
});
test('scoring: exactly making bid counts as made', () => {
  assert.equal(E.computeHandScore({ seat: 1, amount: 75, team: 1 }, [45, 75]).made, true);
});
test('scoring: set bid loses bid amount and scores nothing; can go negative', () => {
  const r = E.computeHandScore({ seat: 1, amount: 90, team: 1 }, [35, 85]);
  assert.deepEqual(r.delta, [35, -90]); assert.equal(r.made, false);
});
test('win rule: only a bidding team that makes its bid can win', () => {
  const s = E.DEFAULT_SETTINGS;
  // defenders reach 510 -> no winner
  assert.equal(E.decideWinner([510, 300], { team: 1, amount: 70 }, true, s), null);
  assert.equal(E.decideWinner([510, 300], { team: 1, amount: 70 }, false, s), null);
  // bidders make it to 500+
  assert.equal(E.decideWinner([520, 300], { team: 0, amount: 70 }, true, s), 0);
  // bidders over 500 but set -> no
  assert.equal(E.decideWinner([520, 300], { team: 0, amount: 70 }, false, s), null);
  // anyReach option
  assert.equal(E.decideWinner([510, 300], { team: 1 }, true, { ...s, winRule: 'anyReach' }), 0);
  assert.equal(E.decideWinner([510, 505], { team: 1 }, true, { ...s, winRule: 'anyReach' }), 1);
});

function playScripted(g, discardIds, trump) {
  // finish a hand by always playing the first legal card
  E.applyDiscard(g, g.turn, discardIds, trump);
  while (g.phase === 'playing') {
    const legal = E.legalPlays(g.hands[g.turn], g.trick, g.trump, g.settings);
    E.applyPlay(g, g.turn, legal[0].id);
  }
}
test('last trick winner gets the bidder\'s discard (counters count); full hand totals 120', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = E.newGame({}, { rng: seeded(seed), dealer: 0 });
    E.applyBid(g, 1, 70); E.applyPass(g, 2); E.applyPass(g, 3); E.applyPass(g, 0);
    const disc = g.hands[1].slice().sort((a, b) => E.cardPoints(b) - E.cardPoints(a)).slice(0, 5);
    const discPts = E.sumPoints(disc);
    playScripted(g, disc.map((c) => c.id), 'R');
    const r = g.recap;
    assert.equal(r.points[0] + r.points[1], 120);
    const lastTeam = E.teamOf(r.lastTrickSeat);
    const discIds = disc.map((c) => c.id);
    assert.ok(discIds.every((id) => g.taken[lastTeam].some((c) => c.id === id)));
    assert.equal(r.discardPoints, discPts);
    assert.ok(g.lastTrick.points >= discPts);
    const expectBid = r.points[1] >= 70 ? r.points[1] : -70;
    assert.equal(r.delta[1], expectBid);
    assert.equal(r.delta[0], r.points[0]);
  }
});

test('view hides other hands and nest', () => {
  const g = E.newGame({}, { rng: seeded(9) });
  const v = E.viewFor(g, 0);
  assert.equal(v.hand.length, 9);
  assert.ok(!('hands' in v)); assert.ok(!('nest' in v));
  assert.ok(v.nestFaceUp);
  const json = JSON.stringify(v);
  for (const c of g.hands[1]) assert.ok(!json.includes(`"${c.id}"`) || g.nestFaceUp.id === c.id);
});

test('simulation: 4 bots play full games to completion', () => {
  for (let i = 0; i < 25; i++) {
    const g = simulateGame({}, seeded(100 + i));
    assert.equal(g.phase, 'gameOver');
    const last = g.history[g.history.length - 1];
    assert.equal(last.bid.team, g.winner);
    assert.ok(last.made);
    assert.ok(g.scores[g.winner] >= 500);
    for (const h of g.history) assert.equal(h.points[0] + h.points[1], 120);
  }
});

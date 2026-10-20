'use strict';
const E = require('./engine');
const keyOf = (hands, trick, turn) => `${turn}|${hands.map(h => h.map(c => c.id).sort().join(',')).join('/')}|${trick.map(p => `${p.seat}:${p.card.id}`).join(',')}`;

// Existential bidder choices, universal choices for ALL other seats, including partner.
// A resource limit means "not proven", never permission to claim the hand.
function proveFinish(game, { maxNodes = 25000, maxMs = 35 } = {}) {
  if (game.phase !== 'playing' || game.trick.length || game.turn !== game.bid?.seat) return null;
  const bidder = game.bid.seat, trump = game.trump, mode = game.playMode;
  if (!game.hands[bidder].length) return null;
  const beatsAll = card => game.hands.every((hand, seat) => seat === bidder ||
    hand.every(other =>
      E.trickWinner([{seat: bidder, card}, {seat, card: other}], trump, mode) === bidder));
  if (game.hands[bidder].every(beatsAll)) return { choose: g => E.legalPlays(g.hands[g.turn], g.trick, g.trump)[0].id };
  const policy = new Map(), memo = new Map(), deadline = Date.now() + maxMs;
  let nodes = 0;
  const exhausted = {};
  function solve(hands, trick, turn) {
    if (++nodes > maxNodes || Date.now() > deadline) throw exhausted;
    if (!hands.some(h => h.length)) return true;
    const key = keyOf(hands, trick, turn);
    if (memo.has(key)) return memo.get(key);
    const legal = E.legalPlays(hands[turn], trick, trump);
    let won = turn !== bidder;
    for (const card of legal) {
      const next = hands.slice(); next[turn] = hands[turn].filter(c => c.id !== card.id);
      const plays = [...trick, {seat: turn, card}];
      let success;
      if (plays.length === 4) success = E.trickWinner(plays, trump, mode) === bidder && solve(next, [], bidder);
      else success = solve(next, plays, E.nextSeat(turn));
      if (turn === bidder && success) { policy.set(key, card.id); won = true; break; }
      if (turn !== bidder && !success) { won = false; break; }
    }
    memo.set(key, won); return won;
  }
  try { if (!solve(game.hands, [], bidder)) return null; } catch (e) { if (e === exhausted) return null; throw e; }
  return { choose(g) {
    return g.turn === bidder ? policy.get(keyOf(g.hands, g.trick, g.turn)) : E.legalPlays(g.hands[g.turn], g.trick, g.trump)[0].id;
  } };
}
module.exports = { proveFinish };

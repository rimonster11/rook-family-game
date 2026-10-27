'use strict';
// Simple heuristic Rook bots. Only uses information a real player would have:
// own hand, the current trick, cards already played, bid/trump.
const E = require('./engine');

function bestTrump(hand) {
  let best = 'R', bestScore = -1;
  for (const c of E.COLORS) {
    const cs = hand.filter((x) => x.color === c);
    const score = cs.length * 10 + cs.reduce((s, x) => s + x.rank, 0);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function estimateHand(hand) {
  const trump = bestTrump(hand);
  const trumps = hand.filter((c) => c.color === trump);
  let est = 45 + trumps.length * 6;
  for (const c of hand) {
    if (c.id === E.ROOK_ID) est += 15;
    else if (c.rank === 14) est += 6;
    else if (c.rank === 13) est += 3;
  }
  return Math.min(120, est);
}

function chooseBid(game, seat) {
  const valid = E.validBids(game);
  const canPass = E.canPass(game, seat);
  if (!valid.length) return { pass: true };
  const est = estimateHand(game.hands[seat]);
  const b = game.bidding;
  // don't outbid partner unless clearly stronger
  const partnerHigh = b.highBidder !== null && E.teamOf(b.highBidder) === E.teamOf(seat);
  const limit = partnerHigh ? est - 15 : est;
  if (valid[0] <= limit || !canPass) return { bid: valid[0] };
  return { pass: true };
}

function chooseDiscard(game, seat) {
  const hand = game.hands[seat];
  const trump = bestTrump(hand);
  const counts = {};
  for (const c of E.COLORS) counts[c] = hand.filter((x) => x.color === c).length;
  const keepScore = (c) => {
    if (c.id === E.ROOK_ID) return 1000;
    if (c.color === trump) return 500 + c.rank;
    let s = c.rank * 2 + counts[c.color] * 3;
    if (c.rank === 14) s += 40;
    if (E.cardPoints(c) > 0 && c.rank !== 14) s -= 8; // weak counters are liabilities; they'll still score if we win last trick
    return s;
  };
  const sorted = hand.slice().sort((a, b) => keepScore(a) - keepScore(b));
  return { cards: sorted.slice(0, game.nestSize).map((c) => c.id), trump };
}

function isBoss(card, game) {
  // highest unplayed card of its color (excluding trump considerations)
  if (card.id === E.ROOK_ID) return true;
  for (let r = E.profile(game.settings).minRank; r <= 14; r++) {
    if (game.playMode === 'low' ? r >= card.rank : r <= card.rank) continue;
    const id = card.color + r;
    if (!game.played.some((p) => p.id === id)) return false;
  }
  return true;
}

function choosePlay(game, seat) {
  const hand = game.hands[seat];
  const legal = E.legalPlays(hand, game.trick, game.trump, game.settings);
  const trump = game.trump;
  const strength = c => c.id === E.ROOK_ID ? 100 : game.playMode === 'low' ? 19-c.rank : c.rank;
  const pts = E.cardPoints;
  const lowFirst = (a, b) => pts(a) - pts(b) || (a.color === trump) - (b.color === trump) || strength(a) - strength(b);
  const myTeam = E.teamOf(seat);
  if (!game.trick.length) {
    const nonTrumpBoss = legal.filter((c) => c.color !== trump && c.id !== E.ROOK_ID && isBoss(c, game));
    if (nonTrumpBoss.length) return nonTrumpBoss.sort((a, b) => strength(b) - strength(a))[0].id;
    const trumps = legal.filter((c) => c.color === trump);
    if (game.bid && E.teamOf(game.bid.seat) === myTeam && trumps.length >= 3) return trumps.sort((a, b) => strength(b) - strength(a))[0].id;
    return legal.slice().sort(lowFirst)[0].id;
  }
  const curWinner = E.trickWinner(game.trick, trump, game.playMode);
  const trickPts = E.sumPoints(game.trick.map((p) => p.card));
  const lastToPlay = game.trick.length === game.playerCount - 1;
  const winners = legal.filter((c) => E.trickWinner([...game.trick, { seat, card: c }], trump, game.playMode) === seat);
  if (E.teamOf(curWinner) === myTeam) {
    const partnerCard = game.trick.find((p) => p.seat === curWinner).card;
    const safe = lastToPlay || partnerCard.id === E.ROOK_ID || (partnerCard.color === trump && isBoss(partnerCard, game)) || isBoss(partnerCard, game);
    if (safe) {
      // smear points (but not the Rook)
      const smear = legal.filter((c) => c.id !== E.ROOK_ID).sort((a, b) => pts(b) - pts(a) || strength(a) - strength(b));
      if (smear.length) return smear[0].id;
    }
    return legal.slice().sort(lowFirst)[0].id;
  }
  if (winners.length) {
    const worth = trickPts + Math.max(...winners.map(pts));
    const nonRook = winners.filter((c) => c.id !== E.ROOK_ID);
    const pool = nonRook.length ? nonRook : (worth >= 10 || hand.length <= 2 ? winners : []);
    if (pool.length && (worth > 0 || lastToPlay || hand.length <= 3 || pool[0].color !== trump)) {
      return pool.sort((a, b) => (a.color === trump) - (b.color === trump) || strength(a) - strength(b))[0].id;
    }
  }
  return legal.slice().sort(lowFirst)[0].id;
}

// Perform one bot action for the seat whose turn it is. Returns true if acted.
function act(game, seat) {
  if (game.turn !== seat) return false;
  if (game.phase === 'bidding') {
    const d = chooseBid(game, seat);
    if (d.pass) E.applyPass(game, seat); else E.applyBid(game, seat, d.bid);
    return true;
  }
  if (game.phase === 'nest') { const d = chooseDiscard(game, seat); E.applyDiscard(game, seat, d.cards, d.trump); return true; }
  if (game.phase === 'playing') { E.applyPlay(game, seat, choosePlay(game, seat)); return true; }
  return false;
}

module.exports = { act, chooseBid, chooseDiscard, choosePlay, bestTrump, estimateHand };

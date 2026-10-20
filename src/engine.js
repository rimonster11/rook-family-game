'use strict';
// Rook rules engine (family rules). Pure-ish: functions mutate the passed game object
// and throw RuleError on illegal actions. No I/O.

const COLORS = ['R', 'B', 'G', 'Y'];
const COLOR_NAMES = { R: 'Red', B: 'Black', G: 'Green', Y: 'Yellow' };
const ROOK_ID = 'ROOK';
const HAND_SIZE = 9;
const NEST_SIZE = 5;

const DEFAULT_SETTINGS = Object.freeze({
  minBid: 70,            // opening/minimum bid
  bidIncrement: 5,       // bids must be multiples of this; any jump allowed
  maxBid: 120,           // all counters in the deck
  targetScore: 500,
  openerMustBid: true,   // player left of dealer must open at minBid (no all-pass possible)
  allPassRule: 'dealerStuck', // only used if openerMustBid=false: 'dealerStuck' | 'redeal'
  rookAnytime: false,    // retained for saved settings; follow-suit is always enforced
  allowLowCard: false,
  bidderLeads: true,     // bidder leads first trick (false = player left of dealer)
  winRule: 'bidderMustMake', // 'bidderMustMake': only a bidding team that makes its bid can win;
                             // 'anyReach': any team reaching target wins (both over -> bidding team)
  flipNestCard: true,    // top nest card shown face up during bidding
  botDelayMs: 700,       // server-side bot pacing (not used by engine)
});

class RuleError extends Error {}

function makeDeck() {
  const deck = [];
  for (const c of COLORS) for (let r = 5; r <= 14; r++) deck.push({ id: c + r, color: c, rank: r });
  deck.push({ id: ROOK_ID, color: 'ROOK', rank: 15 });
  return deck;
}

function cardFromId(id) {
  if (id === ROOK_ID) return { id, color: 'ROOK', rank: 15 };
  return { id, color: id[0], rank: Number(id.slice(1)) };
}

function cardPoints(card) {
  if (card.id === ROOK_ID) return 20;
  if (card.rank === 5) return 5;
  if (card.rank === 10 || card.rank === 14) return 10;
  return 0;
}
const sumPoints = (cards) => cards.reduce((s, c) => s + cardPoints(c), 0);

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const teamOf = (seat) => seat % 2; // seats 0&2 = team 0, 1&3 = team 1 (partners across)
const nextSeat = (seat) => (seat + 1) % 4; // clockwise

// Suit a card belongs to for following purposes. The Rook is part of the trump suit.
function effectiveSuit(card, trump) {
  return card.id === ROOK_ID ? trump : card.color;
}

function legalPlays(hand, trick, trump, settings = DEFAULT_SETTINGS) {
  if (!trick.length) return hand.slice();
  const led = effectiveSuit(trick[0].card, trump);
  const follow = hand.filter((c) => effectiveSuit(c, trump) === led);
  if (!follow.length) return hand.slice();
  return follow;
}

// trick: [{seat, card}] in play order. Returns winning seat.
function trickWinner(trick, trump, mode = 'high') {
  const rook = trick.find((p) => p.card.id === ROOK_ID);
  if (rook) return rook.seat; // Rook is always the highest card
  const led = effectiveSuit(trick[0].card, trump);
  let best = trick[0];
  for (const p of trick.slice(1)) {
    const bT = best.card.color === trump, pT = p.card.color === trump;
    if (pT && !bT) best = p;
    else if (pT === bT && p.card.color === best.card.color && (mode === 'low' ? p.card.rank < best.card.rank : p.card.rank > best.card.rank)) best = p;
    else if (!pT && !bT && p.card.color === led && best.card.color !== led) best = p;
  }
  return best.seat;
}

function sortHand(hand, trump) {
  const order = { B: 0, R: 1, G: 2, Y: 3 };
  return hand.slice().sort((a, b) => {
    const sa = a.id === ROOK_ID ? -1 : (a.color === trump ? -0.5 : order[a.color]);
    const sb = b.id === ROOK_ID ? -1 : (b.color === trump ? -0.5 : order[b.color]);
    return sa - sb || b.rank - a.rank;
  });
}

function newGame(settings = {}, opts = {}) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const game = {
    settings: s,
    dealer: opts.dealer ?? 0,
    scores: [0, 0],
    handNo: 0,
    phase: 'init',
    history: [],
    log: [],
    winner: null,
  };
  startHand(game, opts.rng);
  return game;
}

function addLog(game, msg) {
  game.log.push(msg);
  if (game.log.length > 60) game.log.shift();
}

function startHand(game, rng = Math.random, presetDeck = null) {
  const deck = presetDeck ? presetDeck.slice() : shuffle(makeDeck(), rng);
  game.handNo += 1;
  game.hands = [[], [], [], []];
  for (let i = 0; i < 4 * HAND_SIZE; i++) game.hands[(game.dealer + 1 + i) % 4].push(deck[i]);
  game.nest = deck.slice(4 * HAND_SIZE, 4 * HAND_SIZE + NEST_SIZE);
  game.nestFaceUp = game.settings.flipNestCard ? game.nest[0] : null;
  const first = nextSeat(game.dealer);
  game.bidding = { turn: first, highBid: 0, highBidder: null, passed: [false, false, false, false], history: [], opener: first };
  game.bid = null;
  game.trump = null;
  game.discard = [];
  game.trick = [];
  game.lastTrick = null;
  game.taken = [[], []];        // cards captured per team
  game.tricksWon = [0, 0];
  game.personalTricks = [0, 0, 0, 0];
  game.playMode = 'high';
  game.moon = null;
  game.queued = [null, null, null, null];
  game.autoFinish = false;
  game._proofAt = -1;
  game._autoPlan = null;
  game.dealtAt = Date.now();
  game.trickNo = 0;
  game.played = [];             // all cards played this hand (for bots)
  game.turn = first;
  game.phase = 'bidding';
  game.recap = null;
  addLog(game, `Hand ${game.handNo}: seat ${game.dealer + 1} deals.`);
}

function validBids(game) {
  const s = game.settings, b = game.bidding;
  const start = b.highBid ? b.highBid + s.bidIncrement : s.minBid;
  const out = [];
  for (let v = Math.ceil(start / s.bidIncrement) * s.bidIncrement; v <= s.maxBid; v += s.bidIncrement) if (v >= s.minBid) out.push(v);
  return out;
}

function canPass(game, seat) {
  const b = game.bidding;
  return !(game.settings.openerMustBid && b.highBidder === null && seat === b.opener);
}

function requireTurn(game, phase, seat) {
  if (game.phase !== phase) throw new RuleError(`Not in ${phase} phase`);
  if (game.turn !== seat) throw new RuleError('Not your turn');
}

function advanceBidding(game) {
  const b = game.bidding;
  const active = [0, 1, 2, 3].filter((x) => !b.passed[x]);
  if (b.highBidder !== null && (active.length === 1 || b.highBid >= game.settings.maxBid)) {
    return finishBidding(game);
  }
  if (active.length === 0) {
    if (game.settings.allPassRule === 'redeal') {
      addLog(game, 'Everyone passed - redeal.');
      game.dealer = nextSeat(game.dealer);
      game.handNo -= 1;
      return startHand(game);
    }
    b.highBid = game.settings.minBid; b.highBidder = game.dealer;
    addLog(game, `Everyone passed - dealer (seat ${game.dealer + 1}) is stuck at ${b.highBid}.`);
    return finishBidding(game);
  }
  let t = nextSeat(b.turn);
  while (b.passed[t]) t = nextSeat(t);
  b.turn = t; game.turn = t;
}

function finishBidding(game) {
  const b = game.bidding;
  game.bid = { seat: b.highBidder, amount: b.highBid, team: teamOf(b.highBidder) };
  game.hands[b.highBidder].push(...game.nest);
  game.nest = [];
  game.nestFaceUp = null; // flipped card is no longer shown once the bidder takes the nest
  game.phase = 'nest';
  game.turn = b.highBidder;
  addLog(game, `Seat ${b.highBidder + 1} wins the bid at ${b.highBid} and takes the nest.`);
}

function applyBid(game, seat, amount) {
  requireTurn(game, 'bidding', seat);
  amount = Number(amount);
  const s = game.settings, b = game.bidding;
  if (!Number.isInteger(amount) || amount % s.bidIncrement !== 0) throw new RuleError(`Bid must be a multiple of ${s.bidIncrement}`);
  if (amount < s.minBid) throw new RuleError(`Minimum bid is ${s.minBid}`);
  if (amount <= b.highBid) throw new RuleError(`Bid must be higher than ${b.highBid}`);
  if (amount > s.maxBid) throw new RuleError(`Maximum bid is ${s.maxBid}`);
  b.highBid = amount; b.highBidder = seat;
  b.history.push({ seat, bid: amount });
  addLog(game, `Seat ${seat + 1} bids ${amount}.`);
  advanceBidding(game);
}

function applyPass(game, seat) {
  requireTurn(game, 'bidding', seat);
  if (!canPass(game, seat)) throw new RuleError(`Opening bidder must bid at least ${game.settings.minBid}`);
  game.bidding.passed[seat] = true;
  game.bidding.history.push({ seat, bid: 'pass' });
  addLog(game, `Seat ${seat + 1} passes.`);
  advanceBidding(game);
}

function applyDiscard(game, seat, cardIds, trump, mode = 'high', moon = false) {
  requireTurn(game, 'nest', seat);
  if (!['high', 'low'].includes(mode) || (mode === 'low' && !game.settings.allowLowCard)) throw new RuleError('Low-card play is not enabled');
  if (typeof moon !== 'boolean') throw new RuleError('Choose a valid moon option');
  if (!COLORS.includes(trump)) throw new RuleError('Choose a trump color');
  if (!Array.isArray(cardIds) || new Set(cardIds).size !== NEST_SIZE || cardIds.length !== NEST_SIZE) throw new RuleError(`Discard exactly ${NEST_SIZE} different cards`);
  const hand = game.hands[seat];
  const disc = cardIds.map((id) => {
    const c = hand.find((h) => h.id === id);
    if (!c) throw new RuleError('Card not in hand');
    return c;
  });
  // Anything may be discarded, including counters and the Rook.
  game.hands[seat] = hand.filter((c) => !cardIds.includes(c.id));
  game.discard = disc;
  game.trump = trump;
  game.playMode = mode;
  game.moon = moon ? { seat, failed: false } : null;
  game.phase = 'playing';
  const leader = game.settings.bidderLeads ? seat : nextSeat(game.dealer);
  game.leader = leader; game.turn = leader;
  addLog(game, `Seat ${seat + 1} discards 5 and names ${COLOR_NAMES[trump]} trump.`);
  if (mode === 'low') addLog(game, 'Low cards win; the Rook remains highest.');
  if (moon) addLog(game, `Seat ${seat + 1} shoots the moon: win all 9 tricks personally for +500, otherwise -500.`);
}

function queuePlay(game, seat, cardId) {
  if (!game || game.phase !== 'playing' || !Number.isInteger(seat) || seat < 0 || seat > 3 || game.autoFinish) throw new RuleError('Cannot pre-play now');
  if (cardId === null) { game.queued[seat] = null; return; }
  if (game.turn === seat) throw new RuleError('It is your turn; play a legal card');
  if (!game.hands[seat].some(c => c.id === cardId)) throw new RuleError('Card not in hand');
  game.queued[seat] = cardId;
}

function takeQueuedPlay(game) {
  if (!game || game.phase !== 'playing') return null;
  const seat = game.turn, id = game.queued[seat];
  game.queued[seat] = null;
  return id && legalPlays(game.hands[seat], game.trick, game.trump).some(c => c.id === id) ? id : null;
}

function applyPlay(game, seat, cardId) {
  requireTurn(game, 'playing', seat);
  const hand = game.hands[seat];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new RuleError('Card not in hand');
  const legal = legalPlays(hand, game.trick, game.trump, game.settings);
  if (!legal.some((c) => c.id === cardId)) throw new RuleError('You must follow the led color');
  game.hands[seat] = hand.filter((c) => c.id !== cardId);
  game.queued[seat] = null;
  game.trick.push({ seat, card });
  game.played.push(card);
  if (game.trick.length < 4) { game.turn = nextSeat(seat); return null; }
  // Trick complete
  const winner = trickWinner(game.trick, game.trump, game.playMode);
  const team = teamOf(winner);
  const cards = game.trick.map((p) => p.card);
  game.taken[team].push(...cards);
  game.tricksWon[team] += 1;
  game.personalTricks[winner] += 1;
  if (game.moon && winner !== game.moon.seat) game.moon.failed = true;
  game.trickNo += 1;
  const isLast = game.hands.every((h) => h.length === 0);
  let pts = sumPoints(cards);
  if (isLast) { game.taken[team].push(...game.discard); pts += sumPoints(game.discard); }
  game.lastTrick = { no: game.trickNo, plays: game.trick, winner, points: pts, last: isLast };
  game.trick = [];
  addLog(game, `Seat ${winner + 1} takes trick ${game.trickNo} (${pts} pts)${isLast ? ' incl. the discarded nest' : ''}.`);
  if (isLast) { scoreHand(game, winner); return winner; }
  game.turn = winner; game.leader = winner;
  return winner;
}

// Compute hand score delta. Exported for tests.
function computeHandScore(bid, teamPoints) {
  const delta = [0, 0];
  const made = teamPoints[bid.team] >= bid.amount;
  delta[bid.team] = made ? teamPoints[bid.team] : -bid.amount;
  delta[1 - bid.team] = teamPoints[1 - bid.team];
  return { delta, made };
}

function decideWinner(scores, bid, made, settings) {
  const t = settings.targetScore;
  if (settings.winRule === 'bidderMustMake') {
    return made && scores[bid.team] >= t ? bid.team : null;
  }
  const over = [0, 1].filter((x) => scores[x] >= t);
  if (!over.length) return null;
  if (over.length === 1) return over[0];
  return bid.team; // both over: bidding team wins
}

function scoreHand(game, lastTrickSeat) {
  const pts = [sumPoints(game.taken[0]), sumPoints(game.taken[1])];
  let { delta, made } = computeHandScore(game.bid, pts);
  if (game.moon) {
    made = !game.moon.failed && game.personalTricks[game.moon.seat] === HAND_SIZE;
    delta[game.bid.team] = made ? 500 : -500;
  }
  game.scores[0] += delta[0]; game.scores[1] += delta[1];
  const recap = {
    handNo: game.handNo, dealer: game.dealer, bid: game.bid, trump: game.trump, points: pts, delta, made,
    scores: game.scores.slice(), discard: game.discard.slice(), discardPoints: sumPoints(game.discard),
    lastTrickSeat, tricksWon: game.tricksWon.slice(), moon: game.moon, playMode: game.playMode,
  };
  game.recap = recap;
  game.history.push(recap);
  addLog(game, game.moon
    ? `Hand over: Team ${game.bid.team + 1} ${made ? 'shot the moon (+500)' : 'missed the moon (-500)'}. Points ${pts[0]}-${pts[1]}.`
    : `Hand over: Team ${game.bid.team + 1} ${made ? 'made' : 'was SET on'} ${game.bid.amount}. Points ${pts[0]}-${pts[1]}.`);
  const w = decideWinner(game.scores, game.bid, made, game.settings);
  if (w !== null) { game.winner = w; game.phase = 'gameOver'; addLog(game, `Team ${w + 1} wins the game!`); }
  else game.phase = 'handOver';
  game.turn = null;
}

function nextHand(game, rng) {
  if (game.phase !== 'handOver') throw new RuleError('Hand not over');
  game.dealer = nextSeat(game.dealer);
  startHand(game, rng);
}

// Personalized view for one seat (null = spectator). Never leaks hidden cards.
function viewFor(game, seat) {
  const v = {
    phase: game.phase, settings: game.settings, dealer: game.dealer, scores: game.scores, handNo: game.handNo,
    turn: game.turn, bid: game.bid, trump: game.trump, trick: game.trick, lastTrick: game.lastTrick,
    tricksWon: game.tricksWon, trickNo: game.trickNo, handCounts: game.hands.map((h) => h.length),
    nestCount: game.nest.length, nestFaceUp: game.phase === 'bidding' ? game.nestFaceUp : null,
    bidding: game.phase === 'bidding' ? { ...game.bidding } : { history: game.bidding.history, highBid: game.bidding.highBid, highBidder: game.bidding.highBidder },
    recap: game.recap, history: game.history, winner: game.winner, log: game.log.slice(-25),
    capturedPoints: [sumPoints(game.taken[0]), sumPoints(game.taken[1])],
    playMode: game.playMode, moon: game.moon, personalTricks: game.personalTricks,
    autoFinish: game.autoFinish, dealtAt: game.dealtAt, queuedCard: null,
    hand: [], legal: [], validBids: [], canPass: false,
  };
  if (seat !== null && seat !== undefined) {
    v.hand = sortHand(game.hands[seat], game.trump);
    v.queuedCard = game.queued[seat];
    if (game.phase === 'playing' && game.turn === seat) v.legal = legalPlays(game.hands[seat], game.trick, game.trump, game.settings).map((c) => c.id);
    if (game.phase === 'bidding' && game.turn === seat) { v.validBids = validBids(game); v.canPass = canPass(game, seat); }
    if (game.bid && game.bid.seat === seat && game.phase !== 'nest') v.myDiscard = game.discard;
  }
  return v;
}

module.exports = {
  COLORS, COLOR_NAMES, ROOK_ID, DEFAULT_SETTINGS, RuleError, HAND_SIZE, NEST_SIZE,
  makeDeck, cardFromId, cardPoints, sumPoints, shuffle, teamOf, nextSeat, effectiveSuit,
  legalPlays, trickWinner, sortHand, newGame, startHand, validBids, canPass,
  applyBid, applyPass, applyDiscard, applyPlay, queuePlay, takeQueuedPlay, computeHandScore, decideWinner, scoreHand, nextHand, viewFor,
};

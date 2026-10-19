'use strict';
// Simulate full games with 4 bots. Usage: node src/sim.js [games]
const E = require('./engine');
const Bot = require('./bot');

function simulateGame(settings = {}, rng = Math.random, maxHands = 500) {
  const g = E.newGame(settings, { rng });
  let hands = 0;
  while (g.phase !== 'gameOver') {
    if (g.phase === 'handOver') { E.nextHand(g, rng); continue; }
    if (g.phase === 'bidding' && g.handNo > hands) hands = g.handNo;
    if (hands > maxHands) throw new Error('Game did not finish');
    Bot.act(g, g.turn);
  }
  return g;
}

if (require.main === module) {
  const n = Number(process.argv[2] || 1);
  for (let i = 0; i < n; i++) {
    const g = simulateGame();
    const sets = g.history.filter((h) => !h.made).length;
    console.log(`Game ${i + 1}: Team ${g.winner + 1} wins ${g.scores[0]}-${g.scores[1]} after ${g.history.length} hands (${sets} set bids).`);
    if (n === 1) for (const h of g.history) console.log(`  Hand ${h.handNo}: seat ${h.bid.seat + 1} bid ${h.bid.amount} ${E.COLOR_NAMES[h.trump]}; pts ${h.points.join('-')} ${h.made ? 'made' : 'SET'}; scores ${h.scores.join('-')}`);
  }
}
module.exports = { simulateGame };

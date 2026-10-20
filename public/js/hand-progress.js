(function (root) {
  function handProgress(game) {
    const points = game.capturedPoints || [0, 0];
    const remaining = Math.max(0, 120 - points[0] - points[1]);
    if (!game.bid) return { points, remaining, status: 'bidding' };
    const { team, amount } = game.bid;
    if (game.moon) {
      const won = game.personalTricks?.[game.moon.seat] || 0;
      return { points, remaining, team, amount: 500, needed: Math.max(0, 9 - won), cushion: 0,
        status: game.moon.failed ? 'set' : won === 9 ? 'secured' : 'chasing' };
    }
    const needed = Math.max(0, amount - points[team]);
    // Only captured points count. Unawarded points include the hidden nest.
    const cushion = 120 - amount - points[1 - team];
    return { points, remaining, needed, cushion, team, amount,
      status: needed === 0 ? 'secured' : cushion < 0 ? 'set' : 'chasing' };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = handProgress;
  else root.rookHandProgress = handProgress;
})(globalThis);

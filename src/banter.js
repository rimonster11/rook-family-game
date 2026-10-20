'use strict';
const lines = {
  bidding: ['My confidence is not backed by these cards.', 'I came for the snacks. The cards were a surprise.', 'That bid comes with a complimentary deep breath.'],
  nest: ['Five cards are about to become someone else’s problem.', 'Checking the nest for better life choices.'],
  playing: ['That was strategy. Probably.', 'Partner, please interpret this generously.', 'I meant to do that. Mostly.', 'My poker face is buffering.'],
};
function botLine(character, phase, random = Math.random) {
  const pool = character === 13 ? ['This is the worst hand ever', "I'm so gonna get set.", ...(lines[phase] || [])] : lines[phase];
  return pool?.length ? pool[Math.floor(random() * pool.length)] : null;
}
module.exports = { botLine };

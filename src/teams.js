'use strict';
const { randomUUID } = require('crypto');
const defaults = ['Blue Jays', 'Snowbirds'];
const identity = (s) => !s ? null : s.type === 'human' ? s.playerId : `bot:${s.name}`;

function reconcile(room) {
  room.teams ||= [];
  for (let t = 0; t < 2; t++) {
    const members = [identity(room.seats[t]), identity(room.seats[t + 2])];
    if (!room.teams[t] || JSON.stringify(room.teams[t].members) !== JSON.stringify(members)) {
      room.teams[t] = { name: defaults[t], members, proposal: null };
    }
  }
}
function propose(room, seat, value) {
  reconcile(room);
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error('Take a seat to name your team.');
  const t = seat % 2;
  if (!room.seats[t] || !room.seats[t + 2]) throw new Error('Your teammate needs to take a seat first.');
  const name = String(value ?? '').replace(/[<>\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw new Error('Enter a team name.');
  const approvals = [t, t + 2].filter((i) => i === seat || room.seats[i].type === 'bot');
  room.teams[t].proposal = { id: randomUUID(), name, approvals };
  if (approvals.length === 2) { room.teams[t].name = name; room.teams[t].proposal = null; }
}
function respond(room, seat, id, accept) {
  reconcile(room);
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error('Only teammates can approve a name.');
  const team = room.teams[seat % 2], p = team.proposal;
  if (!p || p.id !== id) throw new Error('That proposal has changed. Please review the current name.');
  if (!accept) { team.proposal = null; return; }
  if (!p.approvals.includes(seat)) p.approvals.push(seat);
  if (p.approvals.length === 2) { team.name = p.name; team.proposal = null; }
}
function publicTeams(room) {
  reconcile(room);
  return room.teams.map(({ name, proposal }) => ({ name, proposal }));
}
module.exports = { reconcile, propose, respond, publicTeams };

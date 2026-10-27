'use strict';
const { randomUUID } = require('crypto');
const defaults = ['Blue Jays', 'Snowbirds'];
const identity = (s) => !s ? null : s.type === 'human' ? s.playerId : `bot:${s.name}`;

const memberSeats = (room, team) => room.seats.map((_, i) => i).filter(i => i % 2 === team);

function reconcile(room) {
  room.teams ||= [];
  for (let t = 0; t < 2; t++) {
    const members = memberSeats(room, t).map(i => identity(room.seats[i]));
    if (!room.teams[t] || JSON.stringify(room.teams[t].members) !== JSON.stringify(members)) {
      room.teams[t] = { name: defaults[t], members, proposal: null };
    }
  }
}
function propose(room, seat, value) {
  reconcile(room);
  if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) throw new Error('Take a seat to name your team.');
  const t = seat % 2;
  if (memberSeats(room, t).some(i => !room.seats[i])) throw new Error('Your teammate needs to take a seat first.');
  const name = String(value ?? '').replace(/[<>\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!name) throw new Error('Enter a team name.');
  const approvals = memberSeats(room, t).filter((i) => i === seat || room.seats[i].type === 'bot');
  room.teams[t].proposal = { id: randomUUID(), name, approvals };
  if (approvals.length === memberSeats(room, t).length) { room.teams[t].name = name; room.teams[t].proposal = null; }
}
function respond(room, seat, id, accept) {
  reconcile(room);
  if (!Number.isInteger(seat) || seat < 0 || seat >= room.seats.length) throw new Error('Only teammates can approve a name.');
  const team = room.teams[seat % 2], p = team.proposal;
  if (!p || p.id !== id) throw new Error('That proposal has changed. Please review the current name.');
  if (!accept) { team.proposal = null; return; }
  if (!p.approvals.includes(seat)) p.approvals.push(seat);
  if (p.approvals.length === memberSeats(room, seat % 2).length) { team.name = p.name; team.proposal = null; }
}
function publicTeams(room) {
  reconcile(room);
  return room.teams.map(({ name, proposal }) => ({ name, proposal }));
}
module.exports = { reconcile, propose, respond, publicTeams };

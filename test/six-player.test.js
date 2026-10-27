const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');
const Bot = require('../src/bot');
const Teams = require('../src/teams');
const { proveFinish } = require('../src/auto-finish');
const { simulateGame } = require('../src/sim');
const C = E.cardFromId;
const settings = {mode:'partnership6'};
const seeded = seed => () => ((seed=(seed*1664525+1013904223)>>>0)/2**32);

test('six-player profile fixes rules and deals 57 unique cards from every dealer',()=>{
  for(let dealer=0;dealer<6;dealer++) {
    const g=E.newGame({...settings,allowLowCard:true,rookAnytime:false,bidderLeads:true,targetScore:500,botDelayMs:800},{dealer,rng:seeded(dealer+1)});
    assert.deepEqual(g.hands.map(h=>h.length),[8,8,8,8,8,8]);
    assert.equal(g.nest.length,9);assert.equal(g.nestFaceUp,null);
    assert.equal(new Set([...g.hands.flat(),...g.nest].map(c=>c.id)).size,57);
    assert.equal(E.sumPoints(E.makeDeck(g.settings)),120);
    assert.equal(E.cardPoints(C('R1')),0);assert.equal(g.turn,(dealer+1)%6);
    assert.equal(g.settings.allowLowCard,false);assert.equal(g.settings.rookAnytime,true);
    assert.equal(g.settings.bidderLeads,false);assert.equal(g.settings.targetScore,300);assert.equal(g.settings.botDelayMs,800);
    assert.equal(E.canPass(g,g.turn),true);
  }
  assert.throws(()=>E.newGame({mode:'highCardPartner5'}),/Unsupported/);
  assert.throws(()=>E.newGame({mode:'toString'}),/Unsupported/);
});

test('six-player bidding rotates through six seats and all-pass advances dealer without scoring',()=>{
  const g=E.newGame(settings,{dealer:4});
  for(const seat of [5,0,1,2,3,4]){assert.equal(g.turn,seat);E.applyPass(g,seat);}
  assert.equal(g.dealer,5);assert.equal(g.turn,0);assert.equal(g.handNo,1);assert.deepEqual(g.scores,[0,0]);
  assert.deepEqual(E.validBids(g),Array.from({length:11},(_,i)=>70+i*5));
  E.applyBid(g,0,70);E.applyBid(g,1,80);
  for(const seat of [2,3,4,5,0])E.applyPass(g,seat);
  assert.equal(g.phase,'nest');assert.equal(g.turn,1);assert.equal(g.hands[1].length,17);
});

test('six-player nest validates nine cards atomically and dealer-left leads instead of bidder',()=>{
  const g=E.newGame(settings,{dealer:0});E.applyBid(g,1,70);E.applyBid(g,2,120);
  const ids=g.hands[2].slice(0,9).map(c=>c.id),before=JSON.stringify(g);
  for(const [cards,mode,moon] of [[ids.slice(0,5),'high',false],[ids,'low',false],[ids,'high',true]]) {
    assert.throws(()=>E.applyDiscard(g,2,cards,'R',mode,moon));assert.equal(JSON.stringify(g),before);
  }
  E.applyDiscard(g,2,ids,'R');assert.equal(g.turn,1);assert.equal(g.hands[2].length,8);
  assert.equal(g.discard.length,9);assert.equal(g.playMode,'high');
});

test('six-player Rook anytime is isolated from family follow-suit and rank one stays low',()=>{
  const hand=['R5','G7','ROOK'].map(C),trick=[{seat:0,card:C('R10')}];
  assert.deepEqual(E.legalPlays(hand,trick,'G',E.settingsFor(settings)).map(c=>c.id),['R5','ROOK']);
  assert.deepEqual(E.legalPlays(hand,trick,'G',{...E.DEFAULT_SETTINGS,rookAnytime:true}).map(c=>c.id),['R5']);
  assert.deepEqual(E.legalPlays(['R5','ROOK'].map(C),[{seat:0,card:C('G1')}],'G',E.settingsFor(settings)).map(c=>c.id),['ROOK']);
  assert.deepEqual(E.legalPlays(hand,[{seat:0,card:C('ROOK')}],'G',E.settingsFor(settings)).map(c=>c.id),['G7','ROOK']);
  assert.equal(E.trickWinner([{seat:4,card:C('R1')},{seat:5,card:C('R2')}],'G'),5);
});

test('six-player complete games conserve counters and eight tricks with no bonus; privacy covers all seats',()=>{
  for(let seed=1;seed<=30;seed++) {
    const g=E.newGame(settings,{dealer:seed%6,rng:seeded(seed)});
    while(g.phase==='bidding')Bot.act(g,g.turn);
    const bidder=g.turn;Bot.act(g,bidder);
    assert.equal(proveFinish(g),null);
    while(g.phase==='playing') {
      const seat=g.turn,prior=g.trick.length,oldPoints=E.viewFor(g,null).capturedPoints;
      for(let viewer=0;viewer<6;viewer++) {
        const v=E.viewFor(g,viewer);
        assert.deepEqual(v.hand.map(c=>c.id).sort(),g.hands[viewer].map(c=>c.id).sort());
        assert.equal('hands' in v,false);assert.equal('discard' in v,false);assert.equal('_autoPlan' in v,false);
        assert.equal('myDiscard' in v,viewer===bidder);
      }
      const watcher=E.viewFor(g,null);assert.deepEqual(watcher.hand,[]);assert.equal('myDiscard' in watcher,false);
      Bot.act(g,seat);
      if(prior<5)assert.deepEqual(E.viewFor(g,null).capturedPoints,oldPoints);
    }
    assert.equal(g.lastTrick.plays.length,6);assert.equal(g.trickNo,8);
    assert.equal(g.recap.points.reduce((a,b)=>a+b),120);
    assert.deepEqual(g.recap.delta,E.computeHandScore(g.bid,g.recap.points).delta);
    assert.ok(g.discard.every(c=>g.taken[E.teamOf(g.lastTrick.winner)].some(t=>t.id===c.id)));
  }
  for(let seed=1;seed<=25;seed++)assert.equal(simulateGame(settings,seeded(seed)).phase,'gameOver');
});

test('six-player victory admits defenders, chooses greater totals and continues tied totals',()=>{
  const s=E.settingsFor(settings),bid={team:0,amount:70};
  assert.equal(E.decideWinner([200,310],bid,false,s),1);
  assert.equal(E.decideWinner([310,320],bid,true,s),1);
  assert.equal(E.decideWinner([320,310],bid,true,s),0);
  assert.equal(E.decideWinner([310,310],bid,true,s),null);
  assert.equal(E.decideWinner([300,290],bid,true,s),0);
});

test('six-player queues accept last seat privately and use mode-specific legality',()=>{
  const g=E.newGame(settings);E.applyBid(g,g.turn,120);Bot.act(g,g.turn);
  g.turn=4;g.hands[4]=['R10'].map(C);g.hands[5]=['R5','ROOK'].map(C);g.trump='G';
  E.queuePlay(g,5,'ROOK');assert.equal(E.viewFor(g,5).queuedCard,'ROOK');assert.equal(E.viewFor(g,0).queuedCard,null);
  E.applyPlay(g,4,'R10');assert.equal(E.takeQueuedPlay(g),'ROOK');
  assert.throws(()=>E.queuePlay(g,6,'ROOK'));assert.throws(()=>E.queuePlay(g,4.5,'ROOK'));
});

test('six-player team names need all three teammates and reset when the third changes',()=>{
  const room={seats:Array.from({length:6},(_,i)=>({type:'human',playerId:'p'+i}))};
  Teams.propose(room,0,'Three Birds');let id=room.teams[0].proposal.id;
  Teams.respond(room,2,id,true);assert.equal(room.teams[0].name,'Blue Jays');
  assert.throws(()=>Teams.respond(room,5,id,true));Teams.respond(room,4,id,true);assert.equal(room.teams[0].name,'Three Birds');
  room.seats[4]={type:'bot',name:'New Bird'};Teams.reconcile(room);assert.equal(room.teams[0].name,'Blue Jays');
  Teams.propose(room,2,'Again');id=room.teams[0].proposal.id;Teams.respond(room,0,id,true);assert.equal(room.teams[0].name,'Again');
});

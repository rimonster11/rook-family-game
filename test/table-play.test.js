'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');
const Bot = require('../src/bot');
const { proveFinish } = require('../src/auto-finish');
const { botLine } = require('../src/banter');
const C = E.cardFromId;
const P = (seat, id) => ({seat, card:C(id)});
function position(hands, mode='high') {
  const g=E.newGame({allowLowCard:true,targetScore:2000});
  Object.assign(g,{phase:'playing',bid:{seat:0,team:0,amount:70},turn:0,leader:0,trump:'R',playMode:mode,hands:hands.map(h=>h.map(C)),nest:[],discard:[]});
  return g;
}
test('Rook cannot bypass non-trump follow-suit even with an old anytime setting',()=>{
  const g=position([['B5','ROOK'],['B14'],['R7'],['Y9']]);g.turn=0;g.trick=[P(3,'B10')];
  g.settings.rookAnytime=true;
  assert.deepEqual(E.legalPlays(g.hands[0],g.trick,g.trump,g.settings).map(c=>c.id),['B5']);
  assert.throws(()=>E.applyPlay(g,0,'ROOK'),/follow/);
  assert.equal(g.hands[0].length,2);
  assert.equal(E.legalPlays([C('ROOK'),C('G5')],[P(3,'R5')],'R')[0].id,'ROOK');
});
test('low ranks win only within led/trump color; Rook remains highest and points unchanged',()=>{
  assert.equal(E.trickWinner([P(0,'B10'),P(1,'B5'),P(2,'G5'),P(3,'B6')],'R','low'),1);
  assert.equal(E.trickWinner([P(0,'B5'),P(1,'R14'),P(2,'R6'),P(3,'R5')],'R','low'),3);
  assert.equal(E.trickWinner([P(0,'R5'),P(1,'ROOK'),P(2,'R6'),P(3,'R14')],'R','low'),1);
  assert.equal(E.sumPoints(['R5','B10','G14','ROOK'].map(C)),45);
});
test('low-card and moon declarations are validated before changing the nest',()=>{
  const g=E.newGame({allowLowCard:false});E.applyBid(g,g.turn,120);
  const seat=g.turn,ids=g.hands[seat].slice(0,5).map(c=>c.id),snapshot=JSON.stringify(g);
  assert.throws(()=>E.applyDiscard(g,seat,ids,'R','low',true),/not enabled/);
  assert.equal(JSON.stringify(g),snapshot);
  assert.throws(()=>E.applyDiscard(g,seat,ids,'R','high','yes'),/moon/);
  g.settings.allowLowCard=true;E.applyDiscard(g,seat,ids,'R','low',true);
  assert.equal(g.playMode,'low');assert.deepEqual(g.moon,{seat,failed:false});
  assert.throws(()=>E.applyDiscard(g,seat,ids,'R','high',false),/phase/);
});
test('queued cards are private, replaceable, cancellable, and rechecked on the actual turn',()=>{
  const g=position([['B14','G7'],['B5','ROOK'],['Y8','R8'],['B6','G6']]);
  E.queuePlay(g,1,'ROOK');assert.equal(E.viewFor(g,1).queuedCard,'ROOK');
  assert.equal(E.viewFor(g,2).queuedCard,null);assert.equal(E.viewFor(g,null).queuedCard,null);
  assert.equal('queued' in E.viewFor(g,2),false);
  E.queuePlay(g,1,'B5');assert.equal(g.queued[1],'B5');E.queuePlay(g,1,null);assert.equal(g.queued[1],null);
  assert.throws(()=>E.queuePlay(g,-1,'ROOK'));assert.throws(()=>E.queuePlay(g,1,'R14'));
  assert.throws(()=>E.queuePlay(g,0,'B14'),/your turn/);
  E.queuePlay(g,1,'ROOK');E.applyPlay(g,0,'B14');assert.equal(E.takeQueuedPlay(g),null);
  assert.equal(g.turn,1);assert.equal(g.hands[1].length,2);assert.equal(g.queued[1],null);
  g.turn=0;g.trick=[];E.queuePlay(g,1,'B5');E.applyPlay(g,0,'G7');assert.equal(E.takeQueuedPlay(g),'B5');
});
test('last trick remains visible through later plays and resets on next hand',()=>{
  const g=position([['R14','R13'],['B5','B6'],['G5','G6'],['Y5','Y6']]);
  for(const id of ['R14','B5','G5','Y5'])E.applyPlay(g,g.turn,id);
  const last=structuredClone(g.lastTrick);E.applyPlay(g,0,'R13');
  assert.deepEqual(E.viewFor(g,1).lastTrick,last);assert.equal(last.plays.length,4);
  for(const id of ['B6','G6','Y6'])E.applyPlay(g,g.turn,id);
  E.nextHand(g);assert.equal(g.lastTrick,null);assert.deepEqual(g.queued,[null,null,null,null]);
});
function moonHand(partnerRook=false) {
  const bidder=partnerRook?['R14','R13','R12','R11','R10','R9','R8','R7','R6']:['ROOK','R14','R13','R12','R11','R10','R9','R8','R7'];
  const rest=E.makeDeck().filter(c=>!bidder.includes(c.id));
  if(partnerRook){const i=rest.findIndex(c=>c.id==='ROOK');[rest[9],rest[i]]=[rest[i],rest[9]];}
  const g=position([bidder,rest.slice(0,9).map(c=>c.id),rest.slice(9,18).map(c=>c.id),rest.slice(18,27).map(c=>c.id)]);
  g.discard=rest.slice(27);g.moon={seat:0,failed:false};return g;
}
test('moon pays exactly +500 for nine personal tricks; partner taking one means -500',()=>{
  for(const fail of [false,true]){
    const g=moonHand(fail);
    while(g.phase==='playing'){
      const legal=E.legalPlays(g.hands[g.turn],g.trick,g.trump);
      const card=fail&&g.turn===2&&legal.find(c=>c.id==='ROOK')||legal[0];
      E.applyPlay(g,g.turn,card.id);
    }
    assert.equal(g.recap.delta[0],fail?-500:500);assert.equal(g.recap.made,!fail);
    assert.equal(require('../public/js/hand-progress')(E.viewFor(g,0)).status,fail?'set':'secured');
    assert.equal(g.recap.points.reduce((a,b)=>a+b),120);
    assert.equal(g.recap.delta[1],g.recap.points[1]);
    if(fail)assert.ok(g.personalTricks[2]>0);else assert.equal(g.personalTricks[0],9);
    E.nextHand(g);assert.equal(g.moon,null);assert.equal(g.playMode,'high');
  }
});
test('guaranteed finish proves three winners and rejects a partner winner, ruff, or missing Rook',()=>{
  for(const mode of ['high','low']){
    const winners=mode==='high'?['R14','R13','R12']:['R5','R6','R7'];
    const g=position([winners,['B5','G5','Y5'],['B6','G6','Y6'],['B7','G7','Y7']],mode);
    const proof=proveFinish(g);assert.ok(proof);
    while(g.phase==='playing')E.applyPlay(g,g.turn,proof.choose(g));
    assert.equal(g.personalTricks[0],3);
  }
  assert.equal(proveFinish(position([['B14'],['G5'],['R5'],['Y6']])),null,'Partner can trump');
  assert.equal(proveFinish(position([['R14'],['G5'],['ROOK'],['Y6']])),null,'Partner has Rook');
  assert.equal(proveFinish(position([['B14'],['R5'],['G5'],['Y6']])),null,'Opponent can trump');
});
test('proof search finds a necessary trump draw and fails closed when its budget is exhausted',()=>{
  const g=position([['R14','B14'],['R5','B5'],['B6','Y6'],['B7','Y7']]);
  // B14 first can be ruffed; drawing R14 first removes that danger.
  const proof=proveFinish(g,{maxMs:1000});assert.ok(proof);assert.equal(proof.choose(g),'R14');
  assert.equal(proveFinish(g,{maxNodes:0}),null);
  while(g.phase==='playing')E.applyPlay(g,g.turn,proof.choose(g));
  assert.equal(g.personalTricks[0],2);
});
test('finish proof agrees with exhaustive legal continuations, including becoming void later',()=>{
  assert.equal(proveFinish(position([['B14','B13'],['B5','R5'],['G5','G6'],['Y5','Y6']])),null);
  function oracle(g) {
    if(g.lastTrick && g.lastTrick.winner!==0)return false;
    if(g.phase!=='playing')return true;
    const branches=E.legalPlays(g.hands[g.turn],g.trick,g.trump).map(c=>()=>{
      const next=structuredClone(g);E.applyPlay(next,next.turn,c.id);return oracle(next);
    });
    return g.turn===0?branches.some(f=>f()):branches.every(f=>f());
  }
  let seed=398;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
  for(const mode of ['high','low'])for(let n=0;n<80;n++){
    const cards=E.shuffle(E.makeDeck(),rng).slice(0,8);
    const g=position([0,1,2,3].map(i=>cards.slice(i*2,i*2+2).map(c=>c.id)),mode);
    const plan=proveFinish(g,{maxMs:1000,maxNodes:1000000});
    assert.equal(!!plan,oracle(g),`${mode} ${JSON.stringify(g.hands)}`);
    if(plan){while(g.phase==='playing')E.applyPlay(g,g.turn,plan.choose(g));assert.equal(g.personalTricks[0],2);}
  }
});
test('low-card bot play and published state use the same trick ordering',()=>{
  const g=position([['R14','R5'],['B10','B6'],['G8','G6'],['Y9','Y7']],'low');
  while(g.phase==='playing')Bot.act(g,g.turn);
  assert.equal(g.recap.playMode,'low');assert.equal(E.viewFor(g,null).playMode,'low');
});
test('Melissa retains her name and curls; banter uses premade lines without inspecting cards',async()=>{
  globalThis.RookStyle=require('../public/js/style-options');
  const {CHARACTERS,charOf,avatarSVG}=await import('../public/js/art.js');
  const {buildCharacter,disposeCharacter}=await import('../public/js/characters.js');
  assert.equal(CHARACTERS[12].model,'barbarian');assert.equal(charOf(13).label,'Melissa');
  assert.equal(charOf(13).style,'columbus');assert.match(avatarSVG(13),/svg/);
  const model=buildCharacter(13);let curls=0;model.traverse(o=>{if(o.name==='melissa-ringlet')curls++;});
  assert.equal(curls,18);disposeCharacter(model);
  assert.equal(botLine(13,'bidding',()=>0),'This is the worst hand ever');
  assert.equal(botLine(13,'bidding',()=>.21),"I'm so gonna get set.");
});
test('swipes distinguish open/close gestures from taps and vertical scrolling',async()=>{
  const {swipeDirection}=await import('../public/js/table-experience.js');
  assert.equal(swipeDirection(90,20,250),'right');assert.equal(swipeDirection(-90,20,250),'left');
  assert.equal(swipeDirection(10,5,100),null);assert.equal(swipeDirection(80,120,250),null);
  assert.equal(swipeDirection(100,0,1500),null);
});

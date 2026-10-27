'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {spawn}=require('node:child_process'), {io}=require('socket.io-client');
const E=require('../src/engine');
function event(s,type,predicate=()=>true){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(type,on);reject(Error('Timeout: '+type));},5000);
  function on(data){if(predicate(data)){clearTimeout(timer);s.off(type,on);resolve(data);}} s.on(type,on);
});}
test('six-player sockets: safe modes, full hand, private queues, reconnect and takeover',{timeout:30000},async t=>{
  const server=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout')),5000);server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/localhost:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});server.on('error',reject);});
  const clients=[], latest=new Map(); t.after(()=>clients.forEach(s=>s.close()));
  async function connect(){const s=io(url,{transports:['websocket'],forceNew:true});clients.push(s);s.on('state',v=>latest.set(s,v));await event(s,'connect');return s;}
  async function send(s,type,data={},predicate=()=>true){await new Promise(r=>setTimeout(r,20));const p=event(s,'state',predicate);s.emit(type,data);return p.catch(e=>{throw Error(type+': '+e.message);});}
  async function denied(s,type,data,re){const p=event(s,'errorMsg');s.emit(type,data);assert.match(await p,re);}
  const host=await connect();await denied(host,'createRoom',{mode:'highCard5'},/Unsupported/);
  let st=await send(host,'createRoom',{name:'Host',playerId:'h'});const code=st.room.code;
  await send(host,'settings',{allowLowCard:false,botDelayMs:900});
  st=await send(host,'setMode',{mode:'partnership6'});assert.equal(st.room.seats.length,6);assert.equal(st.room.settings.targetScore,300);
  await send(host,'setMode',{mode:'family4'});assert.equal(latest.get(host).room.settings.botDelayMs,900);assert.equal(latest.get(host).room.settings.allowLowCard,false);
  await send(host,'setMode',{mode:'partnership6'});
  await send(host,'sit',{seat:5});await denied(host,'setMode',{mode:'family4'},/earlier seat/);assert.equal(latest.get(host).you.seat,5);
  await send(host,'sit',{seat:0});await send(host,'addBot',{seat:5});await denied(host,'setMode',{mode:'family4'},/bots must be removed/);await send(host,'clearSeat',{seat:5});
  await denied(host,'sit',{seat:6},/Invalid/);await denied(host,'sit',{seat:2.5},/Invalid/);
  const seats=[host];
  for(let i=1;i<6;i++){const s=await connect();st=await send(s,'joinRoom',{code,name:'Player '+i,playerId:'p'+i});assert.equal(st.you.seat,i);seats.push(s);}
  await denied(host,'setMode',{mode:'family4'},/must stand/);await denied(seats[1],'setMode',{mode:'family4'},/host/);
  st=await send(host,'settings',{allowLowCard:true,flipNestCard:true,targetScore:500,minBid:5,rookAnytime:false,botDelayMs:200});
  assert.equal(st.room.settings.allowLowCard,false);assert.equal(st.room.settings.flipNestCard,false);assert.equal(st.room.settings.targetScore,300);assert.equal(st.room.settings.minBid,70);assert.equal(st.room.settings.rookAnytime,true);assert.equal(st.room.settings.botDelayMs,200);
  const spectator=await connect();await send(spectator,'joinRoom',{code,name:'Watcher',playerId:'w'});
  st=await send(host,'start');await denied(host,'setMode',{mode:'family4'},/lobby/);
  assert.deepEqual(st.game.handCounts,[8,8,8,8,8,8]);assert.equal(st.game.nestFaceUp,null);
  // Seat 5 participates in bidding, independent of random dealer.
  while(st.game.turn!==5)st=await send(seats[st.game.turn],'pass');
  st=await send(seats[5],'bid',{amount:120});assert.equal(st.game.hand.length,17);
  for(let i=0;i<5;i++){const v=latest.get(seats[i]).game;assert.equal(v.hand.length,8);assert.equal(v.nest,undefined);assert.equal(v.hands,undefined);assert.equal(v.myDiscard,undefined);}
  const discard=st.game.hand.slice(0,9).map(c=>c.id);
  await denied(seats[5],'discard',{cards:discard,trump:'R',mode:'low'},/Low/);
  await denied(seats[5],'discard',{cards:discard,trump:'R',moon:true},/moon/i);
  st=await send(seats[5],'discard',{cards:discard,trump:'R'});assert.equal(st.game.turn,(st.game.dealer+1)%6);
  // Queue belongs only to its owner and survives reconnect, then cancels cleanly.
  const qSeat=(st.game.turn+1)%6, q=latest.get(seats[qSeat]).game.hand[0].id;
  await send(seats[qSeat],'queuePlay',{card:q});
  for(const s of [...seats,spectator])if(s!==seats[qSeat])assert.equal(latest.get(s).game.queuedCard,null);
  const handBefore=latest.get(seats[qSeat]).game.hand;seats[qSeat].close();
  const reconnect=await connect();st=await send(reconnect,'hello',{code,playerId:qSeat===0?'h':'p'+qSeat});seats[qSeat]=reconnect;
  assert.equal(st.you.seat,qSeat);assert.deepEqual(st.game.hand,handBefore);assert.equal(st.game.queuedCard,q);assert.equal(st.game.mode,'partnership6');await send(reconnect,'queuePlay',{card:null});
  // Every play comes from that player's personalized legal list.
  while(st.game.phase==='playing') {const actor=seats[st.game.turn];const ready=s=>s.game.turn===st.game.turn&&s.game.trickNo===st.game.trickNo&&s.game.trick.length===st.game.trick.length; if(!ready(latest.get(actor)))await event(actor,'state',ready);const v=latest.get(actor).game;st=await send(actor,'play',{card:v.legal[0]});assert.equal(st.game.autoFinish,false);}
  assert.equal(st.game.trickNo,8);assert.equal(st.game.lastTrick.plays.length,6);assert.equal(st.game.recap.points.reduce((a,b)=>a+b),120);
  assert.equal(st.game.history.length,1);assert.deepEqual(st.game.recap.delta,E.computeHandScore(st.game.bid,st.game.recap.points).delta);
  st=await send(seats[0],'nextHand');assert.equal(st.game.phase,'bidding');assert.equal(st.game.handNo,2);
  const currentHost=seats[0];
  const left=event(currentHost,'state',v=>v.room.seats[5]?.type==='bot');seats[5].emit('leave');await left;
  st=await send(spectator,'sit',{seat:5});assert.equal(st.you.seat,5);assert.equal(st.game.hand.length,8);assert.equal(st.game.queuedCard,null);
  st=await send(currentHost,'backToLobby');assert.equal(st.room.seats.length,6);assert.equal(st.room.settings.mode,'partnership6');
  await denied(currentHost,'setMode',{mode:'family4'},/must stand/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {io}=require('socket.io-client');
const E=require('../src/engine');
function event(s,type,predicate=()=>true){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{s.off(type,on);reject(new Error(`Timeout: ${type}`));},5000);
  function on(data){if(predicate(data)){clearTimeout(timer);s.off(type,on);resolve(data);}}
  s.on(type,on);
});}
test('live table: low-card settings, private pre-play execution, chat identity and Melissa', {timeout:25000},async t=>{
  const server=spawn(process.execPath,['src/server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Server startup timeout')),5000);server.once('error',reject);server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/localhost:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
  const clients=[],states=[];
  t.after(()=>clients.forEach(s=>s.close()));
  async function connect(){const s=io(url,{transports:['websocket'],forceNew:true});clients.push(s);await event(s,'connect');return s;}
  const host=await connect();let pending=event(host,'state');
  host.emit('createRoom',{name:'Host',playerId:'h',character:13});let state=await pending;const code=state.room.code;
  pending=event(host,'state',s=>s.room.seats[1]?.character===13);host.emit('addBot',{seat:1,character:13});state=await pending;
  assert.equal(state.room.seats[1].name,'Melissa');
  pending=event(host,'state',s=>s.room.seats[1]===null);host.emit('clearSeat',{seat:1});await pending;
  for(let i=1;i<4;i++){const s=await connect();pending=event(s,'state');s.emit('joinRoom',{code,name:`P${i}`,playerId:`p${i}`});await pending;}
  for(let i=0;i<4;i++)clients[i].on('state',s=>{states[i]=s;});
  const spectator=await connect();pending=event(spectator,'state');spectator.emit('joinRoom',{code,name:'Watcher',playerId:'watcher'});await pending;
  pending=event(spectator,'errorMsg');spectator.emit('settings',{allowLowCard:true});assert.match(await pending,/host/);
  pending=event(host,'state',s=>s.room.settings.allowLowCard);host.emit('settings',{allowLowCard:true,rookAnytime:true});state=await pending;assert.equal(state.room.settings.rookAnytime,false);
  pending=event(host,'state',s=>s.game?.phase==='bidding');host.emit('start');state=await pending;
  const bidder=state.game.turn;pending=event(clients[bidder],'state',s=>s.game?.phase==='nest');clients[bidder].emit('bid',{amount:120});state=await pending;
  const discard=state.game.hand.slice(0,5).map(c=>c.id);
  pending=event(clients[bidder],'state',s=>s.game?.phase==='playing');clients[bidder].emit('discard',{cards:discard,trump:'R',mode:'low',moon:true});state=await pending;
  assert.equal(state.game.playMode,'low');assert.deepEqual(state.game.moon,{seat:bidder,failed:false});
  pending=event(host,'errorMsg');host.emit('settings',{allowLowCard:false});assert.match(await pending,/locked/);
  pending=event(spectator,'errorMsg');spectator.emit('queuePlay',{card:'ROOK'});assert.match(await pending,/pre-play/);
  const next=(bidder+1)%4,lead=state.game.hand[0];
  // Own hands from each human connection; no server-side hidden-card shortcut.
  const mine=states[next].game.hand;
  const queued=E.legalPlays(mine,[{seat:bidder,card:lead}],'R')[0].id;
  pending=event(clients[next],'state',s=>s.game?.queuedCard===queued);clients[next].emit('queuePlay',{card:queued});await pending;
  assert.equal(states[bidder].game.queuedCard,null);
  pending=event(clients[next],'state',s=>s.game?.trick.some(p=>p.seat===next&&p.card.id===queued));clients[bidder].emit('play',{card:lead.id});state=await pending;
  assert.equal(state.game.queuedCard,null);assert.equal(state.game.hand.length,8);
  pending=event(spectator,'state',s=>s.room.chat.some(m=>m.text==='Hello table'));
  clients[next].emit('chat',{text:'Hello table',seat:bidder});state=await pending;
  const msg=state.room.chat.find(m=>m.text==='Hello table');assert.equal(msg.seat,next);assert.ok(msg.id);
  assert.equal('hands' in state.game,false);assert.equal('queued' in state.game,false);assert.equal('_autoPlan' in state.game,false);
});

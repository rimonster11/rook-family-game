const {chromium,webkit}=require('playwright');
const fs=require('fs'),path=require('path');
const E=require('../src/engine');
const base=process.env.ROOK_LAYOUT_URL||'http://localhost:3004';
const out=path.resolve('screenshots/visual-polish',process.env.ROOK_CAPTURE||'after');fs.mkdirSync(out,{recursive:true});
let seed=1587;const random=Math.random;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const room={code:'TEST',hostId:'host',settings:{...E.DEFAULT_SETTINGS,allowLowCard:true},started:true,teams:[{name:'Blue Jays',proposal:null},{name:'Snowbirds',proposal:null}],chat:[],spectators:[],seats:[{type:'human',name:'Riley',character:0,connected:true,isHost:true},{type:'bot',name:'Robin',character:2},{type:'bot',name:'Taylor',character:0},{type:'bot',name:'Jamie',character:3}]};
const g=E.newGame(room.settings,{dealer:3});Math.random=random;g.dealtAt=0;
const wrap=()=>JSON.parse(JSON.stringify({room,you:{seat:0,name:'Riley',playerId:'host',isHost:true},game:E.viewFor(g,0)}));
E.applyBid(g,0,70);E.applyBid(g,1,75);E.applyBid(g,2,80);E.applyPass(g,3);
const fixtures={bidding:wrap()};E.applyBid(g,0,120);fixtures.burying=wrap();E.applyDiscard(g,0,g.hands[0].slice(0,5).map(c=>c.id),'R','high');
for(let i=0;i<3;i++)E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump)[0].id);
fixtures.playing=wrap();E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump)[0].id);fixtures.lastTrick=wrap();
while(g.phase==='playing')E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump)[0].id);fixtures.recap=wrap();
const sizes=[{name:'se',width:375,height:667,top:20,bottom:0},{name:'phone',width:390,height:744,top:47,bottom:34},{name:'max',width:430,height:932,top:59,bottom:34},{name:'toolbar',width:390,height:664,top:47,bottom:34},{name:'landscape',width:844,height:390,top:0,bottom:21,left:47,right:47},{name:'desktop',width:1440,height:900,top:0,bottom:0}];
const adapter=`window.io=()=>{const h={};window.layoutState=s=>h.state(s);return {on:(k,f)=>h[k]=f,emit:()=>{}}};`;
(async()=>{const results=[];for(const engine of (process.env.ROOK_ENGINE||'chromium,webkit').split(',')){
const browser=await ({chromium,webkit}[engine]).launch();try{for(const size of sizes){if(process.env.ROOK_SIZE&&size.name!==process.env.ROOK_SIZE)continue;
const context=await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:size.name!=='desktop',hasTouch:size.name!=='desktop',deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/socket.io/socket.io.js',r=>r.fulfill({contentType:'application/javascript',body:adapter}));await page.goto(base+'/?gfx=low');await page.waitForFunction(()=>!!window.layoutState);
await page.evaluate(async s=>{for(const edge of ['top','bottom','left','right'])document.documentElement.style.setProperty('--table-safe-'+edge,(s[edge]||0)+'px');await document.fonts.ready;},size);
for(const [phase,state] of Object.entries(fixtures)){await page.evaluate(s=>window.layoutState(s),state);if(phase==='recap')await page.waitForSelector('#modal:not(.hidden)');else await page.waitForTimeout(1100);
if(phase==='lastTrick'){await page.locator('#recentTrick').evaluate(e=>e.open=true);await page.waitForTimeout(400);}
await page.waitForFunction(()=>document.querySelector('#tableArea').classList.contains('mode3d')&&document.querySelector('#seat-top').style.transform.includes('translate'));
await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const checks=await page.evaluate(async({phase,size})=>{
const fails=[];const rect=e=>e.getBoundingClientRect();
for(const text of document.querySelectorAll('.card-art text')){const b=text.getBBox();if(b.x<0||b.y<0||b.x+b.width>256||b.y+b.height>360)fails.push('card text clipped');}
const cards=[...document.querySelectorAll(phase==='lastTrick'?'.recent-cards .card':phase==='recap'?'#modalCard .card':'#hand .card')];
for(const c of cards){const r=rect(c);if(phase==='lastTrick'||phase==='recap'||document.querySelector('#hand').classList.contains('nest-grid')){if(Math.abs(r.width/r.height-256/360)>.015)fails.push('card proportions');}if(r.left<0||r.right>innerWidth+.5||r.bottom>innerHeight-(size.bottom||0)+1)fails.push('card outside viewport');}
if(phase==='lastTrick'){const slots=[...document.querySelectorAll('.recent-cards>div')];for(const s of slots){const a=rect(s),b=rect(s.querySelector('.card')),label=rect(s.querySelector('span'));if(Math.abs(a.x+a.width/2-b.x-b.width/2)>1)fails.push('last card not centered');if(Math.abs(a.width-rect(slots[0]).width)>1)fails.push('unequal slots');if(Math.abs(label.x+label.width/2-a.x-a.width/2)>1)fails.push('label not centered');}if(cards.some(c=>Math.abs(rect(c).width-rect(cards[0]).width)>1))fails.push('winner card dimensions');}
if(rect(document.querySelector('#action')).bottom>rect(document.querySelector('.hand-wrap')).top+1)fails.push('controls overlap hand');
if(rect(document.querySelector('.game-top')).top<size.top-1)fails.push('header unsafe');
const {inspectTableLayout}=await import('/js/three3d.js');
const scene=inspectTableLayout?.(document.querySelector('#tableArea canvas'))||[];
for(const seat of scene){
 if(seat.chairClearance<0||seat.torsoClearance<0)fails.push('seating intersects rim');
 if(seat.handsAboveRail<0||seat.cardsAboveRail<0)fails.push('held cards or hands below rail');
 if(seat.projected.some(([x,y])=>Math.abs(x)>1.01||Math.abs(y)>1.01))fails.push('scene clipped');
}
const visibleLabels=[...document.querySelectorAll('.table-area .seat')].filter(e=>e.offsetWidth&&e.offsetHeight);
const overlaps=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
for(let i=0;i<visibleLabels.length;i++)for(let j=i+1;j<visibleLabels.length;j++)if(overlaps(rect(visibleLabels[i]),rect(visibleLabels[j])))fails.push('player labels overlap');
for(const grip of document.querySelectorAll('.panel-grip'))if(grip.offsetWidth)for(const label of visibleLabels)if(overlaps(rect(grip),rect(label)))fails.push('panel control covers player');
if(phase==='lastTrick'){const panel=rect(document.querySelector('#recentTrickCards'));for(const label of visibleLabels)if(overlaps(panel,rect(label)))fails.push('last trick covers player');}
return {fails:[...new Set(fails)],errors:[],cards:cards.length,scene};},{phase,size});checks.errors=[...errors];results.push({engine,size:size.name,phase,...checks});
await page.screenshot({path:path.join(out,`${engine}-${size.name}-${phase}.png`)});console.log(engine,size.name,phase,checks.fails.join(',')||'PASS');
if(phase==='lastTrick')await page.locator('#recentTrick').evaluate(e=>e.open=false);
}
if(size.name==='phone'){
 await page.evaluate(s=>window.layoutState(s),fixtures.bidding);
 for(const height of [664,844,744]){await page.setViewportSize({width:390,height});await page.waitForTimeout(350);
 const fit=await page.evaluate(()=>Math.abs(document.querySelector('#game').getBoundingClientRect().height-visualViewport.height)<1);
 if(!fit)throw Error('Visible viewport resize failed');}
 for(const [top,bottom] of [[0,0],[47,34]]){await page.evaluate(({top,bottom})=>{document.documentElement.style.setProperty('--table-safe-top',top+'px');document.documentElement.style.setProperty('--table-safe-bottom',bottom+'px');},{top,bottom});await page.waitForTimeout(250);
 const fit=await page.evaluate(({top,bottom})=>document.querySelector('.game-top').getBoundingClientRect().top>=top&&document.querySelector('.hand-wrap').getBoundingClientRect().bottom<=innerHeight-bottom+1,{top,bottom});if(!fit)throw Error('Safe area change failed');}
 console.log(engine,'toolbar height and safe area changes PASS');
}
await context.close();}}finally{await browser.close();}}
fs.writeFileSync(path.join(out,process.env.ROOK_SIZE?'results-'+process.env.ROOK_SIZE+'.json':'results.json'),JSON.stringify(results,null,2));if(process.env.ROOK_CAPTURE!=='before'&&results.some(r=>r.fails.length||r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

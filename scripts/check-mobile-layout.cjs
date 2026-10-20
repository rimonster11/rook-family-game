// Run with Playwright available through NODE_PATH (no application dependency).
// Uses real engine views and the shipped UI, with a socket adapter for deterministic phases.
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine');
const base = process.env.ROOK_LAYOUT_URL || 'http://localhost:3004';
const output = path.resolve('screenshots/mobile-layout',process.env.ROOK_LAYOUT_GFX||'low');
fs.mkdirSync(output,{recursive:true});
const room = {code:'TEST',hostId:'host',settings:{...E.DEFAULT_SETTINGS,allowLowCard:true},started:true,
  teams:[{name:'Blue Jays',proposal:null},{name:'Snowbirds',proposal:null}],chat:[],spectators:[],
  seats:[{type:'human',name:'R',character:0,connected:true,isHost:true},{type:'bot',name:'Robin',character:2},{type:'bot',name:'Melissa',character:13},{type:'bot',name:'Melissa',character:13}]};
const g=E.newGame(room.settings,{dealer:3}); g.dealtAt=0;
const wrap=()=>JSON.parse(JSON.stringify({room,you:{seat:0,name:'R',playerId:'host',isHost:true},game:E.viewFor(g,0)}));
const fixtures={bidding:wrap()};
E.applyBid(g,0,120); fixtures.burying=wrap();
E.applyDiscard(g,0,g.hands[0].slice(0,5).map(c=>c.id),'R','low');fixtures.playing=wrap();
while(g.phase==='playing') E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump)[0].id);
fixtures.recap=wrap();
const adapter=`window.__layoutEvents=[];window.io=()=>{const handlers={};window.__layoutState=s=>handlers.state(s);return {on:(n,f)=>{handlers[n]=f;},emit:(n,d)=>window.__layoutEvents.push([n,d])};};`;
const sizes=[
  {name:'compact',width:320,height:568,top:20,bottom:0},
  {name:'se',width:375,height:667,top:20,bottom:0},
  {name:'mini',width:375,height:724,top:50,bottom:34},
  {name:'iphone',width:390,height:844,top:47,bottom:34},
  {name:'pro',width:393,height:852,top:59,bottom:34},
  {name:'max',width:430,height:932,top:59,bottom:34},
  {name:'safari-short',width:390,height:664,top:47,bottom:34},
  {name:'landscape',width:844,height:390,top:0,bottom:21,left:47,right:47},
];
const results=[];
(async()=>{
for(const [engine,type] of Object.entries({chromium,webkit})){
  if(process.env.ROOK_LAYOUT_ENGINE && process.env.ROOK_LAYOUT_ENGINE!==engine)continue;
  const browser=await type.launch({headless:true});
  try{
  for(const size of sizes){
    if(process.env.ROOK_LAYOUT_SIZE && process.env.ROOK_LAYOUT_SIZE!==size.name)continue;
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/socket.io/socket.io.js',r=>r.fulfill({contentType:'application/javascript',body:adapter}));
    await page.goto(base+'/?gfx='+ (process.env.ROOK_LAYOUT_GFX||'low'));
    await page.waitForFunction(()=>!!window.__layoutState);
    await page.evaluate(async({top,bottom,left=0,right=0})=>{for(const [side,value] of Object.entries({top,bottom,left,right}))document.documentElement.style.setProperty('--table-safe-'+side,value+'px');await document.fonts.ready;},size);
    for(const [phase,state] of Object.entries(fixtures)){
      await page.evaluate(st=>window.__layoutState(st),state);
      if(phase==='recap')await page.waitForSelector('#modal:not(.hidden)',{timeout:6000});
      await page.waitForFunction(()=>document.querySelector('#game').classList.contains('mobile-table'));
      await page.waitForFunction(flat=>flat?document.querySelector('#tableArea').classList.contains('mode2d'):(document.querySelector('#tableArea').classList.contains('mode3d')&&document.querySelector('#seat-top').style.transform.includes('translate')),process.env.ROOK_LAYOUT_GFX==='2d');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForTimeout(800);
      const checks=await page.evaluate(({phase,top,bottom})=>{
        const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
        const intersects=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
        const fails=[];
        const header=rect('.game-top'),table=rect('#tableArea'),hand=rect('.hand-wrap'),action=rect('#action'),tools=rect('.mobile-table-tools');
        if(header.y<top-1)fails.push('header enters safe area');
        if(hand.bottom>innerHeight-bottom+1)fails.push('hand below safe viewport');
        if(action.bottom>hand.y+1)fails.push('action overlaps hand');
        const labels=['top','left','right','bottom'].map(p=>rect('#seat-'+p));
        for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(intersects(labels[i],labels[j]))fails.push('player labels overlap');
        for(const label of labels){if(intersects(label,tools))fails.push('tools cover player');if(intersects(label,rect('#mobileReadout')))fails.push('notice covers player');}
        for(const c of document.querySelectorAll('#hand .card')){const r=c.getBoundingClientRect();if(r.x<-.5||r.right>innerWidth+.5||r.bottom>innerHeight-bottom+.5)fails.push('card outside safe viewport');}
        for(const s of ['#scoreboard','#chatGrip','#recentTrick summary',...(phase==='bidding'?['#bidDn','#bidUp','#bidBtn','#passBtn']:phase==='burying'?['#discardBtn','.trumpbtn']:[])])if(rect(s).h<43)fails.push('small tap target '+s);
        if(phase==='recap'){const r=rect('#modalCard');if(r.y<top-1||r.bottom>innerHeight-bottom+1)fails.push('recap outside safe viewport');}
        return {fails:[...new Set(fails)],header,table,action,hand,mode:document.querySelector('#tableArea').className,cardCount:document.querySelectorAll('#hand .card').length};
      },{phase,...size});
      await page.screenshot({path:path.join(output,`${engine}-${size.name}-${phase}.png`)});
      results.push({engine,size:size.name,phase,...checks,errors:[...errors]});
      console.log(engine,size.name,phase,checks.fails.length?checks.fails.join('; '):'PASS',`table=${Math.round(checks.table.h)}px`,checks.mode);
      if(phase==='bidding'){
        await page.click('#bidUp');await page.click('#bidBtn');
        if(!await page.evaluate(()=>window.__layoutEvents.some(e=>e[0]==='bid')))throw Error('Bid interaction failed');
        await page.click('#scoreboard');await page.click('#closeSc');
        await page.click('#chatGrip');
        if(!await page.locator('#drawer').evaluate(e=>e.classList.contains('open')))throw Error('Chat did not open');
        await page.locator('#drawer .drawer-head button').click();
        await page.click('#recentTrick summary');await page.click('#recentTrick summary');
      }
      if(phase==='burying'){
        for(let i=0;i<5;i++)await page.locator('#hand .card').nth(i).click();
        await page.click('[data-trump="R"]');await page.click('#discardBtn');
        const event=await page.evaluate(()=>window.__layoutEvents.find(e=>e[0]==='discard'));
        if(!event||event[1].cards.length!==5)throw Error('Bury interaction failed');
      }
      if(phase==='playing'){
        await page.locator('#hand .card.legal').last().click();
        if(!await page.evaluate(()=>window.__layoutEvents.some(e=>e[0]==='play')))throw Error('Play interaction failed');
      }
      if(phase==='recap'){
        await page.click('#nextHandBtn');
        if(!await page.evaluate(()=>window.__layoutEvents.some(e=>e[0]==='nextHand')))throw Error('Recap interaction failed');
      }
    }
    if(size.name==='iphone'){
      await page.evaluate(st=>window.__layoutState(st),fixtures.bidding);
      for(const height of [664,844]){
        await page.setViewportSize({width:size.width,height});await page.waitForTimeout(400);
        const fit=await page.evaluate(({top,bottom})=>{
          const game=document.querySelector('#game').getBoundingClientRect(), hand=document.querySelector('.hand-wrap').getBoundingClientRect();
          return Math.abs(game.height-visualViewport.height)<1 && hand.bottom<=innerHeight-bottom+1 && document.querySelector('.game-top').getBoundingClientRect().y>=top;
        },size);
        if(!fit)throw Error('Visible-height resize failed at '+height);
      }
      console.log(engine,'same-page height changes 844 -> 664 -> 844 PASS');
    }
    await context.close();
  }
  if(!process.env.ROOK_LAYOUT_SIZE){
    // Desktop is polished too: verify containment instead of freezing old overlay coordinates.
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
    const page=await context.newPage();
    await page.route('**/socket.io/socket.io.js',r=>r.fulfill({contentType:'application/javascript',body:adapter}));
    await page.goto(base+'/?gfx=low');await page.waitForFunction(()=>!!window.__layoutState);
    for(const [phase,state] of Object.entries(fixtures)){
      await page.evaluate(st=>window.__layoutState(st),state);await page.waitForTimeout(900);
      const fit=await page.evaluate(()=>{
        const table=document.querySelector('#tableArea').getBoundingClientRect(),action=document.querySelector('#action').getBoundingClientRect(),hand=document.querySelector('.hand-wrap').getBoundingClientRect();
        return table.height>=100&&table.bottom<=hand.top+1&&(!action.height||(table.bottom<=action.top+1&&action.bottom<=hand.top+1))&&hand.bottom<=innerHeight+1;
      });
      if(!fit)throw Error('Desktop containment failed: '+phase);
    }
    await context.close();console.log(engine,'desktop 1440x900 containment in all four phases PASS');
  }
  }finally{await browser.close();}
}
fs.writeFileSync(path.join(output,process.env.ROOK_LAYOUT_SIZE?'results-'+process.env.ROOK_LAYOUT_SIZE+'.json':'results.json'),JSON.stringify(results,null,2));
if(results.some(r=>r.fails.length||r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

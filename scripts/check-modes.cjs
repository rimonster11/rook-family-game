// Isolated rendered checks: never connects to a running game or a live Socket.IO room.
const { chromium, webkit } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine');
const {simulateGame} = require('../src/sim');
const capture = process.env.ROOK_CAPTURE || 'after';
const baseline = capture === 'before';
const output = path.resolve('screenshots/six-player', capture);
fs.mkdirSync(output, { recursive: true });
const sizes = [
  {name:'phone',width:390,height:844,top:47,bottom:34},
  {name:'landscape',width:844,height:390,top:0,bottom:21,left:47,right:47},
  {name:'desktop',width:1440,height:900,top:0,bottom:0},
];
if(process.env.ROOK_EXTRA_SIZES) sizes.push(
  {name:'android',width:412,height:915,top:24,bottom:24},
  {name:'android-landscape',width:915,height:412,top:0,bottom:24},
  {name:'short-phone',width:390,height:664,top:47,bottom:34},
);
function fixtures(mode, seat) {
  const count = mode === 'partnership6' ? 6 : 4;
  let seed = 1587; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32);
  let g = E.newGame({mode}, {dealer:(seat+count-1)%count,rng}); g.dealtAt = 0;
  const room = {code:'TEST',settings:g.settings,mode,started:true,teams:[{name:'Blue Jays'},{name:'Snowbirds'}],chat:[],spectators:[],
    seats:Array.from({length:count},(_,i)=>({type:i===seat?'human':'bot',name:['Riley','Robin','Taylor','Jamie','Melissa','Morgan'][i],character:[0,2,0,3,13,1][i],connected:true,isHost:i===seat}))};
  const wrap = () => structuredClone({room,you:{seat,name:room.seats[seat].name,playerId:'host',isHost:true},game:E.viewFor(g,seat)});
  const lobby = wrap(); lobby.game = null; lobby.room.started = false;
  const out = {lobby,bidding:wrap()};
  E.applyBid(g,seat,120); out.nest = wrap();
  E.applyDiscard(g,seat,g.hands[seat].slice(0,count===6?9:5).map(c=>c.id),'R');
  for(let i=0;i<count-1;i++)E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump,g.settings)[0].id);
  out.playing=wrap();
  E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump,g.settings)[0].id); out.lastTrick=wrap();
  while(g.phase==='playing')E.applyPlay(g,g.turn,E.legalPlays(g.hands[g.turn],g.trick,g.trump,g.settings)[0].id);
  out.recap=wrap();
  // Actual complete-game outcome, so scorecard and victory evidence are consistent.
  g=simulateGame({mode},rng);g.dealtAt=0;
  out.gameOver=wrap();out.scorecard=out.gameOver;return out;
}
const adapter = `window.io=()=>{const h={};window.layoutState=s=>h.state(s);window.layoutEvents=[];return {on:(k,f)=>h[k]=f,emit:(k,d)=>window.layoutEvents.push([k,d])};};`;
async function main() {
  const server = spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  const results=[];
  try {
    const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server startup timeout')),10000);server.once('error',reject);server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/localhost:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
    for(const engine of (process.env.ROOK_ENGINE||'chromium,webkit').split(',')) {
      let browser=await ({chromium,webkit}[engine]).launch();
      try {
        for(const size of sizes.filter(s=>!process.env.ROOK_SIZE||s.name===process.env.ROOK_SIZE))
        for(const gfx of (process.env.ROOK_GFX||'2d,low,high').split(','))
        for(const mode of (process.env.ROOK_MODE ? [process.env.ROOK_MODE] : baseline?['family4']:['family4','partnership6'])) {
          const count=mode==='partnership6'?6:4;
          for(let seat=0;seat<(baseline?1:count);seat++) {
            if(process.env.ROOK_SEAT!==undefined&&seat!==Number(process.env.ROOK_SEAT))continue;
            const context=await browser.newContext({viewport:size,isMobile:size.name!=='desktop',hasTouch:size.name!=='desktop',deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
            const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
            await page.route('**/socket.io/socket.io.js',r=>r.fulfill({contentType:'application/javascript',body:adapter}));
            // Diagnostic High captures retain the real High renderer/shadows but suppress
            // only automatic FPS downgrading on this software-rendered test machine.
            if(gfx==='high'||engine==='webkit')await page.route('**/js/three3d.js',r=>{
              let source=fs.readFileSync('public/js/three3d.js','utf8');
              if(gfx==='high')source=source.replace('onFps && onFps(frames * 1000 / (now - fpsT))','void 0 /* diagnostic: keep High */');
              // Windows WebKit screenshot compositor may omit an unpreserved WebGL buffer.
              if(engine==='webkit')source=source.replaceAll('{ canvas, antialias:', '{ canvas, preserveDrawingBuffer:true, antialias:');
              return r.fulfill({contentType:'application/javascript',body:source});
            });
            await page.goto(base+'/?gfx='+gfx);await page.waitForFunction(()=>!!window.layoutState);
            await page.evaluate(async s=>{for(const edge of ['top','bottom','left','right'])document.documentElement.style.setProperty('--table-safe-'+edge,(s[edge]||0)+'px');await document.fonts.ready;},size);
            const states=fixtures(mode,seat);
            const phases=seat===0?(process.env.ROOK_PHASES?.split(',')||['lobby','bidding','nest','playing','lastTrick','sidebar','help','recap']):['nest','playing'];
            for(const phase of phases) {
              if(process.env.ROOK_PHASES&&!process.env.ROOK_PHASES.split(',').includes(phase))continue;
              if(baseline&&phase==='help')continue;
              await page.evaluate(st=>window.layoutState(st),states[phase]||states.playing);
              if(['recap','gameOver','scorecard'].includes(phase)) await page.waitForSelector('#modal:not(.hidden)');
              if(phase==='scorecard')await page.locator('#scBtn').click();
              if(phase!=='lobby') {
                await page.waitForFunction(flat=>document.querySelector('#tableArea').classList.contains(flat?'mode2d':'mode3d'),gfx==='2d');
                if(gfx!=='2d')await page.waitForFunction(()=>document.querySelector('#tableArea canvas')?.width>0 && document.querySelector('#seat-top')?.style.transform.includes('translate('));
              }
              if(phase==='lastTrick')await page.locator('#recentTrick').evaluate(e=>e.open=true);
              if(phase==='sidebar'||phase==='help') {
                await page.locator(size.name==='desktop'?'#chatToggle':'#chatGrip').click();
                if(phase==='help')await page.locator('#drawerHelp summary').click();
              }
              if(phase==='lobby'&&!baseline)await page.locator('#lobbyHelp summary').click();
              await page.waitForTimeout(gfx==='2d'?150:650);
              const checks=await page.evaluate(({phase,size,gfx,count,scoreRows})=>{
                const fails=[], rect=e=>e.getBoundingClientRect();
                const visible=e=>e&&e.getClientRects().length&&rect(e).width&&rect(e).height;
                const overlap=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
                if(phase==='lobby') {
                  if(document.querySelectorAll('.lseat').length!==count)fails.push('seat count');
                  if(document.documentElement.scrollWidth>innerWidth+1)fails.push('horizontal overflow');
                } else {
                  const hand=rect(document.querySelector('.hand-wrap')),action=rect(document.querySelector('#action'));
                  if(hand.bottom>innerHeight-(size.bottom||0)+1)fails.push('hand outside safe viewport');
                  if(action.height&&action.bottom>hand.top+1)fails.push('controls overlap hand');
                  const labels=[...document.querySelectorAll('.table-area .seat')].filter(visible);
                  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(overlap(rect(labels[i]),rect(labels[j])))fails.push('labels overlap');
                  for(const e of labels){const r=rect(e);if(r.left<-.5||r.right>innerWidth+.5)fails.push('label outside viewport');}
                  const cards=[...document.querySelectorAll(phase==='lastTrick'?'.recent-cards .card':phase==='recap'?'#modalCard .card':'#hand .card')];
                  for(const c of cards){const r=rect(c);if(r.left<-.5||r.right>innerWidth+.5||r.bottom>innerHeight-(size.bottom||0)+1)fails.push('card outside safe viewport');
                    if((phase==='lastTrick'||phase==='recap'||c.closest('.nest-grid'))&&Math.abs(r.width/r.height-256/360)>.015)fails.push('card proportions');}
                  if(phase==='nest'&&cards.length!==(count===6?17:14))fails.push('nest pickup count');
                  if(phase==='lastTrick'&&cards.length!==count)fails.push('last trick count');
                  if(phase==='help'&&!document.querySelector('#drawerHelp')?.open)fails.push('help closed');
                  if(phase==='gameOver'&&document.querySelectorAll('.go-avas > div').length!==count/2)fails.push('winning team avatars');
                  if(phase==='scorecard'&&document.querySelectorAll('.sc tbody tr').length!==scoreRows)fails.push('score history');
                  for(const text of document.querySelectorAll('.card-art text')){const b=text.getBBox();if(b.x<0||b.y<0||b.x+b.width>256||b.y+b.height>360)fails.push('card art clipped');}
                }
                const actualGraphics=document.querySelector('#gfxSeg .on')?.dataset.gfx;
                if(phase!=='lobby'&&actualGraphics!==gfx)fails.push('graphics fallback: '+actualGraphics);
                return {fails:[...new Set(fails)],actualGraphics,highDiagnostic:gfx==='high',labels:labelsSafe()};
                function labelsSafe(){return [...document.querySelectorAll('.table-area .seat')].filter(visible).map(e=>({id:e.id,x:rect(e).x,y:rect(e).y,w:rect(e).width,h:rect(e).height}));}
              },{phase,size,gfx,count,scoreRows:states[phase]?.game?.history.length});
              const name=`${engine}-${size.name}-${mode}-${gfx}-seat${seat}-${phase}`;
              await page.screenshot({path:path.join(output,name+'.png')});
              if(engine==='webkit'&&gfx!=='2d'&&phase!=='lobby') {
                const capture=await page.locator('#tableArea canvas').evaluate(c=>{
                  const gl=c.getContext('webgl2'),pixel=new Uint8Array(4),colors=new Set();
                  for(let y=1;y<10;y++)for(let x=1;x<10;x++){gl.readPixels(Math.floor(c.width*x/10),Math.floor(c.height*y/10),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);colors.add([...pixel].join(','));}
                  return {png:c.toDataURL('image/png'),colors:colors.size,lost:gl.isContextLost(),error:gl.getError()};
                });
                fs.writeFileSync(path.join(output,name+'.canvas.png'),Buffer.from(capture.png.split(',')[1],'base64'));
                checks.canvasColors=capture.colors;
                if(capture.colors<5||capture.lost||capture.error)checks.fails.push('blank or unhealthy WebGL canvas');
                checks.captureLimitation='Windows WebKit page screenshots may omit WebGL; inspect the separate preserved canvas capture. This is not physical Safari verification.';
              }
              if(!baseline&&phase==='nest') {
                const bury=count===6?9:5;
                if(count===6 && await page.locator('#moonChoice,#playMode').count())checks.fails.push('unsupported family option');
                if(count===4 && await page.locator('#playMode').inputValue()!=='high')checks.fails.push('family initial choice not high');
                for(let i=0;i<bury;i++)await page.locator('#hand .card').nth(i).click();
                await page.locator('[data-trump="R"]').click();
                await page.locator('#discardBtn').click();
                const event=await page.evaluate(()=>window.layoutEvents.filter(e=>e[0]==='discard').at(-1));
                if(!event||event[1].cards.length!==bury||event[1].mode!=='high'||event[1].moon)checks.fails.push('discard interaction');
              }
              if(!baseline && (phase==='help'||phase==='lobby')) {
                const help=await page.locator(phase==='help'?'#drawerHelpBody':'#lobbyHelpBody').textContent();
                if(!help.includes(count===6?'Seats remain fixed':'Family Four'))checks.fails.push('mode help content');
              }
              results.push({name,...checks,errors:[...errors]});
              console.log(name,checks.fails.length||errors.length?JSON.stringify([...checks.fails,...errors]):'PASS');
              if(phase==='lastTrick')await page.locator('#recentTrick').evaluate(e=>e.open=false);
              if(phase==='sidebar'||phase==='help')await page.locator('#closeDrawer').click();
            }
            await context.close();
            // Release software GPU resources between orientations, especially WebKit.
            await browser.close();browser=await ({chromium,webkit}[engine]).launch();
          }
        }
      } finally {await browser.close();}
    }
  } finally {
    server.kill();
    fs.writeFileSync(path.join(output,process.env.ROOK_REPORT||'results.json'),JSON.stringify(results,null,2));
  }
  if(!baseline&&results.some(r=>r.fails.length||r.errors.length))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});

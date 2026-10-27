// Real browser + real sockets on a disposable local server; no live room access.
const { chromium }=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
async function main(){
  const server=spawn(process.execPath,['src/server.js'],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  let browser;
  try {
    const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),10000);server.on('error',reject);server.stdout.on('data',d=>{const m=String(d).match(/http:\/\/localhost:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});});
    browser=await chromium.launch();
    for(const mode of ['family4','partnership6']){
      const count=mode==='family4'?4:6, errors=[];
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url+'/?gfx=2d');await page.locator('#nameInput').fill('Browser Host');
      assert.deepEqual(await page.locator('#createMode option').evaluateAll(es=>es.map(e=>e.value)),['family4','partnership6']);
      await page.locator('#createMode').selectOption(mode);await page.locator('#createBtn').click();
      await page.waitForFunction(n=>document.querySelectorAll('.lseat').length===n,count);
      const code=await page.locator('#lobbyCode').textContent();
      await page.locator('#lobbyHelp summary').click();
      assert.match(await page.locator('#lobbyHelpBody').textContent(),count===6?/Seats remain fixed/:/Family Four/);
      if(count===4){
        await page.locator('details:has(#settingsForm) summary').click();
        assert.equal(await page.locator('#setting-allowLowCard').isChecked(),true);
        assert.equal(await page.locator('#setting-botDelayMs').inputValue(),'2000');
        await page.locator('label.switch:has(#setting-allowLowCard)').click();
        await page.waitForFunction(()=>document.querySelector('#lobbyHelpBody').textContent.includes('Low-card is switched off'));
      }else assert.equal(await page.locator('#settingsForm input').count(),1);
      // A second human prevents mode changes, and standing restores the host control.
      const guestContext=await browser.newContext({serviceWorkers:'block'}), guest=await guestContext.newPage();
      await guest.goto(url+'/?gfx=2d');await guest.locator('#nameInput').fill('Guest');await guest.locator('#codeInput').fill(code);await guest.locator('#joinBtn').click();
      await page.waitForFunction(()=>document.querySelector('#lobbyMode').disabled);
      await guest.locator('[data-stand]').click();await page.waitForFunction(()=>!document.querySelector('#lobbyMode').disabled);
      await guestContext.close();
      await page.locator('#lobbyMode').selectOption(count===4?'partnership6':'family4');
      await page.waitForFunction(n=>document.querySelectorAll('.lseat').length===n,count===4?6:4);
      await page.locator('#lobbyMode').selectOption(mode);await page.waitForFunction(n=>document.querySelectorAll('.lseat').length===n,count);
      if(count===4)assert.equal(await page.locator('#setting-allowLowCard').isChecked(),false);
      await page.locator('#fillBotsBtn').click();await page.waitForFunction(()=>!document.querySelector('#startBtn').disabled);
      assert.equal(await page.locator('#lobbyMode').isDisabled(),true);
      await page.locator('#startBtn').click();await page.waitForSelector('#game:not(.hidden)');
      assert.equal(await page.locator('#tableArea .seat').count(),count);
      const playerId=await page.evaluate(()=>localStorage.getItem('rook.playerId'));
      const ownHand=await page.evaluate(()=>window.__rook.state.game.hand.map(c=>c.id));
      await page.reload();await page.waitForSelector('#game:not(.hidden)');
      assert.equal(await page.evaluate(()=>localStorage.getItem('rook.playerId')),playerId);
      assert.deepEqual(await page.evaluate(()=>window.__rook.state.game.hand.map(c=>c.id)),ownHand);
      assert.equal(await page.evaluate(()=>window.__rook.state.game.mode),mode);
      assert.equal(await page.locator('#tableArea .seat').count(),count);
      await page.locator('#chatGrip').click();await page.locator('#drawerHelp summary').click();
      assert.match(await page.locator('#drawerHelpBody').textContent(),count===6?/Seats remain fixed/:/Low-card is switched off/);
      fs.mkdirSync('screenshots/six-player/flow',{recursive:true});
      await page.screenshot({path:`screenshots/six-player/flow/${mode}-reconnected-help.png`});
      assert.deepEqual(errors,[]);await context.close();console.log(mode+': create, help, seat protection, settings restoration, start and browser reconnect PASS');
    }
  }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

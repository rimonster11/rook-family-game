// Touch gestures only claim deliberate horizontal swipes, preserving vertical scrolling.
export function swipeDirection(dx, dy, elapsed) {
  if (elapsed > 900 || Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return null;
  return dx > 0 ? 'right' : 'left';
}
export function installSwipes({ active, chatOpen, scoreOpen, openChat, closeChat, openScore, closeScore }) {
  let start = null;
  document.addEventListener('pointerdown', e => {
    if (!active() || e.pointerType === 'mouse' || e.target.closest('input,select,textarea,#hand,.sc-wrap')) return;
    const area = e.target.closest('#drawer') ? 'chat' : scoreOpen() && e.target.closest('#modal') ? 'score' :
      e.target.closest('#chatGrip') || e.clientX > innerWidth-28 ? 'chatEdge' :
      e.target.closest('#scoreGrip') || e.clientX < 28 ? 'scoreEdge' : null;
    start = area ? { x:e.clientX,y:e.clientY,t:Date.now(),area,id:e.pointerId } : null;
  }, {passive:true});
  document.addEventListener('pointercancel', () => {start=null;}, {passive:true});
  document.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    const {x,y,t,area}=start; start=null;
    const direction=swipeDirection(e.clientX-x,e.clientY-y,Date.now()-t);
    if (area==='chat' && direction==='right') closeChat();
    if (area==='score' && direction==='left') closeScore();
    if (area==='chatEdge' && direction==='left' && !chatOpen()) openChat();
    if (area==='scoreEdge' && direction==='right' && !scoreOpen()) openScore();
  }, {passive:true});
}

export function animateDeal(container, backHTML, dealer, relPos) {
  container.querySelector('.deal-sequence')?.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer=document.createElement('div');layer.className='deal-sequence';layer.setAttribute('aria-hidden','true');
  const w=container.clientWidth,h=container.clientHeight;
  const dest={bottom:[0,h*.37],top:[0,-h*.34],left:[-w*.36,0],right:[w*.36,0],nest:[0,0]};
  layer.innerHTML=`<div class="shuffle-stack">${backHTML('xs')}${backHTML('xs')}${backHTML('xs')}<b>Shuffling…</b></div>`+
    Array.from({length:41},(_,i)=>{const pos=i<36?relPos((dealer+1+i)%4):'nest';const [x,y]=dest[pos];return `<div class="deal-flight" style="--dx:${x}px;--dy:${y}px;--delay:${700+i*32}ms">${backHTML('xs')}</div>`;}).join('');
  container.append(layer);setTimeout(()=>layer.remove(),2600);
}

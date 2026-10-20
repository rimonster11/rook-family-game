export const mobileTableQuery = '(max-width: 640px), (max-height: 500px) and (pointer: coarse)';

export function installMobileTable(onResize) {
  const media = matchMedia(mobileTableQuery);
  const root = document.documentElement;
  const readout = document.getElementById('mobileReadout');
  const notices = ['banner', 'trumpBadge', 'status'].map(id => {
    const node = document.getElementById(id), marker = document.createComment(id+' desktop position');
    node.before(marker); return {node, marker};
  });
  let frame = 0;
  function update() {
    frame = 0;
    const viewport = window.visualViewport;
    // Preserve pinch zoom; only follow browser chrome/keyboard viewport changes.
    if (!viewport || Math.abs(viewport.scale - 1) < .01) {
      root.style.setProperty('--table-viewport-height', `${viewport?.height || innerHeight}px`);
      root.style.setProperty('--table-viewport-top', `${viewport?.offsetTop || 0}px`);
    }
    document.getElementById('game').classList.toggle('mobile-table', media.matches);
    for (const {node,marker} of notices) {
      if (media.matches && node.parentNode !== readout) readout.append(node);
      else if (!media.matches && node.parentNode === readout) marker.after(node);
    }
    onResize();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  media.addEventListener('change', schedule);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  update();
}

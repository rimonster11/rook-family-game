export const mobileTableQuery = '(max-width: 640px), (max-height: 500px) and (pointer: coarse)';

export function installMobileTable(onResize) {
  const media = matchMedia(mobileTableQuery);
  const root = document.documentElement;
  let frame = 0;
  function update() {
    frame = 0;
    const viewport = window.visualViewport;
    // Preserve pinch zoom; only follow browser chrome/keyboard viewport changes.
    if (!viewport || Math.abs(viewport.scale - 1) < .01) {
      root.style.setProperty('--table-viewport-height', `${viewport?.height || innerHeight}px`);
      root.style.setProperty('--table-viewport-top', `${viewport?.offsetTop || 0}px`);
    }
    // Notices stay inside the table area; phone CSS docks them as pills along its bottom edge.
    document.getElementById('game').classList.toggle('mobile-table', media.matches);
    onResize();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  media.addEventListener('change', schedule);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  update();
}

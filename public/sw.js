// Rook Night service worker: network-first for the app shell, cache fallback for offline launch.
const CACHE = 'rook-v13-partnership-six';
const SHELL = ['/modes.css', '/js/game-modes.js', '/js/table-layout.js', '/js/rules-help.js', '/', '/index.html', '/style.css', '/game-art.css', '/table-play.css', '/clubhouse.css', '/mobile-table.css', '/js/mobile-table.js', '/js/table-experience.js', '/fonts/LilitaOne-Regular.ttf', '/fonts/Nunito-Variable.ttf', '/js/app.js', '/js/art.js', '/js/card-design.js', '/js/style-options.js', '/js/hand-progress.js', '/js/three3d.js', '/js/characters.js', '/js/model-characters.js', '/vendor/GLTFLoader.js', '/vendor/BufferGeometryUtils.js', '/models/barbarian/portrait.png', '/js/ui-art.js', '/vendor/three.module.min.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/socket.io') || u.pathname === '/healthz') return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('/index.html'))));
});

// Service worker：App 本體與劇本先抓網路（有更新馬上看到），離線時用快取；音檔抓過就留在快取，離線可播。
const VERSION = 'v4';
const SHELL = `shell-${VERSION}`;
const CONTENT = 'content';
const AUDIO = 'audio';
const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'app/styles.css', 'app/main.js', 'app/state.js', 'app/ui.js',
  'app/lib/audio.js', 'app/lib/cards.js', 'app/lib/db.js', 'app/lib/fsrs.js', 'app/lib/ruby.js', 'app/lib/schedule.js', 'app/lib/srs.js', 'app/lib/network.js',
  'app/views/home.js', 'app/views/episode.js', 'app/views/review.js', 'app/views/drill.js', 'app/views/library.js',
  'app/views/jlpt.js', 'app/views/settings.js', 'app/views/quick.js', 'app/icons/icon.svg', 'app/icons/icon2-192.png', 'app/icons/apple-touch-icon2.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: 'no-cache' });  // 跟伺服器確認是否有新版（ETag），避免瀏覽器 10 分鐘快取
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function cacheFirst(req, cacheName, revalidate) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const update = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) {
    if (revalidate) update.catch(() => null);
    return hit;
  }
  const res = await update;
  return res || new Response('', { status: 504 });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) {
    if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) e.respondWith(cacheFirst(e.request, CONTENT, false));
    return;
  }
  const path = url.pathname;
  if (path.includes('/audio/') && path.endsWith('.mp3')) e.respondWith(cacheFirst(e.request, AUDIO, false));
  else if (path.includes('/audio/') || path.includes('/scripts/') || path.includes('/story/')) e.respondWith(networkFirst(e.request, CONTENT));
  else e.respondWith(networkFirst(e.request, SHELL));
});

const CACHE = 'margin-calc-v7';
const STATIC = [
  '/', '/guide/', '/platforms/', '/tools/', '/dashboard/', '/privacy/', '/terms/',
  '/css/main.css', '/css/shared-nav.css',
  '/js/calculator.js', '/js/features.js', '/js/shared-nav.js',
  '/js/translations.js', '/js/language.js',
  '/manifest.json', '/favicon.ico', '/favicon.svg',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og-image.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(STATIC.map(url => c.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Skip: cross-origin, analytics, ads
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/cdn-cgi/')) return;
  // /api/ 는 캐시하지 않는다 — 환율 등 동적 데이터이고,
  // 서버(KV)에서 이미 캐싱하므로 여기서 또 잡으면 낡은 값이 고착된다.
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
      return cached ?? network;
    })
  );
});

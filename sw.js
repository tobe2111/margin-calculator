const CACHE = 'margin-calc-v3';
const STATIC = [
  '/', '/guide/', '/platforms/', '/tools/',
  '/css/shared-nav.css', '/css/design-updates.css', '/css/style.css',
  '/js/calculator.js', '/js/features.js', '/js/shared-nav.js',
  '/js/translations.js', '/js/language.js',
  '/manifest.json', '/favicon.ico', '/favicon.svg'
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
  // Skip: cross-origin, API calls, analytics, ads
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/cdn-cgi/')) return;

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

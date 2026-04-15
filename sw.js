// Service Worker - 유어팀 마진 계산기
const CACHE_NAME = 'urteam-margin-v1';
const STATIC_ASSETS = [
    '/',
    '/platforms/',
    '/tools/',
    '/market/',
    '/guide/',
    '/tools/fba/',
    '/tools/bulk/',
    '/tools/roas/',
    '/tools/breakeven/',
    '/guide/glossary/',
    '/guide/calendar/',
    '/market/us/',
    '/market/jp/',
    '/market/sea/',
    '/css/shared-nav.css',
    '/css/features.css',
    '/js/shared-nav.js',
    '/js/features.js',
    '/js/calculator.js',
    '/favicon.svg',
    '/manifest.json',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Only handle GET requests for same-origin or CDN assets
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    // Pass through exchange rate API calls (always need fresh data)
    if (url.hostname === 'open.er-api.com') return;
    // Cache-first for static assets, network-first for HTML
    const isHTML = e.request.headers.get('accept')?.includes('text/html');
    if (isHTML) {
        e.respondWith(
            fetch(e.request).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                return res;
            }).catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            }))
        );
    }
});

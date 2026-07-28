const CACHE = 'margin-calc-v8';

// 오프라인 대비로 미리 담아두는 정적 자산.
// HTML 문서는 여기 넣지 않는다 — 아래 fetch 전략에서 항상 네트워크를 먼저 보기 때문.
const STATIC = [
  '/css/main.css', '/css/shared-nav.css',
  '/js/calculator.js', '/js/features.js', '/js/shared-nav.js',
  '/js/translations.js', '/js/language.js',
  '/manifest.json', '/favicon.ico', '/favicon.svg',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og-image.png'
];

// 오프라인일 때 문서 요청에 되돌려줄 최소 페이지
const OFFLINE_DOC = '/';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(
        STATIC.concat([OFFLINE_DOC]).map(url => c.add(url).catch(() => {}))
      )
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isDoc = (req) =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // 외부 CDN·광고·분석
  if (url.pathname.startsWith('/cdn-cgi/')) return;
  if (url.pathname.startsWith('/api/')) return;         // 동적 데이터. 서버에서 캐싱한다

  // HTML 문서: 네트워크 우선.
  //
  // 예전에는 문서에도 캐시 우선(cached ?? network)을 써서, 한 번 방문한
  // 사용자가 배포 후에도 낡은 페이지에 고착됐다. 새 CSS·JS와 옛 HTML이
  // 섞이면 화면이 깨진 채로 남는다. 문서는 항상 새로 받고, 네트워크가
  // 안 될 때만 캐시로 되돌린다.
  if (isDoc(req)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit => hit || caches.match(OFFLINE_DOC))
        )
    );
    return;
  }

  // 정적 자산: 캐시 우선 + 뒤에서 갱신 (stale-while-revalidate)
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

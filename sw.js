/* Triton Glideslope — service worker
   Bump CACHE_VERSION whenever you deploy changes so clients
   pick up the new files instead of serving stale ones. */
const CACHE_VERSION = 'glideslope-v68';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './intro.mp4',
  './poster.jpg',
  './moon.JPG',
  './moon.MP4'
];

// Install: pre-cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: drop any old cache versions
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app assets, network fallback.
// Google Fonts (cross-origin) are cached on first successful fetch.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // NETWORK-FIRST for the data feed: always try the live file so the data
  // manager's commits reach every recruiter. Fall back to cache only if offline.
  if (url.origin === location.origin && /\/data\.json(\?.*)?$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request, {cache:'no-store'})
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))   // offline → last good copy
    );
    return;
  }

  // NETWORK-FIRST for the HTML shell so a fresh deploy reaches every device on
  // the next load. Short timeout + cache fallback keeps it fast / offline-safe.
  if (e.request.mode === 'navigate' ||
      (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const fallback = () => caches.match(e.request)
          .then((c) => c || caches.match('./index.html'))
          .then((c) => c || caches.match('./'))
          .then((c) => c || fetch(e.request));
        const timer = setTimeout(() => { if (!settled) { settled = true; resolve(fallback()); } }, 3500);
        fetch(e.request).then((res) => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          }
          resolve(res);
        }).catch(() => { if (!settled) { settled = true; clearTimeout(timer); resolve(fallback()); } });
      })
    );
    return;
  }

  // CACHE-FIRST for the app shell & assets (instant load, offline-capable)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          const cacheable =
            url.origin === location.origin ||
            url.hostname.includes('fonts.googleapis.com') ||
            url.hostname.includes('fonts.gstatic.com');
          if (cacheable && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

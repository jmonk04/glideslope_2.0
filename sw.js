/* Triton Glideslope — service worker
   Bump CACHE_VERSION whenever you deploy changes so clients
   pick up the new files instead of serving stale ones. */
const CACHE_VERSION = 'glideslope-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './intro.mp4',
  './poster.jpg'
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
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          // cache same-origin and font responses for offline reuse
          const url = new URL(e.request.url);
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
        .catch(() => cached); // offline & uncached → undefined, browser handles
    })
  );
});

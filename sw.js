const CACHE_NAME = 'oslo-trip-v28';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'data.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/voi.png',
  'icons/uber.png',
  'icons/ruter.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Let Google Maps API requests go straight to network
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('google.com')) {
    return;
  }

  // Network-first for app assets (always get latest when online, cache fallback for offline)
  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

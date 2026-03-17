// Minimal service worker for PWA
const CACHE_NAME = 'walkie-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/app.js',
  '/src/ws-client.js',
  '/src/qr-scanner.js',
  '/src/ui.js',
  '/src/styles.css',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

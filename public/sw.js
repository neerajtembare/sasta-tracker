// Sasta Tracker — Offline Service Worker
const CACHE_NAME = 'sasta-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// Install event: cache core shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW pre-cache error (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up stale older caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first for navigation, cache-first with network fallback for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip map tile requests from service worker interception to preserve leaflet tile caching
  if (
    url.hostname.includes('tile') ||
    url.hostname.includes('cartocdn') ||
    url.hostname.includes('arcgisonline')
  ) {
    return;
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return cached asset, fetch in background to revalidate (Stale-While-Revalidate)
        fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (url.origin === location.origin || url.hostname.includes('unpkg.com'))
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and navigating, return cached root/index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

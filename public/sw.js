// ThrottleLog — Offline Service Worker with Map Tile Caching
const CACHE_NAME = 'throttlelog-v6';
const TILE_CACHE_NAME = 'throttlelog-map-tiles-v3';
const MAX_TILES = 1500;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// Helper to determine if a URL is a map tile
function isMapTileUrl(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    (url.pathname.endsWith('.png') && (url.pathname.includes('/tile/') || url.pathname.includes('/rastertiles/')))
  );
}

// Promise-locked eviction so concurrent tile fetches never race cache deletions
let trimPromise = null;
function trimTileCache() {
  if (trimPromise) return trimPromise;
  trimPromise = (async () => {
    try {
      const cache = await caches.open(TILE_CACHE_NAME);
      const keys = await cache.keys();
      if (keys.length > MAX_TILES) {
        const deleteCount = keys.length - MAX_TILES + 100;
        for (let i = 0; i < deleteCount; i++) {
          await cache.delete(keys[i]);
        }
      }
    } catch {
      // Non-fatal cache eviction error
    } finally {
      trimPromise = null;
    }
  })();
  return trimPromise;
}

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

// Activate event: clean up stale older caches (keeping tile cache intact)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== TILE_CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Listen for messages from client
self.addEventListener('message', event => {
  if (event.data?.type === 'CLEAR_TILE_CACHE') {
    event.waitUntil(
      caches.delete(TILE_CACHE_NAME).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
    );
  } else if (event.data?.type === 'GET_TILE_CACHE_COUNT') {
    event.waitUntil(
      caches.open(TILE_CACHE_NAME).then(cache => cache.keys()).then(keys => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ count: keys.length });
        }
      })
    );
  }
});

let tileFetchCounter = 0;

// Fetch event
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Never intercept serverless API calls or telemetry endpoints
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // 1. Map Tile Requests: Cache-First strategy with automatic offline fallback
  if (isMapTileUrl(url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async cache => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            tileFetchCounter++;
            if (tileFetchCounter % 50 === 0) {
              trimTileCache();
            }
          }
          return networkResponse;
        } catch {
          // If offline and not in cache, fallback gracefully
          return cachedResponse || new Response('', { status: 408, statusText: 'Tile Offline' });
        }
      })
    );
    return;
  }

  // 2. HTML Navigations / App Shell entry: Network-First to prevent stale hashed bundle white-screens
  const isHtmlNavigation =
    event.request.mode === 'navigate' ||
    (url.origin === location.origin && (url.pathname === '/' || url.pathname === '/index.html'));

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put('/index.html', clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;
          const cachedShell = await caches.match('/index.html');
          return cachedShell || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate (hashed JS/CSS/fonts/icons)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(event.request)
          .then(networkResponse => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (url.origin === location.origin || url.hostname.includes('unpkg.com'))
            ) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse).catch(() => {});
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
              cache.put(event.request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => new Response('Offline', { status: 503, statusText: 'Offline' }));
    })
  );
});

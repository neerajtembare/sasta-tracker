// Sasta Tracker — Offline Service Worker with Map Tile Caching
const CACHE_NAME = 'sasta-tracker-v3';
const TILE_CACHE_NAME = 'sasta-map-tiles-v2';
const MAX_TILES = 1500;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// Helper to determine if a URL is a map tile
function isMapTileUrl(url) {
  return (
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('arcgisonline.com') ||
    url.pathname.endsWith('.png') && (url.pathname.includes('/tile/') || url.pathname.includes('/rastertiles/'))
  );
}

// Clean up oldest tiles if cache exceeds MAX_TILES
async function trimTileCache() {
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > MAX_TILES) {
      const deleteCount = keys.length - MAX_TILES + 100;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (err) {
    // Non-fatal cache eviction error
  }
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
  const url = new URL(event.request.url);

  // 1. Map Tile Requests: Cache-First strategy with automatic offline fallback
  if (isMapTileUrl(url)) {
    if (event.request.method !== 'GET') return;

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
        } catch (networkErr) {
          // If offline and not in cache, fallback gracefully
          return cachedResponse || new Response('', { status: 408, statusText: 'Tile Offline' });
        }
      })
    );
    return;
  }

  // Only handle GET requests for normal assets
  if (event.request.method !== 'GET') return;

  // 2. Static Assets & App Shell: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
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
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// Sasta Tracker — Map Tile Pre-caching Utility for Mountain Passes & Zero-Signal Areas

export interface LatLngBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface CacheProgress {
  cached: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  error?: string;
}

export const TILE_CACHE_NAME = 'sasta-map-tiles-v2';

// Convert lat/lng to Slippy Map tile coordinates { x, y } at given zoom
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

// Generate tile URLs covering bounds across zoom levels
export function getTileUrlsForBounds(
  bounds: LatLngBounds,
  minZoom = 12,
  maxZoom = 14,
  style: 'dark' | 'street' | 'osm' = 'dark'
): string[] {
  const urls: string[] = [];
  const subdomains = ['a', 'b', 'c', 'd'];

  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = latLngToTile(bounds.maxLat, bounds.minLng, z);
    const se = latLngToTile(bounds.minLat, bounds.maxLng, z);

    const minX = Math.min(nw.x, se.x);
    const maxX = Math.max(nw.x, se.x);
    const minY = Math.min(nw.y, se.y);
    const maxY = Math.max(nw.y, se.y);

    // Limit each zoom level to 120 tiles max to protect data and battery
    const tileCountZ = (maxX - minX + 1) * (maxY - minY + 1);
    if (tileCountZ > 120) continue;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const sub = subdomains[(x + y) % subdomains.length];
        let url = '';
        if (style === 'dark') {
          url = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
        } else {
          url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        }
        urls.push(url);
      }
    }
  }

  // Deduplicate and cap at 250 tiles per download batch
  return Array.from(new Set(urls)).slice(0, 250);
}

// Pre-cache tiles with progress callback and concurrency limiting
export async function preCacheRouteTiles(
  bounds: LatLngBounds,
  style: 'dark' | 'street' | 'osm' = 'dark',
  onProgress?: (progress: CacheProgress) => void
): Promise<{ cached: number; total: number }> {
  const urls = getTileUrlsForBounds(bounds, 12, 14, style);
  const total = urls.length;

  if (total === 0) {
    onProgress?.({ cached: 0, total: 0, percentage: 100, isComplete: true });
    return { cached: 0, total: 0 };
  }

  let cached = 0;
  const concurrency = 4;
  const queue = [...urls];

  const fetchWorker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      try {
        // Fetching through the browser will trigger sw.js to put it in sasta-map-tiles-v1
        await fetch(url, { mode: 'no-cors' });
        cached++;
        const percentage = Math.round((cached / total) * 100);
        onProgress?.({
          cached,
          total,
          percentage,
          isComplete: cached === total,
        });
      } catch (err) {
        // Continue on individual tile failure
      }
    }
  };

  const workers = Array.from({ length: concurrency }, () => fetchWorker());
  await Promise.all(workers);

  onProgress?.({
    cached,
    total,
    percentage: 100,
    isComplete: true,
  });

  return { cached, total };
}

// Get the count of offline cached map tiles
export async function getOfflineTileCount(): Promise<number> {
  if (!('caches' in window)) return 0;
  try {
    const cache = await caches.open(TILE_CACHE_NAME);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

// Clear offline map tile cache to reclaim storage
export async function clearOfflineTileCache(): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    return await caches.delete(TILE_CACHE_NAME);
  } catch {
    return false;
  }
}

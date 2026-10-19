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
  sizeMb?: string;
}

export const TILE_CACHE_NAME = 'sasta-map-tiles-v2';

/**
 * Bounds covering Pune City, Mulshi, Lavasa, Khadakwasla, Sinhagad,
 * Lonavala, Khandala, and Tamhini Ghat.
 */
export const PUNE_GHATS_BOUNDS: LatLngBounds = {
  minLat: 18.20, // South of Sinhagad & Panshet
  maxLat: 18.82, // North of Lonavala & Talegaon
  minLng: 73.35, // West of Tamhini Ghat & Mulshi
  maxLng: 74.05, // East of Hadapsar & Wagholi
};

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
  minZoom = 11,
  maxZoom = 14
): string[] {
  const urls: string[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const nw = latLngToTile(bounds.maxLat, bounds.minLng, z);
    const se = latLngToTile(bounds.minLat, bounds.maxLng, z);

    const minX = Math.min(nw.x, se.x);
    const maxX = Math.max(nw.x, se.x);
    const minY = Math.min(nw.y, se.y);
    const maxY = Math.max(nw.y, se.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        // Use reliable 100% free OSM tiles
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }

  // Deduplicate and cap at 900 tiles for practical phone storage (~25 MB)
  return Array.from(new Set(urls)).slice(0, 900);
}

// Calculate LatLngBounds for a given center coordinate and radius in kilometers
export function getBoundsForRadius(lat: number, lon: number, radiusKm: number = 25): LatLngBounds {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lon - lonDelta,
    maxLng: lon + lonDelta,
  };
}

// Pre-cache tiles with progress callback and concurrency limiting
export async function preCacheRouteTiles(
  bounds: LatLngBounds,
  minZoom = 11,
  maxZoom = 14,
  onProgress?: (progress: CacheProgress) => void
): Promise<{ cached: number; total: number }> {
  const urls = getTileUrlsForBounds(bounds, minZoom, maxZoom);
  const total = urls.length;

  if (total === 0) {
    onProgress?.({ cached: 0, total: 0, percentage: 100, isComplete: true, sizeMb: '0.0 MB' });
    return { cached: 0, total: 0 };
  }

  let cache: Cache | null = null;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      cache = await caches.open(TILE_CACHE_NAME);
    } catch {}
  }

  let cached = 0;
  const concurrency = 6;
  const queue = [...urls];

  const fetchWorker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      try {
        // Check if already in cache first
        if (cache) {
          const match = await cache.match(url);
          if (match) {
            cached++;
            const pct = Math.round((cached / total) * 100);
            onProgress?.({
              cached,
              total,
              percentage: pct,
              isComplete: cached === total,
              sizeMb: `${((cached * 25) / 1024).toFixed(1)} MB`,
            });
            continue;
          }
        }

        // Standard CORS fetch
        const resp = await fetch(url);
        if (cache && resp && resp.status === 200) {
          try {
            await cache.put(url, resp);
          } catch {}
        }
        cached++;
        const percentage = Math.round((cached / total) * 100);
        onProgress?.({
          cached,
          total,
          percentage,
          isComplete: cached === total,
          sizeMb: `${((cached * 25) / 1024).toFixed(1)} MB`,
        });
      } catch {
        // Non-fatal, continue with remaining tiles
        cached++;
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
    sizeMb: `${((cached * 25) / 1024).toFixed(1)} MB`,
  });

  return { cached, total };
}

/**
 * 1-Tap Download for Pune City & Western Ghats (Mulshi, Lavasa, Lonavala, Tamhini)
 */
export async function downloadPuneOfflineMap(
  onProgress?: (progress: CacheProgress) => void
): Promise<{ cached: number; total: number }> {
  return preCacheRouteTiles(PUNE_GHATS_BOUNDS, 11, 14, onProgress);
}

// Pre-cache regional area for spontaneous unmapped rides into mountain valleys
export async function preCacheRegionalArea(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 25,
  onProgress?: (progress: CacheProgress) => void
): Promise<{ cached: number; total: number }> {
  const bounds = getBoundsForRadius(centerLat, centerLng, radiusKm);
  return preCacheRouteTiles(bounds, 11, 14, onProgress);
}

// Get the count of offline cached map tiles
export async function getOfflineTileCount(): Promise<number> {
  if (typeof window === 'undefined' || !('caches' in window)) return 0;
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
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    return await caches.delete(TILE_CACHE_NAME);
  } catch {
    return false;
  }
}

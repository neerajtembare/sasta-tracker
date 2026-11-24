/**
 * Google Maps Link & Text Parser
 * Extracts destination coordinates, place names, and addresses from Google Maps shared URLs,
 * geo: URIs, lat/lon coordinate strings, and shared WhatsApp/Android intent text.
 */

export interface ParsedDestination {
  name: string;
  lat: number;
  lon: number;
  sourceUrl?: string;
  rawText?: string;
}

// Coordinate regex: e.g. 18.52043, 73.85674 (minimum 2 decimal digits to avoid version/number false positives)
const COORD_REGEX = /(-?\d{1,2}\.\d{2,15})[\s,]+(-?\d{1,3}\.\d{2,15})/;

// Google Maps URL coordinate patterns ordered by exact destination specificity
// CRITICAL: Pin formats (!3d!4d, destination=, ?q=) MUST precede /@lat,lon (which is often only the viewport center!)
const GMAPS_PATTERNS = [
  // 1. !3dlat!4dlon (Exact place pin coordinates inside Google Maps /place/... URLs)
  /!3d(-?\d{1,2}\.\d{2,15})!4d(-?\d{1,3}\.\d{2,15})/,
  // 2. destination=lat,lon or destination=lat%2Clon
  /destination=(-?\d{1,2}\.\d{2,15})(?:,|%2C|\+)(-?\d{1,3}\.\d{2,15})/i,
  // 3. query=lat,lon or q=lat,lon or ll=lat,lon
  /(?:query|q|ll)=(-?\d{1,2}\.\d{2,15})(?:,|%2C|\+)(-?\d{1,3}\.\d{2,15})/i,
  // 4. loc:lat,lon
  /loc:(-?\d{1,2}\.\d{2,15})\+(-?\d{1,3}\.\d{2,15})/i,
  // 5. geo:lat,lon (direct geo URI coordinates)
  /geo:(-?\d{1,2}\.\d{2,15}),(-?\d{1,3}\.\d{2,15})/i,
  // 6. /@lat,lon,zoom (Viewport center fallback when exact pin pattern isn't present)
  /@(-?\d{1,2}\.\d{2,15}),(-?\d{1,3}\.\d{2,15})/,
];

/**
 * Clean place name from Google Maps URL path or query parameters
 * e.g. /place/Lonavala+Tiger+Point/@... -> "Lonavala Tiger Point"
 * e.g. geo:0,0?q=18.5204,73.8567(Tiger+Point) -> "Tiger Point"
 */
function extractPlaceNameFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const pathname = decodeURIComponent(url.pathname);
    
    // Check /place/Place+Name/
    const placeMatch = pathname.match(/\/place\/([^\/@]+)/);
    if (placeMatch && placeMatch[1]) {
      return placeMatch[1].replace(/\+/g, ' ').trim();
    }

    // Check /dir/.../Destination/
    const dirMatch = pathname.match(/\/dir\/.*\/([^\/@]+)/);
    if (dirMatch && dirMatch[1]) {
      return dirMatch[1].replace(/\+/g, ' ').trim();
    }

    // Check ?q=lat,lon(Place Name) or ?q=Place+Name
    const q = url.searchParams.get('q') || url.searchParams.get('query');
    if (q) {
      const parenMatch = q.match(/\(([^)]+)\)/);
      if (parenMatch && parenMatch[1]) {
        return parenMatch[1].replace(/\+/g, ' ').trim();
      }
      if (!COORD_REGEX.test(q)) {
        return q.replace(/\+/g, ' ').trim();
      }
    }
  } catch {}
  return null;
}

/**
 * Extracts a candidate place title from shared text preceding the URL
 * e.g. "Tiger Point, Lonavala\nhttps://maps.app.goo.gl/..."
 */
function extractTitleFromText(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith('http://') && !line.startsWith('https://') && !line.startsWith('geo:')) {
      const clean = line.replace(/Shared via Google Maps|Check out this location on Google Maps|Shared location/gi, '').trim();
      if (clean.length > 2 && clean.length < 80) {
        return clean;
      }
    }
  }
  return null;
}

/**
 * Find first HTTP/HTTPS/GEO URL in string
 */
export function extractUrlFromText(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+|geo:[^\s]+)/i);
  return match ? match[1] : null;
}

/**
 * Synchronously parses Google Maps text or URL if coordinates are directly embedded.
 */
export function parseGoogleMapsCoordinates(input: string): ParsedDestination | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim();

  let foundLat: number | null = null;
  let foundLon: number | null = null;

  // 1. Try URL patterns
  for (const pattern of GMAPS_PATTERNS) {
    const match = raw.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (isValidCoord(lat, lon)) {
        foundLat = lat;
        foundLon = lon;
        break;
      }
    }
  }

  // 2. Try raw coordinate regex
  if (foundLat === null) {
    const coordMatch = raw.match(COORD_REGEX);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (isValidCoord(lat, lon)) {
        foundLat = lat;
        foundLon = lon;
      }
    }
  }

  if (foundLat === null || foundLon === null) {
    return null;
  }

  const url = extractUrlFromText(raw);
  const nameFromUrl = url ? extractPlaceNameFromUrl(url) : null;
  const nameFromText = extractTitleFromText(raw);
  const finalName = nameFromText || nameFromUrl || `Destination (${foundLat.toFixed(4)}, ${foundLon.toFixed(4)})`;

  return {
    name: finalName,
    lat: foundLat,
    lon: foundLon,
    sourceUrl: url || undefined,
    rawText: raw,
  };
}

/**
 * Geocodes a place name to coordinates using OpenStreetMap Nominatim
 */
export async function geocodePlaceName(query: string): Promise<ParsedDestination | null> {
  if (!query || query.trim().length < 2) return null;
  const clean = query.trim();
  try {
    const encoded = encodeURIComponent(clean);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ThrottleLog-Motorcycle-Tracker/1.0',
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      if (isValidCoord(lat, lon)) {
        return {
          name: item.display_name?.split(',')[0] || clean,
          lat,
          lon,
          rawText: clean,
        };
      }
    }
  } catch (e) {
    console.warn('Geocoding failed:', e);
  }
  return null;
}

/**
 * Async resolver for short URLs (e.g. maps.app.goo.gl or goo.gl/maps).
 * Uses native bridge if on Android Capacitor, or fallback fetch / place geocoding.
 */
export async function resolveGoogleMapsDestination(
  input: string,
  nativeUnshorten?: (shortUrl: string) => Promise<{ resolvedUrl: string }>
): Promise<ParsedDestination | null> {
  if (!input || !input.trim()) return null;

  // 1. First attempt instant local parse
  const instant = parseGoogleMapsCoordinates(input);
  if (instant) return instant;

  const url = extractUrlFromText(input);
  const titleFromText = extractTitleFromText(input);

  // 2. If short URL, attempt unshortening via native plugin or redirect
  if (url && (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps'))) {
    if (nativeUnshorten) {
      try {
        const res = await nativeUnshorten(url);
        if (res && res.resolvedUrl) {
          const parsed = parseGoogleMapsCoordinates(res.resolvedUrl);
          if (parsed) {
            if (titleFromText) parsed.name = titleFromText;
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Native unshorten failed:', e);
      }
    }

    // Try web HEAD request (if allowed by server / proxy)
    try {
      const headResp = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      if (headResp.url && headResp.url !== url) {
        const parsed = parseGoogleMapsCoordinates(headResp.url);
        if (parsed) {
          if (titleFromText) parsed.name = titleFromText;
          return parsed;
        }
      }
    } catch {}
  }

  // 3. Fallback: If place name was extracted, geocode it
  if (titleFromText) {
    const geo = await geocodePlaceName(titleFromText);
    if (geo) return geo;
  }

  // 4. Try geocoding raw input if it doesn't look like a raw unresolvable URL
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    const geo = await geocodePlaceName(input);
    if (geo) return geo;
  }

  return null;
}

function isValidCoord(lat: number, lon: number): boolean {
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

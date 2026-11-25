/**
 * Google Maps Link & Route Parser
 * Extracts single destinations, GPS pins, AND multi-stop Directions routes (/dir/Origin/Stop1/.../Dest,
 * ?api=1&origin=...&waypoints=...&destination=..., legacy ?saddr=...&daddr=...to:..., share.google & maps.app.goo.gl links).
 */

export interface ParsedDestination {
  name: string;
  lat: number;
  lon: number;
  sourceUrl?: string;
  rawText?: string;
}

export interface RouteWaypoint {
  name: string;
  lat?: number;
  lon?: number;
  isCurrentLocation?: boolean;
}

export interface ParsedRoutePlan {
  isDirectionsRoute: boolean;
  startFromCurrentLocation: boolean;
  origin?: RouteWaypoint;
  waypoints: RouteWaypoint[]; // intermediate stops ONLY
  destination: RouteWaypoint; // final stop
  allStops: RouteWaypoint[];
  name: string;
  sourceUrl?: string;
  rawText?: string;
}

// Coordinate regex: e.g. 18.52043, 73.85674 (minimum 2 decimal digits to avoid version/number false positives)
const COORD_REGEX = /(-?\d{1,2}\.\d{2,15})[\s,]+(-?\d{1,3}\.\d{2,15})/;
const EXACT_COORD_STRING_REGEX = /^\s*(-?\d{1,2}\.\d{2,15})[\s,]+(-?\d{1,3}\.\d{2,15})\s*$/;

// Google Maps URL single-destination patterns ordered by exact destination specificity
// CRITICAL: Exact pin formats (!3d!4d, !1d!2d last match, destination=, ?q=) MUST precede /@lat,lon (camera center)
const GMAPS_PATTERNS: Array<{ regex: RegExp; isLonFirst?: boolean; takeLast?: boolean }> = [
  // 1. !3dlat!4dlon (Exact place pin coordinates inside Google Maps /place/... URLs; last pin if multiple)
  { regex: /!3d(-?\d{1,2}\.\d{2,15})!4d(-?\d{1,3}\.\d{2,15})/g, takeLast: true },
  // 2. !1dlon!2dlat (Google Maps /dir/ protobuf stop coordinates: NOTE 1d is LON, 2d is LAT; last is final destination!)
  { regex: /!1d(-?\d{1,3}\.\d{2,15})!2d(-?\d{1,2}\.\d{2,15})/g, isLonFirst: true, takeLast: true },
  // 3. destination=lat,lon or destination=lat%2Clon
  { regex: /destination=(-?\d{1,2}\.\d{2,15})(?:,|%2C|\+)(-?\d{1,3}\.\d{2,15})/i },
  // 4. query=lat,lon or q=lat,lon or ll=lat,lon
  { regex: /(?:query|q|ll)=(-?\d{1,2}\.\d{2,15})(?:,|%2C|\+)(-?\d{1,3}\.\d{2,15})/i },
  // 5. loc:lat,lon
  { regex: /loc:(-?\d{1,2}\.\d{2,15})\+(-?\d{1,3}\.\d{2,15})/i },
  // 6. geo:lat,lon
  { regex: /geo:(-?\d{1,2}\.\d{2,15}),(-?\d{1,3}\.\d{2,15})/i },
  // 7. /@lat,lon,zoom (Viewport center fallback when no exact pin/stop coordinates exist)
  { regex: /@(-?\d{1,2}\.\d{2,15}),(-?\d{1,3}\.\d{2,15})/ },
];

export function isShortOrRedirectGoogleUrl(urlStr: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|share\.google|maps\.google\.[a-z.]+\/\?(?:cid|ftid|q)=|consent\.google\.[a-z.]+)/i.test(urlStr);
}

function isCurrentLocationLabel(text: string): boolean {
  const clean = text.trim().toLowerCase();
  return (
    clean === '' ||
    clean === 'my location' ||
    clean === 'your location' ||
    clean === 'current location'
  );
}

function cleanStopLabel(raw: string): string {
  try {
    return decodeURIComponent(raw).replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return raw.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function parseInlineCoordSegment(text: string): { lat: number; lon: number } | null {
  const m = text.match(EXACT_COORD_STRING_REGEX);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  return isValidCoord(lat, lon) ? { lat, lon } : null;
}

/**
 * Extracts /dir/ pathname stop segments cleanly without ever picking up @lat,lon or data=!4m...
 */
function extractDirSegmentsFromUrl(urlStr: string): string[] | null {
  try {
    const url = new URL(urlStr);
    const dirIndex = url.pathname.indexOf('/dir/');
    if (dirIndex === -1) return null;

    const afterDirRaw = url.pathname.slice(dirIndex + 5);
    // Stop cleanly before /@ or /data= or @ or data=
    const cutRaw = afterDirRaw.split(/\/@|\/data=|^@/)[0];
    if (!cutRaw && cutRaw !== '') return null;

    const trimmedTrailing = cutRaw.replace(/\/+$/, '');
    if (trimmedTrailing === '') return null;

    const parts = trimmedTrailing.split('/').map(seg => cleanStopLabel(seg));
    // Discard any stray technical suffixes if someone omitted leading slash
    const cleaned = parts.filter(p => !/^data=/i.test(p) && !/^@\d/.test(p) && !/^am=/i.test(p) && !/^entry=/i.test(p));
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

interface DirDataToken {
  isEmpty?: boolean;
  lat?: number;
  lon?: number;
}

/**
 * Extracts ordered stop pins/empty slots embedded in Google Maps /dir/ `data=` protobuf blocks.
 */
function extractDirDataTokens(urlStr: string): DirDataToken[] {
  const tokens: DirDataToken[] = [];
  // Focus on data= segment if present so other params don't confuse order
  const dataIdx = urlStr.indexOf('data=');
  const scope = dataIdx !== -1 ? urlStr.slice(dataIdx) : urlStr;

  // Match empty stop (!1m0) or !1dLON!2dLAT blocks in exact appearance order
  const dirRegex = /!1m0(?=!|$|#)|!1d(-?\d{1,3}\.\d{2,15})!2d(-?\d{1,2}\.\d{2,15})/g;
  let m: RegExpExecArray | null;
  while ((m = dirRegex.exec(scope)) !== null) {
    if (m[0] === '!1m0') {
      tokens.push({ isEmpty: true });
    } else {
      const lon = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (isValidCoord(lat, lon)) {
        tokens.push({ lat, lon });
      }
    }
  }

  // Fallback to !3dLAT!4dLON tokens only if no !1d!2d pairs existed
  if (!tokens.some(t => t.lat !== undefined)) {
    const placeRegex = /!3d(-?\d{1,2}\.\d{2,15})!4d(-?\d{1,3}\.\d{2,15})/g;
    while ((m = placeRegex.exec(scope)) !== null) {
      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (isValidCoord(lat, lon)) {
        tokens.push({ lat, lon });
      }
    }
  }

  return tokens;
}

/**
 * Clean place name from Google Maps URL path or query parameters
 * e.g. /place/Lonavala+Tiger+Point/@... -> "Lonavala Tiger Point"
 * e.g. /dir/Pune/Lavasa/@... -> "Lavasa" (never "data=!4m...")
 * e.g. geo:0,0?q=18.5204,73.8567(Tiger+Point) -> "Tiger Point"
 */
function extractPlaceNameFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const pathname = decodeURIComponent(url.pathname);

    // 1. Check /place/Place+Name/
    const placeMatch = pathname.match(/\/place\/([^\/@]+)/);
    if (placeMatch && placeMatch[1]) {
      return placeMatch[1].replace(/\+/g, ' ').trim();
    }

    // 2. Check /dir/.../FinalDestination/ cleanly
    const dirSegments = extractDirSegmentsFromUrl(urlStr);
    if (dirSegments && dirSegments.length > 0) {
      const last = dirSegments[dirSegments.length - 1];
      if (last && !isCurrentLocationLabel(last) && !parseInlineCoordSegment(last)) {
        return last;
      }
    }

    // 3. Check ?destination=Place+Name or ?daddr=
    const destParam = url.searchParams.get('destination');
    if (destParam && !parseInlineCoordSegment(destParam) && !isCurrentLocationLabel(destParam)) {
      return cleanStopLabel(destParam);
    }

    const daddr = url.searchParams.get('daddr');
    if (daddr) {
      const stops = daddr.split(/\s+to:/i).map(cleanStopLabel).filter(Boolean);
      const last = stops[stops.length - 1];
      if (last && !parseInlineCoordSegment(last)) {
        return last;
      }
    }

    // 4. Check ?q=lat,lon(Place Name) or ?q=Place+Name
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

const GENERIC_SHARE_NOISE = /^(shared route|dropped pin|shared location|check out this location on google maps|shared via google maps|to see this route.*|for the best route.*|see this route.*|\d+\s*(hr|hrs|min|mins|sec|km|mi|m)\b.*)$/i;

/**
 * Extracts route hints from Android Google Maps share text:
 * e.g. "Shared route\nFrom Pune to Lavasa via Paud Rd.\nTo see this route visit https://..."
 */
function extractSharedRouteHintFromText(text: string): { origin?: string; destination?: string } | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^From\s+(.+?)\s+to\s+(.+?)(?:\s+via\s+.+?)?\.?$/i);
    if (m) {
      return {
        origin: m[1].trim(),
        destination: m[2].trim(),
      };
    }
  }
  return null;
}

/**
 * Extracts a candidate place title from shared text preceding the URL, ignoring Android boilerplate
 */
function extractTitleFromText(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('geo:')) continue;
    if (/^\d+\.\s+/.test(line)) continue; // Turn instruction "1. Head west..."
    if (/^From\s+.+\s+to\s+.+/i.test(line)) continue;
    const clean = line
      .replace(/Shared via Google Maps|Check out this location on Google Maps|Shared location/gi, '')
      .trim();
    if (!clean || GENERIC_SHARE_NOISE.test(clean)) continue;
    if (clean.length > 2 && clean.length < 80) {
      return clean;
    }
  }
  return null;
}

/**
 * Find first HTTP/HTTPS/GEO URL in string (stripping trailing punctuation if shared inside prose)
 */
export function extractUrlFromText(text: string): string | null {
  const match = text.match(/(https?:\/\/[^\s]+|geo:[^\s]+)/i);
  if (!match) return null;
  let cleaned = match[1].replace(/[.,;\]]+$/, '');
  while (cleaned.endsWith(')') && !cleaned.includes('(')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Parses a full Google Maps route (including /dir/Origin/Stop1/.../Dest, ?api=1&waypoints=...,
 * legacy ?saddr=...&daddr=..., or single pins / destinations).
 */
export function parseGoogleMapsRoute(input: string): ParsedRoutePlan | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim();
  const urlStr = extractUrlFromText(raw);

  if (urlStr) {
    try {
      const url = new URL(urlStr);

      // 1. Google Maps Directions API v1 URL: ?api=1&origin=...&destination=...&waypoints=Stop1|Stop2
      const hasApiDir =
        (url.pathname.includes('/dir') && (url.searchParams.has('destination') || url.searchParams.has('origin'))) ||
        url.searchParams.has('waypoints');

      if (hasApiDir) {
        const originParam = url.searchParams.get('origin');
        const destParam = url.searchParams.get('destination');
        const waypointsParam = url.searchParams.get('waypoints');
        const dataTokens = extractDirDataTokens(urlStr).filter(t => t.lat !== undefined);

        if (destParam) {
          const parsedWaypoints: RouteWaypoint[] = (waypointsParam ? waypointsParam.split('|') : [])
            .map(w => cleanStopLabel(w))
            .filter(w => w && !isCurrentLocationLabel(w))
            .map(w => {
              const coord = parseInlineCoordSegment(w);
              return coord ? { name: `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`, lat: coord.lat, lon: coord.lon } : { name: w };
            });

          const destClean = cleanStopLabel(destParam);
          const destCoord = parseInlineCoordSegment(destClean) || (dataTokens.length > 0 ? { lat: dataTokens[dataTokens.length - 1].lat!, lon: dataTokens[dataTokens.length - 1].lon! } : null);
          const destination: RouteWaypoint = {
            name: destCoord && parseInlineCoordSegment(destClean)
              ? `Destination (${destCoord.lat.toFixed(4)}, ${destCoord.lon.toFixed(4)})`
              : destClean || 'Target Destination',
            ...(destCoord ? { lat: destCoord.lat, lon: destCoord.lon } : {}),
          };

          let startFromCurrentLocation = true;
          let origin: RouteWaypoint | undefined;
          if (originParam && !isCurrentLocationLabel(cleanStopLabel(originParam))) {
            const originClean = cleanStopLabel(originParam);
            const originCoord = parseInlineCoordSegment(originClean);
            startFromCurrentLocation = false;
            origin = {
              name: originCoord ? `${originCoord.lat.toFixed(4)}, ${originCoord.lon.toFixed(4)}` : originClean,
              ...(originCoord ? { lat: originCoord.lat, lon: originCoord.lon } : {}),
            };
          }

          const allStops = [...(origin ? [origin] : []), ...parsedWaypoints, destination];
          return {
            isDirectionsRoute: true,
            startFromCurrentLocation,
            origin,
            waypoints: parsedWaypoints,
            destination,
            allStops,
            name: parsedWaypoints.length > 0 ? `${destination.name} (${parsedWaypoints.length} ${parsedWaypoints.length === 1 ? 'stop' : 'stops'})` : destination.name,
            sourceUrl: urlStr,
            rawText: raw,
          };
        }
      }

      // 2. Legacy saddr + daddr directions URL: ?saddr=Pune&daddr=Mulshi+to:Lavasa
      if (url.searchParams.has('daddr')) {
        const saddr = url.searchParams.get('saddr');
        const daddr = url.searchParams.get('daddr') || '';
        const daddrStops = daddr.split(/\s+to:/i).map(cleanStopLabel).filter(Boolean).map(s => {
          const c = parseInlineCoordSegment(s);
          return c ? { name: `${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`, lat: c.lat, lon: c.lon } : { name: s };
        });

        if (daddrStops.length > 0) {
          const destination = daddrStops[daddrStops.length - 1];
          const waypoints = daddrStops.slice(0, -1);
          let startFromCurrentLocation = true;
          let origin: RouteWaypoint | undefined;
          if (saddr && !isCurrentLocationLabel(cleanStopLabel(saddr))) {
            const sClean = cleanStopLabel(saddr);
            const sc = parseInlineCoordSegment(sClean);
            startFromCurrentLocation = false;
            origin = sc ? { name: `${sc.lat.toFixed(4)}, ${sc.lon.toFixed(4)}`, lat: sc.lat, lon: sc.lon } : { name: sClean };
          }
          const allStops = [...(origin ? [origin] : []), ...waypoints, destination];
          return {
            isDirectionsRoute: true,
            startFromCurrentLocation,
            origin,
            waypoints,
            destination,
            allStops,
            name: waypoints.length > 0 ? `${destination.name} (${waypoints.length} ${waypoints.length === 1 ? 'stop' : 'stops'})` : destination.name,
            sourceUrl: urlStr,
            rawText: raw,
          };
        }
      }

      // 3. Standard path-based /maps/dir/Origin/Stop1/Stop2/Dest/@lat,lon/data=...
      if (url.pathname.includes('/dir/')) {
        const dirSegments = extractDirSegmentsFromUrl(urlStr);
        const dataTokens = extractDirDataTokens(urlStr);
        const coordOnlyTokens = dataTokens.filter(t => t.lat !== undefined && t.lon !== undefined) as Array<{ lat: number; lon: number }>;

        if (dirSegments && dirSegments.length > 0) {
          const rawStops: RouteWaypoint[] = dirSegments.map(seg => {
            if (isCurrentLocationLabel(seg)) {
              return { name: 'My Location', isCurrentLocation: true };
            }
            const inline = parseInlineCoordSegment(seg);
            if (inline) {
              return { name: `${inline.lat.toFixed(4)}, ${inline.lon.toFixed(4)}`, lat: inline.lat, lon: inline.lon };
            }
            return { name: seg };
          });

          // Pair data= protobuf pin coordinates (!1d!2d / !1m0) onto path stops
          if (dataTokens.length === rawStops.length) {
            for (let i = 0; i < rawStops.length; i++) {
              const tok = dataTokens[i];
              if (tok.isEmpty) {
                rawStops[i].isCurrentLocation = true;
                if (!rawStops[i].name) rawStops[i].name = 'My Location';
              } else if (tok.lat !== undefined && tok.lon !== undefined && rawStops[i].lat === undefined) {
                rawStops[i].lat = tok.lat;
                rawStops[i].lon = tok.lon;
              }
            }
          } else {
            const needCoords = rawStops.filter(s => !s.isCurrentLocation && s.lat === undefined);
            if (needCoords.length > 0 && needCoords.length === coordOnlyTokens.length) {
              for (let i = 0; i < needCoords.length; i++) {
                needCoords[i].lat = coordOnlyTokens[i].lat;
                needCoords[i].lon = coordOnlyTokens[i].lon;
              }
            } else if (coordOnlyTokens.length === rawStops.length) {
              for (let i = 0; i < rawStops.length; i++) {
                if (rawStops[i].lat === undefined) {
                  rawStops[i].lat = coordOnlyTokens[i].lat;
                  rawStops[i].lon = coordOnlyTokens[i].lon;
                }
              }
            } else if (coordOnlyTokens.length > 0) {
              // At minimum ensure final destination gets the last pin if it lacked one
              const lastStop = rawStops[rawStops.length - 1];
              if (lastStop && !lastStop.isCurrentLocation && lastStop.lat === undefined) {
                const lastTok = coordOnlyTokens[coordOnlyTokens.length - 1];
                lastStop.lat = lastTok.lat;
                lastStop.lon = lastTok.lon;
              }
            }
          }

          // Build origin, intermediate waypoints, and final destination
          if (rawStops.length === 1) {
            const dest = rawStops[0];
            if (dest.lat === undefined || dest.lon === undefined) {
              // Single named destination in /dir/Lavasa without pin coords: still let async resolver geocode it
              return {
                isDirectionsRoute: true,
                startFromCurrentLocation: true,
                waypoints: [],
                destination: dest,
                allStops: [dest],
                name: dest.name,
                sourceUrl: urlStr,
                rawText: raw,
              };
            }
            return {
              isDirectionsRoute: true,
              startFromCurrentLocation: true,
              waypoints: [],
              destination: dest,
              allStops: [dest],
              name: dest.name,
              sourceUrl: urlStr,
              rawText: raw,
            };
          }

          const first = rawStops[0];
          const startFromCurrentLocation = !!first.isCurrentLocation;
          const origin = startFromCurrentLocation ? undefined : first;
          const waypoints = rawStops.slice(1, -1).filter(s => !s.isCurrentLocation);
          const destination = rawStops[rawStops.length - 1];
          const allStops = [...(origin ? [origin] : []), ...waypoints, destination];

          return {
            isDirectionsRoute: true,
            startFromCurrentLocation,
            origin,
            waypoints,
            destination,
            allStops,
            name: waypoints.length > 0 ? `${destination.name} (${waypoints.length} ${waypoints.length === 1 ? 'stop' : 'stops'})` : destination.name,
            sourceUrl: urlStr,
            rawText: raw,
          };
        } else if (coordOnlyTokens.length >= 2) {
          // /dir/@.../data= with pure coordinate blocks and no path names
          const originTok = coordOnlyTokens[0];
          const wpToks = coordOnlyTokens.slice(1, -1);
          const destTok = coordOnlyTokens[coordOnlyTokens.length - 1];
          const origin: RouteWaypoint = { name: `Start (${originTok.lat.toFixed(4)}, ${originTok.lon.toFixed(4)})`, lat: originTok.lat, lon: originTok.lon };
          const waypoints: RouteWaypoint[] = wpToks.map((t, i) => ({
            name: `Stop ${i + 1} (${t.lat.toFixed(4)}, ${t.lon.toFixed(4)})`,
            lat: t.lat,
            lon: t.lon,
          }));
          const destination: RouteWaypoint = { name: `Destination (${destTok.lat.toFixed(4)}, ${destTok.lon.toFixed(4)})`, lat: destTok.lat, lon: destTok.lon };
          return {
            isDirectionsRoute: true,
            startFromCurrentLocation: false,
            origin,
            waypoints,
            destination,
            allStops: [origin, ...waypoints, destination],
            name: waypoints.length > 0 ? `${destination.name} (${waypoints.length} ${waypoints.length === 1 ? 'stop' : 'stops'})` : destination.name,
            sourceUrl: urlStr,
            rawText: raw,
          };
        }
      }
    } catch {}
  }

  // Fallback: single destination pin/coordinate parse
  const single = parseGoogleMapsCoordinates(raw);
  if (single) {
    const dest: RouteWaypoint = { name: single.name, lat: single.lat, lon: single.lon };
    return {
      isDirectionsRoute: false,
      startFromCurrentLocation: true,
      waypoints: [],
      destination: dest,
      allStops: [dest],
      name: single.name,
      sourceUrl: single.sourceUrl,
      rawText: single.rawText,
    };
  }

  return null;
}

/**
 * Synchronously parses Google Maps text or URL into a single final destination coordinate.
 */
export function parseGoogleMapsCoordinates(input: string): ParsedDestination | null {
  if (!input || !input.trim()) return null;
  const raw = input.trim();

  let foundLat: number | null = null;
  let foundLon: number | null = null;

  // 1. Try URL patterns
  for (const entry of GMAPS_PATTERNS) {
    if (entry.regex.global) {
      const matches = Array.from(raw.matchAll(entry.regex));
      if (matches.length > 0) {
        const chosen = entry.takeLast ? matches[matches.length - 1] : matches[0];
        const a = parseFloat(chosen[1]);
        const b = parseFloat(chosen[2]);
        const lat = entry.isLonFirst ? b : a;
        const lon = entry.isLonFirst ? a : b;
        if (isValidCoord(lat, lon)) {
          foundLat = lat;
          foundLon = lon;
          break;
        }
      }
    } else {
      const match = raw.match(entry.regex);
      if (match) {
        const a = parseFloat(match[1]);
        const b = parseFloat(match[2]);
        const lat = entry.isLonFirst ? b : a;
        const lon = entry.isLonFirst ? a : b;
        if (isValidCoord(lat, lon)) {
          foundLat = lat;
          foundLon = lon;
          break;
        }
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
  const hintFromText = extractSharedRouteHintFromText(raw);
  const finalName = nameFromUrl || nameFromText || hintFromText?.destination || `Destination (${foundLat.toFixed(4)}, ${foundLon.toFixed(4)})`;

  return {
    name: finalName,
    lat: foundLat,
    lon: foundLon,
    sourceUrl: url || undefined,
    rawText: raw,
  };
}

let lastNominatimRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();
const geocodeCache = new Map<string, ParsedDestination | null>();
const NOMINATIM_MIN_INTERVAL_MS = 1100;

/**
 * Geocodes a place name to coordinates using OpenStreetMap Nominatim.
 * Sequential rate-limiting (>= 1.1s between requests) and AbortController timeouts
 * satisfy Nominatim usage limits without sending forbidden browser User-Agent headers.
 */
export async function geocodePlaceName(query: string): Promise<ParsedDestination | null> {
  if (!query || query.trim().length < 2) return null;
  const clean = query.trim();
  const cacheKey = clean.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  let result: ParsedDestination | null = null;
  const runRequest = async (): Promise<void> => {
    const now = Date.now();
    const waitMs = NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimRequestAt);
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    lastNominatimRequestAt = Date.now();
    try {
      const encoded = encodeURIComponent(clean);
      const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (isValidCoord(lat, lon)) {
          result = {
            name: item.display_name?.split(',')[0] || clean,
            lat,
            lon,
            rawText: clean,
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding failed:', e);
    } finally {
      clearTimeout(timeoutId);
      lastNominatimRequestAt = Date.now();
    }
  };

  const ticket = nominatimQueue.then(runRequest, runRequest);
  nominatimQueue = ticket.catch(() => {});
  await ticket;

  if (geocodeCache.size >= 50) {
    const firstKey = geocodeCache.keys().next().value;
    if (firstKey !== undefined) geocodeCache.delete(firstKey);
  }
  geocodeCache.set(cacheKey, result);
  return result;
}

async function resolveMissingStopCoordinates(plan: ParsedRoutePlan): Promise<ParsedRoutePlan | null> {
  const fillCoord = async (wp: RouteWaypoint): Promise<RouteWaypoint> => {
    if (wp.isCurrentLocation || (wp.lat !== undefined && wp.lon !== undefined && isValidCoord(wp.lat, wp.lon))) {
      return wp;
    }
    if (wp.name) {
      const geo = await geocodePlaceName(wp.name);
      if (geo) {
        return { ...wp, lat: geo.lat, lon: geo.lon };
      }
    }
    return wp;
  };

  const resolvedOrigin = plan.origin ? await fillCoord(plan.origin) : undefined;
  const resolvedWaypoints: RouteWaypoint[] = [];
  for (const wp of plan.waypoints) {
    resolvedWaypoints.push(await fillCoord(wp));
  }
  const resolvedDest = await fillCoord(plan.destination);

  if (resolvedDest.lat === undefined || resolvedDest.lon === undefined) {
    return null;
  }

  const validWaypoints = resolvedWaypoints.filter(w => w.lat !== undefined && w.lon !== undefined);
  const validOrigin = resolvedOrigin && resolvedOrigin.lat !== undefined && resolvedOrigin.lon !== undefined ? resolvedOrigin : undefined;
  const startFromCurrentLocation = validOrigin ? plan.startFromCurrentLocation : true;

  return {
    ...plan,
    startFromCurrentLocation,
    origin: validOrigin,
    waypoints: validWaypoints,
    destination: resolvedDest,
    allStops: [...(validOrigin ? [validOrigin] : []), ...validWaypoints, resolvedDest],
  };
}

/**
 * Full async resolver supporting Google Maps Directions routes (with multiple stops),
 * short URLs (maps.app.goo.gl, share.google, g.co, goo.gl/maps), pins, geo: links, and search names.
 */
export async function resolveGoogleMapsRoute(
  input: string,
  nativeUnshorten?: (shortUrl: string) => Promise<{ resolvedUrl: string }>
): Promise<ParsedRoutePlan | null> {
  if (!input || !input.trim()) return null;
  const cleanInput = input.trim();
  const url = extractUrlFromText(cleanInput);
  const titleFromText = extractTitleFromText(cleanInput);
  const routeHintFromText = extractSharedRouteHintFromText(cleanInput);

  // 1. If there's a short / redirect URL, ALWAYS resolve it first so multi-stop /dir/ URLs aren't bypassed
  if (url && isShortOrRedirectGoogleUrl(url)) {
    let resolvedUrl: string | null = null;
    if (nativeUnshorten) {
      try {
        const res = await nativeUnshorten(url);
        if (res && res.resolvedUrl && res.resolvedUrl !== url) {
          resolvedUrl = res.resolvedUrl;
        }
      } catch (e) {
        console.warn('Unshorten helper failed:', e);
      }
    }

    if (resolvedUrl) {
      const routePlan = parseGoogleMapsRoute(resolvedUrl);
      if (routePlan) {
        const filled = await resolveMissingStopCoordinates(routePlan);
        if (filled) {
          if (titleFromText && filled.destination.name.startsWith('Destination (')) {
            filled.destination.name = titleFromText;
            filled.name = titleFromText;
          }
          return filled;
        }
      }
      // Check if resolved URL itself contains a readable place/dir name needing geocoding
      const placeInResolved = extractPlaceNameFromUrl(resolvedUrl);
      if (placeInResolved) {
        const geo = await geocodePlaceName(placeInResolved);
        if (geo) {
          const dest: RouteWaypoint = { name: geo.name, lat: geo.lat, lon: geo.lon };
          return {
            isDirectionsRoute: resolvedUrl.includes('/dir/'),
            startFromCurrentLocation: true,
            waypoints: [],
            destination: dest,
            allStops: [dest],
            name: dest.name,
            sourceUrl: resolvedUrl,
            rawText: cleanInput,
          };
        }
      }
    }
  }

  // 2. Parse direct route or single destination locally (and geocode any coordinate-less stop names in /dir/)
  const directPlan = parseGoogleMapsRoute(cleanInput);
  if (directPlan) {
    const filled = await resolveMissingStopCoordinates(directPlan);
    if (filled) return filled;
  }

  // 3. Fallback: Shared route prose ("From X to Y via Z") if short link could not be unshortened
  if (routeHintFromText?.destination) {
    const destGeo = isCurrentLocationLabel(routeHintFromText.destination) ? null : await geocodePlaceName(routeHintFromText.destination);
    if (destGeo) {
      let originWp: RouteWaypoint | undefined;
      if (routeHintFromText.origin && !isCurrentLocationLabel(routeHintFromText.origin)) {
        const origGeo = await geocodePlaceName(routeHintFromText.origin);
        if (origGeo) originWp = { name: origGeo.name, lat: origGeo.lat, lon: origGeo.lon };
      }
      const destWp: RouteWaypoint = { name: destGeo.name, lat: destGeo.lat, lon: destGeo.lon };
      return {
        isDirectionsRoute: true,
        startFromCurrentLocation: !originWp,
        origin: originWp,
        waypoints: [],
        destination: destWp,
        allStops: [...(originWp ? [originWp] : []), destWp],
        name: destWp.name,
        sourceUrl: url || undefined,
        rawText: cleanInput,
      };
    }
  }

  // 4. Fallback: Extracted clean place title from shared prose
  if (titleFromText) {
    const geo = await geocodePlaceName(titleFromText);
    if (geo) {
      const destWp: RouteWaypoint = { name: geo.name, lat: geo.lat, lon: geo.lon };
      return {
        isDirectionsRoute: false,
        startFromCurrentLocation: true,
        waypoints: [],
        destination: destWp,
        allStops: [destWp],
        name: destWp.name,
        sourceUrl: url || undefined,
        rawText: cleanInput,
      };
    }
  }

  // 5. Try geocoding raw place name / address if it isn't an unresolvable URL
  if (!url && !cleanInput.startsWith('http://') && !cleanInput.startsWith('https://')) {
    const geo = await geocodePlaceName(cleanInput);
    if (geo) {
      const destWp: RouteWaypoint = { name: geo.name, lat: geo.lat, lon: geo.lon };
      return {
        isDirectionsRoute: false,
        startFromCurrentLocation: true,
        waypoints: [],
        destination: destWp,
        allStops: [destWp],
        name: destWp.name,
        rawText: cleanInput,
      };
    }
  }

  return null;
}

/**
 * Backward-compatible single destination async resolver.
 */
export async function resolveGoogleMapsDestination(
  input: string,
  nativeUnshorten?: (shortUrl: string) => Promise<{ resolvedUrl: string }>
): Promise<ParsedDestination | null> {
  const plan = await resolveGoogleMapsRoute(input, nativeUnshorten);
  if (!plan || plan.destination.lat === undefined || plan.destination.lon === undefined) {
    return null;
  }
  return {
    name: plan.destination.name,
    lat: plan.destination.lat,
    lon: plan.destination.lon,
    sourceUrl: plan.sourceUrl,
    rawText: plan.rawText,
  };
}

function isValidCoord(lat: number, lon: number): boolean {
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

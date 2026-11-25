import type { IncomingMessage, ServerResponse } from 'http';

const MAX_HTML_BYTES = 96 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const ipRateMap = new Map<string, { count: number; resetAt: number }>();

const EXACT_ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'share.google',
  'consent.google.com',
  'google.com',
  'maps.google.com',
  'www.google.com',
]);

function isAllowedGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  if (EXACT_ALLOWED_HOSTS.has(host)) return true;
  if (/^(?:www\.|maps\.|consent\.)?google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(host)) {
    return true;
  }
  return false;
}

function isAllowedCorsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (
      (u.protocol === 'https:' && (host === 'throttlelog.vercel.app' || /^throttlelog-[a-z0-9-]+\.vercel\.app$/.test(host))) ||
      ((u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'capacitor:') &&
        (host === 'localhost' || host === '127.0.0.1'))
    ) {
      return origin;
    }
    if (process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN) {
      return origin;
    }
  } catch {}
  return null;
}

function checkRateLimit(req: IncomingMessage): { allowed: boolean; retryAfterSec: number } {
  const xff = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(xff) ? xff[0] : (xff || req.socket?.remoteAddress || 'unknown');
  const clientIp = rawIp.split(',')[0].trim() || 'unknown';
  const now = Date.now();

  if (ipRateMap.size > 500) {
    for (const [key, entry] of ipRateMap.entries()) {
      if (now >= entry.resetAt) ipRateMap.delete(key);
    }
  }

  const current = ipRateMap.get(clientIp);
  if (!current || now >= current.resetAt) {
    ipRateMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function unescapeHtmlAndJsonUrl(raw: string): string {
  return raw
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u002f/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&');
}

function urlHasCoordinates(u: string): boolean {
  return /(!1d-?\d+\.\d+!2d-?\d+\.\d+|!3d-?\d+\.\d+!4d-?\d+\.\d+|@-?\d+\.\d+,-?\d+\.\d+|(?:destination|q|query|ll)=-?\d+\.\d+)/i.test(u);
}

function appendQueryParam(baseUrl: string, key: string, value: string): string {
  try {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const hashIdx = baseUrl.indexOf('#');
    const cleanBase = hashIdx >= 0 ? baseUrl.slice(0, hashIdx) : baseUrl;
    const fragment = hashIdx >= 0 ? baseUrl.slice(hashIdx) : '';
    const sep = cleanBase.includes('?') ? '&' : '?';
    return `${cleanBase}${sep}${key}=${encodeURIComponent(value)}${fragment}`;
  }
}

async function readBodyCapped(resp: Response, maxBytes: number): Promise<string> {
  if (!resp.body) {
    const text = await resp.text();
    return text.slice(0, maxBytes);
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (total >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function sendJson(res: ServerResponse, statusCode: number, body: Record<string, any>): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  const reqOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const allowedOrigin = isAllowedCorsOrigin(reqOrigin);

  res.setHeader('Vary', 'Origin');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (reqOrigin && !allowedOrigin) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
    sendJson(res, 429, { error: 'Too many requests' });
    return;
  }

  let targetUrl = '';
  if (req.query && typeof req.query.url === 'string') {
    targetUrl = req.query.url;
  } else if (req.url) {
    try {
      const parsedReq = new URL(req.url, 'https://throttlelog.vercel.app');
      targetUrl = parsedReq.searchParams.get('url') || '';
    } catch {}
  }

  targetUrl = targetUrl.trim();
  if (!targetUrl || targetUrl.length > 2048) {
    sendJson(res, 400, { error: 'Missing or invalid url parameter' });
    return;
  }

  let parsedInitial: URL;
  try {
    parsedInitial = new URL(targetUrl);
  } catch {
    sendJson(res, 400, { error: 'Invalid URL' });
    return;
  }

  if (
    (parsedInitial.protocol !== 'https:' && parsedInitial.protocol !== 'http:') ||
    parsedInitial.username ||
    parsedInitial.password ||
    parsedInitial.port !== '' ||
    !isAllowedGoogleHost(parsedInitial.hostname)
  ) {
    sendJson(res, 400, { error: 'Only standard Google / Google Maps URLs are supported' });
    return;
  }

  if (parsedInitial.protocol === 'http:') {
    parsedInitial.protocol = 'https:';
  }

  let current = parsedInitial.toString();
  const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

  try {
    for (let hop = 0; hop < 8; hop++) {
      const parsedHop = new URL(current);
      if (
        parsedHop.protocol !== 'https:' ||
        parsedHop.username ||
        parsedHop.password ||
        parsedHop.port !== '' ||
        !isAllowedGoogleHost(parsedHop.hostname)
      ) {
        sendJson(res, 422, { error: 'Redirect left trusted Google domains' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      let resp: Response;
      try {
        resp = await fetch(current, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get('location');
        await resp.body?.cancel().catch(() => {});
        if (!loc) break;

        let uNext = new URL(loc, parsedHop);
        if (uNext.protocol === 'http:') {
          uNext.protocol = 'https:';
        }
        // Unwrap consent.google.com continue parameter directly
        if (uNext.hostname.toLowerCase().includes('consent.google') && uNext.searchParams.get('continue')) {
          const cont = new URL(uNext.searchParams.get('continue')!, parsedHop);
          if (cont.protocol === 'http:') cont.protocol = 'https:';
          uNext = cont;
        }
        current = uNext.toString();
        continue;
      }

      if (!resp.ok) {
        await resp.body?.cancel().catch(() => {});
        sendJson(res, 502, { error: `Upstream returned HTTP ${resp.status}` });
        return;
      }

      if (!urlHasCoordinates(current)) {
        const rawHtml = await readBodyCapped(resp, MAX_HTML_BYTES);
        const snippet = unescapeHtmlAndJsonUrl(rawHtml);

        // 1. Canonical or og:url or direct Google Maps URL in HTML
        const urlMatch = snippet.match(/https:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps\/(?:dir|place|search)[^"'<>\s]+/i)
          || snippet.match(/https:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps\?[^"'<>\s]+/i);
        if (urlMatch && urlMatch[0]) {
          current = urlMatch[0];
          break;
        }

        // 2. Embedded protobuf !1d!2d or !3d!4d or @lat,lon or staticmap center=
        const protoDirMatch = snippet.match(/!1d(-?\d{1,3}\.\d{2,15})!2d(-?\d{1,2}\.\d{2,15})/);
        const protoPlaceMatch = snippet.match(/!3d(-?\d{1,2}\.\d{2,15})!4d(-?\d{1,3}\.\d{2,15})/);
        const atMatch = snippet.match(/@(-?\d{1,2}\.\d{2,15}),(-?\d{1,3}\.\d{2,15})/);
        const staticMapMatch = snippet.match(/staticmap\?center=(-?\d{1,2}\.\d{2,15})(?:,|%2C)(-?\d{1,3}\.\d{2,15})/i);
        const appInitCoord = snippet.match(/\[null,null,(-?\d{1,2}\.\d{4,12}),(-?\d{1,3}\.\d{4,12})\]/);

        if (protoDirMatch) {
          current = appendQueryParam(current, 'q', `${protoDirMatch[2]},${protoDirMatch[1]}`);
        } else if (protoPlaceMatch) {
          current = appendQueryParam(current, 'q', `${protoPlaceMatch[1]},${protoPlaceMatch[2]}`);
        } else if (staticMapMatch) {
          current = appendQueryParam(current, 'q', `${staticMapMatch[1]},${staticMapMatch[2]}`);
        } else if (atMatch) {
          current = appendQueryParam(current, 'q', `${atMatch[1]},${atMatch[2]}`);
        } else if (appInitCoord) {
          current = appendQueryParam(current, 'q', `${appInitCoord[1]},${appInitCoord[2]}`);
        }
      } else {
        await resp.body?.cancel().catch(() => {});
      }
      break;
    }

    sendJson(res, 200, { resolvedUrl: current });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    sendJson(res, isTimeout ? 504 : 502, {
      error: isTimeout ? 'Upstream request timed out' : (err?.message || 'unshorten_error'),
    });
  }
}

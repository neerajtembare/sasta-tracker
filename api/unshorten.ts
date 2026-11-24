import type { IncomingMessage, ServerResponse } from 'http';

const ALLOWED_HOST_SUFFIXES = [
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'share.google',
  'google.com',
  'maps.google.com',
];

function isAllowedGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ALLOWED_HOST_SUFFIXES.includes(host)) return true;
  if (/^(www\.|maps\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2,3})$/.test(host)) return true;
  if (host.endsWith('.goo.gl') || host.endsWith('.app.goo.gl')) return true;
  return false;
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

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
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
  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing url parameter' }));
    return;
  }

  let parsedInitial: URL;
  try {
    parsedInitial = new URL(targetUrl);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  if ((parsedInitial.protocol !== 'https:' && parsedInitial.protocol !== 'http:') || !isAllowedGoogleHost(parsedInitial.hostname)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Only Google / Google Maps URLs are supported' }));
    return;
  }

  let current = parsedInitial.toString();
  const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

  try {
    for (let hop = 0; hop < 8; hop++) {
      const parsedHop = new URL(current);
      if (!isAllowedGoogleHost(parsedHop.hostname)) {
        break;
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
        if (!loc) break;
        const nextUrl = new URL(loc, parsedHop).toString();
        // Unwrap consent.google.com continue parameter directly
        try {
          const uNext = new URL(nextUrl);
          if (uNext.hostname.includes('consent.google') && uNext.searchParams.get('continue')) {
            current = uNext.searchParams.get('continue')!;
            continue;
          }
        } catch {}
        current = nextUrl;
        continue;
      }

      if (!urlHasCoordinates(current) && resp.ok) {
        const rawHtml = await resp.text();
        const snippet = unescapeHtmlAndJsonUrl(rawHtml.slice(0, 90000));

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
          current = `${current}${current.includes('?') ? '&' : '?'}q=${protoDirMatch[2]},${protoDirMatch[1]}`;
        } else if (protoPlaceMatch) {
          current = `${current}${current.includes('?') ? '&' : '?'}q=${protoPlaceMatch[1]},${protoPlaceMatch[2]}`;
        } else if (staticMapMatch) {
          current = `${current}${current.includes('?') ? '&' : '?'}q=${staticMapMatch[1]},${staticMapMatch[2]}`;
        } else if (atMatch) {
          current = `${current}${current.includes('?') ? '&' : '?'}q=${atMatch[1]},${atMatch[2]}`;
        } else if (appInitCoord) {
          current = `${current}${current.includes('?') ? '&' : '?'}q=${appInitCoord[1]},${appInitCoord[2]}`;
        }
      }
      break;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ resolvedUrl: current }));
  } catch (err: any) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ resolvedUrl: current, warning: err?.message || 'unshorten_error' }));
  }
}

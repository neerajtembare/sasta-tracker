/**
 * ThrottleLog — Native Google Maps & Turn-by-Turn Navigation Launcher
 * Supports Android Native Intent (google.navigation:q=), Apple Maps (iOS), and Web Fallback.
 */

function launchUrlWithVisibilityFallback(primaryUrl: string, webFallbackUrl: string): void {
  let fallbackTimer: any = null;
  const cleanup = () => {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', cleanup);
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      cleanup();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', cleanup, { once: true });

  window.location.href = primaryUrl;

  fallbackTimer = setTimeout(() => {
    cleanup();
    if (!document.hidden) {
      window.open(webFallbackUrl, '_blank', 'noopener,noreferrer');
    }
  }, 1000);
}

export function openGoogleMapsNavigation(lat: number, lon: number, label?: string): void {
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const cleanLat = lat.toFixed(6);
  const cleanLon = lon.toFixed(6);
  const queryCoord = `${cleanLat},${cleanLon}`;

  if (isAndroid) {
    const intentUrl = `google.navigation:q=${queryCoord}&mode=d`;
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${queryCoord}&travelmode=driving`;
    launchUrlWithVisibilityFallback(intentUrl, webFallback);
  } else if (isIOS) {
    const qParam = label ? `&q=${encodeURIComponent(label)}` : '';
    const appleUrl = `https://maps.apple.com/?daddr=${queryCoord}&dirflg=d${qParam}`;
    window.open(appleUrl, '_blank', 'noopener,noreferrer');
  } else {
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${queryCoord}&travelmode=driving`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openGoogleMapsRoute(originLat: number, originLon: number, destLat: number, destLon: number): void {
  const cleanOrigin = `${originLat.toFixed(6)},${originLon.toFixed(6)}`;
  const cleanDest = `${destLat.toFixed(6)},${destLon.toFixed(6)}`;
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`;

  if (isAndroid) {
    launchUrlWithVisibilityFallback(`google.navigation:q=${cleanDest}&mode=d`, webUrl);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`, '_blank', 'noopener,noreferrer');
  }
}

export function openGoogleMapsMultiStop(
  destination: { lat: number; lon: number; name?: string },
  waypoints?: Array<{ lat: number; lon: number; name?: string }>,
  origin?: { lat: number; lon: number; name?: string } | null
): void {
  const cleanStops = (waypoints || []).filter(
    w => !isNaN(w.lat) && !isNaN(w.lon) && !(w.lat === 0 && w.lon === 0)
  );
  if (cleanStops.length === 0 && !origin) {
    openGoogleMapsNavigation(destination.lat, destination.lon, destination.name);
    return;
  }

  const destStr = `${destination.lat.toFixed(6)},${destination.lon.toFixed(6)}`;
  const params = new URLSearchParams({
    api: '1',
    destination: destStr,
    travelmode: 'driving',
  });
  if (origin && !isNaN(origin.lat) && !isNaN(origin.lon) && !(origin.lat === 0 && origin.lon === 0)) {
    params.set('origin', `${origin.lat.toFixed(6)},${origin.lon.toFixed(6)}`);
  }
  if (cleanStops.length > 0) {
    params.set('waypoints', cleanStops.map(w => `${w.lat.toFixed(6)},${w.lon.toFixed(6)}`).join('|'));
  }

  const mapsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  if (isAndroid) {
    let fallbackTimer: any = null;
    const cleanup = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', cleanup);
    };
    const onVisibilityChange = () => {
      if (document.hidden) cleanup();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', cleanup, { once: true });

    const popup = window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      const a = document.createElement('a');
      a.href = mapsUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    fallbackTimer = setTimeout(() => {
      cleanup();
    }, 1200);
  } else {
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openActiveRouteNavigation(route: {
  name?: string;
  points: Array<{ lat: number; lon: number }>;
  pitStops?: Array<{ id: string; lat: number; lon: number; name?: string; locationName?: string }>;
}): void {
  if (!route.points || route.points.length === 0) return;
  const destPt = route.points[route.points.length - 1];
  const gmapsWaypoints = (route.pitStops || [])
    .filter(s => s.id.startsWith('gmaps-stop-'))
    .map(s => ({ lat: s.lat, lon: s.lon, name: s.locationName || s.name }));

  if (gmapsWaypoints.length > 0) {
    openGoogleMapsMultiStop(
      { lat: destPt.lat, lon: destPt.lon, name: route.name },
      gmapsWaypoints
    );
  } else {
    openGoogleMapsNavigation(destPt.lat, destPt.lon, route.name);
  }
}

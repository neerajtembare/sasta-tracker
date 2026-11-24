/**
 * Sasta Tracker — Native Google Maps & Turn-by-Turn Navigation Launcher
 * Supports Android Native Intent (google.navigation:q=), Apple Maps (iOS), and Web Fallback.
 */

export function openGoogleMapsNavigation(lat: number, lon: number, label?: string): void {
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const cleanLat = lat.toFixed(6);
  const cleanLon = lon.toFixed(6);

  if (isAndroid) {
    // 1. Android Intent: Opens Google Maps app directly in active turn-by-turn voice navigation mode
    const intentUrl = `google.navigation:q=${cleanLat},${cleanLon}&mode=d`;
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${cleanLat},${cleanLon}&travelmode=driving`;

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
      // If the app is hidden, native Google Maps successfully launched — cancel web tab
      if (document.hidden) {
        cleanup();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', cleanup, { once: true });

    // Attempt native intent
    window.location.href = intentUrl;

    // Safety fallback: only if the app remains in the foreground after 1000ms
    fallbackTimer = setTimeout(() => {
      cleanup();
      if (!document.hidden) {
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }
    }, 1000);
  } else if (isIOS) {
    // Apple Maps turn-by-turn driving directions
    const appleUrl = `https://maps.apple.com/?daddr=${cleanLat},${cleanLon}&dirflg=d`;
    window.open(appleUrl, '_blank', 'noopener,noreferrer');
  } else {
    // Desktop & universal Web Google Maps driving directions
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${cleanLat},${cleanLon}&travelmode=driving`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openGoogleMapsRoute(originLat: number, originLon: number, destLat: number, destLon: number): void {
  const cleanOrigin = `${originLat.toFixed(6)},${originLon.toFixed(6)}`;
  const cleanDest = `${destLat.toFixed(6)},${destLon.toFixed(6)}`;
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

    // Direct voice turn-by-turn to destination
    window.location.href = `google.navigation:q=${cleanDest}&mode=d`;
    fallbackTimer = setTimeout(() => {
      cleanup();
      if (!document.hidden) {
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`, '_blank', 'noopener,noreferrer');
      }
    }, 1000);
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
    // On Android, opening https://www.google.com/maps/dir/?... hands off natively to Google Maps app with full stops
    window.location.href = mapsUrl;
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

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

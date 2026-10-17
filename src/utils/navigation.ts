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

    // Attempt native intent
    window.location.href = intentUrl;

    // Safety timeout fallback: if intent didn't launch native app within 600ms, open web Google Maps
    setTimeout(() => {
      window.open(webFallback, '_blank', 'noopener,noreferrer');
    }, 600);
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
    // Direct voice turn-by-turn to destination
    window.location.href = `google.navigation:q=${cleanDest}&mode=d`;
    setTimeout(() => {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`, '_blank', 'noopener,noreferrer');
    }, 600);
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${cleanOrigin}&destination=${cleanDest}&travelmode=driving`, '_blank', 'noopener,noreferrer');
  }
}

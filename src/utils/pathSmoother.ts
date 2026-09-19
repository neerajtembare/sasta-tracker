import { TrackPoint } from '../types';

/**
 * Catmull-Rom Spline interpolation between GPS points
 * Creates smooth curved trajectories between coarse GPS fixes
 */
export function interpolateTrackPoints(points: TrackPoint[], targetSpacingMeters: number = 20): TrackPoint[] {
  if (points.length < 2) return points;

  const result: TrackPoint[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    // Approximate distance between p1 and p2 in meters
    const dLat = (p2.lat - p1.lat) * 111320;
    const dLon = (p2.lon - p1.lon) * 111320 * Math.cos(((p1.lat + p2.lat) * Math.PI) / 360);
    const distM = Math.sqrt(dLat * dLat + dLon * dLon);

    // If points are a pit stop gap (> 5km jump or > 10 mins apart), don't interpolate wildly
    const t1 = p1.time ? new Date(p1.time).getTime() : 0;
    const t2 = p2.time ? new Date(p2.time).getTime() : 0;
    const dt = t1 && t2 ? Math.abs(t2 - t1) / 1000 : 0;

    const steps = Math.min(25, Math.max(1, Math.round(distM / targetSpacingMeters)));

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const tSq = t * t;
      const tCb = tSq * t;

      // Catmull-Rom spline formula
      const lat =
        0.5 *
        (2 * p1.lat +
          (-p0.lat + p2.lat) * t +
          (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * tSq +
          (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * tCb);

      const lon =
        0.5 *
        (2 * p1.lon +
          (-p0.lon + p2.lon) * t +
          (2 * p0.lon - 5 * p1.lon + 4 * p2.lon - p3.lon) * tSq +
          (-p0.lon + 3 * p1.lon - 3 * p2.lon + p3.lon) * tCb);

      const ele = p1.ele !== null && p2.ele !== null ? p1.ele + (p2.ele - p1.ele) * t : p1.ele;
      const speedKmh = p1.speedKmh + (p2.speedKmh - p1.speedKmh) * t;
      const bearing = p1.bearing !== null && p2.bearing !== null ? p1.bearing + (p2.bearing - p1.bearing) * t : p1.bearing;
      const dist = p1.distanceFromStartKm + (p2.distanceFromStartKm - p1.distanceFromStartKm) * t;
      const lean = (p1.estimatedLeanAngle || 0) + ((p2.estimatedLeanAngle || 0) - (p1.estimatedLeanAngle || 0)) * t;

      let interpolatedTime = p1.time;
      if (t1 && t2) {
        interpolatedTime = new Date(t1 + dt * 1000 * t).toISOString();
      }

      result.push({
        lat,
        lon,
        ele,
        time: interpolatedTime,
        speed: speedKmh / 3.6,
        speedKmh,
        bearing,
        sat: p1.sat,
        hdop: p1.hdop,
        vdop: p1.vdop,
        pdop: p1.pdop,
        geoidheight: p1.geoidheight,
        segmentIndex: p1.segmentIndex,
        distanceFromStartKm: dist,
        estimatedLeanAngle: lean,
      });
    }
  }

  // Push final point
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Snap GPS trace to OpenStreetMap road geometry using open-source OSRM matching
 */
export async function snapToRoadsOSRM(points: TrackPoint[]): Promise<{ lat: number; lon: number }[] | null> {
  if (points.length < 2) return null;

  try {
    // Sample up to 60 representative points to stay within public OSRM URL limits
    const sampleStep = Math.max(1, Math.floor(points.length / 60));
    const samplePoints = points.filter((_, idx) => idx % sampleStep === 0 || idx === points.length - 1);
    const coordsString = samplePoints.map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');

    const url = `https://router.project-osrm.org/match/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.code === 'Ok' && data.matchings && data.matchings[0]?.geometry?.coordinates) {
      const snappedCoords: [number, number][] = data.matchings[0].geometry.coordinates;
      return snappedCoords.map(([lon, lat]) => ({ lat, lon }));
    }
  } catch (err) {
    console.warn('OSRM Map Matching failed (likely network or rate limit), falling back to raw/spline path', err);
  }
  return null;
}

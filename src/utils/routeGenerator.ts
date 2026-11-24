import { RideAnalysis, TrackPoint, Segment, PitStop } from '../types';
import { haversineDistance, calculateForwardBearing } from './gpxParser';

export interface RouteTurnStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  type?: string;
  modifier?: string;
  location: [number, number]; // [lon, lat]
}

export interface RouteStopInput {
  lat: number;
  lon: number;
  name?: string;
}

export interface GenerateRoadRouteOptions {
  waypoints?: RouteStopInput[];
  originName?: string;
}

export interface GeneratedRouteResult {
  analysis: RideAnalysis;
  steps: RouteTurnStep[];
  isFallbackStraightLine: boolean;
  destinationName: string;
  destinationCoords: { lat: number; lon: number };
}

function buildWaypointPitStops(
  waypoints: RouteStopInput[],
  points: TrackPoint[],
  nowMs: number
): PitStop[] {
  return waypoints.map((wp, idx) => {
    // Find nearest point along route to compute cumulative distanceKm
    let bestDistKm = 0;
    let bestDelta = Infinity;
    for (const pt of points) {
      const d = haversineDistance(pt.lat, pt.lon, wp.lat, wp.lon);
      if (d < bestDelta) {
        bestDelta = d;
        bestDistKm = pt.distanceFromStartKm;
      }
    }
    return {
      id: `gmaps-stop-${idx + 1}-${nowMs}`,
      category: 'other',
      name: `Stop ${idx + 1}: ${wp.name || `Waypoint ${idx + 1}`}`,
      notes: 'Google Maps route stop',
      lat: wp.lat,
      lon: wp.lon,
      ele: 0,
      startTime: new Date(nowMs).toISOString(),
      locationName: wp.name,
      durationSeconds: 0,
      segmentIndex: 0,
      distanceKm: bestDistKm,
      isAutoDetected: false,
    };
  });
}

/**
 * Calls OSRM Driving router to compute real road geometry, multi-stop waypoints, and turn steps
 * between origin/current location and the Google Maps destination.
 */
export async function generateRoadRoute(
  start: { lat: number; lon: number },
  destination: { lat: number; lon: number; name?: string },
  options?: GenerateRoadRouteOptions
): Promise<GeneratedRouteResult> {
  const destName = destination.name || 'Target Destination';
  const coords = { lat: destination.lat, lon: destination.lon };
  const waypoints = (options?.waypoints || []).filter(
    w => !isNaN(w.lat) && !isNaN(w.lon) && !(w.lat === 0 && w.lon === 0)
  );
  const allStops: RouteStopInput[] = [
    { lat: start.lat, lon: start.lon, name: options?.originName },
    ...waypoints,
    { lat: coords.lat, lon: coords.lon, name: destName },
  ];

  try {
    const coordParam = allStops.map(s => `${s.lon},${s.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson&steps=true`;
    
    const resp = await fetch(osrmUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const geoPoints: [number, number][] = route.geometry.coordinates; // [lon, lat]
        const totalDistanceKm = Number((route.distance / 1000).toFixed(2));
        const totalDurationSeconds = Math.round(route.duration);

        const steps: RouteTurnStep[] = [];
        if (Array.isArray(route.legs)) {
          for (const leg of route.legs) {
            if (leg && Array.isArray(leg.steps)) {
              for (const s of leg.steps) {
                steps.push({
                  instruction: s.maneuver?.type 
                    ? `${s.maneuver.type} ${s.maneuver.modifier || ''}`.trim()
                    : s.name || 'Continue',
                  distanceMeters: Math.round(s.distance),
                  durationSeconds: Math.round(s.duration),
                  name: s.name || '',
                  type: s.maneuver?.type,
                  modifier: s.maneuver?.modifier,
                  location: s.maneuver?.location || [0, 0],
                });
              }
            }
          }
        }

        // Convert coordinates to TrackPoint
        const now = Date.now();
        let cumulativeDistKm = 0;
        const points: TrackPoint[] = geoPoints.map((coord, idx) => {
          if (idx > 0) {
            const prev = geoPoints[idx - 1];
            cumulativeDistKm += haversineDistance(prev[1], prev[0], coord[1], coord[0]) / 1000;
          }
          return {
            lat: coord[1],
            lon: coord[0],
            ele: 0,
            time: new Date(now + idx * 1000).toISOString(),
            speed: 0,
            speedKmh: 0,
            bearing: idx < geoPoints.length - 1 ? calculateForwardBearing(coord[1], coord[0], geoPoints[idx + 1][1], geoPoints[idx + 1][0]) : null,
            sat: 12,
            hdop: 1.0,
            vdop: 1.0,
            pdop: 1.0,
            geoidheight: null,
            segmentIndex: 0,
            distanceFromStartKm: Number(cumulativeDistKm.toFixed(3)),
            estimatedLeanAngle: 0,
          };
        });

        const pitStops = buildWaypointPitStops(waypoints, points, now);

        const segment: Segment = {
          index: 0,
          points,
          distanceKm: totalDistanceKm,
          durationSeconds: totalDurationSeconds,
          movingTimeSeconds: totalDurationSeconds,
          avgSpeedKmh: totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0,
          maxSpeedKmh: 0,
          elevGain: 0,
          elevLoss: 0,
        };

        const analysis: RideAnalysis = {
          name: destName,
          points,
          segments: [segment],
          totalDistanceKm,
          totalDurationSeconds,
          movingTimeSeconds: totalDurationSeconds,
          stoppedTimeSeconds: 0,
          overallAvgSpeedKmh: totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0,
          movingAvgSpeedKmh: totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0,
          maxSpeedKmh: 0,
          elevGainM: 0,
          elevLossM: 0,
          elevMinM: 0,
          elevMaxM: 0,
          elevStartM: 0,
          elevEndM: 0,
          startTime: new Date(now).toISOString(),
          endTime: new Date(now + totalDurationSeconds * 1000).toISOString(),
          avgSatellites: 12,
          maxSatellites: 12,
          bestHdop: 1.0,
          maxEstimatedLean: 0,
          pitStops,
          speedTraps: [],
          splits: [],
        };

        return {
          analysis,
          steps,
          isFallbackStraightLine: false,
          destinationName: destName,
          destinationCoords: coords,
        };
      }
    }
  } catch (err) {
    console.warn('OSRM route computation failed, falling back to direct line:', err);
  }

  // Fallback: Straight-line multi-stop interpolation
  return generateDirectLineFallback(allStops, coords, destName, waypoints);
}

/**
 * Straight line interpolation fallback across all stops for offline or failed routing calls
 */
function generateDirectLineFallback(
  allStops: RouteStopInput[],
  destination: { lat: number; lon: number },
  name: string,
  waypoints: RouteStopInput[] = []
): GeneratedRouteResult {
  let totalDistKm = 0;
  for (let s = 1; s < allStops.length; s++) {
    totalDistKm += haversineDistance(allStops[s - 1].lat, allStops[s - 1].lon, allStops[s].lat, allStops[s].lon) / 1000;
  }
  const estSeconds = Math.round((totalDistKm / 50) * 3600); // assume 50 km/h average
  const now = Date.now();

  const points: TrackPoint[] = [];
  let runningDistKm = 0;
  const subStepsPerLeg = Math.max(4, Math.floor(20 / Math.max(1, allStops.length - 1)));

  for (let s = 1; s < allStops.length; s++) {
    const legStart = allStops[s - 1];
    const legEnd = allStops[s];
    const legDistKm = haversineDistance(legStart.lat, legStart.lon, legEnd.lat, legEnd.lon) / 1000;
    const legBearing = calculateForwardBearing(legStart.lat, legStart.lon, legEnd.lat, legEnd.lon);
    const startIdx = s === 1 ? 0 : 1;

    for (let i = startIdx; i <= subStepsPerLeg; i++) {
      const fraction = i / subStepsPerLeg;
      const lat = legStart.lat + (legEnd.lat - legStart.lat) * fraction;
      const lon = legStart.lon + (legEnd.lon - legStart.lon) * fraction;
      points.push({
        lat,
        lon,
        ele: 0,
        time: new Date(now + points.length * 1000).toISOString(),
        speed: 0,
        speedKmh: 0,
        bearing: legBearing,
        sat: 12,
        hdop: 1.0,
        vdop: 1.0,
        pdop: 1.0,
        geoidheight: null,
        segmentIndex: 0,
        distanceFromStartKm: Number((runningDistKm + legDistKm * fraction).toFixed(3)),
        estimatedLeanAngle: 0,
      });
    }
    runningDistKm += legDistKm;
  }

  const pitStops = buildWaypointPitStops(waypoints, points, now);

  const segment: Segment = {
    index: 0,
    points,
    distanceKm: Number(totalDistKm.toFixed(2)),
    durationSeconds: estSeconds,
    movingTimeSeconds: estSeconds,
    avgSpeedKmh: 50,
    maxSpeedKmh: 50,
    elevGain: 0,
    elevLoss: 0,
  };

  const analysis: RideAnalysis = {
    name,
    points,
    segments: [segment],
    totalDistanceKm: Number(totalDistKm.toFixed(2)),
    totalDurationSeconds: estSeconds,
    movingTimeSeconds: estSeconds,
    stoppedTimeSeconds: 0,
    overallAvgSpeedKmh: 50,
    movingAvgSpeedKmh: 50,
    maxSpeedKmh: 50,
    elevGainM: 0,
    elevLossM: 0,
    elevMinM: 0,
    elevMaxM: 0,
    elevStartM: 0,
    elevEndM: 0,
    startTime: new Date(now).toISOString(),
    endTime: new Date(now + estSeconds * 1000).toISOString(),
    avgSatellites: 12,
    maxSatellites: 12,
    bestHdop: 1.0,
    maxEstimatedLean: 0,
    pitStops,
    speedTraps: [],
    splits: [],
  };

  return {
    analysis,
    steps: [
      {
        instruction: `Direct route to ${name}`,
        distanceMeters: Math.round(totalDistKm * 1000),
        durationSeconds: estSeconds,
        name,
        location: [destination.lon, destination.lat],
      },
    ],
    isFallbackStraightLine: true,
    destinationName: name,
    destinationCoords: destination,
  };
}

/**
 * Calculates real-time distance remaining and target bearing to destination
 */
export function calculateNavGuidance(
  currentPos: { lat: number; lon: number } | null,
  destination: { lat: number; lon: number } | null,
  currentBearing: number | null = null
): {
  distanceRemainingKm: number;
  targetBearing: number;
  relativeTurnAngle: number;
  directionArrow: string;
} | null {
  if (!currentPos || !destination) return null;

  const distKm = haversineDistance(currentPos.lat, currentPos.lon, destination.lat, destination.lon) / 1000;
  const targetBearing = calculateForwardBearing(currentPos.lat, currentPos.lon, destination.lat, destination.lon);

  // Relative turn angle compared to current rider bearing
  let relative = 0;
  if (currentBearing !== null) {
    relative = (targetBearing - currentBearing + 360) % 360;
    if (relative > 180) relative -= 360;
  }

  let arrow = '▲';
  if (relative > 60 && relative <= 120) arrow = '▶';
  else if (relative > 120) arrow = '▼';
  else if (relative < -60 && relative >= -120) arrow = '◀';
  else if (relative < -120) arrow = '▼';
  else if (relative > 20) arrow = '↗';
  else if (relative < -20) arrow = '↖';

  return {
    distanceRemainingKm: Number(distKm.toFixed(2)),
    targetBearing: Math.round(targetBearing),
    relativeTurnAngle: Math.round(relative),
    directionArrow: arrow,
  };
}

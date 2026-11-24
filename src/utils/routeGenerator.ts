import { RideAnalysis, TrackPoint, Segment } from '../types';
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

export interface GeneratedRouteResult {
  analysis: RideAnalysis;
  steps: RouteTurnStep[];
  isFallbackStraightLine: boolean;
  destinationName: string;
  destinationCoords: { lat: number; lon: number };
}

/**
 * Calls OSRM Driving router to compute real road geometry and turn steps
 * between current rider location and the Google Maps destination.
 */
export async function generateRoadRoute(
  start: { lat: number; lon: number },
  destination: { lat: number; lon: number; name?: string }
): Promise<GeneratedRouteResult> {
  const destName = destination.name || 'Target Destination';
  const coords = { lat: destination.lat, lon: destination.lon };

  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${coords.lon},${coords.lat}?overview=full&geometries=geojson&steps=true`;
    
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
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          for (const s of route.legs[0].steps) {
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
          pitStops: [],
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

  // Fallback: Straight-line interpolation
  return generateDirectLineFallback(start, coords, destName);
}

/**
 * Straight line interpolation fallback for offline or failed routing calls
 */
function generateDirectLineFallback(
  start: { lat: number; lon: number },
  destination: { lat: number; lon: number },
  name: string
): GeneratedRouteResult {
  const distKm = haversineDistance(start.lat, start.lon, destination.lat, destination.lon) / 1000;
  const estSeconds = Math.round((distKm / 50) * 3600); // assume 50 km/h average
  const now = Date.now();

  const numSteps = 20;
  const points: TrackPoint[] = [];
  for (let i = 0; i <= numSteps; i++) {
    const fraction = i / numSteps;
    const lat = start.lat + (destination.lat - start.lat) * fraction;
    const lon = start.lon + (destination.lon - start.lon) * fraction;
    points.push({
      lat,
      lon,
      ele: 0,
      time: new Date(now + i * 1000).toISOString(),
      speed: 0,
      speedKmh: 0,
      bearing: calculateForwardBearing(start.lat, start.lon, destination.lat, destination.lon),
      sat: 12,
      hdop: 1.0,
      vdop: 1.0,
      pdop: 1.0,
      geoidheight: null,
      segmentIndex: 0,
      distanceFromStartKm: Number((distKm * fraction).toFixed(3)),
      estimatedLeanAngle: 0,
    });
  }

  const segment: Segment = {
    index: 0,
    points,
    distanceKm: Number(distKm.toFixed(2)),
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
    totalDistanceKm: Number(distKm.toFixed(2)),
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
    pitStops: [],
    speedTraps: [],
    splits: [],
  };

  return {
    analysis,
    steps: [
      {
        instruction: `Direct route to ${name}`,
        distanceMeters: Math.round(distKm * 1000),
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

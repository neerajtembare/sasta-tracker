import { TrackPoint, Segment, PitStop, SpeedTrap, RideAnalysis, RideSplit } from '../types';

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

<<<<<<< Updated upstream
=======
export function calculateForwardBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const y = Math.sin(dLon) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Industry-standard Hysteresis Elevation Filter (2.5m deadband) with 3-point smoothing.
 * Prevents small vertical GPS jitter from inflating flat highway rides with hundreds of meters of fake gain.
 */
export function calculateHysteresisElevation(
  elevations: (number | null)[],
  thresholdM: number = 2.5
): { gain: number; loss: number } {
  const validElevs: number[] = elevations.filter((e): e is number => e !== null && !isNaN(e));
  if (validElevs.length < 2) return { gain: 0, loss: 0 };

  // 3-point running weighted smoothing to filter out 1-second spike outliers
  const smoothed: number[] = [];
  for (let i = 0; i < validElevs.length; i++) {
    const prev = validElevs[Math.max(0, i - 1)];
    const curr = validElevs[i];
    const next = validElevs[Math.min(validElevs.length - 1, i + 1)];
    smoothed.push((prev + curr * 2 + next) / 4);
  }

  let gain = 0;
  let loss = 0;
  let anchor = smoothed[0];
  let peak = smoothed[0];
  let valley = smoothed[0];
  let trending: 'up' | 'down' | null = null;

  for (let i = 1; i < smoothed.length; i++) {
    const cur = smoothed[i];
    if (trending === 'up') {
      if (cur > peak) {
        peak = cur;
      } else if (peak - cur >= thresholdM) {
        gain += peak - valley;
        valley = cur;
        peak = cur;
        trending = 'down';
      }
    } else if (trending === 'down') {
      if (cur < valley) {
        valley = cur;
      } else if (cur - valley >= thresholdM) {
        loss += peak - valley;
        peak = cur;
        valley = cur;
        trending = 'up';
      }
    } else {
      if (cur - anchor >= thresholdM) {
        valley = anchor;
        peak = cur;
        trending = 'up';
      } else if (anchor - cur >= thresholdM) {
        peak = anchor;
        valley = cur;
        trending = 'down';
      }
    }
  }

  if (trending === 'up' && peak - valley >= thresholdM) {
    gain += peak - valley;
  } else if (trending === 'down' && peak - valley >= thresholdM) {
    loss += peak - valley;
  }

  return { gain: Math.round(gain), loss: Math.round(loss) };
}

>>>>>>> Stashed changes
export function parseGPX(xmlText: string, minStopSeconds: number = 300): RideAnalysis {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  let trackName = 'Track Ride';
  const nameEl = doc.querySelector('trk > name') || doc.querySelector('name');
  if (nameEl && nameEl.textContent) {
    trackName = nameEl.textContent.trim();
  }

  const trksegs = Array.from(doc.querySelectorAll('trkseg'));
  const segmentsData: { ptsElements: Element[] }[] = [];

  if (trksegs.length > 0) {
    trksegs.forEach(seg => {
      const pts = Array.from(seg.querySelectorAll('trkpt'));
      if (pts.length > 0) {
        segmentsData.push({ ptsElements: pts });
      }
    });
  }

  if (segmentsData.length === 0) {
    const allPts = Array.from(doc.querySelectorAll('trkpt, rtept'));
    if (allPts.length > 0) {
      segmentsData.push({ ptsElements: allPts });
    }
  }

  const allPoints: TrackPoint[] = [];
  const segments: Segment[] = [];
  let cumulativeDistMeters = 0;

  segmentsData.forEach((segData, segIndex) => {
    const segPoints: TrackPoint[] = [];
    let segDistM = 0;
    let segMovingTime = 0;
    let segElevGain = 0;
    let segElevLoss = 0;

    segData.ptsElements.forEach((ptEl, i) => {
      const lat = parseFloat(ptEl.getAttribute('lat') || '0');
      const lon = parseFloat(ptEl.getAttribute('lon') || '0');
      if (isNaN(lat) || isNaN(lon)) return;

      const eleEl = ptEl.querySelector('ele');
      const ele = eleEl && eleEl.textContent ? parseFloat(eleEl.textContent) : null;

      const timeEl = ptEl.querySelector('time');
      const time = timeEl && timeEl.textContent ? timeEl.textContent.trim() : null;

      const satEl = ptEl.querySelector('sat');
      const sat = satEl && satEl.textContent ? parseInt(satEl.textContent, 10) : null;

      const hdopEl = ptEl.querySelector('hdop');
      const hdop = hdopEl && hdopEl.textContent ? parseFloat(hdopEl.textContent) : null;

      const vdopEl = ptEl.querySelector('vdop');
      const vdop = vdopEl && vdopEl.textContent ? parseFloat(vdopEl.textContent) : null;

      const pdopEl = ptEl.querySelector('pdop');
      const pdop = pdopEl && pdopEl.textContent ? parseFloat(pdopEl.textContent) : null;

      const geoidEl = ptEl.querySelector('geoidheight');
      const geoidheight = geoidEl && geoidEl.textContent ? parseFloat(geoidEl.textContent) : null;

      // Extensions
      let speedMs: number | null = null;
      const speedEl = ptEl.querySelector('speed') || ptEl.querySelector('TrackPointExtension > speed');
      if (speedEl && speedEl.textContent) {
        speedMs = parseFloat(speedEl.textContent);
      }

      let bearingDeg: number | null = null;
      const bearingEl = ptEl.querySelector('bearing') || ptEl.querySelector('TrackPointExtension > bearing');
      if (bearingEl && bearingEl.textContent) {
        bearingDeg = parseFloat(bearingEl.textContent);
      }

      // Delta calculation with previous point
      if (i > 0) {
        const prev = segPoints[segPoints.length - 1];
        const stepDistM = haversineDistance(prev.lat, prev.lon, lat, lon);

        let dt = 0;
        if (time && prev.time) {
          dt = Math.max(0, (new Date(time).getTime() - new Date(prev.time).getTime()) / 1000);
        }

        if (speedMs === null || isNaN(speedMs)) {
          speedMs = dt > 0 ? stepDistM / dt : 0;
        }

<<<<<<< Updated upstream
        if (ele !== null && prev.ele !== null) {
          const deltaEle = ele - prev.ele;
          if (deltaEle > 0) segElevGain += deltaEle;
          else segElevLoss += Math.abs(deltaEle);
        }

        if (speedMs > 1.2) {
          segMovingTime += dt;
        }

        // Estimate lean angle from heading delta & speed
        let estLean = 0;
        if (bearingDeg !== null && prev.bearing !== null && dt > 0 && speedMs > 3) {
          let dHeading = Math.abs(bearingDeg - prev.bearing);
          if (dHeading > 180) dHeading = 360 - dHeading;
          const radPerSec = (dHeading * Math.PI) / (180 * dt);
          const lateralAcc = speedMs * radPerSec;
          estLean = Math.min(50, Math.round((Math.atan(lateralAcc / 9.81) * 180) / Math.PI));
=======
        // Outlier protection: if instantaneous speed exceeds 80 m/s (~288 km/h) due to GPS multipath jitter
        if (speedMs > 80 && prev.speed > 0) {
          speedMs = Math.min(speedMs, prev.speed * 1.4);
        }

        // Stationary Noise Gate: filter out random GPS walk when bike is parked/stopped (< 2.5m displacement and < 2.5 km/h)
        const isStationaryJitter = stepDistM < 2.5 && speedMs < 0.7;
        const effectiveStepDist = isStationaryJitter ? 0 : stepDistM;
        if (isStationaryJitter) {
          speedMs = 0;
        }

        segDistM += effectiveStepDist;
        cumulativeDistMeters += effectiveStepDist;

        if (bearingDeg === null) {
          if (stepDistM > 2.0) {
            bearingDeg = calculateForwardBearing(prev.lat, prev.lon, lat, lon);
          } else if (prev.bearing !== null) {
            bearingDeg = prev.bearing;
          }
        }

        if (speedMs >= 0.8) {
          const movingDt = dt > 60 ? Math.min(dt, effectiveStepDist / Math.max(speedMs, 1.2)) : dt;
          segMovingTime += movingDt;
        }

        // Raw instantaneous lean angle (speedMs >= 4.0 / ~14.4 km/h for gyroscopic motorcycle dynamics)
        let estLean = 0;
        if (bearingDeg !== null && prev.bearing !== null && dt > 0 && dt <= 5 && speedMs >= 4.0) {
          let diff = bearingDeg - prev.bearing;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          const radPerSec = (diff * Math.PI) / (180 * dt);
          const lateralAcc = speedMs * radPerSec;
          const leanDeg = (Math.atan(lateralAcc / 9.81) * 180) / Math.PI;
          estLean = Math.max(-52, Math.min(52, Math.round(leanDeg)));
>>>>>>> Stashed changes
        }

        const point: TrackPoint = {
          lat,
          lon,
          ele,
          time,
          speed: speedMs,
          speedKmh: speedMs * 3.6,
          bearing: bearingDeg,
          sat,
          hdop,
          vdop,
          pdop,
          geoidheight,
          segmentIndex: segIndex,
          distanceFromStartKm: cumulativeDistMeters / 1000,
          estimatedLeanAngle: estLean,
        };
        segPoints.push(point);
        allPoints.push(point);
      } else {
        // First point in this segment: if there was a previous segment, bridge continuous distance
        if (allPoints.length > 0) {
          const prevGlobal = allPoints[allPoints.length - 1];
          const bridgeDistM = haversineDistance(prevGlobal.lat, prevGlobal.lon, lat, lon);
          // Only bridge if reasonable (< 150 km)
          if (bridgeDistM < 150000) {
            cumulativeDistMeters += bridgeDistM;
          }
        }

        const point: TrackPoint = {
          lat,
          lon,
          ele,
          time,
          speed: speedMs || 0,
          speedKmh: (speedMs || 0) * 3.6,
          bearing: bearingDeg,
          sat,
          hdop,
          vdop,
          pdop,
          geoidheight,
          segmentIndex: segIndex,
          distanceFromStartKm: cumulativeDistMeters / 1000,
          estimatedLeanAngle: 0,
        };
        segPoints.push(point);
        allPoints.push(point);
      }
    });

    if (segPoints.length > 0) {
      const segStartTime = segPoints[0].time;
      const segEndTime = segPoints[segPoints.length - 1].time;
      const segStart = segStartTime ? new Date(segStartTime).getTime() : 0;
      const segEnd = segEndTime ? new Date(segEndTime).getTime() : 0;
      const segDuration = segStart && segEnd && !isNaN(segStart) && !isNaN(segEnd)
        ? Math.max(0, (segEnd - segStart) / 1000)
        : 0;
      const speeds = segPoints.map(p => p.speedKmh);
      const rawAvgSpeed = segDuration > 0 ? (segDistM / segDuration) * 3.6 : 0;
      const { gain: segElevGain, loss: segElevLoss } = calculateHysteresisElevation(
        segPoints.map(p => p.ele),
        2.5
      );

      segments.push({
        index: segIndex,
        points: segPoints,
        distanceKm: segDistM / 1000,
        durationSeconds: segDuration,
        movingTimeSeconds: segMovingTime,
<<<<<<< Updated upstream
        avgSpeedKmh: segDuration > 0 ? (segDistM / segDuration) * 3.6 : 0,
        maxSpeedKmh: speeds.length ? Math.max(...speeds) : 0,
=======
        avgSpeedKmh: isNaN(rawAvgSpeed) ? 0 : rawAvgSpeed,
        maxSpeedKmh: speeds.length ? speeds.reduce((max, v) => (v > max ? v : max), 0) : 0,
>>>>>>> Stashed changes
        elevGain: segElevGain,
        elevLoss: segElevLoss,
      });
    }
  });

  if (allPoints.length < 2) {
    throw new Error('Not enough track points found in GPX file.');
  }

  // 5-point rolling Gaussian smoothing for lean angles across all points
  // Eliminates 1-point heading noise spikes while preserving true twisty apexes
  if (allPoints.length > 4) {
    const rawLeans = allPoints.map(p => p.estimatedLeanAngle || 0);
    for (let i = 2; i < allPoints.length - 2; i++) {
      if (allPoints[i].speedKmh < 14) {
        allPoints[i].estimatedLeanAngle = 0;
        continue;
      }
      const smoothed =
        rawLeans[i - 2] * 0.1 +
        rawLeans[i - 1] * 0.2 +
        rawLeans[i] * 0.4 +
        rawLeans[i + 1] * 0.2 +
        rawLeans[i + 2] * 0.1;
      allPoints[i].estimatedLeanAngle = Math.max(-52, Math.min(52, Math.round(smoothed)));
    }
  }

  // Calculate overall metrics
  const totalDistanceKm = cumulativeDistMeters / 1000;
  const startTime = allPoints[0].time;
  const endTime = allPoints[allPoints.length - 1].time;
  const startTs = startTime ? new Date(startTime).getTime() : 0;
  const endTs = endTime ? new Date(endTime).getTime() : 0;
  const totalDurationSeconds = startTs && endTs && !isNaN(startTs) && !isNaN(endTs)
    ? Math.max(0, (endTs - startTs) / 1000)
    : 0;

  const movingTimeSeconds = segments.reduce((sum, s) => sum + s.movingTimeSeconds, 0);
  const stoppedTimeSeconds = Math.max(0, totalDurationSeconds - movingTimeSeconds);

<<<<<<< Updated upstream
  const allSpeeds = allPoints.map(p => p.speedKmh);
  const maxSpeedKmh = allSpeeds.length ? Math.max(...allSpeeds) : 0;
  const overallAvgSpeedKmh = totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0;
  const movingAvgSpeedKmh = movingTimeSeconds > 0 ? (totalDistanceKm / (movingTimeSeconds / 3600)) : overallAvgSpeedKmh;
=======
  const maxSpeedKmh = allPoints.length ? allPoints.reduce((max, p) => (p.speedKmh > max ? p.speedKmh : max), 0) : 0;
  const rawOverallAvg = totalDurationSeconds > 0 ? (totalDistanceKm / (totalDurationSeconds / 3600)) : 0;
  const overallAvgSpeedKmh = isNaN(rawOverallAvg) ? 0 : rawOverallAvg;
  const rawMovingAvg = movingTimeSeconds > 0 ? (totalDistanceKm / (movingTimeSeconds / 3600)) : overallAvgSpeedKmh;
  const movingAvgSpeedKmh = isNaN(rawMovingAvg) ? 0 : rawMovingAvg;
>>>>>>> Stashed changes

  const elevations = allPoints.map(p => p.ele).filter((e): e is number => e !== null);
  const elevMinM = elevations.length ? Math.min(...elevations) : null;
  const elevMaxM = elevations.length ? Math.max(...elevations) : null;
  const elevGainM = segments.reduce((sum, s) => sum + s.elevGain, 0);
  const elevLossM = segments.reduce((sum, s) => sum + s.elevLoss, 0);

  const satellites = allPoints.map(p => p.sat).filter((s): s is number => s !== null && s > 0);
  const avgSatellites = satellites.length ? Math.round(satellites.reduce((a, b) => a + b, 0) / satellites.length) : null;
  const maxSatellites = satellites.length ? Math.max(...satellites) : null;

  const hdops = allPoints.map(p => p.hdop).filter((h): h is number => h !== null && h > 0);
  const bestHdop = hdops.length ? Math.min(...hdops) : null;

  const leanAngles = allPoints.map(p => p.estimatedLeanAngle || 0);
  const maxEstimatedLean = leanAngles.length ? Math.max(...leanAngles) : 0;

  // Robust Automated Stop Detection Algorithm (> 5 minutes / 300 seconds)
  // Flags gaps in activity longer than 5 minutes for user review/categorization
  const rawStops: Array<{
    startTime: string | null;
    durationSeconds: number;
    lat: number;
    lon: number;
    ele: number | null;
    segmentIndex: number;
    distanceKm: number;
    isCluster: boolean;
  }> = [];

  // Pass A: Explicit timestamp gaps between consecutive points (>= minStopSeconds)
  for (let i = 1; i < allPoints.length; i++) {
    const prev = allPoints[i - 1];
    const curr = allPoints[i];
    if (prev.time && curr.time) {
      const gapSec = (new Date(curr.time).getTime() - new Date(prev.time).getTime()) / 1000;
      if (gapSec >= minStopSeconds) {
        rawStops.push({
          startTime: prev.time,
          durationSeconds: gapSec,
          lat: prev.lat,
          lon: prev.lon,
          ele: prev.ele,
          segmentIndex: prev.segmentIndex,
          distanceKm: prev.distanceFromStartKm,
          isCluster: false,
        });
      }
    }
  }

  // Pass B: Continuous stationary clusters (< 2.5 km/h) lasting >= minStopSeconds
  let clusterStartIndex = -1;
  for (let i = 0; i < allPoints.length; i++) {
    const pt = allPoints[i];
    const isStationary = pt.speedKmh <= 2.5;

    if (isStationary) {
      if (clusterStartIndex === -1) {
        clusterStartIndex = i;
      }
    } else {
      if (clusterStartIndex !== -1) {
        const pStart = allPoints[clusterStartIndex];
        const pEnd = allPoints[i - 1];
        if (pStart.time && pEnd.time) {
          const duration = (new Date(pEnd.time).getTime() - new Date(pStart.time).getTime()) / 1000;
          if (duration >= minStopSeconds) {
            // Calculate centroid coordinates of the cluster
            let sumLat = 0;
            let sumLon = 0;
            const count = i - clusterStartIndex;
            for (let c = clusterStartIndex; c < i; c++) {
              sumLat += allPoints[c].lat;
              sumLon += allPoints[c].lon;
            }
            rawStops.push({
              startTime: pStart.time,
              durationSeconds: duration,
              lat: sumLat / count,
              lon: sumLon / count,
              ele: pStart.ele,
              segmentIndex: pStart.segmentIndex,
              distanceKm: pStart.distanceFromStartKm,
              isCluster: true,
            });
          }
        }
        clusterStartIndex = -1;
      }
    }
  }

  // Check tail cluster if ride ended stationary
  if (clusterStartIndex !== -1) {
    const pStart = allPoints[clusterStartIndex];
    const pEnd = allPoints[allPoints.length - 1];
    if (pStart.time && pEnd.time) {
      const duration = (new Date(pEnd.time).getTime() - new Date(pStart.time).getTime()) / 1000;
      if (duration >= minStopSeconds) {
        rawStops.push({
          startTime: pStart.time,
          durationSeconds: duration,
          lat: pStart.lat,
          lon: pStart.lon,
          ele: pStart.ele,
          segmentIndex: pStart.segmentIndex,
          distanceKm: pStart.distanceFromStartKm,
          isCluster: true,
        });
      }
    }
  }

  // Merge stops within 150m of each other to avoid duplicate tags
  const mergedStops: typeof rawStops = [];
  rawStops.forEach(candidate => {
    const existing = mergedStops.find(
      s => haversineDistance(s.lat, s.lon, candidate.lat, candidate.lon) < 150
    );
    if (existing) {
      existing.durationSeconds = Math.max(existing.durationSeconds, candidate.durationSeconds);
    } else {
      mergedStops.push({ ...candidate });
    }
  });

  // Convert to formatted PitStops with clear categorization
  const pitStops: PitStop[] = mergedStops.map((stop, idx) => {
    let category: PitStop['category'] = 'rest';
    let label = 'Rest Break';

    if (stop.durationSeconds >= 1800) {
      category = 'dhaba';
      label = 'Meal / Extended Break';
    } else if (stop.durationSeconds >= 600) {
      category = 'rest';
      label = 'Stationary Halt';
    } else {
      category = 'rest';
      label = 'Quick Stop';
    }

    if (stop.ele !== null && elevMaxM !== null && stop.ele >= elevMaxM - 35) {
      category = 'scenic';
      label = 'Highpoint Stop';
    }

    let stopEndTime: string | null = null;
    if (stop.startTime) {
      try {
        const startMillis = new Date(stop.startTime).getTime();
        if (!isNaN(startMillis)) {
          stopEndTime = new Date(startMillis + stop.durationSeconds * 1000).toISOString();
        }
      } catch {
        // ignore invalid date strings gracefully
      }
    }

    return {
      id: `stop-${idx + 1}`,
      category,
      name: `${label} (${Math.round(stop.durationSeconds / 60)}m)`,
      notes: 'Auto-detected gap in activity (>5 min). Tap to categorize.',
      lat: stop.lat,
      lon: stop.lon,
      ele: stop.ele,
      startTime: stop.startTime,
      endTime: stopEndTime,
      durationSeconds: stop.durationSeconds,
      segmentIndex: stop.segmentIndex,
      distanceKm: stop.distanceKm,
      isAutoDetected: true,
    };
  });

  // Parse explicit GPX waypoints (<wpt>) so user-marked stops during live rides or imported files are never lost
  const wptEls = Array.from(doc.querySelectorAll('wpt'));
  const explicitWaypoints: PitStop[] = [];
  wptEls.forEach((wptEl, idx) => {
    const lat = parseFloat(wptEl.getAttribute('lat') || '0');
    const lon = parseFloat(wptEl.getAttribute('lon') || '0');
    if (isNaN(lat) || isNaN(lon)) return;

    const nameEl = wptEl.querySelector('name');
    const name = nameEl?.textContent?.trim() || `Waypoint #${idx + 1}`;

    const descEl = wptEl.querySelector('desc') || wptEl.querySelector('cmt');
    const notes = descEl?.textContent?.trim() || '';

    const eleEl = wptEl.querySelector('ele');
    const ele = eleEl && eleEl.textContent ? parseFloat(eleEl.textContent) : null;

    const timeEl = wptEl.querySelector('time');
    const time = timeEl?.textContent?.trim() || null;

    // Detect category from name or desc
    const lower = (name + ' ' + notes).toLowerCase();
    let category: PitStop['category'] = 'other';
    if (lower.includes('chai') || lower.includes('tea') || lower.includes('coffee')) category = 'chai';
    else if (lower.includes('fuel') || lower.includes('petrol') || lower.includes('gas') || lower.includes('station')) category = 'fuel';
    else if (lower.includes('dhaba') || lower.includes('food') || lower.includes('lunch') || lower.includes('breakfast') || lower.includes('meal') || lower.includes('hotel') || lower.includes('restaurant')) category = 'dhaba';
    else if (lower.includes('photo') || lower.includes('view') || lower.includes('scenic') || lower.includes('camera') || lower.includes('ghat') || lower.includes('pass')) category = 'scenic';
    else if (lower.includes('mechanic') || lower.includes('puncture') || lower.includes('repair') || lower.includes('service')) category = 'mechanic';
    else if (lower.includes('rest') || lower.includes('break') || lower.includes('stop')) category = 'rest';
    else if (lower.includes('traffic') || lower.includes('toll')) category = 'traffic';

    // Find nearest track point to determine distance along route
    let minD = Infinity;
    let nearestDistKm = 0;
    let nearestSegIdx = 0;
    for (const p of allPoints) {
      const d = haversineDistance(lat, lon, p.lat, p.lon);
      if (d < minD) {
        minD = d;
        nearestDistKm = p.distanceFromStartKm;
        nearestSegIdx = p.segmentIndex;
      }
    }

    explicitWaypoints.push({
      id: `wpt-${idx + 1}-${Math.round(lat * 1000)}`,
      category,
      name,
      notes: notes || 'User tagged waypoint in GPX.',
      lat,
      lon,
      ele,
      startTime: time,
      durationSeconds: 0,
      segmentIndex: nearestSegIdx,
      distanceKm: Math.round(nearestDistKm * 10) / 10,
      isAutoDetected: false,
    });
  });

  // Merge explicit waypoints with auto-detected stops (prefer user waypoint label if within 250m)
  const combinedPitStops: PitStop[] = [...pitStops];
  explicitWaypoints.forEach(wpt => {
    const existing = combinedPitStops.find(
      s => haversineDistance(s.lat, s.lon, wpt.lat, wpt.lon) < 250
    );
    if (existing) {
      existing.name = wpt.name;
      existing.category = wpt.category;
      if (wpt.notes) existing.notes = wpt.notes;
      existing.isAutoDetected = false;
    } else {
      combinedPitStops.push(wpt);
    }
  });

  combinedPitStops.sort((a, b) => a.distanceKm - b.distanceKm);

  // Detect Peak Speed Zones (Clean rank without P1/P4 nomenclature)
  const sortedPoints = [...allPoints]
    .filter(p => p.speedKmh > 20)
    .sort((a, b) => b.speedKmh - a.speedKmh);

  const speedTraps: SpeedTrap[] = [];
  for (const pt of sortedPoints) {
    if (speedTraps.length >= 5) break;
    // ensure at least 1.5km spacing between speed peaks
    const tooClose = speedTraps.some(
      trap => Math.abs(trap.distanceKm - pt.distanceFromStartKm) < 1.5
    );
    if (!tooClose) {
      const rank = `#${speedTraps.length + 1}`;
      speedTraps.push({
        position: rank,
        speedKmh: Math.round(pt.speedKmh * 10) / 10,
        lat: pt.lat,
        lon: pt.lon,
        ele: pt.ele,
        time: pt.time,
        distanceKm: Math.round(pt.distanceFromStartKm * 10) / 10,
        deltaLabel: speedTraps.length === 0 ? 'Peak Speed' : `-${(speedTraps[0].speedKmh - pt.speedKmh).toFixed(1)} km/h`,
      });
    }
  }

  // Generate Strava-style distance splits (e.g. 25km intervals, or 10km if route < 60km)
  const splitIntervalKm = totalDistanceKm > 60 ? 25 : 10;
  const splits: RideSplit[] = [];
  let splitStartKm = 0;
  let splitNum = 1;

  while (splitStartKm < totalDistanceKm) {
    const splitEndKm = Math.min(totalDistanceKm, splitStartKm + splitIntervalKm);
    const splitPts = allPoints.filter(
      p => p.distanceFromStartKm >= splitStartKm && p.distanceFromStartKm <= splitEndKm
    );

    if (splitPts.length >= 2) {
      let splitMovingSec = 0;
      let splitGainM = 0;
      for (let s = 1; s < splitPts.length; s++) {
        const p1 = splitPts[s - 1];
        const p2 = splitPts[s];
        if (p1.time && p2.time) {
          const dt = Math.max(0, (new Date(p2.time).getTime() - new Date(p1.time).getTime()) / 1000);
          if (p2.speedKmh > 2.5) {
            splitMovingSec += dt;
          }
        }
        if (p1.ele !== null && p2.ele !== null && p2.ele > p1.ele) {
          splitGainM += p2.ele - p1.ele;
        }
      }
      const dist = splitEndKm - splitStartKm;
      const avgSpd = splitMovingSec > 0 ? dist / (splitMovingSec / 3600) : 0;

      splits.push({
        splitIndex: splitNum,
        label: `km ${splitStartKm.toFixed(0)} – ${splitEndKm.toFixed(0)}`,
        distanceKm: Math.round(dist * 10) / 10,
        movingTimeSeconds: Math.round(splitMovingSec),
        avgSpeedKmh: Math.round(avgSpd * 10) / 10,
        elevGainM: Math.round(splitGainM),
      });
      splitNum++;
    }
    splitStartKm = splitEndKm;
  }

  return {
    name: trackName,
    points: allPoints,
    segments,
    totalDistanceKm,
    totalDurationSeconds,
    movingTimeSeconds,
    stoppedTimeSeconds,
    overallAvgSpeedKmh,
    movingAvgSpeedKmh,
    maxSpeedKmh,
    elevGainM,
    elevLossM,
    elevMinM,
    elevMaxM,
    elevStartM: allPoints[0].ele,
    elevEndM: allPoints[allPoints.length - 1].ele,
    startTime,
    endTime,
    avgSatellites,
    maxSatellites,
    bestHdop,
    maxEstimatedLean,
    pitStops: combinedPitStops,
    speedTraps,
    splits,
  };
}

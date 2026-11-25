import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim } from './domShim.ts';

installDomShim();

import {
  haversineDistance,
  calculateForwardBearing,
  calculateHysteresisElevation,
  parseGPX,
  guessActivity,
} from '../src/utils/gpxParser.ts';

test('haversineDistance and calculateForwardBearing compute expected geometry', () => {
  // ~111.19 km per degree latitude
  const distM = haversineDistance(18.0, 73.0, 19.0, 73.0);
  assert.ok(distM > 111000 && distM < 111400, `Unexpected lat distance: ${distM}`);

  assert.equal(haversineDistance(18.5, 73.8, 18.5, 73.8), 0);

  const dueNorth = calculateForwardBearing(18.0, 73.0, 19.0, 73.0);
  assert.ok(dueNorth < 0.5 || dueNorth > 359.5, `Expected ~0 deg North, got ${dueNorth}`);

  const dueEast = calculateForwardBearing(0, 0, 0, 1);
  assert.ok(Math.abs(dueEast - 90) < 0.5, `Expected ~90 deg East, got ${dueEast}`);
});

test('calculateHysteresisElevation suppresses jitter below threshold and sums real climbs', () => {
  // +/- 2m jitter stays below 4m hysteresis threshold -> 0 gain & 0 loss
  const noisy = [500, 502, 500, 501.5, 499.5, 501, 500];
  const jitterRes = calculateHysteresisElevation(noisy, 4.0);
  assert.equal(jitterRes.gain, 0);
  assert.equal(jitterRes.loss, 0);

  // +100m plateau climb followed by -60m plateau descent (accounts for 3-point smoothing & 4m hysteresis flip point)
  const climb = [500, 500, 500, 550, 600, 600, 600, 600, 570, 540, 540, 540];
  const climbRes = calculateHysteresisElevation(climb, 4.0);
  assert.equal(Math.round(climbRes.gain), 100);
  assert.equal(Math.round(climbRes.loss), 53);
});

test('parseGPX rejects malformed XML and null-island-only tracks', () => {
  assert.throws(() => parseGPX('<gpx><trk></gpx>'));

  const nullIslandGpx = `<?xml version="1.0"?>
  <gpx version="1.1">
    <trk><name>Null</name><trkseg>
      <trkpt lat="0" lon="0"><ele>10</ele><time>2026-09-19T01:00:00Z</time></trkpt>
      <trkpt lat="999" lon="73.8"><ele>10</ele><time>2026-09-19T01:00:05Z</time></trkpt>
    </trkseg></trk>
  </gpx>`;
  assert.throws(() => parseGPX(nullIslandGpx));
});

test('parseGPX clamps >65 m/s GPS teleport spikes and parses speeds, stops, and waypoints', () => {
  // Segment with: moving start, 1s teleport spike (>1000km away), stationary stop (>130s with minor jitter), moving end, + explicit waypoint
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
  <gpx version="1.1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2">
    <wpt lat="18.5005" lon="73.8000"><name>Chai Tapri Stop</name><desc>Hot tea</desc><ele>560</ele></wpt>
    <trk><name>Test Ghat Ride</name><trkseg>
      <trkpt lat="18.5000" lon="73.8000"><ele>550</ele><time>2026-09-19T06:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>12.0</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="18.5002" lon="73.8000"><ele>552</ele><time>2026-09-19T06:00:02Z</time></trkpt>
      <trkpt lat="18.5004" lon="73.8000"><ele>555</ele><time>2026-09-19T06:00:04Z</time></trkpt>
      <trkpt lat="28.5000" lon="77.2000"><ele>556</ele><time>2026-09-19T06:00:05Z</time></trkpt>
      <trkpt lat="28.50001" lon="77.20001"><ele>556</ele><time>2026-09-19T06:01:15Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>0.3</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="28.50002" lon="77.20002"><ele>556</ele><time>2026-09-19T06:03:20Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>0.2</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="28.5015" lon="77.2000"><ele>580</ele><time>2026-09-19T06:03:35Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:speed>11.0</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>
    </trkseg></trk>
  </gpx>`;

  const analysis = parseGPX(gpx, 90);
  assert.equal(analysis.name, 'Test Ghat Ride');
  assert.equal(analysis.points.length, 7);
  // Teleport jump (~1170 km in 1s) must be rejected/clamped well below 5 km total distance
  assert.ok(analysis.totalDistanceKm < 5, `Expected clamped distance < 5 km, got ${analysis.totalDistanceKm}`);
  // Outlier clamp caps 1-second teleport spike at prevSpeed + 12 m/s (~83 km/h) instead of unphysical thousands of km/h
  assert.ok(analysis.maxSpeedKmh > 35 && analysis.maxSpeedKmh < 100, `Unexpected maxSpeedKmh: ${analysis.maxSpeedKmh}`);
  // Explicit <wpt> preserved with auto-detected chai category + clustered stationary stop
  assert.ok(analysis.pitStops.some(s => s.category === 'chai' && s.name === 'Chai Tapri Stop'));
  assert.ok(analysis.pitStops.some(s => s.isAutoDetected && s.durationSeconds >= 90));
});

test('guessActivity identifies slow technical ADV/mountain motorcycling properly', () => {
  assert.equal(guessActivity(85, 145, 50).category, 'racing');
  assert.equal(guessActivity(19, 38, 42).category, 'motorbike');
  assert.equal(guessActivity(16, 28, 12).category, 'cycling');
  assert.equal(guessActivity(5, 7, 4).category, 'walking');
});

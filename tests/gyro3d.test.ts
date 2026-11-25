import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim, resetTestEnvironment } from './domShim.ts';

installDomShim();

import {
  getScreenGravityVector,
  createZeroCalibration,
  loadSavedCalibration,
  clearSavedCalibration,
  calculate3DOrientation,
  computeGpsCentrifugalLeanDeg,
  blendGpsCentrifugalLean,
} from '../src/utils/gyro3d.ts';

test('getScreenGravityVector returns unit vector across all screen angles', () => {
  for (const angle of [0, 90, 180, 270]) {
    const v = getScreenGravityVector(42, -17, angle);
    const mag = Math.hypot(v.x, v.y, v.z);
    assert.ok(Math.abs(mag - 1) < 1e-6, `Magnitude was ${mag} for angle ${angle}`);
  }
});

test('createZeroCalibration zeros out resting pose and persists to localStorage', () => {
  resetTestEnvironment();
  const cal = createZeroCalibration(55, 12, 0, 90);
  const loaded = loadSavedCalibration();
  assert.ok(loaded);
  assert.equal(loaded?.refBeta, 55);

  const atRest = calculate3DOrientation(55, 12, 90, cal, 'landscape');
  assert.equal(atRest.isCalibrated, true);
  assert.equal(atRest.leanAngle + 0, 0);
  assert.equal(atRest.pitchAngle + 0, 0);

  clearSavedCalibration();
  assert.equal(loadSavedCalibration(), null);
});

test('calculate3DOrientation gives symmetric lean signs for left/right tilt in portrait & landscape', () => {
  const portraitCal = createZeroCalibration(60, 0, 0, 0);
  const leftTilt = calculate3DOrientation(60, -25, 0, portraitCal, 'portrait');
  const rightTilt = calculate3DOrientation(60, 25, 0, portraitCal, 'portrait');
  assert.equal(leftTilt.leanAngle, -rightTilt.leanAngle);
  assert.ok(rightTilt.leanAngle > 10);

  // Uncalibrated screen angle 0 vs 180 flip
  const p0 = calculate3DOrientation(45, 20, 0, null, 'portrait');
  const p180 = calculate3DOrientation(45, 20, 180, null, 'portrait');
  assert.equal(p0.leanAngle, 20);
  assert.equal(p180.leanAngle, -20);
});

test('computeGpsCentrifugalLeanDeg & blendGpsCentrifugalLean handle thresholds and signs safely', () => {
  // Below 12 km/h or null heading delta or out-of-range dt returns null
  assert.equal(computeGpsCentrifugalLeanDeg(8, 25, 1.0), null);
  assert.equal(computeGpsCentrifugalLeanDeg(60, null, 1.0), null);
  assert.equal(computeGpsCentrifugalLeanDeg(60, 15, 0.1), null);
  assert.equal(computeGpsCentrifugalLeanDeg(60, 15, 4.0), null);

  // 54 km/h = 15 m/s, 30 deg right turn over 2s -> omega = pi/12 rad/s -> atan(15 * 0.2618 / 9.80665) ~ 21.8 deg
  const rightTurn = computeGpsCentrifugalLeanDeg(54, 30, 2.0);
  const leftTurn = computeGpsCentrifugalLeanDeg(54, -30, 2.0);
  assert.ok(rightTurn !== null && rightTurn > 20 && rightTurn < 24, `Got ${rightTurn}`);
  assert.ok(leftTurn !== null && Math.abs(leftTurn + rightTurn) < 1e-6);

  const blended = blendGpsCentrifugalLean(30, 54, 30, 2.0);
  assert.ok(!Number.isNaN(blended) && blended >= 24 && blended <= 30, `Got ${blended}`);
  assert.equal(blendGpsCentrifugalLean(17, 5, 30, 1.0), 17);
});

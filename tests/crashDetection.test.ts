import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim, resetTestEnvironment, dispatchWindowEvent } from './domShim.ts';

installDomShim();

import { crashDetector, CrashEvent } from '../src/utils/crashDetection.ts';

test('crashDetector distinguishes gradual braking after pothole from abrupt post-impact stop', () => {
  resetTestEnvironment();
  const realNow = Date.now;
  let fakeNow = 1700000000000;
  Date.now = () => fakeNow;

  const detected: CrashEvent[] = [];
  try {
    crashDetector.setEnabled(true);
    assert.equal(crashDetector.isEnabled(), true);

    crashDetector.startListening(ev => detected.push(ev));

    // Riding at 48 km/h
    crashDetector.updateGpsSpeed(48);
    fakeNow += 500;
    crashDetector.updateGpsSpeed(46);

    // 7.2G spike (~70.6 m/s^2) triggers potential impact
    fakeNow += 100;
    dispatchWindowEvent('devicemotion', {
      accelerationIncludingGravity: { x: 70.6, y: 0, z: 0 },
    });

    // Gradual pothole braking scenario: rider stays > 8 km/h through first 2.6s
    fakeNow += 1500;
    crashDetector.updateGpsSpeed(24);
    fakeNow += 1400;
    crashDetector.updateGpsSpeed(12);
    fakeNow += 1400; // > 4000ms after impact -> verifyImpactOutcome runs
    crashDetector.updateGpsSpeed(2);

    assert.equal(detected.length, 0, 'Gradual pothole braking must not trigger SOS');

    // Now simulate severe crash: 7.5G while moving at 55 km/h followed by immediate stop
    fakeNow += 2000;
    crashDetector.updateGpsSpeed(55);
    fakeNow += 200;
    dispatchWindowEvent('devicemotion', {
      accelerationIncludingGravity: { x: 74.0, y: 0, z: 0 },
    });

    fakeNow += 1000;
    crashDetector.updateGpsSpeed(0);
    fakeNow += 1500; // settled window (>= 2000ms)
    crashDetector.updateGpsSpeed(0);
    fakeNow += 1700; // >= 4000ms post-impact
    crashDetector.updateGpsSpeed(0);

    assert.equal(detected.length, 1, 'Abrupt impact + standstill must trigger crash event');
    assert.ok(detected[0].peakG >= 6.5);
    assert.ok(detected[0].preImpactSpeedKmh >= 50);

    // 60s cooldown suppresses immediate duplicate external crash
    crashDetector.notifyExternalCrash({ timestamp: fakeNow, peakG: 8.1, preImpactSpeedKmh: 50 });
    assert.equal(detected.length, 1);

    // After 61s cooldown, notifyExternalCrash delivers when enabled, and ignores when disabled
    fakeNow += 61000;
    crashDetector.setEnabled(false);
    crashDetector.notifyExternalCrash({ timestamp: fakeNow, peakG: 8.5, preImpactSpeedKmh: 60 });
    assert.equal(detected.length, 1);

    crashDetector.setEnabled(true);
    crashDetector.notifyExternalCrash({ timestamp: fakeNow, peakG: 8.5, preImpactSpeedKmh: 60 });
    assert.equal(detected.length, 2);
  } finally {
    crashDetector.stopListening();
    crashDetector.setEnabled(true);
    Date.now = realNow;
  }
});

test('crashDetector triggers GNSS dropout crash when GPS fixes cease after high-G impact', t => {
  resetTestEnvironment();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1700000200000 });

  const detected: CrashEvent[] = [];
  try {
    crashDetector.setEnabled(true);
    crashDetector.startListening(ev => detected.push(ev));

    crashDetector.updateGpsSpeed(40);
    t.mock.timers.tick(200);
    dispatchWindowEvent('devicemotion', {
      accelerationIncludingGravity: { x: 0, y: 72, z: 0 },
    });

    // Advance past 4200ms autonomous watchdog timeout with no GPS fixes arriving (lastGpsUpdateTs is 4.5s stale >= 3.2s threshold)
    t.mock.timers.tick(4300);
    assert.equal(detected.length, 1);
  } finally {
    crashDetector.stopListening();
    t.mock.timers.reset();
  }
});

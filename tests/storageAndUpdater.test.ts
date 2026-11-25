import test from 'node:test';
import assert from 'node:assert/strict';
import { installDomShim, resetTestEnvironment } from './domShim.ts';

installDomShim();

import {
  saveRideToGarage,
  updateGarageRide,
  getGarageRides,
  deleteGarageRide,
  clearAllGarageRides,
  setGaragePin,
  hasGaragePin,
  getGaragePin,
  verifyGaragePin,
  lockGarageSession,
  isGarageLocked,
} from '../src/utils/storage.ts';
import {
  isNewerVersion,
  checkAppForUpdates,
  CURRENT_APP_VERSION,
} from '../src/utils/appUpdater.ts';
import { getBikeLifetimeStats } from '../src/utils/riderProfile.ts';
import { formatDurationSummary } from '../src/utils/units.ts';

test('Garage storage CRUD preserves createdAt when updating older rides', () => {
  resetTestEnvironment();
  clearAllGarageRides();

  const older = saveRideToGarage({
    name: 'Old Pass',
    distanceKm: 45,
    maxSpeedKmh: 88,
    durationSeconds: 3600,
    avgSpeedKmh: 45,
    gpxContent: '<gpx/>',
    createdAt: 1700000000000,
  });

  const newer = saveRideToGarage({
    name: 'Latest Twisties',
    distanceKm: 62,
    maxSpeedKmh: 102,
    durationSeconds: 4000,
    avgSpeedKmh: 55,
    gpxContent: '<gpx/>',
  });

  const renamed = updateGarageRide(older.id, { name: 'Renamed Old Pass' });
  assert.equal(renamed.length, 2);
  assert.equal(renamed[0].id, newer.id, 'Newest ride must remain first after editing older ride title');
  assert.equal(renamed[1].name, 'Renamed Old Pass');
  assert.equal(renamed[1].createdAt, 1700000000000);

  deleteGarageRide(newer.id);
  assert.equal(getGarageRides().length, 1);
  clearAllGarageRides();
});

test('Garage PIN uses salted hash, masks raw value, and enforces lock/unlock', () => {
  resetTestEnvironment();
  setGaragePin(null);
  assert.equal(hasGaragePin(), false);
  assert.equal(getGaragePin(), null);
  assert.equal(isGarageLocked(), false);

  setGaragePin('4321');
  assert.equal(hasGaragePin(), true);
  assert.equal(getGaragePin(), '[SET]');
  const storedRaw = localStorage.getItem('throttlelog_garage_pin_v2') || '';
  assert.ok(storedRaw.startsWith('v2:'), `Expected salted v2 hash, got ${storedRaw}`);
  assert.ok(!storedRaw.includes('4321'));

  lockGarageSession();
  assert.equal(isGarageLocked(), true);
  assert.equal(verifyGaragePin('0000'), false);
  assert.equal(isGarageLocked(), true);

  assert.equal(verifyGaragePin('4321'), true);
  assert.equal(isGarageLocked(), false);

  setGaragePin(null);
  assert.equal(hasGaragePin(), false);
});

test('appUpdater semver comparison and release API parsing handle updates and network errors', async () => {
  assert.equal(isNewerVersion('1.4.0', '1.3.0'), true);
  assert.equal(isNewerVersion('v1.10.0', '1.9.9'), true);
  assert.equal(isNewerVersion('1.4.0', '1.4.0'), false);
  assert.equal(isNewerVersion('1.3.9', '1.4.0'), false);

  const origFetch = globalThis.fetch;
  try {
    (globalThis as any).fetch = async () => ({
      ok: true,
      json: async () => ({
        tag_name: 'v9.9.1',
        name: 'ThrottleLog v9.9.1',
        body: 'Release notes',
        assets: [
          { name: 'throttlelog-debug.apk', browser_download_url: 'https://example.com/debug.apk' },
          { name: 'throttlelog.apk', browser_download_url: 'https://example.com/release.apk' },
        ],
      }),
    });

    const okRes = await checkAppForUpdates();
    assert.equal(okRes.updateAvailable, true);
    assert.equal(okRes.latestVersion, '9.9.1');
    assert.equal(okRes.downloadUrl, 'https://example.com/release.apk');

    (globalThis as any).fetch = async () => ({ ok: false });
    const errRes = await checkAppForUpdates();
    assert.equal(errRes.updateAvailable, false);
    assert.equal(errRes.currentVersion, CURRENT_APP_VERSION);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('getBikeLifetimeStats tracks short ride Saddle Time in exact seconds for concise formatting', () => {
  resetTestEnvironment();
  clearAllGarageRides();

  saveRideToGarage({
    name: 'Morning Chai Run',
    distanceKm: 4.5,
    maxSpeedKmh: 58,
    durationSeconds: 720,
    movingTimeSeconds: 615,
    avgSpeedKmh: 26,
    elevGainM: 35,
    gpxContent: '<gpx/>',
  });

  const stats = getBikeLifetimeStats();
  assert.equal(stats.totalRides, 1);
  assert.equal(stats.totalDurationSeconds, 720);
  assert.equal(stats.totalMovingSeconds, 615);
  assert.equal(formatDurationSummary(stats.totalDurationSeconds), '12m');
  clearAllGarageRides();
});

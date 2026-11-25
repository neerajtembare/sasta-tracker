import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseGoogleMapsCoordinates,
  parseGoogleMapsRoute,
  isShortOrRedirectGoogleUrl,
  extractUrlFromText,
} from '../src/utils/googleMapsParser.ts';

test('extractUrlFromText and isShortOrRedirectGoogleUrl detect share links cleanly', () => {
  const shared = 'Check out Tamhini Ghat ride https://maps.app.goo.gl/XyZ123?g_st=ac join fast!';
  assert.equal(extractUrlFromText(shared), 'https://maps.app.goo.gl/XyZ123?g_st=ac');
  assert.equal(isShortOrRedirectGoogleUrl('https://maps.app.goo.gl/XyZ123'), true);
  assert.equal(isShortOrRedirectGoogleUrl('https://goo.gl/maps/abc'), true);
  assert.equal(isShortOrRedirectGoogleUrl('https://www.google.com/maps/@18.44,73.42,14z'), false);
});

test('parseGoogleMapsCoordinates extracts single pins from !3d!4d, @lat,lon, ?q=, and geo URIs', () => {
  const pin3d4d = parseGoogleMapsCoordinates(
    'https://www.google.com/maps/place/Tamhini+Ghat/@18.4400,73.4200,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d18.4465!4d73.4291'
  );
  assert.ok(pin3d4d);
  assert.ok(Math.abs(pin3d4d.lat - 18.4465) < 1e-4);
  assert.ok(Math.abs(pin3d4d.lon - 73.4291) < 1e-4);

  const viewportOnly = parseGoogleMapsCoordinates('https://www.google.com/maps/@18.5204,73.8567,14z');
  assert.ok(viewportOnly);
  assert.equal(viewportOnly.lat, 18.5204);
  assert.equal(viewportOnly.lon, 73.8567);

  const qParam = parseGoogleMapsCoordinates('https://maps.google.com/?q=17.9237,73.6586');
  assert.ok(qParam);
  assert.equal(qParam.lat, 17.9237);

  const geoUri = parseGoogleMapsCoordinates('geo:18.4088,73.5042?q=18.4088,73.5042(Mulshi)');
  assert.ok(geoUri);
  assert.equal(geoUri.lat, 18.4088);
  assert.equal(geoUri.lon, 73.5042);

  assert.equal(parseGoogleMapsCoordinates('https://example.com/no-coords-here'), null);
});

test('parseGoogleMapsRoute parses API v1, legacy saddr/daddr, and multi-stop /dir/ URLs', () => {
  // 1. Directions API v1 with My Location + intermediate waypoints
  const apiUrl =
    'https://www.google.com/maps/dir/?api=1&origin=My+Location&destination=17.9237,73.6586&waypoints=Wai|Panchgani';
  const apiPlan = parseGoogleMapsRoute(apiUrl);
  assert.ok(apiPlan);
  assert.equal(apiPlan.isDirectionsRoute, true);
  assert.equal(apiPlan.startFromCurrentLocation, true);
  assert.equal(apiPlan.origin, undefined);
  assert.deepEqual(apiPlan.waypoints.map(w => w.name), ['Wai', 'Panchgani']);
  assert.equal(apiPlan.destination.lat, 17.9237);

  // 2. Legacy saddr/daddr multi-stop (+to:)
  const legacyUrl = 'https://maps.google.com/maps?saddr=Pune&daddr=Mulshi+to:Tamhini';
  const legacyPlan = parseGoogleMapsRoute(legacyUrl);
  assert.ok(legacyPlan);
  assert.equal(legacyPlan.startFromCurrentLocation, false);
  assert.equal(legacyPlan.origin?.name, 'Pune');
  assert.deepEqual(legacyPlan.waypoints.map(w => w.name), ['Mulshi']);
  assert.equal(legacyPlan.destination.name, 'Tamhini');

  // 3. Path-based /dir/ with Current location
  const pathUrl = 'https://www.google.com/maps/dir/Current+location/Paud/18.4450,73.4280/@18.44,73.42,12z';
  const pathPlan = parseGoogleMapsRoute(pathUrl);
  assert.ok(pathPlan);
  assert.equal(pathPlan.startFromCurrentLocation, true);
  assert.deepEqual(pathPlan.waypoints.map(w => w.name), ['Paud']);
  assert.equal(pathPlan.destination.lat, 18.445);
  assert.equal(pathPlan.destination.lon, 73.428);

  // 4. Non-route junk input rejected
  assert.equal(parseGoogleMapsRoute('not a url or route'), null);
});

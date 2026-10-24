/**
 * ThrottleLog — Convoy Safety & Audio Watchdog Engine
 * 
 * Specifically designed for motorcycle squad rides (5–6 friends riding together):
 * - Supports riders with handlebar phone mounts (visual + audio) AND riders with phones
 *   locked in pockets listening through Bluetooth helmet intercoms / TWS earbuds.
 * - Automatic background checks for:
 *   1. Low Battery Warnings (<= 15% and <= 8% critical, suppressed if plugged in bike charger)
 *   2. "Rabbit" / Runaway Ahead Alert (friend speeds > 1.2 km ahead of the pack)
 *   3. Left Behind / Separation Alert (friend > 1.0 km behind, distinguishing stopped vs cruising)
 *   4. Route Deviation Alert (> 450m cross-track deviation off loaded GPX track)
 *   5. Periodic 20-min Roll Call (non-annoying, motion-aware, checks pack spread & status)
 *   6. Manual On-Demand Roll Call trigger for lead rider
 */

import { GroupMemberInfo } from '../hooks/useGroupRide';
import { playWarningChime, playChime, triggerHaptic } from './audioChimes';
import { speakAlert } from './tts';

export interface ConvoyWatchdogOptions {
  myLocation: {
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
  } | null;
  myBattery?: {
    level?: number;
    isCharging?: boolean;
  };
  members: GroupMemberInfo[];
  activeRoutePoints?: Array<{ lat: number; lon: number }>;
  unitSystem?: 'metric' | 'imperial';
  onAlertBanner?: (alert: {
    title: string;
    message: string;
    icon: string;
    color: string;
    type: 'battery' | 'separation' | 'rabbit' | 'deviation' | 'rollcall';
  }) => void;
}

// ── Math & Geodesic Helpers ──────────────────────────────────────────

/**
 * Great-circle distance between two GPS coordinates in meters (Haversine)
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Initial bearing from coordinate 1 to coordinate 2 (0°–360°)
 */
export function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Cross-track perpendicular distance from a point to a polyline route in meters.
 * Employs flat equirectangular projection centered on the point for sub-millisecond execution.
 */
export function getCrossTrackDistanceMeters(
  pointLat: number,
  pointLon: number,
  routePoints: Array<{ lat: number; lon: number }>
): number {
  if (!routePoints || routePoints.length === 0) return 0;
  if (routePoints.length === 1) {
    return getDistanceMeters(pointLat, pointLon, routePoints[0].lat, routePoints[0].lon);
  }

  const cosLat = Math.cos((pointLat * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * cosLat;

  let minDistanceMeters = Infinity;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];

    // Local meter coordinates relative to point
    const x1 = (p1.lon - pointLon) * mPerDegLon;
    const y1 = (p1.lat - pointLat) * mPerDegLat;
    const x2 = (p2.lon - pointLon) * mPerDegLon;
    const y2 = (p2.lat - pointLat) * mPerDegLat;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const segLenSq = dx * dx + dy * dy;

    if (segLenSq < 1e-4) {
      const d = Math.sqrt(x1 * x1 + y1 * y1);
      if (d < minDistanceMeters) minDistanceMeters = d;
      continue;
    }

    // Project point (0, 0) onto segment [p1, p2]
    const t = Math.max(0, Math.min(1, (-x1 * dx - y1 * dy) / segLenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const d = Math.sqrt(projX * projX + projY * projY);

    if (d < minDistanceMeters) {
      minDistanceMeters = d;
    }
  }

  return minDistanceMeters;
}

/**
 * Format distance naturally for TTS speech synthesis and visual badges
 */
function formatSpokenDistance(meters: number, unitSystem: 'metric' | 'imperial' = 'metric'): string {
  if (unitSystem === 'imperial') {
    const feet = meters * 3.28084;
    if (feet < 1500) {
      return `${Math.round(feet / 50) * 50} feet`;
    }
    const miles = (meters * 0.000621371).toFixed(1);
    return `${miles} miles`;
  }

  if (meters < 1000) {
    return `${Math.round(meters / 50) * 50} meters`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} kilometers`;
}

// ── Watchdog Internal State & Cooldowns ──────────────────────────────

interface WatchdogState {
  // Battery debounces: Map<riderId, { lastWarning: number; lastCritical: number }>
  batteryDebounce: Map<string, { lastWarning: number; lastCritical: number }>;
  
  // Runaway / Rabbit debounces: Map<riderId, lastAlertTime>
  runawayDebounce: Map<string, number>;
  
  // Separation debounces: Map<riderId, { lastLagging: number; lastStopped: number }>
  separationDebounce: Map<string, { lastLagging: number; lastStopped: number }>;
  
  // Route deviation tracking: Map<riderId, { consecutiveOffRouteCount: number; lastAlertTime: number }>
  deviationTracker: Map<string, { consecutiveOffRouteCount: number; lastAlertTime: number }>;
  
  // Signal loss debounce: Map<riderId, lastAlertTime>
  signalLossDebounce: Map<string, number>;
  
  // Periodic roll call
  lastRollCallTimestamp: number;
}

const state: WatchdogState = {
  batteryDebounce: new Map(),
  runawayDebounce: new Map(),
  separationDebounce: new Map(),
  deviationTracker: new Map(),
  signalLossDebounce: new Map(),
  lastRollCallTimestamp: Date.now(),
};

// ── Main Convoy Safety Watchdog Runner ────────────────────────────────

export function runConvoyWatchdog(options: ConvoyWatchdogOptions): void {
  const {
    myLocation,
    myBattery,
    members,
    activeRoutePoints,
    unitSystem = 'metric',
    onAlertBanner,
  } = options;

  const now = Date.now();
  const onlineMembers = members.filter(m => m.isOnline);

  // ─────────────────────────────────────────────────────────────────────
  // 1. BATTERY WATCHDOG
  // Checks own phone battery + squad buddies' phone batteries
  // ─────────────────────────────────────────────────────────────────────
  
  // A. Check self battery
  if (myBattery && myBattery.level !== undefined && !myBattery.isCharging) {
    const selfId = 'self';
    const deb = state.batteryDebounce.get(selfId) || { lastWarning: 0, lastCritical: 0 };
    const level = myBattery.level;

    if (level <= 8 && now - deb.lastCritical > 8 * 60 * 1000) {
      deb.lastCritical = now;
      state.batteryDebounce.set(selfId, deb);
      playWarningChime();
      triggerHaptic([80, 50, 80, 50, 150]);
      speakAlert(`Critical battery: Your phone is down to ${level} percent. Tracking may stop soon.`, { rate: 1.05 });
      onAlertBanner?.({
        title: 'CRITICAL BATTERY',
        message: `Your phone is at ${level}%. Connect to motorcycle charger!`,
        icon: '🪫',
        color: '#ef4444',
        type: 'battery',
      });
    } else if (level <= 15 && now - deb.lastWarning > 12 * 60 * 1000) {
      deb.lastWarning = now;
      state.batteryDebounce.set(selfId, deb);
      playWarningChime();
      triggerHaptic(60);
      speakAlert(`Heads up: Your phone battery is at ${level} percent. Plug into bike charger.`, { rate: 1.05 });
      onAlertBanner?.({
        title: 'LOW BATTERY',
        message: `Your phone is at ${level}%.`,
        icon: '🔋',
        color: '#f59e0b',
        type: 'battery',
      });
    } else if (level > 20) {
      // Reset cooldowns once battery is replenished
      state.batteryDebounce.delete(selfId);
    }
  }

  // B. Check squad buddies' batteries
  for (const member of onlineMembers) {
    const loc = member.location;
    if (!loc || loc.batteryPct === undefined) continue;
    if (loc.isCharging) continue; // Suppress alert if friend is actively charging on bike

    const deb = state.batteryDebounce.get(member.riderId) || { lastWarning: 0, lastCritical: 0 };
    const level = loc.batteryPct;
    const name = member.name || 'Rider';

    if (level <= 8 && now - deb.lastCritical > 8 * 60 * 1000) {
      deb.lastCritical = now;
      state.batteryDebounce.set(member.riderId, deb);
      playWarningChime();
      triggerHaptic([60, 40, 60]);
      speakAlert(`Critical battery: ${name}'s phone is at ${level} percent.`, { rate: 1.05 });
      onAlertBanner?.({
        title: `${name.toUpperCase()} CRITICAL BATTERY`,
        message: `${name}'s phone battery is down to ${level}%!`,
        icon: '🪫',
        color: '#ef4444',
        type: 'battery',
      });
    } else if (level <= 15 && now - deb.lastWarning > 12 * 60 * 1000) {
      deb.lastWarning = now;
      state.batteryDebounce.set(member.riderId, deb);
      playWarningChime();
      speakAlert(`Battery notice: ${name}'s phone is at ${level} percent.`, { rate: 1.05 });
      onAlertBanner?.({
        title: `${name.toUpperCase()} LOW BATTERY`,
        message: `${name}'s battery is at ${level}%.`,
        icon: '🔋',
        color: '#f59e0b',
        type: 'battery',
      });
    } else if (level > 20) {
      state.batteryDebounce.delete(member.riderId);
    }
  }

  // If no GPS fix for user yet, skip spatial checks
  if (!myLocation) return;

  const myLat = myLocation.lat;
  const myLon = myLocation.lon;
  const mySpeed = myLocation.speedKmh ?? 0;
  const myHeading = myLocation.heading;

  // ─────────────────────────────────────────────────────────────────────
  // 2. "RABBIT" / RUNAWAY AHEAD ALERT (> 1.2 KM AHEAD)
  // Alert squad when eager rider tears ahead and risks losing the pack
  // ─────────────────────────────────────────────────────────────────────
  for (const member of onlineMembers) {
    const loc = member.location;
    if (!loc) continue;

    const distMeters = member.distanceFromMeMeters ?? getDistanceMeters(myLat, myLon, loc.lat, loc.lon);
    const memberSpeed = loc.speedKmh ?? 0;

    // Must be > 1200m away and moving (>= 15 km/h)
    if (distMeters > 1200 && memberSpeed >= 15) {
      // Determine if they are in FRONT of us (ahead in heading or bearing)
      let isAhead = false;
      if (myHeading !== null && myHeading !== undefined) {
        const bearingToMember = getBearing(myLat, myLon, loc.lat, loc.lon);
        let angleDiff = Math.abs(myHeading - bearingToMember);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        // Within 70 degrees of forward cone
        if (angleDiff < 70) {
          isAhead = true;
        }
      } else {
        // Fallback: If member is moving faster and pulling away
        isAhead = memberSpeed >= mySpeed;
      }

      if (isAhead) {
        const lastAlert = state.runawayDebounce.get(member.riderId) || 0;
        // 4 minute cooldown
        if (now - lastAlert > 4 * 60 * 1000) {
          state.runawayDebounce.set(member.riderId, now);
          const distStr = formatSpokenDistance(distMeters, unitSystem);
          const name = member.name || 'Rider';

          playWarningChime();
          triggerHaptic([60, 40, 60]);
          speakAlert(`Squad alert: ${name} is ${distStr} ahead of the pack. Pace check!`, { rate: 1.05 });
          onAlertBanner?.({
            title: 'RABBIT AHEAD',
            message: `${name} is ${distStr} ahead of squad.`,
            icon: '⚡',
            color: '#00f0ff',
            type: 'rabbit',
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. LEFT BEHIND / SEPARATION ALERT (> 1.0 KM BEHIND)
  // Distinguishes between:
  //   A. Stopped behind (puncture, mechanical, emergency) -> High priority
  //   B. Cruising behind (lagging speed) -> Regular squad alert
  //   C. Lost GPS connection
  // ─────────────────────────────────────────────────────────────────────
  if (mySpeed >= 18) { // Only check separation if user/pack is actively riding
    for (const member of onlineMembers) {
      const loc = member.location;
      if (!loc) continue;

      const distMeters = member.distanceFromMeMeters ?? getDistanceMeters(myLat, myLon, loc.lat, loc.lon);
      const memberSpeed = loc.speedKmh ?? 0;

      // Must be > 1000m away
      if (distMeters > 1000) {
        let isBehind = false;
        if (myHeading !== null && myHeading !== undefined) {
          const bearingToMember = getBearing(myLat, myLon, loc.lat, loc.lon);
          let angleDiff = Math.abs(myHeading - bearingToMember);
          if (angleDiff > 180) angleDiff = 360 - angleDiff;
          // In rear hemisphere (> 100 degrees from forward heading)
          if (angleDiff >= 100) {
            isBehind = true;
          }
        } else {
          // If we don't have heading, treat as separation if distance is large
          isBehind = true;
        }

        if (isBehind) {
          const deb = state.separationDebounce.get(member.riderId) || { lastLagging: 0, lastStopped: 0 };
          const distStr = formatSpokenDistance(distMeters, unitSystem);
          const name = member.name || 'Rider';

          // Case A: Stopped Behind (Speed < 4.5 km/h) - High Priority!
          if (memberSpeed < 4.5) {
            // 3 minute cooldown
            if (now - deb.lastStopped > 3 * 60 * 1000) {
              deb.lastStopped = now;
              state.separationDebounce.set(member.riderId, deb);

              playWarningChime();
              triggerHaptic([100, 50, 100, 50, 150]);
              speakAlert(`Caution: ${name} is ${distStr} behind and has stopped. Regroup or check status.`, { rate: 1.05 });
              onAlertBanner?.({
                title: `${name.toUpperCase()} STOPPED BEHIND`,
                message: `${name} is ${distStr} behind and not moving. Check up!`,
                icon: '🛑',
                color: '#ef4444',
                type: 'separation',
              });
            }
          }
          // Case B: Lagging Behind (Cruising)
          else {
            // 3.5 minute cooldown
            if (now - deb.lastLagging > 3.5 * 60 * 1000) {
              deb.lastLagging = now;
              state.separationDebounce.set(member.riderId, deb);

              playWarningChime();
              triggerHaptic([60, 40, 60]);
              speakAlert(`Squad alert: ${name} is lagging ${distStr} behind the pack.`, { rate: 1.05 });
              onAlertBanner?.({
                title: 'RIDER LAGGING',
                message: `${name} is ${distStr} behind pack.`,
                icon: '⚠️',
                color: '#f59e0b',
                type: 'separation',
              });
            }
          }
        }
      }
    }

    // Check GPS Signal Lost (> 90 seconds without ping from previously active buddy)
    for (const member of members) {
      if (member.isStale && member.lastSeen && now - member.lastSeen > 90 * 1000) {
        const lastAlert = state.signalLossDebounce.get(member.riderId) || 0;
        if (now - lastAlert > 6 * 60 * 1000) {
          state.signalLossDebounce.set(member.riderId, now);
          const name = member.name || 'Rider';
          speakAlert(`Signal alert: GPS connection lost from ${name}.`, { rate: 1.05 });
          onAlertBanner?.({
            title: 'GPS SIGNAL LOST',
            message: `Connection lost with ${name}.`,
            icon: '📡',
            color: '#a855f7',
            type: 'separation',
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. ROUTE DEVIATION WATCHDOG (> 450M OFF ACTIVE GPX TRACK)
  // Alert if self or buddy takes a wrong fork or highway exit
  // ─────────────────────────────────────────────────────────────────────
  if (activeRoutePoints && activeRoutePoints.length >= 5) {
    // A. Check Self Deviation
    const myDevMeters = getCrossTrackDistanceMeters(myLat, myLon, activeRoutePoints);
    const selfDev = state.deviationTracker.get('self') || { consecutiveOffRouteCount: 0, lastAlertTime: 0 };

    if (myDevMeters > 450) {
      selfDev.consecutiveOffRouteCount += 1;
      // Require 2 consecutive checks (~6-10s) to avoid GPS glitch false positive
      if (selfDev.consecutiveOffRouteCount >= 2 && now - selfDev.lastAlertTime > 3.5 * 60 * 1000) {
        selfDev.lastAlertTime = now;
        const distStr = formatSpokenDistance(myDevMeters, unitSystem);
        playWarningChime();
        triggerHaptic([80, 50, 80]);
        speakAlert(`Route alert: You are ${distStr} off the planned route.`, { rate: 1.05 });
        onAlertBanner?.({
          title: 'OFF ROUTE',
          message: `You are ${distStr} away from planned route.`,
          icon: '🧭',
          color: '#f97316',
          type: 'deviation',
        });
      }
    } else {
      selfDev.consecutiveOffRouteCount = 0;
    }
    state.deviationTracker.set('self', selfDev);

    // B. Check Crew Members' Deviation
    for (const member of onlineMembers) {
      const loc = member.location;
      if (!loc) continue;

      const memberDevMeters = getCrossTrackDistanceMeters(loc.lat, loc.lon, activeRoutePoints);
      const memDev = state.deviationTracker.get(member.riderId) || { consecutiveOffRouteCount: 0, lastAlertTime: 0 };

      if (memberDevMeters > 450) {
        memDev.consecutiveOffRouteCount += 1;
        if (memDev.consecutiveOffRouteCount >= 2 && now - memDev.lastAlertTime > 4 * 60 * 1000) {
          memDev.lastAlertTime = now;
          const distStr = formatSpokenDistance(memberDevMeters, unitSystem);
          const name = member.name || 'Rider';

          playWarningChime();
          triggerHaptic(60);
          speakAlert(`Route alert: ${name} has deviated ${distStr} off route.`, { rate: 1.05 });
          onAlertBanner?.({
            title: `${name.toUpperCase()} OFF ROUTE`,
            message: `${name} is ${distStr} off the planned track.`,
            icon: '🧭',
            color: '#f97316',
            type: 'deviation',
          });
        }
      } else {
        memDev.consecutiveOffRouteCount = 0;
      }
      state.deviationTracker.set(member.riderId, memDev);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. PERIODIC CONVOY ROLL CALL (EVERY 20-25 MINUTES)
  // Smart annoyance prevention:
  //   - Suppressed if solo (0 friends connected)
  //   - Suppressed if stationary at chai/tapri/fuel (avg speed < 12 km/h)
  // ─────────────────────────────────────────────────────────────────────
  const ROLL_CALL_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

  if (onlineMembers.length >= 1 && now - state.lastRollCallTimestamp >= ROLL_CALL_INTERVAL_MS) {
    // Check convoy average speed to ensure squad is in motion
    const speeds = [mySpeed, ...onlineMembers.map(m => m.location?.speedKmh ?? 0)];
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

    if (avgSpeed >= 12) {
      state.lastRollCallTimestamp = now;
      triggerConvoyRollCall(options, false);
    } else {
      // Delay roll call by 2 minutes until squad resumes riding
      state.lastRollCallTimestamp = now - ROLL_CALL_INTERVAL_MS + 2 * 60 * 1000;
    }
  }
}

// ── Manual / On-Demand Squad Roll Call Trigger ────────────────────────

export function triggerConvoyRollCall(options: ConvoyWatchdogOptions, isManual: boolean = true): void {
  const {
    myLocation,
    myBattery,
    members,
    unitSystem = 'metric',
    onAlertBanner,
  } = options;

  const onlineMembers = members.filter(m => m.isOnline);
  const totalRiders = onlineMembers.length + 1; // Buddies + self

  // Sound chime
  playChime('regroup');
  triggerHaptic(50);

  // If solo rider
  if (onlineMembers.length === 0) {
    speakAlert(`Squad roll call: Solo mode active. No other riders currently on your radar code.`, { rate: 1.05 });
    onAlertBanner?.({
      title: 'SOLO RADAR',
      message: 'No other riders connected on this radar channel.',
      icon: '🏍️',
      color: '#38bdf8',
      type: 'rollcall',
    });
    return;
  }

  // Calculate maximum pack spread
  let maxSpreadMeters = 0;
  if (myLocation) {
    for (const m of onlineMembers) {
      const d = m.distanceFromMeMeters ?? (m.location ? getDistanceMeters(myLocation.lat, myLocation.lon, m.location.lat, m.location.lon) : 0);
      if (d > maxSpreadMeters) maxSpreadMeters = d;
    }
  }

  const spreadStr = formatSpokenDistance(maxSpreadMeters, unitSystem);

  // Check if anyone has low battery (< 15%)
  const lowBatteryRiders: string[] = [];
  if (myBattery && myBattery.level !== undefined && myBattery.level <= 15 && !myBattery.isCharging) {
    lowBatteryRiders.push(`your battery is at ${myBattery.level} percent`);
  }
  for (const m of onlineMembers) {
    if (m.location?.batteryPct !== undefined && m.location.batteryPct <= 15 && !m.location.isCharging) {
      lowBatteryRiders.push(`${m.name}'s battery is at ${m.location.batteryPct} percent`);
    }
  }

  // Build crisp speech announcement
  let speech = `Squad roll call. All ${totalRiders} riders connected. Pack spread is ${spreadStr}.`;
  if (lowBatteryRiders.length > 0) {
    speech += ` Notice: ${lowBatteryRiders.join(', ')}.`;
  } else {
    speech += ` All systems normal.`;
  }

  speakAlert(speech, { rate: 1.05 });

  onAlertBanner?.({
    title: 'SQUAD ROLL CALL',
    message: `${totalRiders} riders connected • Spread: ${spreadStr}`,
    icon: '🎙️',
    color: '#00ff88',
    type: 'rollcall',
  });
}

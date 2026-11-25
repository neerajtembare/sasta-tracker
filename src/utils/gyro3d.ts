/**
 * ThrottleLog — 3D Motorcycle Gyroscope & Dynamic Sensor Fusion Engine
 * 
 * Computes true 3D motorcycle lean angle (roll) and pitch for handlebar phone mounts
 * in landscape or portrait orientation, with 3D vector projection and 1-tap zero calibration.
 */

export interface GyroCalibration {
  refAlpha: number;
  refBeta: number;
  refGamma: number;
  refScreenAngle: number;
  gx0: number;
  gy0: number;
  gz0: number;
  timestamp: number;
}

export interface Gyro3DReading {
  leanAngle: number;    // True motorcycle lean: negative = LEFT, positive = RIGHT (degrees)
  pitchAngle: number;   // Motorcycle pitch: positive = nose up / climb, negative = nose down / brake dive (degrees)
  rawRoll: number;      // Raw uncalibrated roll (degrees)
  rawPitch: number;     // Raw uncalibrated pitch (degrees)
  gForceLateral: number;// Lateral G-force (tan of lean angle)
  isCalibrated: boolean;// True if user has performed zero-angle setup
}

const STORAGE_KEY_CALIBRATION = 'throttlelog_gyro_calibration_3d_v1';
const LEGACY_STORAGE_KEY_CALIBRATION = 'sasta_gyro_calibration_3d_v1';

/**
 * Convert DeviceOrientation (alpha, beta, gamma) into a 3D gravity unit vector
 * in the phone's screen coordinate frame.
 */
export function getScreenGravityVector(
  beta: number,
  gamma: number,
  screenAngle: number = 0
): { x: number; y: number; z: number } {
  const deg2rad = Math.PI / 180;
  const b = beta * deg2rad;
  const g = gamma * deg2rad;

  // In phone body frame:
  // x points right, y points top, z points out of the glass
  const bx = Math.sin(g) * Math.cos(b);
  const by = -Math.sin(b);
  const bz = Math.cos(g) * Math.cos(b);

  // Rotate by +screenAngle (0, 90, 180, 270) so screen X = right across handlebars, screen Y = up across glass
  const sa = screenAngle * deg2rad;
  const cosS = Math.cos(sa);
  const sinS = Math.sin(sa);

  const sx = bx * cosS - by * sinS;
  const sy = bx * sinS + by * cosS;
  const sz = bz;

  // Normalize
  const mag = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
  return {
    x: sx / mag,
    y: sy / mag,
    z: sz / mag,
  };
}

/**
 * Capture current resting position of the phone on handlebars as 0.0° upright reference.
 */
export function createZeroCalibration(
  beta: number,
  gamma: number,
  alpha: number = 0,
  screenAngle: number = 0
): GyroCalibration {
  const v = getScreenGravityVector(beta, gamma, screenAngle);
  const cal: GyroCalibration = {
    refAlpha: alpha,
    refBeta: beta,
    refGamma: gamma,
    refScreenAngle: screenAngle,
    gx0: v.x,
    gy0: v.y,
    gz0: v.z,
    timestamp: Date.now(),
  };

  try {
    const serialized = JSON.stringify(cal);
    localStorage.setItem(STORAGE_KEY_CALIBRATION, serialized);
    localStorage.setItem(LEGACY_STORAGE_KEY_CALIBRATION, serialized);
  } catch {}

  return cal;
}

export function loadSavedCalibration(): GyroCalibration | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY_CALIBRATION) ??
      localStorage.getItem(LEGACY_STORAGE_KEY_CALIBRATION);
    if (raw) {
      try { localStorage.setItem(STORAGE_KEY_CALIBRATION, raw); } catch {}
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function clearSavedCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CALIBRATION);
    localStorage.removeItem(LEGACY_STORAGE_KEY_CALIBRATION);
  } catch {}
}

/**
 * Build an orthonormal 3D bike frame from the calibrated resting gravity unit vector u0 = (gx0, gy0, gz0):
 * - u0: vertical up/down symmetry axis at rest
 * - eLat: unit lateral axis across handlebars perpendicular to u0
 * - eFwd: unit longitudinal forward/roll axis (eLat x u0)
 */
export function getCalibratedBikeBasis(calibration: GyroCalibration): {
  u0: { x: number; y: number; z: number };
  eLat: { x: number; y: number; z: number };
  eFwd: { x: number; y: number; z: number };
} {
  const uMag = Math.hypot(calibration.gx0, calibration.gy0, calibration.gz0) || 1;
  const u0 = {
    x: calibration.gx0 / uMag,
    y: calibration.gy0 / uMag,
    z: calibration.gz0 / uMag,
  };

  // Screen lateral right vector (1, 0, 0) unless degenerate (almost aligned with gravity)
  const dotSX = u0.x;
  let lx = 1 - dotSX * u0.x;
  let ly = -dotSX * u0.y;
  let lz = -dotSX * u0.z;
  let lMag = Math.hypot(lx, ly, lz);
  if (lMag < 1e-4) {
    // Fallback if phone rests on its edge
    const dotSY = u0.y;
    lx = -dotSY * u0.x;
    ly = 1 - dotSY * u0.y;
    lz = -dotSY * u0.z;
    lMag = Math.hypot(lx, ly, lz) || 1;
  }
  const eLat = { x: lx / lMag, y: ly / lMag, z: lz / lMag };

  // Longitudinal forward axis perpendicular to both u0 and eLat
  const fx = eLat.y * u0.z - eLat.z * u0.y;
  const fy = eLat.z * u0.x - eLat.x * u0.z;
  const fz = eLat.x * u0.y - eLat.y * u0.x;
  const fMag = Math.hypot(fx, fy, fz) || 1;
  const eFwd = { x: fx / fMag, y: fy / fMag, z: fz / fMag };

  return { u0, eLat, eFwd };
}

/**
 * Project device rotationRate (alpha/beta/gamma deg/s around Z/X/Y axes) onto calibrated roll axis (deg/s).
 */
export function projectRollRateDegPerSec(
  rotAlphaDegSec: number,
  rotBetaDegSec: number,
  rotGammaDegSec: number,
  screenAngle: number,
  calibration: GyroCalibration | null
): number {
  const rad = (screenAngle * Math.PI) / 180;
  const cosS = Math.cos(rad);
  const sinS = Math.sin(rad);
  // DeviceMotionEvent rotationRate: beta ~= rate around X (pitch), gamma ~= rate around Y (roll in portrait), alpha ~= rate around Z
  const wx = rotBetaDegSec;
  const wy = rotGammaDegSec;
  const wz = rotAlphaDegSec;

  const sx = wx * cosS - wy * sinS;
  const sy = wx * sinS + wy * cosS;
  const sz = wz;

  if (calibration) {
    const { eFwd } = getCalibratedBikeBasis(calibration);
    return sx * eFwd.x + sy * eFwd.y + sz * eFwd.z;
  }
  return sy;
}

/**
 * Compute true 3D Lean Angle and Pitch Angle using orthogonal 3D frame projection (atan2).
 * Eliminates mount recline foreshortening and gimbal asymmetry in landscape/portrait modes.
 */
export function calculate3DOrientation(
  beta: number,
  gamma: number,
  screenAngle: number = 0,
  calibration: GyroCalibration | null = null,
  mountOrientation: 'auto' | 'portrait' | 'landscape' = 'auto'
): Gyro3DReading {
  const current = getScreenGravityVector(beta, gamma, screenAngle);

  const isLandscape =
    mountOrientation === 'landscape' ||
    (mountOrientation === 'auto' && (Math.abs(screenAngle) === 90 || screenAngle === 270 || (typeof window !== 'undefined' && window.innerWidth > window.innerHeight)));

  if (calibration) {
    const { u0, eLat, eFwd } = getCalibratedBikeBasis(calibration);
    const vDotU = current.x * u0.x + current.y * u0.y + current.z * u0.z;
    const vDotLat = current.x * eLat.x + current.y * eLat.y + current.z * eLat.z;
    const vDotFwd = current.x * eFwd.x + current.y * eFwd.y + current.z * eFwd.z;

    const leanDeg = (Math.atan2(vDotLat, vDotU) * 180) / Math.PI;
    const pitchDeg = (Math.atan2(vDotFwd, Math.hypot(vDotLat, vDotU)) * 180) / Math.PI;

    const clampedLean = Math.max(-65, Math.min(65, Math.round(leanDeg)));
    const clampedPitch = Math.max(-45, Math.min(45, Math.round(pitchDeg)));
    const gForce = Math.tan(Math.abs(clampedLean) * (Math.PI / 180));

    return {
      leanAngle: clampedLean,
      pitchAngle: clampedPitch,
      rawRoll: Math.round(gamma),
      rawPitch: Math.round(beta),
      gForceLateral: parseFloat(gForce.toFixed(2)),
      isCalibrated: true,
    };
  }

  // Fallback if not yet calibrated by user:
  let rawRollDeg = 0;
  let rawPitchDeg = 0;

  if (isLandscape) {
    const b = beta;
    rawRollDeg = (screenAngle === 270 || screenAngle === -90) ? b : -b;
    rawPitchDeg = gamma;
  } else {
    rawRollDeg = (screenAngle === 180) ? -gamma : gamma;
    rawPitchDeg = beta;
  }

  const clampedRoll = Math.max(-60, Math.min(60, Math.round(rawRollDeg)));
  const clampedPitch = Math.max(-45, Math.min(45, Math.round(rawPitchDeg)));
  const gForce = Math.tan(Math.abs(clampedRoll) * (Math.PI / 180));

  return {
    leanAngle: clampedRoll,
    pitchAngle: clampedPitch,
    rawRoll: Math.round(gamma),
    rawPitch: Math.round(beta),
    gForceLateral: parseFloat(gForce.toFixed(2)),
    isCalibrated: false,
  };
}

/**
 * Physics-derived centrifugal bank angle from GPS velocity and heading turn rate:
 * tan(theta) = (v * omega) / g
 */
export function computeGpsCentrifugalLeanDeg(
  speedKmh: number,
  deltaHeadingDeg: number | null,
  dtSeconds: number
): number | null {
  if (speedKmh < 12 || deltaHeadingDeg === null || dtSeconds <= 0.2 || dtSeconds > 3.0) {
    return null;
  }
  const speedMs = speedKmh / 3.6;
  const g = 9.80665;
  const turnRateRadSec = (deltaHeadingDeg * Math.PI) / 180 / dtSeconds;
  const gpsLeanRad = Math.atan((speedMs * turnRateRadSec) / g);
  const gpsLeanDeg = (gpsLeanRad * 180) / Math.PI;
  return Math.max(-60, Math.min(60, gpsLeanDeg));
}

/**
 * MotoGP Dynamic Sensor Fusion:
 * Combines angular-rate-integrated lean, static gravity tilt, and GPS centrifugal cornering physics.
 */
export function blendGpsCentrifugalLean(
  gyroLean: number,
  speedKmh: number,
  deltaHeadingDeg: number | null,
  dtSeconds: number
): number {
  const gpsLeanDeg = computeGpsCentrifugalLeanDeg(speedKmh, deltaHeadingDeg, dtSeconds);
  if (gpsLeanDeg === null) {
    return gyroLean;
  }

  // Complementary filter: 65% responsive inertial/gyro + 35% GPS centrifugal anchor
  const blended = gyroLean * 0.65 + gpsLeanDeg * 0.35;
  return Math.max(-60, Math.min(60, Math.round(blended)));
}

/**
 * Sasta Tracker — 3D Motorcycle Gyroscope & Dynamic Sensor Fusion Engine
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

const STORAGE_KEY_CALIBRATION = 'sasta_gyro_calibration_3d_v1';

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

  // Rotate by screen angle (0, 90, 180, 270) around phone Z axis
  const sa = screenAngle * deg2rad;
  const cosS = Math.cos(-sa);
  const sinS = Math.sin(-sa);

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
    localStorage.setItem(STORAGE_KEY_CALIBRATION, JSON.stringify(cal));
  } catch {}

  return cal;
}

export function loadSavedCalibration(): GyroCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CALIBRATION);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function clearSavedCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CALIBRATION);
  } catch {}
}

/**
 * Compute true 3D Lean Angle and Pitch Angle using 3D vector projection.
 * Eliminates the handlebar recline angle error in landscape mode.
 */
export function calculate3DOrientation(
  beta: number,
  gamma: number,
  screenAngle: number = 0,
  calibration: GyroCalibration | null = null,
  mountOrientation: 'auto' | 'portrait' | 'landscape' = 'auto'
): Gyro3DReading {
  const current = getScreenGravityVector(beta, gamma, screenAngle);

  // Determine effective orientation
  const isLandscape =
    mountOrientation === 'landscape' ||
    (mountOrientation === 'auto' && (Math.abs(screenAngle) === 90 || screenAngle === 270 || (typeof window !== 'undefined' && window.innerWidth > window.innerHeight)));

  // If calibrated reference vector is available:
  if (calibration) {
    // Relative gravity vector compared to upright reference:
    // In screen frame: X is lateral (handlebar across), Y is longitudinal (forward/up), Z is normal to screen.
    const deltaX = current.x - calibration.gx0;
    const deltaY = current.y - calibration.gy0;

    // Lean angle (roll) across the motorcycle lateral axis:
    // When the bike banks left, the gravity vector swings right (+deltaX), and vice versa.
    let leanDeg = 0;
    if (isLandscape) {
      // In landscape mode, screen X is across the handlebars.
      // Tilting left produces negative lean, tilting right produces positive lean.
      leanDeg = Math.asin(Math.max(-1, Math.min(1, deltaX))) * (180 / Math.PI);
      if (screenAngle === 270 || screenAngle === -90) {
        leanDeg = -leanDeg;
      }
    } else {
      // In portrait mode, screen X is across the handlebars.
      leanDeg = Math.asin(Math.max(-1, Math.min(1, deltaX))) * (180 / Math.PI);
      if (screenAngle === 180) {
        leanDeg = -leanDeg;
      }
    }

    // Pitch angle along the longitudinal road axis (braking dive / climb):
    const pitchDeg = Math.asin(Math.max(-1, Math.min(1, deltaY))) * (180 / Math.PI);

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
  // Use heuristic projection based on orientation
  let rawRollDeg = 0;
  let rawPitchDeg = 0;

  if (isLandscape) {
    // In landscape mode without calibration, use beta projected against mount angle
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
 * MotoGP Dynamic Sensor Fusion:
 * Blends gyroscope lean with GPS centrifugal cornering physics when speed >= 12 km/h.
 * Formula: tan(theta) = v^2 / (g * R) = (v * omega) / g
 */
export function blendGpsCentrifugalLean(
  gyroLean: number,
  speedKmh: number,
  deltaHeadingDeg: number | null,
  dtSeconds: number
): number {
  if (speedKmh < 12 || deltaHeadingDeg === null || dtSeconds <= 0.2 || dtSeconds > 3.0) {
    return gyroLean;
  }

  const speedMs = speedKmh / 3.6;
  const g = 9.80665;
  const turnRateRadSec = (deltaHeadingDeg * Math.PI) / 180 / dtSeconds;

  // Centrifugal lean: theta = atan(v * omega / g)
  const gpsLeanRad = Math.atan((speedMs * turnRateRadSec) / g);
  const gpsLeanDeg = (gpsLeanRad * 180) / Math.PI;

  // Complementary filter: 70% gyro (fast response) + 30% GPS centrifugal (true turn physics)
  const blended = gyroLean * 0.7 + gpsLeanDeg * 0.3;
  return Math.max(-60, Math.min(60, Math.round(blended)));
}

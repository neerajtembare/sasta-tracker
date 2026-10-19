import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveGpsPoint, UnitSystem } from '../types';
import { convertDistance } from '../utils/units';
import { playChime } from '../utils/audioChimes';
import { addNativeLocationListener, NativeLocationData } from '../utils/nativeKeepAlive';
import {
  calculate3DOrientation,
  createZeroCalibration,
  loadSavedCalibration,
  clearSavedCalibration,
  blendGpsCentrifugalLean,
  GyroCalibration,
} from '../utils/gyro3d';
import { calculateForwardBearing } from '../utils/gpxParser';
import { speakAlert } from '../utils/tts';

export interface GPSState {
  // Position & motion
  currentCoords: { lat: number; lon: number } | null;
  currentSpeedKmh: number;
  maxRecordedSpeed: number;
  currentHeading: number | null;
  currentAltitude: number | null;
  gpsAccuracy: number | null;

  // Orientation / lean (3D Vector Decomposition)
  leanAngle: number;
  pitchAngle: number;
  rawRoll: number;
  rawPitch: number;
  gForceLateral: number;
  maxLeftLean: number;
  maxRightLean: number;
  isGyroCalibrated: boolean;

  // Trip meters
  elapsedSeconds: number;
  movingSeconds: number;
  stoppedSeconds: number;
  totalDistanceMeters: number;
  pointsCount: number;

  // Waypoints
  markedWaypoints: Array<{ name: string; lat: number; lon: number; ele: number | null }>;

  // Status
  isRecording: boolean;
  isPaused: boolean;
  gpsError: string | null;
  wakeLockActive: boolean;

  // Calibration
  tareOffset: number;
  mountMode: 'handlebar' | 'pocket';
  mountOrientation: 'auto' | 'portrait' | 'landscape';
}

export interface GPSControls {
  startNewRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopAndGetPoints: () => LiveGpsPoint[];
  markWaypoint: (label: string) => void;
  handleTareAngle: () => Promise<void>;
  handleResetTare: () => void;
  setMountMode: (mode: 'handlebar' | 'pocket') => Promise<void>;
  setMountOrientation: (orientation: 'auto' | 'portrait' | 'landscape') => void;
  setIsRecording: (v: boolean) => void;

  // Session recovery
  hasRecoverableRide: boolean;
  recoverableData: any;
  handleResumeSession: () => void;
  handleDiscardSession: () => void;

  // Voice feedback
  voiceFeedbackEnabled: boolean;
  setVoiceFeedbackEnabled: (v: boolean) => void;

  // Real-time access & instant export
  getCurrentPoints: () => LiveGpsPoint[];
}

// ─── Haversine ───────────────────────────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Hook ────────────────────────────────────────────────────
export function useGPS(unitSystem: UnitSystem = 'metric', enabled: boolean = true): [GPSState, GPSControls] {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [maxRecordedSpeed, setMaxRecordedSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [leanAngle, setLeanAngle] = useState(0);
  const [pitchAngle, setPitchAngle] = useState(0);
  const [rawRoll, setRawRoll] = useState(0);
  const [rawPitch, setRawPitch] = useState(0);
  const [gForceLateral, setGForceLateral] = useState(0);
  const [maxLeftLean, setMaxLeftLean] = useState(0);
  const [maxRightLean, setMaxRightLean] = useState(0);
  const [isGyroCalibrated, setIsGyroCalibrated] = useState(() => {
    return loadSavedCalibration() !== null;
  });
  const calibrationRef = useRef<GyroCalibration | null>(loadSavedCalibration());
  const lastOrientationEventRef = useRef<{ beta: number; gamma: number; alpha: number } | null>(null);
  const lastGpsPointTimeRef = useRef<number>(Date.now());
  const lastGpsHeadingRef = useRef<number | null>(null);

  const [tareOffset, setTareOffset] = useState(0);
  const [mountMode, setMountModeState] = useState<'handlebar' | 'pocket'>('handlebar');
  const [mountOrientation, setMountOrientationState] = useState<'auto' | 'portrait' | 'landscape'>(() => {
    try {
      const saved = localStorage.getItem('sasta_mount_orientation');
      if (saved === 'portrait' || saved === 'landscape' || saved === 'auto') return saved;
    } catch {}
    return 'auto';
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [movingSeconds, setMovingSeconds] = useState(0);
  const [stoppedSeconds, setStoppedSeconds] = useState(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState(0);
  const [pointsCount, setPointsCount] = useState(0);
  const [markedWaypoints, setMarkedWaypoints] = useState<Array<{ name: string; lat: number; lon: number; ele: number | null }>>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [hasRecoverableRide, setHasRecoverableRide] = useState(false);
  const [recoverableData, setRecoverableData] = useState<any>(null);

  const [voiceFeedbackEnabled, setVoiceFeedbackEnabled] = useState(() => {
    try {
      return localStorage.getItem('sasta_voice_feedback') === 'true';
    } catch {
      return false;
    }
  });

  const recordedPointsRef = useRef<LiveGpsPoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastFixCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const wakeLockRef = useRef<any>(null);
  const leanAngleRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const lastSpokenKmRef = useRef(0);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Wall-clock timing refs to survive phone pocket sleep and tab backgrounding
  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number | null>(null);
  const elapsedSecondsRef = useRef<number>(0);
  const movingSecondsRef = useRef<number>(0);
  const stoppedSecondsRef = useRef<number>(0);
  const totalDistanceMetersRef = useRef<number>(0);
  const markedWaypointsRef = useRef<Array<{ name: string; lat: number; lon: number; ele: number | null }>>([]);
  const voiceFeedbackEnabledRef = useRef<boolean>(voiceFeedbackEnabled);
  const unitSystemRef = useRef<UnitSystem>(unitSystem);
  const isRecordingRef = useRef<boolean>(isRecording);
  const isPausedRef = useRef<boolean>(isPaused);
  const lastStorageSnapshotTsRef = useRef<number>(0);

  isRecordingRef.current = isRecording;
  isPausedRef.current = isPaused;
  currentSpeedRef.current = currentSpeedKmh;
  voiceFeedbackEnabledRef.current = voiceFeedbackEnabled;
  unitSystemRef.current = unitSystem;
  markedWaypointsRef.current = markedWaypoints;

  // Cleanup silent audio on unmount
  useEffect(() => {
    return () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current = null;
      }
    };
  }, []);

  // ── Wall-Clock Accurate Timer (survives phone pocket / sleep throttling) ──
  useEffect(() => {
    let timer: any = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        const now = Date.now();
        const start = startTimeRef.current || now;
        const currentPauseOffset = pauseStartRef.current ? now - pauseStartRef.current : 0;
        const realElapsed = Math.max(
          0,
          Math.floor((now - start - pausedDurationRef.current - currentPauseOffset) / 1000)
        );
        setElapsedSeconds(realElapsed);
        elapsedSecondsRef.current = realElapsed;

        if (currentSpeedRef.current >= 2.5) {
          movingSecondsRef.current += 1;
          setMovingSeconds(movingSecondsRef.current);
        } else {
          stoppedSecondsRef.current += 1;
          setStoppedSeconds(stoppedSecondsRef.current);
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused]);

  // ── Accidental Navigation / Close Protection & Synchronous Flush ──
  useEffect(() => {
    if (!isRecording) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        if (recordedPointsRef.current.length > 0) {
          const snapshot = JSON.stringify({
            points: recordedPointsRef.current,
            elapsedSeconds: elapsedSecondsRef.current,
            movingSeconds: movingSecondsRef.current,
            stoppedSeconds: stoppedSecondsRef.current,
            totalDistanceMeters: totalDistanceMetersRef.current,
            waypoints: markedWaypointsRef.current,
            timestamp: Date.now(),
          });
          localStorage.setItem('sasta_live_recovery_v1', snapshot);
          sessionStorage.setItem('sasta_live_recovery', snapshot);
        }
      } catch {}
      e.preventDefault();
      e.returnValue = 'A ride recording is currently active. Are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecording]);

  // ── Crash-recovery check (using persistent localStorage) ──
  useEffect(() => {
    if (!enabled) return;
    try {
      // Check persistent v1 storage first, then legacy sessionStorage
      let raw = localStorage.getItem('sasta_live_recovery_v1');
      if (!raw) {
        raw = sessionStorage.getItem('sasta_live_recovery');
      }
      if (raw && !isRecording) {
        const parsed = JSON.parse(raw);
        if (parsed.points && parsed.points.length >= 2 && Date.now() - parsed.timestamp < 1000 * 60 * 60 * 24) {
          setHasRecoverableRide(true);
          setRecoverableData(parsed);
        }
      }
    } catch {}
  }, [enabled, isRecording]);

  // ── Wake-lock ──
  useEffect(() => {
    let releasedListener: any = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isRecording && !isPaused) {
        try {
          if (!wakeLockRef.current || wakeLockRef.current.released) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            setWakeLockActive(true);
            releasedListener = () => setWakeLockActive(false);
            wakeLockRef.current.addEventListener('release', releasedListener);
          }
        } catch {
          setWakeLockActive(false);
        }
      } else if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          setWakeLockActive(false);
        } catch {}
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRecording && !isPaused) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        try {
          if (releasedListener) wakeLockRef.current.removeEventListener('release', releasedListener);
          wakeLockRef.current.release();
        } catch {}
      }
    };
  }, [isRecording, isPaused]);

  // ── iOS DeviceOrientation permission ──
  const requestDeviceOrientationPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        return state === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }, []);

  // Helper to determine screen orientation angle
  const getScreenAngle = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    if (window.screen?.orientation?.angle !== undefined) {
      return window.screen.orientation.angle;
    }
    if (typeof (window as any).orientation === 'number') {
      return (window as any).orientation;
    }
    if (window.innerWidth > window.innerHeight) {
      return 90;
    }
    return 0;
  }, []);

  // ── Orientation listener (3D Vector Gyroscope Engine) ──
  useEffect(() => {
    if (!enabled) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      const gamma = e.gamma ?? 0;
      const alpha = e.alpha ?? 0;
      lastOrientationEventRef.current = { beta, gamma, alpha };

      // Real-time stationary compass orientation (updates blue beam / chevron instantly at red lights)
      if (currentSpeedRef.current < 2.5) {
        let compassHeading: number | null = null;
        const screenAngle = getScreenAngle();
        const webkitHeading = (e as any).webkitCompassHeading;
        if (typeof webkitHeading === 'number' && !isNaN(webkitHeading)) {
          compassHeading = (webkitHeading + screenAngle + 360) % 360;
        } else if (alpha !== null && alpha !== undefined && !isNaN(alpha)) {
          // Standard W3C azimuth correction: subtract screenAngle when rotating into landscape
          compassHeading = (360 - alpha - screenAngle + 360) % 360;
        }
        if (compassHeading !== null) {
          setCurrentHeading(Math.round(compassHeading));
        }
      }

      if (mountMode === 'handlebar') {
        const angle = getScreenAngle();
        const reading = calculate3DOrientation(
          beta,
          gamma,
          angle,
          calibrationRef.current,
          mountOrientation
        );

        // Session peak tracking
        if (reading.leanAngle < 0) {
          setMaxLeftLean(prev => Math.max(prev, Math.abs(reading.leanAngle)));
        } else if (reading.leanAngle > 0) {
          setMaxRightLean(prev => Math.max(prev, reading.leanAngle));
        }

        leanAngleRef.current = reading.leanAngle;
        setLeanAngle(reading.leanAngle);
        setPitchAngle(reading.pitchAngle);
        setRawRoll(reading.rawRoll);
        setRawPitch(reading.rawPitch);
        setGForceLateral(reading.gForceLateral);
        setIsGyroCalibrated(reading.isCalibrated);
      } else {
        leanAngleRef.current = 0;
        setLeanAngle(0);
        setPitchAngle(0);
        setGForceLateral(0);
        setRawRoll(Math.round(gamma));
        setRawPitch(Math.round(beta));
      }
    };

    if (typeof window !== 'undefined') {
      const win = window as any;
      if ('ondeviceorientationabsolute' in win) {
        win.addEventListener('deviceorientationabsolute', handleOrientation);
      } else if (win.DeviceOrientationEvent) {
        win.addEventListener('deviceorientation', handleOrientation);
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        const win = window as any;
        win.removeEventListener('deviceorientationabsolute', handleOrientation);
        win.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, [enabled, mountMode, mountOrientation, getScreenAngle]);

  // ── Cleanup GPS watcher ──
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const lastNativeFixTsRef = useRef<number>(0);

  // ── Shared GPS Fix Processing Engine (Native Android GNSS + Browser Geolocation) ──
  const processLocationFix = useCallback((coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    altitude: number | null;
    accuracy: number | null;
    isNative?: boolean;
  }) => {
    const { latitude, longitude, speed, heading, altitude, accuracy, isNative } = coords;
    const nowTs = Date.now();

    if (isNative) {
      lastNativeFixTsRef.current = nowTs;
    } else {
      // Prioritize hardware-level native Android fix if received recently (< 1800ms)
      if (nowTs - lastNativeFixTsRef.current < 1800) {
        return;
      }
    }

    // Clear any previous transient GPS error when a fix is successfully acquired
    setGpsError(null);

    // 1. Accuracy filter: if satellite fix is already locked (> 3 points) and current accuracy is poor (> 65m),
    // drop this fix to eliminate false cell-tower triangulation or Wi-Fi jumps.
    if (isRecordingRef.current && recordedPointsRef.current.length > 3 && accuracy && accuracy > 65) {
      return;
    }

    // 2. Speed acceleration anomaly filter: clamp spikes > 14 m/s² (~50 km/h per second)
    let kmh = speed !== null && speed >= 0 ? speed * 3.6 : 0;
    const lastPt = recordedPointsRef.current[recordedPointsRef.current.length - 1];
    if (isRecordingRef.current && lastPt) {
      const dtSec = Math.max(0.3, (nowTs - lastPt.timestamp) / 1000);
      const maxDeltaKmh = 14 * 3.6 * dtSec;
      if (kmh - lastPt.speedKmh > maxDeltaKmh) {
        kmh = lastPt.speedKmh + maxDeltaKmh;
      } else if (lastPt.speedKmh - kmh > maxDeltaKmh * 1.5) {
        kmh = Math.max(0, lastPt.speedKmh - maxDeltaKmh * 1.5);
      }
    }

    setCurrentCoords(prev => {
      if (prev && prev.lat === latitude && prev.lon === longitude) return prev;
      return { lat: latitude, lon: longitude };
    });
    setCurrentSpeedKmh(kmh);

    // 3. Multi-tier heading determination:
    // Tier 1: Hardware GNSS reported heading (if moving >= 2.0 km/h)
    let effectiveHeading: number | null = (heading !== null && !isNaN(heading)) ? heading : null;

    // Tier 2: Calculated forward bearing from consecutive GPS points (if moving >= 2.0 km/h)
    // Works ALWAYS, whether recording or riding freely on live map!
    if (effectiveHeading === null && lastFixCoordsRef.current && kmh >= 2.0) {
      const dMeters = haversineMeters(lastFixCoordsRef.current.lat, lastFixCoordsRef.current.lon, latitude, longitude);
      if (dMeters >= 2.0) {
        effectiveHeading = calculateForwardBearing(lastFixCoordsRef.current.lat, lastFixCoordsRef.current.lon, latitude, longitude);
      }
    }

    // Always keep lastFixCoordsRef updated on every fix with movement >= 2m
    if (!lastFixCoordsRef.current || haversineMeters(lastFixCoordsRef.current.lat, lastFixCoordsRef.current.lon, latitude, longitude) >= 2.0) {
      lastFixCoordsRef.current = { lat: latitude, lon: longitude };
    }

    // Tier 3: Stationary compass orientation (alpha) from device magnetometer
    if (effectiveHeading === null && kmh < 2.0 && lastOrientationEventRef.current) {
      const alpha = lastOrientationEventRef.current.alpha;
      if (alpha !== null && alpha !== undefined && !isNaN(alpha)) {
        const screenAngle = getScreenAngle();
        effectiveHeading = (360 - alpha - screenAngle + 360) % 360;
      }
    }

    if (effectiveHeading !== null) {
      setCurrentHeading(effectiveHeading);
      if (kmh >= 2.5) {
        if (lastGpsHeadingRef.current !== null && kmh >= 12 && mountMode === 'handlebar') {
          let dHeading = effectiveHeading - lastGpsHeadingRef.current;
          if (dHeading > 180) dHeading -= 360;
          if (dHeading < -180) dHeading += 360;
          const dtSec = (nowTs - lastGpsPointTimeRef.current) / 1000;
          if (dtSec >= 0.2 && dtSec <= 3.0) {
            const fused = blendGpsCentrifugalLean(leanAngleRef.current, kmh, dHeading, dtSec);
            leanAngleRef.current = fused;
            setLeanAngle(fused);
          }
        }
        lastGpsHeadingRef.current = effectiveHeading;
        lastGpsPointTimeRef.current = nowTs;
      }
    }
    if (altitude !== null) setCurrentAltitude(altitude);
    setGpsAccuracy(accuracy);

    // 4. Distance accumulation & point recording only active when recording and not paused
    if (isRecordingRef.current && !isPausedRef.current) {
      setMaxRecordedSpeed(prev => Math.max(prev, kmh));

      if (lastPositionRef.current) {
        const dMeters = haversineMeters(
          lastPositionRef.current.lat,
          lastPositionRef.current.lon,
          latitude,
          longitude,
        );
        // Move deadband: only accumulate if moved > 1.5m to avoid GPS jitter when parked.
        if (dMeters > 1.5) {
          if (dMeters < 1500) {
            totalDistanceMetersRef.current += dMeters;
            setTotalDistanceMeters(totalDistanceMetersRef.current);
          }
          lastPositionRef.current = { lat: latitude, lon: longitude };
        }
      } else {
        lastPositionRef.current = { lat: latitude, lon: longitude };
      }

      // Stationary point throttling: if moving slower than 1.2 km/h and last point was saved < 5s ago,
      // skip pushing duplicate stationary points to prevent inflating GPX size during red lights or long stops
      const lastRecordedPt = recordedPointsRef.current[recordedPointsRef.current.length - 1];
      if (kmh < 1.2 && lastRecordedPt && (nowTs - lastRecordedPt.timestamp) < 5000) {
        return;
      }

      const pt: LiveGpsPoint = {
        lat: latitude,
        lon: longitude,
        accuracy: accuracy || 0,
        speed: speed !== null && speed >= 0 ? speed : null,
        speedKmh: kmh,
        heading: heading !== null && !isNaN(heading) ? heading : null,
        altitude: altitude || null,
        timestamp: Date.now(),
        leanAngle: leanAngleRef.current,
      };

      recordedPointsRef.current.push(pt);
      const count = recordedPointsRef.current.length;
      setPointsCount(count);

      // Throttled Persistent Session snapshot: every 15 seconds (or during initial 3 points)
      // Eliminates 1Hz synchronous JSON.stringify blocking on multi-hour rides and prevents QuotaExceededError
      if (count <= 3 || nowTs - lastStorageSnapshotTsRef.current >= 15000) {
        lastStorageSnapshotTsRef.current = nowTs;
        try {
          const snapshot = JSON.stringify({
            points: recordedPointsRef.current,
            elapsedSeconds: elapsedSecondsRef.current,
            movingSeconds: movingSecondsRef.current,
            stoppedSeconds: stoppedSecondsRef.current,
            totalDistanceMeters: totalDistanceMetersRef.current,
            waypoints: markedWaypointsRef.current,
            timestamp: Date.now(),
          });
          localStorage.setItem('sasta_live_recovery_v1', snapshot);
          sessionStorage.setItem('sasta_live_recovery', snapshot);
        } catch {}
      }

      // Voice milestones using universal TTS engine (Native Android + Web fallback)
      if (voiceFeedbackEnabledRef.current) {
        const totalKm = totalDistanceMetersRef.current / 1000;
        const uSys = unitSystemRef.current;
        const milestone =
          uSys === 'imperial'
            ? Math.floor((totalKm * 0.621371) / 5) * 5
            : Math.floor(totalKm / 5) * 5;
        if (milestone > 0 && milestone > lastSpokenKmRef.current) {
          lastSpokenKmRef.current = milestone;
          const distUnit = uSys === 'imperial' ? 'miles' : 'kilometers';
          const spdUnit = uSys === 'imperial' ? 'miles per hour' : 'kilometers per hour';
          const spd = uSys === 'imperial' ? Math.round(kmh * 0.621371) : Math.round(kmh);
          const text = `${milestone} ${distUnit} completed. Current speed ${spd} ${spdUnit}.`;
          speakAlert(text, { rate: 1.05 });
        }
      }
    }
  }, [mountMode]);

  // ── Native Android Hardware Location Listener (Foreground Service Bridge) ──
  useEffect(() => {
    let cleanupFn: (() => void) | null = null;
    addNativeLocationListener((data: NativeLocationData) => {
      processLocationFix({
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.bearing,
        altitude: data.altitude,
        accuracy: data.accuracy,
        isNative: true,
      });
    }).then(cleanup => {
      if (cleanup) cleanupFn = cleanup;
    });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, [processLocationFix]);

  // ── Standby / Live Web GPS Watcher (Browser Fallback) ──
  const startGpsWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, speed, heading, altitude, accuracy } = position.coords;
        processLocationFix({
          latitude,
          longitude,
          speed,
          heading,
          altitude,
          accuracy,
          isNative: false,
        });
      },
      error => {
        console.warn('Geolocation watch error:', error);
        let userMsg = 'GPS location acquisition failed.';
        if (error.code === 1) {
          userMsg = 'Location permission denied. Please allow location permissions in your browser site settings and ensure you are using HTTPS.';
          setGpsError(userMsg);
          playChime('warning');
        } else if (error.code === 2) {
          userMsg = 'No GPS satellite fix available. Please move outdoors with a clear sky view and verify Location is turned on.';
          setGpsError(userMsg);
          if (isRecordingRef.current) playChime('warning');
        } else if (error.code === 3) {
          userMsg = 'GPS acquisition timed out. Searching for satellite lock outdoors...';
          setGpsError(userMsg);
          // Do not play warning chime on normal standby timeouts
        } else if (error.message) {
          userMsg = error.message;
          setGpsError(userMsg);
        }
      },
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 },
    );
  }, [processLocationFix]);

  // Auto-start standby GPS fix on mount so satellite lock & accuracy are ready before user hits start
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      startGpsWatch();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, startGpsWatch]);

  // 1-second inaudible audio loop that tricks mobile browsers (iOS WebKit & Android Chrome)
  // into keeping background geolocation & JS timers active when phone screen locks in a pocket.
  const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  const playSilentAudio = useCallback(() => {
    if (typeof Audio === 'undefined') return;
    try {
      if (!silentAudioRef.current) {
        const audio = new Audio(SILENT_AUDIO_URI);
        audio.loop = true;
        audio.volume = 0.01;
        silentAudioRef.current = audio;
      }
      silentAudioRef.current.play().catch(() => {});
    } catch {}
  }, []);

  const pauseSilentAudio = useCallback(() => {
    try {
      silentAudioRef.current?.pause();
    } catch {}
  }, []);

  // ── Public controls ──
  const startNewRecording = useCallback(() => {
    recordedPointsRef.current = [];
    setPointsCount(0);
    setTotalDistanceMeters(0);
    setElapsedSeconds(0);
    setMovingSeconds(0);
    setStoppedSeconds(0);
    setMaxRecordedSpeed(0);
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    pauseStartRef.current = null;
    elapsedSecondsRef.current = 0;
    movingSecondsRef.current = 0;
    stoppedSecondsRef.current = 0;
    totalDistanceMetersRef.current = 0;
    lastPositionRef.current = null;
    lastSpokenKmRef.current = 0;
    setMaxLeftLean(0);
    setMaxRightLean(0);
    setIsRecording(true);
    setIsPaused(false);
    playSilentAudio();
    playChime('start');
    startGpsWatch();
  }, [startGpsWatch, playSilentAudio]);

  const pauseRecording = useCallback(() => {
    setIsPaused(true);
    pauseStartRef.current = Date.now();
    pauseSilentAudio();
    try {
      if (recordedPointsRef.current.length > 0) {
        const snapshot = JSON.stringify({
          points: recordedPointsRef.current,
          elapsedSeconds: elapsedSecondsRef.current,
          movingSeconds: movingSecondsRef.current,
          stoppedSeconds: stoppedSecondsRef.current,
          totalDistanceMeters: totalDistanceMetersRef.current,
          waypoints: markedWaypointsRef.current,
          timestamp: Date.now(),
        });
        localStorage.setItem('sasta_live_recovery_v1', snapshot);
        sessionStorage.setItem('sasta_live_recovery', snapshot);
      }
    } catch {}
    playChime('pause');
  }, [pauseSilentAudio]);

  const resumeRecording = useCallback(() => {
    setIsPaused(false);
    if (pauseStartRef.current) {
      pausedDurationRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    playSilentAudio();
    playChime('resume');
    startGpsWatch();
  }, [startGpsWatch, playSilentAudio]);

  const stopAndGetPoints = useCallback((): LiveGpsPoint[] => {
    pauseSilentAudio();
    setIsRecording(false);
    setIsPaused(false);
    pauseStartRef.current = null;
    startTimeRef.current = null;

    const pts = [...recordedPointsRef.current];
    recordedPointsRef.current = [];
    setPointsCount(0);

    // Clear recovery data
    try {
      localStorage.removeItem('sasta_live_recovery_v1');
      sessionStorage.removeItem('sasta_live_recovery');
    } catch {}

    return pts;
  }, [pauseSilentAudio]);

  const markWaypointFn = useCallback((label: string) => {
    const pos = lastPositionRef.current || currentCoords;
    if (!pos) return;
    playChime('waypoint');
    const wp = {
      name: `${label} @ ${formatSec(elapsedSecondsRef.current)}`,
      lat: pos.lat,
      lon: pos.lon,
      ele: currentAltitude,
    };
    setMarkedWaypoints(prev => {
      const next = [...prev, wp];
      try {
        const snapshot = JSON.stringify({
          points: recordedPointsRef.current,
          elapsedSeconds: elapsedSecondsRef.current,
          movingSeconds: movingSecondsRef.current,
          stoppedSeconds: stoppedSecondsRef.current,
          totalDistanceMeters: totalDistanceMetersRef.current,
          waypoints: next,
          timestamp: Date.now(),
        });
        localStorage.setItem('sasta_live_recovery_v1', snapshot);
        sessionStorage.setItem('sasta_live_recovery', snapshot);
      } catch {}
      return next;
    });
  }, [currentAltitude, currentCoords]);

  const handleTareAngle = useCallback(async () => {
    await requestDeviceOrientationPermission();
    const last = lastOrientationEventRef.current;
    const beta = last?.beta ?? 0;
    const gamma = last?.gamma ?? 0;
    const alpha = last?.alpha ?? 0;
    const screenAngle = getScreenAngle();
    const cal = createZeroCalibration(beta, gamma, alpha, screenAngle);
    calibrationRef.current = cal;
    setIsGyroCalibrated(true);
    setTareOffset(0);
    leanAngleRef.current = 0;
    setLeanAngle(0);
    setPitchAngle(0);
    setGForceLateral(0);
  }, [requestDeviceOrientationPermission, getScreenAngle]);

  const handleResetTare = useCallback(() => {
    clearSavedCalibration();
    calibrationRef.current = null;
    setIsGyroCalibrated(false);
    setTareOffset(0);
  }, []);

  const setMountMode = useCallback(async (mode: 'handlebar' | 'pocket') => {
    setMountModeState(mode);
    if (mode === 'handlebar') {
      await requestDeviceOrientationPermission();
    }
  }, [requestDeviceOrientationPermission]);

  const setMountOrientation = useCallback((orientation: 'auto' | 'portrait' | 'landscape') => {
    setMountOrientationState(orientation);
    try {
      localStorage.setItem('sasta_mount_orientation', orientation);
    } catch {}
  }, []);

  const handleResumeSession = useCallback(() => {
    if (!recoverableData) return;
    const pts = recoverableData.points || [];
    recordedPointsRef.current = pts;
    setPointsCount(pts.length);
    const el = recoverableData.elapsedSeconds || 0;
    const mv = recoverableData.movingSeconds || 0;
    const st = recoverableData.stoppedSeconds || 0;
    const dist = recoverableData.totalDistanceMeters || 0;
    setElapsedSeconds(el);
    setMovingSeconds(mv);
    setStoppedSeconds(st);
    setTotalDistanceMeters(dist);

    elapsedSecondsRef.current = el;
    movingSecondsRef.current = mv;
    stoppedSecondsRef.current = st;
    totalDistanceMetersRef.current = dist;
    startTimeRef.current = Date.now() - el * 1000;
    pausedDurationRef.current = 0;
    pauseStartRef.current = null;

    setMarkedWaypoints(recoverableData.waypoints || []);
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      lastPositionRef.current = { lat: last.lat, lon: last.lon };
    }
    setHasRecoverableRide(false);
    setRecoverableData(null);
    setIsRecording(true);
    setIsPaused(false);
    isRecordingRef.current = true;
    isPausedRef.current = false;
    playSilentAudio();
    playChime('resume');
    startGpsWatch();
  }, [recoverableData, startGpsWatch, playSilentAudio]);

  const handleDiscardSession = useCallback(() => {
    pauseSilentAudio();
    try {
      localStorage.removeItem('sasta_live_recovery_v1');
      sessionStorage.removeItem('sasta_live_recovery');
    } catch {}
    setHasRecoverableRide(false);
    setRecoverableData(null);
  }, [pauseSilentAudio]);

  const state: GPSState = {
    currentCoords,
    currentSpeedKmh,
    maxRecordedSpeed,
    currentHeading,
    currentAltitude,
    gpsAccuracy,
    leanAngle,
    pitchAngle,
    rawRoll,
    rawPitch,
    gForceLateral,
    maxLeftLean,
    maxRightLean,
    isGyroCalibrated,
    elapsedSeconds,
    movingSeconds,
    stoppedSeconds,
    totalDistanceMeters,
    pointsCount,
    markedWaypoints,
    isRecording,
    isPaused,
    gpsError,
    wakeLockActive,
    tareOffset,
    mountMode,
    mountOrientation,
  };

  const controls: GPSControls = {
    startNewRecording,
    pauseRecording,
    resumeRecording,
    stopAndGetPoints,
    markWaypoint: markWaypointFn,
    handleTareAngle,
    handleResetTare,
    setMountMode,
    setMountOrientation,
    setIsRecording,
    hasRecoverableRide,
    recoverableData,
    handleResumeSession,
    handleDiscardSession,
    voiceFeedbackEnabled,
    setVoiceFeedbackEnabled,
    getCurrentPoints: () => [...recordedPointsRef.current],
  };

  return [state, controls];
}

// ── Helpers ──
function formatSec(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

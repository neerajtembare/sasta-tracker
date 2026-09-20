import React, { useState, useEffect, useRef } from 'react';
import { LiveGpsPoint, AppTheme } from '../types';
import { 
  Play, 
  Pause, 
  Square, 
  MapPin, 
  Compass, 
  Mountain, 
  Coffee, 
  Fuel, 
  Camera,
  Utensils,
  AlertCircle,
  HelpCircle,
  Smartphone,
  UploadCloud,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { exportPointsToGPX } from '../utils/gpxExporter';

interface LiveCockpitLoggerProps {
  onRideRecorded: (gpxString: string) => void;
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  theme?: AppTheme;
}

export const LiveCockpitLogger: React.FC<LiveCockpitLoggerProps> = ({
  onRideRecorded,
  isRecording,
  setIsRecording,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [maxRecordedSpeed, setMaxRecordedSpeed] = useState<number>(0);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [leanAngle, setLeanAngle] = useState<number>(0);
  const [rawRoll, setRawRoll] = useState<number>(0);
  const [tareOffset, setTareOffset] = useState<number>(0);
  const [mountMode, setMountMode] = useState<'handlebar' | 'pocket'>('handlebar');
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const recordedPointsRef = useRef<LiveGpsPoint[]>([]);
  const [pointsCount, setPointsCount] = useState<number>(0);
  const [markedWaypoints, setMarkedWaypoints] = useState<Array<{ name: string; lat: number; lon: number; ele: number | null }>>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);
  const wakeLockRef = useRef<any>(null);
  const leanAngleRef = useRef<number>(0);

  // Timer loop for elapsed time
  useEffect(() => {
    let timer: any = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused]);

  // Screen WakeLock to keep screen on while riding
  useEffect(() => {
    let releasedListener: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isRecording && !isPaused) {
        try {
          if (!wakeLockRef.current || wakeLockRef.current.released) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            setWakeLockActive(true);
            releasedListener = () => {
              setWakeLockActive(false);
            };
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
        } catch {
          // ignore
        }
      }
    };

    requestWakeLock();

    // Re-acquire screen wake lock when rider switches back to Sasta Tracker tab
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
          if (releasedListener) {
            wakeLockRef.current.removeEventListener('release', releasedListener);
          }
          wakeLockRef.current.release();
        } catch {}
      }
    };
  }, [isRecording, isPaused]);

  // Request iOS 13+ DeviceOrientation permission from user gesture
  const requestDeviceOrientationPermission = async () => {
    if (
      typeof window !== 'undefined' &&
      typeof (DeviceOrientationEvent as any)?.requestPermission === 'function'
    ) {
      try {
        const state = await (DeviceOrientationEvent as any).requestPermission();
        return state === 'granted';
      } catch (err) {
        console.warn('iOS DeviceOrientation permission error:', err);
        return false;
      }
    }
    return true;
  };

  // Orientation listener for phone handlebar mount roll/lean angle with tare offset
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        const roll = Math.round(e.gamma);
        setRawRoll(roll);
        if (mountMode === 'handlebar') {
          const calibrated = Math.min(60, Math.max(-60, roll - tareOffset));
          leanAngleRef.current = calibrated;
          setLeanAngle(calibrated);
        } else {
          leanAngleRef.current = 0;
          setLeanAngle(0);
        }
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [mountMode, tareOffset]);

  const handleTareAngle = async () => {
    await requestDeviceOrientationPermission();
    setTareOffset(rawRoll);
    leanAngleRef.current = 0;
    setLeanAngle(0);
  };

  const handleResetTare = () => {
    setTareOffset(0);
    leanAngleRef.current = rawRoll;
    setLeanAngle(rawRoll);
  };

  const handleSetMountMode = async (mode: 'handlebar' | 'pocket') => {
    setMountMode(mode);
    if (mode === 'handlebar') {
      await requestDeviceOrientationPermission();
    }
  };

  // Cleanup GPS watcher on unmount to prevent geolocation leak
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Geolocation watchPosition
  const startGpsWatch = async () => {
    await requestDeviceOrientationPermission();
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
    if (!isRecording && !isPaused) {
      recordedPointsRef.current = [];
      setPointsCount(0);
      setTotalDistanceMeters(0);
      setElapsedSeconds(0);
      lastPositionRef.current = null;
    }
    setIsRecording(true);
    setIsPaused(false);

    watchIdRef.current = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, speed, heading, altitude, accuracy } = position.coords;
        const now = new Date().toISOString();

        // Speed in m/s converted to km/h (speed may be null or negative if unavailable)
        const kmh = speed !== null && speed >= 0 ? speed * 3.6 : 0;
        setCurrentSpeedKmh(kmh);
        setMaxRecordedSpeed(prev => Math.max(prev, kmh));

        if (heading !== null && !isNaN(heading)) {
          setCurrentHeading(heading);
        }
        if (altitude !== null) {
          setCurrentAltitude(altitude);
        }
        setGpsAccuracy(accuracy);

        // Distance delta calculation using Haversine
        if (lastPositionRef.current) {
          const dMeters = haversineMeters(
            lastPositionRef.current.lat,
            lastPositionRef.current.lon,
            latitude,
            longitude
          );
          if (dMeters > 1.5 && dMeters < 150) {
            setTotalDistanceMeters(prev => prev + dMeters);
          }
        }
        lastPositionRef.current = { lat: latitude, lon: longitude };

        // Append to recorded points in O(1) time without array re-allocation
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
        setPointsCount(recordedPointsRef.current.length);
      },
      error => {
        console.warn('Geolocation watch error:', error);
        setGpsError(error.message || 'GPS location acquisition failed.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  // Haversine formula helper (meters)
  const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth radius in meters
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
  };

  // Pause / Resume recording
  const pauseRecording = () => {
    setIsPaused(true);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const resumeRecording = () => {
    setIsPaused(false);
    startGpsWatch();
  };

  // Mark Waypoint
  const markWaypoint = (label: string) => {
    if (!lastPositionRef.current) return;
    const wp = {
      name: `${label} @ ${formatSec(elapsedSeconds)}`,
      lat: lastPositionRef.current.lat,
      lon: lastPositionRef.current.lon,
      ele: currentAltitude,
    };
    setMarkedWaypoints(prev => [...prev, wp]);
  };

  // Stop & Save to GPX
  const stopAndSaveRecording = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);

    if (recordedPointsRef.current.length < 2) {
      setGpsError('Track contains fewer than 2 points. Drive or move around before saving.');
      return;
    }

    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      recordedPointsRef.current,
      markedWaypoints
    );

    recordedPointsRef.current = [];
    setPointsCount(0);
    onRideRecorded(gpxString);
  };

  const formatSec = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-2xl';
  const innerCardBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#141d26] border-[#223140] text-white';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const speedTextColor = isLight ? 'text-slate-900' : 'text-white';
  const barTrackBg = isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#0d131a] border-[#223140]';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Cockpit HUD Main Cluster — Positioned directly at top */}
      <div className={`border rounded-2xl p-3.5 sm:p-6 relative overflow-hidden shadow-2xl space-y-4 sm:space-y-5 ${cardBg}`}>
        {/* Status Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500') : 'bg-slate-500'
              } opacity-75`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500') : 'bg-slate-500'
              }`} />
            </span>
            <span className="font-mono font-bold text-xs uppercase tracking-wider">
              {isRecording ? (isPaused ? 'RECORDER PAUSED' : 'LIVE GPS ACTIVE') : 'GPS COCKPIT STANDBY'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs">
            {wakeLockActive && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                <Zap className="w-3 h-3" /> Screen On
              </span>
            )}
            <span className={subTextColor}>GPS:</span>
            <span className={`font-bold ${
              gpsAccuracy && gpsAccuracy < 10 ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              ±{gpsAccuracy ? gpsAccuracy.toFixed(1) : '—'}m
            </span>
            {isRecording && (
              <span className="text-[10px] text-sky-400 font-mono hidden sm:inline">
                📍 {pointsCount} pts
              </span>
            )}

            {/* Collapsible Info Button */}
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                showHowItWorks 
                  ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                  : isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' 
                  : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-sky-400'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Tips & Guide</span>
              {showHowItWorks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible Instructions Drawer */}
        {showHowItWorks && (
          <div className={`border rounded-xl p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-200 ${innerCardBg}`}>
            <div className="flex items-center justify-between">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-sky-500">
                Rider Guide: Two Ways to Log
              </span>
              <button 
                onClick={() => setShowHowItWorks(false)}
                className="text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer underline"
              >
                Hide
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-lg border space-y-1.5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-sky-400">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>1. Handlebar Live Cockpit</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  Mount phone on handlebar. Tap <strong>Start GPS Logging</strong>. Tap <strong>Zero Angle</strong> while upright to calibrate phone tilt.
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1.5 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-amber-400">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>2. Pocket Mode / External GPX</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  Switch to <strong>Pocket Mode</strong> below or use GPSLogger/Strava with screen locked. Lean angles are calculated from GPS cornering speed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Big Speedometer Display */}
        <div className="text-center py-2 sm:py-4 relative">
          <div className={`text-[11px] sm:text-[12px] font-mono tracking-widest uppercase mb-1 ${subTextColor}`}>
            GROUND SPEED
          </div>
          <div className={`font-mono font-black text-6xl sm:text-8xl lg:text-9xl tracking-tighter select-none ${speedTextColor}`}>
            {currentSpeedKmh.toFixed(0)}
          </div>
          <div className="font-mono font-bold text-sm sm:text-lg text-sky-500 uppercase tracking-widest">
            KM / H
          </div>
        </div>

        {/* Lean Angle & Placement Calibration Gauge */}
        <div className={`border rounded-xl p-3 sm:p-4 space-y-2.5 ${innerCardBg}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold uppercase ${subTextColor}`}>
                ROLL & LEAN ANGLE:
              </span>
              {/* Placement Mode Switcher */}
              <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#0d131a] border-[#223140]'}`}>
                <button
                  onClick={() => handleSetMountMode('handlebar')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    mountMode === 'handlebar' ? 'bg-sky-500 text-slate-950 font-bold' : subTextColor
                  }`}
                >
                  🏍️ Handlebar
                </button>
                <button
                  onClick={() => handleSetMountMode('pocket')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    mountMode === 'pocket' ? 'bg-sky-500 text-slate-950 font-bold' : subTextColor
                  }`}
                >
                  👖 Pocket
                </button>
              </div>
            </div>

            {/* Calibrate / Tare Angle Button */}
            {mountMode === 'handlebar' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleTareAngle}
                  title="Reset upright angle to 0° based on your current phone mount tilt"
                  className="px-2 py-1 bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-400 border border-sky-500/30 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Zero Angle</span>
                </button>
                {tareOffset !== 0 && (
                  <button
                    onClick={handleResetTare}
                    title="Clear tare offset"
                    className="p-1 hover:text-rose-400 text-slate-500 rounded transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {mountMode === 'handlebar' ? (
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className={subTextColor}>
                  {tareOffset !== 0 ? `Calibrated (${tareOffset > 0 ? `+${tareOffset}°` : `${tareOffset}°`})` : 'Raw Gyro'}
                </span>
                <strong className={`font-bold ${
                  Math.abs(leanAngle) > 35 ? 'text-rose-500' : Math.abs(leanAngle) > 20 ? 'text-amber-400' : isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  {Math.abs(leanAngle)}° {leanAngle < 0 ? 'LEFT ◀' : leanAngle > 0 ? '▶ RIGHT' : 'UPRIGHT'}
                </strong>
              </div>

              <div className={`relative w-full h-4 border rounded flex items-center justify-center overflow-hidden ${barTrackBg}`}>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-sky-500/70 z-10" />
                <div
                  className={`h-full transition-all duration-100 ${
                    Math.abs(leanAngle) > 35 ? 'bg-rose-500' : Math.abs(leanAngle) > 20 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${(Math.abs(leanAngle) / 50) * 50}%`,
                    transformOrigin: leanAngle >= 0 ? 'left' : 'right',
                    transform: leanAngle >= 0 ? 'translateX(50%)' : 'translateX(-50%)',
                  }}
                />
              </div>
              <div className={`flex justify-between text-[9px] font-mono mt-1 ${subTextColor}`}>
                <span>50° L</span>
                <span>0° UPRIGHT</span>
                <span>50° R</span>
              </div>
            </div>
          ) : (
            <div className={`p-2.5 rounded-lg border text-[11px] font-mono leading-relaxed ${
              isLight ? 'bg-sky-50/70 border-sky-200 text-sky-900' : 'bg-sky-950/20 border-sky-500/20 text-sky-300'
            }`}>
              <div className="font-bold flex items-center gap-1.5">
                <span>👖 Pocket Mode Active</span>
              </div>
              <p className="mt-0.5 text-[10px] opacity-80">
                Gyroscope tilt is muted to save battery and avoid body movement noise. Cornering lean angles will be computed automatically from GPS centrifugal velocity and turn radius after your ride.
              </p>
            </div>
          )}
        </div>

        {/* Metric Triad: Distance, Elapsed Time, Top Speed */}
        <div className="grid grid-cols-3 gap-2.5 text-center font-mono pt-1">
          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase ${subTextColor}`}>DISTANCE</div>
            <div className={`font-black text-xl sm:text-2xl mt-0.5 ${speedTextColor}`}>
              {(totalDistanceMeters / 1000).toFixed(2)}
            </div>
            <div className="text-[9px] text-sky-500 font-bold">KILOMETERS</div>
          </div>

          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase ${subTextColor}`}>ELAPSED TIME</div>
            <div className="font-black text-xl sm:text-2xl text-emerald-500 mt-0.5">
              {formatSec(elapsedSeconds)}
            </div>
            <div className={`text-[9px] ${subTextColor}`}>HH:MM:SS</div>
          </div>

          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase ${subTextColor}`}>MAX SPEED</div>
            <div className="font-black text-xl sm:text-2xl text-rose-500 mt-0.5">
              {maxRecordedSpeed.toFixed(1)}
            </div>
            <div className="text-[9px] text-rose-500 font-bold">KM/H PEAK</div>
          </div>
        </div>

        {/* Secondary Telemetry: Altitude & Heading */}
        <div className="grid grid-cols-2 gap-2.5 text-center font-mono">
          <div className={`p-2.5 border rounded-xl flex items-center justify-between text-xs px-3 ${innerCardBg}`}>
            <span className={`flex items-center gap-1.5 ${subTextColor}`}>
              <Mountain className="w-3.5 h-3.5 text-sky-500" /> Altitude
            </span>
            <strong className={speedTextColor}>{currentAltitude !== null ? `${currentAltitude.toFixed(0)} m` : 'Acquiring...'}</strong>
          </div>
          <div className={`p-2.5 border rounded-xl flex items-center justify-between text-xs px-3 ${innerCardBg}`}>
            <span className={`flex items-center gap-1.5 ${subTextColor}`}>
              <Compass className="w-3.5 h-3.5 text-amber-500" /> Heading
            </span>
            <strong className={speedTextColor}>{currentHeading !== null ? `${currentHeading.toFixed(0)}°` : '—'}</strong>
          </div>
        </div>

        {/* Quick Waypoints Dropper */}
        {isRecording && (
          <div className={`pt-3 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-wider ${subTextColor}`}>
              ONE-TOUCH WAYPOINTS (SAVED TO CURRENT GPS COORDINATE)
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => markWaypoint('Rest Break')}
                className="p-2.5 bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-500 border border-amber-500/30 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Coffee className="w-3.5 h-3.5" /> Rest
              </button>
              <button
                onClick={() => markWaypoint('Fuel')}
                className="p-2.5 bg-sky-500/10 hover:bg-sky-500 hover:text-black text-sky-500 border border-sky-500/30 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Fuel className="w-3.5 h-3.5" /> Fuel
              </button>
              <button
                onClick={() => markWaypoint('Photo')}
                className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 border border-emerald-500/30 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Photo
              </button>
              <button
                onClick={() => markWaypoint('Food')}
                className="p-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Utensils className="w-3.5 h-3.5" /> Food
              </button>
            </div>
            {markedWaypoints.length > 0 && (
              <div className="text-[11px] font-mono text-emerald-500 text-center pt-1 font-bold">
                {markedWaypoints.length} waypoints saved to current session
              </div>
            )}
          </div>
        )}

        {/* Primary Controls */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={startGpsWatch}
              className="px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono font-black text-sm uppercase tracking-wider flex items-center gap-2 rounded-xl shadow-lg transition-all cursor-pointer hover:shadow-sky-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START GPS LOGGING</span>
            </button>
          ) : (
            <>
              {isPaused ? (
                <button
                  onClick={resumeRecording}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-sm uppercase flex items-center gap-2 rounded-xl cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>RESUME</span>
                </button>
              ) : (
                <button
                  onClick={pauseRecording}
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-sm uppercase flex items-center gap-2 rounded-xl cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE RIDE</span>
                </button>
              )}

              <button
                onClick={stopAndSaveRecording}
                className="px-5 py-3 bg-rose-500 hover:bg-rose-400 text-white font-mono font-bold text-sm uppercase flex items-center gap-2 rounded-xl shadow-lg cursor-pointer hover:shadow-rose-500/20"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>SAVE & ANALYZE TRACK</span>
              </button>
            </>
          )}
        </div>

        {gpsError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-mono text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}
      </div>
    </div>
  );
};

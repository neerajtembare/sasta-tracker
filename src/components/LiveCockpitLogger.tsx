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
  CheckCircle2
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
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number>(0);
  const [recordedPoints, setRecordedPoints] = useState<LiveGpsPoint[]>([]);
  const [markedWaypoints, setMarkedWaypoints] = useState<Array<{ name: string; lat: number; lon: number; ele: number | null }>>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lon: number } | null>(null);

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

  // Orientation listener for phone handlebar mount roll/lean angle
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null) {
        const roll = Math.round(e.gamma);
        setLeanAngle(Math.min(60, Math.max(-60, roll)));
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

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
  const startGpsWatch = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
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

        // Append to recorded points
        const pt: LiveGpsPoint = {
          lat: latitude,
          lon: longitude,
          accuracy: accuracy || 0,
          speed: speed !== null && speed >= 0 ? speed : null,
          speedKmh: kmh,
          heading: heading !== null && !isNaN(heading) ? heading : null,
          altitude: altitude || null,
          timestamp: Date.now(),
          leanAngle,
        };

        setRecordedPoints(prev => [...prev, pt]);
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

    if (recordedPoints.length < 2) {
      setGpsError('Track contains fewer than 2 points. Drive or move around before saving.');
      return;
    }

    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      recordedPoints,
      markedWaypoints
    );

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
      {/* Informational Card: How Recording Works */}
      <div className={`rounded-2xl p-4 sm:p-5 border shadow-lg space-y-3 ${cardBg}`}>
        <div className="flex items-center gap-2 text-sky-500">
          <HelpCircle className="w-4 h-4" />
          <h3 className="font-heading font-black text-sm uppercase tracking-wide">
            How Does Ride Recording Work?
          </h3>
        </div>
        <p className={`text-xs leading-relaxed ${subTextColor}`}>
          You have <strong className={isLight ? 'text-slate-900' : 'text-white'}>two flexible ways</strong> to log your rides with Sasta Tracker. Choose whatever fits your setup:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Method 1 */}
          <div className={`border rounded-xl p-3.5 space-y-2 ${innerCardBg}`}>
            <div className="flex items-center gap-2 text-sky-500 font-bold text-xs font-mono">
              <Smartphone className="w-4 h-4" />
              <span>1. Built-in Live GPS Cockpit (This Screen)</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
              Mount your phone on your handlebar or tank bag. Tap <strong className={isLight ? 'text-slate-900' : 'text-white'}>"Start GPS Logging"</strong> below. It tracks high-accuracy live GPS speeds, elevation, and handlebar roll angles. When done, tap <strong className={isLight ? 'text-slate-900' : 'text-white'}>"Save & Analyze Track"</strong> to instantly open the analytics dashboard.
            </p>
            <div className="text-[10px] text-emerald-500 flex items-center gap-1 font-mono font-semibold">
              <CheckCircle2 className="w-3 h-3" /> No external apps needed
            </div>
          </div>

          {/* Method 2 */}
          <div className={`border rounded-xl p-3.5 space-y-2 ${innerCardBg}`}>
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs font-mono">
              <UploadCloud className="w-4 h-4" />
              <span>2. External GPX App (Pocket / Screen Locked)</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
              Prefer keeping your phone safely inside your jacket or pocket with the screen off? Use any native GPS app (like <strong className={isLight ? 'text-slate-900' : 'text-white'}>GPSLogger, OpenTracks, Strava, or Garmin</strong>). After your ride, export the <code className="text-sky-500 font-mono font-bold">.gpx</code> file and upload it using the <strong className={isLight ? 'text-slate-900' : 'text-white'}>"Upload GPX"</strong> button.
            </p>
            <div className="text-[10px] text-amber-500 flex items-center gap-1 font-mono font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Saves maximum battery on long highway rides
            </div>
          </div>
        </div>
      </div>

      {/* Cockpit HUD Main Cluster */}
      <div className={`border rounded-2xl p-4 sm:p-6 relative overflow-hidden shadow-2xl space-y-5 ${cardBg}`}>
        {/* Status Bar */}
        <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500') : 'bg-slate-500'
              } opacity-75`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500') : 'bg-slate-500'
              }`} />
            </span>
            <span className="font-mono font-bold text-xs uppercase tracking-widest">
              {isRecording ? (isPaused ? 'RECORDER PAUSED' : 'LIVE GPS RECORDING ACTIVE') : 'GPS COCKPIT STANDBY'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className={subTextColor}>ACCURACY:</span>
            <span className={`font-bold ${
              gpsAccuracy && gpsAccuracy < 10 ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              ±{gpsAccuracy ? gpsAccuracy.toFixed(1) : '—'} m
            </span>
          </div>
        </div>

        {/* Big Speedometer Display */}
        <div className="text-center py-4 sm:py-6 relative">
          <div className={`text-[12px] font-mono tracking-widest uppercase mb-1 ${subTextColor}`}>
            GROUND SPEED
          </div>
          <div className={`font-mono font-black text-7xl sm:text-9xl tracking-tighter select-none ${speedTextColor}`}>
            {currentSpeedKmh.toFixed(0)}
          </div>
          <div className="font-mono font-bold text-lg sm:text-xl text-sky-500 uppercase tracking-widest -mt-1">
            KM / H
          </div>
        </div>

        {/* Lean Angle Gauge */}
        <div className={`border rounded-xl p-3 sm:p-4 ${innerCardBg}`}>
          <div className={`flex items-center justify-between text-xs font-mono mb-2 ${subTextColor}`}>
            <span>HANDLEBAR LEAN ANGLE</span>
            <strong className={isLight ? 'text-slate-900' : 'text-white'}>{Math.abs(leanAngle)}° {leanAngle < 0 ? 'LEFT' : leanAngle > 0 ? 'RIGHT' : 'UPRIGHT'}</strong>
          </div>
          <div className={`relative w-full h-4 border rounded flex items-center justify-center overflow-hidden ${barTrackBg}`}>
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500 z-10" />
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
          <div className={`flex justify-between text-[9px] font-mono mt-1.5 ${subTextColor}`}>
            <span>50° LEFT</span>
            <span>0° UPRIGHT</span>
            <span>50° RIGHT</span>
          </div>
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

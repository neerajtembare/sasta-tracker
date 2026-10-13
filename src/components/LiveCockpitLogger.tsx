import React, { useState, useEffect } from 'react';
import { AppTheme, UnitSystem } from '../types';
import { convertSpeed, convertDistance, convertElevation } from '../utils/units';
import { useGPS } from '../hooks/useGPS';
import { exportPointsToGPX } from '../utils/gpxExporter';
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
  ChevronUp,
  Volume2,
  VolumeX,
  Clock,
  Sun,
  Hand,
  Users,
  Share2
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { GroupRideHud } from './GroupRideHud';
import { ShareLocationModal } from './ShareLocationModal';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';

interface LiveCockpitLoggerProps {
  onRideRecorded: (gpxString: string) => void;
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  groupRideConnected?: boolean;
  groupRoomCode?: string;
  groupMembers?: GroupMemberInfo[];
  sosAlert?: SosAlert | null;
  onOpenGroupRideModal?: () => void;
  onTriggerSos?: () => void;
  onUpdateMyLocation?: (lat: number, lon: number, speedKmh: number, bearing: number | null) => void;
}

export const LiveCockpitLogger: React.FC<LiveCockpitLoggerProps> = ({
  onRideRecorded,
  isRecording: _externalIsRecording,
  setIsRecording: _externalSetIsRecording,
  theme = 'dark',
  unitSystem = 'metric',
  groupRideConnected,
  groupRoomCode,
  groupMembers,
  sosAlert,
  onOpenGroupRideModal,
  onTriggerSos,
  onUpdateMyLocation,
}) => {
  const isLight = theme === 'light';
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [shortRideWarning, setShortRideWarning] = useState<string | null>(null);
  const [isShareLocModalOpen, setIsShareLocModalOpen] = useState(false);

  const [isGloveMode, setIsGloveMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sasta_glove_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sasta_sunlight_mode') === 'true';
    } catch {
      return false;
    }
  });

  const toggleGloveMode = () => {
    triggerHaptic(60);
    setIsGloveMode(prev => {
      const next = !prev;
      try { localStorage.setItem('sasta_glove_mode', String(next)); } catch {}
      return next;
    });
  };

  const toggleSunlightMode = () => {
    triggerHaptic(60);
    setIsSunlightMode(prev => {
      const next = !prev;
      try { localStorage.setItem('sasta_sunlight_mode', String(next)); } catch {}
      return next;
    });
  };
  
  const [gps, controls] = useGPS(unitSystem);

  // Sync external recording state with hook
  // The hook manages its own isRecording; we bridge to the parent via controls
  const isRecording = gps.isRecording;
  const isPaused = gps.isPaused;

  // Broadcast location to connected group ride crew
  useEffect(() => {
    if (gps.currentCoords && onUpdateMyLocation && groupRideConnected) {
      onUpdateMyLocation(
        gps.currentCoords.lat,
        gps.currentCoords.lon,
        gps.currentSpeedKmh,
        gps.currentHeading
      );
    }
  }, [gps.currentCoords, gps.currentSpeedKmh, gps.currentHeading, onUpdateMyLocation, groupRideConnected]);

  const stopAndSaveRecording = () => {
    triggerHaptic(50);
    if (gps.pointsCount < 2) {
      setShortRideWarning(
        `Cannot save ride: Only ${gps.pointsCount} GPS fix recorded so far. At least 2 coordinate points are required to plot a route and calculate speeds. Move outdoors with an open sky view.`
      );
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      return;
    }

    const pts = controls.stopAndGetPoints();
    _externalSetIsRecording(false);
    setShortRideWarning(null);

    if (pts.length < 2) {
      setShortRideWarning('Recorded track was too short (< 2 points) to generate telemetry.');
      return;
    }

    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      pts,
      gps.markedWaypoints
    );
    onRideRecorded(gpxString);
  };

  const handleForceDiscard = () => {
    triggerHaptic(50);
    controls.stopAndGetPoints();
    _externalSetIsRecording(false);
    setShortRideWarning(null);
  };

  const handleStartNewRecording = () => {
    triggerHaptic(50);
    setShortRideWarning(null);
    controls.startNewRecording();
    _externalSetIsRecording(true);
  };

  const handleResumeSession = () => {
    triggerHaptic(50);
    setShortRideWarning(null);
    controls.handleResumeSession();
    _externalSetIsRecording(true);
  };

  const formatSec = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${(m % 60).toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cardBg = isSunlightMode
    ? 'bg-black border-yellow-400 text-white shadow-2xl shadow-yellow-500/10'
    : isLight
    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
    : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-2xl';

  const innerCardBg = isSunlightMode
    ? 'bg-black border-yellow-500/50 text-white'
    : isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-[#141d26] border-[#223140] text-white';

  const subTextColor = isSunlightMode
    ? 'text-yellow-400 font-bold'
    : isLight
    ? 'text-slate-500'
    : 'text-[#8f9ca8]';

  const speedTextColor = isSunlightMode
    ? 'text-yellow-300 font-black'
    : isLight
    ? 'text-slate-900'
    : 'text-white';

  const barTrackBg = isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#0d131a] border-[#223140]';

  const currentSpeedConverted = convertSpeed(gps.currentSpeedKmh, unitSystem);
  const maxSpeedConverted = convertSpeed(gps.maxRecordedSpeed, unitSystem);
  const distanceConverted = convertDistance(gps.totalDistanceMeters / 1000, unitSystem);
  const altitudeConverted = convertElevation(gps.currentAltitude, unitSystem);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Interrupted Session Recovery Banner */}
      {controls.hasRecoverableRide && controls.recoverableData && (
        <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 font-mono text-xs shadow-lg animate-in fade-in duration-200 ${
          isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">⚠️ Interrupted Ride Session Detected!</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Found {controls.recoverableData.points?.length || 0} unsaved GPS points ({convertDistance((controls.recoverableData.totalDistanceMeters || 0) / 1000, unitSystem).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}) from your previous ride.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleResumeSession}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Resume Ride
            </button>
            <button
              onClick={controls.handleDiscardSession}
              className={`px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Short Ride Warning Alert */}
      {shortRideWarning && (
        <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 font-mono text-xs shadow-lg animate-in fade-in duration-200 ${
          isLight ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">⚠️ Insufficient GPS Coordinates</div>
              <div className="text-[11px] opacity-90 mt-0.5 max-w-xl">
                {shortRideWarning}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShortRideWarning(null)}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer"
            >
              Keep Tracking
            </button>
            <button
              onClick={handleForceDiscard}
              className={`px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              Discard & Reset
            </button>
          </div>
        </div>
      )}

      {/* Cockpit HUD Main Cluster */}
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
            {gps.wakeLockActive && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                <Zap className="w-3 h-3" /> Screen On
              </span>
            )}
            <span className={subTextColor}>GPS:</span>
            <span className={`font-bold ${
              gps.gpsAccuracy && gps.gpsAccuracy < 10 ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              ±{gps.gpsAccuracy ? gps.gpsAccuracy.toFixed(1) : '—'}m
            </span>
            {isRecording && (
              gps.pointsCount < 2 ? (
                <span className="text-[10px] text-amber-400 font-mono animate-pulse">
                  🛰️ Acquiring Fix ({gps.pointsCount}/2 pts)
                </span>
              ) : (
                <span className="text-[10px] text-sky-400 font-mono hidden sm:inline">
                  📍 {gps.pointsCount} pts
                </span>
              )
            )}

            {/* Sunlight High-Contrast Button */}
            <button
              onClick={toggleSunlightMode}
              title={isSunlightMode ? 'Turn off Sunlight Mode' : 'Sunlight Mode: High-contrast OLED black & neon yellow for direct sun & tinted visors'}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                isSunlightMode
                  ? 'bg-yellow-400 text-black border-yellow-300 font-black shadow-xs'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-yellow-400/80'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sun:</span>
              <span>{isSunlightMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Glove Mode Button */}
            <button
              onClick={toggleGloveMode}
              title={isGloveMode ? 'Turn off Glove Mode' : 'Glove Mode: Extra-large touch targets (70px) and haptic vibration for riding gloves'}
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                isGloveMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-amber-400/80'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Glove:</span>
              <span>{isGloveMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* Voice Announcements Button */}
            {'speechSynthesis' in window && (
              <button
                onClick={() => {
                  triggerHaptic(40);
                  const next = !controls.voiceFeedbackEnabled;
                  controls.setVoiceFeedbackEnabled(next);
                  try {
                    localStorage.setItem('sasta_voice_feedback', String(next));
                  } catch {}
                  if (next && 'speechSynthesis' in window) {
                    const u = new SpeechSynthesisUtterance('Voice intercom announcements enabled');
                    u.rate = 1.05;
                    window.speechSynthesis.speak(u);
                  }
                }}
                title={controls.voiceFeedbackEnabled ? 'Audio milestone announcements active' : 'Turn on audio milestone announcements for Bluetooth helmet intercom'}
                className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                  controls.voiceFeedbackEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600'
                    : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-slate-400'
                }`}
              >
                {controls.voiceFeedbackEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden xs:inline">Voice:</span>
                <span>{controls.voiceFeedbackEnabled ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {/* Crew Group Ride Button */}
            {onOpenGroupRideModal && (
              <button
                id="btn-cockpit-crew"
                onClick={() => {
                  triggerHaptic(40);
                  onOpenGroupRideModal();
                }}
                title="Motorcycle Group Ride: Live location sharing with crew"
                className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                  groupRideConnected
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-xs'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-cyan-400/80'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Crew:</span>
                <span>{groupRideConnected ? `${(groupMembers?.length || 0) + 1}` : 'OFF'}</span>
              </button>
            )}

            {/* Share Live Location / WhatsApp Google Maps Pin */}
            <button
              id="btn-cockpit-share-loc"
              onClick={() => {
                triggerHaptic(40);
                setIsShareLocModalOpen(true);
              }}
              title="Share live Google Maps pin with friends or family on WhatsApp"
              className={`px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Share Pin</span>
            </button>

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

        {/* Group Ride Live Crew HUD */}
        {groupRideConnected && groupRoomCode && (
          <GroupRideHud
            roomCode={groupRoomCode}
            members={groupMembers || []}
            sosAlert={sosAlert || null}
            onOpenModal={() => onOpenGroupRideModal?.()}
            onTriggerSos={() => onTriggerSos?.()}
          />
        )}

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
            SPEED
          </div>
          <div className={`font-mono font-black text-6xl sm:text-8xl lg:text-9xl tracking-tighter select-none ${speedTextColor}`}>
            {currentSpeedConverted.value.toFixed(0)}
          </div>
          <div className="font-mono font-bold text-sm sm:text-lg text-sky-500 uppercase tracking-widest">
            {currentSpeedConverted.unit.toUpperCase()}
          </div>
        </div>

        {/* Lean Angle & Placement Calibration Gauge */}
        <div className={`border rounded-xl p-3 sm:p-4 space-y-2.5 ${innerCardBg}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold uppercase ${subTextColor}`}>
                LEAN ANGLE:
              </span>
              {/* Placement Mode Switcher */}
              <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-[#0d131a] border-[#223140]'}`}>
                <button
                  onClick={() => controls.setMountMode('handlebar')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    gps.mountMode === 'handlebar' ? 'bg-sky-500 text-slate-950 font-bold' : subTextColor
                  }`}
                >
                  🏍️ Handlebar
                </button>
                <button
                  onClick={() => controls.setMountMode('pocket')}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    gps.mountMode === 'pocket' ? 'bg-sky-500 text-slate-950 font-bold' : subTextColor
                  }`}
                >
                  👖 Pocket
                </button>
              </div>
            </div>

            {/* Calibrate / Tare Angle Button */}
            {gps.mountMode === 'handlebar' && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={controls.handleTareAngle}
                  title="Reset upright angle to 0° based on your current phone mount tilt"
                  className="px-2 py-1 bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 text-sky-400 border border-sky-500/30 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Zero Angle</span>
                </button>
                {gps.tareOffset !== 0 && (
                  <button
                    onClick={controls.handleResetTare}
                    title="Clear tare offset"
                    className="p-1 hover:text-rose-400 text-slate-500 rounded transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {gps.mountMode === 'handlebar' ? (
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className={subTextColor}>
                  {gps.tareOffset !== 0 ? `Calibrated (${gps.tareOffset > 0 ? `+${gps.tareOffset}°` : `${gps.tareOffset}°`})` : 'Raw Gyro'}
                </span>
                <strong className={`font-bold ${
                  Math.abs(gps.leanAngle) > 35 ? 'text-rose-500' : Math.abs(gps.leanAngle) > 20 ? 'text-amber-400' : isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  {Math.abs(gps.leanAngle)}° {gps.leanAngle < 0 ? 'LEFT ◀' : gps.leanAngle > 0 ? '▶ RIGHT' : 'UPRIGHT'}
                </strong>
              </div>

              <div className={`relative w-full h-4 border rounded flex items-center justify-center overflow-hidden ${barTrackBg}`}>
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-sky-500/70 z-10" />
                <div
                  className={`h-full transition-all duration-100 ${
                    Math.abs(gps.leanAngle) > 35 ? 'bg-rose-500' : Math.abs(gps.leanAngle) > 20 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${(Math.abs(gps.leanAngle) / 50) * 50}%`,
                    transformOrigin: gps.leanAngle >= 0 ? 'left' : 'right',
                    transform: gps.leanAngle >= 0 ? 'translateX(50%)' : 'translateX(-50%)',
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

        {/* Metric Triad: Distance, Ride Time, Top Speed */}
        <div className="grid grid-cols-3 gap-2.5 text-center font-mono pt-1">
          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase font-semibold ${subTextColor}`}>DISTANCE</div>
            <div className={`font-black text-xl sm:text-2xl mt-0.5 ${speedTextColor}`}>
              {distanceConverted.value.toFixed(2)}
            </div>
            <div className="text-[9px] text-sky-500 font-bold uppercase">{distanceConverted.unit === 'mi' ? 'MILES' : 'KM'}</div>
          </div>

          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase font-semibold ${subTextColor}`}>RIDE TIME</div>
            <div className="font-black text-xl sm:text-2xl text-emerald-500 mt-0.5">
              {formatSec(gps.elapsedSeconds)}
            </div>
            <div className={`text-[9px] ${subTextColor} flex items-center justify-center gap-1.5`}>
              <span title="Moving Time">🟢 {formatSec(gps.movingSeconds)}</span>
              {gps.stoppedSeconds > 0 && <span title="Stopped Time" className="text-amber-400">⏸️ {formatSec(gps.stoppedSeconds)}</span>}
            </div>
          </div>

          <div className={`p-3 border rounded-xl ${innerCardBg}`}>
            <div className={`text-[10px] uppercase font-semibold ${subTextColor}`}>TOP SPEED</div>
            <div className="font-black text-xl sm:text-2xl text-rose-500 mt-0.5">
              {maxSpeedConverted.value.toFixed(1)}
            </div>
            <div className="text-[9px] text-rose-500 font-bold uppercase">{maxSpeedConverted.unit.toUpperCase()}</div>
          </div>
        </div>

        {/* Secondary Telemetry: Altitude & Heading */}
        <div className="grid grid-cols-2 gap-2.5 text-center font-mono">
          <div className={`p-2.5 border rounded-xl flex items-center justify-between text-xs px-3 ${innerCardBg}`}>
            <span className={`flex items-center gap-1.5 ${subTextColor}`}>
              <Mountain className="w-3.5 h-3.5 text-sky-500" /> Altitude
            </span>
            <strong className={speedTextColor}>{gps.currentAltitude !== null ? `${altitudeConverted.value.toFixed(0)} ${altitudeConverted.unit}` : 'Acquiring...'}</strong>
          </div>
          <div className={`p-2.5 border rounded-xl flex items-center justify-between text-xs px-3 ${innerCardBg}`}>
            <span className={`flex items-center gap-1.5 ${subTextColor}`}>
              <Compass className="w-3.5 h-3.5 text-amber-500" /> Heading
            </span>
            <strong className={speedTextColor}>{gps.currentHeading !== null ? `${gps.currentHeading.toFixed(0)}°` : '—'}</strong>
          </div>
        </div>

        {/* Quick Waypoints Dropper */}
        {isRecording && (
          <div className={`pt-3 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
            <div className={`text-[10px] font-mono uppercase tracking-wider ${subTextColor}`}>
              QUICK WAYPOINTS {isGloveMode ? '• GLOVE FRIENDLY' : ''}
            </div>
            <div className={isGloveMode ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-4 gap-2"}>
              <button
                onClick={() => {
                  triggerHaptic(50);
                  controls.markWaypoint('Rest Break');
                }}
                className={`bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-500 border border-amber-500/30 rounded-xl font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isGloveMode ? 'py-4 text-sm font-black' : 'p-2.5 text-xs'
                }`}
              >
                <Coffee className={isGloveMode ? "w-5 h-5" : "w-3.5 h-3.5"} /> Rest
              </button>
              <button
                onClick={() => {
                  triggerHaptic(50);
                  controls.markWaypoint('Fuel');
                }}
                className={`bg-sky-500/10 hover:bg-sky-500 hover:text-black text-sky-500 border border-sky-500/30 rounded-xl font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isGloveMode ? 'py-4 text-sm font-black' : 'p-2.5 text-xs'
                }`}
              >
                <Fuel className={isGloveMode ? "w-5 h-5" : "w-3.5 h-3.5"} /> Fuel
              </button>
              <button
                onClick={() => {
                  triggerHaptic(50);
                  controls.markWaypoint('Photo');
                }}
                className={`bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 border border-emerald-500/30 rounded-xl font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isGloveMode ? 'py-4 text-sm font-black' : 'p-2.5 text-xs'
                }`}
              >
                <Camera className={isGloveMode ? "w-5 h-5" : "w-3.5 h-3.5"} /> Photo
              </button>
              <button
                onClick={() => {
                  triggerHaptic(50);
                  controls.markWaypoint('Food');
                }}
                className={`bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 rounded-xl font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isGloveMode ? 'py-4 text-sm font-black' : 'p-2.5 text-xs'
                }`}
              >
                <Utensils className={isGloveMode ? "w-5 h-5" : "w-3.5 h-3.5"} /> Food
              </button>
            </div>
            {gps.markedWaypoints.length > 0 && (
              <div className="text-[11px] font-mono text-emerald-500 text-center pt-1 font-bold">
                {gps.markedWaypoints.length} waypoints saved to current session
              </div>
            )}
          </div>
        )}

        {/* Primary Controls */}
        <div className="pt-2">
          {!isRecording ? (
            <button
              onClick={handleStartNewRecording}
              className={`w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2.5 rounded-2xl shadow-lg transition-all cursor-pointer hover:shadow-sky-500/20 active:scale-98 ${
                isGloveMode ? 'py-5 text-base sm:text-lg min-h-[70px]' : 'py-3.5 text-sm'
              }`}
            >
              <Play className={isGloveMode ? "w-6 h-6 fill-current" : "w-4 h-4 fill-current"} />
              <span>{isGloveMode ? 'START GPS LOGGING (GLOVE)' : 'START GPS LOGGING'}</span>
            </button>
          ) : isGloveMode ? (
            /* Glove Mode: Massive Dual Touch Blocks */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isPaused ? (
                <button
                  onClick={controls.resumeRecording}
                  className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-base uppercase flex items-center justify-center gap-3 rounded-2xl cursor-pointer shadow-lg active:scale-98 min-h-[70px]"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>RESUME RIDE</span>
                </button>
              ) : (
                <button
                  onClick={controls.pauseRecording}
                  className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-base uppercase flex items-center justify-center gap-3 rounded-2xl cursor-pointer shadow-lg active:scale-98 min-h-[70px]"
                >
                  <Pause className="w-6 h-6 fill-current" />
                  <span>PAUSE RIDE</span>
                </button>
              )}

              <button
                onClick={stopAndSaveRecording}
                className="w-full py-5 bg-rose-500 hover:bg-rose-400 text-white font-mono font-black text-base uppercase flex items-center justify-center gap-3 rounded-2xl shadow-lg cursor-pointer active:scale-98 min-h-[70px]"
              >
                <Square className="w-6 h-6 fill-current" />
                <span>SAVE & STOP</span>
              </button>
            </div>
          ) : (
            /* Standard Sleek Controls */
            <div className="flex flex-wrap items-center justify-center gap-3">
              {isPaused ? (
                <button
                  onClick={controls.resumeRecording}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-sm uppercase flex items-center gap-2 rounded-xl cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>RESUME</span>
                </button>
              ) : (
                <button
                  onClick={controls.pauseRecording}
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
            </div>
          )}
        </div>

        {gps.gpsError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-mono text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gps.gpsError}</span>
          </div>
        )}
      </div>

      {/* Share Location / Google Maps Pin Modal */}
      <ShareLocationModal
        isOpen={isShareLocModalOpen}
        onClose={() => setIsShareLocModalOpen(false)}
        coords={gps.currentCoords}
        speedKmh={gps.currentSpeedKmh}
        accuracyM={gps.gpsAccuracy}
        crewCode={groupRoomCode}
        theme={theme}
      />
    </div>
  );
};

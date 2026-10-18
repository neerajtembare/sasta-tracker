import React, { useState, useEffect, useRef } from 'react';
import { AppTheme, UnitSystem } from '../types';
import { convertSpeed, convertDistance, convertElevation } from '../utils/units';
import { useGPS, GPSState, GPSControls } from '../hooks/useGPS';
import { exportPointsToGPX, downloadFile } from '../utils/gpxExporter';
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
  Users, 
  Share2,
  Download,
  Eye,
  EyeOff,
  X,
  Check
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { GroupRideHud } from './GroupRideHud';
import { ShareLocationModal } from './ShareLocationModal';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
import { Gyro3DVisualizer } from './Gyro3DVisualizer';
import { checkBatteryOptimizationStatus, requestBatteryOptimizationExemption } from '../utils/nativeKeepAlive';

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
  gps?: GPSState;
  controls?: GPSControls;
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
  gps: externalGps,
  controls: externalControls,
  onOpenGroupRideModal,
  onTriggerSos,
  onUpdateMyLocation,
}) => {
  const isLight = theme === 'light';
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [shortRideWarning, setShortRideWarning] = useState<string | null>(null);
  const [isShareLocModalOpen, setIsShareLocModalOpen] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCleanHud, setIsCleanHud] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sasta_clean_hud') === 'true';
    } catch {
      return false;
    }
  });

  const [showGyro, setShowGyro] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sasta_show_gyro') === 'true';
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

  const [isBatteryIgnored, setIsBatteryIgnored] = useState<boolean>(true);

  useEffect(() => {
    checkBatteryOptimizationStatus().then(ignored => {
      setIsBatteryIgnored(ignored);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Keyboard shortcut listener to close open modals on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFinishModal) setShowFinishModal(false);
        if (isShareLocModalOpen) setIsShareLocModalOpen(false);
        if (showHowItWorks) setShowHowItWorks(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showFinishModal, isShareLocModalOpen, showHowItWorks]);

  const toggleCleanHud = () => {
    triggerHaptic(40);
    setIsCleanHud(prev => {
      const next = !prev;
      try { localStorage.setItem('sasta_clean_hud', String(next)); } catch {}
      return next;
    });
  };

  const toggleGyro = () => {
    triggerHaptic(40);
    setShowGyro(prev => {
      const next = !prev;
      try { localStorage.setItem('sasta_show_gyro', String(next)); } catch {}
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
  
  const [internalGps, internalControls] = useGPS(unitSystem, !externalGps);
  const gps = externalGps || internalGps;
  const controls = externalControls || internalControls;

  const isRecording = gps.isRecording;
  const isPaused = gps.isPaused;

  // Broadcast location to parent and crew map with stable ref & primitive deps
  const onUpdateMyLocationRef = useRef(onUpdateMyLocation);
  onUpdateMyLocationRef.current = onUpdateMyLocation;

  useEffect(() => {
    if (gps.currentCoords && onUpdateMyLocationRef.current) {
      onUpdateMyLocationRef.current(
        gps.currentCoords.lat,
        gps.currentCoords.lon,
        gps.currentSpeedKmh,
        gps.currentHeading
      );
    }
  }, [
    gps.currentCoords?.lat,
    gps.currentCoords?.lon,
    gps.currentSpeedKmh,
    gps.currentHeading
  ]);

  const handleExportCurrentGpx = () => {
    triggerHaptic(40);
    const pts = controls.getCurrentPoints ? controls.getCurrentPoints() : [];
    if (pts.length < 2) {
      showToast('⚠️ Need at least 2 GPS points to export GPX.');
      return;
    }
    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      pts,
      gps.markedWaypoints
    );
    downloadFile(
      gpxString,
      `ThrottleLog_Ride_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.gpx`
    );
    showToast('💾 GPX file downloaded to device!');
  };

  const handleDownloadRecoveredGpx = () => {
    if (!controls.recoverableData?.points || controls.recoverableData.points.length < 2) return;
    triggerHaptic(40);
    const pts = controls.recoverableData.points;
    const wpts = controls.recoverableData.waypoints || [];
    const gpxString = exportPointsToGPX(
      `Recovered Ride — ${new Date().toLocaleDateString()}`,
      pts,
      wpts
    );
    downloadFile(gpxString, `ThrottleLog_Recovered_${Date.now()}.gpx`);
    showToast('💾 Recovered GPX backup downloaded!');
  };

  const handleFinishAndSave = (downloadAlso: boolean = false) => {
    setShowFinishModal(false);
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

    if (downloadAlso) {
      downloadFile(gpxString, `ThrottleLog_Ride_${Date.now()}.gpx`);
      showToast('💾 GPX downloaded & saved to Garage!');
    }

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

  const currentSpeedConverted = convertSpeed(gps.currentSpeedKmh, unitSystem);
  const maxSpeedConverted = convertSpeed(gps.maxRecordedSpeed, unitSystem);
  const distanceConverted = convertDistance(gps.totalDistanceMeters / 1000, unitSystem);
  const altitudeConverted = convertElevation(gps.currentAltitude, unitSystem);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500 text-slate-950 font-mono font-bold text-xs rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
 
      {/* Background Battery Optimization Exemption Banner (Ensures 100% background GPS in pocket) */}
      {!isBatteryIgnored && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2 font-mono text-xs text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate text-[11px]">Enable unrestricted battery for 100% background GPS in pocket</span>
          </div>
          <button
            onClick={async () => {
              triggerHaptic(25);
              await requestBatteryOptimizationExemption();
              setIsBatteryIgnored(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] shrink-0 cursor-pointer shadow-sm transition-all active:scale-95"
          >
            Allow
          </button>
        </div>
      )}

      {/* Interrupted Session Recovery Banner (Safe against browser refresh or crash) */}
      {controls.hasRecoverableRide && controls.recoverableData && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2.5 font-mono text-xs shadow-lg animate-in fade-in duration-200 ${
          isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-sm">⚠️ Interrupted Ride Detected!</div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Saved {controls.recoverableData.points?.length || 0} GPS points ({convertDistance((controls.recoverableData.totalDistanceMeters || 0) / 1000, unitSystem).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}) from your previous ride.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={handleResumeSession}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </button>
            <button
              onClick={handleDownloadRecoveredGpx}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download GPX</span>
            </button>
            <button
              onClick={controls.handleDiscardSession}
              className={`px-2.5 py-1.5 border rounded-lg transition-colors cursor-pointer text-[11px] ${
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
        <div className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2.5 font-mono text-xs shadow-lg animate-in fade-in duration-200 ${
          isLight ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <div className="text-[11px] opacity-90 max-w-xl">
              {shortRideWarning}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShortRideWarning(null)}
              className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-xs"
            >
              Keep Tracking
            </button>
            <button
              onClick={handleForceDiscard}
              className={`px-2.5 py-1 border rounded-lg transition-colors cursor-pointer text-xs ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          COCKPIT HUD MAIN CLUSTER (UNCLUTTERED, STREAMLINED INSTRUMENT PANEL)
      ───────────────────────────────────────────────────────────── */}
      <div className={`border rounded-2xl p-2.5 sm:p-4 landscape:p-2 relative overflow-hidden shadow-2xl space-y-2.5 landscape:space-y-1.5 ${cardBg}`}>
        
        {/* Streamlined Top Navigation & Status Bar */}
        <div className={`flex flex-wrap items-center justify-between gap-1.5 border-b pb-2 landscape:pb-1 text-xs font-mono ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500 ring-2 ring-rose-500/30 animate-pulse') : 'bg-slate-500'
              }`} />
            </span>
            <span className="font-bold text-[11px] uppercase tracking-wider">
              {isRecording ? (isPaused ? 'PAUSED' : 'LIVE GPS') : 'STANDBY'}
            </span>
            <span className={`text-[10px] font-bold ${gps.gpsAccuracy && gps.gpsAccuracy < 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
              ±{gps.gpsAccuracy ? gps.gpsAccuracy.toFixed(0) : '—'}m
            </span>
            {isRecording && (
              <span className="text-[10px] text-sky-400 hidden xs:inline">
                📍 {gps.pointsCount} pts
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-xs">
            {/* Clean HUD / Focus Mode Toggle */}
            <button
              onClick={toggleCleanHud}
              title={isCleanHud ? 'Exit Clean HUD (Show all telemetry)' : 'Clean HUD: Streamlines UI, hides secondary numbers for distraction-free riding'}
              className={`px-2 py-0.5 rounded-lg border text-[10px] sm:text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                isCleanHud
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                  : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-cyan-400/80'
              }`}
            >
              {isCleanHud ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{isCleanHud ? 'Clean ON' : 'Clean'}</span>
            </button>

            {/* 3D Lean Angle & Gyro Toggle */}
            {!isCleanHud && (
              <button
                onClick={toggleGyro}
                title="Toggle 3D Lean Angle & Gyroscope panel"
                className={`px-2 py-0.5 rounded-lg border text-[10px] sm:text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                  showGyro
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-cyan-400/80'
                }`}
              >
                <Compass className="w-3 h-3" />
                <span className="hidden sm:inline">Lean</span>
              </button>
            )}

            {/* Sun / High Contrast */}
            <button
              onClick={toggleSunlightMode}
              title="Sunlight Mode (High-contrast OLED black & neon yellow)"
              className={`p-1 sm:px-1.5 sm:py-0.5 rounded-lg border text-[10px] flex items-center gap-0.5 cursor-pointer ${
                isSunlightMode ? 'bg-yellow-400 text-black border-yellow-300 font-bold' : isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#141d26] border-[#223140] text-yellow-400/80'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span className="hidden md:inline">{isSunlightMode ? 'Sun ON' : 'Sun'}</span>
            </button>

            {/* Crew Live Button */}
            {onOpenGroupRideModal && (
              <button
                onClick={() => {
                  triggerHaptic(40);
                  onOpenGroupRideModal();
                }}
                title="Crew Live Radar"
                className={`p-1 sm:px-1.5 sm:py-0.5 rounded-lg border text-[10px] flex items-center gap-1 cursor-pointer ${
                  groupRideConnected ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold' : isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#141d26] border-[#223140] text-cyan-400/80'
                }`}
              >
                <Users className="w-3 h-3" />
                <span className="font-bold">{groupRideConnected ? `${(groupMembers?.length || 0) + 1}` : 'Crew'}</span>
              </button>
            )}

            {/* Share Pin */}
            <button
              onClick={() => {
                triggerHaptic(40);
                setIsShareLocModalOpen(true);
              }}
              title="Share live location pin"
              className={`p-1 sm:px-1.5 sm:py-0.5 rounded-lg border text-[10px] flex items-center gap-0.5 cursor-pointer ${
                isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Share2 className="w-3 h-3 text-emerald-400" />
            </button>
          </div>
        </div>

        {/* Group Ride Live Crew HUD (Portrait only) */}
        {groupRideConnected && groupRoomCode && !isCleanHud && (
          <div className="landscape:hidden">
            <GroupRideHud
              roomCode={groupRoomCode}
              members={groupMembers || []}
              sosAlert={sosAlert || null}
              onOpenModal={() => onOpenGroupRideModal?.()}
              onTriggerSos={() => {
                if (window.confirm('🚨 Broadcast EMERGENCY REGROUP alert to all crew riders?')) {
                  onTriggerSos?.();
                }
              }}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            WIDESCREEN TFT COCKPIT POD (DUAL COLUMN IN LANDSCAPE, STACK IN PORTRAIT)
        ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 landscape:grid-cols-12 gap-2.5 landscape:gap-2 items-stretch">
          
          {/* LEFT POD (landscape:col-span-7) -> SPEEDOMETER + GLANCE TELEMETRY STRIP (NO UNWANTED BULKY BOXES!) */}
          <div className="landscape:col-span-7 flex flex-col justify-between space-y-2 landscape:space-y-1">
            
            {/* Speedometer Display (Floating, Clean, Borderless Glanceability) */}
            <div className={`text-center py-2 sm:py-3 landscape:py-1 relative rounded-xl flex flex-col justify-center ${innerCardBg}`}>
              <div className={`text-[10px] font-mono tracking-widest uppercase ${subTextColor}`}>
                SPEED
              </div>
              <div className={`font-mono font-black text-6xl sm:text-7xl landscape:text-6xl leading-none tracking-tighter select-none my-0.5 ${speedTextColor}`}>
                {currentSpeedConverted.value.toFixed(0)}
              </div>
              <div className="font-mono font-bold text-xs landscape:text-[10px] text-cyan-400 uppercase tracking-widest">
                {currentSpeedConverted.unit.toUpperCase()}
              </div>
            </div>

            {/* Unified Glance Telemetry Ribbon (Single strip instead of 3 bulky boxes) */}
            <div className={`p-2 sm:p-2.5 landscape:p-1.5 rounded-xl border flex items-center justify-around font-mono text-center ${innerCardBg}`}>
              {/* Distance */}
              <div className="flex-1">
                <div className={`text-[9px] uppercase font-semibold ${subTextColor}`}>DISTANCE</div>
                <div className={`font-black text-base sm:text-xl landscape:text-base mt-0.5 ${speedTextColor}`}>
                  {distanceConverted.value.toFixed(2)}
                  <span className="text-[9px] text-cyan-400 font-bold ml-1 uppercase">{distanceConverted.unit === 'mi' ? 'MI' : 'KM'}</span>
                </div>
              </div>

              <div className="w-px h-7 bg-slate-700/60" />

              {/* Ride Time */}
              <div className="flex-1">
                <div className={`text-[9px] uppercase font-semibold ${subTextColor}`}>TIME</div>
                <div className="font-black text-base sm:text-xl landscape:text-base text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                  <span>{formatSec(gps.elapsedSeconds)}</span>
                  {gps.stoppedSeconds > 0 && <span title="Stopped Time" className="text-[10px] text-amber-400">⏸️</span>}
                </div>
              </div>

              <div className="w-px h-7 bg-slate-700/60" />

              {/* Top Speed */}
              <div className="flex-1">
                <div className={`text-[9px] uppercase font-semibold ${subTextColor}`}>TOP SPD</div>
                <div className="font-black text-base sm:text-xl landscape:text-base text-rose-400 mt-0.5">
                  {maxSpeedConverted.value.toFixed(1)}
                  <span className="text-[9px] text-rose-400/80 font-bold ml-1 uppercase">{maxSpeedConverted.unit}</span>
                </div>
              </div>
            </div>

            {/* Optional Altitude & Heading Pill (Only shown when NOT in Clean HUD mode) */}
            {!isCleanHud && (
              <div className={`p-1.5 landscape:p-1 rounded-lg border flex items-center justify-between text-[11px] font-mono px-3 ${innerCardBg}`}>
                <span className="flex items-center gap-1 text-slate-400">
                  <Mountain className="w-3 h-3 text-cyan-400" />
                  <span>Alt:</span>
                  <strong className={speedTextColor}>{gps.currentAltitude !== null ? `${altitudeConverted.value.toFixed(0)} ${altitudeConverted.unit}` : '—'}</strong>
                </span>
                <span className="w-px h-3 bg-slate-700/60" />
                <span className="flex items-center gap-1 text-slate-400">
                  <Compass className="w-3 h-3 text-amber-400" />
                  <span>Hdg:</span>
                  <strong className={speedTextColor}>{gps.currentHeading !== null ? `${gps.currentHeading.toFixed(0)}°` : '—'}</strong>
                </span>
              </div>
            )}
          </div>

          {/* RIGHT POD (landscape:col-span-5) -> 3D GYRO (COLLAPSIBLE) + EXPANDABLE WAYPOINTS + ACTION CONTROLS */}
          <div className="landscape:col-span-5 flex flex-col justify-between space-y-2 landscape:space-y-1">
            {/* 3D Gyroscope Horizon & Zero Setup Visualizer (Collapsible to keep Cockpit clean) */}
            {showGyro && !isCleanHud && (
              <div className="animate-in fade-in duration-200">
                <Gyro3DVisualizer
                  leanAngle={gps.leanAngle}
                  pitchAngle={gps.pitchAngle}
                  maxLeftLean={gps.maxLeftLean}
                  maxRightLean={gps.maxRightLean}
                  gForceLateral={gps.gForceLateral}
                  mountMode={gps.mountMode}
                  mountOrientation={gps.mountOrientation}
                  isCalibrated={gps.isGyroCalibrated}
                  onTareAngle={controls.handleTareAngle}
                  onResetTare={controls.handleResetTare}
                  onSetMountMode={controls.setMountMode}
                  onSetMountOrientation={controls.setMountOrientation}
                  isLight={isLight}
                />
              </div>
            )}

            {/* Expandable Quick Waypoints Dropper (Takes zero space unless clicked!) */}
            {isRecording && !isCleanHud && (
              <div className="space-y-1">
                <button
                  onClick={() => setShowWaypoints(!showWaypoints)}
                  className={`w-full py-1 px-2 border rounded-lg text-[10px] font-mono flex items-center justify-between cursor-pointer transition-colors ${
                    showWaypoints
                      ? 'bg-slate-800 border-slate-700 text-cyan-400'
                      : isLight
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600'
                      : 'bg-[#141d26] hover:bg-[#1a2533] border-[#223140] text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Mark Stop / Waypoint</span>
                    {gps.markedWaypoints.length > 0 && (
                      <span className="px-1 bg-cyan-500/20 text-cyan-300 rounded font-bold">
                        {gps.markedWaypoints.length}
                      </span>
                    )}
                  </span>
                  {showWaypoints ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showWaypoints && (
                  <div className="grid grid-cols-4 gap-1.5 animate-in fade-in duration-150">
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Rest Break');
                        showToast('☕ Rest waypoint marked');
                      }}
                      className="bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-500 border border-amber-500/30 rounded-lg font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]"
                    >
                      <Coffee className="w-3 h-3" /> Rest
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Fuel');
                        showToast('⛽ Fuel stop marked');
                      }}
                      className="bg-sky-500/10 hover:bg-sky-500 hover:text-black text-sky-500 border border-sky-500/30 rounded-lg font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]"
                    >
                      <Fuel className="w-3 h-3" /> Fuel
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Photo');
                        showToast('📷 Photo point marked');
                      }}
                      className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-500 border border-emerald-500/30 rounded-lg font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]"
                    >
                      <Camera className="w-3 h-3" /> Photo
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Food');
                        showToast('🍔 Food stop marked');
                      }}
                      className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/30 rounded-lg font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]"
                    >
                      <Utensils className="w-3 h-3" /> Food
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Controls (Always large, tactile & glove-friendly) */}
            <div className="pt-0.5">
              {!isRecording ? (
                <button
                  onClick={handleStartNewRecording}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl shadow-lg transition-all cursor-pointer hover:shadow-cyan-500/20 active:scale-98 py-3.5 landscape:py-2 text-base landscape:text-sm min-h-[50px]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START RIDE</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {isPaused ? (
                    <button
                      onClick={controls.resumeRecording}
                      className="w-full py-3 landscape:py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-lg active:scale-98 min-h-[50px]"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>RESUME</span>
                    </button>
                  ) : (
                    <button
                      onClick={controls.pauseRecording}
                      className="w-full py-3 landscape:py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-lg active:scale-98 min-h-[50px]"
                    >
                      <Pause className="w-5 h-5 fill-current" />
                      <span>PAUSE</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowFinishModal(true)}
                    className="w-full py-3 landscape:py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl shadow-lg cursor-pointer active:scale-98 min-h-[50px]"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    <span>FINISH</span>
                  </button>
                </div>
              )}
            </div>

            {gps.gpsError && (
              <div className="p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg font-mono text-[10px] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{gps.gpsError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Finish Ride Modal with Instant Download GPX / Save to Garage Options */}
      {showFinishModal && (
        <div 
          onClick={e => { if (e.target === e.currentTarget) setShowFinishModal(false); }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl space-y-4 font-mono cursor-default ${innerCardBg}`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700">
              <div className="flex items-center gap-2">
                <Square className="w-5 h-5 text-rose-500 fill-current" />
                <h3 className="font-bold text-base text-white">Finish Ride Recording</h3>
              </div>
              <button
                onClick={() => setShowFinishModal(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">DISTANCE</span>
                <strong className="text-white text-base">{distanceConverted.value.toFixed(2)} {distanceConverted.unit.toUpperCase()}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TIME</span>
                <strong className="text-emerald-400 text-base">{formatSec(gps.elapsedSeconds)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">GPS POINTS</span>
                <strong className="text-cyan-400 text-base">{gps.pointsCount}</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* Option 1: Save to Garage & Open Analysis */}
              <button
                onClick={() => handleFinishAndSave(false)}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 text-sm"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save to Garage & Review Analysis</span>
              </button>

              {/* Option 2: Download GPX File Directly */}
              <button
                onClick={() => handleFinishAndSave(true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download GPX File Directly</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowFinishModal(false)}
                className="w-full py-2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Cancel & Continue Riding
              </button>
            </div>
          </div>
        </div>
      )}

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

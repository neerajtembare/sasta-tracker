import React, { useState, useEffect, useRef } from 'react';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import {
  convertSpeed,
  convertDistance,
  convertElevation,
  readMigratedStorageKey,
  writeMigratedStorageKey,
} from '../utils/units';
import { useGPS, GPSState, GPSControls } from '../hooks/useGPS';
import { exportPointsToGPX, downloadFile } from '../utils/gpxExporter';
import { calculateNavGuidance } from '../utils/routeGenerator';
import { openActiveRouteNavigation } from '../utils/navigation';
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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Navigation,
  Flag,
  Target,
  X,
  Check,
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { GroupRideHud } from './GroupRideHud';
import { GroupMemberInfo, SosAlert, ActiveVoiceBlast } from '../hooks/useGroupRide';
import { Gyro3DVisualizer } from './Gyro3DVisualizer';
import { VoiceBlastBanner } from './VoiceBlastPtt';

interface LiveCockpitLoggerProps {
  onRideRecorded: (gpxString: string) => void;
  isRecording: boolean;
  setIsRecording: (rec: boolean) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  groupRideConnected?: boolean;
  groupRoomCode?: string;
  groupMembers?: GroupMemberInfo[];
  groupRiderId?: string;
  groupRiderName?: string;
  sosAlert?: SosAlert | null;
  gps?: GPSState;
  controls?: GPSControls;
  onOpenGroupRideModal?: () => void;
  onTriggerSos?: () => void;
  onCancelSos?: () => void;
  onUpdateMyLocation?: (lat: number, lon: number, speedKmh: number, bearing: number | null) => void;
  activeVoiceBlast?: ActiveVoiceBlast | null;
  onDismissVoiceBlast?: () => void;
  onSendVoiceBlast?: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  onSwitchToMap?: () => void;
  onGoToDashboard?: () => void;
  activeRoute?: RideAnalysis | null;
  onClearActiveRoute?: () => void;
  onOpenGoogleMapsImport?: () => void;
  onOpenSettings?: () => void;
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
  groupRiderId,
  groupRiderName,
  sosAlert,
  gps: externalGps,
  controls: externalControls,
  onOpenGroupRideModal,
  onTriggerSos,
  onCancelSos,
  onUpdateMyLocation,
  activeVoiceBlast = null,
  onDismissVoiceBlast,
  onSendVoiceBlast,
  onSwitchToMap,
  onGoToDashboard,
  activeRoute = null,
  onClearActiveRoute,
  onOpenGoogleMapsImport,
}) => {
  const isLight = theme === 'light';
  const [shortRideWarning, setShortRideWarning] = useState<string | null>(null);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [isConfirmSosOpen, setIsConfirmSosOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isCleanHud, setIsCleanHud] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_clean_hud', 'sasta_clean_hud') === 'true';
  });

  const [showGyro, setShowGyro] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_show_gyro', 'sasta_show_gyro') === 'true';
  });

  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode') === 'true';
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Keyboard shortcut listener to close open modals on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFinishModal) setShowFinishModal(false);
        if (isConfirmSosOpen) setIsConfirmSosOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showFinishModal, isConfirmSosOpen]);

  const toggleCleanHud = () => {
    triggerHaptic(40);
    setIsCleanHud(prev => {
      const next = !prev;
      writeMigratedStorageKey('throttlelog_clean_hud', String(next), 'sasta_clean_hud');
      return next;
    });
  };

  useEffect(() => {
    const syncPrefs = () => {
      setShowGyro(readMigratedStorageKey('throttlelog_show_gyro', 'sasta_show_gyro') === 'true');
      setIsSunlightMode(readMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode') === 'true');
    };
    window.addEventListener('throttlelog-hud-prefs', syncPrefs);
    window.addEventListener('focus', syncPrefs);
    return () => {
      window.removeEventListener('throttlelog-hud-prefs', syncPrefs);
      window.removeEventListener('focus', syncPrefs);
    };
  }, []);

  const [internalGps, internalControls] = useGPS(unitSystem, !externalGps);
  const gps = externalGps || internalGps;
  const controls = externalControls || internalControls;

  const isRecording = gps.isRecording;
  const isPaused = gps.isPaused;

  // Broadcast location to parent and crew map with stable ref & primitive deps
  const onUpdateMyLocationRef = useRef(onUpdateMyLocation);
  onUpdateMyLocationRef.current = onUpdateMyLocation;

  useEffect(() => {
    if (!externalGps && gps.currentCoords && onUpdateMyLocationRef.current) {
      onUpdateMyLocationRef.current(
        gps.currentCoords.lat,
        gps.currentCoords.lon,
        gps.currentSpeedKmh,
        gps.currentHeading
      );
    }
  }, [
    externalGps,
    gps.currentCoords?.lat,
    gps.currentCoords?.lon,
    gps.currentSpeedKmh,
    gps.currentHeading
  ]);

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
    showToast('Recovered GPX backup downloaded.');
  };

  const handleFinishAndSave = (downloadAlso: boolean = false) => {
    setShowFinishModal(false);
    triggerHaptic(50);
    if (gps.pointsCount < 2 || (!downloadAlso && gps.totalDistanceMeters < 80)) {
      controls.stopAndGetPoints();
      _externalSetIsRecording(false);
      setShortRideWarning(null);
      showToast('Recording cancelled (track was too short to save).');
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
      showToast('GPX downloaded and saved to Garage.');
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

  // Swipe gesture support to seamlessly switch between Cockpit HUD, Map, and Dashboard
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = touchStartYRef.current !== null ? Math.abs(e.changedTouches[0].clientY - touchStartYRef.current) : 0;
      touchStartXRef.current = null;
      touchStartYRef.current = null;

      if (Math.abs(deltaX) > 75 && deltaY < 60) {
        if (deltaX < 0 && onSwitchToMap) {
          triggerHaptic(30);
          onSwitchToMap();
        } else if (deltaX > 0 && onGoToDashboard) {
          triggerHaptic(30);
          onGoToDashboard();
        }
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-4xl mx-auto space-y-3 select-none"
    >
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--safe-bottom,0px)+4.75rem)] md:bottom-5 landscape:bottom-3 z-[7500] px-4 py-2 bg-emerald-500 text-slate-950 font-sans font-bold text-xs rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200 border border-emerald-400 max-w-[90vw]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Interrupted Session Recovery Banner */}
      {controls.hasRecoverableRide && controls.recoverableData && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2.5 font-sans text-xs shadow-lg animate-in fade-in duration-200 ${isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
          }`}>
          <div className="flex items-center gap-2.5">
            <AlertCircle className={`w-5 h-5 shrink-0 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
            <div>
              <div className="font-bold text-sm">Interrupted Ride Detected</div>
              <div className="text-[11px] opacity-85 mt-0.5 font-mono telemetry-num">
                Saved {controls.recoverableData.points?.length || 0} GPS points ({convertDistance((controls.recoverableData.totalDistanceMeters || 0) / 1000).value.toFixed(1)} km) from your previous ride.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              type="button"
              onClick={handleResumeSession}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadRecoveredGpx}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download GPX</span>
            </button>
            <button
              type="button"
              onClick={controls.handleDiscardSession}
              className={`px-2.5 py-1.5 border rounded-lg transition-colors cursor-pointer text-[11px] ${isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Short Ride Warning Alert */}
      {shortRideWarning && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2.5 font-sans text-xs shadow-lg animate-in fade-in duration-200 ${isLight ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
            <div className="text-[11px] opacity-90 max-w-xl">
              {shortRideWarning}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setShortRideWarning(null)}
              className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-xs"
            >
              Keep Tracking
            </button>
            <button
              type="button"
              onClick={handleForceDiscard}
              className={`px-2.5 py-1 border rounded-lg transition-colors cursor-pointer text-xs ${isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* COCKPIT HUD MAIN CLUSTER */}
      <div className={`border rounded-2xl p-2.5 sm:p-4 landscape:p-1.5 relative overflow-hidden shadow-2xl space-y-2.5 landscape:space-y-1 ${cardBg}`}>

        {/* Streamlined Top Status & Ride Action Bar (No duplicated Home/Map/Settings buttons) */}
        <div className={`flex items-center justify-between gap-2 border-b pb-2 landscape:pb-1 text-xs font-sans ${isLight ? 'border-slate-200' : 'border-[#1e2a38]'}`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRecording ? (isPaused ? 'bg-amber-400' : 'bg-rose-500 ring-2 ring-rose-500/30 animate-pulse') : 'bg-slate-500'
                }`} />
            </span>
            <span className="font-bold text-[11px] uppercase tracking-wider truncate">
              {isRecording ? (isPaused ? 'PAUSED' : 'LIVE') : 'STANDBY'}
            </span>
            <span className={`text-[11px] font-mono telemetry-num font-bold shrink-0 ${
              gps.gpsAccuracy && gps.gpsAccuracy < 10
                ? (isLight ? 'text-emerald-700' : 'text-emerald-400')
                : (isLight ? 'text-amber-700' : 'text-amber-400')
            }`}>
              ±{gps.gpsAccuracy ? gps.gpsAccuracy.toFixed(0) : '—'}m
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs shrink-0">
            {/* Set Destination Target from Google Maps Link */}
            {onOpenGoogleMapsImport && !activeRoute && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onOpenGoogleMapsImport();
                }}
                aria-label="Set Destination Target from Google Maps"
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${isLight
                  ? 'border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-800'
                  : 'border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300'
                  }`}
                title="Set Destination Target from Google Maps"
              >
                <Target className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Destination</span>
              </button>
            )}

            {/* Clean HUD / Focus Mode Toggle */}
            <button
              type="button"
              onClick={toggleCleanHud}
              aria-label={isCleanHud ? 'Show full telemetry HUD' : 'Switch to clean HUD'}
              title={isCleanHud ? 'Exit Clean HUD (Show all telemetry)' : 'Clean HUD: Streamlines display while riding'}
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${isCleanHud
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-[#141d26] hover:bg-[#1f2c3a] border-[#223140] text-cyan-300'
                }`}
            >
              {isCleanHud ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isCleanHud ? 'Full HUD' : 'Clean HUD'}</span>
            </button>
          </div>
        </div>

        {/* Active Incoming Voice Blast Intercom Banner */}
        {activeVoiceBlast && (
          <div className="mb-1.5">
            <VoiceBlastBanner activeBlast={activeVoiceBlast} onDismiss={onDismissVoiceBlast} theme={theme} />
          </div>
        )}

        {/* Group Ride Live Crew HUD (SOS + PTT kept accessible even in Clean HUD mode) */}
        {groupRideConnected && groupRoomCode && (
          <div>
            <GroupRideHud
              roomCode={groupRoomCode}
              members={groupMembers || []}
              sosAlert={sosAlert || null}
              riderId={groupRiderId}
              riderName={groupRiderName}
              onOpenModal={() => onOpenGroupRideModal?.()}
              onSendVoiceBlast={onSendVoiceBlast}
              onTriggerSos={() => {
                triggerHaptic(35);
                setIsConfirmSosOpen(true);
              }}
              onCancelSos={onCancelSos}
              unitSystem={unitSystem}
              theme={theme}
            />
          </div>
        )}

        {/* Active Google Maps / Target Route Navigation Capsule */}
        {activeRoute && activeRoute.points && activeRoute.points.length > 0 && (() => {
          const destPt = activeRoute.points[activeRoute.points.length - 1];
          const guidance = calculateNavGuidance(gps.currentCoords, destPt, gps.currentHeading);
          return (
            <div className={`p-2 sm:p-2.5 landscape:py-1 landscape:px-2 rounded-xl sm:rounded-2xl border flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-200 ${isLight ? 'bg-cyan-50 border-cyan-300 text-slate-900' : 'bg-cyan-950/40 border-cyan-500/50 text-white'
              }`}>
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 landscape:w-6 landscape:h-6 rounded-lg sm:rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 shadow-md">
                  {guidance ? guidance.directionArrow : <Flag className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <Flag className={`w-3 h-3 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                    <span className="font-bold text-xs landscape:text-[11px] truncate">{activeRoute.name || 'Target Destination'}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-[11px] landscape:text-[10px] font-mono telemetry-num ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>
                    {guidance ? (
                      <>
                        <span className="font-black text-xs sm:text-sm landscape:text-xs">
                          {guidance.distanceRemainingKm.toFixed(1)} km
                        </span>
                        <span className="opacity-75">• {guidance.targetBearing}°</span>
                      </>
                    ) : (
                      <span>{activeRoute.totalDistanceKm.toFixed(1)} km</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    openActiveRouteNavigation(activeRoute);
                  }}
                  className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${isLight
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                    }`}
                  title="Open Google Maps Turn-by-Turn Navigation"
                >
                  <Navigation className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden xs:inline">Maps Nav</span>
                </button>

                {onClearActiveRoute && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onClearActiveRoute();
                    }}
                    aria-label="Cancel Route Target"
                    className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl border transition-colors cursor-pointer ${isLight
                      ? 'border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    title="Cancel Route Target"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* WIDESCREEN TFT COCKPIT POD */}
        <div className="grid grid-cols-1 landscape:grid-cols-12 gap-2.5 landscape:gap-2 items-stretch">

          {/* LEFT POD */}
          <div className="landscape:col-span-7 flex flex-col justify-between space-y-2 landscape:space-y-1">

            {/* Speedometer Display */}
            <div className={`text-center py-2 sm:py-3 landscape:py-1 relative rounded-xl flex flex-col justify-center ${innerCardBg}`}>
              <div className={`text-[10px] font-sans tracking-widest uppercase ${subTextColor}`}>
                SPEED
              </div>
              <div className={`font-mono telemetry-num font-black text-6xl sm:text-7xl landscape:text-5xl leading-none tracking-tighter select-none my-0.5 ${speedTextColor}`}>
                {currentSpeedConverted.value.toFixed(0)}
              </div>
              <div className={`font-mono font-bold text-xs landscape:text-[10px] tracking-widest ${
                isSunlightMode ? 'text-yellow-400' : isLight ? 'text-cyan-700' : 'text-cyan-400'
              }`}>
                km/h
              </div>
            </div>

            {/* Unified Glance Telemetry Ribbon */}
            {!isCleanHud && (
              <div className={`p-2 sm:p-2.5 landscape:p-1 rounded-xl border flex items-center justify-around font-mono telemetry-num text-center ${innerCardBg}`}>
                <div className="flex-1">
                  <div className={`text-[9px] font-sans uppercase font-semibold ${subTextColor}`}>DISTANCE</div>
                  <div className={`font-black text-base sm:text-xl landscape:text-base mt-0.5 ${speedTextColor}`}>
                    {distanceConverted.value.toFixed(2)}
                    <span className={`text-[9px] font-bold ml-1 ${isSunlightMode ? 'text-yellow-400' : isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>km</span>
                  </div>
                </div>

                <div className={`w-px h-7 ${isLight ? 'bg-slate-300' : 'bg-slate-700/60'}`} />

                <div className="flex-1">
                  <div className={`text-[9px] font-sans uppercase font-semibold ${subTextColor}`}>TIME</div>
                  <div className={`font-black text-base sm:text-xl landscape:text-base mt-0.5 flex items-center justify-center gap-1 ${
                    isSunlightMode ? 'text-emerald-300' : isLight ? 'text-emerald-700' : 'text-emerald-400'
                  }`}>
                    <span>{formatSec(gps.elapsedSeconds)}</span>
                    {gps.stoppedSeconds > 0 && <Pause className={`w-3 h-3 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />}
                  </div>
                </div>

                <div className={`w-px h-7 ${isLight ? 'bg-slate-300' : 'bg-slate-700/60'}`} />

                <div className="flex-1">
                  <div className={`text-[9px] font-sans uppercase font-semibold ${subTextColor}`}>TOP SPD</div>
                  <div className={`font-black text-base sm:text-xl landscape:text-base mt-0.5 ${
                    isSunlightMode ? 'text-rose-400' : isLight ? 'text-rose-700' : 'text-rose-400'
                  }`}>
                    {maxSpeedConverted.value.toFixed(1)}
                    <span className="text-[9px] font-bold ml-1 opacity-80">km/h</span>
                  </div>
                </div>
              </div>
            )}

            {/* Altitude & Heading Pill */}
            {!isCleanHud && (
              <div className={`p-1.5 landscape:p-1 rounded-lg border flex items-center justify-between text-[11px] font-mono telemetry-num px-3 ${innerCardBg}`}>
                <span className={`flex items-center gap-1 ${subTextColor}`}>
                  <Mountain className={`w-3 h-3 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                  <span>Alt:</span>
                  <strong className={speedTextColor}>{gps.currentAltitude !== null && altitudeConverted.value !== null ? `${altitudeConverted.value.toFixed(0)} m` : '—'}</strong>
                </span>
                <span className={`w-px h-3 ${isLight ? 'bg-slate-300' : 'bg-slate-700/60'}`} />
                <span className={`flex items-center gap-1 ${subTextColor}`}>
                  <Compass className={`w-3 h-3 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
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
                  className={`w-full py-1 px-2 border rounded-lg text-[10px] font-mono flex items-center justify-between cursor-pointer transition-colors ${showWaypoints
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
                        showToast('Rest waypoint marked');
                      }}
                      className={`bg-amber-500/10 hover:bg-amber-500 hover:text-black ${isLight ? 'text-amber-700' : 'text-amber-400'} border border-amber-500/30 rounded-lg font-sans font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]`}
                    >
                      <Coffee className="w-3 h-3" /> Rest
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Fuel');
                        showToast('Fuel stop marked');
                      }}
                      className={`bg-sky-500/10 hover:bg-sky-500 hover:text-black ${isLight ? 'text-sky-700' : 'text-sky-400'} border border-sky-500/30 rounded-lg font-sans font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]`}
                    >
                      <Fuel className="w-3 h-3" /> Fuel
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Photo');
                        showToast('Photo point marked');
                      }}
                      className={`bg-emerald-500/10 hover:bg-emerald-500 hover:text-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'} border border-emerald-500/30 rounded-lg font-sans font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]`}
                    >
                      <Camera className="w-3 h-3" /> Photo
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic(50);
                        controls.markWaypoint('Food');
                        showToast('Food stop marked');
                      }}
                      className={`bg-rose-500/10 hover:bg-rose-500 hover:text-white ${isLight ? 'text-rose-700' : 'text-rose-400'} border border-rose-500/30 rounded-lg font-sans font-bold flex items-center justify-center gap-1 transition-all cursor-pointer p-1.5 text-[10px]`}
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
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl shadow-lg transition-all cursor-pointer hover:shadow-cyan-500/20 active:scale-98 py-3.5 landscape:py-1.5 text-base landscape:text-sm min-h-[50px] landscape:min-h-[40px]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>START RIDE</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {isPaused ? (
                    <button
                      onClick={controls.resumeRecording}
                      className="w-full py-3 landscape:py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-lg active:scale-98 min-h-[50px] landscape:min-h-[40px]"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>RESUME</span>
                    </button>
                  ) : (
                    <button
                      onClick={controls.pauseRecording}
                      className="w-full py-3 landscape:py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-lg active:scale-98 min-h-[50px] landscape:min-h-[40px]"
                    >
                      <Pause className="w-5 h-5 fill-current" />
                      <span>PAUSE</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowFinishModal(true)}
                    className="w-full py-3 landscape:py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-mono font-black text-sm landscape:text-xs uppercase flex items-center justify-center gap-2 rounded-xl shadow-lg cursor-pointer active:scale-98 min-h-[50px] landscape:min-h-[40px]"
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
          className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md p-5 rounded-2xl border shadow-2xl space-y-4 font-sans max-h-[90dvh] overflow-y-auto no-scrollbar cursor-default ${innerCardBg}`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
              <div className="flex items-center gap-2">
                <Square className="w-5 h-5 text-rose-500 fill-current" />
                <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>Finish Ride Recording</h3>
              </div>
              <button
                type="button"
                aria-label="Close Finish Ride Modal"
                onClick={() => setShowFinishModal(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Summary */}
            <div className={`grid grid-cols-3 gap-2 p-3 rounded-xl border text-center text-xs font-mono telemetry-num ${isLight ? 'bg-white border-slate-200' : 'bg-slate-950/70 border-slate-800'
              }`}>
              <div>
                <span className={`block text-[10px] font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>DISTANCE</span>
                <strong className={`text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>{distanceConverted.value.toFixed(2)} km</strong>
              </div>
              <div>
                <span className={`block text-[10px] font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>TIME</span>
                <strong className={`text-base ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{formatSec(gps.elapsedSeconds)}</strong>
              </div>
              <div>
                <span className={`block text-[10px] font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>GPS POINTS</span>
                <strong className={`text-base ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>{gps.pointsCount}</strong>
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
                className={`w-full py-3 border font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 text-sm ${isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-500/40'
                  }`}
              >
                <Download className="w-4 h-4" />
                <span>Download GPX File Directly</span>
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowFinishModal(false)}
                className={`w-full py-2 text-xs cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Cancel & Continue Riding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cockpit Custom Emergency SOS Confirmation Sheet */}
      {isConfirmSosOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setIsConfirmSosOpen(false); }}
          className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-sm p-5 rounded-2xl border-2 shadow-2xl space-y-4 font-sans max-h-[90dvh] overflow-y-auto no-scrollbar cursor-default ${
              isLight ? 'bg-white border-rose-400 text-slate-900' : 'bg-[#0d131a] border-rose-500 text-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-black text-sm uppercase tracking-wider text-rose-500">
                  Broadcast Emergency SOS?
                </h3>
                <p className={`text-xs font-sans mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Sends your live GPS coordinates and an emergency regroup alert to all connected squad riders.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmSosOpen(false)}
                className={`py-2.5 rounded-xl border font-bold text-xs cursor-pointer transition-colors ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic([80, 40, 120]);
                  setIsConfirmSosOpen(false);
                  onTriggerSos?.();
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-rose-950/50 transition-colors"
              >
                Send SOS Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

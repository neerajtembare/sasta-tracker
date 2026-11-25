import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppTheme, RideAnalysis } from '../types';
import { 
  GroupMemberInfo, 
  SosAlert, 
  CrewNotification 
} from '../hooks/useGroupRide';
import { triggerHaptic } from '../utils/audioChimes';
import { readMigratedStorageKey, writeMigratedStorageKey, formatDurationSummary } from '../utils/units';
import { getRiderProfile } from '../utils/riderProfile';
import { CrewLiveMap, MapLayerType } from './CrewLiveMap';
import { TopMapCapsule } from './TopMapCapsule';
import { ConvoyBottomStrip } from './ConvoyBottomStrip';
import { AppDrawer } from './AppDrawer';
import { CalloutBanner } from './CalloutBanner';
import { RiderCallout, CalloutPreset } from '../utils/callouts';
import { MapPin, ShieldOff, Flag, X, Bike, BarChart3 } from 'lucide-react';

export interface FinishedRideSummary {
  distanceKm: number;
  durationMin: number;
  maxSpeedKmh: number;
}

interface CrewDashboardProps {
  roomCode?: string;
  onJoinRoom?: (code: string) => void;
  riderName: string;
  riderId?: string;
  myColor?: string;
  bikeModel?: string;
  myLocation?: {
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
    accuracy?: number | null;
  } | null;
  isHost?: boolean;
  leaderId?: string | null;
  onSetSquadLeader?: (targetRiderId: string, targetName: string) => void;
  onClaimSquadLeader?: () => void;
  isConnected: boolean;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  crewNotification?: CrewNotification | null;
  onDismissCrewNotification?: () => void;
  onTriggerSos: () => void;
  onCancelSos?: () => void;
  onDismissSos?: () => void;
  getFriendInviteUrl?: (friendName?: string) => string;
  onGoToCockpit?: () => void;
  theme?: AppTheme;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  totalDistanceMeters?: number;
  activeRoute?: RideAnalysis | null;
  onClearActiveRoute?: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: (enable?: boolean) => void;
  onSendVoiceBlast?: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  onOpenGarage?: () => void;
  finishedRideSummary?: FinishedRideSummary | null;
  onDismissRideSummary?: () => void;
  onViewTelemetry?: () => void;
  activeCallout?: RiderCallout | null;
  onDismissCallout?: () => void;
  onSendCallout?: (preset: CalloutPreset) => void;
  gpsError?: string | null;
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  onRetryGps?: () => void;
  onTriggerRollCall?: () => void;
  mountMode?: 'handlebar' | 'pocket';
  onOpenSoloRide?: () => void;
  onGoToDashboard?: () => void;
  onOpenProfile?: () => void;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode,
  onJoinRoom,
  riderName,
  riderId,
  myColor = '#00f0ff',
  bikeModel = '',
  myLocation = null,
  isHost = false,
  leaderId = null,
  onSetSquadLeader,
  onClaimSquadLeader,
  isConnected,
  members,
  sosAlert,
  crewNotification = null,
  onDismissCrewNotification,
  onTriggerSos,
  onCancelSos,
  onDismissSos,
  getFriendInviteUrl,
  onGoToCockpit,
  theme = 'dark',
  isRecording = false,
  onStartRecording,
  onStopRecording,
  totalDistanceMeters = 0,
  activeRoute = null,
  onClearActiveRoute,
  isOnRadar = true,
  onToggleRadar,
  onSendVoiceBlast,
  onOpenGarage,
  finishedRideSummary = null,
  onDismissRideSummary,
  onViewTelemetry,
  activeCallout = null,
  onDismissCallout,
  onSendCallout,
  gpsError = null,
  isTrackingActive = true,
  onToggleTracking,
  onRetryGps,
  onTriggerRollCall,
  mountMode = 'handlebar',
  onOpenSoloRide,
  onGoToDashboard,
  onOpenProfile,
}) => {
  // Auto-acquire Screen WakeLock so handlebar phone screen stays on while riding on live map
  // When user is in Pocket mode, WakeLock is disabled so phone can lock in pocket to save battery
  useEffect(() => {
    let sentinel: any = null;
    const requestLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (isOnRadar || isRecording) && mountMode !== 'pocket') {
        try {
          sentinel = await (navigator as any).wakeLock.request('screen');
        } catch {}
      }
    };
    if ((isOnRadar || isRecording) && mountMode !== 'pocket') {
      requestLock();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && (isOnRadar || isRecording) && mountMode !== 'pocket') requestLock();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try {
        sentinel?.release();
      } catch {}
    };
  }, [isOnRadar, isRecording, mountMode]);

  // Navigation & Settings Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Map Tile Layer Style (Dark, Streets, Satellite, Sunlight)
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    const saved = readMigratedStorageKey('throttlelog_map_layer', 'sasta_map_layer');
    if (saved === 'streets' || saved === 'satellite' || saved === 'dark' || saved === 'sunlight') {
      return saved;
    }
    return getRiderProfile().defaultMapLayer || 'dark';
  });

  const handleChangeMapLayer = (layer: MapLayerType) => {
    setMapLayer(layer);
    writeMigratedStorageKey('throttlelog_map_layer', 'sasta_map_layer', layer);
  };

  useEffect(() => {
    const syncPrefs = () => {
      const saved = readMigratedStorageKey('throttlelog_map_layer', 'sasta_map_layer');
      if (saved === 'streets' || saved === 'satellite' || saved === 'dark' || saved === 'sunlight') {
        setMapLayer(saved);
      }
    };
    window.addEventListener('throttlelog-hud-prefs', syncPrefs);
    return () => window.removeEventListener('throttlelog-hud-prefs', syncPrefs);
  }, []);

  // Selected Rider for focused tracking
  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);

  // Active Trailing Rider Mode (draws live vector guidance polyline & HUD to followed rider)
  const [trailedRiderId, setTrailedRiderId] = useState<string | null>(() => {
    return readMigratedStorageKey('throttlelog_trailed_rider_id', 'sasta_trailed_rider_id');
  });

  const handleTrailRider = (targetId: string | null) => {
    setTrailedRiderId(targetId);
    try {
      if (targetId) {
        writeMigratedStorageKey('throttlelog_trailed_rider_id', 'sasta_trailed_rider_id', targetId);
      } else {
        localStorage.removeItem('throttlelog_trailed_rider_id');
        localStorage.removeItem('sasta_trailed_rider_id');
      }
    } catch {}
  };

  // Online Squad Count (excluding self)
  const onlineCount = isOnRadar ? members.filter(m => m.isOnline).length : 0;

  // Google Maps-style clean riding view: Auto-hide top bar while cruising, wake on tap or slow speeds
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetActivityTimer = useCallback(() => {
    setIsTopBarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    const speed = myLocation?.speedKmh || 0;
    if (speed > 15) {
      hideTimerRef.current = setTimeout(() => {
        setIsTopBarVisible(false);
      }, 5000);
    }
  }, [myLocation?.speedKmh]);

  useEffect(() => {
    const speed = myLocation?.speedKmh || 0;
    if (speed <= 10) {
      setIsTopBarVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      resetActivityTimer();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [myLocation?.speedKmh, resetActivityTimer]);

  const handleShareWhatsApp = () => {
    const inviteUrl = getFriendInviteUrl ? getFriendInviteUrl() : window.location.href;
    const text = `Join our live motorcycle ride on ThrottleLog! Real-time GPS radar across all phones: ${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      onClick={resetActivityTimer}
      onTouchStart={resetActivityTimer}
      className={`relative w-full h-[100dvh] overflow-hidden select-none ${theme === 'light' ? 'bg-slate-100' : 'bg-[#080c10]'}`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. FULLSCREEN LEAFLET CREW MAP (BASE LAYER)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        <CrewLiveMap
          myLocation={myLocation}
          myRiderName={riderName}
          myRiderId={riderId}
          myColor={myColor}
          isHost={isHost}
          leaderId={leaderId}
          onSetSquadLeader={onSetSquadLeader}
          onClaimSquadLeader={onClaimSquadLeader}
          trailedRiderId={trailedRiderId}
          onTrailRider={handleTrailRider}
          members={members}
          sosAlert={sosAlert}
          theme={theme}
          onCancelSos={onCancelSos}
          onDismissSos={onDismissSos}
          crewNotification={crewNotification}
          onDismissCrewNotification={onDismissCrewNotification}
          focusedRiderId={focusedRiderId}
          onSelectRider={(id) => setFocusedRiderId(id)}
          activeRoute={activeRoute}
          isOnRadar={isOnRadar}
          externalMapLayer={mapLayer}
          onChangeMapLayer={handleChangeMapLayer}
          onSendCallout={onSendCallout}
          onOpenProfile={onOpenProfile}
          hasActiveCallout={!!activeCallout}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MINIMALIST GOOGLE MAPS-STYLE FLOATING TOP CAPSULE
      ───────────────────────────────────────────────────────────── */}
      <TopMapCapsule
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfile={onOpenProfile ?? (() => {})}
        isConnected={isConnected}
        isOnRadar={isOnRadar}
        onToggleRadar={onToggleRadar}
        isTrackingActive={isTrackingActive}
        onlineCount={onlineCount}
        riderName={riderName}
        myColor={myColor}
        theme={theme}
        isVisible={isTopBarVisible || !!gpsError || !isTrackingActive || !!sosAlert || !!crewNotification || !!activeCallout}
      />

      {/* ─────────────────────────────────────────────────────────────
          2B. INCOMING RIDER CALLOUT HEADS-UP FLASH BANNER
      ───────────────────────────────────────────────────────────── */}
      <CalloutBanner
        callout={activeCallout}
        onDismiss={onDismissCallout || (() => {})}
        onSendVoiceBlast={onSendVoiceBlast}
        theme={theme}
        hasSosActive={!!sosAlert}
      />

      {/* ─────────────────────────────────────────────────────────────
          2C/2D. UNIFIED GPS ERROR & PAUSED STACK (BOTTOM ABOVE STRIP)
      ───────────────────────────────────────────────────────────── */}
      {(gpsError || !isTrackingActive) && (
        <div 
          style={{
            bottom: 'max(4.4rem, calc(var(--safe-bottom, 0px) + 4.35rem))',
            left: 'max(0.6rem, var(--safe-left, 0px))',
            right: 'max(4.4rem, calc(var(--safe-right, 0px) + 4.35rem))',
          }}
          className="absolute z-30 pointer-events-none flex flex-col items-start sm:items-center gap-1.5 animate-in slide-in-from-bottom-2 duration-200"
        >
          {gpsError && (
            <div className={`pointer-events-auto w-full max-w-md p-3 sm:p-3.5 rounded-2xl border-2 font-sans text-xs shadow-2xl backdrop-blur-md flex items-start gap-2.5 ${
              theme === 'light'
                ? 'bg-rose-50/95 border-rose-400 text-rose-950'
                : 'bg-rose-950/95 border-rose-500 text-white'
            }`}>
              <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`} />
              <div className="min-w-0 flex-1">
                <div className={`font-heading font-black text-xs uppercase tracking-wider ${
                  theme === 'light' ? 'text-rose-700' : 'text-rose-300'
                }`}>
                  GPS Location Notice
                </div>
                <p className={`text-[11px] font-sans mt-0.5 leading-relaxed ${
                  theme === 'light' ? 'text-rose-900' : 'text-slate-200'
                }`}>
                  {gpsError}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  if (onRetryGps) {
                    onRetryGps();
                  } else {
                    onToggleTracking?.(true);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shrink-0 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {!isTrackingActive && (
            <div className={`pointer-events-auto w-full max-w-md p-2.5 sm:p-3 rounded-2xl border font-sans text-xs shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 ${
              theme === 'light'
                ? 'bg-white/95 border-rose-300 text-slate-900'
                : 'bg-slate-950/95 border-rose-500/50 text-white'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <ShieldOff className={`w-4 h-4 shrink-0 ${theme === 'light' ? 'text-rose-700' : 'text-rose-400'}`} />
                <div className="min-w-0">
                  <div className={`font-heading font-black text-[11px] uppercase tracking-wider ${
                    theme === 'light' ? 'text-rose-700' : 'text-rose-300'
                  }`}>
                    GPS Tracking Paused
                  </div>
                  <p className={`text-[10px] truncate ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    Location hardware &amp; background tracking stopped.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  if (onToggleTracking) {
                    onToggleTracking(true);
                  } else if (onToggleRadar) {
                    onToggleRadar(true);
                  }
                }}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shrink-0 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                Resume
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. SLIM GOOGLE MAPS-STYLE BOTTOM CONVOY STRIP
      ───────────────────────────────────────────────────────────── */}
      <ConvoyBottomStrip
        members={members}
        isConnected={isConnected}
        isOnRadar={isOnRadar}
        onToggleRadar={onToggleRadar}
        roomCode={roomCode}
        onJoinRoom={onJoinRoom}
        myLocation={myLocation ? { lat: myLocation.lat, lon: myLocation.lon } : null}
        riderName={riderName}
        riderId={riderId}
        isRecording={isRecording}
        onToggleRecording={() => {
          if (isRecording) {
            onStopRecording?.();
          } else {
            onStartRecording?.();
          }
        }}
        recordedDistanceMeters={totalDistanceMeters}
        sosAlert={sosAlert}
        onTriggerSos={onTriggerSos}
        onCancelSos={onCancelSos}
        activeRoute={activeRoute}
        onClearActiveRoute={onClearActiveRoute}
        onSelectRider={(id) => setFocusedRiderId(id)}
        onShareWhatsApp={handleShareWhatsApp}
        onSendCallout={onSendCallout}
        onSendVoiceBlast={onSendVoiceBlast}
        leaderId={leaderId}
        onSetSquadLeader={onSetSquadLeader}
        trailedRiderId={trailedRiderId}
        onTrailRider={handleTrailRider}
        theme={theme}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. IN-MAP RIDE FINISHED & SAVED SUMMARY CARD
      ───────────────────────────────────────────────────────────── */}
      {finishedRideSummary && (
        <div
          style={{
            paddingTop: 'max(0.75rem, var(--safe-top, 0px))',
            paddingBottom: 'max(0.75rem, var(--safe-bottom, 0px))',
          }}
          className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className={`w-full max-w-md max-h-[90dvh] overflow-y-auto p-4 sm:p-5 rounded-3xl border shadow-2xl space-y-4 font-sans ${
            theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/40 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                  theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`font-heading font-black text-sm tracking-wider uppercase ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Ride Saved to Garage!</h3>
                  <p className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Track preserved &amp; saved offline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissRideSummary}
                aria-label="Close ride summary"
                className={`p-1.5 rounded-lg cursor-pointer ${theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center telemetry-num">
              <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>DISTANCE</div>
                <div className={`font-black text-base ${theme === 'light' ? 'text-cyan-700' : 'text-cyan-400'}`}>
                  {`${finishedRideSummary.distanceKm.toFixed(1)} km`}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>DURATION</div>
                <div className={`font-black text-base ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {formatDurationSummary(finishedRideSummary.durationMin * 60)}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className={`text-[10px] font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>TOP SPEED</div>
                <div className={`font-black text-base ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`}>
                  {`${Math.round(finishedRideSummary.maxSpeedKmh)} km/h`}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onDismissRideSummary?.();
                }}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
              >
                <Bike className="w-4 h-4" />
                <span>Continue Riding on Crew Map</span>
              </button>

              {onViewTelemetry && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    onViewTelemetry();
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>View Deep Stats &amp; Telemetry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. SLIDE-OUT HAMBURGER NAVIGATION DRAWER
      ───────────────────────────────────────────────────────────── */}
      <AppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        theme={theme}
        riderName={riderName}
        bikeModel={bikeModel}
        myColor={myColor}
        onShareWhatsApp={handleShareWhatsApp}
        onOpenGarage={() => {
          onOpenGarage?.();
        }}
        onOpenCockpit={() => {
          onGoToCockpit?.();
        }}
        isOnRadar={isOnRadar}
        onToggleRadar={onToggleRadar}
        isTrackingActive={isTrackingActive}
        onToggleTracking={onToggleTracking}
        onTriggerRollCall={onTriggerRollCall}
        onOpenSoloRide={onOpenSoloRide}
        onOpenDashboard={onGoToDashboard}
        onOpenSettings={onOpenProfile}
      />
    </div>
  );
};

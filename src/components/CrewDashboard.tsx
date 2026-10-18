import React, { useState } from 'react';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { 
  GroupMemberInfo, 
  SosAlert, 
  CrewNotification, 
  SharedRouteInfo, 
  ActiveVoiceBlast
} from '../hooks/useGroupRide';
import { triggerHaptic } from '../utils/audioChimes';
import { CrewLiveMap, MapLayerType } from './CrewLiveMap';
import { TopMapCapsule } from './TopMapCapsule';
import { ConvoyBottomStrip } from './ConvoyBottomStrip';
import { AppDrawer } from './AppDrawer';

export interface FinishedRideSummary {
  distanceKm: number;
  durationMin: number;
  maxSpeedKmh: number;
}

interface CrewDashboardProps {
  roomCode?: string;
  lastRoomCode?: string;
  riderName: string;
  myColor?: string;
  bikeModel?: string;
  myLocation?: {
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
  } | null;
  isHost?: boolean;
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  statusMessage: string;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  crewNotification?: CrewNotification | null;
  onDismissCrewNotification?: () => void;
  onTriggerSos: () => void;
  onDismissSos?: () => void;
  onUpdateRiderName: (newName: string, bikeModel?: string, color?: string) => void;
  onAddSquadFriend?: (name: string, bikeModel?: string) => void;
  getFriendInviteUrl?: (friendName?: string) => string;
  onGoToCockpit?: () => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  unitSystem?: UnitSystem;
  onToggleUnitSystem?: () => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  pointsCount?: number;
  totalDistanceMeters?: number;
  activeRoute?: RideAnalysis | null;
  onClearActiveRoute?: () => void;
  onLoadSampleRide?: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: (enable?: boolean) => void;
  onJoinSharedRoute?: (route: SharedRouteInfo) => void;
  activeVoiceBlast?: ActiveVoiceBlast | null;
  onDismissVoiceBlast?: () => void;
  onSendVoiceBlast?: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  isConvoyRegrouped?: boolean;
  onOpenGarage?: () => void;
  onOpenDownloadApp?: () => void;
  onOpenFaq?: () => void;
  finishedRideSummary?: FinishedRideSummary | null;
  onDismissRideSummary?: () => void;
  onViewTelemetry?: () => void;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  riderName,
  myColor = '#00f0ff',
  bikeModel = '',
  myLocation = null,
  isHost = false,
  isConnected,
  connectionStatus,
  statusMessage,
  members,
  sosAlert,
  crewNotification = null,
  onDismissCrewNotification,
  onTriggerSos,
  onDismissSos,
  onUpdateRiderName,
  getFriendInviteUrl,
  onGoToCockpit,
  theme = 'dark',
  onToggleTheme,
  unitSystem = 'metric',
  onToggleUnitSystem,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  pointsCount = 0,
  totalDistanceMeters = 0,
  activeRoute = null,
  onClearActiveRoute,
  onLoadSampleRide,
  isOnRadar = true,
  onToggleRadar,
  onJoinSharedRoute,
  activeVoiceBlast = null,
  onDismissVoiceBlast,
  onSendVoiceBlast,
  isConvoyRegrouped = false,
  onOpenGarage,
  onOpenDownloadApp,
  onOpenFaq,
  finishedRideSummary = null,
  onDismissRideSummary,
  onViewTelemetry,
}) => {
  // Navigation & Settings Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Map Tile Layer Style (Dark, Street, Satellite)
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    try {
      const saved = localStorage.getItem('sasta_map_layer');
      if (saved === 'streets' || saved === 'satellite' || saved === 'dark') {
        return saved as MapLayerType;
      }
    } catch {}
    return 'dark';
  });

  const handleChangeMapLayer = (layer: 'streets' | 'satellite' | 'dark') => {
    setMapLayer(layer);
    try {
      localStorage.setItem('sasta_map_layer', layer);
    } catch {}
  };

  // Selected Rider for focused tracking
  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);

  // Online Squad Count (excluding self)
  const onlineCount = members.filter(m => m.isOnline).length;

  const handleShareWhatsApp = () => {
    const inviteUrl = getFriendInviteUrl ? getFriendInviteUrl() : window.location.href;
    const text = `🏍️ Join our live motorcycle ride on Sasta Tracker! Real-time GPS radar across all phones (zero setup): ${inviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden select-none bg-[#080c10]">
      {/* ─────────────────────────────────────────────────────────────
          1. FULLSCREEN LEAFLET CREW MAP (BASE LAYER)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <CrewLiveMap
          myLocation={myLocation}
          myRiderName={riderName}
          myColor={myColor}
          isHost={isHost}
          members={members}
          sosAlert={sosAlert}
          isConnected={isConnected}
          theme={theme}
          unitSystem={unitSystem}
          onTriggerSos={onTriggerSos}
          onDismissSos={onDismissSos}
          crewNotification={crewNotification}
          onDismissCrewNotification={onDismissCrewNotification}
          onShareWhatsApp={handleShareWhatsApp}
          onGoToCockpit={onGoToCockpit}
          onUpdateRiderName={(name) => onUpdateRiderName(name, bikeModel, myColor)}
          isRecording={isRecording}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          pointsCount={pointsCount}
          totalDistanceMeters={totalDistanceMeters}
          focusedRiderId={focusedRiderId}
          onSelectRider={(id) => setFocusedRiderId(id)}
          activeRoute={activeRoute}
          isOnRadar={isOnRadar}
          onToggleRadar={onToggleRadar}
          onJoinSharedRoute={onJoinSharedRoute}
          externalMapLayer={mapLayer}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MINIMALIST GOOGLE MAPS-STYLE FLOATING TOP CAPSULE
      ───────────────────────────────────────────────────────────── */}
      <TopMapCapsule
        onOpenDrawer={() => setIsDrawerOpen(true)}
        isConnected={isConnected}
        onlineCount={onlineCount}
        riderName={riderName}
        myColor={myColor}
        onShareInvite={handleShareWhatsApp}
        theme={theme}
      />

      {/* ─────────────────────────────────────────────────────────────
          3. SLIM GOOGLE MAPS-STYLE BOTTOM CONVOY STRIP
      ───────────────────────────────────────────────────────────── */}
      <ConvoyBottomStrip
        members={members}
        isConnected={isConnected}
        myLocation={myLocation ? { lat: myLocation.lat, lon: myLocation.lon } : null}
        riderName={riderName}
        isRecording={isRecording}
        onToggleRecording={() => {
          if (isRecording) {
            onStopRecording?.();
          } else {
            onStartRecording?.();
          }
        }}
        recordedDistanceMeters={totalDistanceMeters}
        onTriggerSos={onTriggerSos}
        activeRoute={activeRoute}
        onClearActiveRoute={onClearActiveRoute}
        onOpenSquadDrawer={() => setIsDrawerOpen(true)}
        onSelectRider={(id) => setFocusedRiderId(id)}
        onShareWhatsApp={handleShareWhatsApp}
        theme={theme}
        unitSystem={unitSystem}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. IN-MAP RIDE FINISHED & SAVED SUMMARY CARD
      ───────────────────────────────────────────────────────────── */}
      {finishedRideSummary && (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-md p-4 sm:p-5 rounded-3xl border shadow-2xl space-y-4 font-mono ${
            theme === 'light' ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/40 text-white'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏁</span>
                <div>
                  <h3 className="font-heading font-black text-sm tracking-wider uppercase text-white">Ride Saved to Garage!</h3>
                  <p className="text-[10px] text-slate-400">Track preserved & saved offline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismissRideSummary}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">DISTANCE</div>
                <div className="font-black text-cyan-400 text-base">{finishedRideSummary.distanceKm.toFixed(1)} km</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">DURATION</div>
                <div className="font-black text-white text-base">{finishedRideSummary.durationMin}m</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">TOP SPEED</div>
                <div className="font-black text-amber-400 text-base">{Math.round(finishedRideSummary.maxSpeedKmh)} km/h</div>
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
                <span>🏍️ Continue Riding on Crew Map</span>
              </button>

              {onViewTelemetry && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    onViewTelemetry();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <span>📊 View Deep Stats & Telemetry</span>
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
        onToggleTheme={onToggleTheme || (() => {})}
        unitSystem={unitSystem}
        onToggleUnitSystem={onToggleUnitSystem || (() => {})}
        riderName={riderName}
        bikeModel={bikeModel}
        myColor={myColor}
        onUpdateProfile={(name, bike, color) => {
          onUpdateRiderName(name, bike, color);
        }}
        onShareWhatsApp={handleShareWhatsApp}
        mapLayer={mapLayer === 'sunlight' ? 'streets' : mapLayer}
        onChangeMapLayer={handleChangeMapLayer}
        onOpenGarage={() => {
          onOpenGarage?.();
        }}
        onOpenCockpit={() => {
          onGoToCockpit?.();
        }}
        onOpenDownloadApp={() => {
          onOpenDownloadApp?.();
        }}
        onOpenFaq={onOpenFaq}
      />
    </div>
  );
};

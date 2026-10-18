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
  onCreateRoom?: (name?: string, customCode?: string) => void;
  onJoinRoom?: (code: string, name?: string) => void;
  onRejoinRoom?: () => void;
  onLeaveRoom?: () => void;
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
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode = '4092',
  lastRoomCode = '',
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
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
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

  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);

  const handleShareWhatsApp = (customUrl?: string, friendName?: string) => {
    triggerHaptic(30);
    const link = customUrl || (getFriendInviteUrl ? getFriendInviteUrl(friendName) : `${window.location.origin}${window.location.pathname}`);
    const apkLink = 'https://github.com/neerajtembare/sasta-tracker/releases/latest/download/throttlelog.apk';
    const text = friendName
      ? `🏍️ Hey ${friendName}, join our Motorcycle Squad Ride Radar:\n👉 Live Map Radar: ${link}\n📥 Android APK: ${apkLink}\nOpen the link and you are automatically live on radar with us!`
      : `🏍️ Join our Motorcycle Squad Ride Radar:\n👉 Live Map Radar: ${link}\n📥 Android APK: ${apkLink}\nOpen the link and you are automatically live on radar with us!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const onlineCount = members.filter(m => m.isOnline).length;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#080c10] flex flex-col font-mono">
      {/* ─────────────────────────────────────────────────────────────
          1. FULL-SCREEN CLEAN LEAFLET MAP
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <CrewLiveMap
          myLocation={myLocation}
          myRiderName={riderName}
          myColor={myColor}
          isHost={isHost}
          members={members}
          sosAlert={sosAlert}
          roomCode={roomCode}
          lastRoomCode={lastRoomCode}
          isConnected={isConnected}
          theme={theme}
          unitSystem={unitSystem}
          onTriggerSos={onTriggerSos}
          onDismissSos={onDismissSos}
          onLeaveRoom={onLeaveRoom}
          crewNotification={crewNotification}
          onDismissCrewNotification={onDismissCrewNotification}
          onShareWhatsApp={() => handleShareWhatsApp()}
          onGoToCockpit={onGoToCockpit}
          onUpdateRiderName={onUpdateRiderName}
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
          2. GOOGLE MAPS-STYLE FLOATING TOP CAPSULE
      ───────────────────────────────────────────────────────────── */}
      <TopMapCapsule
        onOpenDrawer={() => setIsDrawerOpen(true)}
        roomCode={roomCode}
        isConnected={isConnected}
        onlineCount={onlineCount}
        riderName={riderName}
        myColor={myColor}
        isRecording={isRecording}
        onToggleRecording={() => {
          if (isRecording) {
            onStopRecording?.();
          } else {
            onStartRecording?.();
          }
        }}
        onShareInvite={() => handleShareWhatsApp()}
        onOpenSquadModal={() => setIsDrawerOpen(true)}
        theme={theme}
      />

      {/* ─────────────────────────────────────────────────────────────
          3. SLIM GOOGLE MAPS-STYLE BOTTOM CONVOY STRIP
      ───────────────────────────────────────────────────────────── */}
      <ConvoyBottomStrip
        members={members}
        isConnected={isConnected}
        roomCode={roomCode}
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
        onShareWhatsApp={() => handleShareWhatsApp()}
        theme={theme}
        unitSystem={unitSystem}
      />

      {/* ─────────────────────────────────────────────────────────────
          4. SLIDE-OUT HAMBURGER NAVIGATION DRAWER
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
        roomCode={roomCode}
        isConnected={isConnected}
        onCreateRoom={() => {
          onCreateRoom?.();
        }}
        onJoinRoom={(code) => {
          onJoinRoom?.(code);
        }}
        onLeaveRoom={() => {
          onLeaveRoom?.();
        }}
        onShareWhatsApp={() => handleShareWhatsApp()}
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

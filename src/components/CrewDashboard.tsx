import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { 
  GroupMemberInfo, 
  SosAlert, 
  CrewNotification, 
  SharedRouteInfo, 
  RIDER_COLORS 
} from '../hooks/useGroupRide';
import { 
  Users, 
  Radio, 
  Share2, 
  Edit3, 
  Navigation,
  Map as MapIcon,
  X,
  UserCheck,
  Check,
  AlertTriangle,
  Route,
  Play,
  Eye,
  EyeOff,
  Star,
  MessageSquare
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { openGoogleMapsNavigation } from '../utils/navigation';
import { CrewLiveMap } from './CrewLiveMap';

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
  onCreateRoom?: (name: string, customCode?: string) => void;
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
  unitSystem?: UnitSystem;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  pointsCount?: number;
  totalDistanceMeters?: number;
  activeRoute?: RideAnalysis | null;
  onLoadSampleRide?: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: (enable?: boolean) => void;
  onJoinSharedRoute?: (route: SharedRouteInfo) => void;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode = 'Crew Radar',
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
  onLeaveRoom,
  onTriggerSos,
  onDismissSos,
  onUpdateRiderName,
  getFriendInviteUrl,
  onGoToCockpit,
  theme = 'dark',
  unitSystem = 'metric',
  isRecording = false,
  onStartRecording,
  onStopRecording,
  pointsCount = 0,
  totalDistanceMeters = 0,
  activeRoute = null,
  onLoadSampleRide,
  isOnRadar = true,
  onToggleRadar,
  onJoinSharedRoute,
}) => {
  const isLight = theme === 'light';

  // Callsign & Profile Modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginNameInput, setLoginNameInput] = useState(riderName);
  const [loginBikeInput, setLoginBikeInput] = useState(bikeModel || '');
  const [loginColorInput, setLoginColorInput] = useState(myColor || '#00f0ff');

  // Selected Rider for Map Focus
  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);
  const [isConvoyDrawerExpanded, setIsConvoyDrawerExpanded] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Starred Convoy Buddies (persisted on device for zero-friction group focus)
  const [starredRiderIds, setStarredRiderIds] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sasta_starred_riders');
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return [];
  });
  const [filterMode, setFilterMode] = useState<'all' | 'squad'>('all');

  const toggleStarRider = (id: string) => {
    triggerHaptic(25);
    setStarredRiderIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('sasta_starred_riders', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isAnyLocalModalOpen = isLoginModalOpen;
  const localModalHistoryPushedRef = useRef(false);

  // Sync Escape key to dismiss local modals
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLoginModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Sync Android / browser Back button for local modals
  useEffect(() => {
    if (isAnyLocalModalOpen) {
      if (!localModalHistoryPushedRef.current) {
        localModalHistoryPushedRef.current = true;
        try {
          window.history.pushState({ crewLocalModal: true }, '');
        } catch {}
      }
    } else {
      if (localModalHistoryPushedRef.current) {
        localModalHistoryPushedRef.current = false;
        if (typeof window !== 'undefined' && window.history.state?.crewLocalModal) {
          try {
            window.history.back();
          } catch {}
        }
      }
    }
  }, [isAnyLocalModalOpen]);

  useEffect(() => {
    const handlePop = () => {
      if (localModalHistoryPushedRef.current) {
        localModalHistoryPushedRef.current = false;
        setIsLoginModalOpen(false);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Synchronize inputs when modal opens or profile changes
  useEffect(() => {
    if (isLoginModalOpen) {
      setLoginNameInput(riderName);
      setLoginBikeInput(bikeModel || '');
      setLoginColorInput(myColor || '#00f0ff');
    }
  }, [isLoginModalOpen, riderName, bikeModel, myColor]);

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = loginNameInput.trim();
    if (!cleanName) return;
    onUpdateRiderName(cleanName, loginBikeInput.trim() || undefined, loginColorInput);
    setIsLoginModalOpen(false);
    triggerHaptic(40);
  };

  const handleShareWhatsApp = (customUrl?: string, friendName?: string) => {
    const link = customUrl || (getFriendInviteUrl ? getFriendInviteUrl(friendName) : `${window.location.origin}${window.location.pathname}`);
    const apkLink = 'https://github.com/neerajtembare/sasta-tracker/releases/latest/download/throttlelog-debug.apk';
    const text = friendName
      ? `🏍️ Hey ${friendName}, join our Weekend Ride Radar:\n👉 Web Radar: ${link}\n📥 Direct Android APK: ${apkLink}\nOpen the link and you are automatically live on radar with us!`
      : `🏍️ Join our Weekend Ride Radar:\n👉 Web Radar: ${link}\n📥 Direct Android APK: ${apkLink}\nOpen the link and you are automatically live on radar with us!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyLink = (customUrl?: string) => {
    const link = customUrl || window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      triggerHaptic(20);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const onlineCount = members.filter(m => m.isOnline !== false).length + (isOnRadar ? 1 : 0);

  const displayedMembers = useMemo(() => {
    if (filterMode === 'squad' && starredRiderIds.length > 0) {
      return members.filter(m => starredRiderIds.includes(m.riderId));
    }
    return [...members].sort((a, b) => {
      const aStarred = starredRiderIds.includes(a.riderId) ? 1 : 0;
      const bStarred = starredRiderIds.includes(b.riderId) ? 1 : 0;
      return bStarred - aStarred;
    });
  }, [members, filterMode, starredRiderIds]);

  return (
    <div className="relative w-full h-full flex-1 flex flex-col overflow-hidden rounded-none sm:rounded-2xl border sm:border-slate-800">
      
      {/* ─────────────────────────────────────────────────────────────
          HERO LIVE RADAR MAP
      ───────────────────────────────────────────────────────────── */}
      <CrewLiveMap
        myLocation={myLocation}
        myRiderName={riderName}
        myColor={myColor}
        isHost={isHost}
        isConnected={isConnected}
        members={members}
        sosAlert={sosAlert}
        roomCode={roomCode || 'Crew Radar'}
        lastRoomCode={lastRoomCode}
        theme={theme}
        unitSystem={unitSystem}
        onTriggerSos={onTriggerSos}
        onDismissSos={onDismissSos}
        onLeaveRoom={() => setIsLoginModalOpen(true)}
        crewNotification={crewNotification}
        onDismissCrewNotification={onDismissCrewNotification}
        onShareWhatsApp={handleShareWhatsApp}
        onCopyInviteLink={handleCopyLink}
        copiedLink={copiedLink}
        onGoToCockpit={onGoToCockpit}
        onUpdateRiderName={onUpdateRiderName}
        isRecording={isRecording}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        pointsCount={pointsCount}
        totalDistanceMeters={totalDistanceMeters}
        onOpenCrewManage={() => setIsLoginModalOpen(true)}
        focusedRiderId={focusedRiderId}
        onSelectRider={(id) => setFocusedRiderId(id)}
        activeRoute={activeRoute}
        isOnRadar={isOnRadar}
        onToggleRadar={onToggleRadar}
        onJoinSharedRoute={onJoinSharedRoute}
        starredRiderIds={starredRiderIds}
      />

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FLOATING CONVOY ROSTER HUD & ACTIVE ROUTE
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-[calc(4.2rem+env(safe-area-inset-bottom))] sm:bottom-3 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-none flex flex-col gap-2">
        <div className="max-w-4xl mx-auto w-full space-y-2 pointer-events-auto">
          
          {/* Active Planned Route & Google Maps Voice Navigation Bar */}
          {activeRoute && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950/92 backdrop-blur-md border border-cyan-500/50 shadow-xl font-mono text-xs">
              <div className="flex items-center gap-2 truncate">
                <Route className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-white truncate">{activeRoute.name || 'Planned Route'}</span>
                  <span className="text-cyan-300 ml-1.5 font-bold">({activeRoute.totalDistanceKm.toFixed(1)} km)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    triggerHaptic(30);
                    if (activeRoute.points && activeRoute.points.length > 0) {
                      const last = activeRoute.points[activeRoute.points.length - 1];
                      openGoogleMapsNavigation(last.lat, last.lon, activeRoute.name);
                    }
                  }}
                  className="h-9 px-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 cursor-pointer transition-all active:scale-95"
                  title="Launch Google Maps turn-by-turn voice navigation to destination"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-950/92 backdrop-blur-md border border-slate-700/80 shadow-2xl space-y-2">
            
            {/* Roster Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnRadar ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-amber-400 ring-2 ring-amber-400/30'}`} />
                <span className="font-heading font-black text-white text-xs uppercase tracking-wider">
                  Crew Radar
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  100km
                </span>
                {starredRiderIds.length > 0 ? (
                  <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700/80 p-0.5 text-[9px] font-mono">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setFilterMode('all');
                      }}
                      className={`px-1.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                        filterMode === 'all' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({members.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        setFilterMode('squad');
                      }}
                      className={`px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                        filterMode === 'squad' ? 'bg-amber-400 text-slate-950 font-black' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>⭐ Convoy</span>
                      <span>({starredRiderIds.length})</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    {onlineCount} ACTIVE
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* 1-Tap Quick Ride Recording Action */}
                {isRecording ? (
                  <button
                    onClick={() => {
                      triggerHaptic(50);
                      if (onStopRecording) onStopRecording();
                    }}
                    className="h-8 px-2.5 sm:px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-950 transition-all active:scale-95"
                    title="Stop and save active ride to Garage"
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>REC ({((totalDistanceMeters || 0) / 1000).toFixed(1)}km)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      triggerHaptic(50);
                      if (onStartRecording) onStartRecording();
                    }}
                    className="h-8 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950 transition-all active:scale-95"
                    title="Start recording GPS ride track"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>START</span>
                  </button>
                )}

                {/* 1-Tap On Radar / Off Radar Toggle */}
                {onToggleRadar && (
                  <button
                    onClick={() => {
                      triggerHaptic(30);
                      onToggleRadar();
                    }}
                    className={`h-8 px-2.5 sm:px-3 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                      isOnRadar
                        ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-400/50 text-emerald-300'
                        : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/50 text-amber-300'
                    }`}
                    title={isOnRadar ? 'You are live on radar. Tap to go Off Radar (Ghost mode)' : 'You are currently hidden. Tap to go Live on radar'}
                  >
                    {isOnRadar ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Live</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ghost</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setIsConvoyDrawerExpanded(prev => !prev)}
                  className="h-8 px-2 text-slate-400 hover:text-white font-mono text-xs font-bold cursor-pointer"
                >
                  {isConvoyDrawerExpanded ? 'Hide' : 'Roster'}
                </button>
              </div>
            </div>

            {/* Horizontal Scrollable Friend Cards */}
            {isConvoyDrawerExpanded && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {/* YOU CARD */}
                <div 
                  onClick={() => {
                    setFocusedRiderId('me');
                    triggerHaptic(20);
                  }}
                  className={`p-2 rounded-xl border flex flex-col justify-between shrink-0 cursor-pointer transition-all active:scale-95 min-w-[180px] max-w-[210px] ${
                    focusedRiderId === 'me'
                      ? 'bg-cyan-950/80 border-cyan-400 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                  }`}
                  title="Click to center map, or tap Edit to customize callsign"
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs"
                      style={{ backgroundColor: myColor || '#00f0ff' }}
                    >
                      {riderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 font-mono text-xs font-bold text-white truncate">
                        <span className="truncate">{riderName}</span>
                        <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-bold shrink-0">YOU</span>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 truncate">
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnRadar ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'} shrink-0`} />
                          <span className="truncate">
                            {!isOnRadar ? 'Ghost mode' : myLocation ? `${Math.round(myLocation.speedKmh)} km/h` : 'Online'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsLoginModalOpen(true);
                          }}
                          className="p-0.5 text-cyan-400 hover:text-white cursor-pointer"
                          title="Edit Callsign & Bike"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Route broadcast indicator */}
                  {activeRoute && (
                    <div className="mt-1.5 pt-1 border-t border-slate-800/80 flex items-center gap-1 text-[9px] text-cyan-300 font-mono truncate">
                      <Route className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Broadcasting: {activeRoute.name || 'Route'}</span>
                    </div>
                  )}
                </div>

                {/* When alone on radar */}
                {members.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span>Radar active (100km range) • Waiting for nearby riders</span>
                  </div>
                )}

                {/* CREW FRIENDS CARDS */}
                {displayedMembers.map(m => {
                  const isOnline = m.isOnline !== false;
                  const isStopped = m.location?.status === 'stopped' || (m.location?.speedKmh || 0) < 2.5;
                  const isStarred = starredRiderIds.includes(m.riderId);
                  const distText = m.distanceFromMeMeters !== undefined
                    ? m.distanceFromMeMeters < 1000
                      ? `${Math.round(m.distanceFromMeMeters)}m`
                      : `${(m.distanceFromMeMeters / 1000).toFixed(1)}km`
                    : null;

                  return (
                    <div
                      key={m.riderId}
                      onClick={() => {
                        if (m.location) {
                          setFocusedRiderId(m.riderId);
                          triggerHaptic(20);
                        }
                      }}
                      className={`p-2 rounded-xl border flex flex-col justify-between shrink-0 cursor-pointer transition-all active:scale-95 min-w-[200px] max-w-[250px] ${
                        focusedRiderId === m.riderId
                          ? 'bg-cyan-950/80 border-cyan-400 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-400/50'
                          : isStarred
                          ? 'bg-amber-950/30 border-amber-500/60 shadow-xs'
                          : isOnline
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                          : 'bg-slate-950/70 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs relative"
                          style={{ backgroundColor: m.color || '#ffe600' }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                          {isStarred && (
                            <span className="absolute -top-1.5 -right-1.5 text-[10px]">⭐</span>
                          )}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 font-mono text-xs font-bold text-white truncate">
                            <div className="flex items-center gap-1 truncate">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStarRider(m.riderId);
                                }}
                                className="p-0.5 -ml-1 text-slate-500 hover:text-amber-400 cursor-pointer transition-colors shrink-0"
                                title={isStarred ? 'Starred Convoy Buddy (Click to unstar)' : 'Star buddy to focus on radar'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                              </button>
                              <span className="truncate">{m.name}</span>
                            </div>
                            {distText && (
                              <span className="text-[10px] text-cyan-400 font-bold shrink-0">{distText}</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono flex items-center justify-between gap-1 mt-0.5">
                            <div className="flex items-center gap-1 truncate">
                              {isOnline ? (
                                <>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isStopped ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'} shrink-0`} />
                                  <span className={`truncate ${isStopped ? 'text-amber-300' : 'text-emerald-300'}`}>
                                    {isStopped ? 'Stopped' : 'Cruising'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                                  <span className="text-amber-400/90 font-bold truncate">
                                    {`Last seen ${Math.max(1, Math.round((Date.now() - m.lastSeen) / 60000))}m ago`}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic(20);
                                  handleShareWhatsApp(undefined, m.name);
                                }}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-bold text-[9px] flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
                                title={`Ping ${m.name} via WhatsApp`}
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>Ping</span>
                              </button>
                              {m.location && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic(25);
                                    openGoogleMapsNavigation(m.location!.lat, m.location!.lon, m.name);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 font-bold text-[9px] flex items-center gap-0.5 cursor-pointer transition-colors shrink-0"
                                  title={`Navigate to ${m.name} via Google Maps`}
                                >
                                  <Navigation className="w-2.5 h-2.5" />
                                  <span>Nav</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 1-Tap JOIN ROUTE Banner if friend is sharing a route */}
                      {m.sharedRoute && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-mono font-bold truncate">
                            <Route className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{m.sharedRoute.routeName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic(40);
                              if (onJoinSharedRoute && m.sharedRoute) {
                                onJoinSharedRoute(m.sharedRoute);
                                if (!starredRiderIds.includes(m.riderId)) {
                                  toggleStarRider(m.riderId);
                                }
                              }
                            }}
                            className="h-8 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md shrink-0"
                            title={`Join ${m.name}'s route: ${m.sharedRoute.routeName}`}
                          >
                            <Route className="w-3 h-3" />
                            <span>Join</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIDER CALLSIGN & RADAR PROFILE MODAL (Saves permanently to disk)
      ───────────────────────────────────────────────────────────── */}
      {isLoginModalOpen && (
        <div 
          onClick={e => { if (e.target === e.currentTarget) setIsLoginModalOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-700/80 p-5 shadow-2xl font-mono space-y-3.5 pointer-events-auto max-h-[92vh] overflow-y-auto no-scrollbar cursor-default"
          >
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span className="font-heading font-black text-sm text-white uppercase tracking-wider">
                  Rider Radar Profile
                </span>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Preview Card */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-black text-slate-950 text-sm shadow-md shrink-0"
                  style={{ backgroundColor: loginColorInput }}
                >
                  {(loginNameInput.trim() || riderName || 'R').charAt(0).toUpperCase()}
                </div>
                <div className="truncate min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white truncate">
                    <span className="truncate">{loginNameInput.trim() || riderName}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold shrink-0">YOU</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {loginBikeInput.trim() || 'Motorcycle'}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  100km Radar
                </span>
              </div>
            </div>

            {/* Callsign Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <span>Rider Callsign / Name</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                maxLength={18}
                value={loginNameInput}
                onChange={e => setLoginNameInput(e.target.value)}
                placeholder="Your Name (e.g. GhostRider, Maverick)"
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-400 transition-colors"
                autoFocus
              />
            </div>

            {/* Bike Model Input & Quick Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Motorcycle Model
                </label>
                <span className="text-[9px] text-slate-500">Saved on phone</span>
              </div>
              <input
                type="text"
                maxLength={24}
                value={loginBikeInput}
                onChange={e => setLoginBikeInput(e.target.value)}
                placeholder="e.g. KTM Duke 390, GT 650"
                className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 transition-colors"
              />
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {['KTM Duke 390', 'GT 650', 'Speed 400', 'Himalayan 450', 'Yamaha R3'].map(bike => (
                  <button
                    key={bike}
                    type="button"
                    onClick={() => {
                      setLoginBikeInput(bike);
                      triggerHaptic(15);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] border cursor-pointer transition-all active:scale-95 ${
                      loginBikeInput === bike
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {bike}
                  </button>
                ))}
              </div>
            </div>

            {/* Radar Marker Color Swatches */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Radar Beacon Color
              </label>
              <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                {RIDER_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setLoginColorInput(color);
                      triggerHaptic(15);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                      loginColorInput.toLowerCase() === color.toLowerCase()
                        ? 'ring-2 ring-white scale-110 shadow-lg'
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {loginColorInput.toLowerCase() === color.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={!loginNameInput.trim()}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Save Callsign</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

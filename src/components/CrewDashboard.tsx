import React, { useState, useEffect } from 'react';
import { AppTheme, UnitSystem } from '../types';
import { GroupMemberInfo, SosAlert, CrewNotification } from '../hooks/useGroupRide';
import { 
  SavedCrew, 
  getSavedCrews, 
  saveCrew, 
  deleteCrew, 
  addMemberToCrew, 
  removeMemberFromCrew 
} from '../utils/storage';
import { 
  Users, 
  Radio, 
  Share2, 
  Plus, 
  Trash2, 
  Edit3, 
  Navigation,
  Map as MapIcon,
  Compass,
  X,
  RotateCw
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { CrewLiveMap } from './CrewLiveMap';

interface CrewDashboardProps {
  roomCode: string;
  lastRoomCode?: string;
  riderName: string;
  myColor?: string;
  myLocation?: {
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
  } | null;
  isHost: boolean;
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  statusMessage: string;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  crewNotification?: CrewNotification | null;
  onDismissCrewNotification?: () => void;
  onCreateRoom: (name: string, customCode?: string) => void;
  onJoinRoom: (code: string, name?: string) => void;
  onRejoinRoom?: () => void;
  onLeaveRoom: () => void;
  onTriggerSos: () => void;
  onDismissSos: () => void;
  onUpdateRiderName: (newName: string) => void;
  onGoToCockpit?: () => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  pointsCount?: number;
  totalDistanceMeters?: number;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode,
  lastRoomCode = '',
  riderName,
  myColor = '#00f0ff',
  myLocation = null,
  isHost,
  isConnected,
  connectionStatus,
  statusMessage,
  members,
  sosAlert,
  crewNotification = null,
  onDismissCrewNotification,
  onCreateRoom,
  onJoinRoom,
  onRejoinRoom,
  onLeaveRoom,
  onTriggerSos,
  onDismissSos,
  onUpdateRiderName,
  onGoToCockpit,
  theme = 'dark',
  unitSystem = 'metric',
  isRecording = false,
  onStartRecording,
  onStopRecording,
  pointsCount = 0,
  totalDistanceMeters = 0,
}) => {
  const isLight = theme === 'light';

  // Saved crews state
  const [savedCrews, setSavedCrews] = useState<SavedCrew[]>([]);
  const [isCreatingNewCrew, setIsCreatingNewCrew] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewCode, setNewCrewCode] = useState('');
  const [newCrewFriends, setNewCrewFriends] = useState('');

  // Preflight callsign quick edit state
  const [isEditingPreflightHandle, setIsEditingPreflightHandle] = useState(false);
  const [preflightHandle, setPreflightHandle] = useState(riderName);

  // Quick join code input
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [connectedViewMode, setConnectedViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    setSavedCrews(getSavedCrews());
  }, []);

  const handleCreateCrew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrewName.trim()) return;

    const generatedCode = newCrewCode.trim().toUpperCase() || 
      'CREW' + Math.floor(1000 + Math.random() * 9000);

    const friendList = newCrewFriends
      .split(',')
      .map(f => f.trim())
      .filter(Boolean);

    const newCrew: SavedCrew = {
      id: 'crew_' + Date.now(),
      name: newCrewName.trim(),
      code: generatedCode,
      members: friendList.length > 0 ? friendList : [riderName || 'You'],
      createdAt: Date.now(),
    };

    const updated = saveCrew(newCrew);
    setSavedCrews(updated);
    setNewCrewName('');
    setNewCrewCode('');
    setNewCrewFriends('');
    setIsCreatingNewCrew(false);
    triggerHaptic(50);
  };

  const handleDeleteCrew = (crewId: string) => {
    if (confirm('Delete this saved squad?')) {
      const updated = deleteCrew(crewId);
      setSavedCrews(updated);
      triggerHaptic(40);
    }
  };

  const handleShareWhatsAppCrew = (code: string, crewName?: string) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
    const nameLabel = crewName ? `"${crewName}"` : code;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude.toFixed(6);
          const lon = pos.coords.longitude.toFixed(6);
          const gmapsPin = `https://maps.google.com/?q=${lat},${lon}`;
          const text = `🏍️ Join our ${nameLabel} crew ride:\n👉 ${url}\nRoom Code: *${code}*\n\n📍 Google Maps Pin:\n${gmapsPin}`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        () => {
          const text = `🏍️ Join our ${nameLabel} crew ride:\n👉 ${url}\nRoom Code: *${code}*`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 3000 }
      );
    } else {
      const text = `🏍️ Join our ${nameLabel} crew ride:\n👉 ${url}\nRoom Code: *${code}*`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleCopyInviteLink = (code: string) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      triggerHaptic(30);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div className="relative w-full h-[calc(100dvh-108px)] md:h-[calc(100dvh-64px)] min-h-[420px] overflow-hidden rounded-xl sm:rounded-2xl">
      
      {/* ─────────────────────────────────────────────────────────────
          PRIMARY LIVE MAP (Always Active - Previews GPS Even Before Joining)
      ───────────────────────────────────────────────────────────── */}
      {connectedViewMode === 'map' ? (
        <CrewLiveMap
          myLocation={myLocation}
          myRiderName={riderName}
          myColor={myColor}
          isHost={isHost}
          isConnected={isConnected}
          members={members}
          sosAlert={sosAlert}
          roomCode={roomCode}
          lastRoomCode={lastRoomCode}
          theme={theme}
          unitSystem={unitSystem}
          onTriggerSos={onTriggerSos}
          onDismissSos={onDismissSos}
          onLeaveRoom={onLeaveRoom}
          onRejoinRoom={onRejoinRoom}
          crewNotification={crewNotification}
          onDismissCrewNotification={onDismissCrewNotification}
          onShareWhatsApp={() => handleShareWhatsAppCrew(roomCode)}
          onCopyInviteLink={() => handleCopyInviteLink(roomCode)}
          copiedLink={copiedLink}
          onGoToCockpit={onGoToCockpit}
          onUpdateRiderName={onUpdateRiderName}
          isRecording={isRecording}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          pointsCount={pointsCount}
          totalDistanceMeters={totalDistanceMeters}
        />
      ) : (
        /* Detailed Squad Formation List View */
        <div className="w-full h-full p-3 sm:p-4 bg-[#080c10] overflow-y-auto space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setConnectedViewMode('map')}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Back to Live Map</span>
            </button>
            <span className="text-xs text-slate-400">
              {members.length + 1} Riders Online
            </span>
          </div>

          {/* Members List */}
          <div className="space-y-2 max-w-xl mx-auto pt-2">
            {/* You */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-7 h-7 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs"
                  style={{ backgroundColor: myColor || '#00f0ff' }}
                >
                  {riderName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{riderName}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300">YOU</span>
                    {isHost && <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">LEADER</span>}
                  </div>
                  <div className="text-[10px] text-emerald-400">GPS Transmitting Live</div>
                </div>
              </div>
            </div>

            {/* Friends */}
            {members.map(m => {
              const distFormatted = m.distanceFromMeMeters !== undefined
                ? m.distanceFromMeMeters < 1000
                  ? `${Math.round(m.distanceFromMeMeters)} m away`
                  : `${(m.distanceFromMeMeters / 1000).toFixed(1)} km away`
                : 'Locating...';
              const gmapsUrl = m.location
                ? `https://www.google.com/maps/dir/?api=1&destination=${m.location.lat.toFixed(6)},${m.location.lon.toFixed(6)}`
                : null;

              return (
                <div key={m.riderId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-7 h-7 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs"
                      style={{ backgroundColor: m.color || '#ffe600' }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.location && <span className="text-[10px] text-amber-400">{m.location.speedKmh.toFixed(0)} km/h</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-cyan-400">{distFormatted}</span>
                        <span>•</span>
                        <span className="text-emerald-400">Connected</span>
                      </div>
                    </div>
                  </div>

                  {gmapsUrl && (
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DISCONNECTED: COMPACT FLOATING ACTION SHEET (Docks above mobile nav)
      ───────────────────────────────────────────────────────────── */}
      {!isConnected && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 z-20 pointer-events-auto">
          <div className="p-3 rounded-2xl bg-slate-950/92 backdrop-blur-md border border-slate-700/80 shadow-2xl space-y-2.5 text-xs font-mono">
            
            {/* Header: Callsign Tag & Inline Quick Edit */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-heading font-black text-white text-xs uppercase tracking-wider">
                  Crew Radar
                </span>
              </div>
              {isEditingPreflightHandle ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    maxLength={15}
                    value={preflightHandle}
                    onChange={e => setPreflightHandle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        if (preflightHandle.trim()) onUpdateRiderName(preflightHandle.trim());
                        setIsEditingPreflightHandle(false);
                      }
                      if (e.key === 'Escape') setIsEditingPreflightHandle(false);
                    }}
                    className="bg-slate-900 border border-cyan-400 px-1.5 py-0.5 rounded text-[11px] text-white font-mono w-24 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (preflightHandle.trim()) onUpdateRiderName(preflightHandle.trim());
                      setIsEditingPreflightHandle(false);
                    }}
                    className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[9px] cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setPreflightHandle(riderName);
                    setIsEditingPreflightHandle(true);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  title="Click to customize your rider handle before joining"
                >
                  <span>Callsign: <strong className="text-cyan-300 underline">{riderName}</strong></span>
                  <Edit3 className="w-2.5 h-2.5 text-slate-500" />
                </button>
              )}
            </div>

            {/* 1-Tap Quick Rejoin Last Squad */}
            {lastRoomCode && (
              <button
                onClick={() => {
                  if (onStartRecording && !isRecording) onStartRecording();
                  if (onRejoinRoom) onRejoinRoom();
                  else onJoinRoom(lastRoomCode, riderName);
                }}
                disabled={connectionStatus === 'connecting'}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono font-bold text-xs flex items-center justify-between cursor-pointer transition-all active:scale-98 disabled:opacity-50 shadow-sm"
              >
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rejoin Squad</span>
                </span>
                <span className="font-heading font-black text-amber-200 uppercase tracking-wider">{lastRoomCode}</span>
              </button>
            )}

            {/* Error banner if connecting failed with Retry & Host options */}
            {statusMessage && connectionStatus === 'error' && (
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] space-y-1.5">
                <div className="text-center">{statusMessage}</div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    onClick={() => {
                      const codeToRetry = quickCodeInput.trim() || lastRoomCode;
                      if (codeToRetry) onJoinRoom(codeToRetry, riderName);
                    }}
                    className="flex-1 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCw className="w-2.5 h-2.5" />
                    <span>Retry</span>
                  </button>
                  <button
                    onClick={() => {
                      onCreateRoom(riderName, quickCodeInput.trim() || undefined);
                    }}
                    className="flex-1 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Host this Room</span>
                  </button>
                </div>
              </div>
            )}

            {/* Instant 1-Tap Host & Inline Code Join */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (onStartRecording && !isRecording) onStartRecording();
                  onCreateRoom(riderName);
                }}
                disabled={connectionStatus === 'connecting'}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer transition-all disabled:opacity-50 active:scale-98"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{connectionStatus === 'connecting' ? 'Starting...' : 'Start Crew Ride'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={10}
                  value={quickCodeInput}
                  onChange={e => setQuickCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && quickCodeInput.trim() && connectionStatus !== 'connecting') {
                      if (onStartRecording && !isRecording) onStartRecording();
                      onJoinRoom(quickCodeInput, riderName);
                    }
                  }}
                  placeholder="Room Code..."
                  className="flex-1 py-1.5 px-2.5 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono font-bold text-xs uppercase tracking-wider focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => {
                    if (onStartRecording && !isRecording) onStartRecording();
                    onJoinRoom(quickCodeInput, riderName);
                  }}
                  disabled={!quickCodeInput.trim() || connectionStatus === 'connecting'}
                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs cursor-pointer shadow-xs transition-all disabled:opacity-40 shrink-0"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Saved Squads Quick Chips (if any exist) */}
            {savedCrews.length > 0 && (
              <div className="pt-1 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-slate-500 shrink-0 font-bold">SAVED:</span>
                {savedCrews.map(c => (
                  <div key={c.id} className="inline-flex items-center rounded-full bg-slate-900 border border-slate-700 hover:border-slate-600 shrink-0 overflow-hidden">
                    <button
                      onClick={() => {
                        if (onStartRecording && !isRecording) onStartRecording();
                        onCreateRoom(riderName, c.code);
                      }}
                      className="pl-2 pr-1 py-0.5 hover:bg-slate-800 text-[10px] text-slate-300 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title={`Launch ${c.name} (${c.code})`}
                    >
                      <span>{c.name}</span>
                      <span className="text-[8px] text-cyan-400 font-mono">({c.code})</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCrew(c.id);
                      }}
                      className="px-1.5 py-0.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Delete squad"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Mini Squad Creator Toggle */}
            <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-500">
              <button
                onClick={() => setIsCreatingNewCrew(!isCreatingNewCrew)}
                className="hover:text-cyan-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{isCreatingNewCrew ? 'Close' : 'Save Squad'}</span>
              </button>
            </div>

            {/* Inline Mini Squad Creator Form */}
            {isCreatingNewCrew && (
              <form onSubmit={handleCreateCrew} className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-[10px]">
                <input
                  type="text"
                  maxLength={20}
                  value={newCrewName}
                  onChange={e => setNewCrewName(e.target.value)}
                  placeholder="Squad Name"
                  className="w-full py-1 px-2 rounded-lg border bg-slate-950 border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  required
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={8}
                    value={newCrewCode}
                    onChange={e => setNewCrewCode(e.target.value.toUpperCase())}
                    placeholder="Code (optional)"
                    className="flex-1 py-1 px-2 rounded-lg border bg-slate-950 border-slate-700 text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* Floating Formation List Toggle (When connected with multiple members) */}
      {isConnected && members.length > 0 && connectedViewMode === 'map' && (
        <div className="absolute top-12 left-2 z-10 pointer-events-auto">
          <button
            onClick={() => {
              triggerHaptic(15);
              setConnectedViewMode('list');
            }}
            className="h-7 px-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 hover:border-cyan-400 text-slate-400 hover:text-white text-[10px] font-mono font-bold flex items-center gap-1 shadow-md cursor-pointer transition-colors"
            title="View formation list"
          >
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>List ({members.length + 1})</span>
          </button>
        </div>
      )}

    </div>
  );
};

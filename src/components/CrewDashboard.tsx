import React, { useState, useEffect } from 'react';
import { AppTheme, UnitSystem } from '../types';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
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
  Copy, 
  Check, 
  AlertTriangle, 
  Navigation, 
  Plus, 
  Trash2, 
  Edit3, 
  Coffee, 
  Shield, 
  Map as MapIcon,
  Compass
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { CrewLiveMap } from './CrewLiveMap';

interface CrewDashboardProps {
  roomCode: string;
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
  onCreateRoom: (name: string, customCode?: string) => void;
  onJoinRoom: (code: string, name?: string) => void;
  onLeaveRoom: () => void;
  onTriggerSos: () => void;
  onDismissSos: () => void;
  onUpdateRiderName: (newName: string) => void;
  onGoToCockpit?: () => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode,
  riderName,
  myColor = '#00f0ff',
  myLocation = null,
  isHost,
  isConnected,
  connectionStatus,
  statusMessage,
  members,
  sosAlert,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onTriggerSos,
  onDismissSos,
  onUpdateRiderName,
  onGoToCockpit,
  theme = 'dark',
  unitSystem = 'metric',
}) => {
  const isLight = theme === 'light';

  // Saved crews state
  const [savedCrews, setSavedCrews] = useState<SavedCrew[]>([]);
  const [isCreatingNewCrew, setIsCreatingNewCrew] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewCode, setNewCrewCode] = useState('');
  const [newCrewFriends, setNewCrewFriends] = useState('');

  // Inline handle editing state for disconnected screen
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(riderName);

  // Quick join code input
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [connectedViewMode, setConnectedViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    setSavedCrews(getSavedCrews());
  }, []);

  useEffect(() => {
    setTempName(riderName);
  }, [riderName]);

  const handleSaveRiderName = () => {
    if (tempName.trim()) {
      onUpdateRiderName(tempName.trim());
      setIsEditingName(false);
      triggerHaptic(40);
    }
  };

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
    const url = `${window.location.origin}/?room=${code}`;
    const nameLabel = crewName ? `"${crewName}"` : code;
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude.toFixed(6);
          const lon = pos.coords.longitude.toFixed(6);
          const gmapsPin = `https://maps.google.com/?q=${lat},${lon}`;
          const text = `🏍️ ThrottleLog Crew Ride Alert!\n\nJoin our ${nameLabel} ride directly:\n👉 ${url}\n\nRoom Code: *${code}*\n(No login or app install needed, tap link to open live map!)\n\n📍 My Live Google Maps Pin:\n${gmapsPin}`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        () => {
          const text = `🏍️ Join our ${nameLabel} ride on ThrottleLog!\n\n👉 Tap to join live radar:\n${url}\n\nRoom Code: *${code}*`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 3000 }
      );
    } else {
      const text = `🏍️ Join our ${nameLabel} ride on ThrottleLog!\n\n👉 Tap to join live radar:\n${url}\n\nRoom Code: *${code}*`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleCopyInviteLink = (code: string) => {
    const url = `${window.location.origin}/?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      triggerHaptic(30);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const cardBg = isLight 
    ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
    : 'bg-[#131b24] border-[#1e2a38] text-white shadow-md';
  const innerCardBg = isLight 
    ? 'bg-slate-50 border-slate-200' 
    : 'bg-[#0d131a] border-[#1e2a38]';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 animate-in fade-in duration-200">
      
      {/* ─────────────────────────────────────────────────────────────
          STATE 1: CONNECTED CREW RADAR (Minimal, Front-and-Center Map)
      ───────────────────────────────────────────────────────────── */}
      {isConnected ? (
        <div className="space-y-2">
          {/* Subtle View Switcher if multiple riders online */}
          {members.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 text-xs font-mono font-bold">
                <button
                  onClick={() => {
                    triggerHaptic(15);
                    setConnectedViewMode('map');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    connectedViewMode === 'map'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MapIcon className="w-3 h-3" />
                  <span>Live Map</span>
                </button>
                <button
                  onClick={() => {
                    triggerHaptic(15);
                    setConnectedViewMode('list');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    connectedViewMode === 'list'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Riders List ({members.length + 1})</span>
                </button>
              </div>

              {onGoToCockpit && (
                <button
                  onClick={onGoToCockpit}
                  className="px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Radio className="w-3 h-3" />
                  <span>Cockpit</span>
                </button>
              )}
            </div>
          )}

          {/* VIEW MODE 1: LIVE MAP COCKPIT */}
          {connectedViewMode === 'map' && (
            <CrewLiveMap
              myLocation={myLocation}
              myRiderName={riderName}
              myColor={myColor}
              isHost={isHost}
              members={members}
              sosAlert={sosAlert}
              roomCode={roomCode}
              theme={theme}
              unitSystem={unitSystem}
              onTriggerSos={onTriggerSos}
              onDismissSos={onDismissSos}
              onLeaveRoom={onLeaveRoom}
              onShareWhatsApp={() => handleShareWhatsAppCrew(roomCode)}
              onCopyInviteLink={() => handleCopyInviteLink(roomCode)}
              copiedLink={copiedLink}
              onGoToCockpit={onGoToCockpit}
              onUpdateRiderName={onUpdateRiderName}
            />
          )}

          {/* VIEW MODE 2: SQUAD FORMATION LIST */}
          {connectedViewMode === 'list' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Squad Formation ({members.length + 1} Riders Online)</span>
                </h2>
                <span className={`text-[11px] font-mono ${subTextColor}`}>
                  Sorted by distance
                </span>
              </div>

              {/* You */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${cardBg}`}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl text-slate-950 font-black flex items-center justify-center text-sm shadow-sm"
                    style={{ backgroundColor: myColor || '#00f0ff' }}
                  >
                    {riderName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-heading font-black text-sm flex items-center gap-2">
                      <span>{riderName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[9px] font-bold">
                        YOU
                      </span>
                      {isHost && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold">
                          LEADER
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      GPS Transmitting Live
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Friends List */}
              {members.map(m => {
                const distFormatted = m.distanceFromMeMeters !== undefined
                  ? m.distanceFromMeMeters < 1000
                    ? `${Math.round(m.distanceFromMeMeters)} m away`
                    : `${(m.distanceFromMeMeters / 1000).toFixed(1)} km away`
                  : 'Locating GPS...';

                const isStopped = m.location && m.location.speedKmh < 2.0;
                const gmapsNavUrl = m.location
                  ? `https://www.google.com/maps/dir/?api=1&destination=${m.location.lat.toFixed(6)},${m.location.lon.toFixed(6)}`
                  : null;

                return (
                  <div key={m.riderId} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl text-slate-950 font-black flex items-center justify-center text-sm shadow-sm"
                        style={{ backgroundColor: m.color || '#ffe600' }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-heading font-black text-sm flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.location && (
                            <span className="font-mono text-xs text-amber-400 font-bold">
                              {m.location.speedKmh.toFixed(0)} km/h
                            </span>
                          )}
                          {isStopped && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold flex items-center gap-0.5">
                              <Coffee className="w-3 h-3" /> Stopped
                            </span>
                          )}
                        </div>
                        <div className={`text-xs font-mono flex items-center gap-2 mt-0.5 ${subTextColor}`}>
                          <span className="text-cyan-400 font-bold">{distFormatted}</span>
                          <span>•</span>
                          <span className="text-emerald-400">Connected ●</span>
                        </div>
                      </div>
                    </div>

                    {gmapsNavUrl && (
                      <a
                        href={gmapsNavUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 font-mono font-bold text-xs flex items-center gap-1.5 transition-all self-end sm:self-auto cursor-pointer"
                        title={`Open Google Maps directions to ${m.name}`}
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Navigate in Maps</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            STATE 2: DISCONNECTED / SIMPLE 1-TAP ENTRY
        ───────────────────────────────────────────────────────────── */
        <div className="space-y-5">
          {/* Clean Header Bar */}
          <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 flex items-center justify-center font-black">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-heading font-black uppercase tracking-tight">
                  Crew Group Rides
                </h1>
                <p className={`text-xs font-mono ${subTextColor}`}>
                  Live phone-to-phone GPS radar for motorcycle squads
                </p>
              </div>
            </div>

            {/* Rider Handle Pill */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1 bg-slate-900 border border-cyan-400 rounded-xl p-1">
                  <input
                    type="text"
                    maxLength={18}
                    value={tempName}
                    onChange={e => setTempName(e.target.value)}
                    placeholder="Rider handle..."
                    className="px-2 py-1 bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-28"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRiderName}
                    className="px-2.5 py-1 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                    isLight 
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                      : 'bg-[#0d131a] hover:bg-[#182330] border-[#223140] text-cyan-400'
                  }`}
                  title="Change your rider handle"
                >
                  <div className="w-5 h-5 rounded-md bg-cyan-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                    {riderName.charAt(0).toUpperCase()}
                  </div>
                  <span>{riderName}</span>
                  <Edit3 className="w-3 h-3 opacity-60" />
                </button>
              )}
            </div>
          </div>

          {/* Connection Error Notification */}
          {statusMessage && connectionStatus === 'error' && (
            <div className="p-3 rounded-xl border bg-rose-500/10 border-rose-500/30 text-rose-300 text-xs font-mono text-center">
              {statusMessage}
            </div>
          )}

          {/* 2 Primary Action Cards: Host or Join */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Host Card */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardBg}`}>
              <div>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-2.5">
                  <Radio className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-black text-base uppercase">
                  Start Instant Crew Ride
                </h3>
                <p className={`text-xs font-mono mt-1 ${subTextColor}`}>
                  Creates an instant room. Share the 1-tap WhatsApp link so friends join immediately on the live map.
                </p>
              </div>

              <button
                onClick={() => onCreateRoom(riderName)}
                disabled={connectionStatus === 'connecting'}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 mt-2 active:scale-98"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>{connectionStatus === 'connecting' ? 'Starting...' : 'Host New Crew Ride'}</span>
              </button>
            </div>

            {/* Join with Code Card */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardBg}`}>
              <div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-2.5">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-black text-base uppercase">
                  Join with Room Code
                </h3>
                <p className={`text-xs font-mono mt-1 ${subTextColor}`}>
                  Got a code from your ride leader? Enter it below to link onto the group radar.
                </p>
              </div>

              <div className="space-y-2 mt-2">
                <input
                  type="text"
                  maxLength={10}
                  value={quickCodeInput}
                  onChange={e => setQuickCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. SUNDAY, CREW48"
                  className="w-full py-2.5 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono font-bold text-xs uppercase tracking-widest focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => onJoinRoom(quickCodeInput, riderName)}
                  disabled={!quickCodeInput.trim() || connectionStatus === 'connecting'}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-40 active:scale-98"
                >
                  <Users className="w-4 h-4" />
                  <span>Join Crew Ride</span>
                </button>
              </div>
            </div>
          </div>

          {/* Saved Riding Squads (Preset Groups) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-black text-sm uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Saved Riding Squads</span>
                </h2>
                <p className={`text-[11px] font-mono ${subTextColor}`}>
                  Quick 1-tap connect for regular weekend squads
                </p>
              </div>

              <button
                onClick={() => setIsCreatingNewCrew(!isCreatingNewCrew)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingNewCrew ? 'Cancel' : 'New Squad'}</span>
              </button>
            </div>

            {/* Create New Squad Form */}
            {isCreatingNewCrew && (
              <form onSubmit={handleCreateCrew} className={`p-4 rounded-2xl border space-y-3 ${innerCardBg}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block font-mono text-[10px] font-bold uppercase mb-1 ${subTextColor}`}>
                      Squad Name:
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      value={newCrewName}
                      onChange={e => setNewCrewName(e.target.value)}
                      placeholder="e.g. Sunday Ghats Riders"
                      className="w-full py-2 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block font-mono text-[10px] font-bold uppercase mb-1 ${subTextColor}`}>
                      Custom Code (Optional):
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={newCrewCode}
                      onChange={e => setNewCrewCode(e.target.value.toUpperCase())}
                      placeholder="e.g. GHATS, SUNDAY"
                      className="w-full py-2 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Squad</span>
                </button>
              </form>
            )}

            {/* Saved Squad Cards */}
            {savedCrews.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedCrews.map(crew => (
                  <div key={crew.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${cardBg}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-black text-sm uppercase text-white truncate">
                          {crew.name}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
                          {crew.code}
                        </span>
                      </div>
                      <p className={`text-[11px] font-mono mt-0.5 ${subTextColor}`}>
                        {crew.members.join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onCreateRoom(riderName, crew.code)}
                        disabled={connectionStatus === 'connecting'}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                      >
                        <Radio className="w-3 h-3" />
                        <span>Start</span>
                      </button>

                      <button
                        onClick={() => handleShareWhatsAppCrew(crew.code, crew.name)}
                        className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 cursor-pointer"
                        title="Share on WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteCrew(crew.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Delete squad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

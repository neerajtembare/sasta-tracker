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
  LogOut, 
  Shield, 
  Navigation, 
  Plus, 
  Trash2, 
  Edit3, 
  Coffee, 
  Zap, 
  Dices, 
  UserCheck, 
  Compass, 
  ChevronRight,
  ExternalLink,
  MessageCircle,
  MapPin
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';

interface CrewDashboardProps {
  roomCode: string;
  riderName: string;
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

  // Inline name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(riderName);

  // New member quick-add state per crew id
  const [activeAddMemberCrewId, setActiveAddMemberCrewId] = useState<string | null>(null);
  const [newMemberInput, setNewMemberInput] = useState('');

  // Quick join code input
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

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
      triggerHaptic(50);
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
    triggerHaptic(60);
  };

  const handleDeleteCrew = (crewId: string) => {
    if (confirm('Delete this saved crew?')) {
      const updated = deleteCrew(crewId);
      setSavedCrews(updated);
      triggerHaptic(40);
    }
  };

  const handleAddMember = (crewId: string) => {
    if (!newMemberInput.trim()) return;
    const updated = addMemberToCrew(crewId, newMemberInput.trim());
    setSavedCrews(updated);
    setNewMemberInput('');
    setActiveAddMemberCrewId(null);
    triggerHaptic(40);
  };

  const handleRemoveMember = (crewId: string, member: string) => {
    const updated = removeMemberFromCrew(crewId, member);
    setSavedCrews(updated);
    triggerHaptic(30);
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
          const text = `🏍️ ThrottleLog Crew Ride Alert!\n\nJoin our ${nameLabel} ride directly:\n👉 ${url}\n\nRoom Code: *${code}*\n(No login or setup needed, tap link to join!)\n\n📍 My Live Google Maps Pin:\n${gmapsPin}`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        () => {
          const text = `🏍️ Join our ${nameLabel} ride on ThrottleLog!\n\n👉 Tap to join directly:\n${url}\n\nRoom Code: *${code}*\n(No login or setup needed!)`;
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(waUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      const text = `🏍️ Join our ${nameLabel} ride on ThrottleLog!\n\n👉 Tap to join directly:\n${url}\n\nRoom Code: *${code}*`;
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleCopyInviteLink = (code: string) => {
    const url = `${window.location.origin}/?room=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      triggerHaptic(40);
      setTimeout(() => setCopiedLink(false), 2200);
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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 animate-fadeIn">
      {/* SOS Alert Banner */}
      {sosAlert && (
        <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-rose-300 font-mono text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500 text-slate-950 flex items-center justify-center font-black">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white uppercase tracking-wider">
                🚨 REGROUP ALERT: {sosAlert.fromName}
              </div>
              <div className="text-[11px] text-rose-300">
                A crew member requested everyone to regroup at their live GPS coordinates!
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>Navigate in Google Maps</span>
            </a>
            <button
              onClick={onDismissSos}
              className="px-3 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${cardBg}`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isConnected
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
              : 'bg-slate-800/60 border-slate-700 text-slate-400'
          }`}>
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-heading font-black uppercase tracking-tight">
                Crew Command Center
              </h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                isConnected
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isConnected ? '● LIVE P2P' : 'STANDBY'}
              </span>
            </div>
            <p className={`text-xs font-mono mt-0.5 ${subTextColor}`}>
              {isConnected 
                ? `Connected to room ${roomCode} • Direct phone-to-phone live telemetry` 
                : '1-tap motorcycle group rides • Real-time distance radar & turn-by-turn navigation'}
            </p>
          </div>
        </div>

        {/* Rider Callsign Pill */}
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-cyan-500/50 rounded-xl p-1">
              <input
                type="text"
                maxLength={18}
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                placeholder="Rider handle..."
                className="px-2 py-1 bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-32"
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
              title="Click to change your rider callsign"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-[#0d131a] hover:bg-[#182330] border-[#223140] text-cyan-400'
              }`}
            >
              <div className="w-5 h-5 rounded-md bg-cyan-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                {riderName.charAt(0).toUpperCase()}
              </div>
              <span>{riderName}</span>
              <Edit3 className="w-3 h-3 opacity-60 hover:opacity-100" />
            </button>
          )}

          {isConnected && onGoToCockpit && (
            <button
              onClick={onGoToCockpit}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Cockpit HUD</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STATE 1: CONNECTED CREW RADAR
      ───────────────────────────────────────────────────────────── */}
      {isConnected ? (
        <div className="space-y-4">
          {/* Active Room Toolbar */}
          <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${cardBg}`}>
            <div>
              <div className={`text-[10px] font-mono uppercase tracking-wider font-bold ${subTextColor}`}>
                ACTIVE ROOM CODE
              </div>
              <div className="text-2xl font-heading font-black text-cyan-400 tracking-widest flex items-center gap-2">
                <span>{roomCode}</span>
                {isHost && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    HOST / LEADER
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleShareWhatsAppCrew(roomCode)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                title="Send invite link directly on WhatsApp"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp Invite</span>
              </button>

              <button
                onClick={() => handleCopyInviteLink(roomCode)}
                className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy 1-tap join link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={onTriggerSos}
                className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Send regroup ping to all crew members"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Call Regroup</span>
              </button>

              <button
                onClick={onLeaveRoom}
                className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-rose-950/40 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Leave this group ride"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* Crew Formation Radar & Member Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Crew Formation Radar ({members.length + 1} Riders Online)</span>
              </h2>
              <span className={`text-[11px] font-mono ${subTextColor}`}>
                Sorted by distance from you
              </span>
            </div>

            {/* You (Host / Rider) */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${cardBg}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00f0ff] text-slate-950 font-black flex items-center justify-center text-sm shadow-[0_0_12px_#00f0ff]">
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
                  <div className={`text-[11px] font-mono flex items-center gap-2 ${subTextColor}`}>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      GPS Transmitting Live
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsEditingName(true)}
                className={`p-2 rounded-xl border text-xs font-mono ${innerCardBg} hover:border-cyan-400 cursor-pointer`}
                title="Edit your callsign"
              >
                <Edit3 className="w-4 h-4 text-slate-400 hover:text-cyan-400" />
              </button>
            </div>

            {/* Connected Friends List */}
            {members.length === 0 ? (
              <div className={`p-8 rounded-2xl border text-center space-y-3 ${cardBg}`}>
                <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <Share2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-sm uppercase">
                    Waiting for Friends to Join
                  </h3>
                  <p className={`text-xs font-mono max-w-md mx-auto mt-1 ${subTextColor}`}>
                    Share the room code <strong>{roomCode}</strong> or tap the WhatsApp button below. When your friends open the link, they will appear on this radar instantly!
                  </p>
                </div>
                <button
                  onClick={() => handleShareWhatsAppCrew(roomCode)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Send WhatsApp Invite Link</span>
                </button>
              </div>
            ) : (
              members.map(m => {
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
                          <span>Active ●</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {gmapsNavUrl && (
                        <a
                          href={gmapsNavUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title={`Turn-by-turn navigation in Google Maps to ${m.name}`}
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Navigate to {m.name}</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            STATE 2: DISCONNECTED / SAVED CREWS HUB
        ───────────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Quick Join / Launch Hero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick 1-Tap Host */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardBg}`}>
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-3">
                  <Radio className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-black text-base uppercase">
                  Start Instant Crew Ride
                </h3>
                <p className={`text-xs font-mono mt-1 ${subTextColor}`}>
                  Creates an instant private room. Share the 1-tap link with your friends on WhatsApp so they can join with zero code typing.
                </p>
              </div>

              <button
                onClick={() => onCreateRoom(riderName)}
                disabled={connectionStatus === 'connecting'}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 mt-2"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>{connectionStatus === 'connecting' ? 'Starting...' : 'Host New Crew Ride'}</span>
              </button>
            </div>

            {/* Quick Join with Code */}
            <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardBg}`}>
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-black text-base uppercase">
                  Join a Friend's Ride
                </h3>
                <p className={`text-xs font-mono mt-1 ${subTextColor}`}>
                  Got a room code from a friend? Enter it below to link up on the live mountain radar.
                </p>
              </div>

              <div className="space-y-2 mt-2">
                <input
                  type="text"
                  maxLength={10}
                  value={quickCodeInput}
                  onChange={e => setQuickCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. SUNDAY, RIDE4821"
                  className="w-full py-2.5 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono font-bold text-xs uppercase tracking-widest focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => onJoinRoom(quickCodeInput, riderName)}
                  disabled={!quickCodeInput.trim() || connectionStatus === 'connecting'}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all disabled:opacity-40"
                >
                  <Users className="w-4 h-4" />
                  <span>Join Crew Ride</span>
                </button>
              </div>
            </div>
          </div>

          {/* Connection Status / Error Banner */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border text-xs font-mono text-center ${
              connectionStatus === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}>
              {statusMessage}
            </div>
          )}

          {/* Premade Groups / Saved Crews Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-black text-sm uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>My Riding Crews (Premade Groups)</span>
                </h2>
                <p className={`text-[11px] font-mono ${subTextColor}`}>
                  Save your regular riding squads. 1-tap connect every weekend without typing codes.
                </p>
              </div>

              <button
                onClick={() => setIsCreatingNewCrew(!isCreatingNewCrew)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingNewCrew ? 'Cancel' : 'New Crew'}</span>
              </button>
            </div>

            {/* Create New Crew Drawer / Form */}
            {isCreatingNewCrew && (
              <form onSubmit={handleCreateCrew} className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 animate-fadeIn ${innerCardBg}`}>
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs uppercase text-cyan-400">
                    Create Premade Riding Group
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingNewCrew(false)}
                    className="text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block font-mono text-[10px] font-bold uppercase mb-1 ${subTextColor}`}>
                      Crew / Group Name:
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
                      Custom Room Code (Optional):
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

                <div>
                  <label className={`block font-mono text-[10px] font-bold uppercase mb-1 ${subTextColor}`}>
                    Friend Names / Squad Members (comma separated):
                  </label>
                  <input
                    type="text"
                    value={newCrewFriends}
                    onChange={e => setNewCrewFriends(e.target.value)}
                    placeholder="e.g. Rahul, Amit, Vikram, Sam"
                    className="w-full py-2 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Riding Crew</span>
                </button>
              </form>
            )}

            {/* List of Saved Crews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedCrews.map(crew => (
                <div key={crew.id} className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between gap-3 ${cardBg}`}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading font-black text-sm uppercase text-white truncate">
                        {crew.name}
                      </h3>
                      <button
                        onClick={() => handleDeleteCrew(crew.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        title="Delete this saved crew"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30">
                        CODE: {crew.code}
                      </span>
                      <span className={`text-[10px] font-mono ${subTextColor}`}>
                        {crew.members.length} members
                      </span>
                    </div>

                    {/* Member Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {crew.members.map(member => (
                        <span 
                          key={member}
                          className="px-2 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[10px] font-mono flex items-center gap-1"
                        >
                          <span>{member}</span>
                          <button
                            onClick={() => handleRemoveMember(crew.id, member)}
                            className="hover:text-rose-400 cursor-pointer ml-0.5"
                            title={`Remove ${member}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {/* Add Member Quick Form */}
                      {activeAddMemberCrewId === crew.id ? (
                        <div className="flex items-center gap-1 bg-slate-900 border border-cyan-500/40 rounded-lg p-0.5">
                          <input
                            type="text"
                            maxLength={15}
                            value={newMemberInput}
                            onChange={e => setNewMemberInput(e.target.value)}
                            placeholder="Name..."
                            className="px-1.5 py-0.5 bg-transparent text-[10px] font-mono text-white focus:outline-none w-20"
                            autoFocus
                          />
                          <button
                            onClick={() => handleAddMember(crew.id)}
                            className="px-1.5 py-0.5 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            onClick={() => setActiveAddMemberCrewId(null)}
                            className="px-1 text-slate-400 text-[10px] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveAddMemberCrewId(crew.id);
                            setNewMemberInput('');
                          }}
                          className="px-2 py-0.5 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500 text-[10px] font-mono flex items-center gap-0.5 cursor-pointer transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1-Tap Actions */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => onCreateRoom(riderName, crew.code)}
                      disabled={connectionStatus === 'connecting'}
                      className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Start Crew Ride</span>
                    </button>

                    <button
                      onClick={() => handleShareWhatsAppCrew(crew.code, crew.name)}
                      className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Share 1-tap WhatsApp invite link"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => handleCopyInviteLink(crew.code)}
                      className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 cursor-pointer transition-colors"
                      title="Copy invite link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

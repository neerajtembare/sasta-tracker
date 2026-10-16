import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  X, 
  Share2, 
  Radio, 
  Check, 
  Copy, 
  Navigation, 
  Sparkles, 
  LogOut, 
  Edit3,
  Dices,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { SavedCrew, getSavedCrews, saveCrew, deleteCrew, addMemberToCrew, removeMemberFromCrew } from '../utils/storage';
import { GroupMemberInfo } from '../hooks/useGroupRide';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface CrewManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  lastRoomCode?: string;
  riderName: string;
  myColor?: string;
  isHost: boolean;
  isConnected: boolean;
  members: GroupMemberInfo[];
  onCreateRoom: (name: string, customCode?: string) => void;
  onJoinRoom: (code: string, name?: string) => void;
  onLeaveRoom: () => void;
  onUpdateRiderName: (newName: string) => void;
  onFocusRider?: (riderId: string) => void;
  theme?: AppTheme;
  initialTab?: 'active' | 'saved' | 'create' | 'join';
}

export const CrewManageModal: React.FC<CrewManageModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  lastRoomCode = '',
  riderName,
  myColor = '#00f0ff',
  isHost,
  isConnected,
  members,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onUpdateRiderName,
  onFocusRider,
  theme = 'dark',
  initialTab,
}) => {
  const isLight = theme === 'light';

  // Tabs: 'active' (if connected), 'saved', 'create', 'join'
  const [activeTab, setActiveTab] = useState<'active' | 'saved' | 'create' | 'join'>('saved');
  const [savedCrews, setSavedCrews] = useState<SavedCrew[]>([]);

  // Create form state
  const [createCrewName, setCreateCrewName] = useState('');
  const [createCrewCode, setCreateCrewCode] = useState('');
  const [createCrewMembers, setCreateCrewMembers] = useState('');

  // Join form state
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Rider callsign editing
  const [isEditingCallsign, setIsEditingCallsign] = useState(false);
  const [tempCallsign, setTempCallsign] = useState(riderName);

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Inline member add state for saved crews: crewId -> text
  const [addingMemberCrewId, setAddingMemberCrewId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');

  // Inline squad renaming state
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [editingCrewName, setEditingCrewName] = useState('');

  // Sync saved crews from storage on open
  useEffect(() => {
    if (isOpen) {
      setSavedCrews(getSavedCrews());
      setTempCallsign(riderName);
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (isConnected) {
        setActiveTab('active');
      } else {
        setActiveTab('saved');
      }
    }
  }, [isOpen, isConnected, riderName, initialTab]);

  if (!isOpen) return null;

  // Generate random cool room code
  const handleGenerateRandomCode = () => {
    triggerHaptic(20);
    const prefixes = ['CREW', 'APEX', 'RIDE', 'MOTO', 'GHAT', 'TURBO', 'TRACK'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    setCreateCrewCode(`${p}${num}`);
  };

  // Handle creating a new crew
  const handleSaveAndLaunch = (launchImmediately: boolean) => {
    const name = createCrewName.trim();
    if (!name) {
      alert('Please enter a Squad Name (e.g. "Sunday Ghats Riders")');
      return;
    }

    const cleanCode = (createCrewCode.trim() || `CREW${Math.floor(1000 + Math.random() * 9000)}`)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);

    const friendList = createCrewMembers
      .split(',')
      .map(f => f.trim())
      .filter(Boolean);

    const newCrew: SavedCrew = {
      id: 'crew_' + Date.now(),
      name,
      code: cleanCode,
      members: friendList.length > 0 ? friendList : [riderName || 'You'],
      createdAt: Date.now(),
    };

    const updated = saveCrew(newCrew);
    setSavedCrews(updated);
    setCreateCrewName('');
    setCreateCrewCode('');
    setCreateCrewMembers('');
    triggerHaptic(40);

    if (launchImmediately) {
      onCreateRoom(riderName, cleanCode);
      onClose();
    } else {
      setActiveTab('saved');
    }
  };

  // Handle deleting a crew
  const handleDeleteCrew = (crewId: string, crewName: string) => {
    if (window.confirm(`Are you sure you want to delete squad "${crewName}"?`)) {
      const updated = deleteCrew(crewId);
      setSavedCrews(updated);
      triggerHaptic(30);
    }
  };

  // Handle saving renamed squad
  const handleSaveCrewName = (crew: SavedCrew) => {
    if (!editingCrewName.trim()) {
      setEditingCrewId(null);
      return;
    }
    const updated = saveCrew({ ...crew, name: editingCrewName.trim() });
    setSavedCrews(updated);
    setEditingCrewId(null);
    setEditingCrewName('');
    triggerHaptic(25);
  };

  // Handle adding friend to an existing saved crew
  const handleAddMemberToSavedCrew = (crewId: string) => {
    if (!newMemberName.trim()) return;
    const updated = addMemberToCrew(crewId, newMemberName.trim());
    setSavedCrews(updated);
    setNewMemberName('');
    setAddingMemberCrewId(null);
    triggerHaptic(20);
  };

  // Handle removing friend from saved crew
  const handleRemoveMember = (crewId: string, member: string) => {
    const updated = removeMemberFromCrew(crewId, member);
    setSavedCrews(updated);
    triggerHaptic(20);
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      triggerHaptic(25);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Copy full invite link to clipboard
  const handleCopyInviteLink = (code: string) => {
    const leaderParam = riderName ? `&leader=${encodeURIComponent(riderName)}` : '';
    const url = `${window.location.origin}${window.location.pathname}?room=${code}${leaderParam}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      triggerHaptic(25);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // WhatsApp Invite
  const handleShareWhatsApp = (code: string, crewName?: string) => {
    const leaderParam = riderName ? `&leader=${encodeURIComponent(riderName)}` : '';
    const url = `${window.location.origin}${window.location.pathname}?room=${code}${leaderParam}`;
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

  // Save current rider callsign
  const handleSaveCallsign = () => {
    if (tempCallsign.trim()) {
      onUpdateRiderName(tempCallsign.trim());
      setIsEditingCallsign(false);
      triggerHaptic(30);
    }
  };

  const totalRiders = members.length + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden font-mono ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0a0f16] border-[#1e2a38] text-slate-200'
        }`}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-black text-sm uppercase tracking-wider text-white flex items-center gap-2">
                <span>Crew Management</span>
                {isConnected && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30 animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>Callsign:</span>
                {isEditingCallsign ? (
                  <span className="flex items-center gap-1">
                    <input 
                      type="text" 
                      value={tempCallsign} 
                      onChange={e => setTempCallsign(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveCallsign()}
                      maxLength={15}
                      className="bg-slate-900 border border-cyan-400 text-cyan-300 text-[10px] px-1 py-0.2 rounded w-24 focus:outline-none"
                      autoFocus
                    />
                    <button 
                      onClick={handleSaveCallsign} 
                      className="text-cyan-400 font-bold hover:underline cursor-pointer"
                    >
                      Save
                    </button>
                  </span>
                ) : (
                  <button 
                    onClick={() => {
                      setTempCallsign(riderName);
                      setIsEditingCallsign(true);
                    }}
                    className="text-cyan-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    title="Change callsign"
                  >
                    <span>{riderName}</span>
                    <Edit3 className="w-2.5 h-2.5 text-slate-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-3 pt-2 pb-1 border-b border-slate-800/80 gap-1 bg-slate-950/30 overflow-x-auto no-scrollbar">
          {isConnected && (
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'active'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Active Convoy ({totalRiders})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'saved'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Saved Squads ({savedCrews.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'create'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Make Crew</span>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'join'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Join Crew</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: ACTIVE CONVOY (When Connected)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'active' && isConnected && (
            <div className="space-y-3">
              {/* Active Room Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Active Squad Code</span>
                    <div className="font-heading font-black text-xl text-cyan-400 flex items-center gap-2">
                      <span>{roomCode}</span>
                      <button
                        onClick={() => handleCopyCode(roomCode)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                        title="Copy code"
                      >
                        {copiedCode === roomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyInviteLink(roomCode)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Copy full invite link"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="hidden xs:inline">{copiedLink ? 'Copied' : 'Link'}</span>
                    </button>

                    <button
                      onClick={() => handleShareWhatsApp(roomCode)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span>Role:</span>
                      {isHost ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                          👑 Squad Leader
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                          Rider
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span>{totalRiders} Riders Connected</span>
                  </div>

                  {!savedCrews.some(c => c.code === roomCode) && (
                    <button
                      onClick={() => {
                        const newCrew: SavedCrew = {
                          id: 'crew_' + Date.now(),
                          name: `Crew ${roomCode}`,
                          code: roomCode,
                          members: [riderName],
                          createdAt: Date.now(),
                        };
                        const updated = saveCrew(newCrew);
                        setSavedCrews(updated);
                        triggerHaptic(40);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Save to My Squads</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Roster List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Live Radar Roster
                </div>

                {/* You */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-7 h-7 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs"
                      style={{ backgroundColor: myColor }}
                    >
                      {riderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{riderName}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">YOU</span>
                      </div>
                      <div className="text-[10px] text-emerald-400">GPS Transmitting Live</div>
                    </div>
                  </div>
                  {onFocusRider && (
                    <button
                      onClick={() => {
                        onFocusRider('me');
                        onClose();
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer"
                    >
                      Focus Map
                    </button>
                  )}
                </div>

                {/* Other members */}
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
                    <div key={m.riderId} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
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
                            {m.isHost && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                                👑 LEADER
                              </span>
                            )}
                            {m.location && <span className="text-[10px] text-amber-400">{m.location.speedKmh.toFixed(0)} km/h</span>}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span className="text-cyan-400">{distFormatted}</span>
                            <span>•</span>
                            <span className={m.isStale ? 'text-amber-400' : 'text-emerald-400'}>
                              {m.isStale ? 'Weak Signal' : 'Connected'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onFocusRider && (
                          <button
                            onClick={() => {
                              onFocusRider(m.riderId);
                              onClose();
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold cursor-pointer"
                          >
                            Focus
                          </button>
                        )}
                        {gmapsUrl && (
                          <a
                            href={gmapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Navigation className="w-2.5 h-2.5" />
                            <span>Directions</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leave / End Ride Action */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (window.confirm(isHost ? 'End this crew ride for all connected riders?' : 'Leave this crew radar?')) {
                      onLeaveRoom();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isHost ? 'End Crew Ride Session' : 'Disconnect from Crew'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: SAVED SQUADS (List, Delete, Host, Join)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Manage your preset riding groups ({savedCrews.length})
                </span>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Make New</span>
                </button>
              </div>

              {savedCrews.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-white">No Saved Squads Yet</div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Create a preset crew for your Sunday rides, track days, or weekend road trips to launch or join with 1 tap!
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Your First Squad</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedCrews.map(crew => (
                    <div 
                      key={crew.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {editingCrewId === crew.id ? (
                            <div className="flex items-center gap-1.5 py-0.5">
                              <input
                                type="text"
                                maxLength={30}
                                value={editingCrewName}
                                onChange={e => setEditingCrewName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveCrewName(crew);
                                  if (e.key === 'Escape') setEditingCrewId(null);
                                }}
                                className="bg-slate-950 border border-cyan-400 text-white font-heading font-black text-xs px-2 py-0.5 rounded w-44 focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveCrewName(crew)}
                                className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCrewId(null)}
                                className="text-slate-500 text-[10px] cursor-pointer hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="font-heading font-black text-white text-sm flex items-center gap-2 flex-wrap">
                              <span>{crew.name}</span>
                              <button
                                onClick={() => {
                                  setEditingCrewId(crew.id);
                                  setEditingCrewName(crew.name);
                                }}
                                className="text-slate-500 hover:text-cyan-300 cursor-pointer"
                                title="Rename squad"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                                {crew.code}
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Created {new Date(crew.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopyInviteLink(crew.code)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                            title="Copy full invite link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleShareWhatsApp(crew.code, crew.name)}
                            className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors cursor-pointer"
                            title="Share squad invite on WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCrew(crew.id, crew.name)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors cursor-pointer"
                            title="Delete this squad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Members list pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-bold">RIDERS:</span>
                        {crew.members.map(m => (
                          <span 
                            key={m} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
                          >
                            <span>{m}</span>
                            <button
                              onClick={() => handleRemoveMember(crew.id, m)}
                              className="text-slate-500 hover:text-rose-400 cursor-pointer"
                              title="Remove member"
                            >
                              ✕
                            </button>
                          </span>
                        ))}

                        {addingMemberCrewId === crew.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={newMemberName}
                              onChange={e => setNewMemberName(e.target.value)}
                              placeholder="Name"
                              onKeyDown={e => e.key === 'Enter' && handleAddMemberToSavedCrew(crew.id)}
                              className="w-20 bg-slate-950 border border-cyan-400 text-white text-[10px] px-1 py-0.5 rounded focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleAddMemberToSavedCrew(crew.id)}
                              className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[9px] cursor-pointer"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setAddingMemberCrewId(null)}
                              className="text-slate-500 text-[10px] cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingMemberCrewId(crew.id);
                              setNewMemberName('');
                            }}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Add Rider</span>
                          </button>
                        )}
                      </div>

                      {/* Launch & Join Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            onCreateRoom(riderName, crew.code);
                            onClose();
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                        >
                          <Radio className="w-3 h-3" />
                          <span>Start Ride (Host)</span>
                        </button>

                        <button
                          onClick={() => {
                            onJoinRoom(crew.code, riderName);
                            onClose();
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Users className="w-3 h-3 text-cyan-400" />
                          <span>Join Squad</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: MAKE CREW (Create New Squad)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'create' && (
            <div className="space-y-3.5">
              <div className="text-xs text-slate-400">
                Create a squad preset with custom name and code. You can start it now or save it for upcoming rides.
              </div>

              <div className="space-y-3">
                {/* Squad Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Squad Name *</label>
                  <input
                    type="text"
                    maxLength={30}
                    value={createCrewName}
                    onChange={e => setCreateCrewName(e.target.value)}
                    placeholder='e.g. "Sunday Pune Express" or "Lavasa Dawn Patrol"'
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-sans text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Squad Room Code */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Room Code (4-10 characters)</span>
                    <button
                      type="button"
                      onClick={handleGenerateRandomCode}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Dices className="w-3 h-3" />
                      <span>Randomize</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={createCrewCode}
                    onChange={e => setCreateCrewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder='e.g. "SUNDAY" or auto-generated'
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Friends / Members List */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Invite Friends / Call signs (optional)</label>
                  <input
                    type="text"
                    value={createCrewMembers}
                    onChange={e => setCreateCrewMembers(e.target.value)}
                    placeholder="Separate with commas: Rahul, Sam, Maverick"
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-sans text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <div className="text-[10px] text-slate-500">
                    You can easily share the WhatsApp join link with these friends after creating the squad.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSaveAndLaunch(true)}
                    className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-98"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Create & Start Now</span>
                  </button>

                  <button
                    onClick={() => handleSaveAndLaunch(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Save to Squads</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: JOIN CREW (Enter Code, Rejoin)
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'join' && (
            <div className="space-y-3.5">
              <div className="text-xs text-slate-400">
                Enter the room code shared by your crew leader or friend to join their live radar session.
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Squad Room Code</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      maxLength={10}
                      value={joinCodeInput}
                      onChange={e => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && joinCodeInput.trim()) {
                          onJoinRoom(joinCodeInput.trim(), riderName);
                          onClose();
                        }
                      }}
                      placeholder="e.g. SUNDAY or CREW4921"
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm uppercase tracking-wider focus:outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (joinCodeInput.trim()) {
                          onJoinRoom(joinCodeInput.trim(), riderName);
                          onClose();
                        }
                      }}
                      disabled={!joinCodeInput.trim()}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-40 shadow-sm"
                    >
                      Join
                    </button>
                  </div>
                </div>

                {/* Preflight Callsign Check */}
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between">
                  <span className="text-slate-400">Joining Radar as:</span>
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: myColor }} />
                    <span>{riderName}</span>
                  </div>
                </div>

                {/* 1-Tap Rejoin Last Room */}
                {lastRoomCode && (
                  <div className="pt-1">
                    <button
                      onClick={() => {
                        onJoinRoom(lastRoomCode, riderName);
                        onClose();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rejoin Recent Squad</span>
                      </span>
                      <span className="font-heading font-black text-amber-200">{lastRoomCode}</span>
                    </button>
                  </div>
                )}

                {/* 1-Tap Quick Pick from Saved Squads */}
                {savedCrews.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Or 1-Tap Join Saved Squad:</span>
                      </span>
                      <span className="text-[10px] text-slate-500">{savedCrews.length} available</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedCrews.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            onJoinRoom(c.code, riderName);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-xs font-mono font-bold text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                          title={`Join squad "${c.name}" (${c.code})`}
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-cyan-400 font-bold">({c.code})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>Decentralized Peer-to-Peer Motorcycle Radar</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

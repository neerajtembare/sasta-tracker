import React, { useState, useEffect } from 'react';
import { AppTheme } from '../types';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
import { 
  X, 
  Users, 
  Radio, 
  Share2, 
  Copy, 
  Check, 
  AlertTriangle, 
  LogOut, 
  Shield, 
  Compass, 
  Sparkles,
  Wifi,
  Coffee,
  Navigation,
  Zap
} from 'lucide-react';

interface GroupRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  riderName: string;
  isHost: boolean;
  isConnected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  statusMessage: string;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  onCreateRoom: (name: string, customCode?: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  onLeaveRoom: () => void;
  onTriggerSos: () => void;
  onDismissSos: () => void;
  theme?: AppTheme;
}

export const GroupRideModal: React.FC<GroupRideModalProps> = ({
  isOpen,
  onClose,
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
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [inputName, setInputName] = useState(riderName || 'Rider');
  const [inputCode, setInputCode] = useState('');
  const [customRoomName, setCustomRoomName] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [lastCrewCode, setLastCrewCode] = useState<string>(() => {
    try {
      return localStorage.getItem('sasta_last_crew') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (riderName) setInputName(riderName);
  }, [riderName]);

  // Remember last room code
  useEffect(() => {
    if (isConnected && roomCode) {
      try {
        localStorage.setItem('sasta_last_crew', roomCode);
        setLastCrewCode(roomCode);
      } catch {}
    }
  }, [isConnected, roomCode]);

  // Check URL query on initial load for room code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInputCode(roomParam.toUpperCase());
      setTab('join');
    }
  }, []);

  if (!isOpen) return null;

  const handleShareWhatsApp = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    const text = `Hey! Join our motorcycle group ride on Sasta Tracker.\n\nRoom Code: *${roomCode}*\nLive Location Link: ${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white';
  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${modalBg}`}>
        
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <span>Group Ride Live Tracking</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  FREE P2P
                </span>
              </h3>
              <p className={`text-[11px] font-mono ${subTextColor}`}>
                Zero server costs • Direct phone-to-phone WebRTC location sharing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SOS Alert Banner (if active) */}
        {sosAlert && (
          <div className="p-3 bg-rose-500/20 border-b border-rose-500/40 text-rose-300 font-mono text-xs flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>{sosAlert.fromName}</strong> requested REGROUP at their location!
              </span>
            </div>
            <button
              onClick={onDismissSos}
              className="px-2 py-0.5 rounded bg-rose-500 text-slate-950 font-bold text-[10px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Active Connected Screen */}
          {isConnected ? (
            <div className="space-y-4">
              {/* Room Badge */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${cardBg}`}>
                <div>
                  <div className={`text-[10px] font-mono uppercase font-bold tracking-wider ${subTextColor}`}>
                    ACTIVE GROUP ROOM
                  </div>
                  <div className="text-xl font-heading font-black text-cyan-400 tracking-wider">
                    {roomCode}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Connected ({members.length + 1} riders in crew)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleShareWhatsApp}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="Invite via WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="Copy Invite Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <div className={`text-[10px] font-mono uppercase tracking-wider font-bold ${subTextColor}`}>
                  RIDERS IN YOUR CREW:
                </div>

                {/* You */}
                <div className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs ${cardBg}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#00f0ff] text-slate-950 font-black flex items-center justify-center text-xs shadow-[0_0_8px_#00f0ff]">
                      {inputName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{inputName}</span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px]">YOU</span>
                        {isHost && <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px]">LEADER</span>}
                      </div>
                      <div className={`text-[10px] ${subTextColor}`}>Transmitting GPS live</div>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold text-[11px]">Active ●</span>
                </div>

                {/* Connected Friends */}
                {members.map(m => {
                  const distFormatted = m.distanceFromMeMeters !== undefined
                    ? m.distanceFromMeMeters < 1000
                      ? `${Math.round(m.distanceFromMeMeters)} m away`
                      : `${(m.distanceFromMeMeters / 1000).toFixed(1)} km away`
                    : 'Locating...';

                  const isStopped = m.location && m.location.speedKmh < 2.0;

                  return (
                    <div key={m.riderId} className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs ${cardBg}`}>
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-7 h-7 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs shadow-sm"
                          style={{ backgroundColor: m.color || '#ffe600' }}
                        >
                          {m.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{m.name}</span>
                            {m.location && (
                              <span className="text-[10px] text-amber-400 font-bold">
                                {m.location.speedKmh.toFixed(0)} km/h
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] ${subTextColor} flex items-center gap-1.5`}>
                            <span>{distFormatted}</span>
                            {isStopped && (
                              <span className="text-amber-400 flex items-center gap-0.5">
                                <Coffee className="w-3 h-3" /> Stopped
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-emerald-400 font-bold">Connected</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: SOS & Leave */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={onTriggerSos}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Call Crew to Regroup</span>
                </button>

                <button
                  onClick={onLeaveRoom}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected / Join / Create Screen */
            <div className="space-y-4">
              {/* Rider Name Input */}
              <div className="font-mono text-xs space-y-1">
                <label className={`block font-bold uppercase tracking-wider text-[10px] ${subTextColor}`}>
                  Your Rider Name / Handle:
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={inputName}
                  onChange={e => {
                    setInputName(e.target.value);
                    try { localStorage.setItem('sasta_rider_name', e.target.value); } catch {}
                  }}
                  placeholder="e.g. Neeraj, GhostRider"
                  className="w-full py-2 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* 1-Tap Quick Rejoin Last Crew */}
              {lastCrewCode && !isConnected && (
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${cardBg}`}>
                  <div>
                    <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>Recent Crew</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white tracking-wider">
                      {lastCrewCode}
                    </div>
                  </div>
                  <button
                    onClick={() => onJoinRoom(lastCrewCode, inputName)}
                    disabled={connectionStatus === 'connecting'}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold font-mono text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <span>1-Tap Reconnect</span>
                  </button>
                </div>
              )}

              {/* Mode Tabs */}
              <div className="flex border rounded-xl p-1 font-mono text-xs font-bold bg-slate-900/60 border-slate-800">
                <button
                  onClick={() => setTab('create')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    tab === 'create' ? 'bg-cyan-500 text-slate-950 shadow-sm' : subTextColor
                  }`}
                >
                  Create Group Ride
                </button>
                <button
                  onClick={() => setTab('join')}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    tab === 'join' ? 'bg-cyan-500 text-slate-950 shadow-sm' : subTextColor
                  }`}
                >
                  Join with Code
                </button>
              </div>

              {/* Tab 1: Create */}
              {tab === 'create' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className={`p-3 rounded-xl border space-y-1 ${cardBg}`}>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span>Start a Private Crew Session</span>
                    </div>
                    <p className={`text-[11px] ${subTextColor}`}>
                      A secure room code will be created. Share it via WhatsApp with up to 4 friends to see each other's live location on the mountain map.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className={`block font-bold uppercase tracking-wider text-[10px] ${subTextColor}`}>
                      Crew Room Name <span className="text-slate-500">(Optional — leave blank for random)</span>:
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={customRoomName}
                      onChange={e => setCustomRoomName(e.target.value.toUpperCase())}
                      placeholder="e.g. SUNDAY, PUNE44"
                      className="w-full py-2 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono text-xs font-bold tracking-wider uppercase focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <button
                    onClick={() => onCreateRoom(inputName, customRoomName)}
                    disabled={connectionStatus === 'connecting'}
                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    <span>
                      {connectionStatus === 'connecting'
                        ? 'Creating Room...'
                        : customRoomName
                        ? `Start Crew "${customRoomName}"`
                        : 'Start Group Ride & Get Code'}
                    </span>
                  </button>
                </div>
              )}

              {/* Tab 2: Join */}
              {tab === 'join' && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className={`block font-bold uppercase tracking-wider text-[10px] ${subTextColor}`}>
                      Enter Group Room Code:
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value.toUpperCase())}
                      placeholder="e.g. RIDE4821"
                      className="w-full py-2.5 px-3 rounded-xl border bg-slate-900 border-slate-700 text-white font-mono font-bold text-sm tracking-wider uppercase focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <button
                    onClick={() => onJoinRoom(inputCode, inputName)}
                    disabled={!inputCode || connectionStatus === 'connecting'}
                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    <Users className="w-4 h-4" />
                    <span>{connectionStatus === 'connecting' ? 'Connecting to Crew...' : 'Join Group Ride'}</span>
                  </button>
                </div>
              )}

              {/* Status or error message */}
              {statusMessage && (
                <div className={`p-2.5 rounded-xl border text-xs font-mono text-center ${
                  connectionStatus === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                }`}>
                  {statusMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex items-center justify-between text-[11px] font-mono ${cardBg}`}>
          <span className={subTextColor}>100% Free • End-to-end P2P privacy</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-700 rounded-xl hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

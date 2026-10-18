import React, { useState, useEffect } from 'react';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { GroupMemberInfo, SosAlert, CrewNotification, RiderProfile, RIDER_COLORS, getRiderColor } from '../hooks/useGroupRide';
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
  Crosshair,
  UserCheck,
  Bike,
  Shield,
  Activity,
  Check,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { CrewLiveMap } from './CrewLiveMap';

interface CrewDashboardProps {
  roomCode: string;
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
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({
  roomCode,
  lastRoomCode = '',
  riderName,
  myColor = '#00f0ff',
  bikeModel = '',
  myLocation = null,
  isHost,
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
  onAddSquadFriend,
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
}) => {
  const isLight = theme === 'light';

  // Callsign & Profile Modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginNameInput, setLoginNameInput] = useState(riderName);
  const [loginBikeInput, setLoginBikeInput] = useState(bikeModel || '');
  const [loginColorInput, setLoginColorInput] = useState(myColor || '#00f0ff');

  // Add Friend to Squad Modal
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendBike, setNewFriendBike] = useState('');
  const [justAddedFriend, setJustAddedFriend] = useState<{ name: string; bike?: string; url: string } | null>(null);

  // Selected Rider for Map Focus
  const [focusedRiderId, setFocusedRiderId] = useState<string | null>(null);
  const [isConvoyDrawerExpanded, setIsConvoyDrawerExpanded] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

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
    const squad = roomCode || 'Sunday Morning Crew';
    const link = customUrl || (getFriendInviteUrl ? getFriendInviteUrl(friendName) : `${window.location.origin}${window.location.pathname}`);
    const apkLink = 'https://github.com/neerajtembare/sasta-tracker/releases/latest/download/throttlelog-debug.apk';
    const text = friendName
      ? `🏍️ Hey ${friendName}, join our Crew Radar "${squad}":\n👉 Web Radar: ${link}\n📥 Direct Android APK: ${apkLink}\nYour name is auto-configured—just tap and ride!`
      : `🏍️ Join our Crew Radar "${squad}":\n👉 Web Radar: ${link}\n📥 Direct Android APK: ${apkLink}\nLogged in riders are automatically visible!`;
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

  const handleAddFriendSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFriendName.trim()) return;
    const name = newFriendName.trim();
    const bike = newFriendBike.trim() || undefined;
    if (onAddSquadFriend) {
      onAddSquadFriend(name, bike);
    }
    const inviteUrl = getFriendInviteUrl 
      ? getFriendInviteUrl(name) 
      : `${window.location.origin}${window.location.pathname}?rider=${encodeURIComponent(name)}`;
    setJustAddedFriend({ name, bike, url: inviteUrl });
    setNewFriendName('');
    setNewFriendBike('');
    triggerHaptic(40);
  };

  const onlineCount = members.filter(m => m.isOnline !== false).length + 1;
  const totalRiders = members.length + 1;

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
        roomCode={roomCode || 'Sunday Morning Crew'}
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
        activeRoute={activeRoute}
      />

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FLOATING CONVOY ROSTER HUD
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-4 sm:right-4 z-20 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-slate-950/92 backdrop-blur-md border border-slate-700/80 shadow-2xl space-y-2">
            
            {/* Roster Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40" />
                <span className="font-heading font-black text-white text-xs uppercase tracking-wider">
                  {roomCode || 'Sunday Morning Crew'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {onlineCount} ACTIVE
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddFriendOpen(true)}
                  className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Add friend to this crew"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Friend</span>
                </button>

                <button
                  onClick={() => setIsConvoyDrawerExpanded(prev => !prev)}
                  className="text-slate-400 hover:text-white font-mono text-[10px] cursor-pointer"
                >
                  {isConvoyDrawerExpanded ? 'Hide' : 'Show Roster'}
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
                  className={`p-2 rounded-xl border flex items-center gap-2.5 shrink-0 cursor-pointer transition-all active:scale-95 min-w-[175px] ${
                    focusedRiderId === 'me'
                      ? 'bg-cyan-950/80 border-cyan-400 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                  }`}
                  title="Click to center map, or tap Edit to customize callsign"
                >
                  <div 
                    className="w-8 h-8 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs"
                    style={{ backgroundColor: myColor || '#00f0ff' }}
                  >
                    {riderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-1 font-mono text-xs font-bold text-white truncate">
                      <span className="truncate">{riderName}</span>
                      <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-bold shrink-0">YOU</span>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span className="truncate">{myLocation ? `${Math.round(myLocation.speedKmh)} km/h` : 'Online'}</span>
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

                {/* When alone on radar */}
                {members.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span>Radar active (100km range) • Waiting for nearby riders</span>
                  </div>
                )}

                {/* CREW FRIENDS CARDS */}
                {members.map(m => {
                  const isOnline = m.isOnline !== false;
                  const isStopped = m.location?.status === 'stopped' || (m.location?.speedKmh || 0) < 2.5;
                  const speedText = m.location ? `${Math.round(m.location.speedKmh)} km/h` : 'Active';
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
                      className={`p-2 rounded-xl border flex items-center gap-2.5 shrink-0 cursor-pointer transition-all active:scale-95 min-w-[170px] ${
                        focusedRiderId === m.riderId
                          ? 'bg-cyan-950/80 border-cyan-400 shadow-md shadow-cyan-950/50'
                          : isOnline
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-600'
                          : 'bg-slate-950/70 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow-xs"
                        style={{ backgroundColor: m.color || '#ffe600' }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white truncate">
                          <span className="truncate">{m.name}</span>
                          {distText && (
                            <span className="text-[9px] text-cyan-400 font-normal">({distText})</span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono flex items-center gap-1">
                          {isOnline ? (
                            <>
                              <span className={`w-1.5 h-1.5 rounded-full ${isStopped ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                              <span className={isStopped ? 'text-amber-300' : 'text-emerald-300'}>
                                {isStopped ? 'Stopped' : speedText}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              <span className="text-slate-400">Offline</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIDER CALLSIGN & RADAR PROFILE MODAL (Instant 1-Tap Broadcast)
      ───────────────────────────────────────────────────────────── */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-700/80 p-5 shadow-2xl font-mono space-y-3.5 pointer-events-auto max-h-[92vh] overflow-y-auto no-scrollbar">
            
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
                <span className="text-[9px] text-slate-500">Optional</span>
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

      {/* ─────────────────────────────────────────────────────────────
          ADD FRIEND TO CREW MODAL (With 1-Tap WhatsApp Invite)
      ───────────────────────────────────────────────────────────── */}
      {isAddFriendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-700/80 p-5 shadow-2xl font-mono space-y-4 pointer-events-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="font-heading font-black text-sm text-white uppercase tracking-wider">
                  Add Friend to Squad
                </span>
              </div>
              <button
                onClick={() => {
                  setIsAddFriendOpen(false);
                  setJustAddedFriend(null);
                }}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {justAddedFriend ? (
              <div className="space-y-3 animate-in fade-in">
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-4 h-4" />
                    <span>{justAddedFriend.name} added to Squad!</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Share this 1-tap link with <strong>{justAddedFriend.name}</strong>. When they tap it, their phone saves their identity in cookies and joins your radar automatically!
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => handleShareWhatsApp(justAddedFriend.url, justAddedFriend.name)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Send Invite on WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleCopyLink(justAddedFriend.url)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? '✓ Link Copied to Clipboard!' : 'Copy 1-Tap Invite Link'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setJustAddedFriend(null)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Add Another
                  </button>
                  <button
                    onClick={() => {
                      setIsAddFriendOpen(false);
                      setJustAddedFriend(null);
                    }}
                    className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddFriendSubmit} className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your friend's name. They will be added to your squad roster and automatically show up on your live map when they ride!
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={18}
                    value={newFriendName}
                    onChange={e => setNewFriendName(e.target.value)}
                    placeholder="Friend's Name (e.g. Vikram)"
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    maxLength={25}
                    value={newFriendBike}
                    onChange={e => setNewFriendBike(e.target.value)}
                    placeholder="Bike Model (optional, e.g. Royal Enfield 350)"
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddFriendOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newFriendName.trim()}
                    className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-40 transition-colors shadow-sm"
                  >
                    Add to Squad
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

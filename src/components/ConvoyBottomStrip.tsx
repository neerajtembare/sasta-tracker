import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  Shield,
  ShieldCheck,
  Crown,
  Compass,
  Megaphone,
  Flag,
  Clock,
  AlertTriangle,
  ArrowRight,
  Play,
  Square,
  Users,
  ChevronUp,
  ChevronDown,
  Navigation,
  X,
  Battery,
  Share2,
  Route as RouteIcon,
  Radio,
  Shuffle,
  Check,
} from 'lucide-react';
import { triggerHaptic, playWarningChime } from '../utils/audioChimes';
import { openActiveRouteNavigation } from '../utils/navigation';
import { GroupMemberInfo, SosAlert, DEFAULT_SQUAD_NAME } from '../hooks/useGroupRide';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { convertSpeed, convertDistance } from '../utils/units';
import { CALLOUT_PRESETS, CalloutPreset } from '../utils/callouts';
import { VoiceBlastPttButton } from './VoiceBlastPtt';

interface ConvoyBottomStripProps {
  members: GroupMemberInfo[];
  isConnected: boolean;
  isOnRadar?: boolean;
  onToggleRadar?: (enable?: boolean) => void;
  roomCode?: string;
  onJoinRoom?: (code: string) => void;
  myLocation: { lat: number; lon: number } | null;
  riderName: string;
  riderId?: string;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  recordedDistanceMeters?: number;
  sosAlert?: SosAlert | null;
  onTriggerSos: () => void;
  onCancelSos?: () => void;
  activeRoute?: RideAnalysis | null;
  onClearActiveRoute?: () => void;
  onSelectRider?: (riderId: string) => void;
  onShareWhatsApp?: () => void;
  onSendCallout?: (preset: CalloutPreset) => void;
  onSendVoiceBlast?: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  leaderId?: string | null;
  onSetSquadLeader?: (targetRiderId: string, targetName: string) => void;
  trailedRiderId?: string | null;
  onTrailRider?: (targetRiderId: string | null) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const ConvoyBottomStrip: React.FC<ConvoyBottomStripProps> = ({
  members,
  isConnected,
  isOnRadar = false,
  onToggleRadar,
  roomCode = DEFAULT_SQUAD_NAME,
  onJoinRoom,
  myLocation: _myLocation,
  riderName,
  riderId,
  isRecording = false,
  onToggleRecording,
  recordedDistanceMeters = 0,
  sosAlert = null,
  onTriggerSos,
  onCancelSos,
  activeRoute,
  onClearActiveRoute,
  onSelectRider,
  onShareWhatsApp,
  onSendCallout,
  onSendVoiceBlast,
  leaderId = null,
  onSetSquadLeader,
  trailedRiderId = null,
  onTrailRider,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCalloutOpen, setIsCalloutOpen] = useState(false);
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const sosTimerRef = useRef<any>(null);
  const [isConfirmStopOpen, setIsConfirmStopOpen] = useState(false);
  const [squadInput, setSquadInput] = useState(roomCode === DEFAULT_SQUAD_NAME ? '' : roomCode);

  useEffect(() => {
    setSquadInput(roomCode === DEFAULT_SQUAD_NAME ? '' : roomCode);
  }, [roomCode]);

  useEffect(() => {
    return () => {
      if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    };
  }, []);

  const handleStartSosCountdown = () => {
    if (sosCountdown !== null) {
      handleCancelSos();
      return;
    }
    triggerHaptic(50);
    playWarningChime();
    setSosCountdown(3);

    let remaining = 3;
    sosTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(sosTimerRef.current);
        sosTimerRef.current = null;
        setSosCountdown(null);
        onTriggerSos();
      } else {
        setSosCountdown(remaining);
        triggerHaptic(40);
      }
    }, 1000);
  };

  const handleCancelSos = () => {
    triggerHaptic(30);
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    setSosCountdown(null);
  };

  const handleRecordButtonClick = () => {
    triggerHaptic(40);
    if (isRecording) {
      setIsConfirmStopOpen(true);
    } else {
      onToggleRecording?.();
    }
  };

  const handleJoinCustomSquad = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = squadInput.trim().toUpperCase();
    if (!cleaned) return;
    triggerHaptic(30);
    onJoinRoom?.(cleaned);
    setIsExpanded(false);
  };

  const handleGenerateRandomCode = () => {
    triggerHaptic(25);
    const code = 'CREW-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    setSquadInput(code);
    onJoinRoom?.(code);
  };

  // Active online squad members (excluding self)
  const otherRiders = members;
  const onlineRiders = members.filter(m => m.isOnline);
  const isSelfLeader = Boolean(riderId && leaderId && riderId === leaderId);

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '—';
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    const km = meters / 1000;
    const converted = convertDistance(km);
    return `${converted.value.toFixed(1)} km`;
  };

  const formatSpeed = (speedKmh?: number) => {
    if (speedKmh === undefined || speedKmh === null || speedKmh < 2) return '0';
    const converted = convertSpeed(speedKmh);
    return `${converted.value.toFixed(0)}`;
  };

  return (
    <div
      style={{
        bottom: 'max(0.75rem, calc(var(--safe-bottom, 0px) + 0.25rem))',
        left: 'max(0.6rem, var(--safe-left, 0px))',
        right: 'max(0.6rem, var(--safe-right, 0px))',
      }}
      className="absolute z-40 pointer-events-none flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-xl space-y-1.5 font-sans">

        {/* Optional Active Route Bar */}
        {activeRoute && (
          <div className={`px-3 py-1.5 rounded-xl backdrop-blur-md border flex items-center justify-between text-xs shadow-lg transition-all ${
            isLight ? 'bg-white/95 border-cyan-400 text-slate-800' : 'bg-slate-950/92 border-cyan-500/50 text-white'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <RouteIcon className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span className="font-bold truncate">{activeRoute.name || 'Route'}</span>
              <span className={`font-bold font-mono telemetry-num shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                ({activeRoute.totalDistanceKm.toFixed(1)} km)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  openActiveRouteNavigation(activeRoute);
                }}
                className="h-7 px-2.5 rounded-lg bg-cyan-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <Navigation className="w-3 h-3" />
                <span>Google Maps</span>
              </button>
              {onClearActiveRoute && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClearActiveRoute();
                  }}
                  aria-label="Clear active route"
                  className={`p-1 rounded-lg cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Expanded Convoy Roster / Squad Code Panel */}
        {isExpanded && (
          <div className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl space-y-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-800' : 'bg-[#0d131a]/98 border-[#1e2a38] text-white'
          }`}>
            <div className={`flex items-center justify-between pb-1.5 border-b ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {isOnRadar ? (
                  <Users className={`w-4 h-4 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                ) : (
                  <Shield className={`w-4 h-4 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                )}
                <span className={`font-heading font-black text-xs uppercase tracking-wider truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {isOnRadar ? `Squad: ${roomCode} (${otherRiders.length + 1})` : 'Solo Private · Join Squad'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {onToggleRadar && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onToggleRadar(!isOnRadar);
                    }}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      isOnRadar
                        ? isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-emerald-500 border-emerald-400 text-slate-950 font-black'
                    }`}
                  >
                    {isOnRadar ? 'Go Solo Private' : 'Go Live'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  aria-label="Collapse panel"
                  className={`p-1 rounded-lg cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Private Squad Room Code Join / Create Box */}
            {onJoinRoom && (
              <form onSubmit={handleJoinCustomSquad} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={squadInput}
                  onChange={(e) => setSquadInput(e.target.value)}
                  placeholder="Enter Squad Code (e.g. SUNDAY)"
                  maxLength={24}
                  className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border text-xs font-mono focus:outline-hidden focus:border-cyan-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/50 border-slate-700 text-white'
                  }`}
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  title="Join or switch to encrypted private squad room"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Join</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateRandomCode}
                  aria-label="Generate new random squad code"
                  title="Generate new random squad room code"
                  className={`p-1.5 rounded-xl border cursor-pointer shrink-0 ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Follow Leader Pill */}
            {isOnRadar && (() => {
              const squadLead = otherRiders.find(r => r.isHost || r.riderId === leaderId);
              if (squadLead && squadLead.riderId !== trailedRiderId) {
                return (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(30);
                      onTrailRider?.(squadLead.riderId);
                    }}
                    className={`w-full py-1.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-sm ${
                      isLight
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5" />
                      <span>Follow Leader: {squadLead.name}</span>
                    </span>
                    <span className={`text-[10px] font-mono telemetry-num px-1.5 py-0.5 rounded flex items-center gap-1 ${
                      isLight ? 'text-amber-800 bg-amber-200/70' : 'text-amber-400 bg-amber-500/20'
                    }`}>
                      <span>{formatDistance(squadLead.distanceFromMeMeters)}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </button>
                );
              }
              return null;
            })()}

            {/* Rider cards (only shown when Crew Radar Live) */}
            {isOnRadar && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
                {/* Self card */}
                <div className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                  isLight ? 'bg-cyan-50/70 border-cyan-300' : 'bg-cyan-500/10 border-cyan-500/30'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className={`font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{riderName} (You)</span>
                  </div>
                  <span className={`text-[10px] font-bold flex items-center gap-1 ${isLight ? 'text-cyan-800' : 'text-cyan-300'}`}>
                    {isSelfLeader && <Crown className="w-3 h-3 text-amber-500" />}
                    <span>{isSelfLeader ? 'SQUAD LEAD' : 'RIDER'}</span>
                  </span>
                </div>

                {/* Other riders */}
                {otherRiders.length === 0 ? (
                  <div className={`text-center py-3 text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    No other riders on this squad yet. Share your code or WhatsApp link below.
                  </div>
                ) : (
                  otherRiders.map(rider => {
                    const isLeader = rider.isHost || rider.riderId === leaderId;
                    const isTrailed = trailedRiderId === rider.riderId;
                    return (
                      <div
                        key={rider.riderId}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          triggerHaptic(25);
                          onSelectRider?.(rider.riderId);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectRider?.(rider.riderId);
                          }
                        }}
                        className={`flex flex-col p-2.5 rounded-xl border text-xs cursor-pointer transition-all gap-1.5 ${
                          isTrailed
                            ? (isLight ? 'bg-amber-50 border-amber-400 shadow-md ring-1 ring-amber-400/40' : 'bg-amber-950/30 border-amber-500/70 shadow-md ring-1 ring-amber-500/40')
                            : rider.isOnline
                            ? isLight ? 'bg-slate-50 border-slate-200 hover:border-cyan-400' : 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/50'
                            : (isLight ? 'opacity-65 bg-slate-100 border-slate-200' : 'opacity-50 bg-black/30 border-slate-900')
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: rider.color || '#00f0ff' }}
                            />
                            <div className="truncate">
                              <div className={`font-bold truncate flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                <span>{rider.name}</span>
                                {rider.bikeModel && (
                                  <span className={`text-[10px] font-normal ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>({rider.bikeModel})</span>
                                )}
                                {isLeader && (
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black flex items-center gap-0.5 ${
                                    isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                  }`}>
                                    <Crown className="w-2.5 h-2.5" /> LEAD
                                  </span>
                                )}
                                {isTrailed && (
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black flex items-center gap-0.5 animate-pulse ${
                                    isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                                  }`}>
                                    <Compass className="w-2.5 h-2.5" /> TRAILING
                                  </span>
                                )}
                              </div>
                              <div className={`text-[10px] flex items-center gap-1.5 font-mono telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                <span>
                                  {rider.isOnline
                                    ? (rider.location && rider.location.speedKmh >= 2
                                        ? `${formatSpeed(rider.location.speedKmh)} km/h`
                                        : 'STOPPED')
                                    : 'Offline'}
                                </span>
                                {rider.location?.batteryPct !== undefined && (
                                  <span className="flex items-center gap-0.5 opacity-80">
                                    <Battery className="w-2.5 h-2.5" />
                                    <span>{rider.location.batteryPct}%</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`font-black font-mono telemetry-num text-xs ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                              {formatDistance(rider.distanceFromMeMeters)}
                            </div>
                            <div className={`text-[9px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {rider.distanceFromMeMeters !== undefined && rider.distanceFromMeMeters < 50 ? 'Nearby' : 'Distance'}
                            </div>
                          </div>
                        </div>

                        {/* Action strip */}
                        <div className={`flex items-center gap-2 pt-1 border-t ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic(25);
                              onTrailRider?.(isTrailed ? null : rider.riderId);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                              isTrailed
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                                : isLight
                                ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300'
                                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                            }`}
                          >
                            {isTrailed ? <X className="w-3 h-3" /> : <Compass className="w-3 h-3" />}
                            <span>{isTrailed ? 'Stop Trailing' : 'Trail Rider'}</span>
                          </button>

                          {!isLeader && onSetSquadLeader && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic(30);
                                onSetSquadLeader(rider.riderId, rider.name);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-300 hover:border-amber-400'
                                  : 'bg-slate-800 hover:bg-amber-950/60 text-slate-300 hover:text-amber-300 border-slate-700 hover:border-amber-500/50'
                              }`}
                              title="Designate as Squad Lead"
                            >
                              <Crown className="w-3 h-3" />
                              <span>Make Lead</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Quick WhatsApp Invite in expanded panel */}
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  onShareWhatsApp();
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite Squad via WhatsApp</span>
              </button>
            )}
          </div>
        )}

        {/* 1-Tap Quick Squad Callout Popover Sheet */}
        {isCalloutOpen && isOnRadar && (
          <div className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl space-y-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-800' : 'bg-[#0d131a]/98 border-[#1e2a38] text-white'
          }`}>
            <div className={`flex items-center justify-between pb-1 border-b ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
              <div className="flex items-center gap-1.5">
                <Megaphone className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                <span className={`font-heading font-black text-xs uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Quick Squad Callout
                </span>
              </div>
              <button
                type="button"
                aria-label="Close squad callouts"
                onClick={() => setIsCalloutOpen(false)}
                className={`p-1 rounded-lg cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CALLOUT_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    onSendCallout?.(preset);
                    setIsCalloutOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all active:scale-95 cursor-pointer ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-cyan-400'
                      : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 hover:border-cyan-400'
                  }`}
                >
                  <span className="text-xl shrink-0">{preset.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-bold text-xs truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{preset.label}</div>
                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{preset.spokenText}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Emergency SOS Countdown Banner */}
        {sosCountdown !== null && (
          <div className="p-3 rounded-2xl bg-rose-950/98 border-2 border-rose-500 text-white flex items-center justify-between shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-rose-400 fill-current animate-ping" />
              <div>
                <div className="font-heading font-black text-xs uppercase text-rose-300 telemetry-num">
                  Broadcasting SOS in {sosCountdown}s...
                </div>
                <div className="text-[10px] text-slate-300">Tap Cancel to abort</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelSos}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs border border-rose-400 cursor-pointer shadow-md active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Stop Recording Confirmation Sheet */}
        {isConfirmStopOpen && (
          <div className={`p-3.5 rounded-2xl border space-y-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-150 ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-900' : 'bg-[#0d131a]/98 border-slate-700 text-white'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                recordedDistanceMeters < 80
                  ? (isLight ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-amber-500/20 border-amber-500/40 text-amber-400')
                  : (isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400')
              }`}>
                {recordedDistanceMeters < 80 ? <Clock className="w-5 h-5" /> : <Flag className="w-5 h-5" />}
              </div>
              <div>
                <div className={`font-heading font-black text-xs uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {recordedDistanceMeters < 80 ? 'Stop Recording?' : 'Finish this ride session?'}
                </div>
                <div className={`text-[11px] font-mono telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {recordedDistanceMeters < 80
                    ? `Only ${Math.round(recordedDistanceMeters)} m tracked (needs 80 m to save).`
                    : `Recorded ${(recordedDistanceMeters / 1000).toFixed(2)} km so far.`}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmStopOpen(false)}
                className={`py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors border ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                Keep Riding
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsConfirmStopOpen(false);
                  onToggleRecording?.();
                }}
                className={`py-2.5 rounded-xl text-white font-black text-xs cursor-pointer shadow-md transition-colors ${
                  recordedDistanceMeters < 80
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
                }`}
              >
                {recordedDistanceMeters < 80 ? 'Discard & Stop' : 'Finish & Save'}
              </button>
            </div>
          </div>
        )}

        {/* MINIMALIST BOTTOM STRIP (Solo Private hides Crew-only clutter) */}
        <div className={`h-12 px-1.5 sm:px-3 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-1 sm:gap-2 shadow-2xl transition-all ${
          isLight
            ? 'bg-white/95 border-slate-300 text-slate-800'
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white'
        }`}>
          {/* Crew-only Left Controls (Hidden in Solo Private mode) */}
          {isOnRadar && (
            <>
              {Boolean(
                sosAlert && (
                  (riderId && sosAlert.fromId)
                    ? sosAlert.fromId === riderId
                    : Boolean(sosAlert.fromName && sosAlert.fromName.trim().toLowerCase() === (riderName || '').trim().toLowerCase())
                )
              ) ? (
                <button
                  id="btn-cancel-my-sos"
                  type="button"
                  onClick={() => {
                    triggerHaptic(50);
                    onCancelSos?.();
                  }}
                  title="Cancel your broadcasted Emergency SOS"
                  className="h-10 px-3 min-w-[62px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-lg cursor-pointer transition-all active:scale-95 shrink-0 animate-pulse"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SAFE</span>
                </button>
              ) : (
                <button
                  id="btn-emergency-sos"
                  type="button"
                  onClick={handleStartSosCountdown}
                  title={sosCountdown !== null ? 'Tap to cancel SOS countdown' : 'Broadcast Emergency SOS (3s countdown)'}
                  className={`h-10 px-2 sm:px-3 min-w-[44px] sm:min-w-[54px] rounded-xl text-white font-black text-xs flex items-center justify-center gap-1 shadow-lg cursor-pointer transition-all active:scale-95 shrink-0 ${
                    sosCountdown !== null
                      ? 'bg-rose-700 ring-2 ring-white animate-pulse'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current animate-pulse" />
                  <span>{sosCountdown !== null ? `${sosCountdown}s` : 'SOS'}</span>
                </button>
              )}

              {onSendCallout && (
                <button
                  id="btn-callout-toggle"
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    setIsCalloutOpen(prev => !prev);
                    if (isExpanded) setIsExpanded(false);
                  }}
                  aria-label="Open squad callouts"
                  title="Quick Callout to Crew"
                  className={`h-10 px-2 sm:px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 border ${
                    isCalloutOpen
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                      : isLight
                      ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ping</span>
                </button>
              )}

              {onSendVoiceBlast && (
                <div className="shrink-0">
                  <VoiceBlastPttButton
                    onSendVoiceBlast={onSendVoiceBlast}
                    compact
                    theme={theme}
                  />
                </div>
              )}
            </>
          )}

          {/* Center: Convoy Summary / Squad Code Sheet Trigger */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              setIsExpanded(prev => !prev);
            }}
            aria-label={isExpanded ? 'Collapse squad panel' : 'Expand squad or mode controls'}
            className={`flex-1 min-w-0 h-10 flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 rounded-xl cursor-pointer transition-colors ${
              isLight ? 'hover:bg-slate-200/70' : 'hover:bg-white/5'
            }`}
          >
            {isOnRadar && isConnected && onlineRiders.length > 0 ? (
              <div className="flex items-center gap-1.5 truncate text-xs font-bold">
                {[...onlineRiders].sort((a, b) => (a.distanceFromMeMeters ?? 999999) - (b.distanceFromMeMeters ?? 999999)).slice(0, 2).map((r, idx) => (
                  <span key={r.riderId} className="flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color || '#00f0ff' }} />
                    <span className="truncate">{r.name}:</span>
                    <span className={`font-mono telemetry-num font-black shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>{formatDistance(r.distanceFromMeMeters)}</span>
                    {r.distanceFromMeMeters !== undefined && r.distanceFromMeMeters > 1500 && (
                      <AlertTriangle className={`w-3 h-3 shrink-0 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                    )}
                    {idx < Math.min(onlineRiders.length - 1, 1) && <span className="opacity-40">•</span>}
                  </span>
                ))}
                {onlineRiders.length > 2 && (
                  <span className={`text-[10px] shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>+{onlineRiders.length - 2}</span>
                )}
              </div>
            ) : isOnRadar ? (
              <div className={`text-[11px] sm:text-xs tracking-tight flex items-center gap-1 whitespace-nowrap min-w-0 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <Radio className={`w-3.5 h-3.5 shrink-0 hidden sm:inline ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                <span className="font-bold font-mono telemetry-num truncate max-w-[100px] sm:max-w-[155px]">
                  {isRecording
                    ? `${(recordedDistanceMeters / 1000).toFixed(1)} km`
                    : (roomCode && roomCode !== DEFAULT_SQUAD_NAME ? `Crew · ${roomCode}` : 'Crew Mode')}
                </span>
              </div>
            ) : (
              <div className={`text-xs tracking-tight flex items-center gap-1.5 whitespace-nowrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                <Shield className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                <span className="font-bold font-mono telemetry-num">
                  {isRecording ? `Solo · ${(recordedDistanceMeters / 1000).toFixed(1)} km` : 'Solo Mode'}
                </span>
              </div>
            )}

            <ChevronUp className={`w-3.5 h-3.5 transition-transform shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'} ${isExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Right: Direct Record Toggle (Preserves active Solo/Crew mode) */}
          {onToggleRecording && (
            <button
              id="btn-convoy-record-toggle"
              type="button"
              onClick={handleRecordButtonClick}
              title={isRecording ? 'Stop & save ride track' : 'Start tracking GPS ride'}
              className={`h-10 px-2 sm:px-3 min-w-[52px] sm:min-w-[64px] rounded-xl font-mono text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-md transition-all active:scale-95 shrink-0 ${
                isRecording
                  ? isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>STOP</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>REC</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

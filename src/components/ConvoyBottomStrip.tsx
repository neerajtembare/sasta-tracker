import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Play, 
  Square, 
  Users, 
  ChevronUp, 
  ChevronDown, 
  Navigation, 
  X, 
  Battery, 
  Share2, 
  PhoneCall, 
  Route as RouteIcon,
  Radio
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { GroupMemberInfo } from '../hooks/useGroupRide';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { convertSpeed, convertDistance } from '../utils/units';

interface ConvoyBottomStripProps {
  members: GroupMemberInfo[];
  isConnected: boolean;
  roomCode?: string;
  myLocation: { lat: number; lon: number } | null;
  riderName: string;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  recordedDistanceMeters?: number;
  onTriggerSos: () => void;
  activeRoute?: RideAnalysis | null;
  onClearActiveRoute?: () => void;
  onOpenSquadDrawer?: () => void;
  onSelectRider?: (riderId: string) => void;
  onShareWhatsApp?: () => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const ConvoyBottomStrip: React.FC<ConvoyBottomStripProps> = ({
  members,
  isConnected,
  roomCode,
  myLocation,
  riderName,
  isRecording = false,
  onToggleRecording,
  recordedDistanceMeters = 0,
  onTriggerSos,
  activeRoute,
  onClearActiveRoute,
  onOpenSquadDrawer,
  onSelectRider,
  onShareWhatsApp,
  theme = 'dark',
  unitSystem = 'metric',
}) => {
  const isLight = theme === 'light';
  const [isExpanded, setIsExpanded] = useState(false);

  // Active online squad members (excluding self)
  const otherRiders = members;
  const onlineRiders = members.filter(m => m.isOnline);

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '—';
    if (meters < 1000) return `${meters.toFixed(0)}m`;
    const km = meters / 1000;
    const converted = convertDistance(km, unitSystem);
    return `${converted.value.toFixed(1)}${unitSystem === 'imperial' ? 'mi' : 'km'}`;
  };

  const formatSpeed = (speedKmh?: number) => {
    if (speedKmh === undefined || speedKmh === null || speedKmh < 2) return '0';
    const converted = convertSpeed(speedKmh, unitSystem);
    return `${converted.value.toFixed(0)}`;
  };

  return (
    <div 
      style={{ 
        bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.25rem))',
        left: 'max(0.6rem, env(safe-area-inset-left))',
        right: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      className="absolute z-30 pointer-events-none flex justify-center"
    >
      <div className="pointer-events-auto w-full max-w-xl space-y-1.5 font-mono">
        
        {/* Optional Active Route Bar (if GPX route is loaded) */}
        {activeRoute && (
          <div className={`px-3 py-1.5 rounded-xl backdrop-blur-md border flex items-center justify-between text-xs shadow-lg transition-all ${
            isLight ? 'bg-white/95 border-cyan-400 text-slate-800' : 'bg-slate-950/92 border-cyan-500/50 text-white'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <RouteIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-bold truncate">{activeRoute.name || 'Route'}</span>
              <span className="text-cyan-400 font-bold shrink-0">({activeRoute.totalDistanceKm.toFixed(1)} km)</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  if (activeRoute.points && activeRoute.points.length > 0) {
                    const last = activeRoute.points[activeRoute.points.length - 1];
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${last.lat},${last.lon}&travelmode=driving`;
                    window.open(url, '_blank');
                  }
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
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Expanded Convoy Roster Panel (When tapped open) */}
        {isExpanded && (
          <div className={`p-3 rounded-2xl backdrop-blur-xl border shadow-2xl space-y-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-800' : 'bg-[#0d131a]/98 border-[#1e2a38] text-white'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="font-heading font-black text-xs uppercase tracking-wider text-white">
                  Squad Convoy ({otherRiders.length + 1} Riders)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Rider cards */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
              {/* Self card */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-bold text-white truncate">{riderName} (You)</span>
                </div>
                <span className="text-[10px] text-cyan-300 font-bold">LEADER / YOU</span>
              </div>

              {/* Other riders */}
              {otherRiders.length === 0 ? (
                <div className="text-center py-3 text-[11px] text-slate-400">
                  No other riders on radar yet. Tap invite to share with your crew.
                </div>
              ) : (
                otherRiders.map(rider => (
                  <div
                    key={rider.riderId}
                    onClick={() => {
                      triggerHaptic(25);
                      onSelectRider?.(rider.riderId);
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      rider.isOnline 
                        ? isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800 hover:border-cyan-500/50'
                        : 'opacity-50 bg-black/30 border-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: rider.color || '#00f0ff' }} 
                      />
                      <div className="truncate">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span>{rider.name}</span>
                          {rider.bikeModel && (
                            <span className="text-[10px] text-slate-400 font-normal">({rider.bikeModel})</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{rider.isOnline ? `${formatSpeed(rider.location?.speedKmh)} ${unitSystem === 'imperial' ? 'mph' : 'km/h'}` : 'Offline'}</span>
                          {rider.location?.batteryPct !== undefined && (
                            <span className="flex items-center gap-0.5 opacity-75">
                              <Battery className="w-2.5 h-2.5" />
                              <span>{rider.location.batteryPct}%</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-cyan-400 text-xs">
                        {formatDistance(rider.distanceFromMeMeters)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        {rider.distanceFromMeMeters !== undefined && rider.distanceFromMeMeters < 50 ? 'Nearby' : 'Separation'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick WhatsApp Invite in expanded panel */}
            {onShareWhatsApp && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  onShareWhatsApp();
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Invite Friends via WhatsApp</span>
              </button>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MINIMALIST BOTTOM STRIP (DEFAULT 48px COLLAPSED VIEW)
        ───────────────────────────────────────────────────────────── */}
        <div className={`h-12 px-2 sm:px-3 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-2 shadow-2xl transition-all ${
          isLight
            ? 'bg-white/95 border-slate-300 text-slate-800'
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white'
        }`}>
          {/* Left: Emergency SOS Button (Glove-Friendly & Direct) */}
          <button
            id="btn-emergency-sos"
            type="button"
            onClick={() => {
              triggerHaptic(50);
              onTriggerSos();
            }}
            title="Broadcast emergency SOS to all squad riders"
            className="h-10 px-3.5 min-w-[58px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/60 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <ShieldAlert className="w-4 h-4 fill-current animate-pulse" />
            <span>SOS</span>
          </button>

          {/* Center: Glanceable Convoy Buddy Distances or Solo Tracker */}
          <div 
            onClick={() => {
              triggerHaptic(20);
              setIsExpanded(prev => !prev);
            }}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
          >
            {isConnected && onlineRiders.length > 0 ? (
              <div className="flex items-center gap-2 truncate text-xs font-bold">
                {onlineRiders.slice(0, 2).map((r, idx) => (
                  <span key={r.riderId} className="flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color || '#00f0ff' }} />
                    <span className="truncate">{r.name}:</span>
                    <span className="text-cyan-400 font-mono font-black shrink-0">{formatDistance(r.distanceFromMeMeters)}</span>
                    {idx < Math.min(onlineRiders.length - 1, 1) && <span className="opacity-40">•</span>}
                  </span>
                ))}
                {onlineRiders.length > 2 && (
                  <span className="text-[10px] text-slate-400 shrink-0">+{onlineRiders.length - 2} more</span>
                )}
              </div>
            ) : isConnected ? (
              <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="truncate">Squad #{roomCode} • Waiting for friends</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                <span className="truncate">
                  {isRecording 
                    ? `Recording • ${(recordedDistanceMeters / 1000).toFixed(1)} km`
                    : 'Solo Ride • Tap to expand'}
                </span>
              </div>
            )}

            <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>

          {/* Right: Glove-Friendly Ride Recording Button */}
          {onToggleRecording && (
            <button
              id="btn-convoy-record-toggle"
              type="button"
              onClick={() => {
                triggerHaptic(40);
                onToggleRecording();
              }}
              title={isRecording ? 'Stop & save ride track' : 'Start tracking GPS ride'}
              className={`h-10 px-3.5 min-w-[64px] rounded-xl font-mono text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 shrink-0 ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
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

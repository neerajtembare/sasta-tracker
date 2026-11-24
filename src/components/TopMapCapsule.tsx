import React from 'react';
import { Menu, Share2, Radio, Users, Power, Sparkles, Shield, ShieldOff, Volume2 } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface TopMapCapsuleProps {
  onOpenDrawer: () => void;
  onOpenProfile: () => void;
  isConnected: boolean;
  isOnRadar?: boolean;
  onToggleRadar?: () => void;
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  onlineCount: number;
  riderName: string;
  myColor: string;
  onShareInvite?: () => void;
  onTriggerRollCall?: () => void;
  onGoToCockpit?: () => void;
  onGoToDashboard?: () => void;
  onOpenGoogleMaps?: () => void;
  theme?: AppTheme;
  isVisible?: boolean;
}

export const TopMapCapsule: React.FC<TopMapCapsuleProps> = ({
  onOpenDrawer,
  onOpenProfile,
  isConnected,
  isOnRadar = true,
  onToggleRadar,
  isTrackingActive = true,
  onToggleTracking,
  onlineCount,
  riderName,
  myColor,
  onShareInvite,
  onTriggerRollCall,
  onGoToCockpit,
  onGoToDashboard,
  onOpenGoogleMaps,
  theme = 'dark',
  isVisible = true,
}) => {
  const isLight = theme === 'light';
  const initial = riderName && riderName.trim() ? riderName.trim().charAt(0).toUpperCase() : 'R';
  const isDefaultName = !riderName || riderName.toLowerCase() === 'rider';
  const isLive = isTrackingActive && isOnRadar;

  return (
    <header 
      style={{ 
        top: 'calc(env(safe-area-inset-top, 0px) + 0.55rem)',
        left: 'max(0.6rem, env(safe-area-inset-left))',
        right: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      className={`absolute z-30 pointer-events-none flex justify-center transition-all duration-300 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0'
      }`}
    >
      <div 
        className={`pointer-events-auto w-full max-w-xl h-11 px-2 sm:px-2.5 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-1.5 sm:gap-2 shadow-2xl transition-all font-mono ${
          isLight
            ? 'bg-white/95 border-slate-300/80 text-slate-800 shadow-slate-300/40'
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white shadow-black/80'
        }`}
      >
        {/* Left: Google Maps-style Hamburger Menu Button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            id="btn-app-drawer-toggle"
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenDrawer();
            }}
            title="Open Menu & System Settings"
            aria-label="Open Navigation Menu"
            className={`w-9 h-9 min-w-[36px] rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
              isLight
                ? 'hover:bg-slate-100 text-slate-700'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Quick Toggle: Cockpit HUD */}
          {onGoToCockpit && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onGoToCockpit();
              }}
              title="Switch to Cockpit Speedometer HUD"
              className={`h-8 px-2.5 rounded-xl border flex items-center gap-1 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-sm ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300'
              }`}
            >
              <span>🧭</span>
              <span className="hidden sm:inline text-[11px]">Cockpit</span>
            </button>
          )}

          {/* Quick Toggle: Solo Dashboard Home */}
          {onGoToDashboard && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onGoToDashboard();
              }}
              title="Return to Solo Dashboard Home"
              className={`h-8 px-2 rounded-xl border flex items-center gap-1 font-bold text-xs cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <span>🏠</span>
            </button>
          )}

          {/* Quick Destination: Google Maps Import */}
          {onOpenGoogleMaps && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onOpenGoogleMaps();
              }}
              title="Set Destination Target from Google Maps"
              className={`h-8 px-2 rounded-xl border flex items-center gap-1 font-bold text-xs cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300'
              }`}
            >
              <span>🎯</span>
            </button>
          )}
        </div>

        {/* Center: Live Radar vs Offline Privacy Mode */}
        {isLive ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center max-w-[200px] sm:max-w-xs">
            <div 
              onClick={() => {
                triggerHaptic(15);
                onOpenProfile();
              }}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 truncate ${
                isConnected
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : (isLight ? 'text-slate-600 bg-slate-100 border border-slate-200' : 'text-slate-400 bg-slate-800/40 border border-slate-800')
              }`}
              title={isConnected ? 'Connected to Global Crew Radar (Tap to manage profile)' : 'Connecting to Global Crew Radar...'}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-slate-400'
              }`} />
              <span className="truncate">
                {isConnected 
                  ? (onlineCount > 0 
                      ? `Live • ${onlineCount + 1} Riders` 
                      : 'Live • Solo')
                  : 'Connecting...'}
              </span>
            </div>

            {/* Quick 1-tap Stop Tracking & Go Private button (Desktop/Tablet) */}
            <button
              id="btn-quick-stop-tracking"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(30);
                if (onToggleTracking) {
                  onToggleTracking(false);
                } else if (onToggleRadar) {
                  onToggleRadar();
                }
              }}
              title="Stop GPS tracking & go private (Zero background activity)"
              aria-label="Stop Tracking and Go Private"
              className={`hidden md:flex h-7 px-2 rounded-lg border text-[10px] font-bold items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0 ${
                isLight 
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' 
                  : 'bg-rose-950/50 hover:bg-rose-900/80 border-rose-500/30 text-rose-300'
              }`}
            >
              <ShieldOff className="w-3 h-3 text-rose-500" />
              <span>Go Private</span>
            </button>
          </div>
        ) : isTrackingActive && !isOnRadar ? (
          <div
            onClick={() => {
              triggerHaptic(15);
              onOpenProfile();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold truncate max-w-[200px] sm:max-w-xs cursor-pointer transition-all active:scale-95 ${
              isLight ? 'bg-cyan-50 border border-cyan-300 text-cyan-800' : 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-300'
            }`}
            title="Solo Private Mode: GPS recording stays on your phone only (hidden from Crew Radar)"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] truncate">Solo Private</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(25);
                if (onToggleRadar) onToggleRadar();
                else if (onToggleTracking) onToggleTracking(true);
              }}
              className="px-1.5 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/40 font-black text-[9px] ml-0.5 shrink-0 cursor-pointer flex items-center gap-0.5"
              title="Enable Crew Radar visibility"
            >
              <Radio className="w-2.5 h-2.5" />
              <span className="hidden xs:inline">Crew</span>
            </button>
          </div>
        ) : (
          <div 
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold truncate max-w-[200px] sm:max-w-xs ${
              isLight ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
            }`}
            title="GPS tracking is paused • Tap Resume to restart GPS"
          >
            <Shield className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-[11px] truncate">GPS Paused</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(30);
                if (onToggleTracking) {
                  onToggleTracking(true);
                } else if (onToggleRadar) {
                  onToggleRadar();
                }
              }}
              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] ml-1 shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
            >
              <Radio className="w-3 h-3" />
              <span>Resume</span>
            </button>
          </div>
        )}

        {/* Right: WhatsApp Invite & Profile Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onShareInvite && (
            <button
              id="btn-quick-invite"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(25);
                onShareInvite();
              }}
              title="Invite friends via WhatsApp"
              className="hidden md:flex h-8 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Invite</span>
            </button>
          )}

          {onTriggerRollCall && (
            <button
              id="btn-quick-rollcall"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(25);
                onTriggerRollCall();
              }}
              title="Squad Audio Roll Call (Hear squad positions and battery)"
              className="hidden md:flex h-8 px-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 text-xs font-bold items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Roll Call</span>
            </button>
          )}

          {/* User Profile Avatar (Dedicated: Opens Rider Profile & Identity Modal) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenProfile();
            }}
            title={`Rider: ${riderName} (Tap to change Callsign & Bike)`}
            className="h-8 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-xs cursor-pointer transition-all active:scale-95 relative"
            style={{
              borderColor: myColor,
              backgroundColor: `${myColor}25`,
              color: isLight ? '#0f172a' : '#ffffff',
            }}
          >
            <span>{initial}</span>
            {isDefaultName && (
              <span className={`hidden sm:inline text-[10px] font-sans font-normal underline ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                Set Name
              </span>
            )}
            <span 
              className="w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 border border-black" 
              style={{ backgroundColor: myColor }} 
            />
          </button>
        </div>
      </div>
    </header>
  );
};

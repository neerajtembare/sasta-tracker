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
        top: 'max(0.6rem, env(safe-area-inset-top))',
        left: 'max(0.6rem, env(safe-area-inset-left))',
        right: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      className={`absolute z-30 pointer-events-none flex justify-center transition-all duration-300 ease-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'
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

        {/* Center: Live Radar vs Offline Privacy Mode */}
        {isLive ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div 
              onClick={() => {
                triggerHaptic(15);
                onOpenProfile();
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 truncate ${
                isConnected
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'text-slate-400 bg-slate-800/40 border border-slate-800'
              }`}
              title={isConnected ? 'Connected to Global Crew Radar (Tap to manage profile)' : 'Connecting to Global Crew Radar...'}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-slate-500'
              }`} />
              <span className="truncate">
                {isConnected 
                  ? (onlineCount > 0 
                      ? `Live • ${onlineCount + 1} Riders` 
                      : 'Live • Solo')
                  : 'Connecting...'}
              </span>
            </div>

            {/* Quick 1-tap Stop Tracking & Go Private button */}
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
              className="h-7 px-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <ShieldOff className="w-3 h-3 text-rose-400" />
              <span className="hidden sm:inline">Go Private</span>
            </button>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-950/60 border border-rose-500/40 text-rose-300 truncate"
            title="GPS tracking and background processes are completely stopped (Private Mode) • Tap Go Live to resume"
          >
            <Shield className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-[11px] truncate">Private (Tracking Off)</span>
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
              <span>Go Live</span>
            </button>
          </div>
        )}

        {/* Right: 1-Tap WhatsApp Invite & Profile Badge */}
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
              className="h-8 px-2 sm:px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Invite</span>
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
              className="h-8 px-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Roll Call</span>
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
              <span className="hidden xs:inline text-[10px] text-cyan-300 font-sans font-normal underline">
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

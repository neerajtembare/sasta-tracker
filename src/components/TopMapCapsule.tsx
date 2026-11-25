import React from 'react';
import { Menu, Radio, Shield } from 'lucide-react';
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
  theme = 'dark',
  isVisible = true,
}) => {
  const isLight = theme === 'light';
  const initial = riderName && riderName.trim() ? riderName.trim().charAt(0).toUpperCase() : 'R';
  const isDefaultName = !riderName || riderName.toLowerCase() === 'rider';
  const isLive = isTrackingActive && isOnRadar;

  const handleStatusToggle = () => {
    triggerHaptic(25);
    if (!isTrackingActive) {
      if (onToggleTracking) onToggleTracking(true);
      else if (onToggleRadar) onToggleRadar();
      return;
    }
    if (onToggleRadar) onToggleRadar();
    else if (onToggleTracking) onToggleTracking(!isOnRadar);
  };

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
        className={`pointer-events-auto w-full max-w-xl h-11 px-2 sm:px-2.5 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-2 shadow-2xl transition-all font-mono ${
          isLight
            ? 'bg-white/95 border-slate-300/80 text-slate-800 shadow-slate-300/40'
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white shadow-black/80'
        }`}
      >
        {/* 1. Hamburger Menu Button */}
        <button
          id="btn-app-drawer-toggle"
          type="button"
          onClick={() => {
            triggerHaptic(20);
            onOpenDrawer();
          }}
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
          className={`w-9 h-9 min-w-[36px] rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 ${
            isLight
              ? 'hover:bg-slate-100 text-slate-700'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* 2. Single Interactive Status Toggle Pill (Solo Private <-> Crew Live <-> GPS Paused) */}
        {isLive ? (
          <button
            id="btn-map-radar-toggle"
            type="button"
            onClick={handleStatusToggle}
            aria-label="Crew Live active. Tap to switch to Solo Private mode"
            title="Crew Live active — Tap to switch to Solo Private mode"
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 truncate max-w-[230px] border ${
              isConnected
                ? isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                : isLight
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 shrink-0 ${isConnected ? 'animate-pulse' : ''}`} />
            <span className="truncate">
              {isConnected
                ? onlineCount > 0
                  ? `Crew Live • ${onlineCount + 1}`
                  : 'Crew Live • Solo'
                : 'Crew Connecting...'}
            </span>
          </button>
        ) : isTrackingActive && !isOnRadar ? (
          <button
            id="btn-map-radar-toggle"
            type="button"
            onClick={handleStatusToggle}
            aria-label="Solo Private mode active. Tap to switch to Crew Live Radar"
            title="Solo Private mode — Tap to enable Crew Live Radar"
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 truncate max-w-[230px] border ${
              isLight
                ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800'
                : 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Shield className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
            <span className="truncate">Solo Private</span>
            <span
              className={`px-1.5 py-0.5 rounded-md font-black text-[9px] ml-0.5 shrink-0 border ${
                isLight
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              Crew
            </span>
          </button>
        ) : (
          <button
            id="btn-map-radar-toggle"
            type="button"
            onClick={handleStatusToggle}
            aria-label="GPS Paused. Tap to resume GPS tracking"
            title="GPS Paused — Tap to resume live tracking"
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 truncate max-w-[230px] border ${
              isLight
                ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800'
                : 'bg-rose-950/60 hover:bg-rose-900/60 border-rose-500/40 text-rose-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>GPS Paused</span>
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[9px] shrink-0">
              Resume
            </span>
          </button>
        )}

        {/* 3. Rider Profile / Settings Avatar */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic(20);
            onOpenProfile();
          }}
          aria-label="Open Rider Profile and Settings"
          title={`Rider: ${riderName} (Open Settings)`}
          className="h-8 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-xs cursor-pointer transition-all active:scale-95 relative shrink-0"
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
            className={`w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 border ${isLight ? 'border-white' : 'border-black'}`}
            style={{ backgroundColor: myColor }}
          />
        </button>
      </div>
    </header>
  );
};

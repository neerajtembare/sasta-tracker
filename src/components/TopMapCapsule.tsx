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
  onOpenProfile: _onOpenProfile,
  isConnected,
  isOnRadar = true,
  onToggleRadar,
  isTrackingActive = true,
  onToggleTracking,
  onlineCount,
  riderName: _riderName,
  myColor: _myColor,
  theme = 'dark',
  isVisible = true,
}) => {
  const isLight = theme === 'light';

  const selectMode = (targetCrew: boolean) => {
    triggerHaptic(25);
    if (!isTrackingActive && onToggleTracking) {
      onToggleTracking(true);
    }
    if (isOnRadar !== targetCrew) {
      if (onToggleRadar) onToggleRadar();
      else if (onToggleTracking) onToggleTracking(!isOnRadar);
    }
  };

  return (
    <header
      style={{
        top: 'calc(var(--safe-top, 0px) + 0.55rem)',
        left: 'max(0.6rem, var(--safe-left, 0px))',
        right: 'max(0.6rem, var(--safe-right, 0px))',
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

        {/* 2. Interactive Segmented Toggle Slider (Solo | Crew) */}
        <div
          id="btn-map-radar-toggle"
          role="group"
          aria-label="Ride mode selector"
          data-mode={isOnRadar ? 'crew' : 'solo'}
          className={`relative grid grid-cols-2 items-center p-0.5 rounded-xl border h-8 w-[178px] sm:w-[206px] shrink-0 select-none ${
            isLight
              ? 'bg-slate-100/95 border-slate-300/90'
              : 'bg-[#080c10]/90 border-slate-700/80'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[10px] shadow-sm transition-all duration-200 ease-out border ${
              isOnRadar ? 'translate-x-full' : 'translate-x-0'
            } ${
              !isTrackingActive
                ? isLight
                  ? 'bg-amber-100 border-amber-400'
                  : 'bg-amber-500/25 border-amber-500/60'
                : isOnRadar
                ? isConnected
                  ? isLight
                    ? 'bg-emerald-600 border-emerald-700'
                    : 'bg-emerald-500/25 border-emerald-400/60'
                  : isLight
                  ? 'bg-amber-500 border-amber-600'
                  : 'bg-amber-500/25 border-amber-400/60'
                : isLight
                ? 'bg-cyan-600 border-cyan-700'
                : 'bg-cyan-500/25 border-cyan-400/60'
            }`}
          />
          <button
            id="btn-mode-solo"
            type="button"
            aria-pressed={!isOnRadar}
            title="Solo Mode — Private GPS tracking"
            onClick={() => selectMode(false)}
            className={`relative z-10 h-full px-2 flex items-center justify-center gap-1 rounded-[10px] text-[11px] font-bold cursor-pointer transition-colors ${
              !isOnRadar
                ? !isTrackingActive
                  ? isLight ? 'text-amber-950' : 'text-amber-200'
                  : isLight ? 'text-white' : 'text-cyan-200'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3 h-3 shrink-0" />
            <span>Solo</span>
          </button>
          <button
            id="btn-mode-crew"
            type="button"
            aria-pressed={isOnRadar}
            title="Crew Mode — Live squad radar and callouts"
            onClick={() => selectMode(true)}
            className={`relative z-10 h-full px-2 flex items-center justify-center gap-1 rounded-[10px] text-[11px] font-bold cursor-pointer transition-colors ${
              isOnRadar
                ? !isTrackingActive
                  ? isLight ? 'text-amber-950' : 'text-amber-200'
                  : isConnected
                  ? isLight ? 'text-white' : 'text-emerald-200'
                  : isLight ? 'text-white' : 'text-amber-200'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className={`w-3 h-3 shrink-0 ${isOnRadar && isTrackingActive && isConnected ? 'animate-pulse' : ''}`} />
            <span className="truncate">
              {isOnRadar && isTrackingActive && isConnected && onlineCount > 0 ? `Crew · ${onlineCount + 1}` : 'Crew'}
            </span>
          </button>
        </div>

        {/* 3. Right Slot: GPS Off quick resume button when paused, else symmetry spacer */}
        {!isTrackingActive ? (
          <button
            id="btn-map-resume-gps"
            type="button"
            onClick={() => {
              triggerHaptic(25);
              if (onToggleTracking) onToggleTracking(true);
              else if (onToggleRadar) onToggleRadar();
            }}
            aria-label="GPS Paused. Tap to resume GPS tracking"
            title="GPS Paused — Tap to resume live tracking"
            className={`h-8 px-2 rounded-xl border text-[10px] font-bold shrink-0 cursor-pointer transition-all active:scale-95 ${
              isLight
                ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800'
                : 'bg-rose-950/60 hover:bg-rose-900/60 border-rose-500/40 text-rose-300'
            }`}
          >
            GPS Off
          </button>
        ) : (
          <div className="w-9 shrink-0" aria-hidden="true" />
        )}
      </div>
    </header>
  );
};

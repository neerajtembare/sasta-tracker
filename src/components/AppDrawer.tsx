import React from 'react';
import {
  X,
  Home,
  Gauge,
  BarChart3,
  Share2,
  ArrowRight,
  Volume2,
  Settings,
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { CURRENT_APP_VERSION } from '../utils/appUpdater';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  onShareWhatsApp: () => void;
  onOpenGarage: () => void;
  onOpenCockpit: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: () => void;
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  onTriggerRollCall?: () => void;
  onOpenSoloRide?: () => void;
  onOpenDashboard?: () => void;
  onOpenSettings?: () => void;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  theme,
  riderName,
  bikeModel = '',
  myColor,
  onShareWhatsApp,
  onOpenGarage,
  onOpenCockpit,
  isOnRadar = false,
  isTrackingActive = true,
  onTriggerRollCall,
  onOpenDashboard,
  onOpenSettings,
}) => {
  const isLight = theme === 'light';
  if (!isOpen) return null;

  const isLiveOnCrew = isTrackingActive && isOnRadar;

  return (
    <div
      className="fixed inset-0 z-[8000] flex animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel (Left slide-over — Riding Map Quick Navigation & Visibility) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-xs sm:max-w-sm h-full flex flex-col shadow-2xl transition-all font-sans overflow-y-auto no-scrollbar ${
          isLight
            ? 'bg-white border-r border-slate-200 text-slate-800'
            : 'bg-[#0b1016] border-r border-[#1e2a38] text-white'
        }`}
        style={{
          paddingTop: 'max(0.75rem, var(--safe-top, 0px))',
          paddingBottom: 'max(0.75rem, var(--safe-bottom, 0px))',
          paddingLeft: 'max(0.75rem, var(--safe-left, 0px))',
          paddingRight: 'max(0.5rem, var(--safe-right, 0px))',
        }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2.5 border-b shrink-0 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl border flex items-center justify-center font-black text-sm shrink-0"
              style={{
                borderColor: myColor,
                backgroundColor: `${myColor}25`,
                color: isLight ? '#0f172a' : '#ffffff',
              }}
            >
              {riderName ? riderName.slice(0, 1).toUpperCase() : 'R'}
            </div>
            <div className="min-w-0">
              <div className={`font-heading font-black text-sm truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {riderName}
              </div>
              <div className={`text-[11px] truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {bikeModel || 'Map Quick Navigation'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation drawer"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Focused During-Ride Navigation (Mode & tile controls stay on Map bar; full config in Settings) */}
        <div className="flex-1 px-3 py-3 space-y-3.5 text-xs">
          {/* 1. Crew Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                onShareWhatsApp();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>Invite Squad via WhatsApp</span>
            </button>

            {isLiveOnCrew && onTriggerRollCall && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  onClose();
                  onTriggerRollCall();
                }}
                className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                  isLight ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-900' : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300'
                }`}
              >
                <Volume2 className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                <span>Squad Audio Roll Call</span>
              </button>
            )}
          </div>

          {/* 2. Quick Navigation */}
          <div className="space-y-1.5">
            {onOpenDashboard && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onClose();
                  onOpenDashboard();
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                  isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38] text-white'
                }`}
              >
                <span className="font-bold text-xs flex items-center gap-2">
                  <Home className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                  <span>Home Dashboard</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
                onOpenCockpit();
              }}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38] text-white'
              }`}
            >
              <span className="font-bold text-xs flex items-center gap-2">
                <Gauge className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                <span>Cockpit HUD</span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
                onOpenGarage();
              }}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38] text-white'
              }`}
            >
              <span className="font-bold text-xs flex items-center gap-2">
                <BarChart3 className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                <span>Saved Rides &amp; Garage</span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* 4. Full App Settings Hub */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
                onOpenSettings();
              }}
              className={`w-full p-3 rounded-2xl border font-bold text-xs flex items-center justify-between cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                <div className="text-left">
                  <div className="font-bold">Settings</div>
                  <div className={`text-[10px] font-normal ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Theme, Mount, Offline Maps, Safety &amp; APK</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2 border-t text-[10px] flex items-center justify-between shrink-0 ${
          isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800/80 text-slate-400'
        }`}>
          <span>ThrottleLog v{CURRENT_APP_VERSION}</span>
          <span>km/h · km · m</span>
        </div>
      </div>
    </div>
  );
};

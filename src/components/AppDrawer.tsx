import React from 'react';
import {
  X,
  FolderArchive,
  Radio,
  Share2,
  ArrowRight,
  Compass,
  Shield,
  Volume2,
  Settings,
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, UnitSystem } from '../types';
import { CURRENT_APP_VERSION } from '../utils/appUpdater';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  onToggleTheme?: () => void;
  unitSystem?: UnitSystem;
  onToggleUnitSystem?: () => void;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  onUpdateProfile?: (name: string, bike: string, color: string) => void;
  onShareWhatsApp: () => void;
  mapLayer: 'streets' | 'satellite' | 'dark';
  onChangeMapLayer: (layer: 'streets' | 'satellite' | 'dark') => void;
  onOpenGarage: () => void;
  onOpenCockpit: () => void;
  onOpenDownloadApp?: () => void;
  onOpenFaq?: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: () => void;
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  orientationMode?: 'north' | 'course';
  onToggleOrientation?: () => void;
  onTriggerRollCall?: () => void;
  onOpenPermissionsModal?: () => void;
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
  mapLayer,
  onChangeMapLayer,
  onOpenGarage,
  onOpenCockpit,
  isOnRadar = false,
  onToggleRadar,
  isTrackingActive = true,
  onToggleTracking,
  orientationMode = 'course',
  onToggleOrientation,
  onTriggerRollCall,
  onOpenSoloRide,
  onOpenDashboard,
  onOpenSettings,
}) => {
  const isLight = theme === 'light';
  if (!isOpen) return null;

  const isLiveOnCrew = isTrackingActive && isOnRadar;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel (Left slide-over — Riding Map & Convoy Quick Menu) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-xs sm:max-w-sm h-full flex flex-col shadow-2xl transition-all font-mono overflow-y-auto no-scrollbar ${
          isLight
            ? 'bg-white border-r border-slate-200 text-slate-800'
            : 'bg-[#0b1016] border-r border-[#1e2a38] text-white'
        }`}
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
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
              <div className="text-[10px] text-slate-400 truncate">
                {bikeModel || 'Solo & Crew Controls'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Focused During-Ride Actions */}
        <div className="flex-1 px-3 py-3 space-y-3.5 text-xs">
          {/* 1. Solo Private vs Crew Radar Mode */}
          <div className={`p-3 rounded-2xl border space-y-2.5 ${
            isLiveOnCrew
              ? (isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/20 border-emerald-500/30')
              : (isLight ? 'bg-cyan-50 border-cyan-200' : 'bg-cyan-950/20 border-cyan-500/30')
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ride Visibility</span>
              </span>
              <span className={`text-[10px] font-black ${
                isLiveOnCrew ? 'text-emerald-500' : 'text-cyan-400'
              }`}>
                {isLiveOnCrew ? 'CREW RADAR LIVE' : 'SOLO PRIVATE'}
              </span>
            </div>

            <p className={`text-[11px] font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {isLiveOnCrew
                ? 'Sharing live GPS & viewing squad members on map.'
                : 'Your location stays 100% private on this phone during solo rides.'}
            </p>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                if (!isTrackingActive && onToggleTracking) {
                  onToggleTracking(true);
                } else if (onToggleRadar) {
                  onToggleRadar();
                } else if (onToggleTracking) {
                  onToggleTracking();
                }
              }}
              className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                isLiveOnCrew
                  ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isLiveOnCrew ? 'Switch to Solo Private (Hide Dot)' : 'Go Live on Crew Radar'}</span>
            </button>
          </div>

          {/* 2. Quick Map Style & Heading Orientation */}
          <div className={`p-3 rounded-2xl border space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <span className={`text-[10px] uppercase tracking-wider font-bold block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Map Style
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['dark', 'streets', 'satellite'] as const).map(layer => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onChangeMapLayer(layer);
                  }}
                  className={`p-2 rounded-xl border text-center font-bold text-[11px] capitalize transition-all cursor-pointer ${
                    mapLayer === layer
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                      : isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-black/40 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>

            {onToggleOrientation && (
              <div className={`pt-2 border-t flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                    Orientation
                  </span>
                  <span className={`text-[11px] font-sans ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {orientationMode === 'course' ? 'Heading-Up' : 'North-Up'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onToggleOrientation();
                  }}
                  className={`px-2.5 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1 cursor-pointer ${
                    isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-cyan-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Flip</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Crew Actions (only emphasized when Crew Live, plus quick invite) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(25);
                onShareWhatsApp();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
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
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Squad Audio Roll Call</span>
              </button>
            )}
          </div>

          {/* 4. Quick Navigation */}
          <div className="space-y-1.5">
            {onOpenSoloRide && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  onClose();
                  onOpenSoloRide();
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                  isLight ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-900' : 'bg-cyan-950/35 hover:bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                }`}
              >
                <span className="font-bold text-xs flex items-center gap-2">
                  <span>🏍️</span>
                  <span>Start Solo Ride</span>
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

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
                  <span>🏠</span>
                  <span>Solo Dashboard</span>
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
                <Radio className="w-4 h-4 text-emerald-400" />
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
                <FolderArchive className="w-4 h-4 text-sky-400" />
                <span>Saved Rides & Garage</span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* 5. Full App Settings Hub */}
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
                <Settings className="w-4 h-4 text-cyan-400" />
                <div className="text-left">
                  <div className="font-bold">Settings & Offline Maps</div>
                  <div className="text-[10px] font-sans text-slate-400">Theme, Bike Odo, Crash SOS, APK</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 py-2 border-t text-[10px] flex items-center justify-between shrink-0 ${
          isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
        }`}>
          <span>ThrottleLog • v{CURRENT_APP_VERSION}</span>
          <span>KM/H Metric</span>
        </div>
      </div>
    </div>
  );
};

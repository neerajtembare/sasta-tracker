import React from 'react';
import {
  Bike,
  Radio,
  HelpCircle,
  FolderArchive,
  Upload,
  Home,
  Users,
  Settings,
} from 'lucide-react';
import { AppTheme } from '../types';

interface NavbarProps {
  currentTab: 'home' | 'analysis' | 'cockpit' | 'crew' | 'faq';
  setCurrentTab: (tab: 'home' | 'analysis' | 'cockpit' | 'crew' | 'faq') => void;
  onUploadClick: () => void;
  groupRideConnected?: boolean;
  onHomeClick?: () => void;
  isRecordingLive: boolean;
  hasActiveRide: boolean;
  theme: AppTheme;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onUploadClick,
  groupRideConnected,
  onHomeClick,
  isRecordingLive,
  hasActiveRide,
  theme,
  onOpenSettings,
}) => {
  const isLight = theme === 'light';

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className={`sticky top-0 z-40 navbar-landscape-offset landscape-compact-hide backdrop-blur-md border-b transition-colors ${
        isLight
          ? 'bg-white/95 border-slate-200 shadow-sm'
          : 'bg-[#0d131a]/95 border-[#1e2a38]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 h-11 sm:h-12 flex items-center justify-between gap-2">
        {/* Brand identity */}
        <button
          id="btn-nav-home"
          type="button"
          onClick={onHomeClick}
          title="Return to Dashboard"
          aria-label="Return to ThrottleLog Home Dashboard"
          className="flex items-center gap-1.5 cursor-pointer shrink-0 text-left bg-transparent border-0 p-0 focus:outline-hidden rounded-lg"
        >
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 border rounded-lg flex items-center justify-center shadow-xs ${
              isLight
                ? 'bg-slate-100 border-sky-500/40 text-sky-700'
                : 'bg-[#131b24] border-sky-500/40 text-sky-400'
            }`}
          >
            <Bike className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`font-heading font-black tracking-tight text-xs sm:text-base ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            >
              THROTTLE<span className={isLight ? 'text-sky-600' : 'text-sky-400'}>LOG</span>
            </span>
          </div>
        </button>

        {/* Desktop & Tablet Navigation Mode Switcher */}
        <div
          className={`hidden md:flex landscape-compact-hide items-center gap-1 p-0.5 sm:p-1 border rounded-lg transition-colors ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <button
            id="tab-btn-home"
            onClick={() => setCurrentTab('home')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all relative cursor-pointer ${
              currentTab === 'home'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-cyan-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-cyan-400 hover:bg-[#1a2530]'
            }`}
            title="Solo Dashboard & Motorcycle Odometer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            id="tab-btn-crew"
            onClick={() => setCurrentTab('crew')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all relative cursor-pointer ${
              currentTab === 'crew'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-cyan-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-cyan-400 hover:bg-[#1a2530]'
            }`}
            title="Live Map & Optional Crew Radar"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Map</span>
            {groupRideConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
          </button>

          <button
            id="tab-btn-cockpit"
            onClick={() => setCurrentTab('cockpit')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all relative cursor-pointer ${
              currentTab === 'cockpit'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-emerald-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-emerald-400 hover:bg-[#1a2530]'
            }`}
            title="Live Handlebar GPS Cockpit"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Cockpit</span>
            {isRecordingLive && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
            )}
          </button>

          <button
            id="tab-btn-analysis"
            onClick={() => setCurrentTab('analysis')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              currentTab === 'analysis'
                ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-sky-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-sky-400 hover:bg-[#1a2530]'
            }`}
            title="Saved Rides & Telemetry Analysis"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Rides</span>
            {hasActiveRide && (
              <span className={`w-1.5 h-1.5 rounded-full ${currentTab === 'analysis' ? (isLight ? 'bg-white' : 'bg-slate-950') : 'bg-emerald-400'}`} />
            )}
          </button>

          <button
            id="tab-btn-faq"
            onClick={() => setCurrentTab('faq')}
            className={`hidden lg:flex px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-md items-center gap-1.5 transition-all cursor-pointer ${
              currentTab === 'faq'
                ? isLight
                  ? 'bg-slate-800 text-white font-black'
                  : 'bg-white text-slate-950 font-black'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-white hover:bg-[#1a2530]'
            }`}
            title="Help, GPS Accuracy & Tips"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help</span>
          </button>
        </div>

        {/* Right Quick Actions: Upload (Desktop) + App Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="btn-upload-gpx"
            onClick={onUploadClick}
            title="Import GPX Track"
            className="hidden sm:flex landscape-compact-hide items-center gap-1 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import GPX</span>
          </button>

          {onOpenSettings && (
            <button
              id="btn-open-settings"
              type="button"
              onClick={onOpenSettings}
              title="App Settings (Theme, Profile, Safety, Maps, APK)"
              aria-label="Open App Settings"
              className={`px-2.5 py-1.5 rounded-xl border font-sans font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-slate-200'
              }`}
            >
              <Settings className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

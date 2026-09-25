import React from 'react';
import { 
  Gauge, 
  Upload, 
  Radio, 
  HelpCircle,
  FolderArchive,
  Download,
  Sun,
  Moon
} from 'lucide-react';
import { AppTheme, UnitSystem } from '../types';

interface NavbarProps {
  currentTab: 'home' | 'analysis' | 'cockpit' | 'faq';
  setCurrentTab: (tab: 'home' | 'analysis' | 'cockpit' | 'faq') => void;
  onLoadSample: () => void;
  onUploadClick: () => void;
  onOpenGarage: () => void;
  onExportGpx: () => void;
  onHomeClick?: () => void;
  isRecordingLive: boolean;
  rideName: string;
  theme: AppTheme;
  onToggleTheme: () => void;
  unitSystem?: UnitSystem;
  onToggleUnitSystem?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onLoadSample,
  onUploadClick,
  onOpenGarage,
  onExportGpx,
  onHomeClick,
  isRecordingLive,
  rideName,
  theme,
  onToggleTheme,
  unitSystem = 'metric',
  onToggleUnitSystem,
}) => {
  const isLight = theme === 'light';

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${
        isLight
          ? 'bg-white/95 border-slate-200 shadow-sm'
          : 'bg-[#0d131a]/95 border-[#1e2a38]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Brand identity */}
        <div 
          onClick={onHomeClick}
          title="Return to Home / Upload"
          className="flex items-center gap-2 sm:gap-3 cursor-pointer shrink-0"
        >
          <div
            className={`w-8 h-8 sm:w-9 sm:h-9 border rounded-lg flex items-center justify-center text-sm sm:text-base shadow-sm ${
              isLight
                ? 'bg-slate-100 border-sky-500/40 text-slate-800'
                : 'bg-[#131b24] border-sky-500/40 text-white'
            }`}
          >
            🏍️
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-heading font-black tracking-tight text-sm sm:text-lg ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                SASTA <span className="text-sky-500">TRACKER</span>
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold bg-sky-500/15 text-sky-500 border border-sky-500/30 rounded uppercase tracking-wider">
                FREE
              </span>
            </div>
            <p
              className={`text-[10px] sm:text-[11px] font-mono truncate max-w-[120px] sm:max-w-xs ${
                isLight ? 'text-slate-500' : 'text-[#8f9ca8]'
              }`}
            >
              {rideName}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Mode Switcher (Hidden on mobile & small tablets since they have bottom nav) */}
        <div
          className={`hidden md:flex items-center gap-1 p-1 border rounded-lg transition-colors ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <button
            id="tab-btn-analysis"
            onClick={() => setCurrentTab('analysis')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              currentTab === 'analysis'
                ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-sky-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-sky-400 hover:bg-[#1a2530]'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Ride Stats</span>
          </button>

          <button
            id="tab-btn-cockpit"
            onClick={() => setCurrentTab('cockpit')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all relative cursor-pointer ${
              currentTab === 'cockpit'
                ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                : isLight
                ? 'text-slate-600 hover:text-emerald-600 hover:bg-slate-200/70'
                : 'text-[#8f9ca8] hover:text-emerald-400 hover:bg-[#1a2530]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Record Ride</span>
            {isRecordingLive && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            id="tab-btn-faq"
            onClick={() => setCurrentTab('faq')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
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
            <span>Help Guide</span>
          </button>
        </div>

        {/* Quick action buttons & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Unit System Toggle (KM/H <-> MPH) */}
          {onToggleUnitSystem && (
            <button
              id="btn-toggle-units"
              onClick={onToggleUnitSystem}
              title={`Active Units: ${unitSystem === 'imperial' ? 'Imperial (mph, mi, ft)' : 'Metric (km/h, km, m)'}. Click to switch.`}
              className={`px-2 py-1.5 rounded-lg border font-mono font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-slate-200'
              }`}
            >
              <span className="text-[10px] text-slate-400 font-normal">UNITS:</span>
              <span className={`font-black ${unitSystem === 'imperial' ? 'text-amber-400' : 'text-sky-400'}`}>
                {unitSystem === 'imperial' ? 'MPH' : 'KM/H'}
              </span>
            </button>
          )}

          {/* Global Light/Dark Theme Switcher */}
          <button
            id="btn-toggle-theme"
            onClick={onToggleTheme}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to High-Contrast Light Mode'}
            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-amber-400'
            }`}
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            id="btn-open-garage"
            onClick={onOpenGarage}
            title="Open Saved Rides"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] hover:border-sky-400 text-sky-400'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>My Rides</span>
          </button>

          <button
            id="btn-export-gpx"
            onClick={onExportGpx}
            title="Download Clean GPX File"
            className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-emerald-700'
                : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] hover:border-emerald-400 text-emerald-400'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export GPX</span>
          </button>

          <button
            id="btn-upload-gpx"
            onClick={onUploadClick}
            title="Upload GPX File"
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md cursor-pointer font-sans shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload GPX</span>
          </button>
        </div>
      </div>
    </header>
  );
};

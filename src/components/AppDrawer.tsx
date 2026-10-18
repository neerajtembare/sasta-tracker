import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Map as MapIcon, 
  Layers, 
  FolderArchive, 
  Radio, 
  Smartphone, 
  Sun, 
  Moon, 
  HelpCircle, 
  Share2, 
  Plus, 
  LogOut, 
  Check, 
  Copy, 
  ArrowRight,
  Bike,
  Sparkles,
  Gauge,
  BatteryCharging,
  Power,
  Compass
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, UnitSystem } from '../types';
import { checkBatteryOptimizationStatus, requestBatteryOptimizationExemption } from '../utils/nativeKeepAlive';

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  unitSystem: UnitSystem;
  onToggleUnitSystem: () => void;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  onUpdateProfile: (name: string, bike: string, color: string) => void;
  onShareWhatsApp: () => void;
  mapLayer: 'streets' | 'satellite' | 'dark';
  onChangeMapLayer: (layer: 'streets' | 'satellite' | 'dark') => void;
  onOpenGarage: () => void;
  onOpenCockpit: () => void;
  onOpenDownloadApp: () => void;
  onOpenFaq?: () => void;
  isOnRadar?: boolean;
  onToggleRadar?: () => void;
  orientationMode?: 'north' | 'course';
  onToggleOrientation?: () => void;
}

const COLOR_OPTIONS = [
  '#00f0ff', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#e2e8f0', // White
];

export const AppDrawer: React.FC<AppDrawerProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  unitSystem,
  onToggleUnitSystem,
  riderName,
  bikeModel = '',
  myColor,
  onUpdateProfile,
  onShareWhatsApp,
  mapLayer,
  onChangeMapLayer,
  onOpenGarage,
  onOpenCockpit,
  onOpenDownloadApp,
  onOpenFaq,
  isOnRadar = true,
  onToggleRadar,
  orientationMode = 'course',
  onToggleOrientation,
}) => {
  const isLight = theme === 'light';

  // Profile Form State
  const [nameInput, setNameInput] = useState(riderName);
  const [bikeInput, setBikeInput] = useState(bikeModel);
  const [selectedColor, setSelectedColor] = useState(myColor);
  const [isProfileEditing, setIsProfileEditing] = useState(false);

  // Android Background / Pocket Ride Battery Optimization Status
  const [isBatteryIgnored, setIsBatteryIgnored] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setNameInput(riderName);
      setBikeInput(bikeModel);
      setSelectedColor(myColor);
      checkBatteryOptimizationStatus().then(ignored => {
        setIsBatteryIgnored(ignored);
      });
    }
  }, [isOpen, riderName, bikeModel, myColor]);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(30);
    onUpdateProfile(nameInput.trim() || 'Rider', bikeInput.trim(), selectedColor);
    setIsProfileEditing(false);
  };

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

      {/* Drawer Panel (Left slide-over) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-sm h-full flex flex-col shadow-2xl transition-all font-mono overflow-y-auto no-scrollbar ${
          isLight
            ? 'bg-white border-r border-slate-200 text-slate-800'
            : 'bg-[#0b1016] border-r border-[#1e2a38] text-white'
        }`}
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-sm">
              🏍️
            </div>
            <div>
              <div className="font-heading font-black text-sm tracking-wider uppercase text-white">
                ThrottleLog
              </div>
              <div className="text-[10px] text-slate-400">
                Motorcycle Crew & Ride Radar
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 px-4 py-3 space-y-4 text-xs">
          
          {/* ─────────────────────────────────────────────────────────────
              1. RADAR TRACKING & BATTERY SAVER MODE
          ───────────────────────────────────────────────────────────── */}
          <div className={`p-3 rounded-2xl border transition-all ${
            isOnRadar 
              ? 'bg-emerald-950/20 border-emerald-500/30' 
              : 'bg-rose-950/20 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Radar Status & Battery
              </span>
              <span className={`flex items-center gap-1 text-[10px] font-bold ${
                isOnRadar ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isOnRadar ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`} />
                <span>{isOnRadar ? 'LIVE' : 'OFFLINE'}</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans mb-2.5">
              {isOnRadar 
                ? 'Your location is broadcasting to your squad on the live map.'
                : 'Offline mode disables GPS broadcast and background processes to conserve phone battery.'}
            </p>

            {onToggleRadar && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onToggleRadar();
                }}
                className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md ${
                  isOnRadar
                    ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{isOnRadar ? 'Go Offline (Battery Saver)' : 'Go Live on Crew Radar'}</span>
              </button>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              2. RIDER PROFILE CARD
          ───────────────────────────────────────────────────────────── */}
          <div className={`p-3 rounded-2xl border transition-all ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Rider Identity
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setIsProfileEditing(prev => !prev);
                }}
                className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
              >
                {isProfileEditing ? 'Cancel' : 'Edit Name & Bike'}
              </button>
            </div>

            {isProfileEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Your Callsign</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={18}
                    placeholder="e.g. Neeraj"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-slate-700 text-white font-bold text-xs focus:outline-hidden focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Motorcycle Model</label>
                  <input
                    type="text"
                    value={bikeInput}
                    onChange={(e) => setBikeInput(e.target.value)}
                    maxLength={22}
                    placeholder="e.g. Hunter 350 / Duke 390"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Radar Pin Color</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_OPTIONS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          selectedColor === c ? 'scale-110 border-white' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Save Profile
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm shrink-0"
                  style={{
                    borderColor: myColor,
                    backgroundColor: `${myColor}25`,
                    color: isLight ? '#0f172a' : '#ffffff',
                  }}
                >
                  {riderName ? riderName.slice(0, 1).toUpperCase() : 'R'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                    <span>{riderName}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: myColor }} />
                  </div>
                  <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                    <Bike className="w-3 h-3 shrink-0" />
                    <span>{bikeModel || 'Motorcycle Rider'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. MAP STYLE & ORIENTATION
          ───────────────────────────────────────────────────────────── */}
          <div className={`p-3 rounded-2xl border transition-all space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                Map Style
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onChangeMapLayer('dark');
                  }}
                  className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                    mapLayer === 'dark'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                      : 'bg-black/40 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Dark
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onChangeMapLayer('streets');
                  }}
                  className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                    mapLayer === 'streets'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                      : 'bg-black/40 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Street
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onChangeMapLayer('satellite');
                  }}
                  className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                    mapLayer === 'satellite'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                      : 'bg-black/40 hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  Satellite
                </button>
              </div>
            </div>

            {/* Map Orientation Mode */}
            {onToggleOrientation && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                    Map Orientation
                  </span>
                  <span className="text-[11px] text-slate-300 font-sans">
                    {orientationMode === 'course' ? 'Heading-Up (Follows bike)' : 'North-Up (Static)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onToggleOrientation();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Toggle</span>
                </button>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. WHATSAPP SQUAD INVITE
          ───────────────────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(25);
              onShareWhatsApp();
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Friends via WhatsApp</span>
          </button>

          {/* ─────────────────────────────────────────────────────────────
              5. APP NAVIGATION SHORTCUTS (MY RIDES, COCKPIT)
          ───────────────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            {/* My Rides / Garage */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
                onOpenGarage();
              }}
              className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderArchive className="w-4 h-4 text-sky-400" />
                <div className="text-left">
                  <div className="font-bold text-white text-xs">Saved Rides & Garage</div>
                  <div className="text-[10px] text-slate-400">View past trip logs & export GPX</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            {/* Solo Ride Cockpit / Instrument Speedometer */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onClose();
                onOpenCockpit();
              }}
              className={`w-full p-3 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <div className="font-bold text-white text-xs">Solo Speedometer Cockpit</div>
                  <div className="text-[10px] text-slate-400">Large digital HUD for solo rides</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              6. PREFERENCES & SETTINGS (UNITS, THEME)
          ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Unit Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onToggleUnitSystem();
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38]'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              <span>{unitSystem === 'metric' ? 'KM/H (Metric)' : 'MPH (Imperial)'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onToggleTheme();
              }}
              className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38]'
              }`}
            >
              {isLight ? <Moon className="w-3.5 h-3.5 text-slate-600" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isLight ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>

          {/* Pocket Mode & Background GPS Battery Card */}
          <div className={`p-3 rounded-xl border space-y-2 text-left font-mono ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-heading font-black text-xs uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
                <span>Pocket Ride & Background GPS</span>
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isBatteryIgnored 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
              }`}>
                {isBatteryIgnored ? 'UNRESTRICTED' : 'OPTIMIZED'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Lock your phone in your pocket or use Google Maps. ThrottleLog runs in the background and broadcasts your live position to your riding crew.
            </p>

            {!isBatteryIgnored && (
              <button
                type="button"
                onClick={async () => {
                  triggerHaptic(30);
                  await requestBatteryOptimizationExemption();
                  const updated = await checkBatteryOptimizationStatus();
                  setIsBatteryIgnored(updated);
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
              >
                <span>⚡ Grant Unrestricted Battery for Long Rides</span>
              </button>
            )}
          </div>

          {/* Download App APK Link */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onClose();
              onOpenDownloadApp();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Download ThrottleLog Android APK (v1.1.0)</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
          <span>ThrottleLog • v1.1.0</span>
          {onOpenFaq && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFaq();
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Help & FAQ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

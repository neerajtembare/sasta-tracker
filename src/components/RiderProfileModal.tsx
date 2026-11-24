import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  Check,
  Shield,
  Radio,
  Smartphone,
  BatteryCharging,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Compass,
  Download,
  Trash2,
  FolderArchive,
  Cloud,
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  Info,
  Settings,
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { getRiderProfile, saveRiderProfile, StartupScreen, DefaultMountMode } from '../utils/riderProfile';
import { crashDetector } from '../utils/crashDetection';
import { checkBatteryOptimizationStatus, requestBatteryOptimizationExemption } from '../utils/nativeKeepAlive';
import { downloadPuneOfflineMap, getOfflineTileCount, clearOfflineTileCache, CacheProgress } from '../utils/mapCache';
import { CURRENT_APP_VERSION } from '../utils/appUpdater';

type SettingsSubMenu = 'root' | 'rider' | 'display' | 'safety' | 'storage' | 'about';

interface RiderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  isOnRadar: boolean;
  onToggleRadar: () => void;
  onSaveProfile: (name: string, bike: string, color: string) => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  onStartupScreenChanged?: (screen: StartupScreen) => void;
  onOpenGarage?: () => void;
  onOpenCloudSync?: () => void;
  onOpenPermissions?: () => void;
  onOpenDownloadApp?: () => void;
  onOpenFaq?: () => void;
  onHudPreferencesChanged?: () => void;
}

const COLOR_PRESETS = [
  '#00f0ff', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ff3366', // Coral
  '#a855f7', // Purple
  '#38bdf8', // Sky Blue
  '#f97316', // Orange
];

export const RiderProfileModal: React.FC<RiderProfileModalProps> = ({
  isOpen,
  onClose,
  riderName,
  bikeModel = '',
  myColor,
  isOnRadar,
  onToggleRadar,
  onSaveProfile,
  theme = 'dark',
  onToggleTheme,
  onStartupScreenChanged,
  onOpenGarage,
  onOpenCloudSync,
  onOpenPermissions,
  onOpenDownloadApp,
  onOpenFaq,
  onHudPreferencesChanged,
}) => {
  const isLight = theme === 'light';
  const [subMenu, setSubMenu] = useState<SettingsSubMenu>('root');

  // Rider & Bike Form State
  const [nameInput, setNameInput] = useState(riderName);
  const [bikeInput, setBikeInput] = useState(bikeModel);
  const [selectedColor, setSelectedColor] = useState(myColor);
  const [initialOdo, setInitialOdo] = useState<string>('0');
  const [startupScreen, setStartupScreen] = useState<StartupScreen>('dashboard');
  const [defaultMount, setDefaultMount] = useState<DefaultMountMode>('handlebar');
  const initialStartupRef = React.useRef<StartupScreen>('dashboard');

  // Display & HUD Toggles
  const [sunlightHud, setSunlightHud] = useState<boolean>(() => {
    try { return localStorage.getItem('sasta_sunlight_mode') === 'true'; } catch { return false; }
  });
  const [showGyroHud, setShowGyroHud] = useState<boolean>(() => {
    try { return localStorage.getItem('sasta_show_gyro') === 'true'; } catch { return false; }
  });

  // Safety & Battery State
  const [crashEnabled, setCrashEnabled] = useState<boolean>(() => crashDetector.isEnabled());
  const [isBatteryIgnored, setIsBatteryIgnored] = useState<boolean>(true);

  // Offline Maps State
  const [cachedTileCount, setCachedTileCount] = useState<number>(0);
  const [isDownloadingMap, setIsDownloadingMap] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<CacheProgress | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubMenu('root');
      const profile = getRiderProfile();
      setNameInput(riderName || profile.callsign);
      setBikeInput(bikeModel || profile.bikeModel);
      setSelectedColor(myColor || profile.color);
      setInitialOdo(profile.initialOdoKm > 0 ? String(profile.initialOdoKm) : '');
      setStartupScreen(profile.defaultStartupScreen);
      initialStartupRef.current = profile.defaultStartupScreen;
      setDefaultMount(profile.defaultMountMode);
      try {
        setSunlightHud(localStorage.getItem('sasta_sunlight_mode') === 'true');
        setShowGyroHud(localStorage.getItem('sasta_show_gyro') === 'true');
      } catch {}
      setCrashEnabled(crashDetector.isEnabled());
      checkBatteryOptimizationStatus().then(setIsBatteryIgnored);
      getOfflineTileCount().then(setCachedTileCount);
    }
  }, [isOpen, riderName, bikeModel, myColor]);

  if (!isOpen) return null;

  const currentInitial = nameInput.trim()
    ? nameInput.trim().charAt(0).toUpperCase()
    : (riderName ? riderName.charAt(0).toUpperCase() : 'R');

  const handleSaveRiderForm = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(30);
    const cleanName = nameInput.trim() || 'Rider';
    const cleanBike = bikeInput.trim() || 'Motorcycle';
    const odoNum = parseFloat(initialOdo) || 0;

    saveRiderProfile({
      callsign: cleanName,
      bikeModel: cleanBike,
      color: selectedColor,
      initialOdoKm: odoNum,
    });

    onSaveProfile(cleanName, cleanBike, selectedColor);
    setSubMenu('root');
  };

  const handleStartupChange = (screen: StartupScreen) => {
    triggerHaptic(20);
    setStartupScreen(screen);
    saveRiderProfile({ defaultStartupScreen: screen });
    if (onStartupScreenChanged && screen !== initialStartupRef.current) {
      initialStartupRef.current = screen;
      onStartupScreenChanged(screen);
    }
  };

  const handleMountChange = (mode: DefaultMountMode) => {
    triggerHaptic(20);
    setDefaultMount(mode);
    saveRiderProfile({ defaultMountMode: mode });
  };

  const toggleSunlightHud = () => {
    triggerHaptic(20);
    const next = !sunlightHud;
    setSunlightHud(next);
    try {
      localStorage.setItem('sasta_sunlight_mode', String(next));
      window.dispatchEvent(new CustomEvent('throttlelog-hud-prefs'));
    } catch {}
    onHudPreferencesChanged?.();
  };

  const toggleGyroHud = () => {
    triggerHaptic(20);
    const next = !showGyroHud;
    setShowGyroHud(next);
    try {
      localStorage.setItem('sasta_show_gyro', String(next));
      window.dispatchEvent(new CustomEvent('throttlelog-hud-prefs'));
    } catch {}
    onHudPreferencesChanged?.();
  };

  const toggleCrashDetect = () => {
    triggerHaptic(25);
    const next = !crashEnabled;
    crashDetector.setEnabled(next);
    setCrashEnabled(next);
  };

  const handleDownloadPuneMap = async () => {
    triggerHaptic(30);
    setIsDownloadingMap(true);
    setCacheNotice(null);
    try {
      await downloadPuneOfflineMap((p) => setDownloadProgress(p));
      const count = await getOfflineTileCount();
      setCachedTileCount(count);
      setCacheNotice('Pune & Ghats Map saved for offline riding!');
      triggerHaptic([50, 40, 50]);
    } catch {
      setCacheNotice('Download error. Check connection and retry.');
    } finally {
      setIsDownloadingMap(false);
      setTimeout(() => setCacheNotice(null), 5000);
    }
  };

  const handleClearCache = async () => {
    triggerHaptic(25);
    await clearOfflineTileCache();
    setCachedTileCount(0);
    setDownloadProgress(null);
    setCacheNotice('Offline map cache cleared.');
    setTimeout(() => setCacheNotice(null), 3000);
  };

  const cardClass = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-slate-900/70 border-slate-800 text-slate-200';
  const rowBtnClass = isLight
    ? 'w-full p-3 rounded-2xl border bg-slate-50 hover:bg-slate-100 border-slate-200 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] text-left'
    : 'w-full p-3 rounded-2xl border bg-slate-900/70 hover:bg-slate-800/80 border-slate-800 flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] text-left';

  const subMenuTitles: Record<SettingsSubMenu, string> = {
    root: 'App Settings',
    rider: 'Rider & Motorcycle',
    display: 'Display & Riding HUD',
    safety: 'Privacy, Safety & Crew',
    storage: 'Maps, Garage & Backup',
    about: 'App Info & Help',
  };

  return (
    <div
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl border shadow-2xl font-mono flex flex-col max-h-[88dvh] overflow-hidden ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/40 text-white'
        }`}
      >
        {/* Modal Header with Sub-menu Back Button */}
        <div className={`px-4 py-3.5 border-b flex items-center justify-between shrink-0 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2 min-w-0">
            {subMenu !== 'root' ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  setSubMenu('root');
                }}
                className={`p-1.5 rounded-xl border flex items-center gap-1 text-xs font-bold cursor-pointer ${
                  isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 border-slate-700 text-cyan-300 hover:bg-slate-800'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-cyan-400" />
              </div>
            )}
            <h2 className={`font-heading font-black text-sm sm:text-base tracking-wider uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {subMenuTitles[subMenu]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2.5 text-xs">
          {/* ─── ROOT SETTINGS MENU ─── */}
          {subMenu === 'root' && (
            <>
              {/* Profile Quick Summary Card -> Tapping enters Rider sub-menu */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  setSubMenu('rider');
                }}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all text-left ${
                  isLight ? 'bg-cyan-50/60 hover:bg-cyan-50 border-cyan-200' : 'bg-cyan-950/20 hover:bg-cyan-950/35 border-cyan-500/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base border-2 shrink-0 relative"
                    style={{
                      backgroundColor: `${selectedColor}25`,
                      borderColor: selectedColor,
                      color: isLight ? '#0f172a' : '#ffffff',
                    }}
                  >
                    <span>{currentInitial}</span>
                    <span className="w-2.5 h-2.5 rounded-full absolute -top-0.5 -right-0.5 border border-black" style={{ backgroundColor: selectedColor }} />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-heading font-black text-sm truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {nameInput || riderName}
                    </div>
                    <div className={`text-[11px] font-sans truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {bikeInput || 'Motorcycle'} • Odo {initialOdo ? `${initialOdo} km` : '0 km'} base
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>

              {/* Sub-menu Rows */}
              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('display'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Display & Riding HUD</div>
                    <div className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isLight ? 'Light Mode' : 'Dark Mode'} • Startup screen • 3D Lean • Sunlight HUD
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('safety'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isOnRadar ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                  }`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Privacy, Crew & Safety</div>
                    <div className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isOnRadar ? 'Crew Radar Live' : 'Solo Private'} • Crash SOS: {crashEnabled ? 'Armed' : 'Off'} • Permissions
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('storage'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <FolderArchive className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Maps, Garage & Backup</div>
                    <div className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Offline map tiles ({cachedTileCount}) • Garage export • Cloud sync
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('about'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>App Info, APK & Help</div>
                    <div className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      v{CURRENT_APP_VERSION} • Units: KM/H • APK Download • Help FAQ
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </>
          )}

          {/* ─── SUB-MENU 1: RIDER & MOTORCYCLE ─── */}
          {subMenu === 'rider' && (
            <form onSubmit={handleSaveRiderForm} className="space-y-3.5">
              <div>
                <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Your Callsign / Name *
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={18}
                  required
                  placeholder="e.g. Neeraj"
                  className={`w-full px-3 py-2 rounded-xl text-sm font-bold focus:outline-hidden focus:border-cyan-400 ${
                    isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Motorcycle Model
                </label>
                <input
                  type="text"
                  value={bikeInput}
                  onChange={(e) => setBikeInput(e.target.value)}
                  maxLength={22}
                  placeholder="e.g. Hunter 350 / Duke 390"
                  className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-hidden focus:border-cyan-400 ${
                    isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Real Bike Odometer Baseline (km)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={initialOdo}
                  onChange={(e) => setInitialOdo(e.target.value)}
                  placeholder="e.g. 8500"
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono focus:outline-hidden focus:border-cyan-400 ${
                    isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                  }`}
                />
                <p className={`text-[10px] mt-1 font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Tracked rides are added on top of this reading to display your bike&apos;s live odometer.
                </p>
              </div>

              <div>
                <label className={`text-[10px] font-bold block mb-1.5 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Pin Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        triggerHaptic(15);
                        setSelectedColor(color);
                      }}
                      className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                        selectedColor === color ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
              >
                Save Rider & Bike Profile
              </button>
            </form>
          )}

          {/* ─── SUB-MENU 2: DISPLAY & RIDING HUD ─── */}
          {subMenu === 'display' && (
            <div className="space-y-3">
              {/* Dark / Light Theme */}
              {onToggleTheme && (
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                  <div>
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>App Theme</div>
                    <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isLight ? 'Daylight Light theme active' : 'Low-glare Night Dark theme active'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onToggleTheme();
                    }}
                    className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                      isLight
                        ? 'bg-slate-900 text-white border-slate-700'
                        : 'bg-amber-400 text-slate-950 border-amber-300'
                    }`}
                  >
                    {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    <span>{isLight ? 'Switch Dark' : 'Switch Light'}</span>
                  </button>
                </div>
              )}

              {/* High-Contrast Sunlight Mode in Cockpit */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Cockpit Sunlight HUD</div>
                  <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Pure OLED black & bright yellow numbers for harsh glare
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleSunlightHud}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-all ${
                    sunlightHud
                      ? 'bg-yellow-400 text-slate-950 border-yellow-300 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300')
                  }`}
                >
                  {sunlightHud ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* 3D Lean Angle Gauge in Cockpit */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cockpit 3D Lean & G-Force</span>
                  </div>
                  <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Display live cornering lean gauge inside speedometer cockpit
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleGyroHud}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-all ${
                    showGyroHud
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300')
                  }`}
                >
                  {showGyroHud ? 'SHOWN' : 'HIDDEN'}
                </button>
              </div>

              {/* Default Startup Screen */}
              <div className={`p-3 rounded-2xl border space-y-2 ${cardClass}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Default App Startup Screen
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {([
                    { key: 'dashboard', icon: '🏍️', label: 'Dashboard' },
                    { key: 'cockpit', icon: '🧭', label: 'Cockpit' },
                    { key: 'map', icon: '🗺️', label: 'Live Map' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleStartupChange(opt.key)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                        startupScreen === opt.key
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                          : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                      }`}
                    >
                      <div>{opt.icon}</div>
                      <div className="mt-0.5">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Ride Mount */}
              <div className={`p-3 rounded-2xl border space-y-2 ${cardClass}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Default Phone Carrying Mode
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleMountChange('handlebar')}
                    className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      defaultMount === 'handlebar'
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-400 font-black'
                        : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Handlebar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMountChange('pocket')}
                    className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      defaultMount === 'pocket'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400 font-black'
                        : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                    }`}
                  >
                    <BatteryCharging className="w-3.5 h-3.5" />
                    <span>Pocket</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── SUB-MENU 3: PRIVACY, CREW & SAFETY ─── */}
          {subMenu === 'safety' && (
            <div className="space-y-3">
              {/* Solo Stealth vs Crew Radar */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span className={`w-2 h-2 rounded-full ${isOnRadar ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                      <span className={isLight ? 'text-slate-900' : 'text-white'}>
                        {isOnRadar ? 'Crew Radar Broadcast Live' : 'Solo Private Mode'}
                      </span>
                    </div>
                    <p className={`text-[10px] font-sans mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isOnRadar
                        ? 'Your live dot is shared with squad riders and squad members appear on your map.'
                        : 'Solo rides stay strictly on your phone — hidden from Crew Radar and no peers shown on map.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    onToggleRadar();
                  }}
                  className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    isOnRadar
                      ? 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isOnRadar ? 'Switch to Solo Private (Hide from Radar)' : 'Go Live on Crew Radar'}</span>
                </button>
              </div>

              {/* Crash Detection & Auto-SOS */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>High-G Crash Detection</span>
                  </div>
                  <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Detects &gt;6.5G impact + stationary stop and triggers countdown SOS
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleCrashDetect}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                    crashEnabled
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400')
                  }`}
                >
                  {crashEnabled ? 'ARMED' : 'OFF'}
                </button>
              </div>

              {/* Battery & Background Permissions */}
              <div className={`p-3 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    <span>Background Battery Optimization</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBatteryIgnored ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {isBatteryIgnored ? 'UNRESTRICTED' : 'OPTIMIZED'}
                  </span>
                </div>
                {!isBatteryIgnored && (
                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic(25);
                      await requestBatteryOptimizationExemption();
                      setIsBatteryIgnored(await checkBatteryOptimizationStatus());
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Grant Unrestricted Background Battery
                  </button>
                )}
                {onOpenPermissions && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onClose();
                      onOpenPermissions();
                    }}
                    className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Open Permissions & GPS Checklist</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── SUB-MENU 4: MAPS, GARAGE & BACKUP ─── */}
          {subMenu === 'storage' && (
            <div className="space-y-3">
              {/* Offline Pune & Ghats Map Cache */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Offline Mountain & Pune Map Cache
                    </div>
                    <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {cachedTileCount > 0
                        ? `${cachedTileCount} tiles (~${((cachedTileCount * 25) / 1024).toFixed(1)} MB) stored offline`
                        : 'Pre-download map tiles for zero-signal rides'}
                    </div>
                  </div>
                </div>

                {isDownloadingMap && downloadProgress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-cyan-400">Downloading tiles...</span>
                      <span>{downloadProgress.percentage}%</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${downloadProgress.percentage}%` }} />
                    </div>
                  </div>
                )}

                {cacheNotice && (
                  <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold text-center">
                    {cacheNotice}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDownloadingMap}
                    onClick={handleDownloadPuneMap}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isDownloadingMap ? 'Downloading...' : cachedTileCount > 0 ? 'Update Offline Map' : 'Download Offline Map'}</span>
                  </button>
                  {cachedTileCount > 0 && (
                    <button
                      type="button"
                      disabled={isDownloadingMap}
                      onClick={handleClearCache}
                      className={`p-2 rounded-xl border cursor-pointer ${
                        isLight ? 'bg-white border-slate-300 text-rose-600 hover:bg-rose-50' : 'bg-slate-800 border-slate-700 text-rose-400 hover:bg-rose-950/60'
                      }`}
                      title="Clear cached tiles"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {onOpenGarage && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClose();
                    onOpenGarage();
                  }}
                  className={rowBtnClass}
                >
                  <div className="flex items-center gap-2.5">
                    <FolderArchive className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Saved Rides & Garage Backup</div>
                      <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Export/Import JSON backups, PIN lock & GPX files</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {onOpenCloudSync && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClose();
                    onOpenCloudSync();
                  }}
                  className={rowBtnClass}
                >
                  <div className="flex items-center gap-2.5">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Cloud Sync & Cross-Device Backup</div>
                      <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Sync garage logs across devices</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          )}

          {/* ─── SUB-MENU 5: APP INFO, APK & HELP ─── */}
          {subMenu === 'about' && (
            <div className="space-y-3">
              <div className={`p-3.5 rounded-2xl border space-y-2 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>ThrottleLog Version</span>
                  <span className="font-mono font-black text-cyan-400">v{CURRENT_APP_VERSION}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Speed & Distance Units</span>
                  <span className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>KM/H · KM · M</span>
                </div>
              </div>

              {onOpenDownloadApp && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClose();
                    onOpenDownloadApp();
                  }}
                  className={rowBtnClass}
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Android APK & Update Checker</div>
                      <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Download APK, share installer or check GitHub releases</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {onOpenFaq && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(20);
                    onClose();
                    onOpenFaq();
                  }}
                  className={rowBtnClass}
                >
                  <div className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Help, GPS Guide & FAQ</div>
                      <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Learn how crash detection, pocket tracking & maps work</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

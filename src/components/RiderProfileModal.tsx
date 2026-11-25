import React, { useState, useEffect } from 'react';
import {
  X,
  Bike,
  Check,
  Shield,
  Radio,
  Volume2,
  VolumeX,
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
  Gauge,
  Map as MapIcon,
  Fuel,
  Megaphone,
  Route,
  Shuffle,
  Layers,
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, RideAnalysis } from '../types';
import { readMigratedStorageKey, writeMigratedStorageKey } from '../utils/units';
import {
  getRiderProfile,
  saveRiderProfile,
  StartupScreen,
  DefaultMountMode,
  MountOrientationPref,
  DefaultMapLayer,
  DefaultMapOrientation,
} from '../utils/riderProfile';
import { crashDetector } from '../utils/crashDetection';
import { checkBatteryOptimizationStatus, requestBatteryOptimizationExemption } from '../utils/nativeKeepAlive';
import {
  preCacheRegionalArea,
  preCacheRouteTiles,
  getOfflineTileCount,
  clearOfflineTileCache,
  CacheProgress,
  LatLngBounds,
} from '../utils/mapCache';
import { CURRENT_APP_VERSION } from '../utils/appUpdater';
import { BackgroundTrackingMode } from './PermissionsModal';

type SettingsSubMenu = 'root' | 'rider' | 'display' | 'safety' | 'storage' | 'about';

interface RiderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  isOnRadar: boolean;
  onToggleRadar: () => void;
  roomCode?: string;
  onJoinRoom?: (code: string) => void;
  myLocation?: { lat: number; lon: number } | null;
  activeRoute?: RideAnalysis | null;
  gpsMountOrientation?: MountOrientationPref;
  onSetMountOrientation?: (orient: MountOrientationPref) => void;
  backgroundMode?: BackgroundTrackingMode;
  onSetBackgroundMode?: (mode: BackgroundTrackingMode) => void;
  isVoiceBlastMuted?: boolean;
  onToggleVoiceBlastMuted?: () => void;
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

const ROOM_WORDS = ['APEX', 'THROTTLE', 'GHAT', 'TURBO', 'RALLY', 'TWISTIES', 'MONSOON', 'DAWN'];

function generateRandomRoomCode(): string {
  const word = ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${word}${num}`;
}

export const RiderProfileModal: React.FC<RiderProfileModalProps> = ({
  isOpen,
  onClose,
  riderName,
  bikeModel = '',
  myColor,
  isOnRadar,
  onToggleRadar,
  roomCode = 'Global Crew',
  onJoinRoom,
  myLocation = null,
  activeRoute = null,
  gpsMountOrientation = 'auto',
  onSetMountOrientation,
  backgroundMode = 'keep_running',
  onSetBackgroundMode,
  isVoiceBlastMuted = false,
  onToggleVoiceBlastMuted,
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
  const [mileageInput, setMileageInput] = useState<string>('32');
  const [fuelPriceInput, setFuelPriceInput] = useState<string>('104');
  const [currencyInput, setCurrencyInput] = useState<string>('₹');
  const [startupScreen, setStartupScreen] = useState<StartupScreen>('dashboard');
  const [defaultMount, setDefaultMount] = useState<DefaultMountMode>('handlebar');
  const [mountOrientation, setMountOrientation] = useState<MountOrientationPref>(gpsMountOrientation);
  const initialStartupRef = React.useRef<StartupScreen>('dashboard');

  // Display & HUD Toggles
  const [sunlightHud, setSunlightHud] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode') === 'true';
  });
  const [showGyroHud, setShowGyroHud] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_show_gyro', 'sasta_show_gyro') === 'true';
  });
  const [cleanHudDefault, setCleanHudDefault] = useState<boolean>(() => {
    return readMigratedStorageKey('throttlelog_clean_hud', 'sasta_clean_hud') === 'true';
  });
  const [defaultMapLayer, setDefaultMapLayer] = useState<DefaultMapLayer>('dark');
  const [defaultMapOrientation, setDefaultMapOrientation] = useState<DefaultMapOrientation>('course');

  // Safety, Crew & Audio Callouts State
  const [crashEnabled, setCrashEnabled] = useState<boolean>(() => crashDetector.isEnabled());
  const [voiceCalloutsEnabled, setVoiceCalloutsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('throttlelog_voice_feedback_v1') !== 'false'; } catch { return true; }
  });
  const [stopIntentEnabled, setStopIntentEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('throttlelog_stop_intent_v1') !== 'false'; } catch { return true; }
  });
  const [roomInput, setRoomInput] = useState<string>(roomCode);
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
      setMileageInput(String(profile.fuelMileageKmpl || 32));
      setFuelPriceInput(String(profile.fuelPricePerLiter || 104));
      setCurrencyInput(profile.currencySymbol || '₹');
      setStartupScreen(profile.defaultStartupScreen);
      initialStartupRef.current = profile.defaultStartupScreen;
      setDefaultMount(profile.defaultMountMode);
      setMountOrientation(gpsMountOrientation || profile.mountOrientation || 'auto');
      setDefaultMapLayer(profile.defaultMapLayer || 'dark');
      setDefaultMapOrientation(profile.defaultMapOrientation || 'course');
      setRoomInput(roomCode || 'Global Crew');
      setSunlightHud(readMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode') === 'true');
      setShowGyroHud(readMigratedStorageKey('throttlelog_show_gyro', 'sasta_show_gyro') === 'true');
      setCleanHudDefault(readMigratedStorageKey('throttlelog_clean_hud', 'sasta_clean_hud') === 'true');
      try {
        setVoiceCalloutsEnabled(localStorage.getItem('throttlelog_voice_feedback_v1') !== 'false');
        setStopIntentEnabled(localStorage.getItem('throttlelog_stop_intent_v1') !== 'false');
      } catch {}
      setCrashEnabled(crashDetector.isEnabled());
      checkBatteryOptimizationStatus().then(setIsBatteryIgnored);
      getOfflineTileCount().then(setCachedTileCount);
    }
  }, [isOpen, riderName, bikeModel, myColor, roomCode, gpsMountOrientation]);

  if (!isOpen) return null;

  const currentInitial = nameInput.trim()
    ? nameInput.trim().charAt(0).toUpperCase()
    : (riderName ? riderName.charAt(0).toUpperCase() : 'R');

  const emitHudPrefUpdate = () => {
    try {
      window.dispatchEvent(new CustomEvent('throttlelog-hud-prefs'));
    } catch {}
    onHudPreferencesChanged?.();
  };

  const handleSaveRiderForm = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(30);
    const cleanName = nameInput.trim() || 'Rider';
    const cleanBike = bikeInput.trim() || 'Motorcycle';
    const odoNum = parseFloat(initialOdo) || 0;
    const mileageNum = parseFloat(mileageInput);
    const fuelPriceNum = parseFloat(fuelPriceInput);

    saveRiderProfile({
      callsign: cleanName,
      bikeModel: cleanBike,
      color: selectedColor,
      initialOdoKm: odoNum,
      fuelMileageKmpl: mileageNum > 0 ? mileageNum : 32,
      fuelPricePerLiter: fuelPriceNum > 0 ? fuelPriceNum : 104,
      currencySymbol: currencyInput.trim() || '₹',
    });

    onSaveProfile(cleanName, cleanBike, selectedColor);
    emitHudPrefUpdate();
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

  const handleMountOrientChange = (orient: MountOrientationPref) => {
    triggerHaptic(20);
    setMountOrientation(orient);
    saveRiderProfile({ mountOrientation: orient });
    onSetMountOrientation?.(orient);
  };

  const handleMapLayerChange = (layer: DefaultMapLayer) => {
    triggerHaptic(20);
    setDefaultMapLayer(layer);
    saveRiderProfile({ defaultMapLayer: layer });
    writeMigratedStorageKey('throttlelog_map_layer', 'sasta_map_layer', layer);
    emitHudPrefUpdate();
  };

  const handleMapOrientChange = (orient: DefaultMapOrientation) => {
    triggerHaptic(20);
    setDefaultMapOrientation(orient);
    saveRiderProfile({ defaultMapOrientation: orient });
    writeMigratedStorageKey('throttlelog_map_orientation', 'sasta_map_orientation', orient);
    emitHudPrefUpdate();
  };

  const toggleSunlightHud = () => {
    triggerHaptic(20);
    const next = !sunlightHud;
    setSunlightHud(next);
    writeMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode', String(next));
    emitHudPrefUpdate();
  };

  const toggleGyroHud = () => {
    triggerHaptic(20);
    const next = !showGyroHud;
    setShowGyroHud(next);
    writeMigratedStorageKey('throttlelog_show_gyro', 'sasta_show_gyro', String(next));
    emitHudPrefUpdate();
  };

  const toggleCleanHud = () => {
    triggerHaptic(20);
    const next = !cleanHudDefault;
    setCleanHudDefault(next);
    writeMigratedStorageKey('throttlelog_clean_hud', 'sasta_clean_hud', String(next));
    emitHudPrefUpdate();
  };

  const toggleCrashDetect = () => {
    triggerHaptic(25);
    const next = !crashEnabled;
    crashDetector.setEnabled(next);
    setCrashEnabled(next);
  };

  const toggleVoiceCallouts = () => {
    triggerHaptic(20);
    const next = !voiceCalloutsEnabled;
    setVoiceCalloutsEnabled(next);
    try {
      localStorage.setItem('throttlelog_voice_feedback_v1', String(next));
    } catch {}
  };

  const toggleStopIntent = () => {
    triggerHaptic(20);
    const next = !stopIntentEnabled;
    setStopIntentEnabled(next);
    try {
      localStorage.setItem('throttlelog_stop_intent_v1', String(next));
    } catch {}
    emitHudPrefUpdate();
  };

  const handleDownloadRegionalMap = async () => {
    triggerHaptic(30);
    setIsDownloadingMap(true);
    setCacheNotice(null);
    const lat = myLocation?.lat ?? 18.5204;
    const lon = myLocation?.lon ?? 73.8567;
    try {
      const result = await preCacheRegionalArea(lat, lon, 25, (p) => setDownloadProgress(p));
      const count = await getOfflineTileCount();
      setCachedTileCount(count);
      setCacheNotice(
        myLocation
          ? `Cached ${result.cached} tiles (25 km radius around current GPS)!`
          : `Cached ${result.cached} tiles (25 km baseline area).`
      );
      triggerHaptic([50, 40, 50]);
    } catch {
      setCacheNotice('Download error. Check connection and retry.');
    } finally {
      setIsDownloadingMap(false);
      setTimeout(() => setCacheNotice(null), 5000);
    }
  };

  const handleDownloadActiveRouteMap = async () => {
    if (!activeRoute?.points?.length) return;
    triggerHaptic(30);
    setIsDownloadingMap(true);
    setCacheNotice(null);

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    activeRoute.points.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLng) minLng = p.lon;
      if (p.lon > maxLng) maxLng = p.lon;
    });
    const bounds: LatLngBounds = {
      minLat: minLat - 0.02,
      maxLat: maxLat + 0.02,
      minLng: minLng - 0.02,
      maxLng: maxLng + 0.02,
    };

    try {
      const result = await preCacheRouteTiles(bounds, 11, 14, (p) => setDownloadProgress(p));
      const count = await getOfflineTileCount();
      setCachedTileCount(count);
      setCacheNotice(`Cached ${result.cached} route tiles offline for "${activeRoute.name}"!`);
      triggerHaptic([40, 30]);
    } catch {
      setCacheNotice('Route tile download failed. Check network and retry.');
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
      className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl border shadow-2xl font-sans flex flex-col max-h-[88dvh] overflow-hidden ${
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
                aria-label="Back to Settings Menu"
                className={`p-1.5 rounded-xl border flex items-center gap-1 text-xs font-bold cursor-pointer ${
                  isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-slate-900 border-slate-700 text-cyan-300 hover:bg-slate-800'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
              }`}>
                <Settings className="w-4 h-4" />
              </div>
            )}
            <h2 className={`font-heading font-black text-sm sm:text-base tracking-wider uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {subMenuTitles[subMenu]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                  isLight ? 'bg-cyan-50/70 hover:bg-cyan-50 border-cyan-300' : 'bg-cyan-950/20 hover:bg-cyan-950/35 border-cyan-500/30'
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
                    <div className={`text-[11px] truncate telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {bikeInput || 'Motorcycle'} • Odo {initialOdo ? `${initialOdo} km` : '0 km'} • {mileageInput} km/L
                    </div>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              </button>

              {/* Sub-menu Rows */}
              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('display'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}>
                    {isLight ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Display &amp; Riding HUD</div>
                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isLight ? 'Light Theme' : 'Dark Theme'} • Map style • Startup &amp; Mount
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('safety'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isOnRadar
                      ? (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400')
                      : (isLight ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400')
                  }`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Privacy, Crew &amp; Safety</div>
                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isOnRadar ? `Crew (${roomCode})` : 'Solo Private'} • Crash SOS: {crashEnabled ? 'Armed' : 'Off'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('storage'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  }`}>
                    <FolderArchive className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Maps, Garage &amp; Backup</div>
                    <div className={`text-[10px] truncate telemetry-num ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Offline tiles ({cachedTileCount}) • Garage export • Cloud sync
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button type="button" onClick={() => { triggerHaptic(15); setSubMenu('about'); }} className={rowBtnClass}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isLight ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                  }`}>
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>App Info, APK &amp; Help</div>
                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      v{CURRENT_APP_VERSION} • KM/H · KM · KM/L • Help &amp; APK
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
                  className={`w-full px-3 py-2 rounded-xl text-xs telemetry-num focus:outline-hidden focus:border-cyan-400 ${
                    isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                  }`}
                />
                <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Tracked rides are added on top of this reading for your total bike odometer.
                </p>
              </div>

              {/* Default Fuel & Cost Assumptions */}
              <div className={`p-3 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  <Fuel className="w-3.5 h-3.5" />
                  <span>Default Bike Fuel Economics</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className={`text-[10px] block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>km / L</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={mileageInput}
                      onChange={(e) => setMileageInput(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold telemetry-num focus:outline-hidden focus:border-cyan-400 ${
                        isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Price / L</label>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      value={fuelPriceInput}
                      onChange={(e) => setFuelPriceInput(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold telemetry-num focus:outline-hidden focus:border-cyan-400 ${
                        isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Currency</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold text-center focus:outline-hidden focus:border-cyan-400 ${
                        isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>
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
                      aria-label={`Select rider pin color ${color}`}
                      onClick={() => {
                        triggerHaptic(15);
                        setSelectedColor(color);
                      }}
                      className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                        selectedColor === color
                          ? (isLight ? 'scale-110 border-slate-900 shadow-lg' : 'scale-110 border-white shadow-lg')
                          : 'border-transparent opacity-75 hover:opacity-100'
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
                Save Rider &amp; Bike Profile
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
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Pure OLED black &amp; bright yellow numbers for harsh glare
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

              {/* Clean Minimal HUD in Cockpit */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Minimal Cockpit Layout</div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hide secondary distance strips and keep only speed &amp; SOS
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleCleanHud}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer transition-all ${
                    cleanHudDefault
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300')
                  }`}
                >
                  {cleanHudDefault ? 'MINIMAL' : 'FULL'}
                </button>
              </div>

              {/* 3D Lean Angle Gauge in Cockpit */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <Compass className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                    <span>Cockpit 3D Lean &amp; G-Force</span>
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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

              {/* Default Live Map Style & Orientation */}
              <div className={`p-3 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>Live Map Tile Style</span>
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {([
                      { key: 'dark', label: 'Dark' },
                      { key: 'streets', label: 'Streets' },
                      { key: 'sunlight', label: 'Sunlight' },
                      { key: 'satellite', label: 'Satellite' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleMapLayerChange(opt.key)}
                        className={`py-1.5 px-1 rounded-lg border font-bold text-center cursor-pointer transition-all ${
                          defaultMapLayer === opt.key
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                            : (isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-black/40 border-slate-800 text-slate-400')
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`text-[11px] font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Map Heading</span>
                  <div className="flex items-center gap-1">
                    {([
                      { key: 'course', label: 'Course-Up' },
                      { key: 'north', label: 'North-Up' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleMapOrientChange(opt.key)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                          defaultMapOrientation === opt.key
                            ? (isLight ? 'bg-cyan-600 text-white border-cyan-700 font-black' : 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-black')
                            : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Default Startup Screen */}
              <div className={`p-3 rounded-2xl border space-y-2 ${cardClass}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Default App Startup Screen
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {([
                    { key: 'dashboard', Icon: Bike, label: 'Home' },
                    { key: 'cockpit', Icon: Gauge, label: 'Cockpit' },
                    { key: 'map', Icon: MapIcon, label: 'Live Map' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleStartupChange(opt.key)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold flex flex-col items-center gap-1 ${
                        startupScreen === opt.key
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                          : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                      }`}
                    >
                      <opt.Icon className="w-4 h-4" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Ride Mount & Mount Orientation */}
              <div className={`p-3 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Default Phone Carrying Mode
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleMountChange('handlebar')}
                    className={`p-2 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                      defaultMount === 'handlebar'
                        ? (isLight ? 'bg-cyan-50 text-cyan-800 border-cyan-500 font-black' : 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-black')
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
                        ? (isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-black' : 'bg-emerald-500/20 text-emerald-300 border-emerald-400 font-black')
                        : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                    }`}
                  >
                    <BatteryCharging className="w-3.5 h-3.5" />
                    <span>Pocket</span>
                  </button>
                </div>

                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    3D Gyro Mount Orientation
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    {([
                      { key: 'auto', label: 'Auto' },
                      { key: 'portrait', label: 'Portrait' },
                      { key: 'landscape', label: 'Landscape' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleMountOrientChange(opt.key)}
                        className={`py-1.5 rounded-lg border font-bold cursor-pointer ${
                          mountOrientation === opt.key
                            ? (isLight ? 'bg-cyan-600 text-white border-cyan-700 font-black' : 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-black')
                            : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
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
                      <span className={`w-2 h-2 rounded-full ${isOnRadar ? 'bg-emerald-500 animate-pulse' : 'bg-cyan-500'}`} />
                      <span className={isLight ? 'text-slate-900' : 'text-white'}>
                        {isOnRadar ? 'Crew Radar Broadcast Live' : 'Solo Private Mode'}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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

                {/* Private Squad Room Join/Create */}
                {onJoinRoom && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const cleaned = roomInput.trim();
                      if (!cleaned) return;
                      triggerHaptic(25);
                      onJoinRoom(cleaned);
                    }}
                    className={`pt-2 border-t space-y-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}
                  >
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Crew Room Code (AES-256 Encrypted)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                        maxLength={24}
                        placeholder="e.g. APEX42 or Global Crew"
                        className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono focus:outline-hidden focus:border-cyan-400 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(15);
                          const code = generateRandomRoomCode();
                          setRoomInput(code);
                          onJoinRoom(code);
                        }}
                        title="Generate random private squad room"
                        aria-label="Generate random private squad room"
                        className={`p-2 rounded-xl border cursor-pointer shrink-0 ${
                          isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700'
                        }`}
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shrink-0"
                      >
                        Join
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* High-G Crash Detection & Auto-SOS */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
                    <span>High-G Crash Detection</span>
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
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

              {/* Voice Distance Callouts */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <Megaphone className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                    <span>Voice Distance Callouts</span>
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Announces 5 km / 10 km milestones &amp; live speed through helmet audio
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceCallouts}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                    voiceCalloutsEnabled
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400')
                  }`}
                >
                  {voiceCalloutsEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Smart Stop Prompt in Crew Map */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Smart Stop Callout Prompt</div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Auto-suggest Fuel/Chai callout after halting on Crew Radar
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleStopIntent}
                  className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                    stopIntentEnabled
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                      : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400')
                  }`}
                >
                  {stopIntentEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Intercom Voice Blast Autoplay Mute */}
              {onToggleVoiceBlastMuted && (
                <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${cardClass}`}>
                  <div>
                    <div className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {isVoiceBlastMuted ? (
                        <VolumeX className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                      ) : (
                        <Volume2 className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
                      )}
                      <span>Voice Blast Autoplay</span>
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isVoiceBlastMuted
                        ? 'Muted: incoming PTT voice notes show banner only without interrupting helmet audio'
                        : 'Auto-plays incoming squad PTT voice notes through Bluetooth helmet intercom'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(20);
                      onToggleVoiceBlastMuted();
                    }}
                    className={`px-3 py-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                      !isVoiceBlastMuted
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : (isLight ? 'bg-amber-100 border-amber-300 text-amber-800 font-black' : 'bg-amber-950/50 border-amber-500/40 text-amber-300 font-black')
                    }`}
                  >
                    {isVoiceBlastMuted ? 'MUTED' : 'AUTO'}
                  </button>
                </div>
              )}

              {/* Background Tracking Mode & Battery Optimization */}
              <div className={`p-3 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <BatteryCharging className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <span>Background GPS &amp; Battery</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isBatteryIgnored
                      ? (isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-400')
                      : (isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-400')
                  }`}>
                    {isBatteryIgnored ? 'UNRESTRICTED' : 'OPTIMIZED'}
                  </span>
                </div>

                {onSetBackgroundMode && (
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        try { localStorage.setItem('throttlelog_background_mode', 'keep_running'); } catch {}
                        onSetBackgroundMode('keep_running');
                      }}
                      className={`py-1.5 px-2 rounded-lg border font-bold cursor-pointer ${
                        backgroundMode === 'keep_running'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                          : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                      }`}
                    >
                      Keep Active Locked
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic(20);
                        try { localStorage.setItem('throttlelog_background_mode', 'stop_on_exit'); } catch {}
                        onSetBackgroundMode('stop_on_exit');
                      }}
                      className={`py-1.5 px-2 rounded-lg border font-bold cursor-pointer ${
                        backgroundMode === 'stop_on_exit'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : (isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-black/40 border-slate-800 text-slate-400')
                      }`}
                    >
                      Pause Minimized
                    </button>
                  </div>
                )}

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
                    <span>Open Permissions &amp; GPS Checklist</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── SUB-MENU 4: MAPS, GARAGE & BACKUP ─── */}
          {subMenu === 'storage' && (
            <div className="space-y-3">
              {/* Offline Regional & Active Route Map Cache */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardClass}`}>
                <div>
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Offline Map Tile Cache
                  </div>
                  <div className={`text-[10px] telemetry-num ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {cachedTileCount > 0
                      ? `${cachedTileCount} tiles (~${((cachedTileCount * 25) / 1024).toFixed(1)} MB) stored offline`
                      : 'Pre-download 25 km surrounding area or active route for zero-signal rides'}
                  </div>
                </div>

                {isDownloadingMap && downloadProgress && (
                  <div className="space-y-1 telemetry-num">
                    <div className="flex justify-between text-[10px]">
                      <span className={isLight ? 'text-cyan-700 font-bold' : 'text-cyan-400'}>Downloading tiles...</span>
                      <span>{downloadProgress.percentage}%</span>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${downloadProgress.percentage}%` }} />
                    </div>
                  </div>
                )}

                {cacheNotice && (
                  <div className={`p-2 rounded-lg border text-[10px] font-bold text-center ${
                    isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {cacheNotice}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isDownloadingMap}
                    onClick={handleDownloadRegionalMap}
                    className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isDownloadingMap ? 'Caching...' : myLocation ? 'Cache 25km Area' : 'Cache Offline Map'}</span>
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
                      aria-label="Clear cached map tiles"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {activeRoute && activeRoute.points && activeRoute.points.length > 0 && (
                  <button
                    type="button"
                    disabled={isDownloadingMap}
                    onClick={handleDownloadActiveRouteMap}
                    className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isLight ? 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-50' : 'bg-slate-800 border-cyan-500/40 text-cyan-300 hover:bg-slate-700'
                    }`}
                  >
                    <Route className="w-3.5 h-3.5" />
                    <span className="truncate">Cache Active Route ({activeRoute.name})</span>
                  </button>
                )}
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
                    <FolderArchive className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Saved Rides &amp; Garage Backup</div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Export/Import JSON backups, PIN lock &amp; GPX files</div>
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
                    <Cloud className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Cloud Sync &amp; Cross-Device Backup</div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Sync garage logs across devices</div>
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
                  <span className={`font-mono font-black ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>v{CURRENT_APP_VERSION}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Speed &amp; Distance Units</span>
                  <span className={`font-mono font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>km/h · km · m · km/L</span>
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
                    <Smartphone className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Android APK &amp; Update Checker</div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Download APK, share installer or check GitHub releases</div>
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
                    <HelpCircle className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Help, GPS Guide &amp; FAQ</div>
                      <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Learn how crash detection, pocket tracking &amp; maps work</div>
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

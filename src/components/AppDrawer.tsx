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
  Compass,
  Download,
  Trash2,
  HardDrive,
  Shield,
  ShieldOff,
  ShieldCheck,
  Volume2
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, UnitSystem } from '../types';
import { checkBatteryOptimizationStatus, requestBatteryOptimizationExemption } from '../utils/nativeKeepAlive';
import { downloadPuneOfflineMap, getOfflineTileCount, clearOfflineTileCache, CacheProgress } from '../utils/mapCache';
import { CURRENT_APP_VERSION } from '../utils/appUpdater';

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
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  orientationMode?: 'north' | 'course';
  onToggleOrientation?: () => void;
  onTriggerRollCall?: () => void;
  onOpenPermissionsModal?: () => void;
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
  isTrackingActive = true,
  onToggleTracking,
  orientationMode = 'course',
  onToggleOrientation,
  onTriggerRollCall,
  onOpenPermissionsModal,
}) => {
  const isLight = theme === 'light';

  // Profile Form State
  const [nameInput, setNameInput] = useState(riderName);
  const [bikeInput, setBikeInput] = useState(bikeModel);
  const [selectedColor, setSelectedColor] = useState(myColor);
  const [isProfileEditing, setIsProfileEditing] = useState(false);

  // Android Background / Pocket Ride Battery Optimization Status
  const [isBatteryIgnored, setIsBatteryIgnored] = useState<boolean>(true);

  // Offline Pune & Western Ghats Map Caching State
  const [cachedTileCount, setCachedTileCount] = useState<number>(0);
  const [isDownloadingMap, setIsDownloadingMap] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<CacheProgress | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNameInput(riderName);
      setBikeInput(bikeModel);
      setSelectedColor(myColor);
      checkBatteryOptimizationStatus().then(ignored => {
        setIsBatteryIgnored(ignored);
      });
      getOfflineTileCount().then(count => {
        setCachedTileCount(count);
      });
    }
  }, [isOpen, riderName, bikeModel, myColor]);

  const handleDownloadPuneMap = async () => {
    triggerHaptic(30);
    setIsDownloadingMap(true);
    setCacheNotice(null);
    try {
      await downloadPuneOfflineMap((p) => {
        setDownloadProgress(p);
      });
      const count = await getOfflineTileCount();
      setCachedTileCount(count);
      setCacheNotice('Pune & Ghats Map successfully saved for offline riding!');
      triggerHaptic([50, 40, 50]);
    } catch {
      setCacheNotice('Download error. Please check connection and retry.');
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
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-sm">
              🏍️
            </div>
            <div>
              <div className={`font-heading font-black text-sm tracking-wider uppercase ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
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
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 px-4 py-3 space-y-4 text-xs">
          
          {/* ─────────────────────────────────────────────────────────────
              1. PRIVACY & BACKGROUND TRACKING CONTROL
          ───────────────────────────────────────────────────────────── */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            isTrackingActive && isOnRadar 
              ? isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/20 border-emerald-500/30' 
              : isLight ? 'bg-rose-50 border-rose-300' : 'bg-rose-950/20 border-rose-500/30'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span>Privacy & Tracking Control</span>
              </span>
              <span className={`flex items-center gap-1 text-[10px] font-bold ${
                isTrackingActive && isOnRadar ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isTrackingActive && isOnRadar ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <span>{isTrackingActive && isOnRadar ? 'TRACKING LIVE' : 'STOPPED (PRIVATE)'}</span>
              </span>
            </div>

            {/* Privacy Sub-system Status Matrix */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-[10px] font-mono">
              <div className={`p-1.5 rounded-lg border flex items-center justify-between ${
                isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-black/40 border-slate-800 text-slate-300'
              }`}>
                <span className="text-slate-400">GPS Hardware:</span>
                <span className={isTrackingActive ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                  {isTrackingActive ? 'Active' : 'Off (Zero Drain)'}
                </span>
              </div>
              <div className={`p-1.5 rounded-lg border flex items-center justify-between ${
                isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-black/40 border-slate-800 text-slate-300'
              }`}>
                <span className="text-slate-400">Radar Broadcast:</span>
                <span className={isOnRadar ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                  {isOnRadar ? 'Live' : 'Hidden (Private)'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans mb-3">
              {isTrackingActive && isOnRadar 
                ? 'Your GPS location is being actively tracked and broadcast to your squad friends on the live map.'
                : 'Privacy Mode Active: Geolocation queries and background keep-alives are terminated. Your location is 100% private and cannot be tracked.'}
            </p>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                if (onToggleTracking) {
                  onToggleTracking();
                } else if (onToggleRadar) {
                  onToggleRadar();
                }
              }}
              className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md ${
                isTrackingActive && isOnRadar
                  ? 'bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 text-rose-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isTrackingActive && isOnRadar ? (
                <>
                  <ShieldOff className="w-4 h-4" />
                  <span>Stop All Tracking & Go Private</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Resume Tracking & Go Live</span>
                </>
              )}
            </button>
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
                  <div className={`font-bold text-sm truncate flex items-center gap-1.5 ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
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
                      : isLight 
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' 
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
                      : isLight 
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' 
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
                      : isLight 
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' 
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
              3B. OFFLINE MAPS (ZERO-SIGNAL MOUNTAIN GHATS & PUNE)
          ───────────────────────────────────────────────────────────── */}
          <div className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-heading font-black text-xs uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Pune & Ghats Offline Map
                  </div>
                  <div className={`text-[10px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Mulshi, Lavasa, Lonavala, Tamhini & City
                  </div>
                </div>
              </div>
              {cachedTileCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Ready
                </span>
              )}
            </div>

            {/* Storage Info */}
            <div className={`flex items-center justify-between text-[11px] font-mono pt-1 border-t ${
              isLight ? 'border-slate-200 text-slate-700' : 'border-slate-800/80 text-slate-300'
            }`}>
              <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Offline Storage:</span>
              <span className={`font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                {cachedTileCount > 0 
                  ? `${cachedTileCount} tiles (~${((cachedTileCount * 25) / 1024).toFixed(1)} MB)`
                  : 'No map downloaded yet'}
              </span>
            </div>

            {/* Active Download Progress Bar */}
            {isDownloadingMap && downloadProgress && (
              <div className="space-y-1 pt-1">
                <div className={`flex items-center justify-between text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    Downloading tiles...
                  </span>
                  <span>{downloadProgress.percentage}% ({downloadProgress.cached}/{downloadProgress.total})</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${downloadProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Status notice */}
            {cacheNotice && (
              <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold text-center animate-in fade-in">
                {cacheNotice}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1 font-mono">
              <button
                type="button"
                disabled={isDownloadingMap}
                onClick={handleDownloadPuneMap}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isDownloadingMap 
                    ? 'Downloading...' 
                    : cachedTileCount > 0 
                    ? 'Update Pune Map' 
                    : 'Download Offline Map'}
                </span>
              </button>

              {cachedTileCount > 0 && (
                <button
                  type="button"
                  disabled={isDownloadingMap}
                  onClick={handleClearCache}
                  title="Clear offline map tiles to reclaim storage"
                  className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                    isLight 
                      ? 'bg-slate-200 hover:bg-rose-100 border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600'
                      : 'bg-slate-800 hover:bg-rose-950 border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-300'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              4. WHATSAPP SQUAD INVITE & SQUAD AUDIO ROLL CALL
          ───────────────────────────────────────────────────────────── */}
          <div className="space-y-2">
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

            {onTriggerRollCall && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onClose();
                  onTriggerRollCall();
                }}
                className={`w-full py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
                  isLight 
                    ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-900' 
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/30 text-cyan-300'
                }`}
                title="Hear current squad connection status, pack spread, and battery levels"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Squad Audio Roll Call (Instant)</span>
              </button>
            )}
          </div>

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
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Saved Rides & Garage</div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>View past trip logs & export GPX</div>
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
                  <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Solo Speedometer Cockpit</div>
                  <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Large digital HUD for solo rides</div>
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
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38] text-slate-200'
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
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#121922] hover:bg-[#1a2430] border-[#1e2a38] text-slate-200'
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
              <span className={`font-heading font-black text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-slate-900' : 'text-slate-200'
              }`}>
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

            <p className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
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

            {onOpenPermissionsModal && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onClose();
                  onOpenPermissionsModal();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Configure Permissions & Background Tracking</span>
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
            className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              isLight 
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Download / Update APK (v{CURRENT_APP_VERSION})</span>
          </button>
        </div>

        {/* Footer */}
        <div className={`px-4 py-2.5 border-t text-[10px] flex items-center justify-between shrink-0 ${
          isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
        }`}>
          <span>ThrottleLog • v{CURRENT_APP_VERSION}</span>
          {onOpenFaq && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFaq();
              }}
              className={`cursor-pointer ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Help & FAQ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

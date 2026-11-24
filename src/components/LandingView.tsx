import React, { useRef, useState, useEffect } from 'react';
import { AppTheme, UnitSystem } from '../types';
import { 
  Upload, 
  Radio, 
  Sparkles, 
  ShieldCheck, 
  Gauge, 
  MapPin, 
  Compass, 
  ArrowRight, 
  Smartphone,
  Navigation,
  Zap,
  Clock, 
  FolderArchive, 
  Play, 
  Users,
  BatteryCharging,
  Bike,
  Trophy,
  History,
  TrendingUp,
  Settings,
  Flame,
  Check
} from 'lucide-react';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME 
} from '../data/sampleRide';
import { getGarageRides, SavedRide, initIndexedDB } from '../utils/storage';
import { getRiderProfile, getBikeLifetimeStats, RiderProfileData, BikeLifetimeStats } from '../utils/riderProfile';
import { triggerHaptic } from '../utils/audioChimes';
import { convertDistance, convertSpeed, convertElevation } from '../utils/units';

interface LandingViewProps {
  onFileLoaded: (xmlText: string, fileName: string, rideId?: string) => void;
  onSelectRide: (gpxText: string, name: string) => void;
  onStartRecording: (mountMode?: 'handlebar' | 'pocket') => void;
  onOpenCrew?: () => void;
  onOpenCockpit?: () => void;
  onOpenProfile?: () => void;
  onOpenGoogleMaps?: () => void;
  theme: AppTheme;
  unitSystem?: UnitSystem;
  activeRideName?: string | null;
  activeRideDistanceKm?: number | null;
  onResumeRide?: () => void;
  onClearRide?: () => void;
  onOpenGarage?: () => void;
  onOpenDownloadApp?: () => void;
  riderName?: string;
  bikeModel?: string;
  myColor?: string;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onFileLoaded,
  onSelectRide,
  onStartRecording,
  onOpenCrew,
  onOpenCockpit,
  onOpenProfile,
  onOpenGoogleMaps,
  theme,
  unitSystem = 'metric',
  activeRideName,
  activeRideDistanceKm,
  onResumeRide,
  onClearRide,
  onOpenGarage,
  onOpenDownloadApp,
  riderName,
  bikeModel,
  myColor,
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRides, setRecentRides] = useState<SavedRide[]>([]);
  const [profile, setProfile] = useState<RiderProfileData>(() => getRiderProfile());
  const [stats, setStats] = useState<BikeLifetimeStats>(() => getBikeLifetimeStats());
  const [selectedMountMode, setSelectedMountMode] = useState<'handlebar' | 'pocket'>(() => {
    return getRiderProfile().defaultMountMode || 'handlebar';
  });

  useEffect(() => {
    let active = true;
    const refreshData = () => {
      if (!active) return;
      const p = getRiderProfile();
      setProfile(p);
      setStats(getBikeLifetimeStats());
      setRecentRides(getGarageRides().slice(0, 4));
      if (p.defaultMountMode) {
        setSelectedMountMode(p.defaultMountMode);
      }
    };
    refreshData();
    initIndexedDB().then(() => refreshData()).catch(() => {});
    window.addEventListener('focus', refreshData);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshData);
    };
  }, [riderName, bikeModel, myColor]);

  const handleFile = (file: File) => {
    setErrorMsg(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.gpx') && !file.type.includes('xml')) {
      setErrorMsg('Please select a valid .gpx or XML file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        try {
          onFileLoaded(content, file.name.replace(/\.[^/.]+$/, ''));
        } catch (err: any) {
          setErrorMsg(err.message || 'Error parsing GPX file');
        }
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file from storage.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleQuickStart = (mode: 'handlebar' | 'pocket') => {
    triggerHaptic(40);
    onStartRecording(mode);
  };

  const formatDist = (km: number) => {
    const c = convertDistance(km, unitSystem);
    return `${c.value.toFixed(1)} ${c.unit}`;
  };

  const formatSpd = (kmh: number) => {
    const c = convertSpeed(kmh, unitSystem);
    return `${Math.round(c.value)} ${c.unit}`;
  };

  const displayName = riderName || profile.callsign || 'Solo Rider';
  const displayBike = bikeModel || profile.bikeModel || 'Motorcycle';
  const displayColor = myColor || profile.color || '#00f0ff';
  const currentInitial = displayName.trim() 
    ? displayName.trim().charAt(0).toUpperCase() 
    : 'R';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 px-1 font-mono">
      <input
        type="file"
        ref={fileInputRef}
        accept=".gpx,application/gpx+xml,text/xml"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {/* Active Ride / Target Route in Memory Strip */}
      {activeRideName && onResumeRide && (
        <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2.5 shadow-sm text-xs ${
          isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-950/30 border-sky-500/40 text-white'
        }`}>
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              Loaded in Memory
            </div>
            <div className="font-bold truncate">
              {activeRideName}
              {activeRideDistanceKm ? ` • ${formatDist(activeRideDistanceKm)}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onClearRide && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onClearRide();
                }}
                className={`px-2.5 py-1.5 rounded-xl border font-bold cursor-pointer transition-colors ${
                  isLight ? 'bg-white hover:bg-rose-50 border-slate-300 text-rose-600' : 'bg-slate-900 hover:bg-rose-950/50 border-slate-700 text-rose-400'
                }`}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onResumeRide();
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black cursor-pointer transition-all active:scale-95"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. RIDER HEADER & MOTORCYCLE IDENTIFIER
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 rounded-3xl border shadow-xl flex items-center justify-between gap-3 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
          : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <div 
            onClick={() => {
              triggerHaptic(20);
              onOpenProfile?.();
            }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 shadow-md shrink-0 cursor-pointer transition-transform hover:scale-105 relative"
            style={{
              backgroundColor: `${displayColor}25`,
              borderColor: displayColor,
              color: isLight ? '#0f172a' : '#ffffff',
            }}
            title="Edit profile & bike specs"
          >
            <span>{currentInitial}</span>
            <span 
              className="w-3 h-3 rounded-full absolute -top-1 -right-1 border-2 border-black" 
              style={{ backgroundColor: displayColor }} 
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-black text-base sm:text-lg truncate">
                {displayName}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase shrink-0 ${
                isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}>
                SOLO RIDER
              </span>
            </div>
            <p className={`text-xs truncate flex items-center gap-1.5 mt-0.5 font-sans ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <Bike className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span>{displayBike}</span>
              {stats.lastRideDate && (
                <span className="text-slate-500 text-[11px]">• Last ride: {stats.lastRideDate}</span>
              )}
            </p>
          </div>
        </div>

        {onOpenProfile && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenProfile();
            }}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shrink-0 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Edit rider profile and bike odometer"
          >
            <Settings className="w-4 h-4 text-cyan-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MOTORCYCLE ODOMETER & LIFETIME STATS (OPTION B)
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl space-y-4 ${
        isLight
          ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 text-slate-800'
          : 'bg-gradient-to-br from-[#0d131a] via-[#111822] to-[#0a0f15] border-cyan-500/30 text-white'
      }`}>
        {/* Top: Large Odometer Display */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <Gauge className="w-3.5 h-3.5 text-cyan-500" />
              <span>Total Motorcycle Odometer</span>
            </div>
            <div className={`font-heading font-black text-2xl sm:text-4xl tracking-tight mt-0.5 ${
              isLight ? 'text-cyan-700' : 'text-cyan-400'
            }`}>
              {(() => {
                const conv = convertDistance(stats.totalBikeOdoKm, unitSystem);
                return conv.value > 0
                  ? `${conv.value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${conv.unit}`
                  : `0.0 ${conv.unit}`;
              })()}
            </div>
          </div>

          <div className="text-right sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
            <span className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Tracked with ThrottleLog:</span>
            <span className="font-bold text-xs text-emerald-500 font-mono">
              {formatDist(stats.totalTrackedKm)} ({stats.totalRides} rides)
            </span>
          </div>
        </div>

        {/* 4-Column Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Lifetime Rides</div>
            <div className={`font-heading font-black text-lg mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats.totalRides}</div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Top Speed</div>
            <div className="font-heading font-black text-lg text-amber-500 mt-0.5">
              {stats.maxSpeedKmh > 0 ? formatSpd(stats.maxSpeedKmh) : '—'}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Saddle Time</div>
            <div className={`font-heading font-black text-lg mt-0.5 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
              {stats.totalDurationHours > 0 ? `${stats.totalDurationHours} hrs` : '0 hrs'}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Elevation Gain</div>
            <div className="font-heading font-black text-lg text-emerald-500 mt-0.5">
              {(() => {
                const elev = convertElevation(stats.totalElevGainM, unitSystem);
                return stats.totalElevGainM > 0 && elev.value !== null
                  ? `${Math.round(elev.value).toLocaleString()} ${elev.unit}`
                  : `0 ${elev.unit}`;
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO QUICK START SOLO RIDE CARD
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 sm:p-6 rounded-3xl border-2 shadow-2xl space-y-4 relative overflow-hidden ${
        isLight
          ? 'bg-gradient-to-br from-emerald-50/80 to-white border-emerald-400'
          : 'bg-gradient-to-br from-[#0d131a] via-emerald-950/20 to-[#0a1410] border-emerald-500/50 shadow-emerald-950/50'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-heading font-black text-lg sm:text-xl uppercase tracking-wider ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                Start Solo Ride
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                1-TAP GPS TRACKING
              </span>
            </div>
            <p className={`text-xs font-sans mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Accurate 1Hz GNSS telemetry, speed, lean angles & offline garage auto-save.
            </p>
          </div>

          {/* Mount Mode Toggle Cards */}
          <div className={`flex items-center gap-2 p-1 rounded-2xl border self-start sm:self-center ${
            isLight ? 'bg-slate-100 border-slate-300' : 'bg-black/60 border-slate-800'
          }`}>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedMountMode('handlebar');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedMountMode === 'handlebar'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Handlebar Mount</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setSelectedMountMode('pocket');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedMountMode === 'pocket'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
              }`}
            >
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>Pocket Mode</span>
            </button>
          </div>
        </div>

        {/* Dynamic Mode Helper Info */}
        <div className={`p-3 rounded-2xl border text-xs font-sans flex items-center justify-between gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/50 border-slate-800/80'
        }`}>
          <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {selectedMountMode === 'handlebar' ? (
              <>
                <span className="text-cyan-500">📱</span>
                <span><strong>Handlebar Mode:</strong> Screen stays awake with real-time speedometer HUD & lean angles.</span>
              </>
            ) : (
              <>
                <span className="text-emerald-500">🔋</span>
                <span><strong>Pocket Mode:</strong> Screen can lock in pocket to save battery. Android service records in background.</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleQuickStart(selectedMountMode)}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/30 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Ride</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. QUICK NAVIGATION CARDS (COCKPIT HUD, CREW MAP, GARAGE)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Cockpit HUD Button (Option A) */}
        {onOpenCockpit && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenCockpit();
            }}
            className={`p-2.5 sm:p-3.5 rounded-2xl border text-center sm:text-left flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-3 transition-all cursor-pointer group shadow-md ${
              isLight 
                ? 'bg-white hover:bg-slate-50 border-slate-200' 
                : 'bg-[#0d131a] hover:bg-[#121a24] border-slate-800 hover:border-cyan-500/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold shrink-0 text-base sm:text-lg">
                🧭
              </div>
              <div className="min-w-0">
                <div className={`font-heading font-black text-[11px] sm:text-xs uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Cockpit HUD</div>
                <div className="text-[10px] text-slate-400 font-sans hidden sm:block">Digital speedometer</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-transform hidden sm:block shrink-0" />
          </button>
        )}

        {/* Live Crew Radar Map */}
        {onOpenCrew && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenCrew();
            }}
            className={`p-2.5 sm:p-3.5 rounded-2xl border text-center sm:text-left flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-3 transition-all cursor-pointer group shadow-md ${
              isLight 
                ? 'bg-white hover:bg-slate-50 border-slate-200' 
                : 'bg-[#0d131a] hover:bg-[#121a24] border-slate-800 hover:border-cyan-500/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold shrink-0 text-base sm:text-lg">
                🗺️
              </div>
              <div className="min-w-0">
                <div className={`font-heading font-black text-[11px] sm:text-xs uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Live Map</div>
                <div className="text-[10px] text-slate-400 font-sans hidden sm:block">Explore & crew radar</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform hidden sm:block shrink-0" />
          </button>
        )}

        {/* Saved Rides Garage */}
        {onOpenGarage && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenGarage();
            }}
            className={`p-2.5 sm:p-3.5 rounded-2xl border text-center sm:text-left flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-3 transition-all cursor-pointer group shadow-md ${
              isLight 
                ? 'bg-white hover:bg-slate-50 border-slate-200' 
                : 'bg-[#0d131a] hover:bg-[#121a24] border-slate-800 hover:border-cyan-500/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0 text-base sm:text-lg">
                📁
              </div>
              <div className="min-w-0">
                <div className={`font-heading font-black text-[11px] sm:text-xs uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>Garage</div>
                <div className="text-[10px] text-slate-400 font-sans hidden sm:block">View all past rides</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-transform hidden sm:block shrink-0" />
          </button>
        )}
      </div>

      {/* Google Maps Route Import Action Row */}
      {onOpenGoogleMaps && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(20);
            onOpenGoogleMaps();
          }}
          className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer shadow-sm group ${
            isLight
              ? 'bg-cyan-50 hover:bg-cyan-100/80 border-cyan-200 text-slate-800'
              : 'bg-cyan-950/20 hover:bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">🗺️</span>
            <div className="text-left min-w-0 truncate">
              <span className={`font-heading font-black text-xs uppercase block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Import Google Maps Route
              </span>
              <span className={`text-[10px] font-sans block truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Paste link from Google Maps or WhatsApp to plot road route & navigate
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. RECENT RIDES FROM GARAGE (OR DEMO ROUTE HELPER)
      ───────────────────────────────────────────────────────────── */}
      {recentRides.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Recent Rides</span>
            </span>
            {onOpenGarage && (
              <button
                type="button"
                onClick={onOpenGarage}
                className="text-[11px] text-cyan-500 hover:underline font-bold cursor-pointer"
              >
                View all ({stats.totalRides}) →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentRides.map((ride) => (
              <div
                key={ride.id}
                onClick={() => {
                  triggerHaptic(20);
                  onFileLoaded(ride.gpxContent, ride.name, ride.id);
                }}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:border-cyan-400 active:scale-98 ${
                  isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-[#0d131a] border-slate-800 hover:bg-[#121922]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`font-bold text-xs truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{ride.name}</div>
                  <div className="text-[10px] text-slate-400 font-sans flex items-center gap-2 mt-0.5">
                    <span>{ride.date}</span>
                    {ride.mountMode && (
                      <span className={`font-mono text-[9px] uppercase ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                        • {ride.mountMode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-heading font-black text-sm ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                    {formatDist(ride.distanceKm)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Top {formatSpd(ride.maxSpeedKmh)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`p-3 border rounded-2xl flex items-center justify-between gap-3 text-xs font-mono ${
          isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#0d131a] border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate">No rides saved yet — test telemetry now</span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME);
            }}
            className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-500 hover:text-slate-950 font-bold text-xs transition-all shrink-0 cursor-pointer"
          >
            Demo Ride →
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. IMPORT GPX FILE & APP INSTALL
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 p-2.5 sm:p-3 border border-dashed rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-2 text-xs font-mono ${
            isDragging
              ? 'border-sky-500 bg-sky-500/10 scale-[1.01]'
              : isLight
              ? 'border-slate-300 bg-slate-50 hover:border-sky-400 text-slate-600'
              : 'border-[#1e2a38] bg-[#0d131a] hover:border-sky-500/40 text-slate-400'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Upload className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="truncate">
              Import GPX Track: <span className="underline font-bold text-sky-500">Browse file</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-500 shrink-0 hidden sm:inline">Garmin • Strava • Kurviger</span>
        </div>

        {onOpenDownloadApp && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenDownloadApp();
            }}
            className={`px-3.5 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                : 'bg-[#0d131a] hover:bg-[#131b24] border-[#1e2a38] text-slate-300'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-500" />
            <span>Get Android APK</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="underline font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

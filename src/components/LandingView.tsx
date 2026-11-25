import React, { useRef, useState, useEffect } from 'react';
import { AppTheme, UnitSystem } from '../types';
import {
  Upload,
  Sparkles,
  Gauge,
  ArrowRight,
  Smartphone,
  Map as MapIcon,
  Play,
  BatteryCharging,
  Bike,
  History,
} from 'lucide-react';
import { getGarageRides, SavedRide, initIndexedDB } from '../utils/storage';
import { getRiderProfile, getBikeLifetimeStats, RiderProfileData, BikeLifetimeStats } from '../utils/riderProfile';
import { triggerHaptic } from '../utils/audioChimes';
import { convertDistance, convertSpeed, convertElevation, formatDurationSummary } from '../utils/units';

interface LandingViewProps {
  onFileLoaded: (xmlText: string, fileName: string, rideId?: string) => void;
  onSelectRide: (gpxText: string, name: string) => void;
  onStartRecording: (mountMode?: 'handlebar' | 'pocket') => void;
  onOpenCrew?: () => void;
  onOpenProfile?: () => void;
  onOpenGoogleMaps?: () => void;
  theme: AppTheme;
  unitSystem?: UnitSystem;
  activeRideName?: string | null;
  activeRideDistanceKm?: number | null;
  onResumeRide?: () => void;
  onClearRide?: () => void;
  onOpenGarage?: () => void;
  riderName?: string;
  bikeModel?: string;
  myColor?: string;
  isOnRadar?: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onFileLoaded,
  onSelectRide,
  onStartRecording,
  onOpenCrew,
  onOpenProfile: _onOpenProfile,
  onOpenGoogleMaps,
  theme,
  unitSystem = 'metric',
  activeRideName,
  activeRideDistanceKm,
  onResumeRide,
  onClearRide,
  onOpenGarage,
  riderName,
  bikeModel,
  myColor,
  isOnRadar = false,
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRides, setRecentRides] = useState<SavedRide[]>([]);
  const [profile, setProfile] = useState<RiderProfileData>(() => getRiderProfile());
  const [stats, setStats] = useState<BikeLifetimeStats>(() => getBikeLifetimeStats());

  useEffect(() => {
    let active = true;
    const refreshData = () => {
      if (!active) return;
      setProfile(getRiderProfile());
      setStats(getBikeLifetimeStats());
      setRecentRides(getGarageRides().slice(0, 4));
    };
    refreshData();
    initIndexedDB().then(() => refreshData()).catch(() => {});
    window.addEventListener('focus', refreshData);
    window.addEventListener('throttlelog-garage-updated', refreshData);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshData);
      window.removeEventListener('throttlelog-garage-updated', refreshData);
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
  const activeMountMode = profile.defaultMountMode || 'handlebar';
  const currentInitial = displayName.trim()
    ? displayName.trim().charAt(0).toUpperCase()
    : 'R';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-5 px-1 font-sans">
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
              Loaded Route / Track
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
                  isLight ? 'bg-white hover:bg-rose-50 border-slate-300 text-rose-700' : 'bg-slate-900 hover:bg-rose-950/50 border-slate-700 text-rose-400'
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
              Open
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1. COMPACT RIDER SUMMARY HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-3.5 sm:p-4 rounded-3xl border shadow-xl flex items-center justify-between gap-3 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
          : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80'
      }`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg border-2 shadow-md shrink-0 relative select-none"
            style={{
              backgroundColor: `${displayColor}25`,
              borderColor: displayColor,
              color: isLight ? '#0f172a' : '#ffffff',
            }}
            aria-hidden="true"
          >
            <span>{currentInitial}</span>
            <span
              className={`w-3 h-3 rounded-full absolute -top-1 -right-1 border-2 ${isLight ? 'border-white' : 'border-black'}`}
              style={{ backgroundColor: displayColor }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading font-black text-base sm:text-lg truncate">
                {displayName}
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${
                isOnRadar
                  ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : isLight ? 'bg-cyan-50 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              }`}>
                {isOnRadar ? 'Crew Live' : 'Solo Mode'}
              </span>
            </div>
            <p className={`text-xs flex items-center gap-1.5 mt-0.5 min-w-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <Bike className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span className="truncate min-w-0">{displayBike}</span>
              {stats.lastRideDate && (
                <span className={`text-[11px] shrink-0 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>• Last: {stats.lastRideDate}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MOTORCYCLE ODOMETER & LIFETIME STATS
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 sm:p-5 rounded-3xl border shadow-xl space-y-4 ${
        isLight
          ? 'bg-gradient-to-br from-white to-slate-50 border-slate-200 text-slate-800'
          : 'bg-gradient-to-br from-[#0d131a] via-[#111822] to-[#0a0f15] border-cyan-500/30 text-white'
      }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <Gauge className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span>Total Motorcycle Odometer</span>
            </div>
            <div className={`font-heading font-black text-2xl sm:text-4xl tracking-tight telemetry-num mt-0.5 ${
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

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
            <span className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Tracked Distance</span>
            <span className={`font-bold text-xs font-mono telemetry-num ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              {formatDist(stats.totalTrackedKm)} · {stats.totalRides} rides
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Total Rides</div>
            <div className={`font-heading font-black text-lg telemetry-num mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>{stats.totalRides}</div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Top Speed</div>
            <div className={`font-heading font-black text-lg telemetry-num mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
              {stats.maxSpeedKmh > 0 ? formatSpd(stats.maxSpeedKmh) : '—'}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Saddle Time</div>
            <div className={`font-heading font-black text-lg telemetry-num mt-0.5 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
              {stats.totalDurationSeconds > 0 ? formatDurationSummary(stats.totalDurationSeconds) : '0m'}
            </div>
          </div>

          <div className={`p-3 rounded-2xl border ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-black/40 border-slate-800'
          }`}>
            <div className={`text-[10px] uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Elevation Gain</div>
            <div className={`font-heading font-black text-lg telemetry-num mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
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
          3. PRIMARY START RIDE & ROUTE PLANNER
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 sm:p-5 rounded-3xl border-2 shadow-2xl space-y-3.5 ${
        isLight
          ? 'bg-gradient-to-br from-emerald-50/70 to-white border-emerald-400'
          : 'bg-gradient-to-br from-[#0d131a] via-emerald-950/20 to-[#0a1410] border-emerald-500/50 shadow-emerald-950/50'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-heading font-black text-lg sm:text-xl uppercase tracking-wider ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                Ready to Ride
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-700'
                    : 'bg-black/50 border-slate-700 text-slate-300'
                }`}
              >
                {activeMountMode === 'pocket' ? (
                  <BatteryCharging className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Smartphone className="w-3 h-3 text-cyan-500" />
                )}
                <span>{activeMountMode === 'pocket' ? 'Pocket Mode' : 'Handlebar Mode'}</span>
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Records GPS track, lean angles &amp; speeds directly to your offline garage.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleQuickStart(activeMountMode)}
              className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Solo Ride</span>
            </button>

            {onOpenCrew && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onOpenCrew();
                }}
                className={`px-3.5 py-3 rounded-2xl border font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-white hover:bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-[#0d131a] hover:bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span>Live Map</span>
              </button>
            )}
          </div>
        </div>

        {onOpenGoogleMaps && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenGoogleMaps();
            }}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group ${
              isLight
                ? 'bg-cyan-50 hover:bg-cyan-100/80 border-cyan-200 text-slate-800'
                : 'bg-cyan-950/25 hover:bg-cyan-950/45 border-cyan-500/30 text-cyan-300'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isLight ? 'bg-white border-cyan-200 text-cyan-700' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
              }`}>
                <MapIcon className="w-4.5 h-4.5" />
              </div>
              <div className="text-left min-w-0">
                <span className={`font-heading font-black text-xs uppercase block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Import Google Maps Route
                </span>
                <span className={`text-[11px] block leading-snug ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Paste a Google Maps route or destination link
                </span>
              </div>
            </div>
            <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. RECENT RIDES FROM GARAGE (OR DEMO / GPX ENTRY)
      ───────────────────────────────────────────────────────────── */}
      {recentRides.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-heading font-black uppercase tracking-wider flex items-center gap-1.5 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <History className={`w-4 h-4 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <span>Recent Rides</span>
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  isLight ? 'text-sky-700 hover:underline' : 'text-sky-400 hover:underline'
                }`}
              >
                <Upload className="w-3 h-3" />
                <span>Import GPX</span>
              </button>
              {onOpenGarage && (
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className={`text-[11px] hover:underline font-bold cursor-pointer ${
                    isLight ? 'text-cyan-700' : 'text-cyan-400'
                  }`}
                >
                  All Rides ({stats.totalRides}) →
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentRides.map((ride) => (
              <button
                key={ride.id}
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  onFileLoaded(ride.gpxContent, ride.name, ride.id);
                }}
                className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:border-cyan-400 active:scale-98 ${
                  isLight ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-[#0d131a] border-slate-800 hover:bg-[#121922]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className={`font-bold text-xs truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{ride.name}</div>
                  <div className={`text-[11px] flex items-center gap-2 mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    <span>{ride.date}</span>
                    {ride.mountMode && (
                      <span className={`font-mono text-[10px] uppercase ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                        • {ride.mountMode}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`font-heading font-black text-sm telemetry-num ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                    {formatDist(ride.distanceKm)}
                  </div>
                  <div className={`text-[11px] font-mono telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Top {formatSpd(ride.maxSpeedKmh)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`p-3.5 border rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs ${
          isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-[#0d131a] border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className={`w-4 h-4 shrink-0 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
            <span className="leading-snug">No saved rides yet. Try the Demo Ride or import a .gpx file.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-xl border font-bold text-xs flex items-center gap-1 cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import GPX</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                triggerHaptic(20);
                const { SAMPLE_GPX_DATA, SAMPLE_GPX_NAME } = await import('../data/sampleRide');
                onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                isLight ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950'
              }`}
            >
              Demo Ride →
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="underline font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

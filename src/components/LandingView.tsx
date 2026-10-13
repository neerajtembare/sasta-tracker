import React, { useRef, useState, useEffect } from 'react';
import { AppTheme } from '../types';
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
  Coffee,
  Clock,
  FolderArchive,
  Play
} from 'lucide-react';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME 
} from '../data/sampleRide';
import { getGarageRides, SavedRide } from '../utils/storage';

interface LandingViewProps {
  onFileLoaded: (xmlText: string, fileName: string, rideId?: string) => void;
  onSelectRide: (gpxText: string, name: string) => void;
  onStartRecording: () => void;
  theme: AppTheme;
  activeRideName?: string | null;
  activeRideDistanceKm?: number | null;
  onResumeRide?: () => void;
  onClearRide?: () => void;
  onOpenGarage?: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onFileLoaded,
  onSelectRide,
  onStartRecording,
  theme,
  activeRideName,
  activeRideDistanceKm,
  onResumeRide,
  onClearRide,
  onOpenGarage,
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentRides, setRecentRides] = useState<SavedRide[]>([]);

  useEffect(() => {
    setRecentRides(getGarageRides());
  }, []);

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

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/60';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const sampleCardBg = isLight ? 'bg-slate-50 hover:bg-sky-50/60 border-slate-200 hover:border-sky-400' : 'bg-[#131b24] hover:bg-[#1a2533] border-[#1e2a38] hover:border-sky-500/40';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 px-1">
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

      {/* Active Ride in Session Notification Banner */}
      {activeRideName && onResumeRide && (
        <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg animate-in fade-in duration-300 ${
          isLight
            ? 'bg-sky-50/90 border-sky-200 text-sky-950'
            : 'bg-gradient-to-r from-sky-950/40 via-[#0d131a] to-emerald-950/30 border-sky-500/30 text-white'
        }`}>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center text-lg shrink-0">
              🏍️
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
                  Ride in Memory
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="font-heading font-black text-sm truncate">
                {activeRideName}
                {activeRideDistanceKm ? ` • ${activeRideDistanceKm.toFixed(1)} km` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            {onClearRide && (
              <button
                type="button"
                onClick={onClearRide}
                className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                  isLight
                    ? 'border-slate-300 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-300'
                    : 'border-[#1e2a38] bg-[#131b24] hover:bg-rose-950/30 text-rose-400 hover:border-rose-500/40'
                }`}
                title="Clear current ride from session memory"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onResumeRide}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs font-sans flex items-center gap-1.5 shadow-md hover:shadow-sky-500/20 transition-all cursor-pointer"
            >
              <span>Resume Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="text-center pt-2 sm:pt-4 space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-sky-500/10 text-sky-500 border border-sky-500/30">
          <span>🏍️</span>
          <span>FREE & PRIVATE GPS MOTORCYCLE TRACKER</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black font-heading tracking-tight">
          Just Hit Start. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-400 bg-clip-text text-transparent">
            We Track Everything.
          </span>
        </h1>

        <p className={`text-xs sm:text-sm max-w-lg mx-auto leading-relaxed ${subText}`}>
          Speed, elevation, lean angles, pit stops — all recorded automatically from your phone's GPS & gyroscope. No external apps needed.
        </p>
      </div>

      {/* Primary CTA: Start Live Ride */}
      <div
        id="btn-landing-start-ride"
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onStartRecording();
          }
        }}
        onClick={onStartRecording}
        className={`p-6 sm:p-8 border-2 rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center text-center group shadow-2xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 relative overflow-hidden ${
          isLight
            ? 'border-emerald-300 bg-gradient-to-br from-white to-emerald-50 hover:border-emerald-500 hover:shadow-emerald-200'
            : 'border-emerald-500/40 bg-gradient-to-br from-[#0d131a] to-emerald-950/20 hover:border-emerald-400 hover:shadow-emerald-950/60'
        }`}
      >
        {/* Animated pulse ring */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center transition-transform group-hover:scale-110">
            <Radio className="w-10 h-10 text-emerald-500" />
          </div>
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
        </div>

        <h2 className="font-heading font-black text-xl sm:text-2xl mb-1">
          Start Tracking Your Ride
        </h2>
        <p className={`text-xs sm:text-sm max-w-sm leading-relaxed ${subText}`}>
          Tap to begin live GPS recording. Mount your phone or keep it in your pocket — we handle the rest.
        </p>

        <div className="mt-5 flex items-center gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onStartRecording();
            }}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/30"
          >
            <Radio className="w-4 h-4" />
            <span>Start Ride</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className={`mt-4 flex items-center gap-4 text-[10px] font-mono ${subText}`}>
          <span className="flex items-center gap-1"><Compass className="w-3 h-3 text-emerald-500" /> GPS + Gyro</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> 100% Private</span>
          <span className="flex items-center gap-1"><Gauge className="w-3 h-3 text-emerald-500" /> Auto-save</span>
        </div>
      </div>

      {/* Secondary: Import GPX file (compact) */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-3 border border-dashed rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 text-xs font-mono ${
          isDragging
            ? 'border-sky-500 bg-sky-500/10 scale-[1.01]'
            : isLight
            ? 'border-slate-300 bg-slate-50 hover:border-sky-400 text-slate-600'
            : 'border-[#1e2a38] bg-[#0d131a] hover:border-sky-500/40 text-slate-400'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-sky-500 shrink-0" />
          <span>
            Have a <code className="font-bold text-sky-500">.gpx</code> file? Drag & drop or <span className="underline font-bold">browse</span> to import.
          </span>
        </div>
        <span className={`text-[10px] ${subText} hidden sm:inline`}>Garmin • Strava • GPSLogger</span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="underline font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* User's Recent Rides or Subtle Demo Option */}
      {recentRides.length > 0 ? (
        <div className={`p-4 sm:p-5 border rounded-2xl space-y-3 shadow-lg ${cardBg}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-sky-400" />
              <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                Your Recent Rides ({recentRides.length})
              </h3>
            </div>
            {onOpenGarage && (
              <button
                onClick={onOpenGarage}
                className="text-[11px] font-mono text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All Garage Rides</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recentRides.slice(0, 4).map((ride, idx) => (
              <div
                key={ride.id}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onFileLoaded(ride.gpxContent, ride.name, ride.id);
                  }
                }}
                onClick={() => onFileLoaded(ride.gpxContent, ride.name, ride.id)}
                className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 focus:outline-hidden focus:ring-2 focus:ring-sky-500 ${sampleCardBg}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs truncate text-white">
                        {ride.name}
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] font-mono px-1 rounded bg-sky-500/20 text-sky-400 shrink-0 font-bold border border-sky-500/30">
                          LATEST
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] font-mono truncate ${subText}`}>
                      {ride.distanceKm ? ride.distanceKm.toFixed(1) : 0} km • Max {ride.maxSpeedKmh ? ride.maxSpeedKmh.toFixed(0) : 0} km/h • {ride.date}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onFileLoaded(ride.gpxContent, ride.name, ride.id);
                  }}
                  className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-slate-950 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <span>Open</span>
                  <Play className="w-3 h-3 fill-current" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Discreet demo helper for first-time visitors */
        <div className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 text-xs font-mono ${cardBg}`}>
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>First time? Want to test without recording a ride?</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME)}
            className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-bold text-xs transition-all shrink-0 cursor-pointer"
          >
            <span>Preview Sample Route →</span>
          </button>
        </div>
      )}

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
        <div className={`p-3 sm:p-4 border rounded-xl space-y-1 ${cardBg}`}>
          <div className="text-emerald-500 flex justify-center mb-1">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="font-mono font-bold text-xs">100% Private</div>
          <div className={`text-[10px] leading-tight ${subText}`}>Zero servers. Data never leaves your phone.</div>
        </div>

        <div className={`p-3 sm:p-4 border rounded-xl space-y-1 ${cardBg}`}>
          <div className="text-sky-500 flex justify-center mb-1">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="font-mono font-bold text-xs">Speed Heatmaps</div>
          <div className={`text-[10px] leading-tight ${subText}`}>Dynamic color-coded velocity line trace.</div>
        </div>

        <div className={`p-3 sm:p-4 border rounded-xl space-y-1 ${cardBg}`}>
          <div className="text-amber-500 flex justify-center mb-1">
            <Coffee className="w-5 h-5" />
          </div>
          <div className="font-mono font-bold text-xs">Pit Stop Logger</div>
          <div className={`text-[10px] leading-tight ${subText}`}>Chai, fuel, food breaks with durations.</div>
        </div>

        <div className={`p-3 sm:p-4 border rounded-xl space-y-1 ${cardBg}`}>
          <div className="text-purple-500 flex justify-center mb-1">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="font-mono font-bold text-xs">Install as App</div>
          <div className={`text-[10px] leading-tight ${subText}`}>Add to home screen for native app speed.</div>
        </div>
      </div>
    </div>
  );
};

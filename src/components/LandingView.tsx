import React, { useRef, useState } from 'react';
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
  Clock
} from 'lucide-react';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME, 
  HIGH_RES_TWISTIES_GPX, 
  HIGH_RES_TWISTIES_NAME,
  SATURDAY_MORNING_GPX,
  SATURDAY_MORNING_NAME,
  MULSHI_RETURN_GPX,
  MULSHI_RETURN_NAME
} from '../data/sampleRide';

interface LandingViewProps {
  onFileLoaded: (xmlText: string, fileName: string) => void;
  onSelectRide: (gpxText: string, name: string) => void;
  onStartRecording: () => void;
  theme: AppTheme;
  activeRideName?: string | null;
  activeRideDistanceKm?: number | null;
  onResumeRide?: () => void;
  onClearRide?: () => void;
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
}) => {
  const isLight = theme === 'light';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          <span>FREE & PRIVATE GPS MOTORCYCLE ANALYZER</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black font-heading tracking-tight">
          Track, Analyze & Relive <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Every Corner of Your Ride
          </span>
        </h1>

        <p className={`text-xs sm:text-sm max-w-lg mx-auto leading-relaxed ${subText}`}>
          Drag & drop your GPX ride logs or mount your phone on the handlebar for live GPS telemetry, speed heatmaps, lean angles, and pit-stop logging.
        </p>
      </div>

      {/* Two Primary Action Cards (Mobile-First Big Touch Targets) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Upload GPX */}
        <div
          id="btn-landing-upload"
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-5 sm:p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col justify-between group shadow-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 ${
            isDragging
              ? 'border-sky-500 bg-sky-500/10 scale-[1.01]'
              : isLight
              ? 'border-slate-300 bg-white hover:border-sky-500 hover:shadow-sky-100'
              : 'border-[#1e2a38] bg-[#0d131a] hover:border-sky-500 hover:shadow-sky-950/40'
          }`}
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-500 flex items-center justify-center transition-transform group-hover:scale-110">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h2 className="font-heading font-black text-base sm:text-lg">
                Upload GPX Ride Log
              </h2>
              <p className={`text-xs mt-1 leading-relaxed ${subText}`}>
                Select a <code className="font-mono text-sky-500 font-bold">.gpx</code> file from your device or drag and drop onto this card.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-bold text-xs font-mono border border-sky-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Browse File</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
            <span className={`text-[10px] font-mono ${subText}`}>
              Garmin • Strava • GPSLogger
            </span>
          </div>
        </div>

        {/* Card 2: Live GPS Cockpit */}
        <div
          id="btn-landing-cockpit"
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onStartRecording();
            }
          }}
          onClick={onStartRecording}
          className={`p-5 sm:p-6 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between group shadow-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
            isLight
              ? 'border-slate-200 bg-white hover:border-emerald-500 hover:shadow-emerald-100'
              : 'border-[#1e2a38] bg-[#0d131a] hover:border-emerald-500 hover:shadow-emerald-950/40'
          }`}
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center transition-transform group-hover:scale-110 relative">
              <Radio className="w-6 h-6" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-2 right-2 animate-ping" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-black text-base sm:text-lg">
                  Start Live GPS Cockpit
                </h2>
                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 rounded uppercase">
                  LIVE
                </span>
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${subText}`}>
                Mount phone on your handlebar. Tracks live speed, elevation, and roll angle with one-touch pit stop tagging.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onStartRecording();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-xs font-mono border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Open Cockpit HUD</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
            <span className={`text-[10px] font-mono ${subText}`}>
              No external app needed
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="underline font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Demo Benchmark Rides Section */}
      <div className={`p-4 sm:p-5 border rounded-2xl space-y-3 shadow-lg ${cardBg}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <h3 className="font-heading font-bold text-xs uppercase tracking-wider">
              Or Try A Demo Ride to See It In Action
            </h3>
          </div>
          <span className={`text-[10px] font-mono ${subText}`}>
            Click any route to load immediately
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Sample 1: Saturday Morning Run */}
          <div
            id="btn-demo-saturday"
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRide(SATURDAY_MORNING_GPX, SATURDAY_MORNING_NAME);
              }
            }}
            onClick={() => onSelectRide(SATURDAY_MORNING_GPX, SATURDAY_MORNING_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 focus:outline-hidden focus:ring-2 focus:ring-sky-500 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-500 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs truncate">
                    Saturday Morning (Pune - Satara)
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-sky-500/15 text-sky-400 shrink-0">Highway</span>
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  227.7 km • 5 Pit Stops • Highway & Ghats
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelectRide(SATURDAY_MORNING_GPX, SATURDAY_MORNING_NAME);
              }}
              className="px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
            >
              Load →
            </button>
          </div>

          {/* Sample 2: Mulshi Return */}
          <div
            id="btn-demo-mulshi"
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRide(MULSHI_RETURN_GPX, MULSHI_RETURN_NAME);
              }
            }}
            onClick={() => onSelectRide(MULSHI_RETURN_GPX, MULSHI_RETURN_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs truncate">
                    Mulshi Lake Return Run
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-amber-500/15 text-amber-400 shrink-0">Twisties</span>
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  26.3 km • Scenic Twisties & Pirangut Ghat
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelectRide(MULSHI_RETURN_GPX, MULSHI_RETURN_NAME);
              }}
              className="px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
            >
              Load →
            </button>
          </div>

          {/* Sample 3: Western Ghats Tour */}
          <div
            id="btn-demo-ghats"
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME);
              }
            }}
            onClick={() => onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs truncate">
                    Western Ghats Tour (Pune - Wai)
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/15 text-emerald-400 shrink-0">Touring</span>
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  128.6 km • +1,440m Climb • Pre-tagged Stops
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME);
              }}
              className="px-2.5 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
            >
              Load →
            </button>
          </div>

          {/* Sample 4: 1Hz High-Res Twisties */}
          <div
            id="btn-demo-twisties"
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRide(HIGH_RES_TWISTIES_GPX, HIGH_RES_TWISTIES_NAME);
              }
            }}
            onClick={() => onSelectRide(HIGH_RES_TWISTIES_GPX, HIGH_RES_TWISTIES_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs truncate">
                    Pasarni Mountain Hairpins (1Hz)
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-cyan-500/15 text-cyan-400 shrink-0">1Hz Apex</span>
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  120 Continuous 1-Sec Fixes • 42° Lean Replay
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelectRide(HIGH_RES_TWISTIES_GPX, HIGH_RES_TWISTIES_NAME);
              }}
              className="px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 text-xs font-mono font-bold transition-all shrink-0 cursor-pointer"
            >
              Load →
            </button>
          </div>
        </div>
      </div>

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

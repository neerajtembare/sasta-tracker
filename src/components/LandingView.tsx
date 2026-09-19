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
}

export const LandingView: React.FC<LandingViewProps> = ({
  onFileLoaded,
  onSelectRide,
  onStartRecording,
  theme,
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
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-5 sm:p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col justify-between group shadow-xl ${
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
                Select a <code className="font-mono text-sky-500 font-bold">.gpx</code> file from your phone files or drag and drop from your computer.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <span className="text-[11px] font-mono text-sky-500 font-bold flex items-center gap-1">
              <span>Choose File</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
            <span className={`text-[10px] font-mono ${subText}`}>
              Garmin • Strava • GPSLogger
            </span>
          </div>
        </div>

        {/* Card 2: Live GPS Cockpit */}
        <div
          onClick={onStartRecording}
          className={`p-5 sm:p-6 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between group shadow-xl ${
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

          <div className="pt-4 flex items-center justify-between">
            <span className="text-[11px] font-mono text-emerald-500 font-bold flex items-center gap-1">
              <span>Open Cockpit HUD</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
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
            onClick={() => onSelectRide(SATURDAY_MORNING_GPX, SATURDAY_MORNING_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-500 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-bold text-xs truncate">
                  Saturday Morning (Pune - Satara)
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  227.7 km • 5 Pit Stops • Highway & Ghats
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-sky-500 group-hover:translate-x-1 transition-transform shrink-0">
              Load →
            </span>
          </div>

          {/* Sample 2: Mulshi Return */}
          <div
            onClick={() => onSelectRide(MULSHI_RETURN_GPX, MULSHI_RETURN_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-bold text-xs truncate">
                  Mulshi Lake Return Run
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  26.3 km • Scenic Twisties & Pirangut Ghat
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-500 group-hover:translate-x-1 transition-transform shrink-0">
              Load →
            </span>
          </div>

          {/* Sample 3: Western Ghats Tour */}
          <div
            onClick={() => onSelectRide(SAMPLE_GPX_DATA, SAMPLE_GPX_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-bold text-xs truncate">
                  Western Ghats Tour (Pune - Wai)
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  128.6 km • +1,440m Climb • Pre-tagged Stops
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0">
              Load →
            </span>
          </div>

          {/* Sample 4: 1Hz High-Res Twisties */}
          <div
            onClick={() => onSelectRide(HIGH_RES_TWISTIES_GPX, HIGH_RES_TWISTIES_NAME)}
            className={`p-3 border rounded-xl cursor-pointer transition-all group flex items-center justify-between gap-3 ${sampleCardBg}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-mono font-bold text-xs truncate">
                  Pasarni Mountain Hairpins (1Hz)
                </div>
                <div className={`text-[10px] font-mono truncate ${subText}`}>
                  120 Continuous 1-Sec Fixes • 42° Lean Replay
                </div>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-500 group-hover:translate-x-1 transition-transform shrink-0">
              Load →
            </span>
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

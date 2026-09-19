import React from 'react';
import { 
  CheckCircle2, 
  Globe, 
  Radio, 
  Zap, 
  Route, 
  Cpu, 
  Sliders, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { AppTheme } from '../types';

interface FaqAndArchitectureProps {
  theme?: AppTheme;
}

export const FaqAndArchitecture: React.FC<FaqAndArchitectureProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const innerCardBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#131b24] border-[#1e2a38] text-slate-200';
  const subTextColor = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const codeBg = isLight ? 'bg-slate-100 text-sky-700 border-slate-200' : 'bg-[#080c10] text-sky-300 border-[#1e2a38]';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      {/* Overview Banner */}
      <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg ${cardBg}`}>
        <div className="flex items-center gap-2 mb-2 text-sky-500 font-mono text-xs font-bold uppercase tracking-wider">
          <Zap className="w-4 h-4" />
          <span>Rider's Telemetry Lab: GPS Accuracy & Road Alignment Solutions</span>
        </div>
        <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
          Comprehensive breakdown of why raw phone GPS drifts away from roads, how our timeline scrubbing and map engine works, and open-source techniques (OSRM Map Matching, Kalman filtering, 10Hz GNSS) to achieve pinpoint road alignment.
        </p>
      </div>

      {/* Deep Dive Section: Why GPS Doesn't Align & Is Video Scrubbing Fine? */}
      <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg space-y-4 ${cardBg}`}>
        <div className="flex items-center gap-2 text-sky-500 font-mono font-bold text-sm uppercase">
          <Route className="w-4 h-4" />
          <span>1. "Can we add the Play/Pause video drag, or is that too much because GPS doesn't align with roads?"</span>
        </div>

        <div className="text-xs space-y-3 leading-relaxed">
          <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
            <strong className={isLight ? 'text-slate-900' : 'text-white'}>Verdict: It is standard practice in motorsport telemetry!</strong> Professional racing telemetry tools (like AiM RaceStudio, MoTeC i2 Pro, and Garmin Catalyst) all use timeline scrubbers even when raw GPS has slight drift.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className={`p-4 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <strong className="text-amber-500 font-mono text-xs">Why Raw Sample GPS Cuts Corners:</strong>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                In typical battery-saver GPS files, GPS fixes are recorded <strong className={isLight ? 'text-slate-900' : 'text-white'}>only once every 60 to 120 seconds</strong>. At 90 km/h, a motorcycle covers 25 meters every second. If an app logs only once a minute, you travel 1.5 kilometers between points — drawing a straight line across mountain valleys and bypassing road curves!
              </p>
            </div>

            <div className={`p-4 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <strong className="text-sky-500 font-mono text-xs">How We Solved It in the Map Engine:</strong>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                1. <strong className={isLight ? 'text-slate-900' : 'text-white'}>Video Timeline Scrubber:</strong> Drag smoothly from 0% to 100% with live timestamps, speed, lean angle, and elevation.
                <br/>2. <strong className={isLight ? 'text-slate-900' : 'text-white'}>Catmull-Rom Spline Smoothing:</strong> Toggle "Smooth" to turn coarse polygon steps into fluid curves.
                <br/>3. <strong className={isLight ? 'text-slate-900' : 'text-white'}>Traveled Track Highlight:</strong> The path illuminates in neon volt behind the motorcycle as you scrub!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Open Source GPS Solutions */}
      <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg space-y-4 ${cardBg}`}>
        <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold text-sm uppercase">
          <Cpu className="w-4 h-4" />
          <span>2. Open-Source Ways to Make GPS Tracking Much Better</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Solution A: OSRM Map Matching */}
          <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
            <div className="space-y-2">
              <div className="text-emerald-500 font-bold flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>A. OSRM Map-Matching</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                <strong className={isLight ? 'text-slate-900' : 'text-white'}>OSRM (Open Source Routing Machine)</strong> has an open-source <code className={`px-1 py-0.5 rounded text-[10px] font-mono border ${codeBg}`}>/match</code> API based on Hidden Markov Models. It takes raw, drifting GPS points and snaps them to exact OpenStreetMap road centerlines.
              </p>
            </div>
            <div className={`text-[10px] p-2 border rounded-lg mt-2 font-mono ${isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'}`}>
              ✓ Integrated via the <strong>"Snap Roads"</strong> button on the map toolbar!
            </div>
          </div>

          {/* Solution B: GPSLogger Settings */}
          <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
            <div className="space-y-2">
              <div className="text-sky-500 font-bold flex items-center gap-1.5 font-mono">
                <Sliders className="w-3.5 h-3.5" />
                <span>B. Tune GPSLogger (Free)</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                In your <strong>GPSLogger for Android</strong> settings, change these 3 values:
              </p>
              <ul className={`text-[10px] space-y-1 font-mono ${subTextColor}`}>
                <li>• <strong>Time before logging:</strong> Set to <span className="text-emerald-500 font-bold">1 second</span> (default was 60s).</li>
                <li>• <strong>Distance filter:</strong> Set to <span className="text-emerald-500 font-bold">0 meters</span>.</li>
                <li>• <strong>Keep GPS on:</strong> Check <span className="text-emerald-500 font-bold">Always ON</span>.</li>
                <li>• <strong>Battery Saver:</strong> Set app to "Unrestricted".</li>
              </ul>
            </div>
          </div>

          {/* Solution C: 10Hz External GNSS */}
          <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
            <div className="space-y-2">
              <div className="text-amber-500 font-bold flex items-center gap-1.5 font-mono">
                <Radio className="w-3.5 h-3.5" />
                <span>C. 10Hz/25Hz Bluetooth GNSS</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Smartphones only have 1Hz GPS (1 fix/sec). Track riders mount a <strong className={isLight ? 'text-slate-900' : 'text-white'}>10Hz or 25Hz external GNSS receiver</strong> (like an open-source u-blox NEO-M8N / ZED-F9P or Dual XGPS160).
              </p>
            </div>
            <div className={`text-[10px] p-2 border rounded-lg mt-2 font-mono ${isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/30 text-amber-400 border-amber-800/40'}`}>
              Gives sub-meter apex accuracy & smooth corner tracking with zero road drift.
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Other Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bug fixes made */}
        <div className={`p-4 sm:p-5 border rounded-2xl shadow-lg ${cardBg}`}>
          <div className="flex items-center gap-2 text-sky-500 font-mono font-bold text-xs uppercase mb-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>Built-in Features & Capabilities</span>
          </div>
          <ul className={`text-xs space-y-2 leading-relaxed ${subTextColor}`}>
            <li>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>Smooth Video Timeline:</strong> Full draggable slider with Spacebar play/pause, Left/Right arrow scrubbing, and 0.5x to 20x speed multipliers.
            </li>
            <li>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>Traveled Track Overlay:</strong> As you drag the scrubber or play the ride, the track behind the bike glows with high-visibility speed colors while the road ahead stays subtle.
            </li>
            <li>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>Free OpenStreetMap & Esri Tiles:</strong> Zero API key dependencies and expired token errors. Clean dark, satellite, and street maps render 100% free with hardware-accelerated Canvas.
            </li>
            <li>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>High-Res Twisties Sample:</strong> Continuous 1-second mountain pass run with hairpins, lean angles, and apex speeds to test high-precision replay.
            </li>
          </ul>
        </div>

        {/* Privacy & Storage */}
        <div className={`p-4 sm:p-5 border rounded-2xl shadow-lg ${cardBg}`}>
          <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold text-xs uppercase mb-3">
            <Globe className="w-4 h-4" />
            <span>100% Client-Side Privacy & Offline Support</span>
          </div>
          <div className={`space-y-2.5 text-xs leading-relaxed ${subTextColor}`}>
            <p>
              <strong className={isLight ? 'text-slate-900' : 'text-white'}>Your GPS ride data never leaves your device:</strong>
            </p>
            <ul className="space-y-1.5 pl-2 text-[11px]">
              <li>• <strong className={isLight ? 'text-slate-900' : 'text-white'}>Zero Server Uploads:</strong> All GPX parsing, speed calculations, lean angle estimation, and chart rendering happen 100% locally in your browser.</li>
              <li>• <strong className={isLight ? 'text-slate-900' : 'text-white'}>One-Click GPX Export:</strong> Save your analyzed ride or modified pit stops anytime as standard GPX.</li>
              <li>• <strong className={isLight ? 'text-slate-900' : 'text-white'}>Works Offline:</strong> Cached locally so you can review tracks even with zero cell coverage in the mountains.</li>
              <li>• <strong className={isLight ? 'text-slate-900' : 'text-white'}>Installable PWA:</strong> Add directly to your phone's home screen for app-like performance.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

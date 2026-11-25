import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Globe, 
  Radio, 
  Zap, 
  Route, 
  Sliders, 
  Sparkles,
  Users,
  Navigation,
  Crosshair,
  Scan,
  AlertTriangle,
  Keyboard,
  ShieldCheck,
  Share2,
  Crown,
} from 'lucide-react';
import { AppTheme } from '../types';

interface FaqAndArchitectureProps {
  theme?: AppTheme;
}

export const FaqAndArchitecture: React.FC<FaqAndArchitectureProps> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  const [activeCategory, setActiveCategory] = useState<'all' | 'crew' | 'gps' | 'shortcuts'>('all');

  const cardBg = isLight 
    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' 
    : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const innerCardBg = isLight 
    ? 'bg-slate-50 border-slate-200 text-slate-800' 
    : 'bg-[#131b24] border-[#1e2a38] text-slate-200';
  const subTextColor = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const codeBg = isLight ? 'bg-slate-100 text-sky-700 border-slate-200' : 'bg-[#080c10] text-sky-300 border-[#1e2a38]';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-8 font-sans">
      
      {/* Header Banner */}
      <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-sky-500 font-mono text-xs font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" />
              <span>Rider Help Center & Documentation</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight">
              ThrottleLog User Guide & Architecture
            </h1>
            <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${subTextColor}`}>
              Master real-time Crew Radar, 1-tap teammate navigation, GPS telemetry calibration, and keyboard shortcuts.
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border shrink-0 self-start sm:self-auto font-mono text-xs ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/60 border-slate-800'}`}>
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'all' ? 'bg-sky-500 text-slate-950 font-black' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Topics
            </button>
            <button
              onClick={() => setActiveCategory('crew')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'crew' ? 'bg-cyan-500 text-slate-950 font-black' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Crew Radar
            </button>
            <button
              onClick={() => setActiveCategory('gps')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'gps' ? 'bg-emerald-500 text-slate-950 font-black' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              GPS Drift & Accuracy
            </button>
            <button
              onClick={() => setActiveCategory('shortcuts')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'shortcuts' ? 'bg-amber-500 text-slate-950 font-black' : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Shortcuts
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION: CREW RADAR & MOTORCYCLE GROUP RIDES
      ───────────────────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'crew') && (
        <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg space-y-5 ${cardBg}`}>
          <div className={`flex items-center gap-2 font-mono font-bold text-sm uppercase tracking-wider ${
            isLight ? 'text-cyan-700' : 'text-cyan-400'
          }`}>
            <Users className="w-4 h-4" />
            <span>Motorcycle Crew Radar: Live Group Tracking Guide</span>
          </div>

          <p className={`text-xs leading-relaxed ${subTextColor}`}>
            Crew Radar links you and your riding companions on a real-time encrypted MQTT grid (relayed over public HiveMQ / EMQX WSS brokers) protected by per-room AES-256-GCM encryption. No account or registration is required, and coordinates are not archived in a central database.
          </p>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Hosting & Joining */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className={`flex items-center gap-1.5 font-mono font-bold text-xs ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                <Share2 className="w-3.5 h-3.5" />
                <span>1. Instant Squad Code</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Open <strong>Live Map</strong> and tap the Squad badge in the bottom strip (or <strong>Privacy &amp; Crew</strong> in Settings) to join or generate a custom room code like <code className={`px-1 rounded ${codeBg}`}>APEX42</code>. Share the WhatsApp invite link so teammates auto-join.
              </p>
            </div>

            {/* Leader Crown */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className={`flex items-center gap-1.5 font-mono font-bold text-xs ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                <Crown className="w-3.5 h-3.5" />
                <span>2. Squad Leader Badge</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                The designated lead bike is tagged with <strong className={isLight ? 'text-amber-700' : 'text-amber-400'}>LEADER</strong> on their map marker and roster card so everyone can follow the lead rider in 1 tap.
              </p>
            </div>

            {/* Direct Navigation */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className={`flex items-center gap-1.5 font-mono font-bold text-xs ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                <Navigation className="w-3.5 h-3.5" />
                <span>3. 1-Tap Google Navigation</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Tap any teammate&apos;s bike marker or open the Squad sheet and tap the <strong className={isLight ? 'text-sky-700' : 'text-sky-300'}>Navigate</strong> icon to launch Google Maps routing straight to their coordinate.
              </p>
            </div>

            {/* Independent Track Logging */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className={`flex items-center gap-1.5 font-mono font-bold text-xs ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                <Radio className="w-3.5 h-3.5" />
                <span>4. Independent REC</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                The <strong className={isLight ? 'text-rose-700' : 'text-rose-400'}>REC</strong> button logs your ride to your local <strong>Garage</strong>. Switching to <strong>Solo Private</strong> hides you from other riders without interrupting your personal GPS recording.
              </p>
            </div>
          </div>

          {/* Map Controls Cheat Sheet */}
          <div className="space-y-2">
            <h2 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Live Map Controls & Icons Reference
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-500 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Crosshair className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-[11px] ${isLight ? 'text-slate-900' : 'text-white'}`}>Recenter (Me)</div>
                  <div className={`text-[10px] ${subTextColor}`}>Pans map to your live GPS position</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-500 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <Scan className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-[11px] ${isLight ? 'text-slate-900' : 'text-white'}`}>Fit Convoy</div>
                  <div className={`text-[10px] ${subTextColor}`}>Auto-frames all squad members on map</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-[11px] ${isLight ? 'text-slate-900' : 'text-white'}`}>Crew Roster</div>
                  <div className={`text-[10px] ${subTextColor}`}>Opens squad formation list & speeds</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-[11px] ${isLight ? 'text-slate-900' : 'text-white'}`}>Emergency SOS</div>
                  <div className={`text-[10px] ${subTextColor}`}>Broadcasts instant regroup alert</div>
                </div>
              </div>
            </div>
          </div>

          {/* Solo Private vs Crew Toggle */}
          <div className={`p-3.5 border rounded-xl flex items-start gap-3 text-xs ${innerCardBg}`}>
            <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <div className="space-y-1">
              <strong className={`font-sans text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>Solo Private vs. Crew Live Toggle:</strong>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Tap the status pill in the top capsule at any time to switch between <strong>Crew Live</strong> and <strong>Solo Private</strong>. Solo Private hides peers from your map and stops broadcasting your coordinates while keeping your personal ride recording active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: GPS ACCURACY, DRIFT & ROAD ALIGNMENT
      ───────────────────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'gps') && (
        <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg space-y-4 ${cardBg}`}>
          <div className="flex items-center gap-2 text-sky-500 font-mono font-bold text-sm uppercase">
            <Route className="w-4 h-4" />
            <span>GPS Drift & Road Alignment Solutions</span>
          </div>

          <div className="text-xs space-y-3 leading-relaxed">
            <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
              Professional motorsport telemetry tools (like AiM RaceStudio, MoTeC i2 Pro, and Garmin Catalyst) all use timeline scrubbers even when raw phone GPS exhibits slight drift. Here is why drift occurs and how ThrottleLog solves it:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className={`p-4 border rounded-xl space-y-1.5 ${innerCardBg}`}>
                <strong className="text-amber-500 font-mono text-xs">Why Raw Sample GPS Cuts Corners:</strong>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  In battery-saver logging apps, GPS fixes are recorded <strong className={isLight ? 'text-slate-900' : 'text-white'}>only once every 60 to 120 seconds</strong>. At 90 km/h, a motorcycle covers 25 meters every second. If an app logs only once a minute, you travel 1.5 kilometers between points — drawing a straight line across mountain valleys and cutting through hairpins!
                </p>
              </div>

              <div className={`p-4 border rounded-xl space-y-1.5 ${innerCardBg}`}>
                <strong className="text-sky-500 font-mono text-xs">How ThrottleLog Solves It:</strong>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  1. <strong className={isLight ? 'text-slate-900' : 'text-white'}>Interactive Video Timeline:</strong> Smoothly scrub from 0% to 100% with live timestamps, speed, lean angle, and elevation.<br/>
                  2. <strong className={isLight ? 'text-slate-900' : 'text-white'}>Spline Smoothing:</strong> Turns coarse polygon steps into fluid curves.<br/>
                  3. <strong className={isLight ? 'text-slate-900' : 'text-white'}>OSRM Map Matching:</strong> Snaps drifting points to exact OpenStreetMap road centerlines with 1 tap.
                </p>
              </div>
            </div>
          </div>

          {/* Open Source GPS Solutions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2">
            {/* Solution A: OSRM Map Matching */}
            <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
              <div className="space-y-2">
                <div className="text-emerald-500 font-bold flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>A. OSRM Road Snap</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  The <code className={`px-1 py-0.5 rounded text-[10px] font-mono border ${codeBg}`}>/match</code> algorithm uses Hidden Markov Models to resolve drifting coordinates onto confirmed highway and street centerlines.
                </p>
              </div>
              <div className={`text-[10px] p-2 border rounded-lg mt-2 font-mono ${isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'}`}>
                ✓ Accessible via the <strong>"Snap Roads"</strong> button on the map viewer toolbar.
              </div>
            </div>

            {/* Solution B: GPSLogger Settings */}
            <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
              <div className="space-y-2">
                <div className="text-sky-500 font-bold flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>B. Optimal Phone Logger Settings</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  For best results with background loggers (like GPSLogger for Android):
                </p>
                <ul className={`text-[10px] space-y-1 font-mono ${subTextColor}`}>
                  <li>• <strong>Logging interval:</strong> 1 second (not 60s).</li>
                  <li>• <strong>Distance filter:</strong> 0 meters.</li>
                  <li>• <strong>Keep GPS active:</strong> Always ON.</li>
                  <li>• <strong>Battery Saver:</strong> Unrestricted.</li>
                </ul>
              </div>
            </div>

            {/* Solution C: External GNSS */}
            <div className={`p-4 border rounded-xl space-y-2 flex flex-col justify-between ${innerCardBg}`}>
              <div className="space-y-2">
                <div className="text-amber-500 font-bold flex items-center gap-1.5 font-mono">
                  <Radio className="w-3.5 h-3.5" />
                  <span>C. 10Hz/25Hz Bluetooth GNSS</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                  Smartphones sample at 1Hz (1 fix/sec). Track and canyon riders can pair a 10Hz external receiver (u-blox ZED-F9P, Dual XGPS160) for sub-meter apex accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION: INTERACTIVE KEYBOARD SHORTCUTS
      ───────────────────────────────────────────────────────────── */}
      {(activeCategory === 'all' || activeCategory === 'shortcuts') && (
        <div className={`p-4 sm:p-6 border rounded-2xl shadow-lg space-y-4 ${cardBg}`}>
          <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-sm uppercase">
            <Keyboard className="w-4 h-4" />
            <span>Interactive Keyboard Shortcuts Cheatsheet</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Play / Pause Timeline</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>Space</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Scrub Track -1s / +1s</span>
              <div className="flex items-center gap-1">
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>←</kbd>
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>→</kbd>
              </div>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Scrub -5s / +5s</span>
              <div className="flex items-center gap-1">
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>Shift</kbd>
                <span>+</span>
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>← / →</kbd>
              </div>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Telemetry & Diagnostics</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>D</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Help / Documentation</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>?</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Close Modals / Exit Max</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>Esc</kbd>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PRIVACY & OFFLINE ARCHITECTURE
      ───────────────────────────────────────────────────────────── */}
      <div className={`p-4 sm:p-5 border rounded-2xl shadow-lg ${cardBg}`}>
        <div className="flex items-center gap-2 text-emerald-500 font-mono font-bold text-xs uppercase mb-3">
          <Globe className="w-4 h-4" />
          <span>Local-First Telemetry &amp; Transparent Network Scope</span>
        </div>
        <div className={`space-y-2.5 text-xs leading-relaxed ${subTextColor}`}>
          <p>
            <strong className={isLight ? 'text-slate-900' : 'text-white'}>Your ride logs and Garage stay locally on your device:</strong> Network connections occur only for opt-in features you trigger.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span><strong>On-Device Processing:</strong> All GPX parsing, speed zones, cornering histograms, crash detection, and Garage storage run offline in your browser/device.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span><strong>Optional Crew Radar Relay:</strong> Only when you join Crew Live do packets (encrypted with room-derived AES-256-GCM) travel over public WSS MQTT brokers (HiveMQ / EMQX).</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span><strong>Map Tiles &amp; Route Helpers:</strong> Viewing/caching maps fetches OpenStreetMap or Esri tiles; Google Maps link import uses Nominatim, OSRM, or <code className="font-mono">/api/unshorten</code> when requested.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span><strong>Optional Cloud Backup:</strong> GitHub Gist sync runs only if you paste your own Personal Access Token or manually import/export JSON backups.</span>
            </li>
          </ul>
        </div>
      </div>

    </div>
  );
};

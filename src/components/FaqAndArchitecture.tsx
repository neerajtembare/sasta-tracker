import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Globe, 
  Radio, 
  Zap, 
  Route, 
  Cpu, 
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
  LogOut,
  FolderArchive,
  Compass
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
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800 shrink-0 self-start sm:self-auto font-mono text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'all' ? 'bg-sky-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Topics
            </button>
            <button
              onClick={() => setActiveCategory('crew')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'crew' ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Crew Radar
            </button>
            <button
              onClick={() => setActiveCategory('gps')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'gps' ? 'bg-emerald-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              GPS Drift & Accuracy
            </button>
            <button
              onClick={() => setActiveCategory('shortcuts')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-bold ${
                activeCategory === 'shortcuts' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
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
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-sm uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Motorcycle Crew Radar: Live Group Tracking Guide</span>
          </div>

          <p className={`text-xs leading-relaxed ${subTextColor}`}>
            Crew Radar links you and your riding companions into a zero-latency live radar grid using WebRTC peer-to-peer telemetry. No account creation or server registration is required, and coordinates are never saved to external clouds.
          </p>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Hosting & Joining */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold text-xs">
                <Share2 className="w-3.5 h-3.5" />
                <span>1. Instant Squad Code</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Tap <strong>Start Crew Ride</strong> to generate a room code (or enter a custom name like <code className={`px-1 rounded ${codeBg}`}>SUNDAY</code>). Share the 1-tap WhatsApp invite link so teammates auto-join on open.
              </p>
            </div>

            {/* Leader Crown */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className="flex items-center gap-1.5 text-amber-400 font-mono font-bold text-xs">
                <span>👑</span>
                <span>2. Squad Leader Crown</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                The ride host is tagged with <strong className="text-amber-400">👑 LEADER</strong> on their live map marker, bottom card, and formation roster, ensuring convoy members always identify the lead bike.
              </p>
            </div>

            {/* Direct Navigation */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className="flex items-center gap-1.5 text-sky-400 font-mono font-bold text-xs">
                <Navigation className="w-3.5 h-3.5" />
                <span>3. 1-Tap Google Navigation</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Tap any teammate's bike marker or their bottom tray card and click <strong className="text-sky-300">🧭 Directions</strong> to launch native Google Maps turn-by-turn routing straight to their live coordinate.
              </p>
            </div>

            {/* Independent Track Logging */}
            <div className={`p-3.5 border rounded-xl space-y-1.5 ${innerCardBg}`}>
              <div className="flex items-center gap-1.5 text-rose-400 font-mono font-bold text-xs">
                <Radio className="w-3.5 h-3.5" />
                <span>4. Independent REC</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                The red <strong className="text-rose-400">REC</strong> button logs your track to your personal <strong>Garage</strong>. Disconnecting or leaving the squad will never terminate or corrupt your active GPS track recording.
              </p>
            </div>
          </div>

          {/* Map Controls Cheat Sheet */}
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Live Map Controls & Icons Reference
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center shrink-0">
                  <Crosshair className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px]">Recenter (Me)</div>
                  <div className={`text-[10px] ${subTextColor}`}>Pans map to your live GPS position</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center shrink-0">
                  <Scan className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px]">Fit Convoy</div>
                  <div className={`text-[10px] ${subTextColor}`}>Auto-frames all squad members on map</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px]">Crew Roster</div>
                  <div className={`text-[10px] ${subTextColor}`}>Opens squad formation list & speeds</div>
                </div>
              </div>

              <div className={`p-3 border rounded-xl flex items-center gap-2.5 ${innerCardBg}`}>
                <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-white text-[11px]">Emergency SOS</div>
                  <div className={`text-[10px] ${subTextColor}`}>Broadcasts instant regroup alert</div>
                </div>
              </div>
            </div>
          </div>

          {/* Convoy Safety & Disconnect Modal */}
          <div className={`p-3.5 border rounded-xl flex items-start gap-3 text-xs ${innerCardBg}`}>
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-white font-mono text-[11px]">Convoy Safety & Leave Confirmation:</strong>
              <p className={`text-[11px] leading-relaxed ${subTextColor}`}>
                Tapping the exit icon (<LogOut className="w-3 h-3 inline text-slate-400" />) in the top-right triggers a safety modal. Squad leaders are warned before ending the session for everyone, while riders can leave without interrupting their personal trip logging. If disconnected due to tunnels, a <strong>1-Tap Rejoin</strong> pill appears automatically on map re-entry.
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
              <span className="text-slate-300">Play / Pause Timeline</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>Space</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className="text-slate-300">Scrub Track -1s / +1s</span>
              <div className="flex items-center gap-1">
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>←</kbd>
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>→</kbd>
              </div>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className="text-slate-300">Scrub -5s / +5s</span>
              <div className="flex items-center gap-1">
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>Shift</kbd>
                <span>+</span>
                <kbd className={`px-1.5 py-1 rounded text-xs font-bold border ${codeBg}`}>← / →</kbd>
              </div>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className="text-slate-300">Telemetry & Diagnostics</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>D</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className="text-slate-300">Help / Documentation</span>
              <kbd className={`px-2 py-1 rounded text-xs font-bold border ${codeBg}`}>?</kbd>
            </div>

            <div className={`p-3 border rounded-xl flex items-center justify-between ${innerCardBg}`}>
              <span className="text-slate-300">Close Modals / Exit Max</span>
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
          <span>100% Client-Side Privacy & Offline Architecture</span>
        </div>
        <div className={`space-y-2.5 text-xs leading-relaxed ${subTextColor}`}>
          <p>
            <strong className={isLight ? 'text-slate-900' : 'text-white'}>Your GPS telemetry never touches third-party tracking servers:</strong>
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Local Browser Processing:</strong> All GPX parsing, speed curves, cornering histograms, and lean calculations run 100% locally in your browser.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Peer-to-Peer Telemetry:</strong> Crew Radar streams position packets directly between connected phones via WebRTC.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Offline Capable PWA:</strong> Fully installable to home screen and cached locally so you can review tracks even without cellular reception in remote valleys.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Instant GPX & PDF Export:</strong> Download raw GPX data, Strava splits, or print official telemetry dossiers at any time.</span>
            </li>
          </ul>
        </div>
      </div>

    </div>
  );
};

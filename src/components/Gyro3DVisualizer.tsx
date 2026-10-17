import React from 'react';
import { Crosshair, RotateCcw, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';

interface Gyro3DVisualizerProps {
  leanAngle: number;       // Current roll: negative = LEFT, positive = RIGHT (deg)
  pitchAngle?: number;     // Current pitch: nose up / down (deg)
  maxLeftLean?: number;    // Session peak left lean (deg)
  maxRightLean?: number;   // Session peak right lean (deg)
  gForceLateral?: number;  // Lateral G-force
  mountMode: 'handlebar' | 'pocket';
  mountOrientation: 'auto' | 'portrait' | 'landscape';
  isCalibrated: boolean;
  onTareAngle: () => Promise<void>;
  onResetTare: () => void;
  onSetMountMode: (mode: 'handlebar' | 'pocket') => void;
  onSetMountOrientation: (orientation: 'auto' | 'portrait' | 'landscape') => void;
  isLight?: boolean;
}

export const Gyro3DVisualizer: React.FC<Gyro3DVisualizerProps> = ({
  leanAngle = 0,
  pitchAngle = 0,
  maxLeftLean = 0,
  maxRightLean = 0,
  gForceLateral = 0,
  mountMode,
  mountOrientation,
  isCalibrated,
  onTareAngle,
  onResetTare,
  onSetMountMode,
  onSetMountOrientation,
  isLight = false,
}) => {
  const absLean = Math.abs(leanAngle);
  const isExtreme = absLean > 38;
  const isAggressive = absLean > 22 && !isExtreme;

  const leanColor = isExtreme 
    ? 'text-rose-500' 
    : isAggressive 
    ? 'text-amber-400' 
    : isLight 
    ? 'text-emerald-600' 
    : 'text-emerald-400';

  const leanBorderColor = isExtreme
    ? 'border-rose-500'
    : isAggressive
    ? 'border-amber-400'
    : 'border-emerald-500';

  const leanGlowColor = isExtreme
    ? 'rgba(239, 68, 68, 0.4)'
    : isAggressive
    ? 'rgba(251, 191, 36, 0.3)'
    : 'rgba(16, 185, 129, 0.25)';

  const cardBg = isLight ? 'bg-white/90 border-slate-300' : 'bg-slate-950/85 border-[#1e2a38]';
  const subTextColor = isLight ? 'text-slate-600' : 'text-slate-400';

  const handleTare = async () => {
    triggerHaptic(35);
    await onTareAngle();
  };

  const handleReset = () => {
    triggerHaptic(20);
    onResetTare();
  };

  return (
    <div className={`p-3 rounded-2xl border shadow-xl backdrop-blur-md flex flex-col justify-between ${cardBg}`}>
      
      {/* ─────────────────────────────────────────────────────────────
          HEADER BAR: MOUNT MODE & ORIENTATION & TARE ZERO BUTTON
      ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-1.5 mb-2 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            3D Gyro
          </span>

          {/* Mount Selector */}
          <div className={`flex border rounded-lg p-0.5 text-[9px] ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#223140]'}`}>
            <button
              onClick={() => onSetMountMode('handlebar')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                mountMode === 'handlebar' ? 'bg-cyan-500 text-slate-950 font-bold' : subTextColor
              }`}
            >
              🏍️ Bar
            </button>
            <button
              onClick={() => onSetMountMode('pocket')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                mountMode === 'pocket' ? 'bg-cyan-500 text-slate-950 font-bold' : subTextColor
              }`}
            >
              👖 Pocket
            </button>
          </div>
        </div>

        {/* Handlebar Calibration Controls */}
        {mountMode === 'handlebar' && (
          <div className="flex items-center gap-1">
            {/* Orientation Mode */}
            <div className={`flex items-center rounded-lg p-0.5 border text-[9px] ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#223140]'}`}>
              <button
                onClick={() => onSetMountOrientation('landscape')}
                title="Force Landscape (Horizontal clamp on handlebars)"
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors font-bold ${
                  mountOrientation === 'landscape' ? 'bg-cyan-500 text-slate-950' : subTextColor
                }`}
              >
                🔄 Land
              </button>
              <button
                onClick={() => onSetMountOrientation('portrait')}
                title="Force Portrait (Vertical clamp)"
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors font-bold ${
                  mountOrientation === 'portrait' ? 'bg-cyan-500 text-slate-950' : subTextColor
                }`}
              >
                📱 Port
              </button>
              <button
                onClick={() => onSetMountOrientation('auto')}
                title="Auto-detect phone orientation"
                className={`px-1 py-0.5 rounded cursor-pointer transition-colors ${
                  mountOrientation === 'auto' ? 'bg-cyan-500 text-slate-950 font-bold' : subTextColor
                }`}
              >
                ⚡Auto
              </button>
            </div>

            {/* Zero Angle Setup Button */}
            <button
              onClick={handleTare}
              title="Set bike upright and tap to calibrate 0.0° reference on handlebar mount"
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm ${
                isCalibrated
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                  : 'bg-cyan-500 text-slate-950 border-cyan-400 ring-2 ring-cyan-400/40'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>{isCalibrated ? 'Zeroed' : 'Zero 0°'}</span>
            </button>

            {isCalibrated && (
              <button
                onClick={handleReset}
                title="Reset Zero Angle Calibration"
                className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {mountMode === 'handlebar' ? (
        <div className="space-y-2">
          
          {/* ─────────────────────────────────────────────────────────────
              3D MOTORCYCLE HORIZON GAUGE (Hardware-accelerated 3D CSS)
          ───────────────────────────────────────────────────────────── */}
          <div className="relative w-full h-28 sm:h-32 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 to-[#0b1017] border border-slate-800">
            
            {/* Artificial Horizon Background Grid */}
            <div 
              style={{
                transform: `rotate(${leanAngle}deg)`,
                transition: 'transform 0.08s ease-out',
              }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40"
            >
              <div className="w-[160%] h-px bg-cyan-500/60 shadow-[0_0_8px_#06b6d4]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-dashed border-cyan-500/30" />
            </div>

            {/* Dial Tick Arcs (-50° to +50°) */}
            <div className="absolute inset-x-4 top-2 flex justify-between text-[8px] font-mono text-slate-500 font-bold pointer-events-none select-none">
              <span className="text-rose-400/80">◀ 50°</span>
              <span className="text-amber-400/80">35°</span>
              <span className="text-slate-400">20°</span>
              <span className="text-emerald-400 font-black">0°</span>
              <span className="text-slate-400">20°</span>
              <span className="text-amber-400/80">35°</span>
              <span className="text-rose-400/80">50° ▶</span>
            </div>

            {/* 3D MOTORCYCLE SILHOUETTE (Rotates & Banks in true 3D space) */}
            <div 
              style={{
                perspective: '350px',
                transformStyle: 'preserve-3d',
              }}
              className="relative z-10 flex flex-col items-center justify-center"
            >
              <div 
                style={{
                  transform: `rotateZ(${leanAngle}deg) rotateX(${pitchAngle * 0.35}deg)`,
                  transformOrigin: '50% 80%',
                  transition: 'transform 0.06s ease-out',
                  filter: `drop-shadow(0 0 10px ${leanGlowColor})`,
                }}
                className="relative flex flex-col items-center select-none"
              >
                {/* Motorcycle Front View Silhouette (Headlight, Handlebars & Windshield) */}
                <svg width="68" height="68" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Handlebars */}
                  <path d="M15 42 L35 48 L65 48 L85 42" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                  {/* Bar-end mirrors */}
                  <circle cx="12" cy="40" r="3.5" fill="#00f0ff" />
                  <circle cx="88" cy="40" r="3.5" fill="#00f0ff" />
                  
                  {/* Windshield / Fairing */}
                  <path d="M40 25 L50 14 L60 25 L55 50 L45 50 Z" fill="#0369a1" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="2" strokeLinejoin="round" />
                  
                  {/* Aggressive Twin LED Headlights */}
                  <polygon points="38,48 48,46 47,56 37,54" fill="#facc15" filter="drop-shadow(0 0 4px #facc15)" />
                  <polygon points="62,48 52,46 53,56 63,54" fill="#facc15" filter="drop-shadow(0 0 4px #facc15)" />

                  {/* Fork Stanchions */}
                  <line x1="42" y1="56" x2="42" y2="76" stroke="#94a3b8" strokeWidth="3" />
                  <line x1="58" y1="56" x2="58" y2="76" stroke="#94a3b8" strokeWidth="3" />

                  {/* Front Tire Profile */}
                  <rect x="44" y="65" width="12" height="28" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
                  <line x1="50" y1="67" x2="50" y2="90" stroke="#00f0ff" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>

                {/* Ground Contact Pointer Needle */}
                <div 
                  className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[8px] -mt-1 ${
                    isExtreme ? 'border-t-rose-500' : isAggressive ? 'border-t-amber-400' : 'border-t-emerald-400'
                  }`}
                />
              </div>
            </div>

            {/* Live Lean Readout Center Tag */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 rounded-full bg-slate-950/90 border border-slate-700/80 shadow-lg flex items-center gap-2 font-mono">
              <span className={`text-base font-black tracking-tight ${leanColor}`}>
                {absLean}°
              </span>
              <span className={`text-[10px] font-bold ${subTextColor}`}>
                {leanAngle < 0 ? 'LEFT ◀' : leanAngle > 0 ? '▶ RIGHT' : 'UPRIGHT'}
              </span>
              {gForceLateral > 0.05 && (
                <span className="text-[10px] text-cyan-400 font-bold border-l border-slate-700 pl-2">
                  {gForceLateral} G
                </span>
              )}
            </div>

            {/* Pitch Tag (Climb / Dive) */}
            {Math.abs(pitchAngle) >= 3 && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[9px] font-mono font-bold text-slate-300">
                {pitchAngle > 0 ? `▲ +${pitchAngle}° Rise` : `▼ ${pitchAngle}° Dive`}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              DYNAMIC HORIZONTAL LEAN SWEEP BAR & MOTOGP PEAK TILES
          ───────────────────────────────────────────────────────────── */}
          <div className="space-y-1 font-mono">
            {/* Dual Peak Badges: Max Left vs Max Right */}
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">PEAK L:</span>
                <strong className={`font-black ${maxLeftLean > 35 ? 'text-rose-400' : 'text-amber-300'}`}>
                  {maxLeftLean}°
                </strong>
              </div>

              <div className="text-[9px] text-slate-500">
                {isCalibrated ? 'Handlebar Calibrated' : 'Tap Zero 0° to tare mount'}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">PEAK R:</span>
                <strong className={`font-black ${maxRightLean > 35 ? 'text-rose-400' : 'text-amber-300'}`}>
                  {maxRightLean}°
                </strong>
              </div>
            </div>

            {/* Bipolar Bar */}
            <div className="relative w-full h-2.5 rounded-full bg-slate-900 border border-slate-700/80 overflow-hidden flex items-center justify-center">
              {/* Zero Center Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-cyan-400/80 z-10" />

              {/* Left Bar */}
              {leanAngle < 0 && (
                <div 
                  style={{ width: `${Math.min(50, (absLean / 50) * 50)}%` }}
                  className={`absolute right-1/2 h-full rounded-l-full transition-all duration-75 ${
                    isExtreme ? 'bg-rose-500' : isAggressive ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
              )}

              {/* Right Bar */}
              {leanAngle > 0 && (
                <div 
                  style={{ width: `${Math.min(50, (absLean / 50) * 50)}%` }}
                  className={`absolute left-1/2 h-full rounded-r-full transition-all duration-75 ${
                    isExtreme ? 'bg-rose-500' : isAggressive ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Pocket Mode State */
        <div className={`p-3 rounded-xl border text-xs font-mono leading-relaxed ${
          isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-950/20 border-sky-500/20 text-sky-300'
        }`}>
          <div className="font-bold flex items-center gap-1.5 mb-1">
            <span>👖 Pocket Mode Active</span>
          </div>
          <p className="text-[11px] opacity-80 leading-normal">
            Phone is riding in your pocket. Gyro tilt sensor is muted to save battery. Lean angles are automatically calculated post-ride using GPS centrifugal cornering physics.
          </p>
        </div>
      )}

    </div>
  );
};

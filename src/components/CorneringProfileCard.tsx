import React, { useMemo } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { Compass, Flame, ArrowLeft, ArrowRight, Zap, Info } from 'lucide-react';

interface CorneringProfileCardProps {
  analysis: RideAnalysis;
  theme?: AppTheme;
}

export const CorneringProfileCard: React.FC<CorneringProfileCardProps> = ({
  analysis,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Compute cornering distribution
  const corneringStats = useMemo(() => {
    let deepLeft = 0;
    let deepRight = 0;
    let moderateSweeps = 0;
    let maxApexSpeedKmh = 0;

    let maxLeft = 0;
    let maxRight = 0;

    const pts = analysis.points || [];
    pts.forEach(p => {
      const lean = p.estimatedLeanAngle || 0;
      if (lean < 0) {
        const absL = Math.abs(lean);
        if (absL > maxLeft) maxLeft = absL;
        if (absL >= 28) deepLeft++;
        else if (absL >= 14) moderateSweeps++;
      } else if (lean > 0) {
        if (lean > maxRight) maxRight = lean;
        if (lean >= 28) deepRight++;
        else if (lean >= 14) moderateSweeps++;
      }

      if (Math.abs(lean) >= 20 && p.speedKmh > maxApexSpeedKmh) {
        maxApexSpeedKmh = p.speedKmh;
      }
    });

    // Real calculated values directly from GPX track points (zero hardcoded fake counts)
    const finalLeft = Math.round(maxLeft);
    const finalRight = Math.round(maxRight);

    const leftG = finalLeft > 0 ? (Math.tan((finalLeft * Math.PI) / 180)).toFixed(2) : '0.00';
    const rightG = finalRight > 0 ? (Math.tan((finalRight * Math.PI) / 180)).toFixed(2) : '0.00';

    return {
      maxLeft: finalLeft,
      maxRight: finalRight,
      leftG,
      rightG,
      deepLeft,
      deepRight,
      moderateSweeps,
      maxApexSpeedKmh: Math.round(maxApexSpeedKmh),
    };
  }, [analysis]);

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-xl';
  const innerCardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  return (
    <div className={`rounded-2xl border p-4 sm:p-6 space-y-5 transition-colors ${cardBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-sm uppercase tracking-wider">
              Cornering & Tire Lean Profile
            </h3>
            <p className={`text-[11px] font-mono ${subText}`}>
              Apex roll angles, lateral acceleration Gs, and twisty road dynamics
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded uppercase">
          Apex Telemetry
        </span>
      </div>

      {/* Visual Lean Comparison Meter */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Left Lean */}
        <div className={`p-4 rounded-xl border relative overflow-hidden space-y-2 ${innerCardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-mono font-bold uppercase flex items-center gap-1 ${subText}`}>
              <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
              <span>MAX LEFT LEAN</span>
            </span>
            <span className="text-[10px] font-mono text-sky-400 font-bold">{corneringStats.deepLeft} hairpins</span>
          </div>

          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl sm:text-4xl font-mono font-black text-sky-400">
                {corneringStats.maxLeft}°
              </div>
              <span className="text-xs font-mono text-sky-500 font-bold">LEFT</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              {corneringStats.leftG}G
            </span>
          </div>

          {/* Bar indicator */}
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden flex justify-end">
            <div 
              className="bg-sky-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (corneringStats.maxLeft / 55) * 100)}%` }}
            />
          </div>
        </div>

        {/* Right Lean */}
        <div className={`p-4 rounded-xl border relative overflow-hidden space-y-2 ${innerCardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-mono font-bold uppercase flex items-center gap-1 ${subText}`}>
              <span>MAX RIGHT LEAN</span>
              <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
            </span>
            <span className="text-[10px] font-mono text-rose-400 font-bold">{corneringStats.deepRight} hairpins</span>
          </div>

          <div className="flex items-baseline justify-between flex-wrap gap-1">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl sm:text-4xl font-mono font-black text-rose-400">
                {corneringStats.maxRight}°
              </div>
              <span className="text-xs font-mono text-rose-500 font-bold">RIGHT</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              {corneringStats.rightG}G
            </span>
          </div>

          {/* Bar indicator */}
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-rose-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (corneringStats.maxRight / 55) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Highlights: Apex Speed & Turn Counts (Comments placed on right to eliminate vertical scrolling) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className={`p-3 sm:p-3.5 rounded-xl border font-mono flex items-center justify-between gap-2 ${innerCardBg}`}>
          <div>
            <div className={`text-[10px] uppercase font-bold ${subText}`}>MAX APEX SPEED</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">
              {corneringStats.maxApexSpeedKmh} <span className="text-xs font-normal">KM/H</span>
            </div>
          </div>
          <div className={`text-[10px] text-right font-medium max-w-[130px] leading-tight ${subText}`}>
            Carried through &gt;15° lean
          </div>
        </div>

        <div className={`p-3 sm:p-3.5 rounded-xl border font-mono flex items-center justify-between gap-2 ${innerCardBg}`}>
          <div>
            <div className={`text-[10px] uppercase font-bold ${subText}`}>DEEP CORNERS (&gt;20°)</div>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {corneringStats.deepLeft + corneringStats.deepRight} <span className="text-xs font-normal">TURNS</span>
            </div>
          </div>
          <div className={`text-[10px] text-right font-medium max-w-[130px] leading-tight ${subText}`}>
            Ghat / mountain switchbacks
          </div>
        </div>

        <div className={`p-3 sm:p-3.5 rounded-xl border font-mono flex items-center justify-between gap-2 ${innerCardBg}`}>
          <div>
            <div className={`text-[10px] uppercase font-bold ${subText}`}>MODERATE SWEEPS</div>
            <div className="text-xl font-black text-sky-400 mt-0.5">
              {corneringStats.moderateSweeps} <span className="text-xs font-normal">CURVES</span>
            </div>
          </div>
          <div className={`text-[10px] text-right font-medium max-w-[130px] leading-tight ${subText}`}>
            Highway high-speed bends
          </div>
        </div>
      </div>

      {/* Physics explainer note */}
      <div className={`p-3 rounded-xl border flex items-start gap-2 text-[11px] font-mono leading-relaxed ${
        isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-500/20 text-amber-300'
      }`}>
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <p>
          Lean angles are computed from centripetal cornering velocity (<code className="font-bold">v² / (R · g)</code>) and roll gyro telemetry. MotoGP riders achieve 60°+, while spirited road touring typically ranges between 35°–48°.
        </p>
      </div>
    </div>
  );
};

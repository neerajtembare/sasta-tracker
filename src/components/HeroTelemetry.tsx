import React from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { 
  Send,
  Watch,
  Bike,
  Flame,
  Mountain,
  Edit3,
  SlidersHorizontal,
  Clock,
  Compass,
  Milestone
} from 'lucide-react';

interface HeroTelemetryProps {
  analysis: RideAnalysis;
  activeScrubPoint?: {
    speedKmh: number;
    elev: number | null;
    bearing: number | null;
    distKm: number;
    lean: number;
  } | null;
  onEditRideName?: () => void;
  onOpenStops?: () => void;
  onOpenCalibration?: () => void;
  theme?: AppTheme;
}

export const HeroTelemetry: React.FC<HeroTelemetryProps> = ({ 
  analysis, 
  activeScrubPoint,
  onEditRideName,
  onOpenStops,
  onOpenCalibration,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const formatTime = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec)) return '00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const startTimeStr = analysis.startTime 
    ? new Date(analysis.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const endTimeStr = analysis.endTime 
    ? new Date(analysis.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const movingPct = Math.round((analysis.movingTimeSeconds / Math.max(1, analysis.totalDurationSeconds)) * 100);

  const displaySpeed = activeScrubPoint
    ? activeScrubPoint.speedKmh.toFixed(1)
    : analysis.maxSpeedKmh.toFixed(1);

  // Effective distance: if user calibrated odometer, use that; otherwise raw GPS distance
  const isCalibrated = Boolean(analysis.userDistanceOverrideKm);
  const totalDisplayDist = isCalibrated
    ? analysis.userDistanceOverrideKm!.toFixed(1)
    : analysis.totalDistanceKm.toFixed(1);

  const currentDist = activeScrubPoint
    ? activeScrubPoint.distKm.toFixed(1)
    : totalDisplayDist;

  // Recalculate moving avg pace if calibrated distance is present
  const effectiveMovingAvgSpeed = isCalibrated && analysis.movingTimeSeconds > 0
    ? (analysis.userDistanceOverrideKm! / (analysis.movingTimeSeconds / 3600)).toFixed(1)
    : analysis.movingAvgSpeedKmh.toFixed(1);

  const cardBg = isLight 
    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' 
    : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const barBg = isLight ? 'bg-slate-200' : 'bg-[#1e2a38]';

  return (
    <div className="w-full space-y-3.5">
      {/* Top Banner Description Bar */}
      <div className={`rounded-xl border p-3.5 sm:p-5 shadow-lg space-y-2.5 transition-colors ${cardBg}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-heading font-black text-base sm:text-xl tracking-wide uppercase truncate">
              {analysis.name}
            </h2>
            {onEditRideName && (
              <button
                onClick={onEditRideName}
                title="Edit ride title"
                className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                  isLight ? 'text-slate-400 hover:text-sky-600 hover:bg-slate-100' : 'text-[#8f9ca8] hover:text-sky-400 hover:bg-[#15202b]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isCalibrated && (
              <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded uppercase">
                Odo: {analysis.userDistanceOverrideKm} km
              </span>
            )}

            {onOpenCalibration && (
              <button
                onClick={onOpenCalibration}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100'
                    : 'bg-[#1a2533] text-sky-400 border-sky-500/30 hover:bg-sky-500/20'
                }`}
                title="Calibrate distance to motorcycle odometer & set mileage"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Calibrate</span>
              </button>
            )}
          </div>
        </div>

        <p className={`text-[11px] sm:text-sm font-mono leading-relaxed ${subText}`}>
          Motorcycle ride telemetry: Speed distribution, altitude profile, saddle efficiency, Strava splits, and pit-stop logging.
        </p>

        {/* Subtitle Badges with Timing & Strava Metrics */}
        <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-[11px] sm:text-xs font-mono ${subText}`}>
          <span className="flex items-center gap-1 text-sky-500 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{startTimeStr} → {endTimeStr}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className={`flex items-center gap-1 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <span>Moving: {formatTime(analysis.movingTimeSeconds)}</span>
            <span className={subText}>({formatTime(analysis.totalDurationSeconds)} total)</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1 text-emerald-500 font-bold">
            <span>Avg: {effectiveMovingAvgSpeed} km/h</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <button
            onClick={onOpenStops}
            className="flex items-center gap-1 text-amber-500 hover:underline cursor-pointer font-bold"
          >
            <span>☕ {analysis.pitStops.length} Stops</span>
          </button>
        </div>
      </div>

      {/* 6 Hero Cards with Technical Bracket Aesthetic */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {/* 1. TOTAL RUN [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-sky-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-sky-500 font-bold">
                <span>[</span>
                TOTAL RUN
              </span>
              <Send className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {currentDist}
              </span>
              <span className="font-mono font-bold text-xs text-sky-500">KM</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-mono ${subText}`}>
              {isCalibrated ? `Raw GPS: ${analysis.totalDistanceKm.toFixed(1)} km` : `${analysis.segments.length} GPX segments`}
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div className="h-full bg-sky-500 w-full rounded-full" />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>

        {/* 2. TOTAL ELAPSED [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-cyan-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-cyan-500 font-bold">
                <span>[</span>
                TOTAL ELAPSED
              </span>
              <Watch className="w-3.5 h-3.5 text-cyan-500" />
            </div>
            <div className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {formatTime(analysis.totalDurationSeconds)}
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] font-mono text-cyan-500 font-bold">
              Includes {analysis.pitStops.length} Pit-Stops
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div className="h-full bg-cyan-500 w-4/5 rounded-full" />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>

        {/* 3. SADDLE TIME [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-emerald-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-emerald-500 font-bold">
                <span>[</span>
                SADDLE TIME
              </span>
              <Bike className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {formatTime(analysis.movingTimeSeconds)}
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] font-mono text-emerald-500 font-bold">
              {movingPct}% Moving Throttle
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div 
                className="h-full bg-emerald-500 rounded-full" 
                style={{ width: `${Math.max(10, movingPct)}%` }}
              />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>

        {/* 4. TOP SPEED [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-rose-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-rose-500 font-bold">
                <span>[</span>
                TOP SPEED
              </span>
              <Flame className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {displaySpeed}
              </span>
              <span className="font-mono font-bold text-xs text-rose-500">KM/H</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-mono ${subText}`}>
              {activeScrubPoint ? 'Scrubbed velocity' : 'Peak burst velocity'}
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div className="h-full bg-rose-500 w-full rounded-full" />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>

        {/* 5. ELEVATION GAIN [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-indigo-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-indigo-500 font-bold">
                <span>[</span>
                ELEV GAIN
              </span>
              <Mountain className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                +{analysis.elevGainM.toFixed(0)}
              </span>
              <span className="font-mono font-bold text-xs text-indigo-500">M</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-mono ${subText}`}>
              {analysis.elevMinM !== null ? `${analysis.elevMinM.toFixed(0)}m` : '0m'} → {analysis.elevMaxM !== null ? `${analysis.elevMaxM.toFixed(0)}m` : 'Peak'}
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div className="h-full bg-indigo-500 w-2/3 rounded-full" />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>

        {/* 6. AVERAGE SPEED [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-amber-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                <span>[</span>
                AVG MOVING
              </span>
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-500 text-[9px] font-mono font-bold rounded">
                PACE
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {effectiveMovingAvgSpeed}
              </span>
              <span className="font-mono font-bold text-xs text-amber-500">KM/H</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-mono ${subText}`}>
              Elapsed: {(isCalibrated && analysis.totalDurationSeconds > 0 ? (analysis.userDistanceOverrideKm! / (analysis.totalDurationSeconds / 3600)).toFixed(1) : analysis.overallAvgSpeedKmh.toFixed(1))} km/h
            </div>
            <div className={`w-full h-1 ${barBg} rounded-full overflow-hidden flex justify-between items-center`}>
              <div className="h-full bg-amber-500 w-4/5 rounded-full" />
              <span className={`text-[10px] font-mono -mt-3.5 mr-0.5 ${subText}`}>]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

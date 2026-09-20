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
  Milestone,
  X,
  Share2,
  Activity
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
  onOpenShare?: () => void;
  onCloseTrack?: () => void;
  onOpenDiagnostics?: () => void;
  theme?: AppTheme;
}

export const HeroTelemetry: React.FC<HeroTelemetryProps> = ({ 
  analysis, 
  activeScrubPoint,
  onEditRideName,
  onOpenStops,
  onOpenCalibration,
  onOpenShare,
  onCloseTrack,
  onOpenDiagnostics,
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
  const stoppedSec = Math.max(0, analysis.totalDurationSeconds - analysis.movingTimeSeconds);
  const stoppedMins = Math.round(stoppedSec / 60);

  // Time of day condition badge
  const getTimeOfDayBadge = (isoDateStr: string | null) => {
    if (!isoDateStr) return null;
    const d = new Date(isoDateStr);
    const hours = d.getHours();
    const mins = d.getMinutes();
    const timeNum = hours + mins / 60;
    if (timeNum >= 4.5 && timeNum < 7.5) {
      return { emoji: '🌅', label: 'Dawn Patrol', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    } else if (timeNum >= 7.5 && timeNum < 12) {
      return { emoji: '☀️', label: 'Morning Twisties', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    } else if (timeNum >= 12 && timeNum < 16.5) {
      return { emoji: '🌤️', label: 'Midday Cruise', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    } else if (timeNum >= 16.5 && timeNum < 19.5) {
      return { emoji: '🌆', label: 'Golden Hour', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    } else {
      return { emoji: '🌙', label: 'Night Ride', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
  };

  const timeOfDay = getTimeOfDayBadge(analysis.startTime);

  // Lateral G-Force calculation: G = tan(leanAngle)
  const currentLean = activeScrubPoint ? (activeScrubPoint.lean || 0) : (analysis.maxEstimatedLean || 0);
  const currentGForce = (Math.tan((currentLean * Math.PI) / 180)).toFixed(2);
  const maxGForce = (Math.tan(((analysis.maxEstimatedLean || 0) * Math.PI) / 180)).toFixed(2);

  // Effective distance: if user calibrated odometer, use that; otherwise raw GPS distance
  const isCalibrated = Boolean(analysis.userDistanceOverrideKm);
  const totalDisplayDist = isCalibrated
    ? analysis.userDistanceOverrideKm!.toFixed(1)
    : analysis.totalDistanceKm.toFixed(1);

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
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="font-heading font-black text-base sm:text-xl tracking-wide uppercase truncate">
              {analysis.name}
            </h2>
            {timeOfDay && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border rounded-full shrink-0 ${timeOfDay.color}`}>
                <span>{timeOfDay.emoji}</span>
                <span>{timeOfDay.label}</span>
              </span>
            )}
            {analysis.activityType && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-full shrink-0">
                <span>{analysis.activityType.emoji}</span>
                <span>{analysis.activityType.label}</span>
              </span>
            )}
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

            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 shadow-xs'
                    : 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25 shadow-xs'
                }`}
                title="Open Complete Telemetry & Raw GPS Specs (Shortcut: D)"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Specs</span>
              </button>
            )}

            {onOpenShare && (
              <button
                onClick={onOpenShare}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title="Create 4:5 Instagram/WhatsApp Story ride card"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Story</span>
              </button>
            )}



            {onCloseTrack && (
              <button
                onClick={onCloseTrack}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                    : 'bg-rose-950/30 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                }`}
                title="Close and unload this track"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Track</span>
              </button>
            )}
          </div>
        </div>



        {/* Subtitle Badges with Timing & Strava Metrics */}
        <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1 text-[11px] sm:text-xs font-mono ${subText}`}>
          <span className="flex items-center gap-1 text-sky-500 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{startTimeStr} → {endTimeStr}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className={`flex items-center gap-1 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <span>Moving: {formatTime(analysis.movingTimeSeconds)}</span>
            <span className="text-emerald-400 font-bold">({movingPct}% in saddle)</span>
          </span>
          {stoppedMins > 0 && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="text-amber-400">
                Breaks: {stoppedMins}m
              </span>
            </>
          )}
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1 text-emerald-500 font-bold">
            <span>Avg: {effectiveMovingAvgSpeed} km/h</span>
          </span>
          {analysis.maxEstimatedLean > 0 && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <span>Max Lean: {Math.round(analysis.maxEstimatedLean)}° ({maxGForce}G)</span>
              </span>
            </>
          )}
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
                {totalDisplayDist}
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

        {/* 3. SADDLE TIME & EFFICIENCY [ ] */}
        <div className={`rounded-xl border p-3.5 flex flex-col justify-between hover:border-emerald-400/50 transition-all ${cardBg}`}>
          <div>
            <div className={`flex items-center justify-between text-[11px] font-mono mb-1.5 ${subText}`}>
              <span className="flex items-center gap-1 text-emerald-500 font-bold">
                <span>[</span>
                SADDLE EFFICIENCY
              </span>
              <Bike className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-black text-xl sm:text-2xl lg:text-3xl tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {movingPct}
              </span>
              <span className="font-mono font-bold text-xs text-emerald-500">%</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] font-mono text-emerald-500 font-bold truncate">
              {formatTime(analysis.movingTimeSeconds)} Moving • {stoppedMins}m Breaks
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
                {analysis.maxSpeedKmh.toFixed(1)}
              </span>
              <span className="font-mono font-bold text-xs text-rose-500">KM/H</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className={`text-[10px] font-mono ${subText}`}>
              Peak burst velocity (GPS recorded)
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

import React from 'react';
import { RideAnalysis, AppTheme, UnitSystem } from '../types';
import { convertSpeed, convertDistance, convertElevation } from '../utils/units';
import { 
  Edit3,
  Clock,
  X,
  Share2,
  Activity,
  FileText,
  BookmarkPlus,
  CheckCircle2,
  Zap
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
  onOpenReport?: () => void;
  onOpenCompare?: () => void;
  onCloseTrack?: () => void;
  onOpenDiagnostics?: () => void;
  onSaveToGarage?: () => void;
  isSavedInGarage?: boolean;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const HeroTelemetry: React.FC<HeroTelemetryProps> = ({ 
  analysis, 
  activeScrubPoint,
  onEditRideName,
  onOpenStops,
  onOpenCalibration,
  onOpenShare,
  onOpenReport,
  onOpenCompare,
  onCloseTrack,
  onOpenDiagnostics,
  onSaveToGarage,
  isSavedInGarage,
  theme = 'dark',
  unitSystem = 'metric',
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
  const rawDistKm = isCalibrated
    ? analysis.userDistanceOverrideKm!
    : analysis.totalDistanceKm;
  const distConverted = convertDistance(rawDistKm, unitSystem);

  // Recalculate moving avg pace if calibrated distance is present
  const rawMovingAvg = isCalibrated && analysis.movingTimeSeconds > 0
    ? (analysis.userDistanceOverrideKm! / (analysis.movingTimeSeconds / 3600))
    : analysis.movingAvgSpeedKmh;
  const movingAvgConverted = convertSpeed(rawMovingAvg, unitSystem);

  const rawOverallAvg = isCalibrated && analysis.totalDurationSeconds > 0
    ? (analysis.userDistanceOverrideKm! / (analysis.totalDurationSeconds / 3600))
    : analysis.overallAvgSpeedKmh;
  const overallAvgConverted = convertSpeed(rawOverallAvg, unitSystem);

  const maxSpeedConverted = convertSpeed(analysis.maxSpeedKmh, unitSystem);
  const elevGainConverted = convertElevation(analysis.elevGainM, unitSystem);
  const elevMinConverted = convertElevation(analysis.elevMinM, unitSystem);
  const elevMaxConverted = convertElevation(analysis.elevMaxM, unitSystem);

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
                Odo: {distConverted.value.toFixed(1)} {distConverted.unit}
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
                <span>Details</span>
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
                title="Create 4:5 story ride card to share"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Card</span>
              </button>
            )}

            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                }`}
                title="Print or export complete PDF summary dossier"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF Dossier</span>
              </button>
            )}

            {onOpenCompare && (
              <button
                id="btn-hero-compare"
                onClick={onOpenCompare}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-xs'
                }`}
                title="Compare this ride side-by-side with another run"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Compare</span>
              </button>
            )}

            {isSavedInGarage ? (
              <span 
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                title="This ride is saved on your device"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved</span>
              </span>
            ) : onSaveToGarage ? (
              <button
                onClick={onSaveToGarage}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-xs'
                }`}
                title="Save this ride permanently to your device"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Save Ride</span>
              </button>
            ) : null}

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
                <span>Close</span>
              </button>
            )}
          </div>
        </div>

        {/* Subtitle Badges with Timing & Simple Stats */}
        <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1 text-[11px] sm:text-xs font-mono ${subText}`}>
          <span className="flex items-center gap-1 text-sky-500 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{startTimeStr} → {endTimeStr}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className={`flex items-center gap-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            <span>Moving: {formatTime(analysis.movingTimeSeconds)}</span>
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
          <button
            onClick={onOpenStops}
            className="flex items-center gap-1 text-amber-500 hover:underline cursor-pointer font-bold"
          >
            <span>☕ {analysis.pitStops.length} Stops</span>
          </button>
        </div>
      </div>

      {/* Sleek Horizontal Metrics Line (Replaces 6 bulky boxes for phone friendliness) */}
      <div className={`rounded-xl border shadow-sm transition-colors overflow-hidden ${cardBg}`}>
        <div className={`grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 ${isLight ? 'divide-slate-200' : 'divide-[#1e2a38]'}`}>
          {/* 1. Distance */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Distance</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {distConverted.value.toFixed(1)}
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-500 uppercase">{distConverted.unit}</span>
            </div>
          </div>

          {/* 2. Total Time */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Ride Time</div>
            <div className={`mt-0.5 font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-slate-900' : 'text-cyan-400'}`}>
              {formatTime(analysis.totalDurationSeconds)}
            </div>
          </div>

          {/* 3. Top Speed */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Top Speed</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="font-mono font-black text-lg sm:text-2xl text-rose-500 truncate">
                {maxSpeedConverted.value.toFixed(1)}
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-500 uppercase">{maxSpeedConverted.unit}</span>
            </div>
          </div>

          {/* 4. Avg Speed */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Avg Speed</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="font-mono font-black text-lg sm:text-2xl text-amber-500 truncate">
                {movingAvgConverted.value.toFixed(1)}
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase">{movingAvgConverted.unit}</span>
            </div>
          </div>

          {/* 5. Max Lean */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Max Lean</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="font-mono font-black text-lg sm:text-2xl text-emerald-400 truncate">
                {analysis.maxEstimatedLean > 0 ? `${Math.round(analysis.maxEstimatedLean)}°` : '—'}
              </span>
            </div>
          </div>

          {/* 6. Climb */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-mono uppercase tracking-wider font-semibold ${subText}`}>Climb</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className="font-mono font-black text-lg sm:text-2xl text-indigo-400 truncate">
                +{elevGainConverted.value?.toFixed(0) ?? '0'}
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase">{elevGainConverted.unit}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

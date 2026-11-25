import React from 'react';
import { RideAnalysis, AppTheme, UnitSystem } from '../types';
import { formatDurationSummary } from '../utils/units';
import { 
  Edit3,
  Clock,
  Share2,
  Activity,
  FileText,
  BookmarkPlus,
  CheckCircle2,
  GitCompareArrows,
  Coffee,
  Sunrise,
  Sun,
  CloudSun,
  Sunset,
  Moon,
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
  onOpenShare?: () => void;
  onOpenReport?: () => void;
  onOpenCompare?: () => void;
  onOpenDiagnostics?: () => void;
  onSaveToGarage?: () => void;
  isSavedInGarage?: boolean;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const HeroTelemetry: React.FC<HeroTelemetryProps> = ({ 
  analysis, 
  activeScrubPoint: _activeScrubPoint,
  onEditRideName,
  onOpenStops,
  onOpenShare,
  onOpenReport,
  onOpenCompare,
  onOpenDiagnostics,
  onSaveToGarage,
  isSavedInGarage,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const startTimeStr = analysis.startTime 
    ? new Date(analysis.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const endTimeStr = analysis.endTime 
    ? new Date(analysis.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

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
      return { Icon: Sunrise, label: 'Dawn Patrol', color: isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    } else if (timeNum >= 7.5 && timeNum < 12) {
      return { Icon: Sun, label: 'Morning Twisties', color: isLight ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    } else if (timeNum >= 12 && timeNum < 16.5) {
      return { Icon: CloudSun, label: 'Midday Cruise', color: isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    } else if (timeNum >= 16.5 && timeNum < 19.5) {
      return { Icon: Sunset, label: 'Golden Hour', color: isLight ? 'bg-orange-50 text-orange-800 border-orange-300' : 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    } else {
      return { Icon: Moon, label: 'Night Ride', color: isLight ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    }
  };

  const timeOfDay = getTimeOfDayBadge(analysis.startTime);

  // Effective distance: if user calibrated odometer, use that; otherwise raw GPS distance
  const isCalibrated = Boolean(analysis.userDistanceOverrideKm);
  const rawDistKm = isCalibrated
    ? analysis.userDistanceOverrideKm!
    : analysis.totalDistanceKm;

  // Recalculate moving avg pace if calibrated distance is present
  const rawMovingAvg = isCalibrated && analysis.movingTimeSeconds > 0
    ? (analysis.userDistanceOverrideKm! / (analysis.movingTimeSeconds / 3600))
    : analysis.movingAvgSpeedKmh;

  const cardBg = isLight 
    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' 
    : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const subText = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';

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
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans font-bold border rounded-full shrink-0 ${timeOfDay.color}`}>
                <timeOfDay.Icon className="w-3 h-3" />
                <span>{timeOfDay.label}</span>
              </span>
            )}
            {analysis.activityType && (
              <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans font-bold border rounded-full shrink-0 ${
                isLight ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              }`}>
                <span>{analysis.activityType.label}</span>
              </span>
            )}
            {onEditRideName && (
              <button
                type="button"
                onClick={onEditRideName}
                title="Edit ride title"
                aria-label="Edit ride title"
                className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                  isLight ? 'text-slate-500 hover:text-sky-700 hover:bg-slate-100' : 'text-[#8f9ca8] hover:text-sky-400 hover:bg-[#15202b]'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isCalibrated && (
              <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-sans font-bold border rounded uppercase telemetry-num ${
                isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                Odo: {rawDistKm.toFixed(1)} km
              </span>
            )}

            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100 shadow-xs'
                    : 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25 shadow-xs'
                }`}
                title="Open Complete Telemetry & Raw GPS Specs (Shortcut: D)"
              >
                <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                <span>Details</span>
              </button>
            )}

            {onOpenShare && (
              <button
                type="button"
                onClick={onOpenShare}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title="Create 4:5 story ride card to share"
              >
                <Share2 className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                <span className="hidden xs:inline">Share Card</span>
                <span className="xs:hidden">Share</span>
              </button>
            )}

            {onOpenReport && (
              <button
                type="button"
                onClick={onOpenReport}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                }`}
                title="Print or export complete PDF summary dossier"
              >
                <FileText className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                <span className="hidden xs:inline">PDF Dossier</span>
                <span className="xs:hidden">PDF</span>
              </button>
            )}

            {onOpenCompare && (
              <button
                id="btn-hero-compare"
                type="button"
                onClick={onOpenCompare}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-xs'
                }`}
                title="Compare this ride side-by-side with another run"
              >
                <GitCompareArrows className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                <span>Compare</span>
              </button>
            )}

            {isSavedInGarage ? (
              <span 
                className={`flex items-center gap-1 px-2 py-1 text-xs font-sans font-bold rounded-lg border ${
                  isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
                title="This ride is saved on your device"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Saved</span>
              </span>
            ) : onSaveToGarage ? (
              <button
                type="button"
                onClick={onSaveToGarage}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-sans font-bold rounded-lg border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-xs'
                }`}
                title="Save this ride permanently to your device"
              >
                <BookmarkPlus className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                <span>Save</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Subtitle Badges with Timing & Simple Stats */}
        <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-1 text-[11px] sm:text-xs font-sans telemetry-num ${subText}`}>
          <span className={`flex items-center gap-1 font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{startTimeStr} → {endTimeStr}</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className={`flex items-center gap-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
            <span>Moving: {formatDurationSummary(analysis.movingTimeSeconds)}</span>
          </span>
          {stoppedMins > 0 && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className={isLight ? 'text-amber-700 font-semibold' : 'text-amber-400'}>
                Breaks: {formatDurationSummary(stoppedSec)}
              </span>
            </>
          )}
          <span className="hidden sm:inline">•</span>
          <button
            type="button"
            onClick={onOpenStops}
            className={`flex items-center gap-1 hover:underline cursor-pointer font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>{analysis.pitStops.length} Stops</span>
          </button>
        </div>
      </div>

      {/* Sleek Horizontal Metrics Line */}
      <div className={`rounded-xl border shadow-sm transition-colors overflow-hidden telemetry-num ${cardBg}`}>
        <div className={`grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 ${isLight ? 'divide-slate-200' : 'divide-[#1e2a38]'}`}>
          {/* 1. Distance */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Distance</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {rawDistKm.toFixed(1)}
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-sky-700' : 'text-sky-500'}`}>km</span>
            </div>
          </div>

          {/* 2. Total Time */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Ride Time</div>
            <div className={`mt-0.5 font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-slate-900' : 'text-cyan-400'}`}>
              {formatDurationSummary(analysis.totalDurationSeconds)}
            </div>
          </div>

          {/* 3. Top Speed */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Top Speed</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                {analysis.maxSpeedKmh.toFixed(1)}
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>km/h</span>
            </div>
          </div>

          {/* 4. Avg Speed */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Avg Speed</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                {rawMovingAvg.toFixed(1)}
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>km/h</span>
            </div>
          </div>

          {/* 5. Max Lean */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Max Lean</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {analysis.maxEstimatedLean > 0 ? `${Math.round(analysis.maxEstimatedLean)}°` : '—'}
              </span>
            </div>
          </div>

          {/* 6. Climb */}
          <div className="p-2 sm:p-3 text-center">
            <div className={`text-[10px] sm:text-[11px] font-sans uppercase tracking-wider font-semibold ${subText}`}>Climb</div>
            <div className="flex items-baseline justify-center gap-0.5 mt-0.5">
              <span className={`font-mono font-black text-lg sm:text-2xl truncate ${isLight ? 'text-indigo-700' : 'text-indigo-400'}`}>
                +{Math.round(analysis.elevGainM ?? 0)}
              </span>
              <span className={`text-[10px] font-mono font-bold uppercase ${isLight ? 'text-indigo-700' : 'text-indigo-400'}`}>m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

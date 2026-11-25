import React, { useState } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { formatDurationSummary } from '../utils/units';
import { getRiderProfile } from '../utils/riderProfile';
import {
  Flame,
  Fuel,
  Zap,
  Clock,
  Info,
  SlidersHorizontal,
  HelpCircle
} from 'lucide-react';

interface RideInsightsCardProps {
  analysis: RideAnalysis;
  onOpenCalibration?: () => void;
  theme?: AppTheme;
}

export const RideInsightsCard: React.FC<RideInsightsCardProps> = ({
  analysis,
  onOpenCalibration,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [showLeanHelp, setShowLeanHelp] = useState<boolean>(false);
  const profile = getRiderProfile();

  // Effective distance: calibrated odometer distance or raw GPS distance
  const effectiveDistance = analysis.userDistanceOverrideKm || analysis.totalDistanceKm;
  const isDistanceCalibrated = Boolean(analysis.userDistanceOverrideKm);

  // Fuel calculations (using ride calibration override -> saved bike profile default)
  const kmPerLiter = analysis.fuelMileageKmpl || profile.fuelMileageKmpl || 32;
  const fuelPrice = analysis.fuelPricePerLiter || profile.fuelPricePerLiter || 104;
  const currencySymbol = profile.currencySymbol || '₹';
  const estimatedFuelLiters = analysis.customFuelLiters
    ? analysis.customFuelLiters
    : kmPerLiter > 0 ? effectiveDistance / kmPerLiter : 0;
  const estimatedFuelCost = estimatedFuelLiters * fuelPrice;

  // Moving ratio
  const totalSec = analysis.totalDurationSeconds || 1;
  const movingRatio = Math.round((analysis.movingTimeSeconds / totalSec) * 100);

  // Lean angle rating (Physics estimation from centripetal turn radius & velocity)
  const lean = analysis.maxEstimatedLean || 0;
  const getLeanRating = (deg: number) => {
    if (deg >= 45) {
      return {
        label: 'Trackday Knee-Down',
        color: isLight ? 'text-rose-700' : 'text-rose-400',
        bg: isLight ? 'bg-rose-50 border border-rose-200' : 'bg-rose-500/15',
      };
    }
    if (deg >= 35) {
      return {
        label: 'Aggressive Canyon Lean',
        color: isLight ? 'text-amber-700' : 'text-amber-400',
        bg: isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-400/15',
      };
    }
    if (deg >= 22) {
      return {
        label: 'Sport Touring Flow',
        color: isLight ? 'text-emerald-700' : 'text-emerald-400',
        bg: isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-400/15',
      };
    }
    return {
      label: 'Upright Highway Cruise',
      color: isLight ? 'text-sky-700' : 'text-sky-400',
      bg: isLight ? 'bg-sky-50 border border-sky-200' : 'bg-sky-400/15',
    };
  };
  const leanRating = getLeanRating(lean);

  // Elevation climb rate (meters gained per kilometer)
  const climbRate = effectiveDistance > 0 ? (analysis.elevGainM / effectiveDistance) : 0;
  const bikeLabel = analysis.bikeModel || profile.bikeModel || 'Motorcycle';

  return (
    <div
      className={`rounded-2xl border transition-colors shadow-lg overflow-hidden ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100'
          : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 sm:px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
            isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}>
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider">
                Ride Performance &amp; Insights
              </h3>
              {isDistanceCalibrated && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}>
                  Odo Calibrated: {effectiveDistance.toFixed(1)} km
                </span>
              )}
            </div>
            <p className={`text-[11px] font-sans ${isLight ? 'text-slate-600' : 'text-[#8f9ca8]'}`}>
              {bikeLabel} • GPS Telemetry &amp; Efficiency Analysis
            </p>
          </div>
        </div>

        {/* Calibration Action Button */}
        {onOpenCalibration && (
          <button
            onClick={onOpenCalibration}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-sky-50 text-sky-700 border-sky-200 shadow-sm'
                : 'bg-[#1a2533] hover:bg-sky-500/20 text-sky-400 border-sky-500/30'
            }`}
            title="Edit distance, bike model & fuel mileage"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Calibrate Distance &amp; Fuel</span>
          </button>
        )}
      </div>

      {/* Lean angle explanation banner if opened */}
      {showLeanHelp && (
        <div
          className={`p-3.5 border-b text-xs leading-relaxed flex items-start gap-2.5 ${
            isLight ? 'bg-amber-50/90 border-amber-200 text-amber-950' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
          }`}
        >
          <Info className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
          <div className="space-y-1 font-sans">
            <p className="font-bold">How is Lean Angle calculated without a Gyro?</p>
            <p className="text-[11px]">
              Standard GPX files recorded by GPS loggers do <strong>not</strong> contain physical IMU gyroscope sensors. We estimate lean angle using motorcycle cornering physics: <code className="font-mono">θ = arctan(v² / g·R)</code> based on your velocity <code className="font-mono">v</code> and turning radius <code className="font-mono">R</code> derived from consecutive GPS heading deltas.
            </p>
          </div>
        </div>
      )}

      {/* Main 4 Insights Columns */}
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Insight 1: Peak Lean Angle with Physics disclaimer */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-[#8f9ca8]'}`}>
                EST. CORNER LEAN
              </span>
              <button
                type="button"
                onClick={() => setShowLeanHelp(!showLeanHelp)}
                aria-label="How is corner lean estimated?"
                className={`transition-colors cursor-pointer ${isLight ? 'text-slate-600 hover:text-amber-700' : 'text-slate-400 hover:text-amber-400'}`}
                title="How is lean estimated?"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-heading font-black text-3xl tracking-tight telemetry-num">
                {lean}°
              </span>
              <span className={`text-xs font-mono font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>EST. ROLL</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${leanRating.bg} ${leanRating.color}`}
              >
                {leanRating.label}
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-600 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
            Physics model: centripetal turn radius (v²/gR)
          </p>
        </div>

        {/* Insight 2: Maximum Speed Burst */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-[#8f9ca8]'}`}>
                TOP SPEED RECORDED
              </span>
              <Zap className={`w-4 h-4 ${isLight ? 'text-rose-600' : 'text-rose-500'}`} />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className={`font-heading font-black text-3xl tracking-tight telemetry-num ${isLight ? 'text-rose-700' : 'text-rose-500'}`}>
                {analysis.maxSpeedKmh.toFixed(1)}
              </span>
              <span className={`text-xs font-mono font-bold uppercase ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>km/h</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLight ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {analysis.movingAvgSpeedKmh > 0 && analysis.maxSpeedKmh - analysis.movingAvgSpeedKmh >= 0.5
                  ? `+${(analysis.maxSpeedKmh - analysis.movingAvgSpeedKmh).toFixed(1)} km/h burst over moving avg`
                  : analysis.movingAvgSpeedKmh > 0
                  ? 'Steady cruise pace'
                  : 'Recorded Peak'}
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-600 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
            Verified across consecutive GPS Doppler fixes
          </p>
        </div>

        {/* Insight 3: Calibrated Fuel Used */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-[#8f9ca8]'}`}>
                FUEL CONSUMPTION
              </span>
              <Fuel className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className={`font-heading font-black text-3xl tracking-tight telemetry-num ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                {estimatedFuelLiters.toFixed(2)}
              </span>
              <span className={`text-xs font-mono font-bold uppercase ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>L</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold telemetry-num ${
                  isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/15 text-sky-400'
                }`}
              >
                ~{currencySymbol}{Math.round(estimatedFuelCost)} (@ {currencySymbol}{fuelPrice}/L)
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-600 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
            Configured at {kmPerLiter} km/L for {effectiveDistance.toFixed(1)} km
          </p>
        </div>

        {/* Insight 4: Saddle Efficiency & Elevation Gain */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-[#8f9ca8]'}`}>
                SADDLE EFFICIENCY
              </span>
              <Clock className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className={`font-heading font-black text-3xl tracking-tight telemetry-num ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                {movingRatio}%
              </span>
              <span className={`text-xs font-mono font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>ROLLING</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold telemetry-num ${
                  isLight ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-amber-400/15 text-amber-300'
                }`}
              >
                Climbing Rate: {climbRate.toFixed(1)} m / km
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-600 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
            Total stopped duration: {formatDurationSummary(analysis.stoppedTimeSeconds)}
          </p>
        </div>
      </div>
    </div>
  );
};

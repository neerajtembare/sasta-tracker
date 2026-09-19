import React, { useState } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { 
  Flame, 
  Fuel, 
  Compass, 
  Gauge, 
  Zap, 
  Clock, 
  Mountain, 
  TrendingUp,
  Settings2,
  Info,
  SlidersHorizontal,
  HelpCircle,
  IndianRupee
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

  // Effective distance: calibrated odometer distance or raw GPS distance
  const effectiveDistance = analysis.userDistanceOverrideKm || analysis.totalDistanceKm;
  const isDistanceCalibrated = Boolean(analysis.userDistanceOverrideKm);

  // Fuel calculations
  const kmPerLiter = analysis.fuelMileageKmpl || 32;
  const fuelPrice = analysis.fuelPricePerLiter || 104;
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
    if (deg >= 45) return { label: 'Trackday Knee-Down', color: 'text-rose-500', bg: 'bg-rose-500/15' };
    if (deg >= 35) return { label: 'Aggressive Canyon Lean', color: 'text-amber-400', bg: 'bg-amber-400/15' };
    if (deg >= 22) return { label: 'Sport Touring Flow', color: 'text-emerald-400', bg: 'bg-emerald-400/15' };
    return { label: 'Upright Highway Cruise', color: 'text-sky-400', bg: 'bg-sky-400/15' };
  };
  const leanRating = getLeanRating(lean);

  // Elevation climb rate (meters per kilometer)
  const climbRateMPerKm = effectiveDistance > 0 ? (analysis.elevGainM / effectiveDistance) : 0;

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
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider">
                Ride Performance & Insights
              </h3>
              {isDistanceCalibrated && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Odo Calibrated: {effectiveDistance.toFixed(1)} km
                </span>
              )}
            </div>
            <p className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
              {analysis.bikeModel || 'Motorcycle'} • GPS Telemetry & Efficiency Analysis
            </p>
          </div>
        </div>

        {/* Calibration Action Button */}
        {onOpenCalibration && (
          <button
            onClick={onOpenCalibration}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-sky-50 text-sky-600 border-sky-200 shadow-sm'
                : 'bg-[#1a2533] hover:bg-sky-500/20 text-sky-400 border-sky-500/30'
            }`}
            title="Edit distance, bike model & fuel mileage"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Calibrate Distance & Fuel</span>
          </button>
        )}
      </div>

      {/* Lean angle explanation banner if opened */}
      {showLeanHelp && (
        <div
          className={`p-3.5 border-b text-xs leading-relaxed flex items-start gap-2.5 ${
            isLight ? 'bg-amber-50/80 border-amber-200 text-amber-950' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
          }`}
        >
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">How is Lean Angle calculated without a Gyro?</p>
            <p className="text-[11px]">
              Standard GPX files recorded by phone apps (or GPS watches) do <strong>not</strong> contain physical IMU gyroscope sensors. We calculate lean angle using classical motorcycle physics: <code>θ = arctan(v² / g·R)</code> based on your velocity <code>v</code> and the turning radius <code>R</code> derived from consecutive GPS heading deltas. On cambered roads or with countersteering, this provides an accurate benchmark for cornering aggression!
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
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
                EST. CORNER LEAN
              </span>
              <button
                onClick={() => setShowLeanHelp(!showLeanHelp)}
                className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                title="How is lean estimated?"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-heading font-black text-3xl tracking-tight">
                {lean}°
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">EST. ROLL</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${leanRating.bg} ${leanRating.color}`}
              >
                {leanRating.label}
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-500 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
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
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
                TOP SPEED RECORDED
              </span>
              <Zap className="w-4 h-4 text-rose-500" />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-heading font-black text-3xl tracking-tight text-rose-500">
                {analysis.maxSpeedKmh.toFixed(1)}
              </span>
              <span className="text-xs font-mono font-bold text-rose-400">KM/H</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLight ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {analysis.movingAvgSpeedKmh > 0
                  ? `+${(analysis.maxSpeedKmh - analysis.movingAvgSpeedKmh).toFixed(1)} km/h burst over moving avg`
                  : 'Recorded Peak'}
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-500 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
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
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
                FUEL CONSUMPTION
              </span>
              <Fuel className="w-4 h-4 text-sky-400" />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-heading font-black text-3xl tracking-tight text-sky-400">
                {estimatedFuelLiters.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-bold text-sky-400">LITERS</span>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/15 text-sky-400'
                }`}
              >
                ~₹{Math.round(estimatedFuelCost)} (@ ₹{fuelPrice}/L)
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-500 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
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
              <span className={`text-[11px] font-mono uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
                SADDLE EFFICIENCY
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-heading font-black text-3xl tracking-tight text-amber-400">
                {movingRatio}%
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">ROLLING</span>
            </div>

            <div className="mt-2.5">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-400/15 text-amber-300'
                }`}
              >
                Climbing Rate: {climbRateMPerKm.toFixed(1)} m / km
              </span>
            </div>
          </div>

          <p className={`text-[10px] font-mono mt-3 pt-2 border-t ${isLight ? 'text-slate-500 border-slate-200' : 'text-[#8f9ca8] border-[#1e2a38]'}`}>
            Total stopped duration: {Math.round(analysis.stoppedTimeSeconds / 60)} min
          </p>
        </div>
      </div>
    </div>
  );
};

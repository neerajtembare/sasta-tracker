import React, { useState, useEffect } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { X, Gauge, Fuel, Bike, Check, RotateCcw, Info } from 'lucide-react';
import { getRiderProfile } from '../utils/riderProfile';

interface RideCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: RideAnalysis;
  onSaveCalibration: (updated: {
    userDistanceOverrideKm?: number | null;
    bikeModel?: string;
    fuelMileageKmpl?: number;
    fuelPricePerLiter?: number;
    customFuelLiters?: number | null;
    userNotes?: string;
  }) => void;
  theme?: AppTheme;
}

export const RideCalibrationModal: React.FC<RideCalibrationModalProps> = ({
  isOpen,
  onClose,
  analysis,
  onSaveCalibration,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const profile = getRiderProfile();
  const defaultMileage = profile.fuelMileageKmpl || 32;
  const defaultFuelPrice = profile.fuelPricePerLiter || 104;
  const currencySymbol = profile.currencySymbol || '₹';

  // Local state initialized with current analysis or saved bike profile defaults
  const [distanceMode, setDistanceMode] = useState<'gps' | 'odometer'>(
    analysis.userDistanceOverrideKm ? 'odometer' : 'gps'
  );
  const [odometerKm, setOdometerKm] = useState<string>(
    analysis.userDistanceOverrideKm ? String(analysis.userDistanceOverrideKm) : analysis.totalDistanceKm.toFixed(1)
  );
  const [bikeModel, setBikeModel] = useState<string>(analysis.bikeModel || profile.bikeModel || 'Motorcycle');
  const [fuelMileage, setFuelMileage] = useState<number>(analysis.fuelMileageKmpl || defaultMileage);
  const [fuelPrice, setFuelPrice] = useState<number>(analysis.fuelPricePerLiter || defaultFuelPrice);
  const [fuelMode, setFuelMode] = useState<'mileage' | 'actualLiters'>(
    analysis.customFuelLiters ? 'actualLiters' : 'mileage'
  );
  const [actualLiters, setActualLiters] = useState<string>(
    analysis.customFuelLiters ? String(analysis.customFuelLiters) : ''
  );
  const [userNotes, setUserNotes] = useState<string>(analysis.userNotes || '');

  // Keep modal inputs synchronized when opening a different ride
  useEffect(() => {
    if (!isOpen) return;
    const latestProfile = getRiderProfile();
    setDistanceMode(analysis.userDistanceOverrideKm ? 'odometer' : 'gps');
    setOdometerKm(
      analysis.userDistanceOverrideKm ? String(analysis.userDistanceOverrideKm) : analysis.totalDistanceKm.toFixed(1)
    );
    setBikeModel(analysis.bikeModel || latestProfile.bikeModel || 'Motorcycle');
    setFuelMileage(analysis.fuelMileageKmpl || latestProfile.fuelMileageKmpl || 32);
    setFuelPrice(analysis.fuelPricePerLiter || latestProfile.fuelPricePerLiter || 104);
    setFuelMode(analysis.customFuelLiters ? 'actualLiters' : 'mileage');
    setActualLiters(analysis.customFuelLiters ? String(analysis.customFuelLiters) : '');
    setUserNotes(analysis.userNotes || '');
  }, [isOpen, analysis]);

  if (!isOpen) return null;

  const rawGpsKm = analysis.totalDistanceKm;
  const effectiveDistanceKm =
    distanceMode === 'odometer' && parseFloat(odometerKm) > 0
      ? parseFloat(odometerKm)
      : rawGpsKm;

  // Calculated fuel stats
  const calculatedLiters =
    fuelMode === 'actualLiters' && parseFloat(actualLiters) > 0
      ? parseFloat(actualLiters)
      : fuelMileage > 0
      ? effectiveDistanceKm / fuelMileage
      : 0;

  const calculatedRealMileage =
    fuelMode === 'actualLiters' && parseFloat(actualLiters) > 0
      ? effectiveDistanceKm / parseFloat(actualLiters)
      : fuelMileage;

  const calculatedCost = calculatedLiters * fuelPrice;

  const handleSave = () => {
    onSaveCalibration({
      userDistanceOverrideKm:
        distanceMode === 'odometer' && parseFloat(odometerKm) > 0
          ? parseFloat(odometerKm)
          : null,
      bikeModel: bikeModel.trim() || undefined,
      fuelMileageKmpl: fuelMode === 'mileage' ? fuelMileage : Math.round(calculatedRealMileage * 10) / 10,
      fuelPricePerLiter: fuelPrice,
      customFuelLiters:
        fuelMode === 'actualLiters' && parseFloat(actualLiters) > 0
          ? parseFloat(actualLiters)
          : null,
      userNotes: userNotes.trim() || undefined,
    });
    onClose();
  };

  const handleResetToGps = () => {
    setDistanceMode('gps');
    setOdometerKm(rawGpsKm.toFixed(1));
    setFuelMode('mileage');
    setFuelMileage(defaultMileage);
    setFuelPrice(defaultFuelPrice);
    setActualLiters('');
  };

  const modalBg = isLight ? 'bg-white text-slate-900' : 'bg-[#0d131a] text-white';
  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#223140]';
  const inputBg = isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#0a0f14] border-[#223140] text-white focus:border-sky-400';
  const subText = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col max-h-[90dvh] overscroll-contain overflow-hidden cursor-default ${modalBg} ${
          isLight ? 'border-slate-300' : 'border-[#1e2a38]'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e2a38] bg-[#111922]'}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}>
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-black text-sm sm:text-base uppercase tracking-wider">
                Ride Calibration &amp; Bike Settings
              </h2>
              <p className={`text-xs ${subText}`}>
                Adjust distance to match your bike's odometer &amp; calibrate fuel
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close ride calibration modal"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1a2530]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto font-sans text-xs">
          {/* 1. Distance Calibration */}
          <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className={`w-4 h-4 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                <span className="font-bold text-sm">Total Distance Calibration</span>
              </div>
              <span className={`text-[11px] font-mono telemetry-num ${subText}`}>
                Raw GPS: {rawGpsKm.toFixed(1)} km
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDistanceMode('gps')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  distanceMode === 'gps'
                    ? 'border-sky-500 bg-sky-500/10 font-bold'
                    : isLight
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-[#223140] bg-[#0a0f14] hover:border-slate-600'
                }`}
              >
                <div className="text-xs">Raw GPS Distance</div>
                <div className={`font-mono text-sm font-black telemetry-num ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{rawGpsKm.toFixed(1)} km</div>
              </button>

              <button
                type="button"
                onClick={() => setDistanceMode('odometer')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  distanceMode === 'odometer'
                    ? 'border-emerald-500 bg-emerald-500/10 font-bold'
                    : isLight
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-[#223140] bg-[#0a0f14] hover:border-slate-600'
                }`}
              >
                <div className="text-xs">Bike Odometer / Trip Meter</div>
                <div className={`font-mono text-sm font-black telemetry-num ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {odometerKm || rawGpsKm.toFixed(1)} km
                </div>
              </button>
            </div>

            {distanceMode === 'odometer' && (
              <div className="pt-2 space-y-1.5">
                <label className={`block text-[11px] font-medium ${subText}`}>
                  Enter bike odometer reading for this trip (km):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={odometerKm}
                    onChange={e => setOdometerKm(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-sm ${inputBg}`}
                    placeholder={rawGpsKm.toFixed(1)}
                  />
                  <span className="font-mono text-xs font-bold">KM</span>
                </div>
              </div>
            )}

            <div className={`text-[11px] leading-relaxed p-2.5 rounded-lg flex items-start gap-2 ${
              isLight ? 'bg-sky-50 text-sky-900 border border-sky-100' : 'bg-sky-950/40 text-sky-200 border border-sky-800/40'
            }`}>
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
              <span>
                <strong>Why does GPS differ from your bike odometer?</strong> Longer GPS intervals can cut tight corners on winding mountain passes, yielding straight chords instead of curved asphalt arcs. Calibrate to your motorcycle odometer to see exact real-world distance and fuel averages.
              </span>
            </div>
          </div>

          {/* 2. Bike Profile & Model */}
          <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
            <div className="flex items-center gap-2">
              <Bike className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
              <span className="font-bold text-sm">Motorcycle Details</span>
            </div>

            <div>
              <label className={`block text-[11px] font-medium mb-1 ${subText}`}>
                Bike Model / Nickname:
              </label>
              <input
                type="text"
                value={bikeModel}
                onChange={e => setBikeModel(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border font-medium ${inputBg}`}
                placeholder="e.g. Himalayan 450, Duke 390, Interceptor 650"
              />
            </div>
          </div>

          {/* 3. Fuel Calibration (Mileage rate vs Actual Liters) */}
          <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                <span className="font-bold text-sm">Fuel Consumption &amp; Cost</span>
              </div>
              <span className={`text-[11px] font-mono font-bold telemetry-num ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                ~{calculatedLiters.toFixed(1)} L ({currencySymbol}{Math.round(calculatedCost)})
              </span>
            </div>

            {/* Mode selection: Enter expected mileage vs enter exact liters filled */}
            <div className={`flex rounded-lg p-0.5 border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-slate-800'}`}>
              <button
                type="button"
                onClick={() => setFuelMode('mileage')}
                className={`flex-1 py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  fuelMode === 'mileage'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                Set Expected Mileage (km/L)
              </button>
              <button
                type="button"
                onClick={() => setFuelMode('actualLiters')}
                className={`flex-1 py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  fuelMode === 'actualLiters'
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                Enter Fuel Filled (Liters)
              </button>
            </div>

            {fuelMode === 'mileage' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-medium ${subText}`}>Average Mileage:</label>
                  <span className={`font-mono font-bold telemetry-num ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{fuelMileage} km/L</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="65"
                  step="1"
                  value={fuelMileage}
                  onChange={e => setFuelMileage(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex gap-1.5 pt-1 overflow-x-auto">
                  {[22, 28, 32, 36, 45].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFuelMileage(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                        fuelMileage === preset
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : isLight
                          ? 'bg-white border-slate-300 text-slate-700'
                          : 'bg-[#0a0f14] border-[#223140] text-slate-300'
                      }`}
                    >
                      {preset} km/L
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className={`block text-[11px] font-medium ${subText}`}>
                  Actual Liters filled at fuel pump:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={actualLiters}
                    onChange={e => setActualLiters(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border font-mono font-bold text-sm ${inputBg}`}
                    placeholder="e.g. 7.5"
                  />
                  <span className="font-mono text-xs font-bold">Liters</span>
                </div>
                {parseFloat(actualLiters) > 0 && (
                  <div className={`text-[11px] font-mono border p-2 rounded-lg telemetry-num ${
                    isLight ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                    Real-world Calculated Mileage: <strong>{calculatedRealMileage.toFixed(1)} km/L</strong> for {effectiveDistanceKm.toFixed(1)} km.
                  </div>
                )}
              </div>
            )}

            {/* Fuel Price */}
            <div className={`pt-2 flex items-center justify-between gap-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <span className={`text-[11px] ${subText}`}>Fuel Price per Liter:</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs">{currencySymbol}</span>
                <input
                  type="number"
                  step="1"
                  value={fuelPrice}
                  onChange={e => setFuelPrice(Number(e.target.value))}
                  className={`w-20 px-2 py-1 rounded border font-mono font-bold text-right text-xs ${inputBg}`}
                />
              </div>
            </div>
          </div>

          {/* 4. Ride Notes */}
          <div>
            <label className={`block text-[11px] font-medium mb-1 ${subText}`}>
              Trip Notes / Rider Memory:
            </label>
            <textarea
              value={userNotes}
              onChange={e => setUserNotes(e.target.value)}
              rows={2}
              className={`w-full px-3 py-2 rounded-lg border text-xs ${inputBg}`}
              placeholder="e.g. Breakfast run, great tarmac on highway, twisties on mountain pass."
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between gap-3 ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e2a38] bg-[#111922]'
          }`}
        >
          <button
            type="button"
            onClick={handleResetToGps}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-300 text-slate-600 hover:bg-slate-200'
                : 'border-[#223140] text-[#8f9ca8] hover:text-white hover:bg-[#1a2530]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to GPS</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-[#8f9ca8] hover:text-white hover:bg-[#1a2530]'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Calibration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

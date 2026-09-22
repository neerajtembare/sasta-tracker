import React, { useState } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { X, Gauge, Fuel, Bike, Check, RotateCcw, Info, Sparkles, IndianRupee } from 'lucide-react';

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

  // Local state initialized with current analysis or defaults
  const [distanceMode, setDistanceMode] = useState<'gps' | 'odometer'>(
    analysis.userDistanceOverrideKm ? 'odometer' : 'gps'
  );
  const [odometerKm, setOdometerKm] = useState<string>(
    analysis.userDistanceOverrideKm ? String(analysis.userDistanceOverrideKm) : analysis.totalDistanceKm.toFixed(1)
  );
  const [bikeModel, setBikeModel] = useState<string>(analysis.bikeModel || 'Motorcycle');
  const [fuelMileage, setFuelMileage] = useState<number>(analysis.fuelMileageKmpl || 32);
  const [fuelPrice, setFuelPrice] = useState<number>(analysis.fuelPricePerLiter || 104);
  const [fuelMode, setFuelMode] = useState<'mileage' | 'actualLiters'>(
    analysis.customFuelLiters ? 'actualLiters' : 'mileage'
  );
  const [actualLiters, setActualLiters] = useState<string>(
    analysis.customFuelLiters ? String(analysis.customFuelLiters) : ''
  );
  const [userNotes, setUserNotes] = useState<string>(analysis.userNotes || '');

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
    setFuelMileage(32);
    setFuelPrice(104);
    setActualLiters('');
  };

  const modalBg = isLight ? 'bg-white text-slate-900' : 'bg-[#0d131a] text-white';
  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#223140]';
  const inputBg = isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-sky-500' : 'bg-[#0a0f14] border-[#223140] text-white focus:border-sky-400';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl flex flex-col max-h-[92dvh] overscroll-contain overflow-hidden ${modalBg} ${
          isLight ? 'border-slate-300' : 'border-[#1e2a38]'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[#1e2a38] bg-[#111922]'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-black text-sm sm:text-base uppercase tracking-wider">
                Ride Calibration & Bike Settings
              </h2>
              <p className={`text-xs ${subText}`}>
                Adjust distance to match your bike's odometer & calibrate fuel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1a2530]'
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
                <Gauge className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-sm">Total Distance Calibration</span>
              </div>
              <span className={`text-[11px] font-mono ${subText}`}>
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
                <div className="font-mono text-sm font-black text-sky-400">{rawGpsKm.toFixed(1)} km</div>
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
                <div className="font-mono text-sm font-black text-emerald-400">
                  {odometerKm || '227.0'} km
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
                    placeholder="e.g. 227.0"
                  />
                  <span className="font-mono text-xs font-bold">KM</span>
                </div>
              </div>
            )}

            <div className={`text-[11px] leading-relaxed p-2.5 rounded-lg flex items-start gap-2 ${
              isLight ? 'bg-sky-50 text-sky-900 border border-sky-100' : 'bg-sky-950/40 text-sky-200 border border-sky-800/40'
            }`}>
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>Why does GPS differ from your bike odometer?</strong> GPS logger intervals (30s–60s) cut corners on winding mountain roads (Ghats), yielding straight chords instead of curved asphalt arcs. Calibrate to your motorcycle odometer to see exact real-world distance & accurate speed/mileage averages!
              </span>
            </div>
          </div>

          {/* 2. Bike Profile & Model */}
          <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-amber-400" />
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
                placeholder="e.g. KTM 390 Adventure, Himalayan 450, Hunter 350"
              />
            </div>
          </div>

          {/* 3. Fuel Calibration (Mileage rate vs Actual Liters) */}
          <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fuel className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm">Fuel Consumption & Cost</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                ~{calculatedLiters.toFixed(1)} L (₹{Math.round(calculatedCost)})
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
                Enter Petrol Filled (Liters)
              </button>
            </div>

            {fuelMode === 'mileage' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-medium ${subText}`}>Average Mileage:</label>
                  <span className="font-mono font-bold text-emerald-400">{fuelMileage} km/L</span>
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
                  <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                    ✨ Real-world Calculated Mileage: <strong>{calculatedRealMileage.toFixed(1)} km/L</strong> for {effectiveDistanceKm.toFixed(1)} km.
                  </div>
                )}
              </div>
            )}

            {/* Petrol Price */}
            <div className={`pt-2 flex items-center justify-between gap-4 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <span className={`text-[11px] ${subText}`}>Petrol Price per Liter:</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs">₹</span>
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
              placeholder="e.g. Breakfast run to Wai, good tarmac on NH48, twisties on mountain pass."
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

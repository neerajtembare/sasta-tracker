import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  BatteryCharging, 
  Gauge, 
  Compass, 
  ShieldCheck, 
  Play, 
  MapPin,
  Check
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface SoloRideStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSoloRide: (options: { mountMode: 'handlebar' | 'pocket'; view: 'map' | 'cockpit' }) => void;
  currentMountMode?: 'handlebar' | 'pocket';
  theme?: AppTheme;
}

export const SoloRideStartModal: React.FC<SoloRideStartModalProps> = ({
  isOpen,
  onClose,
  onStartSoloRide,
  currentMountMode = 'handlebar',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [selectedMountMode, setSelectedMountMode] = useState<'handlebar' | 'pocket'>(currentMountMode);
  const [preferredView, setPreferredView] = useState<'map' | 'cockpit'>('map');

  if (!isOpen) return null;

  const handleStart = () => {
    triggerHaptic([40, 30, 60]);
    onStartSoloRide({
      mountMode: selectedMountMode,
      view: preferredView,
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-lg rounded-3xl border shadow-2xl p-4 sm:p-6 font-mono space-y-4 max-h-[92dvh] overflow-y-auto no-scrollbar transition-all ${
          isLight
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#0d131a] border-cyan-500/40 text-white shadow-cyan-950/40'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shrink-0">
              🏍️
            </div>
            <div>
              <h2 className={`font-heading font-black text-base sm:text-lg tracking-wider uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Start Solo Ride
              </h2>
              <p className={`text-[11px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Choose how you are carrying your phone on this ride
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Cards */}
        <div className="space-y-3 pt-1">
          {/* Option 1: Handlebar Mount Mode */}
          <div
            onClick={() => {
              triggerHaptic(25);
              setSelectedMountMode('handlebar');
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
              selectedMountMode === 'handlebar'
                ? (isLight ? 'bg-cyan-50/80 border-cyan-500 shadow-md ring-1 ring-cyan-400/50' : 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400/50')
                : (isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100')
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                  selectedMountMode === 'handlebar'
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-bold'
                    : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700')
                }`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-heading font-black text-sm uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Handlebar Mount
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                      Live HUD
                    </span>
                  </div>
                  <p className={`text-xs font-sans mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Phone is clamped to your bike mount. Keeps screen awake with real-time speedometer, lean angle sensor, and navigation map.
                  </p>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/90 text-slate-300 border-slate-700'
                    }`}>
                      <span>⚡ Screen Awake</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/90 text-slate-300 border-slate-700'
                    }`}>
                      <span>📐 3D Lean Angle</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800/90 text-slate-300 border-slate-700'
                    }`}>
                      <span>🧭 Live Heading</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedMountMode === 'handlebar'
                  ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                  : (isLight ? 'border-slate-300' : 'border-slate-700')
              }`}>
                {selectedMountMode === 'handlebar' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* Option 2: Pocket / Backpack Mode */}
          <div
            onClick={() => {
              triggerHaptic(25);
              setSelectedMountMode('pocket');
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
              selectedMountMode === 'pocket'
                ? (isLight ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-1 ring-emerald-400/50' : 'bg-emerald-950/40 border-emerald-400 shadow-lg shadow-emerald-950/60 ring-1 ring-emerald-400/50')
                : (isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100')
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${
                  selectedMountMode === 'pocket'
                    ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-bold'
                    : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700')
                }`}>
                  <BatteryCharging className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-heading font-black text-sm uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Pocket / Bag Mode
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      Low Battery / Sleep
                    </span>
                  </div>
                  <p className={`text-xs font-sans mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Lock your phone and slip it into your riding jacket or bag. Screen goes to sleep to save battery, while Android foreground service records every meter.
                  </p>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      <span>🔒 Screen Locked Safe</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      <span>🔋 Zero Screen Drain</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      <span>🛰️ 1Hz Hardware GNSS</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedMountMode === 'pocket'
                  ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                  : (isLight ? 'border-slate-300' : 'border-slate-700')
              }`}>
                {selectedMountMode === 'pocket' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* View Destination Selection */}
        <div className={`p-3 rounded-2xl border space-y-2 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <label className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Starting Screen
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setPreferredView('map');
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                preferredView === 'map'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black'
                  : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white')
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Live Map View</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setPreferredView('cockpit');
              }}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                preferredView === 'cockpit'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-black'
                  : (isLight ? 'bg-white border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white')
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Cockpit HUD</span>
            </button>
          </div>
        </div>

        {/* APK & Background Tracking Assurance Note */}
        <div className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-[11px] font-sans ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950/80 border-slate-800/80 text-slate-400'
        }`}>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            In APK mode, ThrottleLog uses an Android foreground service with partial wakelock. GPS satellites track at 1Hz continuously through fabric or backpacks without loss of signal.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`py-3 px-4 rounded-xl border font-bold text-xs cursor-pointer transition-all active:scale-95 ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleStart}
            className="py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer transition-all active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Tracking Ride</span>
          </button>
        </div>
      </div>
    </div>
  );
};

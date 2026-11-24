import React, { useState, useEffect } from 'react';
import { X, Bike, Check, Sparkles, Shield, Power, Radio, Gauge, Compass, Smartphone, BatteryCharging } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { getRiderProfile, saveRiderProfile, StartupScreen, DefaultMountMode } from '../utils/riderProfile';

interface RiderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  riderName: string;
  bikeModel?: string;
  myColor: string;
  isOnRadar: boolean;
  onToggleRadar: () => void;
  onSaveProfile: (name: string, bike: string, color: string) => void;
  theme?: AppTheme;
  onStartupScreenChanged?: (screen: StartupScreen) => void;
}

const COLOR_PRESETS = [
  '#00f0ff', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ff3366', // Coral
  '#a855f7', // Purple
  '#38bdf8', // Sky Blue
  '#f97316', // Orange
];

export const RiderProfileModal: React.FC<RiderProfileModalProps> = ({
  isOpen,
  onClose,
  riderName,
  bikeModel = '',
  myColor,
  isOnRadar,
  onToggleRadar,
  onSaveProfile,
  theme = 'dark',
  onStartupScreenChanged,
}) => {
  const isLight = theme === 'light';
  const [nameInput, setNameInput] = useState(riderName);
  const [bikeInput, setBikeInput] = useState(bikeModel);
  const [selectedColor, setSelectedColor] = useState(myColor);
  const [initialOdo, setInitialOdo] = useState<string>('0');
  const [startupScreen, setStartupScreen] = useState<StartupScreen>('dashboard');
  const [defaultMount, setDefaultMount] = useState<DefaultMountMode>('handlebar');
  const initialStartupRef = React.useRef<StartupScreen>('dashboard');

  useEffect(() => {
    if (isOpen) {
      const profile = getRiderProfile();
      setNameInput(riderName || profile.callsign);
      setBikeInput(bikeModel || profile.bikeModel);
      setSelectedColor(myColor || profile.color);
      setInitialOdo(profile.initialOdoKm > 0 ? String(profile.initialOdoKm) : '');
      setStartupScreen(profile.defaultStartupScreen);
      initialStartupRef.current = profile.defaultStartupScreen;
      setDefaultMount(profile.defaultMountMode);
    }
  }, [isOpen, riderName, bikeModel, myColor]);

  if (!isOpen) return null;

  const currentInitial = nameInput.trim() 
    ? nameInput.trim().charAt(0).toUpperCase() 
    : (riderName ? riderName.charAt(0).toUpperCase() : 'R');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(30);
    const cleanName = nameInput.trim() || 'Rider';
    const cleanBike = bikeInput.trim() || 'Motorcycle';
    const odoNum = parseFloat(initialOdo) || 0;

    saveRiderProfile({
      callsign: cleanName,
      bikeModel: cleanBike,
      color: selectedColor,
      initialOdoKm: odoNum,
      defaultStartupScreen: startupScreen,
      defaultMountMode: defaultMount,
    });

    onSaveProfile(cleanName, cleanBike, selectedColor);
    if (onStartupScreenChanged && startupScreen !== initialStartupRef.current) {
      onStartupScreenChanged(startupScreen);
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl p-5 border shadow-2xl font-mono space-y-4 max-h-[92dvh] overflow-y-auto no-scrollbar ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base border shadow-md relative"
              style={{
                backgroundColor: `${selectedColor}25`,
                borderColor: selectedColor,
                color: isLight ? '#0f172a' : '#ffffff',
              }}
            >
              <span>{currentInitial}</span>
              <span 
                className="w-2.5 h-2.5 rounded-full absolute -top-0.5 -right-0.5 border border-black" 
                style={{ backgroundColor: selectedColor }} 
              />
            </div>
            <div>
              <h2 className={`font-heading font-black text-sm tracking-wider uppercase flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Rider & Bike Profile</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </h2>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Callsign, odometer & startup view</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Callsign / Name */}
          <div>
            <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Your Callsign / Name *
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={18}
              required
              placeholder="e.g. Neeraj"
              className={`w-full px-3 py-2 rounded-xl text-sm font-bold focus:outline-hidden focus:border-cyan-400 transition-colors ${
                isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
              }`}
            />
            <p className={`text-[10px] mt-1 font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Saved permanently in your APK for solo tracking and crew radar.
            </p>
          </div>

          {/* Motorcycle Model */}
          <div>
            <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Motorcycle Model
            </label>
            <input
              type="text"
              value={bikeInput}
              onChange={(e) => setBikeInput(e.target.value)}
              maxLength={22}
              placeholder="e.g. Hunter 350 / Duke 390 / Himalayan"
              className={`w-full px-3 py-2 rounded-xl text-xs focus:outline-hidden focus:border-cyan-400 transition-colors ${
                isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
              }`}
            />
          </div>

          {/* Bike Baseline Odometer */}
          <div>
            <label className={`text-[10px] font-bold block mb-1 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Real Bike Odometer Baseline (km)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={initialOdo}
              onChange={(e) => setInitialOdo(e.target.value)}
              placeholder="e.g. 8500 (your motorcycle's current dash reading)"
              className={`w-full px-3 py-2 rounded-xl text-xs font-mono focus:outline-hidden focus:border-cyan-400 transition-colors ${
                isLight ? 'bg-slate-50 border border-slate-300 text-slate-900' : 'bg-black/50 border border-slate-700 text-white'
              }`}
            />
            <p className={`text-[10px] mt-1 font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Enter your bike's current dash reading. ThrottleLog will add tracked rides to calculate your live total odometer.
            </p>
          </div>

          {/* Default Startup Screen Option (Option C) */}
          <div className="pt-1">
            <label className={`text-[10px] font-bold block mb-1.5 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Default App Startup Screen
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setStartupScreen('dashboard');
                }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  startupScreen === 'dashboard'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                    : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white')
                }`}
              >
                <div>🏍️</div>
                <div className="mt-0.5">Dashboard</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setStartupScreen('cockpit');
                }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  startupScreen === 'cockpit'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                    : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white')
                }`}
              >
                <div>🧭</div>
                <div className="mt-0.5">Cockpit HUD</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setStartupScreen('map');
                }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold ${
                  startupScreen === 'map'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-sm'
                    : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white')
                }`}
              >
                <div>🗺️</div>
                <div className="mt-0.5">Live Map</div>
              </button>
            </div>
          </div>

          {/* Default Mount Mode */}
          <div>
            <label className={`text-[10px] font-bold block mb-1.5 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Default Ride Mode
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setDefaultMount('handlebar');
                }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold flex items-center justify-center gap-1.5 ${
                  defaultMount === 'handlebar'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 font-black shadow-sm'
                    : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white')
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Handlebar Mount</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setDefaultMount('pocket');
                }}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-bold flex items-center justify-center gap-1.5 ${
                  defaultMount === 'pocket'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 font-black shadow-sm'
                    : (isLight ? 'bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' : 'bg-black/40 border-slate-800 text-slate-400 hover:text-white')
                }`}
              >
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>Pocket Mode</span>
              </button>
            </div>
          </div>

          {/* Color Pin Picker */}
          <div>
            <label className={`text-[10px] font-bold block mb-1.5 uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Radar Pin Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setSelectedColor(color);
                  }}
                  className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                    selectedColor === color ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && (
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* RADAR TRACKING & BATTERY SAVER TOGGLE */}
          <div className={`pt-2 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div className={`flex items-center justify-between p-2.5 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-slate-800'
            }`}>
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isOnRadar ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-rose-500'}`} />
                  <span className={isOnRadar ? 'text-emerald-400' : (isLight ? 'text-slate-600' : 'text-slate-400')}>
                    {isOnRadar ? 'Live on Crew Radar' : 'Offline (Private)'}
                  </span>
                </div>
                <p className={`text-[10px] font-sans mt-0.5 leading-tight ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isOnRadar 
                    ? 'Visible to friends on squad map' 
                    : 'Zero background MQTT broadcasts'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onToggleRadar();
                }}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1 border ${
                  isOnRadar
                    ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/50 text-rose-300'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-md'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isOnRadar ? 'Go Offline' : 'Go Live'}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95 ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-cyan-500/30 transition-all active:scale-95"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

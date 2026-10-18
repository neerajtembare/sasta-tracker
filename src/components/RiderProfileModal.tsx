import React, { useState, useEffect } from 'react';
import { X, Bike, Check, Sparkles, Shield, Power, Radio } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

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
}) => {
  const isLight = theme === 'light';
  const [nameInput, setNameInput] = useState(riderName);
  const [bikeInput, setBikeInput] = useState(bikeModel);
  const [selectedColor, setSelectedColor] = useState(myColor);

  useEffect(() => {
    if (isOpen) {
      setNameInput(riderName);
      setBikeInput(bikeModel);
      setSelectedColor(myColor);
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
    try {
      localStorage.setItem('sasta_rider_name', cleanName);
      localStorage.setItem('sasta_name_onboarded', 'true');
    } catch {}
    onSaveProfile(cleanName, cleanBike, selectedColor);
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
        className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl font-mono space-y-4 ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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
              <h2 className="font-heading font-black text-sm tracking-wider uppercase text-white flex items-center gap-1.5">
                <span>Rider Identity</span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </h2>
              <p className="text-[11px] text-slate-400">Callsign & motorcycle profile</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Callsign / Name */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">
              Your Callsign / Name *
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={18}
              required
              placeholder="e.g. Neeraj"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-slate-700 text-white text-sm font-bold focus:outline-hidden focus:border-cyan-400 transition-colors"
            />
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Displays as <strong className="text-cyan-300">"{currentInitial}"</strong> on the radar pin and in voice callouts.
            </p>
          </div>

          {/* Motorcycle Model */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">
              Motorcycle Model
            </label>
            <input
              type="text"
              value={bikeInput}
              onChange={(e) => setBikeInput(e.target.value)}
              maxLength={22}
              placeholder="e.g. Hunter 350 / Duke 390"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Color Pin Picker */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">
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

          {/* ─────────────────────────────────────────────────────────────
              RADAR TRACKING & BATTERY SAVER TOGGLE
          ───────────────────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-slate-800">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isOnRadar ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-rose-500'}`} />
                  <span className={isOnRadar ? 'text-emerald-300' : 'text-slate-400'}>
                    {isOnRadar ? 'Live on Crew Radar' : 'Offline (Battery Saver)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                  {isOnRadar 
                    ? 'Visible to squad on live map' 
                    : 'Ghost mode • Zero background battery drain'}
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
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all active:scale-95"
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

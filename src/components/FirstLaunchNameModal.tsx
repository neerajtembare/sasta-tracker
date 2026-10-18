import React, { useState, useEffect } from 'react';
import { Bike, Check, Sparkles } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface FirstLaunchNameModalProps {
  currentName: string;
  currentBike?: string;
  currentColor: string;
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

export const FirstLaunchNameModal: React.FC<FirstLaunchNameModalProps> = ({
  currentName,
  currentBike = '',
  currentColor,
  onSaveProfile,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [bikeInput, setBikeInput] = useState(currentBike);
  const [selectedColor, setSelectedColor] = useState(currentColor);

  useEffect(() => {
    try {
      const onboarded = localStorage.getItem('sasta_name_onboarded');
      // If never onboarded and name is default 'Rider', prompt them gently
      if (!onboarded && (!currentName || currentName.toLowerCase() === 'rider')) {
        setIsOpen(true);
      }
    } catch {}
  }, [currentName]);

  if (!isOpen) return null;

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
    setIsOpen(false);
  };

  const handleSkip = () => {
    triggerHaptic(20);
    try {
      localStorage.setItem('sasta_name_onboarded', 'true');
    } catch {}
    // Assign a unique identifiable number instead of generic 'Rider'
    const randomTag = `Rider-${Math.floor(100 + Math.random() * 900)}`;
    onSaveProfile(randomTag, bikeInput.trim() || 'Motorcycle', selectedColor);
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl font-mono space-y-4 ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0d131a] border-cyan-500/50 text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shrink-0">
            🏍️
          </div>
          <div>
            <h2 className="font-heading font-black text-sm tracking-wider uppercase text-white flex items-center gap-1.5">
              <span>Welcome to Crew Radar</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </h2>
            <p className="text-[11px] text-slate-400">Set your name for your riding squad</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          Enter your name so your friends recognize your bike on the map and hear your voice callouts:
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">
              Your Callsign / Name *
            </label>
            <input
              type="text"
              autoFocus
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Rahul / Amit / Neeraj"
              maxLength={16}
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-slate-700 text-white font-bold text-sm focus:outline-hidden focus:border-cyan-400 placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">
              Motorcycle Model (Optional)
            </label>
            <input
              type="text"
              value={bikeInput}
              onChange={(e) => setBikeInput(e.target.value)}
              placeholder="e.g. Hunter 350 / Duke 390"
              maxLength={20}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-slate-700 text-white text-xs focus:outline-hidden focus:border-cyan-400 placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">
              Radar Pin Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                    selectedColor === color ? 'scale-115 border-white ring-2 ring-cyan-400/50' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Join Live Crew Radar</span>
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full py-1.5 text-center text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer font-bold transition-colors"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

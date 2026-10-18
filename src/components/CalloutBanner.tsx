import React, { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { RiderCallout } from '../utils/callouts';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface CalloutBannerProps {
  callout: RiderCallout | null;
  onDismiss: () => void;
  theme?: AppTheme;
}

export const CalloutBanner: React.FC<CalloutBannerProps> = ({
  callout,
  onDismiss,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!callout) return;
    setProgress(100);
    const duration = 10000; // 10 seconds total banner display
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return Math.max(0, prev - step);
      });
    }, interval);

    return () => clearInterval(timer);
  }, [callout]);

  if (!callout) return null;

  return (
    <div 
      style={{
        top: 'max(3.8rem, calc(env(safe-area-inset-top) + 3.4rem))',
        left: 'max(0.6rem, env(safe-area-inset-left))',
        right: 'max(0.6rem, env(safe-area-inset-right))',
      }}
      className="absolute z-50 pointer-events-none flex justify-center animate-in slide-in-from-top-3 duration-300"
    >
      <div 
        className={`pointer-events-auto w-full max-w-md rounded-2xl backdrop-blur-xl border-2 shadow-2xl overflow-hidden font-mono transition-all ${
          isLight
            ? 'bg-white/98 border-amber-400 text-slate-800 shadow-slate-400/50'
            : 'bg-[#0d131a]/98 border-cyan-400/80 text-white shadow-black/90 ring-1 ring-cyan-500/30'
        }`}
        style={{
          borderColor: callout.color || '#00f0ff',
        }}
      >
        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
          {/* Big Icon with Glow */}
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-md border"
            style={{
              backgroundColor: `${callout.color || '#00f0ff'}20`,
              borderColor: `${callout.color || '#00f0ff'}60`,
            }}
          >
            {callout.icon}
          </div>

          {/* Callout Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span 
                className="text-[10px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider text-slate-950 truncate max-w-[120px]"
                style={{ backgroundColor: callout.color || '#00f0ff' }}
              >
                {callout.riderName}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                HEADS-UP
              </span>
            </div>

            <div className="font-heading font-black text-sm tracking-wide uppercase text-white truncate mt-0.5">
              {callout.title}
            </div>

            <div className="text-xs text-slate-300 font-sans truncate leading-tight">
              "{callout.message}"
            </div>
          </div>

          {/* Right Action: Acknowledge / Dismiss */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onDismiss();
              }}
              title="Acknowledge callout"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Roger</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                onDismiss();
              }}
              title="Dismiss notification"
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Animated Progress countdown line */}
        <div className="w-full h-1 bg-black/40">
          <div 
            className="h-full transition-all ease-linear"
            style={{
              width: `${progress}%`,
              backgroundColor: callout.color || '#00f0ff',
            }}
          />
        </div>
      </div>
    </div>
  );
};

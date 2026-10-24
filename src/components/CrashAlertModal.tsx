import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { triggerHaptic, playSosChime } from '../utils/audioChimes';
import { CrashEvent } from '../utils/crashDetection';

interface CrashAlertModalProps {
  isOpen: boolean;
  crashEvent: CrashEvent | null;
  onCancel: () => void;
  onConfirmSos: () => void;
  unitSystem?: 'metric' | 'imperial';
}

export const CrashAlertModal: React.FC<CrashAlertModalProps> = ({
  isOpen,
  crashEvent,
  onCancel,
  onConfirmSos,
  unitSystem = 'metric',
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const sirenIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(30);
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
      return;
    }

    // Play urgent siren chime & haptic immediately
    playSosChime();
    triggerHaptic([200, 100, 200, 100, 400]);

    // Repeat siren chime every 5 seconds until cancelled or dispatched
    sirenIntervalRef.current = setInterval(() => {
      playSosChime();
      triggerHaptic([200, 100, 200, 100, 400]);
    }, 5000);

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
          onConfirmSos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
    };
  }, [isOpen, onConfirmSos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
      <div 
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-slate-950 border-2 border-rose-500 p-5 shadow-2xl shadow-rose-950/80 font-mono text-center space-y-4 pointer-events-auto"
      >
        {/* Pulsing Siren Icon */}
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/20 border-2 border-rose-500 text-rose-400 flex items-center justify-center animate-pulse">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-heading font-black text-rose-400 tracking-wider uppercase">
            Severe Impact Detected!
          </h2>
          <p className="text-xs text-slate-300">
            {crashEvent 
              ? `${crashEvent.peakG}G impact recorded at ${unitSystem === 'imperial' ? Math.round(crashEvent.preImpactSpeedKmh * 0.621371) + ' mph' : crashEvent.preImpactSpeedKmh + ' km/h'}.` 
              : 'Sudden stop and impact registered.'}
          </p>
        </div>

        {/* Countdown Ring & Timer */}
        <div className="py-2">
          <div className="text-4xl font-heading font-black text-white tabular-nums">
            0:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}
          </div>
          <div className="text-[11px] text-rose-300 font-bold mt-1">
            Auto-sending EMERGENCY SOS to squad in {secondsRemaining}s
          </div>
        </div>

        {/* Big Glove-Friendly Actions */}
        <div className="space-y-2 pt-1">
          {/* Big Green Cancel Button */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-heading font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/50 cursor-pointer transition-all active:scale-95"
          >
            <CheckCircle className="w-5 h-5" />
            <span>I AM OKAY — CANCEL</span>
          </button>

          {/* Big Red Instant SOS Button */}
          <button
            type="button"
            onClick={() => {
              if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
              onConfirmSos();
            }}
            className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950 cursor-pointer transition-all active:scale-95"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>SEND SOS RIGHT NOW</span>
          </button>
        </div>
      </div>
    </div>
  );
};

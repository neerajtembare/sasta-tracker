import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  MapPin, 
  Activity, 
  Mic, 
  BatteryCharging, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Sparkles,
  Power,
  Smartphone,
  Lock,
  X
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { 
  checkBatteryOptimizationStatus, 
  requestBatteryOptimizationExemption, 
  requestNativeMicrophonePermission 
} from '../utils/nativeKeepAlive';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: AppTheme;
  onApplyBackgroundMode?: (mode: 'keep_running' | 'stop_on_exit') => void;
}

export type BackgroundTrackingMode = 'keep_running' | 'stop_on_exit';

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  onApplyBackgroundMode,
}) => {
  const isLight = theme === 'light';

  // Permission states
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [hasMotion, setHasMotion] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [isBatteryExempt, setIsBatteryExempt] = useState<boolean>(true);

  // Background tracking choice
  const [backgroundMode, setBackgroundMode] = useState<BackgroundTrackingMode>(() => {
    try {
      return (localStorage.getItem('throttlelog_background_mode') as BackgroundTrackingMode) || 'keep_running';
    } catch {
      return 'keep_running';
    }
  });

  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Probe Location permission
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(res => {
        setHasLocation(res.state === 'granted');
        res.onchange = () => setHasLocation(res.state === 'granted');
      }).catch(() => setHasLocation(null));
    }

    // 2. Probe Microphone permission
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(res => {
        setHasMic(res.state === 'granted');
        res.onchange = () => setHasMic(res.state === 'granted');
      }).catch(() => setHasMic(null));
    }

    // 3. Probe Battery Optimization
    checkBatteryOptimizationStatus().then(exempt => {
      setIsBatteryExempt(exempt);
    }).catch(() => {});

    // 4. Motion permission (iOS requires user gesture, Android allows by default)
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setHasMotion(false);
      } else {
        setHasMotion(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGrantPermissions = async () => {
    triggerHaptic(40);
    setIsRequesting(true);

    try {
      // 1. Request Geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
            });
          });
          setHasLocation(true);
        } catch {
          // May be denied or timed out
        }
      }

      // 2. Request Native Microphone
      try {
        const micGranted = await requestNativeMicrophonePermission();
        if (micGranted && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          setHasMic(true);
        }
      } catch {}

      // 3. Request Motion Sensors (iOS)
      if (typeof window !== 'undefined' && typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        try {
          const res = await (DeviceOrientationEvent as any).requestPermission();
          setHasMotion(res === 'granted');
        } catch {}
      } else {
        setHasMotion(true);
      }

      // 4. Request Battery Optimization Exemption if keep_running is selected
      if (backgroundMode === 'keep_running' && !isBatteryExempt) {
        try {
          await requestBatteryOptimizationExemption();
          const exempt = await checkBatteryOptimizationStatus();
          setIsBatteryExempt(exempt);
        } catch {}
      }

      // Save preferences
      try {
        localStorage.setItem('throttlelog_background_mode', backgroundMode);
        localStorage.setItem('throttlelog_permissions_setup_completed', 'true');
      } catch {}

      if (onApplyBackgroundMode) {
        onApplyBackgroundMode(backgroundMode);
      }

      onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    triggerHaptic(20);
    try {
      localStorage.setItem('throttlelog_background_mode', backgroundMode);
      localStorage.setItem('throttlelog_permissions_setup_completed', 'true');
    } catch {}
    if (onApplyBackgroundMode) {
      onApplyBackgroundMode(backgroundMode);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 border shadow-2xl font-mono space-y-4 max-h-[92vh] overflow-y-auto ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#0b1016] border-cyan-500/40 text-white'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-heading font-black text-sm sm:text-base tracking-wider uppercase text-white flex items-center gap-1.5">
                <span>Rider Permissions & Tracking Setup</span>
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Review permissions and configure background ride tracking behavior
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Introduction */}
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          ThrottleLog is designed specifically for motorcycle convoys. To log accurate telemetry and keep you in sync with your crew, here is what the app uses:
        </p>

        {/* 4 Permission Items Grid */}
        <div className="space-y-2">
          {/* 1. GPS Location */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Precise Satellite GPS</span>
                  <span className="text-[10px] text-cyan-400 font-normal">(1000ms / 0.5m)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  Hardware GNSS speed, distance accumulation & live crew radar
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold">
              {hasLocation ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Required
                </span>
              )}
            </div>
          </div>

          {/* 2. Motion Sensors */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Motion & Accelerometer</span>
                  <span className="text-[10px] text-emerald-400 font-normal">(100Hz)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  Cornering lean angles & automatic high-G crash detection
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold">
              {hasMotion ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="text-slate-400">Ready</span>
              )}
            </div>
          </div>

          {/* 3. Walkie-Talkie Microphone */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Microphone (PTT Walkie-Talkie)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  1-tap voice blasts straight into buddies' helmet intercoms
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold">
              {hasMic ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Optional
                </span>
              )}
            </div>
          </div>

          {/* 4. Battery Optimization */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Battery Saver Exemption</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  Prevents Android from freezing GPS when screen is locked
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold">
              {isBatteryExempt ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Unrestricted
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Recommended
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BACKGROUND TRACKING PREFERENCE SELECTOR
        ───────────────────────────────────────────────────────────── */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
            Choose Background Tracking Behavior:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Option A: Keep Running in Background */}
            <div 
              onClick={() => {
                triggerHaptic(20);
                setBackgroundMode('keep_running');
              }}
              className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                backgroundMode === 'keep_running'
                  ? 'bg-cyan-500/15 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                  : 'bg-[#121922] border-slate-800 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>🟢 Keep Running</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Recommended
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                Hardware satellite GPS stays alive at 1Hz in pocket/tank bag or while using Google Maps. Convoy radar never disconnects.
              </p>
            </div>

            {/* Option B: Stop on Exit / Minimize */}
            <div 
              onClick={() => {
                triggerHaptic(20);
                setBackgroundMode('stop_on_exit');
              }}
              className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-1.5 ${
                backgroundMode === 'stop_on_exit'
                  ? 'bg-amber-500/15 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                  : 'bg-[#121922] border-slate-800 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>⏸️ Stop on Exit</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Privacy Saver
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
                Stops GPS hardware and kills background service immediately when you minimize or close ThrottleLog. Zero background battery usage.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2 font-mono">
          <button
            type="button"
            onClick={handleSkip}
            className="py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
          >
            Later
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={handleGrantPermissions}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <span>{isRequesting ? 'Requesting Access...' : 'Allow Permissions & Save'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

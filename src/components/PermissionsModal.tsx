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
  Settings,
  ExternalLink,
  Info,
  X
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { 
  checkBatteryOptimizationStatus, 
  requestBatteryOptimizationExemption, 
  requestNativeMicrophonePermission,
  requestNativeLocationPermission,
  checkNativeLocationPermission,
  openNativeAppSettings,
  openNativeLocationSettings,
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
  const [hasFineLocation, setHasFineLocation] = useState<boolean | null>(null);
  const [hasCoarseLocation, setHasCoarseLocation] = useState<boolean | null>(null);
  const [hasMotion, setHasMotion] = useState<boolean | null>(null);
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [isBatteryExempt, setIsBatteryExempt] = useState<boolean>(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Background tracking choice
  const [backgroundMode, setBackgroundMode] = useState<BackgroundTrackingMode>(() => {
    try {
      return (localStorage.getItem('throttlelog_background_mode') as BackgroundTrackingMode) || 'keep_running';
    } catch {
      return 'keep_running';
    }
  });

  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  // Probe permissions
  const refreshPermissionStates = async () => {
    // 1. Native Location Probe
    try {
      const locStatus = await checkNativeLocationPermission();
      setHasFineLocation(locStatus.fine);
      setHasCoarseLocation(locStatus.coarse);
    } catch {
      // Web fallback
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(res => {
          setHasFineLocation(res.state === 'granted');
          setHasCoarseLocation(res.state === 'granted');
          res.onchange = () => {
            setHasFineLocation(res.state === 'granted');
            setHasCoarseLocation(res.state === 'granted');
          };
        }).catch(() => {
          setHasFineLocation(null);
          setHasCoarseLocation(null);
        });
      }
    }

    // 2. Microphone Probe
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(res => {
        setHasMic(res.state === 'granted');
        res.onchange = () => setHasMic(res.state === 'granted');
      }).catch(() => setHasMic(null));
    }

    // 3. Battery Optimization
    checkBatteryOptimizationStatus().then(exempt => {
      setIsBatteryExempt(exempt);
    }).catch(() => {});

    // 4. Motion permission
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        setHasMotion(false);
      } else {
        setHasMotion(true);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshPermissionStates();

    // Re-check permissions when user switches back from Phone Settings
    const handleFocus = () => {
      refreshPermissionStates();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isOpen]);

  if (!isOpen) return null;

  // Handler for Location card click
  const handleLocationCardClick = async () => {
    triggerHaptic(30);
    setStatusNotice('Requesting GPS hardware access...');
    
    // First trigger native permission prompt
    const granted = await requestNativeLocationPermission();
    await refreshPermissionStates();

    if (!granted) {
      setStatusNotice('Opening Phone Settings: Please tap Permissions → Location → Turn ON "Use precise location" & select "Allow all the time".');
      await openNativeAppSettings();
    } else {
      setStatusNotice('Precise GPS permission granted!');
      setTimeout(() => setStatusNotice(null), 3000);
    }
  };

  // Handler for Microphone card click
  const handleMicCardClick = async () => {
    triggerHaptic(30);
    setStatusNotice('Requesting Walkie-Talkie microphone access...');
    try {
      const granted = await requestNativeMicrophonePermission();
      if (granted && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setHasMic(true);
        setStatusNotice('Microphone access granted!');
      } else {
        await openNativeAppSettings();
      }
    } catch {
      await openNativeAppSettings();
    }
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Handler for Battery Optimization card click
  const handleBatteryCardClick = async () => {
    triggerHaptic(30);
    setStatusNotice('Opening Battery Optimization prompt...');
    await requestBatteryOptimizationExemption();
    const exempt = await checkBatteryOptimizationStatus();
    setIsBatteryExempt(exempt);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Open App Settings directly
  const handleOpenAppSettings = async () => {
    triggerHaptic(35);
    setStatusNotice('Opening Phone App Settings... Tap Permissions → Location → Turn ON "Use Precise Location".');
    await openNativeAppSettings();
  };

  const handleGrantPermissions = async () => {
    triggerHaptic(40);
    setIsRequesting(true);

    try {
      // 1. Request Native Location
      const locGranted = await requestNativeLocationPermission();
      
      // Also request browser Geolocation to ensure Chromium WebView allows GPS watch
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0,
            });
          });
          setHasFineLocation(true);
        } catch {}
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

      // If location is still not granted, guide the user to settings instead of leaving them stranded
      if (!locGranted && !hasFineLocation) {
        setStatusNotice('Location is still restricted. Opening Settings to enable "Use precise location"...');
        await openNativeAppSettings();
        return;
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
                <span>Rider Permissions & GPS Setup</span>
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Tap each permission to configure, or open phone settings directly
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

        {/* Status Notice Toast */}
        {statusNotice && (
          <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/60 text-cyan-200 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-sans font-medium text-[11px] leading-tight">{statusNotice}</span>
          </div>
        )}

        {/* 4 Interactive Permission Cards */}
        <div className="space-y-2">
          {/* 1. GPS Location */}
          <button
            type="button"
            onClick={handleLocationCardClick}
            className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] ${
              hasFineLocation
                ? 'bg-[#121922] border-emerald-500/40 hover:border-emerald-500/70'
                : hasCoarseLocation
                ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
                : 'bg-rose-950/20 border-rose-500/50 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                hasFineLocation 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
              }`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Precise Satellite GPS</span>
                  <span className="text-[10px] text-cyan-400 font-normal">(1000ms / 0.5m)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  {hasFineLocation 
                    ? 'Hardware GNSS locked (Fine Satellite accuracy)'
                    : hasCoarseLocation
                    ? '⚠️ Approximate only (Cell-tower ~1km error). Tap to enable Precise.'
                    : 'Required for speedometer, odometer & live crew radar (Tap to grant)'}
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold flex items-center gap-1.5">
              {hasFineLocation ? (
                <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Precise Active
                </span>
              ) : hasCoarseLocation ? (
                <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Enable Precise
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Tap to Grant
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </button>

          {/* 2. Motion Sensors */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#121922] border-[#1e2a38]'
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
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
                <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active
                </span>
              ) : (
                <span className="text-slate-400">Ready</span>
              )}
            </div>
          </div>

          {/* 3. Walkie-Talkie Microphone */}
          <button
            type="button"
            onClick={handleMicCardClick}
            className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] ${
              hasMic 
                ? 'bg-[#121922] border-emerald-500/40 hover:border-emerald-500/70'
                : 'bg-[#121922] border-[#1e2a38] hover:border-amber-500/50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Microphone (PTT Walkie-Talkie)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  1-tap voice blasts into buddies' helmet intercoms
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold flex items-center gap-1.5">
              {hasMic ? (
                <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Tap to Grant
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </button>

          {/* 4. Battery Saver Exemption */}
          <button
            type="button"
            onClick={handleBatteryCardClick}
            className={`w-full text-left p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] ${
              isBatteryExempt
                ? 'bg-[#121922] border-emerald-500/40 hover:border-emerald-500/70'
                : 'bg-[#121922] border-[#1e2a38] hover:border-purple-500/50'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>Battery Saver Exemption</span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans truncate">
                  Prevents Android OS from killing GPS service when screen is locked
                </div>
              </div>
            </div>
            <div className="shrink-0 font-mono text-[10px] font-bold flex items-center gap-1.5">
              {isBatteryExempt ? (
                <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Unrestricted
                </span>
              ) : (
                <span className="text-purple-400 flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/30">
                  <AlertCircle className="w-3.5 h-3.5" /> Tap to Allow
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            DIRECT ANDROID SETTINGS SHORTCUT BUTTON & EXPLANATION
        ───────────────────────────────────────────────────────────── */}
        <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-black uppercase text-cyan-400 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              <span>Android Settings Guide</span>
            </div>
            <button
              type="button"
              onClick={handleOpenAppSettings}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Open Phone Settings</span>
              <ExternalLink className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
          <p className="text-[10px] text-slate-300 font-sans leading-relaxed">
            On Android 12+, if GPS is inaccurate or shows the wrong town, tap <strong className="text-white">Open Phone Settings</strong> above, tap <strong className="text-white">Permissions → Location</strong>, and make sure <strong className="text-cyan-300">"Use precise location"</strong> is turned <strong className="text-emerald-400">ON</strong>.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BACKGROUND TRACKING PREFERENCE SELECTOR
        ───────────────────────────────────────────────────────────── */}
        <div className="pt-1 border-t border-slate-800 space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
            Background Tracking Behavior:
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

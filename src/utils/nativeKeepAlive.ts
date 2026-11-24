import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeLocationData {
  latitude: number;
  longitude: number;
  speed: number | null;
  speedKmh: number;
  altitude: number | null;
  bearing: number | null;
  accuracy: number;
  time: number;
  totalDistanceMeters: number;
}

export interface NativeCrashData {
  peakG: number;
  preImpactSpeedKmh: number;
  timestamp: number;
}

interface ThrottleLogNativePlugin {
  startKeepAlive(): Promise<void>;
  stopKeepAlive(): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestBatteryOptimizationExemption(): Promise<void>;
  speak(options: { text: string; rate?: number; pitch?: number; queue?: 'flush' | 'add' }): Promise<void>;
  stopSpeaking(): Promise<void>;
  requestAudioFocus(): Promise<void>;
  abandonAudioFocus(): Promise<void>;
  requestMicrophonePermission(): Promise<{ granted: boolean }>;
  checkLocationPermission(): Promise<{ fine: boolean; coarse: boolean; granted: boolean }>;
  requestLocationPermission(): Promise<{ granted: boolean }>;
  openAppSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
  getLastSharedText(): Promise<{ text: string | null }>;
  clearLastSharedText(): Promise<void>;
  unshortenUrl(options: { url: string }): Promise<{ resolvedUrl: string }>;
  addListener(
    eventName: 'onNativeLocation' | 'onNativeCrashDetected' | 'onSharedTextReceived',
    listenerFunc: (data: any) => void
  ): Promise<any>;
}

let webWakeLockSentinel: any = null;

const NativeBridge = registerPlugin<ThrottleLogNativePlugin>('ThrottleLogNative', {
  web: {
    startKeepAlive: async () => {},
    stopKeepAlive: async () => {},
    setKeepScreenOn: async (options: { enabled: boolean }) => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        if (options.enabled) {
          try {
            if (!webWakeLockSentinel) {
              webWakeLockSentinel = await (navigator as any).wakeLock.request('screen');
            }
          } catch {}
        } else {
          if (webWakeLockSentinel) {
            try {
              await webWakeLockSentinel.release();
            } catch {}
            webWakeLockSentinel = null;
          }
        }
      }
    },
    isBatteryOptimizationIgnored: async () => ({ isIgnored: true }),
    requestBatteryOptimizationExemption: async () => {},
    speak: async () => {},
    stopSpeaking: async () => {},
    requestAudioFocus: async () => {},
    abandonAudioFocus: async () => {},
    requestMicrophonePermission: async () => ({ granted: true }),
    checkLocationPermission: async () => ({ fine: true, coarse: true, granted: true }),
    requestLocationPermission: async () => ({ granted: true }),
    openAppSettings: async () => {},
    openLocationSettings: async () => {},
    getLastSharedText: async () => ({ text: null }),
    clearLastSharedText: async () => {},
    unshortenUrl: async (options: { url: string }) => ({ resolvedUrl: options.url }),
    addListener: async () => ({ remove: () => {} }),
  },
});

export async function getNativeLastSharedText(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.getLastSharedText();
      return res.text || null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function clearNativeLastSharedText(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.clearLastSharedText();
    } catch {}
  }
}

export async function addNativeSharedTextListener(
  callback: (text: string) => void
): Promise<(() => void) | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const handle = await NativeBridge.addListener('onSharedTextReceived', (data: { text?: string }) => {
        if (data?.text && data.text.trim()) {
          callback(data.text.trim());
        }
      });
      return () => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      };
    } catch {
      return null;
    }
  }
  return null;
}

export async function nativeUnshortenUrl(url: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.unshortenUrl({ url });
      return res.resolvedUrl || url;
    } catch {
      return url;
    }
  }
  return url;
}

export async function startNativeRadarKeepAlive(pocketMode: boolean = false) {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.startKeepAlive();
      await NativeBridge.setKeepScreenOn({ enabled: !pocketMode });
    } catch (e) {
      console.warn('Native keep-alive start warning:', e);
    }
  } else {
    await NativeBridge.setKeepScreenOn({ enabled: !pocketMode });
  }
}

export async function setNativeScreenKeepOn(enabled: boolean) {
  try {
    await NativeBridge.setKeepScreenOn({ enabled });
  } catch (e) {
    console.warn('Set keep screen on warning:', e);
  }
}

export async function stopNativeRadarKeepAlive() {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.stopKeepAlive();
      await NativeBridge.setKeepScreenOn({ enabled: false });
    } catch (e) {
      console.warn('Native keep-alive stop warning:', e);
    }
  } else {
    await NativeBridge.setKeepScreenOn({ enabled: false });
  }
}

export async function checkBatteryOptimizationStatus(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.isBatteryOptimizationIgnored();
      return !!res.isIgnored;
    } catch {
      return true;
    }
  }
  return true;
}

export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.requestBatteryOptimizationExemption();
    } catch (e) {
      console.warn('Battery exemption request warning:', e);
    }
  }
}

export async function addNativeLocationListener(
  callback: (data: NativeLocationData) => void
): Promise<(() => void) | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const handle = await NativeBridge.addListener('onNativeLocation', callback);
      return () => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      };
    } catch (e) {
      console.warn('Could not register native location listener:', e);
      return null;
    }
  }
  return null;
}

export async function addNativeCrashListener(
  callback: (data: NativeCrashData) => void
): Promise<(() => void) | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const handle = await NativeBridge.addListener('onNativeCrashDetected', callback);
      return () => {
        if (handle && typeof handle.remove === 'function') {
          handle.remove();
        }
      };
    } catch (e) {
      console.warn('Could not register native crash listener:', e);
      return null;
    }
  }
  return null;
}

export async function nativeSpeak(
  text: string, 
  rate: number = 1.05, 
  pitch: number = 1.0,
  queue: 'flush' | 'add' = 'flush'
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.speak({ text, rate, pitch, queue });
    } catch (e) {
      console.warn('Native TTS speak warning:', e);
    }
  }
}

export async function nativeStopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.stopSpeaking();
    } catch (e) {
      console.warn('Native TTS stop warning:', e);
    }
  }
}

export async function requestNativeMicrophonePermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.requestMicrophonePermission();
      return !!res.granted;
    } catch (e) {
      return true;
    }
  }
  return true;
}

export async function nativeRequestAudioFocus(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.requestAudioFocus();
    } catch (e) {
      console.warn('Native request audio focus warning:', e);
    }
  }
}

export async function nativeAbandonAudioFocus(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.abandonAudioFocus();
    } catch (e) {
      console.warn('Native abandon audio focus warning:', e);
    }
  }
}

export async function checkNativeLocationPermission(): Promise<{ fine: boolean; coarse: boolean; granted: boolean }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.checkLocationPermission();
      return {
        fine: !!res.fine,
        coarse: !!res.coarse,
        granted: !!res.granted,
      };
    } catch {
      return { fine: false, coarse: false, granted: false };
    }
  }
  return { fine: true, coarse: true, granted: true };
}

export async function requestNativeLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.requestLocationPermission();
      return !!res.granted;
    } catch {
      return false;
    }
  }
  return true;
}

export async function openNativeAppSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.openAppSettings();
    } catch (e) {
      console.warn('Open app settings error:', e);
    }
  }
}

export async function openNativeLocationSettings(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.openLocationSettings();
    } catch (e) {
      console.warn('Open location settings error:', e);
    }
  }
}


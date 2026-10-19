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

interface ThrottleLogNativePlugin {
  startKeepAlive(): Promise<void>;
  stopKeepAlive(): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestBatteryOptimizationExemption(): Promise<void>;
  speak(options: { text: string; rate?: number; pitch?: number }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(
    eventName: 'onNativeLocation',
    listenerFunc: (data: NativeLocationData) => void
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
    addListener: async () => ({ remove: () => {} }),
  },
});

export async function startNativeRadarKeepAlive() {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.startKeepAlive();
      await NativeBridge.setKeepScreenOn({ enabled: true });
    } catch (e) {
      console.warn('Native keep-alive start warning:', e);
    }
  } else {
    await NativeBridge.setKeepScreenOn({ enabled: true });
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

export async function nativeSpeak(text: string, rate: number = 1.05, pitch: number = 1.0): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.speak({ text, rate, pitch });
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


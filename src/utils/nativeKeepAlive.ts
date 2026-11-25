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
  startKeepAlive(options?: { resetOdometer?: boolean; crashDetectionEnabled?: boolean }): Promise<void>;
  stopKeepAlive(): Promise<void>;
  setCrashDetectionEnabled(options: { enabled: boolean }): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ isIgnored: boolean }>;
  requestBatteryOptimizationExemption(): Promise<void>;
  speak(options: { text: string; rate?: number; pitch?: number; queue?: 'flush' | 'add' }): Promise<{ utteranceId?: string }>;
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
    eventName: 'onNativeLocation' | 'onNativeCrashDetected' | 'onSharedTextReceived' | 'onTtsDone',
    listenerFunc: (data: any) => void
  ): Promise<any>;
}

let webWakeLockSentinel: any = null;

const NativeBridge = registerPlugin<ThrottleLogNativePlugin>('ThrottleLogNative', {
  web: {
    startKeepAlive: async () => {},
    stopKeepAlive: async () => {},
    setCrashDetectionEnabled: async () => {},
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
    speak: async () => ({ utteranceId: '' }),
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

function isShortGoogleMapsUrl(u: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|share\.google)/i.test(u);
}

async function resolveViaVercelApi(url: string): Promise<string> {
  const encoded = encodeURIComponent(url);
  const endpoints: string[] = [];
  if (typeof window !== 'undefined' && window.location?.origin?.includes('vercel.app')) {
    endpoints.push(`/api/unshorten?url=${encoded}`);
  } else {
    endpoints.push(`/api/unshorten?url=${encoded}`, `https://throttlelog.vercel.app/api/unshorten?url=${encoded}`);
  }

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6500);
      const resp = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(t);
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await resp.json();
          if (data?.resolvedUrl && data.resolvedUrl !== url) {
            return data.resolvedUrl;
          }
        }
      }
    } catch {
      // Try next fallback endpoint
    }
  }
  return url;
}

export async function nativeUnshortenUrl(url: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await NativeBridge.unshortenUrl({ url });
      if (res?.resolvedUrl && !isShortGoogleMapsUrl(res.resolvedUrl)) {
        return res.resolvedUrl;
      }
      // Fallback to Vercel serverless unshortener if Android HttpURLConnection got stuck on a short link
      if (res?.resolvedUrl) {
        const viaApi = await resolveViaVercelApi(res.resolvedUrl);
        return viaApi || res.resolvedUrl;
      }
    } catch {
      // Fall through to Vercel unshortener API
    }
  }
  return await resolveViaVercelApi(url);
}

export async function startNativeRadarKeepAlive(pocketMode: boolean = false, resetOdometer: boolean = false) {
  let crashDetectionEnabled = true;
  try {
    const saved = localStorage.getItem('throttlelog_crash_detection_v1') ?? localStorage.getItem('sasta_crash_detection_v1');
    crashDetectionEnabled = saved !== 'false';
  } catch {}

  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.startKeepAlive({ resetOdometer, crashDetectionEnabled });
      await NativeBridge.setKeepScreenOn({ enabled: !pocketMode });
    } catch (e) {
      console.warn('Native keep-alive start warning:', e);
    }
  } else {
    await NativeBridge.setKeepScreenOn({ enabled: !pocketMode });
  }
}

export async function setNativeCrashDetectionEnabled(enabled: boolean): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBridge.setCrashDetectionEnabled({ enabled });
    } catch (e) {
      console.warn('Native crash toggle sync warning:', e);
    }
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

const pendingTtsCallbacks = new Map<string, () => void>();
let ttsListenerRegistered = false;

async function ensureNativeTtsListener(): Promise<void> {
  if (ttsListenerRegistered || !Capacitor.isNativePlatform()) return;
  ttsListenerRegistered = true;
  try {
    await NativeBridge.addListener('onTtsDone', (data: { utteranceId?: string }) => {
      const id = data?.utteranceId;
      if (id && pendingTtsCallbacks.has(id)) {
        const cb = pendingTtsCallbacks.get(id)!;
        pendingTtsCallbacks.delete(id);
        cb();
      }
    });
  } catch {
    ttsListenerRegistered = false;
  }
}

export async function nativeSpeak(
  text: string, 
  rate: number = 1.05, 
  pitch: number = 1.0,
  queue: 'flush' | 'add' = 'flush',
  onEnd?: () => void
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      if (onEnd) {
        await ensureNativeTtsListener();
      }
      const res = await NativeBridge.speak({ text, rate, pitch, queue });
      const utteranceId = res?.utteranceId;
      if (onEnd) {
        if (utteranceId) {
          let finished = false;
          const safetyTimer = setTimeout(() => {
            if (!finished) {
              finished = true;
              pendingTtsCallbacks.delete(utteranceId);
              onEnd();
            }
          }, 15000);

          pendingTtsCallbacks.set(utteranceId, () => {
            if (!finished) {
              finished = true;
              clearTimeout(safetyTimer);
              onEnd();
            }
          });
        } else {
          onEnd();
        }
      }
    } catch (e) {
      console.warn('Native TTS speak warning:', e);
      onEnd?.();
    }
  }
}

export async function nativeStopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      pendingTtsCallbacks.clear();
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


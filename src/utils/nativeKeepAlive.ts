import { registerPlugin, Capacitor } from '@capacitor/core';

interface ThrottleLogNativePlugin {
  startKeepAlive(): Promise<void>;
  stopKeepAlive(): Promise<void>;
  setKeepScreenOn(options: { enabled: boolean }): Promise<void>;
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

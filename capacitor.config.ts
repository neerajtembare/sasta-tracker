import type { CapacitorConfig } from '@capacitor/cli';

const isDebugBuild = process.env.CAPACITOR_DEBUG === 'true';

const config: CapacitorConfig = {
  appId: 'com.throttlelog.app',
  appName: 'ThrottleLog',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: isDebugBuild,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: isDebugBuild,
  },
  plugins: {
    // Native plugins can be wired here
  }
};

export default config;

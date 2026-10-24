import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.throttlelog.app',
  appName: 'ThrottleLog',
  webDir: 'dist',
  server: {
    url: 'https://throttlelog.vercel.app',
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    // Native plugins can be wired here
  }
};

export default config;

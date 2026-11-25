import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary sectionLabel="ThrottleLog">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

const isNativeCapacitor =
  Capacitor.isNativePlatform() ||
  (typeof window !== 'undefined' && window.location?.protocol === 'capacitor:');

if ('serviceWorker' in navigator) {
  if (isNativeCapacitor) {
    // Native Android/iOS APK loads bundled local assets directly; unregister any stale web SW.
    navigator.serviceWorker
      .getRegistrations()
      .then(regs => regs.forEach(reg => reg.unregister().catch(() => {})))
      .catch(() => {});
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(reg => {
          console.log('ThrottleLog Service Worker registered:', reg.scope);
        })
        .catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
    });
  }
}


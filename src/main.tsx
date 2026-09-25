import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register offline Service Worker for full PWA and remote offline capability
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('Sasta Tracker Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
  });
}


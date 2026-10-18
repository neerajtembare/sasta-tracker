/**
 * Lightweight, zero-latency Web Audio API chime synthesizer.
 * Runs 100% offline, requires no external sound files, and outputs
 * clear acoustic feedback to Bluetooth helmet intercoms (Sena, Cardo, etc.).
 */

export type ChimeType = 
  | 'start' 
  | 'pause' 
  | 'resume' 
  | 'waypoint' 
  | 'warning' 
  | 'sos' 
  | 'route_shared' 
  | 'radar_join'
  | 'regroup';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function triggerHaptic(pattern: number | number[] = 40) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export function playChime(type: ChimeType) {
  if (type === 'sos') {
    triggerHaptic([150, 50, 150, 50, 250]);
  } else if (type === 'route_shared') {
    triggerHaptic([50, 40, 80]);
  } else if (type === 'warning') {
    triggerHaptic([60, 40, 60]);
  } else {
    triggerHaptic(40);
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.001, now);

    if (type === 'start') {
      // Ascending triple tone: C5 -> E5 -> G5
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);

      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'pause') {
      // Descending two-tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.22);

      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'resume') {
      // Ascending two-tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.22);

      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'waypoint') {
      // High bell ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08);

      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'warning') {
      // Double buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.16);
    } else if (type === 'sos') {
      // Urgent alternating emergency siren (880Hz / 660Hz)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.30);
      osc.frequency.setValueAtTime(660, now + 0.45);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);

      osc.start(now);
      osc.stop(now + 0.61);
    } else if (type === 'route_shared') {
      // Melodic ascending route announcement (C5 -> G5 -> C6)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.12);
      osc.frequency.setValueAtTime(1046.50, now + 0.24);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.46);
    } else if (type === 'radar_join') {
      // Soft pleasant radar join chime (520Hz -> 780Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.start(now);
      osc.stop(now + 0.29);
    } else if (type === 'regroup') {
      // Triumphant ascending triad for squad reunion: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      osc.frequency.setValueAtTime(783.99, now + 0.18);
      osc.frequency.setValueAtTime(1046.50, now + 0.27);

      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.56);
    }
  } catch (err) {
    console.warn('Audio chime play warning:', err);
  }
}

export const playWaypointChime = () => playChime('waypoint');
export const playWarningChime = () => playChime('warning');
export const playSosChime = () => playChime('sos');
export const playRouteSharedChime = () => playChime('route_shared');
export const playRadarJoinChime = () => playChime('radar_join');
export const playRegroupChime = () => playChime('regroup');

// ── Inaudible Background Audio Keep-Alive ───────────────────────────
// Mobile browsers (Android Chrome, iOS Safari) and Android WebViews prioritize
// background processes and prevent WebSocket/GPS sleep when an audio track is active.
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
let silentAudioEl: HTMLAudioElement | null = null;
let keepAliveStarted = false;

export function enableBackgroundKeepAlive() {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  try {
    if (!silentAudioEl) {
      silentAudioEl = new Audio(SILENT_AUDIO_URI);
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.001;
    }
    keepAliveStarted = true;
    const playPromise = silentAudioEl.play();
    if (playPromise) {
      playPromise.catch(() => {});
    }
  } catch {}
}

export function disableBackgroundKeepAlive() {
  try {
    keepAliveStarted = false;
    if (silentAudioEl) {
      silentAudioEl.pause();
    }
  } catch {}
}

// Automatically bind keep-alive on the first touch or click
if (typeof window !== 'undefined') {
  const handleFirstUserGesture = () => {
    enableBackgroundKeepAlive();
    window.removeEventListener('touchstart', handleFirstUserGesture);
    window.removeEventListener('click', handleFirstUserGesture);
  };
  window.addEventListener('touchstart', handleFirstUserGesture, { passive: true, once: true });
  window.addEventListener('click', handleFirstUserGesture, { once: true });

  const resumeAudioKeepAlive = () => {
    if (keepAliveStarted && silentAudioEl && silentAudioEl.paused) {
      silentAudioEl.play().catch(() => {});
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };

  // Re-engage silent keep-alive stream when switching back from Spotify, Calls, or Google Maps
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      resumeAudioKeepAlive();
    }
  });
  window.addEventListener('focus', resumeAudioKeepAlive);

  // Periodic watchdog: revives keep-alive audio if interrupted by an incoming phone call or GPS voice prompt
  setInterval(() => {
    if (keepAliveStarted && silentAudioEl && silentAudioEl.paused) {
      silentAudioEl.play().catch(() => {});
    }
  }, 10000);
}

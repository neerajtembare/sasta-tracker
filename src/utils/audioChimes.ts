/**
 * Lightweight, zero-latency Web Audio API chime synthesizer.
 * Runs 100% offline, requires no external sound files, and outputs
 * clear acoustic feedback to Bluetooth helmet intercoms (Sena, Cardo, etc.).
 */

type ChimeType = 'start' | 'pause' | 'resume' | 'waypoint' | 'warning';

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
  triggerHaptic(type === 'warning' ? [60, 40, 60] : 45);

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
    }
  } catch (err) {
    console.warn('Audio chime play warning:', err);
  }
}

export const playWaypointChime = () => playChime('waypoint');
export const playWarningChime = () => playChime('warning');

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
    const playPromise = silentAudioEl.play();
    if (playPromise) {
      playPromise.then(() => {
        keepAliveStarted = true;
      }).catch(() => {});
    }
  } catch {}
}

export function disableBackgroundKeepAlive() {
  try {
    if (silentAudioEl) {
      silentAudioEl.pause();
      keepAliveStarted = false;
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
}

import { Capacitor } from '@capacitor/core';
import { nativeSpeak, nativeStopSpeaking } from './nativeKeepAlive';

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
}

/**
 * Universal Motorcycle Helmet Voice Alert Engine.
 * 
 * Routes voice announcements:
 * 1. In Android APK (Capacitor): Uses Android's native android.speech.tts.TextToSpeech
 *    via ThrottleLogNativePlugin. This guarantees audio delivery into Bluetooth
 *    helmet intercoms (Sena, Cardo, BluArmor, TWS) and bypasses WebView restrictions.
 * 2. In Browser (PWA/Web): Uses Web Speech API (window.speechSynthesis).
 */
export function speakAlert(text: string, options: SpeakOptions = {}): void {
  if (typeof window === 'undefined' || !text || !text.trim()) return;

  const rate = options.rate ?? 1.05;
  const pitch = options.pitch ?? 1.0;

  // 1. Native Android APK execution
  if (Capacitor.isNativePlatform()) {
    nativeSpeak(text.trim(), rate, pitch);
    if (options.onEnd) {
      // Estimate duration based on word count (approx 130 words/min = ~460ms/word)
      const words = text.trim().split(/\s+/).length;
      const approxDurationMs = Math.max(1200, (words / (130 * rate)) * 60 * 1000);
      setTimeout(() => {
        options.onEnd?.();
      }, approxDurationMs);
    }
    return;
  }

  // 2. Web Browser Fallback (window.speechSynthesis)
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop pending utterances

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = options.volume ?? 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const preferred = voices.find(
          v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (preferred) {
          utterance.voice = preferred;
        }
      }

      if (options.onEnd) {
        utterance.onend = () => {
          options.onEnd?.();
        };
      }

      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn('Browser SpeechSynthesis alert warning:', err);
  }
}

/**
 * Stop any active TTS audio immediately
 */
export function stopAlert(): void {
  if (Capacitor.isNativePlatform()) {
    nativeStopSpeaking();
    return;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/**
 * ThrottleLog — Push-to-Talk (PTT) Voice Blast Engine
 * 
 * Enables 1-tap, zero-friction walkie-talkie voice broadcasts across motorcycle squads.
 * Records short compressed audio notes (~8 KB for 5s) and auto-plays them through
 * riders' Bluetooth helmet intercoms (Sena, Cardo, BluArmor, AirPods) with realistic
 * two-way radio squelch chirps.
 */

import { triggerHaptic } from './audioChimes';

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

/**
 * Synthesize a two-way radio walkie-talkie squelch burst (like a police/aviation radio).
 */
export function playRadioSquelch(type: 'open' | 'close' = 'open') {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'open') {
      // Opening chirp: 750Hz -> 1050Hz ascending blip + soft click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.05);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.07);
    } else {
      // Closing squelch: 950Hz -> 500Hz descending tail
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch (err) {
    console.warn('Radio squelch audio warning:', err);
  }
}

export interface VoiceRecordingResult {
  audioBase64: string;
  durationMs: number;
  mimeType: string;
}

class PttVoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private timer: any = null;
  private isRecording = false;

  public get recording(): boolean {
    return this.isRecording;
  }

  public async start(onAutoStop?: (result: VoiceRecordingResult) => void): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording not supported on this device');
    }

    if (this.isRecording) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let chosenMime = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(chosenMime)) {
        chosenMime = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/ogg';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: chosenMime,
        audioBitsPerSecond: 16000, // 16kbps: crystal-clear voice while keeping payload under ~10 KB
      });

      this.chunks = [];
      this.startTime = Date.now();
      this.isRecording = true;

      playRadioSquelch('open');
      triggerHaptic(60);

      this.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250);

      // Max 8-second safety duration for motorcycle voice blasts
      this.timer = setTimeout(async () => {
        if (this.isRecording) {
          try {
            const res = await this.stop();
            if (onAutoStop && res) onAutoStop(res);
          } catch {}
        }
      }, 8000);

      return true;
    } catch (err) {
      this.cleanup();
      throw err;
    }
  }

  public stop(): Promise<VoiceRecordingResult | null> {
    return new Promise(resolve => {
      if (!this.isRecording || !this.mediaRecorder) {
        this.cleanup();
        resolve(null);
        return;
      }

      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }

      const recorder = this.mediaRecorder;
      const durationMs = Math.max(500, Date.now() - this.startTime);
      const mimeType = recorder.mimeType || 'audio/webm';

      recorder.onstop = () => {
        playRadioSquelch('close');
        triggerHaptic(40);

        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract pure base64 without data URI prefix
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve({
            audioBase64: base64,
            durationMs,
            mimeType,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        recorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  public cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.cleanup();
  }

  private cleanup() {
    this.isRecording = false;
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(t => t.stop());
      } catch {}
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

export const pttRecorder = new PttVoiceRecorder();

let currentAudioEl: HTMLAudioElement | null = null;

/**
 * Automatically plays an incoming voice blast from another rider through helmet intercom.
 */
export async function playVoiceBlastAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<void> {
  if (typeof window === 'undefined' || !audioBase64) return;

  try {
    // 1. Play walkie-talkie opening squelch tone
    playRadioSquelch('open');
    triggerHaptic([70, 40, 70]);

    // Small delay after squelch before voice starts
    await new Promise(r => setTimeout(r, 80));

    if (currentAudioEl) {
      try {
        currentAudioEl.pause();
        currentAudioEl.remove();
      } catch {}
      currentAudioEl = null;
    }

    const dataUri = `data:${mimeType};base64,${audioBase64}`;
    const audio = new Audio(dataUri);
    currentAudioEl = audio;

    audio.volume = 1.0;

    await audio.play();

    audio.onended = () => {
      playRadioSquelch('close');
      if (currentAudioEl === audio) {
        currentAudioEl = null;
      }
    };
  } catch (err) {
    console.warn('Voice blast audio playback failed:', err);
  }
}

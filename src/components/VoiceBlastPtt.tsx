import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, Send, X, Volume2, Radio } from 'lucide-react';
import { pttRecorder, VoiceRecordingResult } from '../utils/voiceBlast';
import { triggerHaptic } from '../utils/audioChimes';
import { ActiveVoiceBlast } from '../hooks/useGroupRide';

interface VoiceBlastPttButtonProps {
  onSendVoiceBlast: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export const VoiceBlastPttButton: React.FC<VoiceBlastPttButtonProps> = ({
  onSendVoiceBlast,
  disabled = false,
  className = '',
  compact = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const pressStartTimeRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pttRecorder.recording) {
        pttRecorder.cancel();
      }
    };
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (disabled || isRecording) return;
    setMicError(null);
    pressStartTimeRef.current = Date.now();

    try {
      const started = await pttRecorder.start((result: VoiceRecordingResult) => {
        // Auto-stop at 8s limit
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (result && result.audioBase64) {
          onSendVoiceBlast(result.audioBase64, result.durationMs, result.mimeType);
        }
      });

      if (started) {
        setIsRecording(true);
        setRecordSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setRecordSeconds(s => s + 1);
        }, 1000);
      }
    } catch (err: any) {
      console.warn('Microphone start error:', err);
      setIsRecording(false);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setMicError(isDenied ? 'Mic access denied. Please allow microphone permission in phone settings.' : 'Could not access mic.');
      triggerHaptic(50);
      setTimeout(() => setMicError(null), 4000);
    }
  }, [disabled, isRecording, onSendVoiceBlast]);

  const handleStopAndSend = useCallback(async () => {
    if (!isRecording) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    try {
      const result = await pttRecorder.stop();
      if (result && result.audioBase64) {
        onSendVoiceBlast(result.audioBase64, result.durationMs, result.mimeType);
      }
    } catch (err) {
      console.warn('Microphone stop error:', err);
    }
  }, [isRecording, onSendVoiceBlast]);

  const handleCancel = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    pttRecorder.cancel();
    triggerHaptic(25);
  }, []);

  // 1-Tap Toggle for riding gloves
  const handleTap = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      return;
    }

    if (!isRecording) {
      handleStartRecording();
    } else {
      handleStopAndSend();
    }
  };

  // Touch & Hold support
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only engage hold if not already recording in tap-mode
    if (!isRecording) {
      isHoldingRef.current = true;
      handleStartRecording();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isHoldingRef.current && isRecording) {
      const elapsed = Date.now() - pressStartTimeRef.current;
      // If held for more than 400ms, release sends it
      if (elapsed > 400) {
        e.preventDefault();
        isHoldingRef.current = false;
        handleStopAndSend();
      }
    }
  };

  if (isRecording) {
    return (
      <div className={`relative flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150 ${className}`}>
        {/* Active Recording Pill */}
        <button
          type="button"
          onClick={handleStopAndSend}
          className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-900/50 ring-2 ring-rose-400 animate-pulse cursor-pointer transition-all active:scale-95"
          title="Tap to finish and broadcast voice blast to crew"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
          <Mic className="w-3.5 h-3.5 fill-current" />
          <span className="tabular-nums">0:0{Math.min(8, recordSeconds)} / 0:08</span>
          <span className="bg-rose-800/80 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
            TAP SEND
          </span>
        </button>

        {/* Cancel Recording */}
        <button
          type="button"
          onClick={handleCancel}
          className="h-9 w-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          title="Cancel Voice Note"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`rounded-xl font-mono text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 select-none ${
          compact
            ? 'h-8 px-2.5 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-300'
            : 'h-9 px-3.5 bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 shadow-cyan-500/25'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Push-to-Talk: Tap (or hold) to record up to 8s walkie-talkie voice note to Squad Intercom"
      >
        <Radio className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'PTT' : 'PTT Voice'}</span>
      </button>

      {/* Permission / Mic Error Toast */}
      {micError && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 p-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-200 font-mono text-[11px] font-bold shadow-2xl whitespace-nowrap animate-in fade-in">
          ⚠️ {micError}
        </div>
      )}
    </div>
  );
};

interface VoiceBlastBannerProps {
  activeBlast: ActiveVoiceBlast | null;
  onDismiss?: () => void;
}

export const VoiceBlastBanner: React.FC<VoiceBlastBannerProps> = ({
  activeBlast,
  onDismiss,
}) => {
  if (!activeBlast) return null;

  return (
    <div className="p-2 sm:p-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md border-2 border-cyan-400 text-white font-mono text-xs shadow-2xl shadow-cyan-950/60 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 truncate">
        {/* Animated Sound Wave Equalizer Bars */}
        <div className="flex items-end gap-0.5 h-5 px-1 py-0.5 bg-cyan-950/80 rounded border border-cyan-500/40 shrink-0">
          <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_0.7s_infinite_100ms] h-3.5" />
          <span className="w-1 bg-cyan-300 rounded-full animate-[bounce_0.6s_infinite_200ms] h-4.5" />
          <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_0.8s_infinite_50ms] h-2.5" />
          <span className="w-1 bg-cyan-300 rounded-full animate-[bounce_0.65s_infinite_150ms] h-4" />
        </div>

        <div className="truncate text-left">
          <div className="flex items-center gap-1.5 truncate">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeBlast.color || '#00f0ff' }}
            />
            <span className="font-bold text-cyan-300 truncate">
              {activeBlast.riderName}
            </span>
            {activeBlast.bikeModel && (
              <span className="text-slate-400 text-[10px] truncate hidden sm:inline">
                ({activeBlast.bikeModel})
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-300 flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>Voice Intercom Playing in Helmet...</span>
          </div>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
};

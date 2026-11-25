import React from 'react';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
import { Users, AlertTriangle, Coffee, Navigation, ShieldCheck } from 'lucide-react';
import { VoiceBlastPttButton } from './VoiceBlastPtt';
import { openGoogleMapsNavigation } from '../utils/navigation';
import { AppTheme } from '../types';

interface GroupRideHudProps {
  roomCode: string;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  onOpenModal: () => void;
  onTriggerSos: () => void;
  onCancelSos?: () => void;
  onSendVoiceBlast?: (audioBase64: string, durationMs: number, mimeType?: string) => void;
  unitSystem?: 'metric' | 'imperial';
  theme?: AppTheme;
}

export const GroupRideHud: React.FC<GroupRideHudProps> = ({
  roomCode,
  members,
  sosAlert,
  onOpenModal,
  onTriggerSos,
  onCancelSos,
  onSendVoiceBlast,
  theme = 'dark',
}) => {
  if (!roomCode) return null;
  const isLight = theme === 'light';

  return (
    <div className={`w-full backdrop-blur-md border rounded-xl p-2 px-3 flex items-center justify-between gap-2 shadow-lg font-sans text-xs ${
      isLight
        ? 'bg-white/95 border-cyan-300 text-slate-900'
        : 'bg-slate-950/90 border-cyan-500/30 text-white'
    }`}>
      {/* Left: Crew identifier */}
      <button
        type="button"
        onClick={onOpenModal}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
        title="Open Crew Map & Squad Details"
        aria-label={`Crew ${roomCode}, ${members.length + 1} riders`}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
          isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
        }`}>
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="text-left">
          <div className={`text-[10px] uppercase font-bold leading-none ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            CREW {roomCode}
          </div>
          <div className={`font-bold text-[11px] leading-tight telemetry-num ${isLight ? 'text-cyan-800' : 'text-cyan-400'}`}>
            {members.length + 1} Riders
          </div>
        </div>
      </button>

      {/* Middle: Live Members Carousel / Badges */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {members.map(m => {
          const distStr = m.distanceFromMeMeters !== undefined
            ? m.distanceFromMeMeters < 1000
              ? `${Math.round(m.distanceFromMeMeters)}m`
              : `${(m.distanceFromMeMeters / 1000).toFixed(1)}km`
            : '';

          const isStopped = m.location && m.location.speedKmh < 2.0;

          return (
            <button
              key={m.riderId}
              type="button"
              onClick={() => {
                if (m.location) {
                  openGoogleMapsNavigation(m.location.lat, m.location.lon, m.name);
                } else {
                  onOpenModal();
                }
              }}
              title={m.location ? `Navigate to ${m.name} (${distStr || 'Locating'})` : m.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] shrink-0 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 hover:border-cyan-500'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: m.color || '#ffe600' }}
              />
              <span className={`font-bold truncate max-w-[70px] ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                {m.name}
              </span>
              {m.location && (
                <span className={`font-mono telemetry-num text-[10px] ${isLight ? 'text-cyan-800 font-bold' : 'text-cyan-300'}`}>
                  {Math.round(m.location.speedKmh)} km/h
                </span>
              )}
              {distStr && (
                <span className={`text-[10px] font-mono telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  ({distStr})
                </span>
              )}
              {isStopped && (
                <Coffee className={`w-3 h-3 shrink-0 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
              )}
              {m.location && (
                <Navigation className={`w-2.5 h-2.5 ml-0.5 shrink-0 ${isLight ? 'text-sky-700' : 'text-sky-400 opacity-80'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Right: Walkie-Talkie Voice Blast PTT & SOS Ping Button */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onSendVoiceBlast && (
          <VoiceBlastPttButton
            onSendVoiceBlast={onSendVoiceBlast}
            compact={true}
            theme={theme}
          />
        )}
        {sosAlert ? (
          <button
            type="button"
            onClick={() => (onCancelSos ? onCancelSos() : onTriggerSos())}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] flex items-center gap-1 shrink-0 cursor-pointer shadow-md transition-colors animate-pulse"
            title="Cancel Emergency SOS and notify squad you are safe"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Safe</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onTriggerSos}
            aria-label="Broadcast Emergency SOS to squad"
            className={`px-2.5 py-1.5 rounded-lg border font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
              isLight
                ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-800'
                : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300'
            }`}
            title="Broadcast Emergency SOS alert to squad"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
            <span>SOS</span>
          </button>
        )}
      </div>
    </div>
  );
};

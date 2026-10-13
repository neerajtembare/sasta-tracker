import React from 'react';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
import { Users, AlertTriangle, Coffee } from 'lucide-react';

interface GroupRideHudProps {
  roomCode: string;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  onOpenModal: () => void;
  onTriggerSos: () => void;
}

export const GroupRideHud: React.FC<GroupRideHudProps> = ({
  roomCode,
  members,
  sosAlert,
  onOpenModal,
  onTriggerSos,
}) => {
  if (!roomCode) return null;

  return (
    <div className="w-full bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 rounded-xl p-2 px-3 flex items-center justify-between gap-2 shadow-lg font-mono text-xs">
      {/* Left: Crew identifier */}
      <button
        onClick={onOpenModal}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
        title="Open Crew details"
      >
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
          <Users className="w-3.5 h-3.5" />
        </div>
        <div className="text-left">
          <div className="text-[10px] text-slate-400 uppercase font-bold leading-none">
            CREW {roomCode}
          </div>
          <div className="text-cyan-400 font-bold text-[11px] leading-tight">
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
            <div
              key={m.riderId}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] shrink-0"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: m.color || '#ffe600' }}
              />
              <span className="font-bold text-slate-200 truncate max-w-[70px]">
                {m.name}
              </span>
              {m.location && (
                <span className="text-cyan-300 font-mono text-[10px]">
                  {m.location.speedKmh.toFixed(0)}k
                </span>
              )}
              {distStr && (
                <span className="text-slate-400 text-[10px]">
                  ({distStr})
                </span>
              )}
              {isStopped && (
                <Coffee className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Right: SOS Ping Button */}
      <button
        onClick={onTriggerSos}
        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
        title="Call crew to regroup"
      >
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        <span className="hidden sm:inline">Regroup</span>
      </button>
    </div>
  );
};

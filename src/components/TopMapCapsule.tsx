import React, { useState } from 'react';
import { Menu, Users, Share2, Radio, Check, Copy, ShieldAlert } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

interface TopMapCapsuleProps {
  onOpenDrawer: () => void;
  roomCode?: string;
  isConnected: boolean;
  onlineCount: number;
  riderName: string;
  myColor: string;
  isRecording?: boolean;
  onToggleRecording?: () => void;
  onShareInvite?: () => void;
  onOpenSquadModal?: () => void;
  theme?: AppTheme;
}

export const TopMapCapsule: React.FC<TopMapCapsuleProps> = ({
  onOpenDrawer,
  roomCode,
  isConnected,
  onlineCount,
  riderName,
  myColor,
  isRecording = false,
  onToggleRecording,
  onShareInvite,
  onOpenSquadModal,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      triggerHaptic(25);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header 
      style={{ top: 'max(0.6rem, env(safe-area-inset-top))' }}
      className="absolute left-2.5 right-2.5 sm:left-4 sm:right-4 z-30 pointer-events-none flex justify-center"
    >
      <div 
        className={`pointer-events-auto w-full max-w-xl h-12 px-2 sm:px-3 rounded-2xl backdrop-blur-xl border flex items-center justify-between gap-2 shadow-2xl transition-all font-mono ${
          isLight
            ? 'bg-white/95 border-slate-300/80 text-slate-800 shadow-slate-300/40'
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white shadow-black/80'
        }`}
      >
        {/* Left: Google Maps-style Hamburger Menu Button */}
        <button
          id="btn-app-drawer-toggle"
          type="button"
          onClick={() => {
            triggerHaptic(20);
            onOpenDrawer();
          }}
          title="Open Menu & Settings"
          aria-label="Open Navigation Menu"
          className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
            isLight
              ? 'hover:bg-slate-100 text-slate-700'
              : 'hover:bg-slate-800/80 text-slate-300'
          }`}
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Center: Minimalist Squad / Room Pill */}
        <div 
          onClick={() => {
            triggerHaptic(20);
            if (onOpenSquadModal) {
              onOpenSquadModal();
            } else {
              onOpenDrawer();
            }
          }}
          className={`flex-1 min-w-0 flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all active:scale-98 ${
            isConnected
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
          }`}
          title={isConnected ? `Connected to Squad #${roomCode}. Tap to manage squad.` : 'Tap to create or join a squad.'}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            isConnected ? 'bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse' : 'bg-slate-500'
          }`} />

          <div className="flex items-center gap-1.5 truncate text-xs font-bold">
            {isConnected ? (
              <>
                <span className="font-heading font-black tracking-wider uppercase text-white truncate">
                  Squad #{roomCode}
                </span>
                <span className="text-[10px] opacity-75 font-mono shrink-0">
                  • {onlineCount} {onlineCount === 1 ? 'Rider' : 'Riders'}
                </span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Solo Ride • Tap to Join Squad</span>
              </>
            )}
          </div>

          {isConnected && roomCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy 4-digit squad code"
              className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Right: Share Invite or Live Rec indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isConnected && onShareInvite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(25);
                onShareInvite();
              }}
              title="Share squad link via WhatsApp"
              className="h-8 px-2 sm:px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Invite</span>
            </button>
          )}

          {/* User Profile Avatar with Color Badge */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onOpenDrawer();
            }}
            title={`Rider: ${riderName}`}
            className="w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs cursor-pointer transition-all active:scale-95 relative"
            style={{
              borderColor: myColor,
              backgroundColor: `${myColor}25`,
              color: isLight ? '#0f172a' : '#ffffff',
            }}
          >
            <span>{riderName ? riderName.slice(0, 1).toUpperCase() : 'R'}</span>
            <span 
              className="w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 border border-black" 
              style={{ backgroundColor: myColor }} 
            />
          </button>
        </div>
      </div>
    </header>
  );
};

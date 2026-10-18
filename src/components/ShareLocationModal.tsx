import React, { useState } from 'react';
import { AppTheme } from '../types';
import { 
  X, 
  MapPin, 
  Share2, 
  Navigation, 
  Copy, 
  Check, 
  AlertTriangle, 
  ExternalLink,
  Smartphone,
  Radio
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';

interface ShareLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  coords: { lat: number; lon: number } | null;
  speedKmh?: number;
  accuracyM?: number | null;
  crewCode?: string;
  theme?: AppTheme;
}

export const ShareLocationModal: React.FC<ShareLocationModalProps> = ({
  isOpen,
  onClose,
  coords,
  speedKmh = 0,
  accuracyM = null,
  crewCode,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const lat = coords?.lat ? coords.lat.toFixed(6) : null;
  const lon = coords?.lon ? coords.lon.toFixed(6) : null;
  const googleMapsUrl = coords ? `https://maps.google.com/?q=${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}` : '';

  const handleShareWhatsApp = () => {
    triggerHaptic(50);
    if (!coords) return;
    const speedStr = speedKmh > 2 ? `Speed: ${Math.round(speedKmh)} km/h` : 'Status: Stopped / Parked';
    const crewStr = crewCode ? `\nRiding with Crew: *${crewCode}*` : '';
    const text = `📍 *My Motorcycle Live Location on Google Maps:*\n${googleMapsUrl}\n\n${speedStr}${crewStr}\n\nTracked via ThrottleLog (Free Biker GPS)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleEmergencyWhatsApp = () => {
    triggerHaptic([60, 40, 60]);
    if (!coords) return;
    const text = `🚨 *EMERGENCY / REGROUP STOP:*\nI have stopped here on my bike and need backup/regroup!\n\n📍 *Google Maps Pin:*\n${googleMapsUrl}\n\nPlease navigate here if possible.`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenGoogleMaps = () => {
    triggerHaptic(40);
    if (!googleMapsUrl) return;
    window.open(googleMapsUrl, '_blank');
  };

  const handleCopyLink = () => {
    triggerHaptic(50);
    if (!googleMapsUrl) return;
    navigator.clipboard.writeText(googleMapsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    triggerHaptic(50);
    if (!coords) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Live Motorcycle Location',
          text: `My live motorcycle location on Google Maps: ${googleMapsUrl}`,
          url: googleMapsUrl,
        });
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const modalBg = isLight 
    ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' 
    : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-2xl';

  const cardBg = isLight 
    ? 'bg-slate-50 border-slate-200 text-slate-800' 
    : 'bg-[#141d26] border-[#223140] text-slate-200';

  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';

  return (
    <div 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default ${modalBg}`}
      >
        
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <span>Share Live Location</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  GOOGLE MAPS
                </span>
              </h3>
              <p className={`text-[11px] font-mono ${subTextColor}`}>
                Send direct GPS pin to WhatsApp, friends, or family
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Coordinates Status Card */}
          <div className={`p-3.5 rounded-xl border space-y-2 ${cardBg}`}>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${subTextColor}`}>
                CURRENT GPS COORDINATES
              </span>
              {coords ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Locked {accuracyM ? `(±${Math.round(accuracyM)}m)` : ''}
                </span>
              ) : (
                <span className="text-amber-400 font-bold text-[11px]">
                  Acquiring satellites...
                </span>
              )}
            </div>

            {coords ? (
              <div className="flex items-baseline justify-between font-mono">
                <div className="text-base font-bold text-white tracking-wider">
                  {lat}° N, {lon}° E
                </div>
                {speedKmh > 1 && (
                  <div className="text-xs font-bold text-sky-400">
                    {Math.round(speedKmh)} km/h
                  </div>
                )}
              </div>
            ) : (
              <p className={`text-[11px] font-mono leading-relaxed ${subTextColor}`}>
                Turn on Location or move outdoors under open sky to acquire your satellite fix.
              </p>
            )}

            {/* Quick Google Maps preview pill */}
            {coords && (
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono border-t border-slate-800/80">
                <span className="text-slate-400 truncate max-w-[240px]">
                  {googleMapsUrl}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Primary Action 1: WhatsApp Direct Share */}
          <button
            onClick={handleShareWhatsApp}
            disabled={!coords}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Location on WhatsApp</span>
          </button>

          {/* Primary Action 2: Open in Google Maps */}
          <button
            onClick={handleOpenGoogleMaps}
            disabled={!coords}
            className="w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/20 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Directly in Google Maps</span>
          </button>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleNativeShare}
              disabled={!coords}
              className="py-2.5 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
              <span>SMS / Other Apps</span>
            </button>

            <button
              onClick={handleCopyLink}
              disabled={!coords}
              className="py-2.5 px-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Link Copied!' : 'Copy Pin Link'}</span>
            </button>
          </div>

          {/* Emergency / Regroup WhatsApp Button */}
          <div className={`p-3 rounded-xl border space-y-2 ${cardBg}`}>
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Breakdown or Separated from Group?</span>
            </div>
            <p className={`text-[11px] font-mono leading-relaxed ${subTextColor}`}>
              Send an urgent regroup distress message with your exact pin to your WhatsApp riding chat.
            </p>
            <button
              onClick={handleEmergencyWhatsApp}
              disabled={!coords}
              className="w-full py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Send Regroup WhatsApp Alert</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-4 py-3 border-t flex items-center justify-between text-[11px] font-mono ${cardBg}`}>
          <span className={subTextColor}>Standard Google Maps links • Works on any phone</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-700 rounded-xl hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

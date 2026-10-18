import React, { useState } from 'react';
import { Download, Smartphone, Share2, Check, X, ShieldCheck, Copy, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';

export const APK_DIRECT_URL = 'https://github.com/neerajtembare/sasta-tracker/releases/latest/download/throttlelog-debug.apk';
export const APK_RELEASE_URL = 'https://github.com/neerajtembare/sasta-tracker/releases/tag/v1.0.0';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: AppTheme;
  deferredInstallPrompt?: any;
  onInstallPwaPrompt?: () => void;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
  deferredInstallPrompt,
  onInstallPwaPrompt,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa'>('apk');
  const [showInstallSteps, setShowInstallSteps] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(APK_DIRECT_URL).then(() => {
      setCopiedLink(true);
      triggerHaptic(25);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleShareWhatsApp = () => {
    triggerHaptic(30);
    const message = `🏍️ Download ThrottleLog Native Android App for 100km real-time ride tracking & crew radar:\n👉 ${APK_DIRECT_URL}\n(Direct APK download, zero signups required!)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl font-mono space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar pointer-events-auto transition-colors ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-700/80 text-white'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="font-heading font-black text-sm uppercase tracking-wider text-white">
                Get ThrottleLog App
              </div>
              <div className="text-[10px] text-slate-400">
                Direct Android APK & Offline Mobile Access
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Option Tabs: Android APK vs iOS / Web App (PWA) */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => {
              setActiveTab('apk');
              triggerHaptic(15);
            }}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'apk'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Android APK</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('pwa');
              triggerHaptic(15);
            }}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'pwa'
                ? 'bg-sky-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iOS / PWA</span>
          </button>
        </div>

        {/* TAB 1: DIRECT ANDROID APK DOWNLOAD */}
        {activeTab === 'apk' && (
          <div className="space-y-3.5 animate-in fade-in">
            {/* Featured Hero Box */}
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Recommended for Android
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  v1.0.0 • ~4.05 MB
                </span>
              </div>

              <div className="space-y-1">
                <div className="font-heading font-black text-sm text-white flex items-center gap-1.5">
                  <span>Standalone Native Android App</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Real-time 100km crew radar, direct GPS hardware access, and lean-angle logging with zero browser chrome.
                </p>
              </div>

              <div className="pt-1">
                <a
                  href={APK_DIRECT_URL}
                  download="throttlelog-debug.apk"
                  onClick={() => triggerHaptic(40)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 no-underline"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Download Android APK (.apk)</span>
                </a>
              </div>
            </div>

            {/* Quick 3-Step Installation Guide */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-[11px]">
              <div 
                onClick={() => setShowInstallSteps(prev => !prev)}
                className="flex items-center justify-between font-bold text-slate-300 cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>How to install on Android</span>
                </div>
                <span className="text-[10px] text-slate-400 underline">
                  {showInstallSteps ? 'Hide' : 'Show Steps'}
                </span>
              </div>

              {showInstallSteps && (
                <ol className="space-y-1.5 text-slate-300 text-[10px] leading-relaxed pt-1 border-t border-slate-800 list-decimal pl-4">
                  <li>
                    Tap <strong>Download Android APK</strong> above.
                  </li>
                  <li>
                    If your browser displays <em>"File might be harmful"</em>, tap <strong>"Download anyway"</strong> (standard Android prompt for direct APKs).
                  </li>
                  <li>
                    Pull down your notification bar or open your phone's <strong>Downloads</strong> folder, tap <strong>throttlelog-debug.apk</strong>, and tap <strong>Install</strong>.
                  </li>
                </ol>
              )}
            </div>

            {/* Share with Squad Buddies */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy APK Link'}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp to Crew</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: IOS / PROGRESSIVE WEB APP */}
        {activeTab === 'pwa' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/40 space-y-2">
              <div className="font-heading font-black text-sm text-white">
                iPhone / iPad (iOS Safari)
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                iOS does not support direct APK installation. You can install ThrottleLog as a full-screen home screen web app with zero browser bars:
              </p>
              <ol className="space-y-1 text-slate-300 text-[10px] leading-relaxed list-decimal pl-4 pt-1">
                <li>Open this website in <strong>Safari</strong> on your iPhone.</li>
                <li>Tap the <strong>Share</strong> button (the square with an arrow pointing up at the bottom).</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
              </ol>
            </div>

            {deferredInstallPrompt && (
              <button
                onClick={() => {
                  onInstallPwaPrompt?.();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Smartphone className="w-4 h-4" />
                <span>Install Web App (1-Tap Prompt)</span>
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

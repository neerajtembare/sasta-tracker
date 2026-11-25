import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share2, Check, X, ShieldCheck, Copy, Sparkles, RefreshCw } from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme } from '../types';
import { checkAppForUpdates, CURRENT_APP_VERSION, AppUpdateCheckResult, DIRECT_APK_DOWNLOAD_URL } from '../utils/appUpdater';

export const APK_DIRECT_URL = DIRECT_APK_DOWNLOAD_URL;
export const APK_DEBUG_URL = 'https://github.com/neerajtembare/sasta-tracker/releases/latest/download/throttlelog-debug.apk';
export const APK_RELEASE_URL = 'https://github.com/neerajtembare/sasta-tracker/releases/latest';

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
  const [updateInfo, setUpdateInfo] = useState<AppUpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleCheckUpdates();
    }
  }, [isOpen]);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await checkAppForUpdates();
      setUpdateInfo(res);
    } catch {
      // ignore
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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
    const message = `Download ThrottleLog Native Android App for real-time ride tracking & crew radar: ${APK_DIRECT_URL} (Direct APK download, no signups required!)`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const isLight = theme === 'light';

  return (
    <div 
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl font-sans space-y-4 max-h-[90dvh] overflow-y-auto no-scrollbar pointer-events-auto transition-colors cursor-default ${
          isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-700/80 text-white'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}>
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className={`font-heading font-black text-sm uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Get ThrottleLog App
              </div>
              <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Direct Android APK &amp; Offline Mobile Access
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Get App Modal"
            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Option Tabs: Android APK vs iOS / Web App (PWA) */}
        <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border text-xs ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <button
            onClick={() => {
              setActiveTab('apk');
              triggerHaptic(15);
            }}
            className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'apk'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')
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
                : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')
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
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-emerald-50 border-emerald-300' : 'bg-emerald-950/40 border-emerald-500/40'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  <Sparkles className="w-2.5 h-2.5" />
                  Recommended for Android
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    v{CURRENT_APP_VERSION} • ~4.0 MB
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckUpdates}
                    disabled={isCheckingUpdate}
                    title="Check for newly released APK"
                    aria-label="Check for APK updates"
                    className={`p-1 rounded cursor-pointer transition-colors border ${
                      isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-transparent'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin text-emerald-500' : ''}`} />
                  </button>
                </div>
              </div>

              {/* In-App Update Notice if Newer Build Available */}
              {updateInfo?.updateAvailable ? (
                <div className={`p-2.5 rounded-lg border text-[11px] space-y-1 animate-pulse ${
                  isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                }`}>
                  <div className={`flex items-center gap-1.5 font-bold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>New Version Available: v{updateInfo.latestVersion}</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${isLight ? 'text-amber-800' : 'text-amber-200/90'}`}>
                    Upgrades your app in-place. Your recorded rides, garage bikes, and settings will not be erased.
                  </p>
                </div>
              ) : updateInfo ? (
                <div className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400/80'}`}>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>You have the latest version installed (v{CURRENT_APP_VERSION})</span>
                </div>
              ) : null}

              <div className="space-y-1">
                <div className={`font-heading font-black text-sm flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <span>Standalone Native Android App</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Real-time crew radar, background GPS hardware access, and lean-angle logging without browser bars.
                </p>
              </div>

              <div className="pt-1">
                <a
                  href={updateInfo?.updateAvailable ? updateInfo.downloadUrl : APK_DIRECT_URL}
                  download="throttlelog.apk"
                  onClick={() => triggerHaptic(40)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95 no-underline"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {updateInfo?.updateAvailable
                      ? `Download & Upgrade to v${updateInfo.latestVersion} (.apk)`
                      : `Download Android APK v${CURRENT_APP_VERSION} (.apk)`}
                  </span>
                </a>
              </div>
            </div>

            {/* Quick 3-Step Installation Guide */}
            <div className={`p-3 rounded-xl border space-y-2 text-[11px] ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
            }`}>
              <button 
                type="button"
                onClick={() => setShowInstallSteps(prev => !prev)}
                className={`w-full flex items-center justify-between font-bold cursor-pointer text-left ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
              >
                <div className={`flex items-center gap-1.5 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>How to install on Android</span>
                </div>
                <span className={`text-[10px] underline ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showInstallSteps ? 'Hide' : 'Show Steps'}
                </span>
              </button>

              {showInstallSteps && (
                <ol className={`space-y-1.5 text-[10px] leading-relaxed pt-1 border-t list-decimal pl-4 ${
                  isLight ? 'text-slate-600 border-slate-200' : 'text-slate-300 border-slate-800'
                }`}>
                  <li>
                    Tap <strong>Download Android APK</strong> above.
                  </li>
                  <li>
                    If your browser displays <em>"File might be harmful"</em>, tap <strong>"Download anyway"</strong> (standard Android prompt for direct APKs).
                  </li>
                  <li>
                    Pull down your notification bar or open your phone's <strong>Downloads</strong> folder, tap <strong>throttlelog.apk</strong>, and tap <strong>Install</strong>.
                  </li>
                </ol>
              )}
            </div>

            {/* Share with Squad Buddies */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopyLink}
                className={`flex-1 py-2 px-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link!' : 'Copy APK Link'}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className={`flex-1 py-2 px-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  isLight ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                }`}
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
            <div className={`p-4 rounded-xl border space-y-2 ${
              isLight ? 'bg-sky-50 border-sky-300' : 'bg-sky-950/40 border-sky-500/40'
            }`}>
              <div className={`font-heading font-black text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                iPhone / iPad (iOS Safari)
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                iOS does not support direct APK installation. You can install ThrottleLog as a full-screen home screen web app with zero browser bars:
              </p>
              <ol className={`space-y-1 text-[10px] leading-relaxed list-decimal pl-4 pt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
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
          className={`w-full py-2 rounded-xl font-bold text-xs cursor-pointer transition-colors border ${
            isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Close
        </button>
      </div>
    </div>
  );
};

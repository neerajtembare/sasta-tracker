import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';

export const InAppBrowserBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('sasta_dismiss_inapp_banner');
      if (isDismissed) return;

      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      const isInApp = /FBAN|FBAV|Instagram|WhatsApp|Line|Twitter|Snapchat|MicroMessenger/i.test(ua);

      if (isInApp) {
        setShowBanner(true);
      }
    } catch {
      // ignore check errors
    }
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      sessionStorage.setItem('sasta_dismiss_inapp_banner', 'true');
    } catch {}
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-mono text-xs px-3 py-2 flex items-center justify-between gap-2 shadow-md shrink-0 border-b border-amber-600">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">⚠️</span>
        <p className="truncate sm:whitespace-normal font-bold">
          <span>In-App Browser: Tap </span>
          <strong className="underline">⋮</strong>
          <span> and select </span>
          <strong className="bg-slate-950 text-amber-300 px-1 py-0.5 rounded font-black">Open in Chrome / Safari</strong>
          <span> for screen-off GPS tracking.</span>
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="px-2 py-0.5 rounded-full bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 font-bold shrink-0 cursor-pointer"
        title="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

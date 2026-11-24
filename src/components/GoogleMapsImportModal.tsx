import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  MapPin, 
  Compass, 
  Navigation, 
  ExternalLink, 
  Clipboard, 
  Check, 
  Loader2, 
  Route, 
  Users, 
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { 
  resolveGoogleMapsDestination, 
  parseGoogleMapsCoordinates,
  ParsedDestination, 
  extractUrlFromText 
} from '../utils/googleMapsParser';
import { generateRoadRoute } from '../utils/routeGenerator';
import { nativeUnshortenUrl } from '../utils/nativeKeepAlive';
import { haversineDistance } from '../utils/gpxParser';
import { openGoogleMapsNavigation } from '../utils/navigation';
import { convertDistance } from '../utils/units';

interface GoogleMapsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  myLocation: { lat: number; lon: number } | null;
  onRouteGenerated: (route: RideAnalysis, shouldBroadcastToCrew: boolean) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  isCrewConnected?: boolean;
  initialSharedText?: string | null;
}

export const GoogleMapsImportModal: React.FC<GoogleMapsImportModalProps> = ({
  isOpen,
  onClose,
  myLocation,
  onRouteGenerated,
  theme = 'dark',
  unitSystem = 'metric',
  isCrewConnected = false,
  initialSharedText = null,
}) => {
  const isLight = theme === 'light';
  const [inputText, setInputText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [resolvedDest, setResolvedDest] = useState<ParsedDestination | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [broadcastToCrew, setBroadcastToCrew] = useState<boolean>(isCrewConnected);
  const [clipboardChecked, setClipboardChecked] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveSeqRef = useRef<number>(0);

  useEffect(() => {
    setBroadcastToCrew(isCrewConnected);
  }, [isCrewConnected]);

  useEffect(() => {
    if (isOpen) {
      if (initialSharedText) {
        setInputText(initialSharedText);
        handleProcessInput(initialSharedText, true);
      } else {
        // Check clipboard for Google Maps URL
        checkClipboard();
      }
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      resolveSeqRef.current += 1;
      setInputText('');
      setResolvedDest(null);
      setErrorMessage(null);
      setIsResolving(false);
      setIsGeneratingRoute(false);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isOpen, initialSharedText]);

  const checkClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('maps.app.goo.gl') || text.includes('google.com/maps') || text.includes('geo:') || /(-?\d+\.\d{2,})[\s,]+(-?\d+\.\d{2,})/.test(text))) {
          setInputText(text.trim());
          handleProcessInput(text.trim(), true);
          setClipboardChecked(true);
        }
      }
    } catch {
      // Clipboard access denied / unsupported
    }
  };

  const runResolve = async (clean: string) => {
    const seq = ++resolveSeqRef.current;
    setIsResolving(true);
    setErrorMessage(null);

    try {
      const dest = await resolveGoogleMapsDestination(clean, async (shortUrl) => {
        const resolved = await nativeUnshortenUrl(shortUrl);
        return { resolvedUrl: resolved };
      });

      if (seq !== resolveSeqRef.current) return;

      if (dest) {
        setResolvedDest(dest);
        triggerHaptic(25);
      } else {
        setResolvedDest(null);
        setErrorMessage('Could not find coordinates. Try pasting a full Google Maps link, coordinates (lat, lon), or city name.');
      }
    } catch (err: any) {
      if (seq !== resolveSeqRef.current) return;
      setErrorMessage('Failed to resolve location: ' + (err.message || String(err)));
    } finally {
      if (seq === resolveSeqRef.current) {
        setIsResolving(false);
      }
    }
  };

  const handleProcessInput = (rawInput: string, immediate: boolean = false) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const clean = rawInput.trim();
    if (!clean) {
      resolveSeqRef.current += 1;
      setResolvedDest(null);
      setErrorMessage(null);
      setIsResolving(false);
      return;
    }

    // Instant zero-latency path if coordinates exist locally in the string
    const instant = parseGoogleMapsCoordinates(clean);
    if (instant) {
      resolveSeqRef.current += 1;
      setResolvedDest(instant);
      setErrorMessage(null);
      setIsResolving(false);
      return;
    }

    if (immediate || extractUrlFromText(clean)) {
      runResolve(clean);
    } else {
      // Debounce Nominatim geocoding queries so typing never triggers rate-limit bans or stale races
      debounceTimerRef.current = setTimeout(() => {
        runResolve(clean);
      }, 450);
    }
  };

  const handlePasteClick = async () => {
    triggerHaptic(20);
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputText(text.trim());
          handleProcessInput(text.trim(), true);
        }
      }
    } catch {
      setErrorMessage('Clipboard permission not granted. Please paste manually into the input box.');
    }
  };

  const handleApplyRoute = async () => {
    if (!resolvedDest) return;
    triggerHaptic(40);
    setIsGeneratingRoute(true);
    setErrorMessage(null);

    try {
      // Calculate road route from current GPS position, or fallback nearby offset if indoor/cold-start
      const startPos = myLocation || { lat: resolvedDest.lat - 0.05, lon: resolvedDest.lon - 0.05 };
      
      const routeResult = await generateRoadRoute(startPos, {
        lat: resolvedDest.lat,
        lon: resolvedDest.lon,
        name: resolvedDest.name,
      });

      onRouteGenerated(routeResult.analysis, broadcastToCrew);
      onClose();
    } catch (err: any) {
      setErrorMessage('Could not calculate road route: ' + (err.message || String(err)));
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const handleOpenGoogleMapsExternal = () => {
    if (!resolvedDest) return;
    triggerHaptic(20);
    openGoogleMapsNavigation(resolvedDest.lat, resolvedDest.lon, resolvedDest.name);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-lg rounded-3xl border shadow-2xl p-4 sm:p-6 font-mono space-y-4 max-h-[92dvh] overflow-y-auto no-scrollbar transition-all ${
          isLight
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-[#0d131a] border-cyan-500/40 text-white shadow-cyan-950/40'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xl shrink-0">
              🗺️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`font-heading font-black text-base sm:text-lg tracking-wider uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Google Maps Route
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                  isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}>
                  Solo & Squad
                </span>
              </div>
              <p className={`text-[11px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Paste shared location from Google Maps, WhatsApp, or search place
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input & Action Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className={`font-bold uppercase tracking-wider text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Destination Link or Coords
            </label>
            <button
              type="button"
              onClick={handlePasteClick}
              className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste Clipboard</span>
            </button>
          </div>

          <div className="relative">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleProcessInput(e.target.value);
              }}
              placeholder="e.g. https://maps.app.goo.gl/... or 18.5204, 73.8567 or Lonavala"
              className={`w-full p-3 rounded-2xl border text-xs font-mono outline-none transition-all resize-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-900'
                  : 'bg-black/60 border-slate-700 focus:border-cyan-400 text-white'
              }`}
            />
            {isResolving && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 text-xs text-cyan-400 font-sans">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px]">Resolving...</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span className="font-sans leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Live Resolved Destination Card */}
        {resolvedDest && (
          <div className={`p-3.5 rounded-2xl border space-y-2.5 animate-in fade-in duration-200 ${
            isLight ? 'bg-cyan-50/70 border-cyan-300' : 'bg-cyan-950/30 border-cyan-500/50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 font-bold mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className={`font-heading font-black text-sm block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {resolvedDest.name}
                  </span>
                  <span className={`text-[11px] font-mono ${isLight ? 'text-cyan-700' : 'text-cyan-300/80'}`}>
                    {resolvedDest.lat.toFixed(5)}°, {resolvedDest.lon.toFixed(5)}°
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenGoogleMapsExternal}
                title="Preview in Google Maps"
                className="p-1.5 rounded-lg border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20 text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden xs:inline">Maps</span>
              </button>
            </div>

            {myLocation ? (
              <div className={`pt-2 border-t flex items-center justify-between text-xs font-sans ${
                isLight ? 'border-cyan-200 text-slate-600' : 'border-cyan-500/20 text-slate-300'
              }`}>
                <span>Straight-line distance:</span>
                <span className={`font-mono font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                  {convertDistance(
                    haversineDistance(myLocation.lat, myLocation.lon, resolvedDest.lat, resolvedDest.lon) / 1000,
                    unitSystem
                  ).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}
                </span>
              </div>
            ) : (
              <div className={`pt-2 border-t text-[11px] font-sans ${
                isLight ? 'border-cyan-200 text-amber-700' : 'border-cyan-500/20 text-amber-300'
              }`}>
                ⚠️ Waiting for GPS lock — route preview starts ~7 km from target until satellites connect.
              </div>
            )}
          </div>
        )}

        {/* Crew Broadcast Option */}
        {isCrewConnected && (
          <div 
            onClick={() => {
              triggerHaptic(20);
              setBroadcastToCrew(prev => !prev);
            }}
            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-bold block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Broadcast to Squad Convoy
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  All squad members will see this destination on their map
                </span>
              </div>
            </div>

            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
              broadcastToCrew 
                ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                : (isLight ? 'border-slate-300' : 'border-slate-600')
            }`}>
              {broadcastToCrew && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
            }`}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!resolvedDest || isGeneratingRoute}
            onClick={handleApplyRoute}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
              resolvedDest && !isGeneratingRoute
                ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-500/30'
                : (isLight ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60')
            }`}
          >
            {isGeneratingRoute ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Computing Road...</span>
              </>
            ) : (
              <>
                <Route className="w-4 h-4" />
                <span>Navigate Target</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

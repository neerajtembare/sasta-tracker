import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  MapPin, 
  ExternalLink, 
  Clipboard, 
  Check, 
  Loader2, 
  Route, 
  Users, 
  AlertCircle
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';
import { AppTheme, UnitSystem, RideAnalysis } from '../types';
import { 
  resolveGoogleMapsRoute,
  parseGoogleMapsRoute,
  ParsedRoutePlan,
  isShortOrRedirectGoogleUrl,
  extractUrlFromText 
} from '../utils/googleMapsParser';
import { generateRoadRoute } from '../utils/routeGenerator';
import { nativeUnshortenUrl } from '../utils/nativeKeepAlive';
import { haversineDistance } from '../utils/gpxParser';
import { openGoogleMapsNavigation, openGoogleMapsMultiStop } from '../utils/navigation';
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
  const [resolvedPlan, setResolvedPlan] = useState<ParsedRoutePlan | null>(null);
  const [preferLiveGpsOrigin, setPreferLiveGpsOrigin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [broadcastToCrew, setBroadcastToCrew] = useState<boolean>(isCrewConnected);
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
        checkClipboard();
      }
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      resolveSeqRef.current += 1;
      setInputText('');
      setResolvedPlan(null);
      setPreferLiveGpsOrigin(false);
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
        if (
          text &&
          (text.includes('maps.app.goo.gl') ||
            text.includes('goo.gl/maps') ||
            text.includes('g.co/') ||
            text.includes('share.google') ||
            text.includes('google.com/maps') ||
            text.includes('maps.google.') ||
            text.includes('geo:') ||
            /(-?\d+\.\d{2,})[\s,]+(-?\d+\.\d{2,})/.test(text))
        ) {
          setInputText(text.trim());
          handleProcessInput(text.trim(), true);
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
      const plan = await resolveGoogleMapsRoute(clean, async (shortUrl) => {
        const resolved = await nativeUnshortenUrl(shortUrl);
        return { resolvedUrl: resolved };
      });

      if (seq !== resolveSeqRef.current) return;

      if (plan && plan.destination.lat !== undefined && plan.destination.lon !== undefined) {
        setResolvedPlan(plan);
        setPreferLiveGpsOrigin(false);
        triggerHaptic(25);
      } else {
        setResolvedPlan(null);
        setErrorMessage('Could not resolve Google Maps link or route. Try pasting the shared URL, coordinates (lat, lon), or place name.');
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
      setResolvedPlan(null);
      setPreferLiveGpsOrigin(false);
      setErrorMessage(null);
      setIsResolving(false);
      return;
    }

    const urlInText = extractUrlFromText(clean);
    const isShort = urlInText ? isShortOrRedirectGoogleUrl(urlInText) : false;

    // Instant zero-network path when all stop/destination coords are already embedded locally
    if (!isShort) {
      const instantPlan = parseGoogleMapsRoute(clean);
      if (
        instantPlan &&
        instantPlan.allStops.length > 0 &&
        instantPlan.allStops.every(s => s.isCurrentLocation || (s.lat !== undefined && s.lon !== undefined)) &&
        instantPlan.destination.lat !== undefined &&
        instantPlan.destination.lon !== undefined
      ) {
        resolveSeqRef.current += 1;
        setResolvedPlan(instantPlan);
        setPreferLiveGpsOrigin(false);
        setErrorMessage(null);
        setIsResolving(false);
        return;
      }
    }

    if (immediate || urlInText) {
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

  const getEffectiveOrigin = (plan: ParsedRoutePlan): { lat: number; lon: number; name?: string; usingLiveGps: boolean } => {
    const destLat = plan.destination.lat!;
    const destLon = plan.destination.lon!;
    const hasExplicitOrigin = !plan.startFromCurrentLocation && plan.origin?.lat !== undefined && plan.origin?.lon !== undefined;

    if (hasExplicitOrigin && !(preferLiveGpsOrigin && myLocation)) {
      return {
        lat: plan.origin!.lat!,
        lon: plan.origin!.lon!,
        name: plan.origin!.name,
        usingLiveGps: false,
      };
    }

    if (myLocation) {
      return { lat: myLocation.lat, lon: myLocation.lon, name: 'My Location', usingLiveGps: true };
    }

    const firstWp = plan.waypoints.find(w => w.lat !== undefined && w.lon !== undefined);
    const refLat = firstWp?.lat ?? destLat;
    const refLon = firstWp?.lon ?? destLon;
    return { lat: refLat - 0.05, lon: refLon - 0.05, usingLiveGps: false };
  };

  const handleApplyRoute = async () => {
    if (!resolvedPlan || resolvedPlan.destination.lat === undefined || resolvedPlan.destination.lon === undefined) return;
    triggerHaptic(40);
    setIsGeneratingRoute(true);
    setErrorMessage(null);

    try {
      const originPos = getEffectiveOrigin(resolvedPlan);
      const validWaypoints = resolvedPlan.waypoints
        .filter(w => w.lat !== undefined && w.lon !== undefined)
        .map(w => ({ lat: w.lat!, lon: w.lon!, name: w.name }));

      const routeResult = await generateRoadRoute(
        { lat: originPos.lat, lon: originPos.lon },
        {
          lat: resolvedPlan.destination.lat,
          lon: resolvedPlan.destination.lon,
          name: resolvedPlan.name || resolvedPlan.destination.name,
        },
        {
          waypoints: validWaypoints,
          originName: originPos.name,
        }
      );

      onRouteGenerated(routeResult.analysis, broadcastToCrew);
      onClose();
    } catch (err: any) {
      setErrorMessage('Could not calculate road route: ' + (err.message || String(err)));
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const handleOpenGoogleMapsExternal = () => {
    if (!resolvedPlan || resolvedPlan.destination.lat === undefined || resolvedPlan.destination.lon === undefined) return;
    triggerHaptic(20);
    const validWaypoints = resolvedPlan.waypoints
      .filter(w => w.lat !== undefined && w.lon !== undefined)
      .map(w => ({ lat: w.lat!, lon: w.lon!, name: w.name }));
    const explicitOrigin =
      !resolvedPlan.startFromCurrentLocation &&
      !preferLiveGpsOrigin &&
      resolvedPlan.origin?.lat !== undefined &&
      resolvedPlan.origin?.lon !== undefined
        ? { lat: resolvedPlan.origin.lat, lon: resolvedPlan.origin.lon, name: resolvedPlan.origin.name }
        : null;

    if (validWaypoints.length > 0 || explicitOrigin) {
      openGoogleMapsMultiStop(
        { lat: resolvedPlan.destination.lat, lon: resolvedPlan.destination.lon, name: resolvedPlan.destination.name },
        validWaypoints,
        explicitOrigin
      );
    } else {
      openGoogleMapsNavigation(resolvedPlan.destination.lat, resolvedPlan.destination.lon, resolvedPlan.destination.name);
    }
  };

  const computeStraightLineKm = (plan: ParsedRoutePlan): number | null => {
    if (plan.destination.lat === undefined || plan.destination.lon === undefined) return null;
    const hasExplicitOrigin = !plan.startFromCurrentLocation && plan.origin?.lat !== undefined && plan.origin?.lon !== undefined;
    const start = hasExplicitOrigin && !(preferLiveGpsOrigin && myLocation)
      ? { lat: plan.origin!.lat!, lon: plan.origin!.lon! }
      : myLocation;
    if (!start) return null;

    const chain = [
      start,
      ...plan.waypoints.filter(w => w.lat !== undefined && w.lon !== undefined).map(w => ({ lat: w.lat!, lon: w.lon! })),
      { lat: plan.destination.lat, lon: plan.destination.lon },
    ];
    let meters = 0;
    for (let i = 1; i < chain.length; i++) {
      meters += haversineDistance(chain[i - 1].lat, chain[i - 1].lon, chain[i].lat, chain[i].lon);
    }
    return meters / 1000;
  };

  if (!isOpen) return null;

  const previewDistKm = resolvedPlan ? computeStraightLineKm(resolvedPlan) : null;
  const hasExplicitOrigin = !!(
    resolvedPlan &&
    !resolvedPlan.startFromCurrentLocation &&
    resolvedPlan.origin?.lat !== undefined &&
    resolvedPlan.origin?.lon !== undefined
  );

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
                  Pins & Stops
                </span>
              </div>
              <p className={`text-[11px] font-sans ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Paste a Google Maps place, Directions route with stops, or search name
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
              Maps Link, Route URL, or Place
            </label>
            <button
              type="button"
              onClick={handlePasteClick}
              className={`font-bold flex items-center gap-1 cursor-pointer transition-colors text-[11px] ${
                isLight ? 'text-cyan-700 hover:text-cyan-900' : 'text-cyan-400 hover:text-cyan-300'
              }`}
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
              placeholder="Paste maps.app.goo.gl/... or google.com/maps/dir/.../Stop1/Dest or 18.52, 73.85"
              className={`w-full p-3 rounded-2xl border text-xs font-mono outline-none transition-all resize-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-900'
                  : 'bg-black/60 border-slate-700 focus:border-cyan-400 text-white'
              }`}
            />
            {isResolving && (
              <div className={`absolute right-3 top-3 flex items-center gap-1.5 text-xs font-sans ${
                isLight ? 'text-cyan-700' : 'text-cyan-400'
              }`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-[10px]">Resolving...</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
            isLight ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
            <span className="font-sans leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Live Resolved Route / Destination Card */}
        {resolvedPlan && resolvedPlan.destination.lat !== undefined && resolvedPlan.destination.lon !== undefined && (
          <div className={`p-3.5 rounded-2xl border space-y-2.5 animate-in fade-in duration-200 ${
            isLight ? 'bg-cyan-50/70 border-cyan-300' : 'bg-cyan-950/30 border-cyan-500/50'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 flex items-center justify-center shrink-0 font-bold mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className={`font-heading font-black text-sm block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {resolvedPlan.destination.name}
                  </span>
                  <span className={`text-[11px] font-mono ${isLight ? 'text-cyan-700' : 'text-cyan-300/80'}`}>
                    {resolvedPlan.destination.lat.toFixed(5)}°, {resolvedPlan.destination.lon.toFixed(5)}°
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenGoogleMapsExternal}
                title="Preview in Google Maps"
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                  isLight
                    ? 'border-cyan-400 text-cyan-800 hover:bg-cyan-100'
                    : 'border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="text-[10px] hidden sm:inline">Maps</span>
              </button>
            </div>

            {/* Multi-stop Route Breakdown (when /dir/ or stops exist) */}
            {(hasExplicitOrigin || resolvedPlan.waypoints.length > 0) && (
              <div className={`pt-2 border-t space-y-1.5 text-[11px] font-sans ${
                isLight ? 'border-cyan-200 text-slate-700' : 'border-cyan-500/20 text-slate-300'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    🟢 <strong>Start:</strong>{' '}
                    {hasExplicitOrigin && !(preferLiveGpsOrigin && myLocation)
                      ? resolvedPlan.origin!.name
                      : (myLocation ? 'My Current GPS' : 'Approximate Origin')}
                  </span>
                  {hasExplicitOrigin && myLocation && (
                    <button
                      type="button"
                      onClick={() => setPreferLiveGpsOrigin(p => !p)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 cursor-pointer ${
                        isLight
                          ? 'bg-white border-cyan-300 text-cyan-800 hover:bg-cyan-100'
                          : 'bg-slate-900 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20'
                      }`}
                    >
                      {preferLiveGpsOrigin ? 'Use Maps Start' : 'Use My GPS'}
                    </button>
                  )}
                </div>

                {resolvedPlan.waypoints.map((wp, idx) => (
                  <div key={`${wp.name}-${idx}`} className="truncate pl-0.5">
                    📍 <strong>Stop {idx + 1}:</strong> {wp.name}
                  </div>
                ))}

                <div className="truncate">
                  🏁 <strong>Destination:</strong> {resolvedPlan.destination.name}
                </div>
              </div>
            )}

            {previewDistKm !== null ? (
              <div className={`pt-2 border-t flex items-center justify-between text-xs font-sans ${
                isLight ? 'border-cyan-200 text-slate-600' : 'border-cyan-500/20 text-slate-300'
              }`}>
                <span>
                  {resolvedPlan.waypoints.length > 0
                    ? `Route distance (${resolvedPlan.waypoints.length + 1} legs):`
                    : 'Straight-line distance:'}
                </span>
                <span className={`font-mono font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                  {convertDistance(previewDistKm, unitSystem).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}
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
                <span className={`text-[10px] font-sans block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  All squad members will see this destination and stops
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
            disabled={!resolvedPlan || resolvedPlan.destination.lat === undefined || isGeneratingRoute}
            onClick={handleApplyRoute}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
              resolvedPlan && resolvedPlan.destination.lat !== undefined && !isGeneratingRoute
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
                <span>
                  {resolvedPlan && resolvedPlan.waypoints.length > 0
                    ? `Load Route (${resolvedPlan.waypoints.length} Stops)`
                    : 'Navigate Target'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

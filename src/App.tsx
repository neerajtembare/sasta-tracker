/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroTelemetry } from './components/HeroTelemetry';
import { RideInsightsCard } from './components/RideInsightsCard';
import { SpeedZoneHistogram } from './components/SpeedZoneHistogram';
import { MapViewer } from './components/MapViewer';
import { TelemetryCharts } from './components/TelemetryCharts';
import { SpeedTrapsAndSectors } from './components/SpeedTrapsAndSectors';
import { LiveCockpitLogger } from './components/LiveCockpitLogger';
import { FaqAndArchitecture } from './components/FaqAndArchitecture';
import { GarageModal } from './components/GarageModal';
import { StopEditorModal } from './components/StopEditorModal';
import { RideDetailsEditorModal } from './components/RideDetailsEditorModal';
import { RideCalibrationModal } from './components/RideCalibrationModal';
import { LandingView } from './components/LandingView';
import { JourneyTimeline } from './components/JourneyTimeline';
import { CorneringProfileCard } from './components/CorneringProfileCard';
import { RideStoryModal } from './components/RideStoryModal';
import { RideReportModal } from './components/RideReportModal';
import { TrackComparisonModal } from './components/TrackComparisonModal';
import { CrewDashboard } from './components/CrewDashboard';
import { CloudSyncModal } from './components/CloudSyncModal';
import { useGroupRide } from './hooks/useGroupRide';
import { useGPS } from './hooks/useGPS';
import { parseGPX } from './utils/gpxParser';
import { exportAnalysisToGPX, exportPointsToGPX, downloadFile } from './utils/gpxExporter';
import { triggerHaptic } from './utils/audioChimes';
import { InAppBrowserBanner } from './components/InAppBrowserBanner';
import { saveRideToGarage, updateGarageRide } from './utils/storage';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME
} from './data/sampleRide';
import { RideAnalysis, PitStop, TrackPoint, AppTheme, UnitSystem } from './types';
import { getStoredUnitSystem, setStoredUnitSystem, convertDistance } from './utils/units';
import { 
  Radio, Gauge, HelpCircle, FolderArchive, Home, Users,
  Map as MapIcon, Activity, History, Bike as BikeIcon 
} from 'lucide-react';
import { RideDiagnosticsModal } from './components/RideDiagnosticsModal';

export type AppTab = 'home' | 'analysis' | 'cockpit' | 'crew' | 'faq';
export type AnalysisSubTab = 'map' | 'telemetry' | 'timeline' | 'bike';

export default function App() {
  const [currentTab, setCurrentTabState] = useState<AppTab>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab')) return params.get('tab') as AppTab;
        if (params.get('room') || params.get('crew')) return 'crew';
        const saved = localStorage.getItem('sasta_active_tab');
        if (saved && ['home', 'analysis', 'cockpit', 'crew', 'faq'].includes(saved)) {
          return saved as AppTab;
        }
      }
    } catch {}
    return 'crew'; // Direct open app straight to live Crew Radar!
  });

  const setCurrentTab = useCallback((action: AppTab | ((prev: AppTab) => AppTab)) => {
    setCurrentTabState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('sasta_active_tab', next);
      } catch {}
      return next;
    });
  }, []);
  // Don't preload demo ride — let landing page be the entry point
  const [analysis, setAnalysis] = useState<RideAnalysis | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isRecordingLive, setIsRecordingLive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  // Global Unit System (Metric km/h <-> Imperial mph)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getStoredUnitSystem);

  const toggleUnitSystem = () => {
    setUnitSystem(prev => {
      const next: UnitSystem = prev === 'metric' ? 'imperial' : 'metric';
      setStoredUnitSystem(next);
      return next;
    });
  };

  // Unified Single Source of Truth for GPS Tracking across Cockpit & Crew
  const [gps, controls] = useGPS(unitSystem);

  // Global Theme State
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('sasta_theme');
    return (saved === 'light' || saved === 'dark') ? (saved as AppTheme) : 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sasta_theme', next);
      return next;
    });
  };

  // Stop & Ride details editing state
  const [isStopEditorOpen, setIsStopEditorOpen] = useState<boolean>(false);
  const [stopToEdit, setStopToEdit] = useState<PitStop | null>(null);
  const [defaultStopPoint, setDefaultStopPoint] = useState<TrackPoint | null>(null);
  const [isRideNameEditorOpen, setIsRideNameEditorOpen] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);
  const groupRide = useGroupRide();
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
  } | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [analysisSubTab, setAnalysisSubTab] = useState<AnalysisSubTab>('map');
  const [focusedCoordinate, setFocusedCoordinate] = useState<{ lat: number; lon: number; label?: string } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  // Check URL query for room invite link (e.g. ?rider=Rahul or ?crew=SUNDAY)
  // Zero-friction 1-tap auto-join: joins immediately and switches to crew radar!
  const hasProcessedInviteRef = useRef(false);
  useEffect(() => {
    if (hasProcessedInviteRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || params.get('crew') || params.get('squad');
    const riderParam = params.get('rider') || params.get('name') || params.get('who');
    if (riderParam || roomParam) {
      hasProcessedInviteRef.current = true;
      setCurrentTab('crew');
      const activeName = riderParam?.trim() || groupRide.riderName;
      setSessionNotice(`🏍️ Welcome ${activeName}! Live on Crew Radar — auto-connected with squad friends.`);
      setTimeout(() => setSessionNotice(null), 6000);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    }
  }, [groupRide.riderName]);

  // Synchronize GPS coordinates directly from unified hook into groupRide and myLocation
  useEffect(() => {
    if (gps.currentCoords) {
      setMyLocation({
        lat: gps.currentCoords.lat,
        lon: gps.currentCoords.lon,
        speedKmh: gps.currentSpeedKmh,
        heading: gps.currentHeading,
      });
      groupRide.updateMyLocation(
        gps.currentCoords.lat,
        gps.currentCoords.lon,
        gps.currentSpeedKmh,
        gps.currentHeading
      );
    }
  }, [
    gps.currentCoords?.lat,
    gps.currentCoords?.lon,
    gps.currentSpeedKmh,
    gps.currentHeading,
    groupRide.updateMyLocation,
  ]);
  // Backward-compatible location update handler
  const handleUpdateMyLocation = useCallback((lat: number, lon: number, kmh: number, bearing: number | null) => {
    setMyLocation({ lat, lon, speedKmh: kmh, heading: bearing });
    groupRide.updateMyLocation(lat, lon, kmh, bearing);
  }, [groupRide.updateMyLocation]);

  const globalFileInputRef = useRef<HTMLInputElement>(null);

  // Capture PWA install prompt for 1-tap installation
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    } else {
      alert(
        'To install ThrottleLog on your phone for full-screen offline logging:\n\n' +
        '• iPhone / iPad (Safari): Tap the Share button (square with arrow) and tap "Add to Home Screen".\n' +
        '• Android (Chrome / Brave / Edge): Tap the 3 dots menu and tap "Install app" (or "Add to Home screen").'
      );
    }
  };

  // Global keyboard shortcut: Press D to toggle full diagnostics modal
  // Global keyboard shortcuts: D for diagnostics, Escape to close modals, ? for Help
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

      if (e.key === 'Escape') {
        setIsDiagnosticsOpen(false);
        setIsGarageOpen(false);
        setIsStopEditorOpen(false);
        setIsRideNameEditorOpen(false);
        setIsCalibrationOpen(false);
        setIsShareModalOpen(false);
        setIsReportModalOpen(false);
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setIsDiagnosticsOpen(prev => !prev);
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        setCurrentTab(prev => prev === 'faq' ? (analysis ? 'analysis' : 'home') : 'faq');
        return;
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [analysis]);

  const handleLoadSample = (gpxData?: string, name?: string) => {
    try {
      const dataToParse = gpxData || SAMPLE_GPX_DATA;
      const parsed = parseGPX(dataToParse);
      parsed.name = name || SAMPLE_GPX_NAME;
      setAnalysis(parsed);
      setCurrentRideId(null);
      setScrubIndex(null);
      setCurrentTab('analysis');
      setErrorMessage(null);
      // Show session-only data notice
      setSessionNotice('Ride loaded in session only. Refresh to clear, or use My Rides → Save to keep it.');
      setTimeout(() => setSessionNotice(null), 5000);
    } catch (err: any) {
      setErrorMessage('Could not load sample GPX: ' + err.message);
    }
  };

  const handleFileLoaded = (xmlText: string, fileName: string, rideId?: string) => {
    try {
      const parsed = parseGPX(xmlText);
      parsed.name = fileName || 'Uploaded Ride Track';
      setAnalysis(parsed);
      setCurrentRideId(rideId || null);
      setScrubIndex(null);
      setCurrentTab('analysis');
      setErrorMessage(null);
      if (rideId) {
        setSessionNotice(`📁 Loaded "${parsed.name}" from your Garage.`);
      } else {
        setSessionNotice('Ride loaded in session only. Refresh to clear, or use My Rides → Save to keep it.');
      }
      setTimeout(() => setSessionNotice(null), 5000);
    } catch (err: any) {
      setErrorMessage('Failed to parse GPX: ' + err.message);
    }
  };

  const handleLiveRideRecorded = useCallback((gpxText: string) => {
    try {
      const parsed = parseGPX(gpxText);
      const squadPrefix = groupRide.roomCode ? `[Crew ${groupRide.roomCode}] ` : '';
      const rideName = `${squadPrefix}Live Ride — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      parsed.name = rideName;
      setAnalysis(parsed);
      setCurrentTab('analysis');

      // Auto-save live ride to Garage so it's never lost
      try {
        const saved = saveRideToGarage({
          name: rideName,
          distanceKm: parsed.totalDistanceKm,
          maxSpeedKmh: parsed.maxSpeedKmh,
          gpxContent: gpxText,
        });
        setCurrentRideId(saved.id);
        setSessionNotice('Saved to Garage.');
        setTimeout(() => setSessionNotice(null), 4000);
      } catch (saveErr: any) {
        console.warn('Auto-save failed:', saveErr);
        setSessionNotice('Could not auto-save. Save manually.');
        setTimeout(() => setSessionNotice(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage('Error analyzing recorded ride: ' + err.message);
    }
  }, []);

  const handleStartRecording = useCallback(() => {
    controls.startNewRecording();
    setIsRecordingLive(true);
    triggerHaptic(50);
    setSessionNotice('Recording track to Garage.');
    setTimeout(() => setSessionNotice(null), 3000);
  }, [controls]);

  const handleStopAndSaveRecording = useCallback(() => {
    triggerHaptic(50);
    if (gps.pointsCount < 2) {
      alert('Cannot save ride: At least 2 GPS coordinate points are required to plot a route. Move outdoors with an open sky view.');
      return;
    }
    const pts = controls.stopAndGetPoints();
    setIsRecordingLive(false);
    if (pts.length < 2) return;

    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      pts,
      gps.markedWaypoints
    );
    handleLiveRideRecorded(gpxString);
  }, [controls, gps.pointsCount, gps.markedWaypoints, handleLiveRideRecorded]);

  const triggerUploadClick = () => {
    globalFileInputRef.current?.click();
  };

  const handleExportGpx = () => {
    if (!analysis) return;
    const gpxText = exportAnalysisToGPX(analysis);
    const safeName = (analysis.name || 'ride').replace(/\s+/g, '_');
    downloadFile(gpxText, `${safeName}.gpx`);
  };

  const handleSaveActiveToGarage = () => {
    if (!analysis) return;
    try {
      const gpxText = exportAnalysisToGPX(analysis);
      const saved = saveRideToGarage({
        id: currentRideId || undefined,
        name: analysis.name,
        distanceKm: analysis.totalDistanceKm,
        maxSpeedKmh: analysis.maxSpeedKmh,
        gpxContent: gpxText,
      });
      setCurrentRideId(saved.id);
      setSessionNotice(`🏍️ "${saved.name}" saved to your Garage!`);
      setTimeout(() => setSessionNotice(null), 4000);
    } catch (e: any) {
      setErrorMessage('Failed to save ride to Garage: ' + (e.message || String(e)));
    }
  };

  const handleCloseTrack = () => {
    setAnalysis(null);
    setCurrentRideId(null);
    setScrubIndex(null);
    setCurrentTab('home');
  };

  // Stop handlers
  const handleOpenAddStop = (pt?: TrackPoint | null) => {
    setStopToEdit(null);
    if (pt) {
      setDefaultStopPoint(pt);
    } else if (analysis && scrubIndex !== null && analysis.points[scrubIndex]) {
      setDefaultStopPoint(analysis.points[scrubIndex]);
    } else if (analysis && analysis.points.length > 0) {
      setDefaultStopPoint(analysis.points[Math.floor(analysis.points.length / 2)]);
    } else {
      setDefaultStopPoint(null);
    }
    setIsStopEditorOpen(true);
  };

  const handleOpenEditStop = (stop: PitStop) => {
    setStopToEdit(stop);
    setDefaultStopPoint(null);
    setIsStopEditorOpen(true);
  };

  const handleSaveStop = (savedStop: PitStop) => {
    if (!analysis) return;
    const existingIdx = analysis.pitStops.findIndex(s => s.id === savedStop.id);
    let updatedStops: PitStop[];
    if (existingIdx >= 0) {
      updatedStops = [...analysis.pitStops];
      updatedStops[existingIdx] = savedStop;
    } else {
      updatedStops = [...analysis.pitStops, savedStop].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    const totalStoppedSec = updatedStops.reduce((acc, s) => acc + s.durationSeconds, 0);
    const updated = {
      ...analysis,
      pitStops: updatedStops,
      stoppedTimeSeconds: Math.max(analysis.stoppedTimeSeconds, totalStoppedSec),
    };
    setAnalysis(updated);

    if (currentRideId) {
      try {
        const gpxText = exportAnalysisToGPX(updated);
        updateGarageRide(currentRideId, { gpxContent: gpxText });
      } catch (e) {
        console.warn('Failed to sync stop with garage:', e);
      }
    }
  };

  const handleDeleteStop = (stopId: string) => {
    if (!analysis) return;
    const updatedStops = analysis.pitStops.filter(s => s.id !== stopId);
    const updated = {
      ...analysis,
      pitStops: updatedStops,
    };
    setAnalysis(updated);

    if (currentRideId) {
      try {
        const gpxText = exportAnalysisToGPX(updated);
        updateGarageRide(currentRideId, { gpxContent: gpxText });
      } catch (e) {
        console.warn('Failed to sync deleted stop with garage:', e);
      }
    }
  };

  const handleSaveRideName = (newName: string) => {
    if (!analysis) return;
    const updated = {
      ...analysis,
      name: newName,
    };
    setAnalysis(updated);

    if (currentRideId) {
      try {
        const gpxText = exportAnalysisToGPX(updated);
        updateGarageRide(currentRideId, {
          name: newName,
          gpxContent: gpxText,
        });
        setSessionNotice('💾 Title updated in your Garage!');
        setTimeout(() => setSessionNotice(null), 3000);
      } catch (e) {
        console.warn('Failed to update garage ride title:', e);
      }
    }
  };

  const handleSaveCalibration = (calib: {
    userDistanceOverrideKm?: number | null;
    bikeModel?: string;
    fuelMileageKmpl?: number;
    fuelPricePerLiter?: number;
    customFuelLiters?: number | null;
    userNotes?: string;
  }) => {
    if (!analysis) return;
    const updated = {
      ...analysis,
      ...calib,
    };
    setAnalysis(updated);

    if (currentRideId) {
      try {
        const gpxText = exportAnalysisToGPX(updated);
        updateGarageRide(currentRideId, {
          gpxContent: gpxText,
          distanceKm: calib.userDistanceOverrideKm ?? updated.totalDistanceKm,
        });
        setSessionNotice('💾 Bike specs updated in your Garage!');
        setTimeout(() => setSessionNotice(null), 3000);
      } catch (e) {
        console.warn('Failed to sync calibration with garage:', e);
      }
    }
  };

  const activeScrubPoint = (() => {
    if (!analysis || scrubIndex === null || analysis.points.length === 0) return null;
    const clampedIdx = Math.max(0, Math.min(scrubIndex, analysis.points.length - 1));
    const pt = analysis.points[clampedIdx];
    if (!pt) return null;
    return {
      speedKmh: pt.speedKmh,
      elev: pt.ele,
      bearing: pt.bearing,
      distKm: pt.distanceFromStartKm,
      lean: pt.estimatedLeanAngle || 0,
    };
  })();

  return (
    <div className={`min-h-screen transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#080c10] text-[#e2e8f0]'} pb-16 landscape:pb-1`}>
      {/* Hidden Global File Input for Navbar Upload Action */}
      <input
        type="file"
        ref={globalFileInputRef}
        accept=".gpx,application/gpx+xml,text/xml"
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = ev => {
              const content = ev.target?.result;
              if (typeof content === 'string') {
                handleFileLoaded(content, file.name.replace(/\.[^/.]+$/, ''));
              }
            };
            reader.readAsText(file);
          }
        }}
      />

      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onHomeClick={() => setCurrentTab('home')}
        onLoadSample={handleLoadSample}
        onUploadClick={triggerUploadClick}
        onOpenGarage={() => setIsGarageOpen(true)}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onOpenGroupRide={() => setCurrentTab('crew')}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        groupRideConnected={groupRide.isConnected}
        groupRoomCode={groupRide.roomCode}
        onExportGpx={handleExportGpx}
        onOpenReport={() => setIsReportModalOpen(true)}
        isRecordingLive={isRecordingLive}
        hasActiveRide={!!analysis}
        rideName={
          currentTab === 'crew'
            ? groupRide.isConnected
              ? `Crew: ${groupRide.roomCode}`
              : 'Crew Group Radar'
            : currentTab === 'home'
            ? analysis
              ? `Active: ${analysis.name}`
              : 'Ready for GPX or Live Track'
            : analysis
            ? analysis.name
            : 'No track loaded'
        }
        theme={theme}
        onToggleTheme={toggleTheme}
        unitSystem={unitSystem}
        onToggleUnitSystem={toggleUnitSystem}
        onInstallPwa={handleInstallPwa}
        canInstallPwa={Boolean(deferredInstallPrompt)}
      />

      {/* In-App Browser Helper Banner (e.g. WhatsApp / Instagram WebView) */}
      <InAppBrowserBanner />

      {/* Main Container */}
      <main className={`w-full transition-all ${
        currentTab === 'crew'
          ? 'p-0.5 sm:p-2 landscape:p-0 max-w-none'
          : 'max-w-7xl mx-auto px-2 sm:px-6 pt-1 sm:pt-4 pb-20 sm:pb-8 landscape:pt-1 landscape:pb-2 space-y-3 sm:space-y-6'
      }`}>
        {/* Global Interrupted Session Recovery Banner (Surfaced across all views) */}
        {controls.hasRecoverableRide && controls.recoverableData && currentTab !== 'cockpit' && (
          <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg font-mono text-xs animate-in fade-in duration-200 ${
            theme === 'light' ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-bold text-sm">Interrupted Ride Session Found!</div>
                <div className="text-[11px] opacity-80">
                  {controls.recoverableData.points?.length || 0} unsaved GPS points ({convertDistance((controls.recoverableData.totalDistanceMeters || 0) / 1000, unitSystem).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}) from your previous ride.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <button
                onClick={() => {
                  controls.handleResumeSession();
                  setIsRecordingLive(true);
                  setCurrentTab('cockpit');
                }}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Resume Ride
              </button>
              <button
                onClick={controls.handleDiscardSession}
                className={`px-3 py-1.5 border rounded-xl transition-colors cursor-pointer ${
                  theme === 'light' ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Error message alert */}
        {errorMessage && (
          <div className={`p-3 border font-sans text-xs rounded-lg flex items-center justify-between shadow-sm ${
            theme === 'light'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-red-950/60 border-red-500/50 text-red-300'
          }`}>
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="underline font-bold cursor-pointer ml-3 shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* Session-only data notice toast */}
        {sessionNotice && (
          <div className={`p-3 border text-xs font-mono rounded-lg flex items-center justify-between transition-all animate-in fade-in duration-200 ${
            theme === 'light'
              ? 'bg-sky-50 border-sky-200 text-sky-800'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
          }`}>
            <span>🔒 {sessionNotice}</span>
            <button onClick={() => setSessionNotice(null)} className="underline font-bold cursor-pointer ml-3 shrink-0">
              Got it
            </button>
          </div>
        )}

        {/* Tab 0: Landing Page — always shown when Home is selected */}
        {currentTab === 'home' && (
          <div className="animate-in fade-in duration-300">
            <LandingView
              onFileLoaded={handleFileLoaded}
              onSelectRide={(gpxData, routeName) => handleLoadSample(gpxData, routeName)}
              onStartRecording={() => {
                handleStartRecording();
                setCurrentTab('cockpit');
              }}
              onOpenCrew={() => setCurrentTab('crew')}
              theme={theme}
              activeRideName={analysis ? analysis.name : null}
              activeRideDistanceKm={analysis ? analysis.totalDistanceKm : null}
              onResumeRide={() => setCurrentTab('analysis')}
              onClearRide={handleCloseTrack}
              onOpenGarage={() => setIsGarageOpen(true)}
            />
          </div>
        )}

        {/* Tab 1: Ride Stats & Telemetry Analysis */}
        {/* If analysis tab is active but no ride is loaded, show landing */}
        {currentTab === 'analysis' && !analysis && (
          <div className="animate-in fade-in duration-300">
            <LandingView
              onFileLoaded={handleFileLoaded}
              onSelectRide={(gpxData, routeName) => handleLoadSample(gpxData, routeName)}
              onStartRecording={() => {
                handleStartRecording();
                setCurrentTab('cockpit');
              }}
              onOpenCrew={() => setCurrentTab('crew')}
              theme={theme}
              activeRideName={null}
              activeRideDistanceKm={null}
              onOpenGarage={() => setIsGarageOpen(true)}
            />
          </div>
        )}
        {currentTab === 'analysis' && analysis && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Hero Metrics Bar with Edit Ride Name, Calibration & Share Story */}
            <HeroTelemetry
              analysis={analysis}
              activeScrubPoint={activeScrubPoint}
              onEditRideName={() => setIsRideNameEditorOpen(true)}
              onOpenStops={() => handleOpenAddStop()}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              onOpenShare={() => setIsShareModalOpen(true)}
              onOpenReport={() => setIsReportModalOpen(true)}
              onOpenCompare={() => setIsCompareModalOpen(true)}
              onCloseTrack={handleCloseTrack}
              onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
              onSaveToGarage={handleSaveActiveToGarage}
              isSavedInGarage={currentRideId !== null}
              theme={theme}
              unitSystem={unitSystem}
            />

            {/* Contextual Action Strip */}
            <div className={`p-2 sm:p-2.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs font-mono shadow-sm ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0d131a] border-[#1e2a38]'
            }`}>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCloseTrack}
                  className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                      : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-sky-400'
                  }`}
                  title="Return to all saved rides in garage"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>← All Saved Rides</span>
                </button>

                <button
                  onClick={triggerUploadClick}
                  className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-slate-300'
                  }`}
                  title="Upload another GPX file"
                >
                  <span>Import GPX</span>
                </button>
              </div>

              <button
                onClick={() => setCurrentTab('cockpit')}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ml-auto"
                title="Open live handlebar GPS dashboard"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Record New Ride</span>
              </button>
            </div>

            {/* Sticky Segmented Sub-Tab Switcher */}
            <div className={`sticky top-[58px] z-30 py-2 -mx-3 px-3 sm:-mx-6 sm:px-6 backdrop-blur-md transition-colors ${
              theme === 'light' ? 'bg-slate-100/90' : 'bg-[#080c10]/90'
            }`}>
              <div className={`flex items-center p-1 rounded-xl border text-xs font-mono font-bold shadow-md overflow-x-auto no-scrollbar gap-1 ${
                theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#0d131a] border-[#1e2a38] text-[#8f9ca8]'
              }`}>
                <button
                  onClick={() => setAnalysisSubTab('map')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    analysisSubTab === 'map'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Map</span>
                </button>

                <button
                  onClick={() => setAnalysisSubTab('telemetry')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    analysisSubTab === 'telemetry'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Speed & Lean</span>
                </button>

                <button
                  onClick={() => setAnalysisSubTab('timeline')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap relative ${
                    analysisSubTab === 'timeline'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Timeline</span>
                  {analysis.pitStops.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                      analysisSubTab === 'timeline' ? 'bg-slate-950 text-sky-400' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {analysis.pitStops.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setAnalysisSubTab('bike')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    analysisSubTab === 'bike'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                  }`}
                >
                  <BikeIcon className="w-3.5 h-3.5" />
                  <span>Bike & Fuel</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Map Route & Scrubber View */}
            {analysisSubTab === 'map' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <MapViewer
                  analysis={analysis}
                  scrubIndex={scrubIndex}
                  onScrubChange={setScrubIndex}
                  onOpenAddStopAtPoint={(pt) => handleOpenAddStop(pt)}
                  onEditStop={(stop) => handleOpenEditStop(stop)}
                  focusedCoordinate={focusedCoordinate}
                  theme={theme}
                  onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
                  groupMembers={groupRide.members}
                />
              </div>
            )}

            {/* TAB 2: Telemetry, Lean Profile & Histograms */}
            {analysisSubTab === 'telemetry' && (
              <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
                <CorneringProfileCard 
                  analysis={analysis}
                  theme={theme}
                />

                <SpeedZoneHistogram 
                  analysis={analysis}
                  theme={theme} 
                />

                <TelemetryCharts
                  analysis={analysis}
                  scrubIndex={scrubIndex}
                  onScrubChange={setScrubIndex}
                  theme={theme}
                  unitSystem={unitSystem}
                />
              </div>
            )}

            {/* TAB 3: Chronological Journey Timeline & Strava Splits */}
            {analysisSubTab === 'timeline' && (
              <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
                <JourneyTimeline
                  analysis={analysis}
                  onSelectCoordinate={(lat, lon, label) => {
                    setFocusedCoordinate({ lat, lon, label });
                    setAnalysisSubTab('map');
                  }}
                  onOpenAddStop={() => handleOpenAddStop()}
                  onEditStop={(stop) => handleOpenEditStop(stop)}
                  theme={theme}
                />

                <SpeedTrapsAndSectors
                  analysis={analysis}
                  onSelectCoordinate={(lat, lon, label) => {
                    setFocusedCoordinate({ lat, lon, label });
                    setAnalysisSubTab('map');
                  }}
                  onOpenAddStop={() => handleOpenAddStop()}
                  onEditStop={(stop) => handleOpenEditStop(stop)}
                  onDeleteStop={(stopId) => handleDeleteStop(stopId)}
                  theme={theme}
                  unitSystem={unitSystem}
                />
              </div>
            )}

            {/* TAB 4: Motorcycle Machine & Fuel Economics */}
            {analysisSubTab === 'bike' && (
              <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
                <RideInsightsCard
                  analysis={analysis}
                  onOpenCalibration={() => setIsCalibrationOpen(true)}
                  theme={theme}
                  unitSystem={unitSystem}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live GPS Logger (Kept mounted to maintain uninterrupted background recording & crew location sync when switching tabs) */}
        <div className={currentTab === 'cockpit' ? 'animate-in fade-in duration-300' : 'hidden'}>
          <LiveCockpitLogger
            onRideRecorded={handleLiveRideRecorded}
            isRecording={gps.isRecording}
            setIsRecording={setIsRecordingLive}
            gps={gps}
            controls={controls}
            theme={theme}
            unitSystem={unitSystem}
            groupRideConnected={groupRide.isConnected}
            groupRoomCode={groupRide.roomCode}
            groupMembers={groupRide.members}
            sosAlert={groupRide.sosAlert}
            onOpenGroupRideModal={() => setCurrentTab('crew')}
            onTriggerSos={groupRide.triggerSos}
            onUpdateMyLocation={handleUpdateMyLocation}
          />
        </div>

        {/* Tab 3: Dedicated First-Class Crew Command Center */}
        {currentTab === 'crew' && (
          <div className="animate-in fade-in duration-300">
            <CrewDashboard
              roomCode={groupRide.roomCode}
              lastRoomCode={groupRide.lastRoomCode}
              riderName={groupRide.riderName}
              myColor={groupRide.myColor}
              bikeModel={groupRide.bikeModel}
              myLocation={myLocation}
              isHost={groupRide.isHost}
              isConnected={groupRide.isConnected}
              connectionStatus={groupRide.connectionStatus}
              statusMessage={groupRide.statusMessage}
              members={groupRide.members}
              sosAlert={groupRide.sosAlert}
              crewNotification={groupRide.crewNotification}
              onDismissCrewNotification={groupRide.dismissCrewNotification}
              onCreateRoom={groupRide.createRoom}
              onJoinRoom={groupRide.joinRoom}
              onRejoinRoom={groupRide.rejoinRoom}
              onLeaveRoom={groupRide.leaveRoom}
              onTriggerSos={groupRide.triggerSos}
              onDismissSos={groupRide.dismissSos}
              onUpdateRiderName={groupRide.updateRiderName}
              onAddSquadFriend={groupRide.addSquadFriend}
              getFriendInviteUrl={groupRide.getFriendInviteUrl}
              onGoToCockpit={() => setCurrentTab('cockpit')}
              theme={theme}
              unitSystem={unitSystem}
              isRecording={gps.isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopAndSaveRecording}
              pointsCount={gps.pointsCount}
              totalDistanceMeters={gps.totalDistanceMeters}
              activeRoute={analysis}
              onLoadSampleRide={() => handleLoadSample()}
            />
          </div>
        )}

        {/* Tab 4: Tips & Help Guide */}
        {currentTab === 'faq' && (
          <div className="animate-in fade-in duration-300">
            <FaqAndArchitecture theme={theme} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Streamlined 3-Tab Rider Layout: Crew, Ride, My Rides) */}
      <nav 
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        className={`md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around font-mono shadow-2xl transition-colors ${
          theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
        }`}
        aria-label="Mobile Bottom Navigation"
      >
        {/* Tab 1: Crew Radar */}
        <button
          id="mobile-tab-crew"
          onClick={() => setCurrentTab('crew')}
          className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${
            currentTab === 'crew'
              ? 'text-cyan-400 font-black'
              : theme === 'light' ? 'text-slate-500 hover:text-cyan-600' : 'text-[#8f9ca8] hover:text-cyan-400'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {groupRide.isConnected && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 absolute -top-0.5 -right-1" />
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold">Crew</span>
        </button>

        {/* Tab 2: Ride Cockpit */}
        <button
          id="mobile-tab-cockpit"
          onClick={() => setCurrentTab('cockpit')}
          className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${
            currentTab === 'cockpit'
              ? 'text-emerald-400 font-black'
              : theme === 'light' ? 'text-slate-500 hover:text-emerald-600' : 'text-[#8f9ca8] hover:text-emerald-400'
          }`}
        >
          <div className="relative">
            <Radio className="w-5 h-5" />
            {isRecordingLive && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30 absolute -top-0.5 -right-1" />
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold">Ride</span>
        </button>

        {/* Tab 3: My Rides & Stats */}
        <button
          id="mobile-tab-rides"
          onClick={() => setCurrentTab('analysis')}
          className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${
            currentTab === 'analysis' || currentTab === 'home'
              ? theme === 'light' ? 'text-sky-600 font-black' : 'text-sky-400 font-black'
              : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
          }`}
        >
          <div className="relative">
            <FolderArchive className="w-5 h-5" />
            {analysis && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-1" />
            )}
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold">
            {analysis ? 'Stats & Map' : 'My Rides'}
          </span>
        </button>
      </nav>

      {/* Saved Rides Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        currentAnalysis={analysis}
        onSelectRide={(gpxText, name, id) => {
          handleFileLoaded(gpxText, name, id);
        }}
        onLoadSample={handleLoadSample}
        onCloseTrack={handleCloseTrack}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        theme={theme}
      />

      {/* Dual Track Comparison / Ghost Track Modal */}
      <TrackComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        currentAnalysis={analysis}
        theme={theme}
      />


      {/* Personal Cloud Backup & Sync Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        theme={theme}
      />

      {/* Stop Add / Edit Modal */}
      {analysis && (
        <StopEditorModal
          isOpen={isStopEditorOpen}
          onClose={() => setIsStopEditorOpen(false)}
          stopToEdit={stopToEdit}
          onSaveStop={handleSaveStop}
          onDeleteStop={handleDeleteStop}
          defaultPoint={defaultStopPoint}
          totalDistanceKm={analysis.totalDistanceKm}
          theme={theme}
        />
      )}

      {/* Ride Name Editor Modal */}
      {analysis && (
        <RideDetailsEditorModal
          isOpen={isRideNameEditorOpen}
          onClose={() => setIsRideNameEditorOpen(false)}
          currentName={analysis.name}
          onSaveName={handleSaveRideName}
          theme={theme}
        />
      )}

      {/* Ride Calibration & Motorcycle Profile Modal */}
      {analysis && (
        <RideCalibrationModal
          isOpen={isCalibrationOpen}
          onClose={() => setIsCalibrationOpen(false)}
          analysis={analysis}
          onSaveCalibration={handleSaveCalibration}
          theme={theme}
        />
      )}

      {/* 4:5 Instagram / WhatsApp Story Share Card Modal */}
      {analysis && (
        <RideStoryModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          analysis={analysis}
          theme={theme}
          unitSystem={unitSystem}
        />
      )}

      {/* Official Ride Telemetry Report & PDF Dossier Modal */}
      {analysis && (
        <RideReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          analysis={analysis}
          theme={theme}
          unitSystem={unitSystem}
        />
      )}

      {/* Full Telemetry & Diagnostics Modal */}
      {analysis && (
        <RideDiagnosticsModal
          isOpen={isDiagnosticsOpen}
          onClose={() => setIsDiagnosticsOpen(false)}
          analysis={analysis}
          theme={theme}
          onSelectCoordinate={(lat, lon, label) => {
            setFocusedCoordinate({ lat, lon, label });
            setAnalysisSubTab('map');
          }}
          onScrubToIndex={(idx) => {
            setScrubIndex(idx);
            setAnalysisSubTab('map');
          }}
        />
      )}
    </div>
  );
}

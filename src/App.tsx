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
import { CalloutBanner } from './components/CalloutBanner';
import { CloudSyncModal } from './components/CloudSyncModal';
import { DownloadAppModal } from './components/DownloadAppModal';
import { CrashAlertModal } from './components/CrashAlertModal';
import { PermissionsModal, BackgroundTrackingMode } from './components/PermissionsModal';
import { crashDetector, CrashEvent } from './utils/crashDetection';
import { useGroupRide, SharedRouteInfo } from './hooks/useGroupRide';
import { useGPS } from './hooks/useGPS';
import { parseGPX } from './utils/gpxParser';
import { exportAnalysisToGPX, exportPointsToGPX, downloadFile } from './utils/gpxExporter';
import { triggerHaptic, playWaypointChime } from './utils/audioChimes';
import { startNativeRadarKeepAlive, stopNativeRadarKeepAlive, addNativeCrashListener } from './utils/nativeKeepAlive';
import { InAppBrowserBanner } from './components/InAppBrowserBanner';
import { saveRideToGarage, updateGarageRide } from './utils/storage';
import { runConvoyWatchdog, triggerConvoyRollCall } from './utils/convoyWatchdog';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME
} from './data/sampleRide';
import { RideAnalysis, PitStop, TrackPoint, AppTheme, UnitSystem } from './types';
import { getStoredUnitSystem, setStoredUnitSystem, convertDistance } from './utils/units';
import { 
  Radio, Gauge, HelpCircle, FolderArchive, Home, Users,
  Map as MapIcon, Activity, History, Bike as BikeIcon, X 
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

  const setCurrentTab = useCallback((action: AppTab | ((prev: AppTab) => AppTab), pushHistory: boolean = true) => {
    setCurrentTabState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('sasta_active_tab', next);
      } catch {}

      if (pushHistory && next !== prev && typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', next);
          window.history.pushState({ sastaTab: next }, '', url.toString());
        } catch {}
      }
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
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [finishedRideSummary, setFinishedRideSummary] = useState<{
    distanceKm: number;
    durationMin: number;
    maxSpeedKmh: number;
  } | null>(null);

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
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundTrackingMode>(() => {
    try {
      return (localStorage.getItem('throttlelog_background_mode') as BackgroundTrackingMode) || 'keep_running';
    } catch {
      return 'keep_running';
    }
  });

  const isAnyModalOpen = isGarageOpen || isDiagnosticsOpen || isDownloadModalOpen || 
    isStopEditorOpen || isRideNameEditorOpen || isCalibrationOpen || 
    isShareModalOpen || isReportModalOpen || isCompareModalOpen || isCloudSyncOpen || isPermissionsModalOpen;

  const modalHistoryPushedRef = useRef(false);

  const closeAllModals = useCallback(() => {
    setIsGarageOpen(false);
    setIsDiagnosticsOpen(false);
    setIsDownloadModalOpen(false);
    setIsStopEditorOpen(false);
    setIsRideNameEditorOpen(false);
    setIsCalibrationOpen(false);
    setIsShareModalOpen(false);
    setIsReportModalOpen(false);
    setIsCompareModalOpen(false);
    setIsCloudSyncOpen(false);
    setIsPermissionsModalOpen(false);
  }, []);

  // Sync browser / Android back gesture with open modals
  useEffect(() => {
    if (isAnyModalOpen) {
      if (!modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = true;
        try {
          window.history.pushState({ sastaModal: true }, '');
        } catch {}
      }
    } else {
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
        if (typeof window !== 'undefined' && window.history.state?.sastaModal) {
          try {
            window.history.back();
          } catch {}
        }
      }
    }
  }, [isAnyModalOpen]);

  // Global popstate handler for back / forward navigation and modal dismissal
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. If any modal was open when user pressed back -> close all modals and consume pop
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
        closeAllModals();
        return;
      }

      // 2. Otherwise navigate between tabs
      try {
        const params = new URLSearchParams(window.location.search);
        const tab = (e.state?.sastaTab || params.get('tab')) as AppTab;
        if (tab && ['home', 'analysis', 'cockpit', 'crew', 'faq'].includes(tab)) {
          setCurrentTab(tab, false);
        }
      } catch {}
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeAllModals, setCurrentTab]);
  const groupRide = useGroupRide();
  const [myLocation, setMyLocation] = useState<{
    lat: number;
    lon: number;
    speedKmh: number;
    heading: number | null;
    accuracy?: number | null;
  } | null>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [analysisSubTab, setAnalysisSubTab] = useState<AnalysisSubTab>('map');
  const [focusedCoordinate, setFocusedCoordinate] = useState<{ lat: number; lon: number; label?: string } | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [crashModalEvent, setCrashModalEvent] = useState<CrashEvent | null>(null);

  // High-G Impact & Crash Detection Listener (DOM WebView sensors + Native Android Foreground Accelerometer)
  useEffect(() => {
    crashDetector.startListening((event) => {
      setCrashModalEvent(event);
    });

    let cleanupNative: (() => void) | null = null;
    addNativeCrashListener((nativeData) => {
      if (crashDetector.isEnabled()) {
        setCrashModalEvent({
          timestamp: nativeData.timestamp || Date.now(),
          peakG: nativeData.peakG,
          preImpactSpeedKmh: nativeData.preImpactSpeedKmh,
        });
      }
    }).then((unsub) => {
      if (unsub) cleanupNative = unsub;
    });

    return () => {
      crashDetector.stopListening();
      if (cleanupNative) cleanupNative();
    };
  }, []);

  const handleConfirmCrashSos = useCallback(() => {
    setCrashModalEvent(null);
    groupRide.triggerSos();
    setSessionNotice('🚨 Emergency SOS automatically broadcast to squad after impact!');
    setTimeout(() => setSessionNotice(null), 8000);
  }, [groupRide]);

  const handleCancelCrashSos = useCallback(() => {
    setCrashModalEvent(null);
    triggerHaptic(40);
  }, []);

  // Motorcycle Convoy Safety & Audio Watchdog State
  const [convoyAlert, setConvoyAlert] = useState<{
    id: string;
    title: string;
    message: string;
    icon: string;
    color: string;
    type: 'battery' | 'separation' | 'rabbit' | 'deviation' | 'rollcall';
    timestamp: number;
  } | null>(null);

  // Auto-dismiss convoy banner alert after 8 seconds
  useEffect(() => {
    if (!convoyAlert) return;
    const timer = setTimeout(() => {
      setConvoyAlert(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [convoyAlert]);

  // Periodic Convoy Watchdog (Checks Battery <=15% and <=8%, Runaway >1.2km, Separation >1km, Route Deviation >450m, 20-min Roll Call)
  useEffect(() => {
    const isConvoyActive = (gps.isTrackingActive ?? true) && (groupRide.isOnRadar || isRecordingLive);
    if (!isConvoyActive) return;

    const interval = setInterval(() => {
      runConvoyWatchdog({
        myLocation,
        myBattery: groupRide.myBattery,
        members: groupRide.members,
        activeRoutePoints: analysis?.points?.map(p => ({ lat: p.lat, lon: p.lon })),
        unitSystem,
        onAlertBanner: (alert) => {
          setConvoyAlert({
            id: 'alert_' + Date.now(),
            ...alert,
            timestamp: Date.now(),
          });
        },
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [
    groupRide.isOnRadar,
    isRecordingLive,
    myLocation,
    groupRide.myBattery,
    groupRide.members,
    analysis?.points,
    unitSystem,
    gps.isTrackingActive,
  ]);

  // Manual On-Demand Squad Roll Call (e.g. from AppDrawer or Map Capsule)
  const handleManualRollCall = useCallback(() => {
    triggerConvoyRollCall(
      {
        myLocation,
        myBattery: groupRide.myBattery,
        members: groupRide.members,
        unitSystem,
        onAlertBanner: (alert) => {
          setConvoyAlert({
            id: 'rollcall_' + Date.now(),
            ...alert,
            timestamp: Date.now(),
          });
        },
      },
      true
    );
  }, [myLocation, groupRide.myBattery, groupRide.members, unitSystem]);

  // Native Android Foreground Service & Keep-Alive (guarantees GPS, WebSocket survive backgrounding, & handlebar mount screen stays awake)
  useEffect(() => {
    const isGpsActive = gps.isTrackingActive ?? true;
    const shouldKeepAlive = isGpsActive && (isRecordingLive || groupRide.isOnRadar);
    if (shouldKeepAlive) {
      startNativeRadarKeepAlive();
    } else {
      stopNativeRadarKeepAlive();
    }
  }, [isRecordingLive, groupRide.isOnRadar, gps.isTrackingActive]);

  // First-Launch Permissions & Background Mode Setup Onboarding Prompt
  useEffect(() => {
    try {
      const setupCompleted = localStorage.getItem('throttlelog_permissions_setup_completed');
      if (!setupCompleted) {
        setIsPermissionsModalOpen(true);
      }
    } catch {}
  }, []);

  // Background Tracking Mode Visibility Watcher (Gracefully halts background GPS service if user chose stop_on_exit)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (backgroundMode === 'stop_on_exit' && !isRecordingLive) {
          stopNativeRadarKeepAlive();
        }
      } else if (document.visibilityState === 'visible') {
        const isGpsActive = gps.isTrackingActive ?? true;
        if (isGpsActive && (isRecordingLive || groupRide.isOnRadar)) {
          startNativeRadarKeepAlive();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundMode, isRecordingLive, gps.isTrackingActive, groupRide.isOnRadar]);

  // Unified Privacy & Stop Tracking Handler (zero-battery standby, stops GPS watch, kills native keep-alive & MQTT broadcasts)
  const handleToggleTracking = useCallback((enable?: boolean) => {
    const isCurrentlyActive = (gps.isTrackingActive ?? true) && groupRide.isOnRadar;
    const next = enable !== undefined ? enable : !isCurrentlyActive;
    if (!next) {
      controls.stopGpsTracking();
      groupRide.toggleOnRadar(false);
      stopNativeRadarKeepAlive();
      setMyLocation(null);
      setSessionNotice('🛡️ Privacy Mode Active: GPS hardware, background services, and radar broadcasts stopped.');
      setTimeout(() => setSessionNotice(null), 5000);
      triggerHaptic(30);
    } else {
      controls.startGpsTracking();
      groupRide.toggleOnRadar(true);
      setSessionNotice('🟢 Live Tracking Active: GPS location and squad radar broadcasting resumed.');
      setTimeout(() => setSessionNotice(null), 5000);
      triggerHaptic(30);
    }
  }, [gps.isTrackingActive, groupRide, controls]);

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
      if (roomParam?.trim()) {
        groupRide.joinRoom(roomParam.trim(), riderParam?.trim());
      } else if (riderParam?.trim()) {
        groupRide.updateRiderName(riderParam.trim());
      }
      setSessionNotice(`🏍️ Welcome ${activeName}! Live on Crew Radar ${roomParam ? `in Squad [${roomParam.trim().toUpperCase()}]` : ''}.`);
      setTimeout(() => setSessionNotice(null), 6000);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    }
  }, [groupRide.riderName, groupRide.joinRoom, groupRide.updateRiderName]);

  // Synchronize GPS coordinates directly from unified hook into groupRide and myLocation
  useEffect(() => {
    if (gps.currentCoords) {
      setMyLocation({
        lat: gps.currentCoords.lat,
        lon: gps.currentCoords.lon,
        speedKmh: gps.currentSpeedKmh,
        heading: gps.currentHeading,
        accuracy: gps.gpsAccuracy,
      });
      groupRide.updateMyLocation(
        gps.currentCoords.lat,
        gps.currentCoords.lon,
        gps.currentSpeedKmh,
        gps.currentHeading
      );
      crashDetector.updateGpsSpeed(gps.currentSpeedKmh);
    } else if (!gps.isTrackingActive) {
      setMyLocation(null);
    }
  }, [
    gps.currentCoords?.lat,
    gps.currentCoords?.lon,
    gps.currentSpeedKmh,
    gps.currentHeading,
    gps.isTrackingActive,
    groupRide.updateMyLocation,
  ]);
  // Backward-compatible location update handler
  const handleUpdateMyLocation = useCallback((lat: number, lon: number, kmh: number, bearing: number | null) => {
    setMyLocation({ lat, lon, speedKmh: kmh, heading: bearing });
    groupRide.updateMyLocation(lat, lon, kmh, bearing);
    crashDetector.updateGpsSpeed(kmh);
  }, [groupRide.updateMyLocation]);

  const isLocallyInitiatedRouteRef = useRef<boolean>(true);

  // Auto-broadcast active planned route to Crew Radar only if locally initiated (prevents join loopback storm)
  useEffect(() => {
    if (!isLocallyInitiatedRouteRef.current) return;
    if (analysis && analysis.points && analysis.points.length > 0) {
      const dest = analysis.points[analysis.points.length - 1];
      groupRide.broadcastActiveRoute({
        name: analysis.name || 'Weekend Ride',
        distanceKm: analysis.totalDistanceKm,
        destination: { lat: dest.lat, lon: dest.lon },
        points: analysis.points.map(p => ({ lat: p.lat, lon: p.lon })),
      });
    }
  }, [analysis?.name, analysis?.totalDistanceKm, groupRide.broadcastActiveRoute]);

  // 1-Tap Join Friend's Shared Route on Crew Radar
  const handleJoinSharedRoute = useCallback((route: SharedRouteInfo) => {
    isLocallyInitiatedRouteRef.current = false;
    const rawPts = route.points && route.points.length > 0 ? route.points : [route.destination];
    const pts: TrackPoint[] = rawPts.map((p, idx) => ({
      lat: p.lat,
      lon: p.lon,
      ele: null,
      time: new Date(Date.now() + idx * 1000).toISOString(),
      speed: 0,
      speedKmh: 0,
      bearing: null,
      sat: null,
      hdop: null,
      vdop: null,
      pdop: null,
      geoidheight: null,
      segmentIndex: 0,
      distanceFromStartKm: (route.distanceKm / Math.max(1, rawPts.length - 1)) * idx,
    }));

    const syntheticAnalysis: RideAnalysis = {
      name: route.routeName,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      totalDurationSeconds: 0,
      movingTimeSeconds: 0,
      stoppedTimeSeconds: 0,
      totalDistanceKm: route.distanceKm,
      maxSpeedKmh: 0,
      overallAvgSpeedKmh: 0,
      movingAvgSpeedKmh: 0,
      elevGainM: 0,
      elevLossM: 0,
      elevMinM: null,
      elevMaxM: null,
      elevStartM: null,
      elevEndM: null,
      avgSatellites: null,
      maxSatellites: null,
      bestHdop: null,
      maxEstimatedLean: 0,
      points: pts,
      pitStops: [],
      speedTraps: [],
      segments: [],
    };

    setAnalysis(syntheticAnalysis);
    triggerHaptic(50);
    playWaypointChime();
    setSessionNotice(`🗺️ Joined ${route.riderName}'s route: "${route.routeName}"!`);
    setTimeout(() => setSessionNotice(null), 5000);
  }, []);

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

  const handleOpenDownloadApp = () => {
    setIsDownloadModalOpen(true);
    triggerHaptic(20);
  };

  const handleTriggerPwaInstall = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredInstallPrompt(null);
      }
    }
  };

  // Global keyboard shortcut: Press D to toggle full diagnostics modal
  // Global keyboard shortcuts: D for diagnostics, Escape to close modals, ? for Help
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

      if (e.key === 'Escape') {
        closeAllModals();
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
      isLocallyInitiatedRouteRef.current = true;
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
      isLocallyInitiatedRouteRef.current = true;
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

  const handleLiveRideRecorded = useCallback((gpxText: string, keepOnMap: boolean = false) => {
    try {
      const parsed = parseGPX(gpxText);
      const squadPrefix = groupRide.roomCode ? `[Crew ${groupRide.roomCode}] ` : '';
      const rideName = `${squadPrefix}Live Ride — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      parsed.name = rideName;
      isLocallyInitiatedRouteRef.current = true;
      setAnalysis(parsed);

      if (keepOnMap) {
        const durationMin = Math.max(1, Math.round((parsed.totalDurationSeconds || 0) / 60));
        setFinishedRideSummary({
          distanceKm: parsed.totalDistanceKm,
          durationMin,
          maxSpeedKmh: parsed.maxSpeedKmh,
        });
      } else {
        setCurrentTab('analysis');
      }

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
  }, [groupRide.roomCode, setCurrentTab]);

  const handleStartRecording = useCallback(() => {
    controls.startNewRecording();
    setIsRecordingLive(true);
    triggerHaptic(50);
    setSessionNotice('Recording track to Garage.');
    setTimeout(() => setSessionNotice(null), 3000);
  }, [controls]);

  const handleStopAndSaveRecording = useCallback(() => {
    triggerHaptic(50);
    const pts = controls.stopAndGetPoints();
    setIsRecordingLive(false);

    // If accidental recording, under 2 points, or less than 80 meters, cleanly discard without blocking
    if (pts.length < 2 || gps.totalDistanceMeters < 80) {
      setSessionNotice('Recording cancelled (track was too short to save).');
      setTimeout(() => setSessionNotice(null), 3500);
      return;
    }

    const gpxString = exportPointsToGPX(
      `Motorcycle Ride — ${new Date().toLocaleDateString()}`,
      pts,
      gps.markedWaypoints
    );
    // Stay on map and present in-map ride summary
    handleLiveRideRecorded(gpxString, true);
  }, [controls, gps.totalDistanceMeters, gps.markedWaypoints, handleLiveRideRecorded]);

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
    isLocallyInitiatedRouteRef.current = true;
    groupRide.broadcastActiveRoute(null);
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
    <div className={`transition-colors ${
      currentTab === 'crew'
        ? 'h-[100dvh] w-screen overflow-hidden flex flex-col m-0 p-0'
        : 'min-h-[100dvh] flex flex-col pb-16 landscape:pb-1'
    } ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#080c10] text-[#e2e8f0]'}`}>
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

      {/* Navigation - Only shown on secondary views (Cockpit, Analysis, FAQ); Map is clean full-screen Google Maps style */}
      {currentTab !== 'crew' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onHomeClick={() => setCurrentTab('crew')}
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
            analysis
              ? analysis.name
              : 'No track loaded'
          }
          theme={theme}
          onToggleTheme={toggleTheme}
          unitSystem={unitSystem}
          onToggleUnitSystem={toggleUnitSystem}
        />
      )}

      {/* In-App Browser Helper Banner (surfaced across all views including live map) */}
      <InAppBrowserBanner />

      {/* Global Convoy Safety & Alert Banner (Battery, Runaway Ahead, Separation, Route Deviation, Roll Call) */}
      {convoyAlert && (
        <div 
          style={{
            top: 'max(4.2rem, calc(env(safe-area-inset-top) + 3.8rem))',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-50 pointer-events-none flex justify-center animate-in slide-in-from-top-3 duration-300"
        >
          <div 
            className={`pointer-events-auto w-full max-w-md rounded-2xl backdrop-blur-xl border-2 shadow-2xl overflow-hidden font-mono transition-all p-3 flex items-center justify-between gap-3 ${
              theme === 'light'
                ? 'bg-white/95 text-slate-800 shadow-slate-400/50'
                : 'bg-[#0d131a]/95 text-white shadow-black/90'
            }`}
            style={{ borderColor: convoyAlert.color || '#00f0ff' }}
          >
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border"
              style={{
                backgroundColor: `${convoyAlert.color || '#00f0ff'}20`,
                borderColor: `${convoyAlert.color || '#00f0ff'}50`,
              }}
            >
              {convoyAlert.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div 
                className="text-[10px] font-black uppercase tracking-wider truncate"
                style={{ color: convoyAlert.color || '#00f0ff' }}
              >
                {convoyAlert.title}
              </div>
              <div className={`text-xs font-sans truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-200'}`}>
                {convoyAlert.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(20);
                setConvoyAlert(null);
              }}
              title="Dismiss alert"
              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                theme === 'light' ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Global Callout Flash Banner for secondary tabs */}
      {currentTab !== 'crew' && (
        <CalloutBanner
          callout={groupRide.activeCallout}
          onDismiss={groupRide.dismissCallout}
          theme={theme}
        />
      )}

      {/* Main Container */}
      <main className={`w-full transition-all ${
        currentTab === 'crew'
          ? 'h-[100dvh] w-full overflow-hidden flex flex-col p-0 m-0 max-w-none'
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
              onOpenDownloadApp={handleOpenDownloadApp}
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
              onOpenDownloadApp={handleOpenDownloadApp}
            />
          </div>
        )}
        {currentTab === 'analysis' && analysis && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Direct Return to Live Crew Map Banner */}
            <div className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-md font-mono text-xs ${
              theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-slate-800' : 'bg-cyan-950/40 border-cyan-500/30 text-white'
            }`}>
              <button
                type="button"
                onClick={() => setCurrentTab('crew')}
                className="py-2 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
              >
                <Users className="w-4 h-4 stroke-[2.5]" />
                <span>← Return to Live Crew Map</span>
              </button>
              <div className="text-right truncate hidden xs:block">
                <span className="text-[11px] text-slate-400">Viewing Saved Ride Telemetry</span>
              </div>
            </div>

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
                  unitSystem={unitSystem}
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
        <div className={currentTab === 'cockpit' ? 'animate-in fade-in duration-300 space-y-3' : 'hidden'}>
          <div className={`p-2.5 sm:p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-md font-mono text-xs ${
            theme === 'light' ? 'bg-cyan-50 border-cyan-200 text-slate-800' : 'bg-cyan-950/40 border-cyan-500/30 text-white'
          }`}>
            <button
              type="button"
              onClick={() => setCurrentTab('crew')}
              className="py-1.5 px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <Users className="w-4 h-4 stroke-[2.5]" />
              <span>← Return to Live Crew Map</span>
            </button>
            <span className="text-[11px] text-slate-400 font-mono hidden xs:inline">Solo Digital Cockpit</span>
          </div>

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
            onCancelSos={groupRide.cancelSos}
            onUpdateMyLocation={handleUpdateMyLocation}
            activeVoiceBlast={groupRide.activeVoiceBlast}
            onDismissVoiceBlast={groupRide.dismissVoiceBlast}
            onSendVoiceBlast={groupRide.sendVoiceBlast}
          />
        </div>

        {/* Tab 3: Dedicated First-Class Crew Command Center */}
        {currentTab === 'crew' && (
          <div className="w-full h-full flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <CrewDashboard
              roomCode={groupRide.roomCode}
              lastRoomCode={groupRide.lastRoomCode}
              riderName={groupRide.riderName}
              myColor={groupRide.myColor}
              bikeModel={groupRide.bikeModel}
              myLocation={myLocation}
              isHost={groupRide.isHost}
              leaderId={groupRide.leaderId}
              onSetSquadLeader={groupRide.setSquadLeader}
              onClaimSquadLeader={groupRide.claimSquadLeader}
              isConnected={groupRide.isConnected}
              connectionStatus={groupRide.connectionStatus}
              statusMessage={groupRide.statusMessage}
              members={groupRide.members}
              sosAlert={groupRide.sosAlert}
              crewNotification={groupRide.crewNotification}
              onDismissCrewNotification={groupRide.dismissCrewNotification}
              onTriggerSos={groupRide.triggerSos}
              onCancelSos={groupRide.cancelSos}
              onDismissSos={groupRide.dismissSos}
              onUpdateRiderName={groupRide.updateRiderName}
              onAddSquadFriend={groupRide.addSquadFriend}
              getFriendInviteUrl={groupRide.getFriendInviteUrl}
              onGoToCockpit={() => setCurrentTab('cockpit')}
              theme={theme}
              onToggleTheme={toggleTheme}
              unitSystem={unitSystem}
              onToggleUnitSystem={toggleUnitSystem}
              isRecording={gps.isRecording}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopAndSaveRecording}
              pointsCount={gps.pointsCount}
              totalDistanceMeters={gps.totalDistanceMeters}
              activeRoute={analysis}
              onClearActiveRoute={handleCloseTrack}
              onLoadSampleRide={() => handleLoadSample()}
              isOnRadar={groupRide.isOnRadar}
              onToggleRadar={groupRide.toggleOnRadar}
              isTrackingActive={gps.isTrackingActive}
              onToggleTracking={handleToggleTracking}
              onJoinSharedRoute={handleJoinSharedRoute}
              activeVoiceBlast={groupRide.activeVoiceBlast}
              onDismissVoiceBlast={groupRide.dismissVoiceBlast}
              onSendVoiceBlast={groupRide.sendVoiceBlast}
              isConvoyRegrouped={groupRide.isConvoyRegrouped}
              onOpenGarage={() => setIsGarageOpen(true)}
              onOpenDownloadApp={handleOpenDownloadApp}
              onOpenFaq={() => setCurrentTab('faq')}
              finishedRideSummary={finishedRideSummary}
              onDismissRideSummary={() => setFinishedRideSummary(null)}
              onViewTelemetry={() => {
                setFinishedRideSummary(null);
                setCurrentTab('analysis');
              }}
              activeCallout={groupRide.activeCallout}
              onDismissCallout={groupRide.dismissCallout}
              onSendCallout={groupRide.sendCallout}
              gpsError={gps.gpsError}
              onTriggerRollCall={handleManualRollCall}
              onOpenPermissionsModal={() => setIsPermissionsModalOpen(true)}
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

      {/* Mobile Landscape Left Thumb Rail (Motorcycle Handlebar Mount Mode) - Only on secondary tabs */}
      {currentTab !== 'crew' && (
        <nav
          aria-label="Mobile Landscape Navigation Dock"
          className={`hidden mobile-landscape-dock fixed left-0 top-0 bottom-0 w-14 z-50 flex-col items-center justify-around py-4 backdrop-blur-lg border-r shadow-2xl transition-colors ${
            theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
          }`}
          style={{
            paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.25rem, env(safe-area-inset-left))',
          }}
        >
          {/* Tab 1: Crew Map */}
          <button
            onClick={() => setCurrentTab('crew')}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer hover:text-white"
            title="Crew Map"
          >
            <Users className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Map</span>
          </button>

          {/* Tab 2: Cockpit */}
          <button
            onClick={() => setCurrentTab('cockpit')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
              currentTab === 'cockpit' ? 'text-emerald-400 bg-emerald-500/15 font-black' : 'hover:text-white'
            }`}
            title="Ride Cockpit"
          >
            <Radio className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Ride</span>
          </button>

          {/* Tab 3: Rides / Analysis */}
          <button
            onClick={() => setCurrentTab('analysis')}
            className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
              currentTab === 'analysis' || currentTab === 'home' ? 'text-sky-400 bg-sky-500/15 font-black' : 'hover:text-white'
            }`}
            title="My Rides"
          >
            <FolderArchive className="w-5 h-5" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Rides</span>
          </button>
        </nav>
      )}

      {/* Mobile Bottom Navigation Bar - Only on secondary tabs */}
      {currentTab !== 'crew' && (
        <nav 
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          className={`md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around font-mono shadow-2xl transition-colors ${
            theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
          }`}
          aria-label="Mobile Bottom Navigation"
        >
          {/* Tab 1: Crew Map */}
          <button
            id="mobile-tab-crew"
            onClick={() => setCurrentTab('crew')}
            className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${
              theme === 'light' ? 'text-slate-500 hover:text-cyan-600' : 'text-[#8f9ca8] hover:text-cyan-400'
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {groupRide.isConnected && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 absolute -top-0.5 -right-1" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold">Map</span>
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
      )}

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

      {/* Native Android APK & App Install Modal */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        theme={theme}
        deferredInstallPrompt={deferredInstallPrompt}
        onInstallPwaPrompt={handleTriggerPwaInstall}
      />

      {/* Severe Impact & Motorcycle Crash Alert Modal */}
      <CrashAlertModal
        isOpen={crashModalEvent !== null}
        crashEvent={crashModalEvent}
        onCancel={handleCancelCrashSos}
        onConfirmSos={handleConfirmCrashSos}
        unitSystem={unitSystem}
      />

      {/* Permissions Onboarding & Background Tracking Preference Modal */}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        theme={theme}
        onApplyBackgroundMode={(mode) => setBackgroundMode(mode)}
      />
    </div>
  );
}

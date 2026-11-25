/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Navbar } from './components/Navbar';
import { HeroTelemetry } from './components/HeroTelemetry';
import { RideInsightsCard } from './components/RideInsightsCard';
import { SpeedZoneHistogram } from './components/SpeedZoneHistogram';
import { SpeedTrapsAndSectors } from './components/SpeedTrapsAndSectors';
import { LiveCockpitLogger } from './components/LiveCockpitLogger';
import { StopEditorModal } from './components/StopEditorModal';
import { RideDetailsEditorModal } from './components/RideDetailsEditorModal';
import { RideCalibrationModal } from './components/RideCalibrationModal';
import { LandingView } from './components/LandingView';
import { JourneyTimeline } from './components/JourneyTimeline';
import { CorneringProfileCard } from './components/CorneringProfileCard';
import { CalloutBanner } from './components/CalloutBanner';
import { DownloadAppModal } from './components/DownloadAppModal';

const MapViewer = lazy(() => import('./components/MapViewer').then(m => ({ default: m.MapViewer })));
const TelemetryCharts = lazy(() => import('./components/TelemetryCharts').then(m => ({ default: m.TelemetryCharts })));
const CrewDashboard = lazy(() => import('./components/CrewDashboard').then(m => ({ default: m.CrewDashboard })));
const FaqAndArchitecture = lazy(() => import('./components/FaqAndArchitecture').then(m => ({ default: m.FaqAndArchitecture })));
const GarageModal = lazy(() => import('./components/GarageModal').then(m => ({ default: m.GarageModal })));
const TrackComparisonModal = lazy(() => import('./components/TrackComparisonModal').then(m => ({ default: m.TrackComparisonModal })));
const CloudSyncModal = lazy(() => import('./components/CloudSyncModal').then(m => ({ default: m.CloudSyncModal })));
const RideStoryModal = lazy(() => import('./components/RideStoryModal').then(m => ({ default: m.RideStoryModal })));
const RideReportModal = lazy(() => import('./components/RideReportModal').then(m => ({ default: m.RideReportModal })));
const RideDiagnosticsModal = lazy(() => import('./components/RideDiagnosticsModal').then(m => ({ default: m.RideDiagnosticsModal })));
const RiderProfileModal = lazy(() => import('./components/RiderProfileModal').then(m => ({ default: m.RiderProfileModal })));
const GoogleMapsImportModal = lazy(() => import('./components/GoogleMapsImportModal').then(m => ({ default: m.GoogleMapsImportModal })));
import { CrashAlertModal } from './components/CrashAlertModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirstLaunchNameModal } from './components/FirstLaunchNameModal';
import { PermissionsModal, BackgroundTrackingMode } from './components/PermissionsModal';
import { SoloRideStartModal } from './components/SoloRideStartModal';
import { getRiderProfile } from './utils/riderProfile';
import { readMigratedStorageKey, writeMigratedStorageKey, formatDurationSummary } from './utils/units';
import { crashDetector, CrashEvent } from './utils/crashDetection';
import { useGroupRide } from './hooks/useGroupRide';
import { useGPS } from './hooks/useGPS';
import { parseGPX } from './utils/gpxParser';
import { exportAnalysisToGPX, exportPointsToGPX } from './utils/gpxExporter';
import { triggerHaptic } from './utils/audioChimes';
import { startNativeRadarKeepAlive, stopNativeRadarKeepAlive, addNativeCrashListener, getNativeLastSharedText, clearNativeLastSharedText, addNativeSharedTextListener } from './utils/nativeKeepAlive';
import { InAppBrowserBanner } from './components/InAppBrowserBanner';
import { getGarageRides, saveRideToGarage, updateGarageRide, SavedRide } from './utils/storage';
import { runConvoyWatchdog, triggerConvoyRollCall, resetConvoyWatchdog } from './utils/convoyWatchdog';
import { RideAnalysis, PitStop, TrackPoint, AppTheme, UnitSystem } from './types';
import {
  BarChart3, Home, Gauge, Settings, AlertTriangle, Play, Navigation, UploadCloud, Sparkles,
  Map as MapIcon, Activity, History, Bike as BikeIcon, X
} from 'lucide-react';

export type AppTab = 'home' | 'analysis' | 'cockpit' | 'crew' | 'faq';
export type AnalysisSubTab = 'map' | 'telemetry' | 'timeline' | 'bike';

export default function App() {
  const [currentTab, setCurrentTabState] = useState<AppTab>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab')) return params.get('tab') as AppTab;
        if (params.get('room') || params.get('crew') || params.get('squad')) return 'crew';
        const sessionTab = sessionStorage.getItem('throttlelog_session_tab') || sessionStorage.getItem('sasta_session_tab');
        if (sessionTab && ['home', 'cockpit', 'crew', 'faq'].includes(sessionTab)) {
          return sessionTab as AppTab;
        }
        const profile = getRiderProfile();
        if (profile.defaultStartupScreen === 'cockpit') return 'cockpit';
        if (profile.defaultStartupScreen === 'map') return 'crew';
        return 'home';
      }
    } catch { }
    return 'home';
  });

  const setCurrentTab = useCallback((action: AppTab | ((prev: AppTab) => AppTab), pushHistory: boolean = true) => {
    setCurrentTabState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        sessionStorage.setItem('throttlelog_session_tab', next);
        sessionStorage.setItem('sasta_session_tab', next);
        writeMigratedStorageKey('throttlelog_active_tab', 'sasta_active_tab', next);
      } catch { }

      if (pushHistory && next !== prev && typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', next);
          window.history.pushState({ sastaTab: next }, '', url.toString());
        } catch { }
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

  // Global Unit System locked to Metric (KM/H)
  const unitSystem: UnitSystem = 'metric';

  // Unified Single Source of Truth for GPS Tracking across Cockpit & Crew
  const [gps, controls] = useGPS(unitSystem);

  // Keep isRecordingLive in sync with gps.isRecording
  useEffect(() => {
    setIsRecordingLive(gps.isRecording);
  }, [gps.isRecording]);

  // Global Theme State
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = readMigratedStorageKey('throttlelog_theme', 'sasta_theme');
    return (saved === 'light' || saved === 'dark') ? (saved as AppTheme) : 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      writeMigratedStorageKey('throttlelog_theme', 'sasta_theme', next);
      return next;
    });
  };

  // Keep <html class="dark">, color-scheme, body bg, and browser theme-color synchronized with theme
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isLightTheme = theme === 'light';
    document.documentElement.classList.toggle('dark', !isLightTheme);
    document.documentElement.style.colorScheme = isLightTheme ? 'light' : 'dark';
    const bgHex = isLightTheme ? '#f1f5f9' : '#080c10';
    const fgHex = isLightTheme ? '#0f172a' : '#e2e8f0';
    document.body.style.backgroundColor = bgHex;
    document.body.style.color = fgHex;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', bgHex);
    }
  }, [theme]);

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
  const [isSoloRideModalOpen, setIsSoloRideModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isGoogleMapsModalOpen, setIsGoogleMapsModalOpen] = useState<boolean>(false);
  const [sharedIntentText, setSharedIntentText] = useState<string | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundTrackingMode>(() => {
    try {
      return (localStorage.getItem('throttlelog_background_mode') as BackgroundTrackingMode) || 'keep_running';
    } catch {
      return 'keep_running';
    }
  });

  // Ordered LIFO modal stack so browser / Android Back closes only the topmost active modal
  const modalStackRef = useRef<Array<{ key: string; close: () => void }>>([]);
  const prevOpenStatesRef = useRef<Record<string, boolean>>({});
  const popTriggeredCloseRef = useRef(false);
  const pendingHistoryBacksRef = useRef(0);

  const modalEntries = React.useMemo(() => [
    { key: 'profile', open: isProfileModalOpen, close: () => setIsProfileModalOpen(false) },
    { key: 'garage', open: isGarageOpen, close: () => setIsGarageOpen(false) },
    { key: 'cloud', open: isCloudSyncOpen, close: () => setIsCloudSyncOpen(false) },
    { key: 'download', open: isDownloadModalOpen, close: () => setIsDownloadModalOpen(false) },
    { key: 'permissions', open: isPermissionsModalOpen, close: () => setIsPermissionsModalOpen(false) },
    { key: 'solo', open: isSoloRideModalOpen, close: () => setIsSoloRideModalOpen(false) },
    { key: 'gmaps', open: isGoogleMapsModalOpen, close: () => setIsGoogleMapsModalOpen(false) },
    { key: 'diagnostics', open: isDiagnosticsOpen, close: () => setIsDiagnosticsOpen(false) },
    { key: 'stop', open: isStopEditorOpen, close: () => setIsStopEditorOpen(false) },
    { key: 'ridename', open: isRideNameEditorOpen, close: () => setIsRideNameEditorOpen(false) },
    { key: 'calibration', open: isCalibrationOpen, close: () => setIsCalibrationOpen(false) },
    { key: 'share', open: isShareModalOpen, close: () => setIsShareModalOpen(false) },
    { key: 'report', open: isReportModalOpen, close: () => setIsReportModalOpen(false) },
    { key: 'compare', open: isCompareModalOpen, close: () => setIsCompareModalOpen(false) },
  ], [
    isProfileModalOpen, isGarageOpen, isCloudSyncOpen, isDownloadModalOpen, isPermissionsModalOpen,
    isSoloRideModalOpen, isGoogleMapsModalOpen, isDiagnosticsOpen, isStopEditorOpen,
    isRideNameEditorOpen, isCalibrationOpen, isShareModalOpen, isReportModalOpen, isCompareModalOpen,
  ]);

  const closeTopModal = useCallback(() => {
    const top = modalStackRef.current.pop();
    if (top) {
      top.close();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const closingKeys: string[] = [];
    const openingEntries: Array<{ key: string; close: () => void }> = [];

    modalEntries.forEach((entry) => {
      const wasOpen = Boolean(prevOpenStatesRef.current[entry.key]);
      if (entry.open && !wasOpen) {
        openingEntries.push({ key: entry.key, close: entry.close });
      } else if (!entry.open && wasOpen) {
        closingKeys.push(entry.key);
      }
      prevOpenStatesRef.current[entry.key] = entry.open;
    });

    let poppedMatchingHistory = false;
    closingKeys.forEach((key) => {
      const idx = modalStackRef.current.findIndex(m => m.key === key);
      if (idx >= 0) {
        modalStackRef.current.splice(idx, 1);
        if (typeof window !== 'undefined' && window.history.state?.throttlelogModal === key) {
          poppedMatchingHistory = true;
        }
      }
    });

    if (closingKeys.length > 0 && openingEntries.length > 0 && poppedMatchingHistory) {
      // Handoff transition (e.g. Settings -> Permissions): swap history state in place without async back() race
      openingEntries.forEach((entry, idx) => {
        modalStackRef.current = [...modalStackRef.current.filter(m => m.key !== entry.key), entry];
        if (typeof window !== 'undefined') {
          try {
            if (idx === 0) {
              window.history.replaceState({ throttlelogModal: entry.key }, '');
            } else {
              window.history.pushState({ throttlelogModal: entry.key }, '');
            }
          } catch { }
        }
      });
    } else {
      if (poppedMatchingHistory && !popTriggeredCloseRef.current && openingEntries.length === 0 && typeof window !== 'undefined') {
        try {
          pendingHistoryBacksRef.current += 1;
          window.history.back();
        } catch { }
      }
      openingEntries.forEach((entry) => {
        modalStackRef.current = [...modalStackRef.current.filter(m => m.key !== entry.key), entry];
        if (typeof window !== 'undefined') {
          try {
            window.history.pushState({ throttlelogModal: entry.key }, '');
          } catch { }
        }
      });
    }

    popTriggeredCloseRef.current = false;
  }, [modalEntries]);

  // Global popstate handler for back / forward navigation and LIFO modal dismissal
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (pendingHistoryBacksRef.current > 0) {
        pendingHistoryBacksRef.current -= 1;
        return;
      }

      if (modalStackRef.current.length > 0) {
        popTriggeredCloseRef.current = true;
        closeTopModal();
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const tab = (e.state?.sastaTab || params.get('tab')) as AppTab;
        if (tab && ['home', 'analysis', 'cockpit', 'crew', 'faq'].includes(tab)) {
          setCurrentTab(tab, false);
        }
      } catch { }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeTopModal, setCurrentTab]);
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

    let cancelled = false;
    let cleanupNative: (() => void) | null = null;
    addNativeCrashListener((nativeData) => {
      crashDetector.notifyExternalCrash({
        timestamp: nativeData.timestamp || Date.now(),
        peakG: nativeData.peakG,
        preImpactSpeedKmh: nativeData.preImpactSpeedKmh,
      });
    }).then((unsub) => {
      if (cancelled) {
        if (unsub) unsub();
      } else if (unsub) {
        cleanupNative = unsub;
      }
    });

    return () => {
      cancelled = true;
      crashDetector.stopListening();
      if (cleanupNative) cleanupNative();
    };
  }, []);

  const triggerSosRef = useRef(groupRide.triggerSos);
  triggerSosRef.current = groupRide.triggerSos;

  const handleConfirmCrashSos = useCallback(() => {
    setCrashModalEvent(null);
    triggerSosRef.current();
    setSessionNotice('🚨 Emergency SOS automatically broadcast to squad after impact!');
    setTimeout(() => setSessionNotice(null), 8000);
  }, []);

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
    if (!isConvoyActive) {
      resetConvoyWatchdog(groupRide.isOnRadar ? groupRide.roomCode : 'solo');
      return;
    }

    const sessionKey = groupRide.isOnRadar ? `crew:${groupRide.roomCode}` : 'solo';
    const interval = setInterval(() => {
      runConvoyWatchdog({
        sessionKey,
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
    groupRide.roomCode,
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
      startNativeRadarKeepAlive(gps.mountMode === 'pocket');
    } else {
      stopNativeRadarKeepAlive();
    }
  }, [isRecordingLive, groupRide.isOnRadar, gps.isTrackingActive, gps.mountMode]);

  // Check for shared links or text coming from Android Share Sheet (e.g. Google Maps -> Share -> ThrottleLog)
  useEffect(() => {
    let cancelled = false;
    let cleanupListener: (() => void) | null = null;

    const handleSharedPayload = async (shared: string | null) => {
      if (shared && shared.trim()) {
        await clearNativeLastSharedText();
        if (!cancelled) {
          setSharedIntentText(shared.trim());
          setIsGoogleMapsModalOpen(true);
        }
      }
    };

    const checkSharedText = async () => {
      const shared = await getNativeLastSharedText();
      await handleSharedPayload(shared);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSharedText();
      }
    };

    addNativeSharedTextListener((text) => {
      handleSharedPayload(text);
    }).then((unsub) => {
      if (cancelled) {
        if (unsub) unsub();
      } else if (unsub) {
        cleanupListener = unsub;
      }
    });

    checkSharedText();
    window.addEventListener('focus', checkSharedText);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      if (cleanupListener) cleanupListener();
      window.removeEventListener('focus', checkSharedText);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
          startNativeRadarKeepAlive(gps.mountMode === 'pocket');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundMode, isRecordingLive, gps.isTrackingActive, groupRide.isOnRadar, gps.mountMode]);

  // Unified Privacy & Stop Tracking Handler (zero-battery standby, stops GPS watch, kills native keep-alive & MQTT broadcasts)
  const handleToggleTracking = useCallback((enable?: boolean) => {
    const isCurrentlyActive = (gps.isTrackingActive ?? true) && groupRide.isOnRadar;
    const next = enable !== undefined ? enable : !isCurrentlyActive;
    if (!next) {
      controls.stopGpsTracking();
      groupRide.toggleOnRadar(false);
      stopNativeRadarKeepAlive();
      setMyLocation(null);
      setSessionNotice('Privacy Mode Active: GPS hardware and radar broadcasts stopped.');
      setTimeout(() => setSessionNotice(null), 5000);
      triggerHaptic(30);
    } else {
      controls.startGpsTracking();
      groupRide.toggleOnRadar(true);
      setSessionNotice('Live Tracking Active: GPS location and squad radar resumed.');
      setTimeout(() => setSessionNotice(null), 5000);
      triggerHaptic(30);
    }
  }, [gps.isTrackingActive, groupRide, controls]);

  // Check URL query for room invite link (e.g. ?crew=SUNDAY or ?rider=Rahul for first-time setup)
  // Never overwrite an already-customized rider profile from a query string
  const hasProcessedInviteRef = useRef(false);
  useEffect(() => {
    if (hasProcessedInviteRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room') || params.get('crew') || params.get('squad');
    const riderParam = params.get('rider') || params.get('name') || params.get('who');
    if (riderParam || roomParam) {
      hasProcessedInviteRef.current = true;
      setCurrentTab('crew');
      const hasNamedProfile = Boolean(groupRide.riderName && groupRide.riderName !== 'Rider');
      const inviteSuggestedName = !hasNamedProfile ? riderParam?.trim() : undefined;
      const activeName = inviteSuggestedName || groupRide.riderName;
      if (roomParam?.trim()) {
        groupRide.joinRoom(roomParam.trim(), inviteSuggestedName);
      } else if (inviteSuggestedName) {
        groupRide.updateRiderName(inviteSuggestedName);
      }
      setSessionNotice(`Welcome ${activeName}! Live on Crew Radar${roomParam ? ` in Squad [${roomParam.trim().toUpperCase()}]` : ''}.`);
      setTimeout(() => setSessionNotice(null), 6000);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch { }
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
        closeTopModal();
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
  }, [analysis, closeTopModal, setCurrentTab]);

  const handleLoadSample = async (gpxData?: string, name?: string) => {
    try {
      let dataToParse = gpxData;
      let sampleName = name;
      if (!dataToParse) {
        const sampleMod = await import('./data/sampleRide');
        dataToParse = sampleMod.SAMPLE_GPX_DATA;
        sampleName = sampleName || sampleMod.SAMPLE_GPX_NAME;
      }
      const parsed = parseGPX(dataToParse);
      parsed.name = sampleName || 'Sample Ride';
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
        setSessionNotice(`Loaded "${parsed.name}" from your Garage.`);
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
      const isCrewSession = groupRide.isOnRadar;
      const squadPrefix = isCrewSession
        ? (groupRide.roomCode && groupRide.roomCode !== 'Global Crew' ? `[Crew ${groupRide.roomCode}] ` : '[Crew] ')
        : '';
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
        const durationSeconds = parsed.totalDurationSeconds || 0;
        const avgSpeedKmh = parsed.movingAvgSpeedKmh || parsed.overallAvgSpeedKmh || 0;
        const movingTimeSeconds = parsed.movingTimeSeconds || 0;
        const elevGainM = parsed.elevGainM || 0;
        const rideType = isCrewSession ? 'crew' : 'solo';
        const mountMode = gps.mountMode;

        const saved = saveRideToGarage({
          name: rideName,
          distanceKm: parsed.totalDistanceKm,
          maxSpeedKmh: parsed.maxSpeedKmh,
          durationSeconds,
          avgSpeedKmh,
          movingTimeSeconds,
          elevGainM,
          rideType,
          mountMode,
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
  }, [groupRide.isOnRadar, groupRide.roomCode, setCurrentTab, gps.mountMode]);

  const handleStartRecording = useCallback(() => {
    controls.startNewRecording();
    setIsRecordingLive(true);
    triggerHaptic(50);
    setSessionNotice('Recording track to Garage.');
    setTimeout(() => setSessionNotice(null), 3000);
  }, [controls]);

  const startSoloRideFlow = useCallback((mountMode: 'handlebar' | 'pocket' = 'handlebar', view: 'map' | 'cockpit' = 'cockpit') => {
    // Ensure Solo Rides NEVER publish rider location or show crew peers on the full map, while keeping hardware GPS active
    if (groupRide.isOnRadar) {
      groupRide.toggleOnRadar(false);
    }
    if (!gps.isTrackingActive) {
      controls.startGpsTracking();
    }
    try {
      const isNative = Boolean((window as any)?.Capacitor?.isNativePlatform?.());
      if (isNative && !localStorage.getItem('throttlelog_permissions_setup_completed')) {
        setIsPermissionsModalOpen(true);
      }
    } catch { }
    controls.setMountMode(mountMode);
    startNativeRadarKeepAlive(mountMode === 'pocket');
    handleStartRecording();
    setCurrentTab(view === 'map' ? 'crew' : 'cockpit');
    setSessionNotice(
      mountMode === 'pocket'
        ? 'Pocket Mode Active: Lock phone in pocket. Solo ride private on this phone.'
        : 'Handlebar Mount Active: Screen awake. Solo ride private on this phone.'
    );
    setTimeout(() => setSessionNotice(null), 5000);
  }, [controls, gps.isTrackingActive, groupRide, handleStartRecording, setCurrentTab]);

  const handleStartSoloRideWithOptions = useCallback((options: { mountMode: 'handlebar' | 'pocket'; view: 'map' | 'cockpit' }) => {
    setIsSoloRideModalOpen(false);
    startSoloRideFlow(options.mountMode, options.view);
  }, [startSoloRideFlow]);

  const handleRouteGeneratedFromGoogleMaps = useCallback((route: RideAnalysis, shouldBroadcastToCrew: boolean) => {
    const canBroadcast = shouldBroadcastToCrew && groupRide.isOnRadar;
    // Controls whether the analysis effect automatically shares this route to the squad
    isLocallyInitiatedRouteRef.current = canBroadcast;
    setAnalysis(route);
    setCurrentRideId(null);
    setScrubIndex(null);
    setSessionNotice(
      canBroadcast
        ? `Route to "${route.name}" set & shared with squad (${route.totalDistanceKm} km)`
        : `Route to "${route.name}" loaded (${route.totalDistanceKm} km)`
    );
    setTimeout(() => setSessionNotice(null), 5000);
    setCurrentTab('cockpit');
  }, [groupRide.isOnRadar, setCurrentTab]);

  const handleClearActiveRoute = useCallback(() => {
    isLocallyInitiatedRouteRef.current = false;
    groupRide.broadcastActiveRoute(null);
    setAnalysis(null);
    setCurrentRideId(null);
    setScrubIndex(null);
  }, [groupRide.broadcastActiveRoute]);

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

  const handleSaveActiveToGarage = () => {
    if (!analysis) return;
    try {
      const gpxText = exportAnalysisToGPX(analysis);
      const saved = saveRideToGarage({
        id: currentRideId || undefined,
        name: analysis.name,
        distanceKm: analysis.totalDistanceKm,
        maxSpeedKmh: analysis.maxSpeedKmh,
        durationSeconds: analysis.totalDurationSeconds,
        avgSpeedKmh: analysis.movingAvgSpeedKmh || analysis.overallAvgSpeedKmh,
        movingTimeSeconds: analysis.movingTimeSeconds,
        elevGainM: analysis.elevGainM,
        rideType: groupRide.isOnRadar ? 'crew' : 'solo',
        mountMode: gps.mountMode,
        gpxContent: gpxText,
      });
      setCurrentRideId(saved.id);
      setSessionNotice(`"${saved.name}" saved to your Garage!`);
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
        setSessionNotice('Title updated in your Garage!');
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
        setSessionNotice('Bike specs updated in your Garage!');
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
    <div className={`transition-colors ${currentTab === 'crew'
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

      {/* Navigation - Only shown on secondary views (Cockpit, Analysis, FAQ); Map is clean full-screen */}
      {currentTab !== 'crew' && (
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onHomeClick={() => setCurrentTab('home')}
          onUploadClick={triggerUploadClick}
          groupRideConnected={groupRide.isConnected && groupRide.isOnRadar}
          isRecordingLive={isRecordingLive}
          hasActiveRide={!!analysis}
          theme={theme}
          onOpenSettings={() => setIsProfileModalOpen(true)}
        />
      )}

      {/* In-App Browser Helper Banner (surfaced on non-map views so map top bar stays clear) */}
      {currentTab !== 'crew' && <InAppBrowserBanner />}

      {/* Global Fixed Safe-Area Alert Stack (never hidden under status bar or Navbar) */}
      {(convoyAlert || errorMessage) && (
        <div
          style={{
            top: currentTab === 'crew'
              ? groupRide.activeCallout
                ? 'calc(var(--safe-top, 0px) + 9.75rem)'
                : 'calc(var(--safe-top, 0px) + 4.1rem)'
              : 'calc(var(--safe-top, 0px) + 3.65rem)',
            left: 'max(0.6rem, var(--safe-left, 0px))',
            right: 'max(0.6rem, var(--safe-right, 0px))',
          }}
          className={`fixed z-[65] pointer-events-none flex flex-col items-center gap-2 ${currentTab !== 'crew' ? 'landscape:pl-14' : ''
            }`}
        >
          {convoyAlert && (
            <div
              className={`pointer-events-auto w-full max-w-md rounded-2xl backdrop-blur-xl border-2 shadow-2xl overflow-hidden font-mono transition-all p-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-3 duration-300 ${theme === 'light'
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
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                  }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className={`pointer-events-auto w-full max-w-md p-3 border font-sans text-xs rounded-2xl flex items-center justify-between shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200 ${theme === 'light'
              ? 'bg-rose-50/95 border-rose-300 text-rose-900'
              : 'bg-red-950/95 border-red-500/60 text-red-200'
              }`}>
              <span className="min-w-0">{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="underline font-bold cursor-pointer ml-3 shrink-0">
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Non-blocking Session Toast (bottom safe-area so top Cockpit REC / Analysis headers stay clear) */}
      {sessionNotice && (
        <div
          style={{
            left: 'max(0.75rem, var(--safe-left, 0px))',
            right: 'max(0.75rem, var(--safe-right, 0px))',
          }}
          className={`fixed z-[75] pointer-events-none flex justify-center bottom-[calc(var(--safe-bottom,0px)+4.65rem)] md:bottom-5 landscape:bottom-3 ${currentTab !== 'crew' ? 'landscape:pl-14' : ''
            }`}
        >
          <div className={`pointer-events-auto w-full max-w-md px-3.5 py-2.5 border text-xs font-sans rounded-2xl flex items-center justify-between gap-2 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200 ${theme === 'light'
            ? 'bg-sky-50/95 border-sky-300 text-sky-900'
            : 'bg-[#0d131a]/95 border-sky-500/50 text-sky-200'
            }`}>
            <span className="min-w-0 leading-snug">{sessionNotice}</span>
            <button onClick={() => setSessionNotice(null)} className="underline font-bold cursor-pointer ml-2 shrink-0">
              Got it
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
      <main className={`w-full transition-all ${currentTab === 'crew'
        ? 'h-[100dvh] w-full overflow-hidden flex flex-col p-0 m-0 max-w-none'
        : 'has-landscape-rail max-w-7xl mx-auto px-2 sm:px-6 pt-1 sm:pt-4 pb-20 sm:pb-8 landscape:pt-1 landscape:pb-2 space-y-3 sm:space-y-6'
        }`}>
        {/* Global Interrupted Session Recovery Banner (Surfaced on non-map/non-cockpit views) */}
        {controls.hasRecoverableRide && controls.recoverableData && currentTab !== 'cockpit' && currentTab !== 'crew' && (
          <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg font-sans text-xs animate-in fade-in duration-200 ${theme === 'light' ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
            }`}>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <AlertTriangle className={`w-5 h-5 shrink-0 ${theme === 'light' ? 'text-amber-700' : 'text-amber-400'}`} />
              <div>
                <div className="font-bold text-sm">Interrupted Ride Session Found!</div>
                <div className="text-[11px] opacity-80 telemetry-num">
                  {controls.recoverableData.points?.length || 0} unsaved GPS points ({((controls.recoverableData.totalDistanceMeters || 0) / 1000).toFixed(1)} km) from your previous ride.
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
                className={`px-3 py-1.5 border rounded-xl transition-colors cursor-pointer ${theme === 'light' ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Tab 0: Landing Page — always shown when Home is selected */}
        {currentTab === 'home' && (
          <div className="animate-in fade-in duration-300">
            <LandingView
              onFileLoaded={handleFileLoaded}
              onSelectRide={(gpxData, routeName) => handleLoadSample(gpxData, routeName)}
              onStartRecording={(mountMode) => {
                startSoloRideFlow(mountMode || 'handlebar', 'cockpit');
              }}
              onOpenCrew={() => setCurrentTab('crew')}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onOpenGoogleMaps={() => setIsGoogleMapsModalOpen(true)}
              theme={theme}
              unitSystem={unitSystem}
              activeRideName={analysis ? analysis.name : null}
              activeRideDistanceKm={analysis ? analysis.totalDistanceKm : null}
              onResumeRide={() => setCurrentTab('analysis')}
              onClearRide={handleClearActiveRoute}
              onOpenGarage={() => setIsGarageOpen(true)}
              riderName={groupRide.riderName}
              bikeModel={groupRide.bikeModel}
              myColor={groupRide.myColor}
              isOnRadar={groupRide.isOnRadar}
            />
          </div>
        )}

        {/* Tab 1: My Rides & Telemetry Analysis */}
        {currentTab === 'analysis' && !analysis && (() => {
          const savedRides: SavedRide[] = getGarageRides();
          return (
            <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-300">
              <div className={`p-4 sm:p-5 rounded-3xl border shadow-lg space-y-4 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white'
                }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                      }`}>
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-heading font-black text-base uppercase tracking-wider">My Rides Library</h2>
                      <p className={`text-[11px] font-sans ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                        Tap any recorded ride to open speed curves, corner lean, and GPX map
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGarageOpen(true)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer shrink-0 ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                  >
                    Garage &amp; Backups
                  </button>
                </div>

                {savedRides.length > 0 ? (
                  <div className="space-y-2">
                    {savedRides.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleFileLoaded(r.gpxContent, r.name, r.id)}
                        className={`w-full text-left p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${theme === 'light'
                          ? 'bg-slate-50 hover:bg-sky-50 border-slate-200 hover:border-sky-300 text-slate-900'
                          : 'bg-[#131b24] hover:bg-[#19232f] border-[#1e2a38] hover:border-sky-500/40 text-white'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${theme === 'light' ? 'bg-white border-slate-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            }`}>
                            <Navigation className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">{r.name}</div>
                            <div className={`text-[11px] flex items-center gap-1.5 flex-wrap telemetry-num ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                              }`}>
                              <span>{r.distanceKm.toFixed(1)} km</span>
                              {r.durationSeconds ? (
                                <>
                                  <span>•</span>
                                  <span>{formatDurationSummary(r.durationSeconds)}</span>
                                </>
                              ) : null}
                              <span>•</span>
                              <span className={theme === 'light' ? 'text-rose-700 font-bold' : 'text-rose-400 font-bold'}>
                                Max {Math.round(r.maxSpeedKmh)} km/h
                              </span>
                              <span>•</span>
                              <span>{r.date}</span>
                            </div>
                          </div>
                        </div>
                        <Play className={`w-4 h-4 shrink-0 ${theme === 'light' ? 'text-sky-700' : 'text-sky-400'}`} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className={`p-6 rounded-2xl border border-dashed text-center space-y-2 ${theme === 'light' ? 'bg-slate-50 border-slate-300 text-slate-600' : 'bg-black/30 border-slate-800 text-slate-400'
                    }`}>
                    <p className="font-bold text-xs">No saved rides in your Garage yet</p>
                    <p className="text-[11px]">Record a ride from the Cockpit, import a GPX track, or try the demo route.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={triggerUploadClick}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                      }`}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Import GPX</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample()}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${theme === 'light' ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-500/40 text-cyan-300'
                      }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Explore Demo Ride</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        {currentTab === 'analysis' && analysis && (
          <ErrorBoundary theme={theme} sectionLabel="Ride Telemetry" onResetToHome={() => setCurrentTab('home')}>
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Single Slim Contextual Header Strip */}
              <div className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-sans shadow-xs ${theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0d131a] border-[#1e2a38] text-slate-200'
                }`}>
                <button
                  type="button"
                  onClick={handleCloseTrack}
                  className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                    : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-sky-400'
                    }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>All Saved Rides</span>
                </button>

                <button
                  type="button"
                  onClick={triggerUploadClick}
                  className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer ${theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-[#131b24] hover:bg-[#1a2530] border-[#1e2a38] text-slate-300'
                    }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Import GPX</span>
                </button>
              </div>

              {/* Hero Metrics Bar with Edit Ride Name, Calibration & Share Story */}
              <HeroTelemetry
                analysis={analysis}
                activeScrubPoint={activeScrubPoint}
                onEditRideName={() => setIsRideNameEditorOpen(true)}
                onOpenStops={() => handleOpenAddStop()}
                onOpenShare={() => setIsShareModalOpen(true)}
                onOpenReport={() => setIsReportModalOpen(true)}
                onOpenCompare={() => setIsCompareModalOpen(true)}
                onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
                onSaveToGarage={handleSaveActiveToGarage}
                isSavedInGarage={currentRideId !== null}
                theme={theme}
                unitSystem={unitSystem}
              />

              {/* Sticky Segmented Sub-Tab Switcher */}
              <div className={`sticky top-[calc(var(--safe-top,0px)+3.5rem)] z-30 py-2 -mx-3 px-3 sm:-mx-6 sm:px-6 backdrop-blur-md transition-colors ${theme === 'light' ? 'bg-slate-100/90' : 'bg-[#080c10]/90'
                }`}>
                <div className={`grid grid-cols-4 items-center p-1 rounded-xl border text-[11px] sm:text-xs font-mono font-bold shadow-md gap-1 ${theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#0d131a] border-[#1e2a38] text-[#8f9ca8]'
                  }`}>
                  <button
                    onClick={() => setAnalysisSubTab('map')}
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${analysisSubTab === 'map'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                      }`}
                  >
                    <MapIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Map</span>
                  </button>

                  <button
                    onClick={() => setAnalysisSubTab('telemetry')}
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${analysisSubTab === 'telemetry'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                      }`}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden truncate">Speed</span>
                    <span className="hidden sm:inline truncate">Speed &amp; Lean</span>
                  </button>

                  <button
                    onClick={() => setAnalysisSubTab('timeline')}
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap relative min-w-0 ${analysisSubTab === 'timeline'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                      }`}
                  >
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden truncate">Stops</span>
                    <span className="hidden sm:inline truncate">Timeline</span>
                    {analysis.pitStops.length > 0 && (
                      <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${analysisSubTab === 'timeline'
                        ? 'bg-slate-950 text-sky-400'
                        : theme === 'light'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                        {analysis.pitStops.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setAnalysisSubTab('bike')}
                    className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${analysisSubTab === 'bike'
                      ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                      : theme === 'light' ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-[#15202b] text-slate-300'
                      }`}
                  >
                    <BikeIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Insights</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: Map Route & Scrubber View */}
              {analysisSubTab === 'map' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <Suspense fallback={null}>
                    <MapViewer
                      analysis={analysis}
                      scrubIndex={scrubIndex}
                      onScrubChange={setScrubIndex}
                      onEditStop={(stop) => handleOpenEditStop(stop)}
                      focusedCoordinate={focusedCoordinate}
                      theme={theme}
                      onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
                      groupMembers={groupRide.members}
                    />
                  </Suspense>
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

                  <Suspense fallback={null}>
                    <TelemetryCharts
                      analysis={analysis}
                      scrubIndex={scrubIndex}
                      onScrubChange={setScrubIndex}
                      theme={theme}
                      unitSystem={unitSystem}
                    />
                  </Suspense>
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
                    onDeleteStop={(stopId) => handleDeleteStop(stopId)}
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
                  />
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {/* Tab 2: Live GPS Logger (Kept mounted to maintain uninterrupted background recording & crew location sync when switching tabs) */}
        <div className={currentTab === 'cockpit' ? 'animate-in fade-in duration-300 space-y-3' : 'hidden'}>
          <ErrorBoundary theme={theme} sectionLabel="Ride Cockpit" onResetToHome={() => setCurrentTab('home')}>
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
              groupRiderId={groupRide.riderId}
              groupRiderName={groupRide.riderName}
              sosAlert={groupRide.sosAlert}
              onOpenGroupRideModal={() => setCurrentTab('crew')}
              onTriggerSos={groupRide.triggerSos}
              onCancelSos={groupRide.cancelSos}
              onUpdateMyLocation={handleUpdateMyLocation}
              activeVoiceBlast={groupRide.activeVoiceBlast}
              onDismissVoiceBlast={groupRide.dismissVoiceBlast}
              onSendVoiceBlast={groupRide.sendVoiceBlast}
              onSwitchToMap={() => setCurrentTab('crew')}
              onGoToDashboard={() => setCurrentTab('home')}
              activeRoute={analysis}
              onClearActiveRoute={handleClearActiveRoute}
              onOpenGoogleMapsImport={() => setIsGoogleMapsModalOpen(true)}
              onOpenSettings={() => setIsProfileModalOpen(true)}
            />
          </ErrorBoundary>
        </div>

        {/* Tab 3: Dedicated First-Class Crew Command Center */}
        {currentTab === 'crew' && (
          <div className="w-full h-full flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <ErrorBoundary theme={theme} sectionLabel="Live Map" onResetToHome={() => setCurrentTab('home')}>
              <Suspense fallback={null}>
                <CrewDashboard
                  roomCode={groupRide.roomCode}
                  onJoinRoom={groupRide.joinRoom}
                  riderName={groupRide.riderName}
                  riderId={groupRide.riderId}
                  myColor={groupRide.myColor}
                  bikeModel={groupRide.bikeModel}
                  myLocation={myLocation}
                  isHost={groupRide.isHost}
                  leaderId={groupRide.leaderId}
                  onSetSquadLeader={groupRide.setSquadLeader}
                  onClaimSquadLeader={groupRide.claimSquadLeader}
                  isConnected={groupRide.isConnected}
                  members={groupRide.members}
                  sosAlert={groupRide.sosAlert}
                  crewNotification={groupRide.crewNotification}
                  onDismissCrewNotification={groupRide.dismissCrewNotification}
                  onTriggerSos={groupRide.triggerSos}
                  onCancelSos={groupRide.cancelSos}
                  onDismissSos={groupRide.dismissSos}
                  getFriendInviteUrl={groupRide.getFriendInviteUrl}
                  onGoToCockpit={() => setCurrentTab('cockpit')}
                  theme={theme}
                  isRecording={gps.isRecording}
                  onStartRecording={handleStartRecording}
                  onStopRecording={handleStopAndSaveRecording}
                  totalDistanceMeters={gps.totalDistanceMeters}
                  activeRoute={analysis}
                  onClearActiveRoute={handleClearActiveRoute}
                  isOnRadar={groupRide.isOnRadar}
                  onToggleRadar={groupRide.toggleOnRadar}
                  isTrackingActive={gps.isTrackingActive}
                  onToggleTracking={handleToggleTracking}
                  onSendVoiceBlast={groupRide.sendVoiceBlast}
                  onOpenGarage={() => setIsGarageOpen(true)}
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
                  onRetryGps={() => {
                    controls.stopGpsTracking();
                    setTimeout(() => controls.startGpsTracking(), 150);
                  }}
                  onTriggerRollCall={handleManualRollCall}
                  mountMode={gps.mountMode}
                  onOpenSoloRide={() => setIsSoloRideModalOpen(true)}
                  onGoToDashboard={() => setCurrentTab('home')}
                  onOpenProfile={() => setIsProfileModalOpen(true)}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* Tab 4: Tips & Help Guide */}
        {currentTab === 'faq' && (
          <div className="animate-in fade-in duration-300">
            <Suspense fallback={null}>
              <FaqAndArchitecture theme={theme} />
            </Suspense>
          </div>
        )}
      </main>

      {/* Mobile Landscape Left Thumb Rail (Motorcycle Handlebar Mount Mode) - Only on secondary tabs */}
      {currentTab !== 'crew' && (
        <nav
          aria-label="Mobile Landscape Navigation Dock"
          className={`hidden mobile-landscape-dock fixed left-0 top-0 bottom-0 min-w-[3.5rem] w-auto pr-1 z-50 flex-col items-center justify-around py-2 backdrop-blur-lg border-r shadow-2xl transition-colors ${theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
            }`}
          style={{
            paddingTop: 'max(0.35rem, var(--safe-top, 0px))',
            paddingBottom: 'max(0.35rem, var(--safe-bottom, 0px))',
            paddingLeft: 'max(0.35rem, var(--safe-left, 0px))',
          }}
        >
          {/* Tab 0: Home */}
          <button
            type="button"
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'home'
              ? theme === 'light' ? 'text-cyan-700 bg-cyan-50 font-black' : 'text-cyan-400 bg-cyan-500/15 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'hover:text-white hover:bg-white/5'
              }`}
            title="Home Dashboard"
            aria-label="Home Dashboard"
          >
            <Home className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Home</span>
          </button>

          {/* Tab 1: Map */}
          <button
            type="button"
            onClick={() => setCurrentTab('crew')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'hover:text-white hover:bg-white/5'
              }`}
            title="Live Map"
            aria-label="Open Live Map"
          >
            <MapIcon className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Map</span>
          </button>

          {/* Tab 2: Cockpit */}
          <button
            type="button"
            onClick={() => setCurrentTab('cockpit')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'cockpit'
              ? theme === 'light' ? 'text-emerald-700 bg-emerald-50 font-black' : 'text-emerald-400 bg-emerald-500/15 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'hover:text-white hover:bg-white/5'
              }`}
            title="Ride Cockpit"
            aria-label="Open Ride Cockpit"
          >
            <Gauge className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Ride</span>
          </button>

          {/* Tab 3: Rides / Analysis */}
          <button
            type="button"
            onClick={() => setCurrentTab('analysis')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${currentTab === 'analysis'
              ? theme === 'light' ? 'text-sky-700 bg-sky-50 font-black' : 'text-sky-400 bg-sky-500/15 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'hover:text-white hover:bg-white/5'
              }`}
            title="My Rides"
            aria-label="Open My Rides"
          >
            <BarChart3 className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Rides</span>
          </button>

          {/* Settings Quick Button (since top Navbar hides in compact landscape) */}
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer ${theme === 'light' ? 'text-slate-600 hover:text-cyan-700 hover:bg-slate-100' : 'hover:text-cyan-300 hover:bg-white/5'
              }`}
            title="App Settings"
            aria-label="Open App Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="text-[8px] font-mono uppercase font-bold mt-0.5">Prefs</span>
          </button>
        </nav>
      )}

      {/* Mobile Bottom Navigation Bar - Only on secondary tabs */}
      {currentTab !== 'crew' && (
        <nav
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          className={`md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-1.5 flex items-center justify-around font-mono shadow-2xl transition-colors ${theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
            }`}
          aria-label="Mobile Bottom Navigation"
        >
          {/* Tab 0: Home */}
          <button
            id="mobile-tab-home"
            type="button"
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${currentTab === 'home'
              ? theme === 'light' ? 'text-cyan-700 font-black' : 'text-cyan-400 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-cyan-700' : 'text-[#8f9ca8] hover:text-cyan-400'
              }`}
          >
            <div className="relative">
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold">Home</span>
          </button>

          {/* Tab 1: Live Map */}
          <button
            id="mobile-tab-crew"
            type="button"
            onClick={() => setCurrentTab('crew')}
            className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${theme === 'light' ? 'text-slate-600 hover:text-cyan-700' : 'text-[#8f9ca8] hover:text-cyan-400'
              }`}
          >
            <div className="relative">
              <MapIcon className="w-5 h-5" />
              {groupRide.isConnected && groupRide.isOnRadar && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 absolute -top-0.5 -right-1" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold">Map</span>
          </button>

          {/* Tab 2: Ride Cockpit */}
          <button
            id="mobile-tab-cockpit"
            type="button"
            onClick={() => setCurrentTab('cockpit')}
            className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${currentTab === 'cockpit'
              ? theme === 'light' ? 'text-emerald-700 font-black' : 'text-emerald-400 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-emerald-700' : 'text-[#8f9ca8] hover:text-emerald-400'
              }`}
          >
            <div className="relative">
              <Gauge className="w-5 h-5" />
              {isRecordingLive && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30 absolute -top-0.5 -right-1" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold">Ride</span>
          </button>

          {/* Tab 3: My Rides & Stats */}
          <button
            id="mobile-tab-rides"
            type="button"
            onClick={() => setCurrentTab('analysis')}
            className={`flex flex-col items-center gap-0.5 relative cursor-pointer transition-all flex-1 py-1 ${currentTab === 'analysis'
              ? theme === 'light' ? 'text-sky-700 font-black' : 'text-sky-400 font-black'
              : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
              }`}
          >
            <div className="relative">
              <BarChart3 className="w-5 h-5" />
              {analysis && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-1" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold">
              {analysis ? 'Stats' : 'My Rides'}
            </span>
          </button>
        </nav>
      )}

      {/* Saved Rides Garage Modal */}
      {isGarageOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Dual Track Comparison / Ghost Track Modal */}
      {isCompareModalOpen && (
        <Suspense fallback={null}>
          <TrackComparisonModal
            isOpen={isCompareModalOpen}
            onClose={() => setIsCompareModalOpen(false)}
            currentAnalysis={analysis}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Personal Cloud Backup & Sync Modal */}
      {isCloudSyncOpen && (
        <Suspense fallback={null}>
          <CloudSyncModal
            isOpen={isCloudSyncOpen}
            onClose={() => setIsCloudSyncOpen(false)}
            theme={theme}
          />
        </Suspense>
      )}

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
      {analysis && isShareModalOpen && (
        <Suspense fallback={null}>
          <RideStoryModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            analysis={analysis}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Official Ride Telemetry Report & PDF Dossier Modal */}
      {analysis && isReportModalOpen && (
        <Suspense fallback={null}>
          <RideReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            analysis={analysis}
            theme={theme}
          />
        </Suspense>
      )}

      {/* Full Telemetry & Diagnostics Modal */}
      {analysis && isDiagnosticsOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
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
        theme={theme}
      />

      {/* Global First-Launch Profile Setup Modal (Mounted once at root) */}
      <FirstLaunchNameModal
        currentName={groupRide.riderName}
        currentBike={groupRide.bikeModel}
        currentColor={groupRide.myColor}
        onSaveProfile={(name, bike, color) => groupRide.updateRiderName(name, bike, color)}
        theme={theme}
      />

      {/* Permissions Onboarding & Background Tracking Preference Modal */}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        theme={theme}
        onApplyBackgroundMode={(mode) => setBackgroundMode(mode)}
      />

      {/* Solo Ride Pre-Ride Mount Mode Modal */}
      <SoloRideStartModal
        isOpen={isSoloRideModalOpen}
        onClose={() => setIsSoloRideModalOpen(false)}
        onStartSoloRide={handleStartSoloRideWithOptions}
        currentMountMode={gps.mountMode}
        theme={theme}
      />

      {/* Global App Settings Hub (Profile, Display Theme/HUD, Privacy & Safety, Maps/Backup, APK/Help) */}
      {isProfileModalOpen && (
        <Suspense fallback={null}>
          <RiderProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            riderName={groupRide.riderName}
            bikeModel={groupRide.bikeModel}
            myColor={groupRide.myColor}
            isOnRadar={groupRide.isOnRadar}
            onToggleRadar={() => {
              const turningOn = !groupRide.isOnRadar;
              if (turningOn && !gps.isTrackingActive) {
                controls.startGpsTracking();
              }
              groupRide.toggleOnRadar(turningOn);
            }}
            roomCode={groupRide.roomCode}
            onJoinRoom={(code) => groupRide.joinRoom(code)}
            myLocation={myLocation || (gps.currentCoords ? { lat: gps.currentCoords.lat, lon: gps.currentCoords.lon } : null)}
            activeRoute={analysis}
            gpsMountOrientation={gps.mountOrientation}
            onSetMountOrientation={(orient) => controls.setMountOrientation(orient)}
            backgroundMode={backgroundMode}
            onSetBackgroundMode={(mode) => setBackgroundMode(mode)}
            isVoiceBlastMuted={groupRide.isVoiceBlastMuted}
            onToggleVoiceBlastMuted={() => groupRide.toggleVoiceBlastMuted()}
            onSaveProfile={(name, bike, color) => groupRide.updateRiderName(name, bike, color)}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenGarage={() => setIsGarageOpen(true)}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
            onOpenPermissions={() => setIsPermissionsModalOpen(true)}
            onOpenDownloadApp={handleOpenDownloadApp}
            onOpenFaq={() => setCurrentTab('faq')}
            onStartupScreenChanged={(screen) => {
              const label = screen === 'dashboard' ? 'Home' : screen === 'cockpit' ? 'Ride Cockpit' : 'Live Map';
              setSessionNotice(`Default startup screen saved as ${label} (applies on next launch).`);
              setTimeout(() => setSessionNotice(null), 3500);
            }}
          />
        </Suspense>
      )}

      {/* Google Maps Route & Destination Import Modal */}
      {isGoogleMapsModalOpen && (
        <Suspense fallback={null}>
          <GoogleMapsImportModal
            isOpen={isGoogleMapsModalOpen}
            onClose={() => {
              setIsGoogleMapsModalOpen(false);
              setSharedIntentText(null);
            }}
            myLocation={myLocation || (gps.currentCoords ? { lat: gps.currentCoords.lat, lon: gps.currentCoords.lon } : null)}
            onRouteGenerated={handleRouteGeneratedFromGoogleMaps}
            theme={theme}
            unitSystem={unitSystem}
            isCrewConnected={groupRide.isConnected && groupRide.isOnRadar}
            initialSharedText={sharedIntentText}
          />
        </Suspense>
      )}
    </div>
  );
}

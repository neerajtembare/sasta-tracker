/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { parseGPX } from './utils/gpxParser';
import { exportAnalysisToGPX, downloadFile } from './utils/gpxExporter';
import { 
  SAMPLE_GPX_DATA, 
  SAMPLE_GPX_NAME,
  SATURDAY_MORNING_GPX,
  SATURDAY_MORNING_NAME,
  MULSHI_RETURN_GPX,
  MULSHI_RETURN_NAME,
  HIGH_RES_TWISTIES_GPX,
  HIGH_RES_TWISTIES_NAME
} from './data/sampleRide';
import { RideAnalysis, PitStop, TrackPoint, AppTheme } from './types';
import { 
  Radio, Gauge, HelpCircle, FolderArchive, Home,
  Map as MapIcon, Activity, History, Bike as BikeIcon 
} from 'lucide-react';
import { RideDiagnosticsModal } from './components/RideDiagnosticsModal';

export type AppTab = 'home' | 'analysis' | 'cockpit' | 'faq';
export type AnalysisSubTab = 'map' | 'telemetry' | 'timeline' | 'bike';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  // Don't preload demo ride — let landing page be the entry point
  const [analysis, setAnalysis] = useState<RideAnalysis | null>(null);
  // Session-only toast: shown briefly when a ride is loaded
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isRecordingLive, setIsRecordingLive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

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
  const [analysisSubTab, setAnalysisSubTab] = useState<AnalysisSubTab>('map');
  const [focusedCoordinate, setFocusedCoordinate] = useState<{ lat: number; lon: number; label?: string } | null>(null);

  const globalFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileLoaded = (xmlText: string, fileName: string) => {
    try {
      const parsed = parseGPX(xmlText);
      parsed.name = fileName || 'Uploaded Ride Track';
      setAnalysis(parsed);
      setScrubIndex(null);
      setCurrentTab('analysis');
      setErrorMessage(null);
      // Show session-only data notice
      setSessionNotice('Ride loaded in session only. Refresh to clear, or use My Rides → Save to keep it.');
      setTimeout(() => setSessionNotice(null), 5000);
    } catch (err: any) {
      setErrorMessage('Failed to parse GPX: ' + err.message);
    }
  };

  const handleLiveRideRecorded = (gpxText: string) => {
    try {
      const parsed = parseGPX(gpxText);
      parsed.name = `Live Ride (${new Date().toLocaleTimeString()})`;
      setAnalysis(parsed);
      setCurrentTab('analysis');
    } catch (err: any) {
      setErrorMessage('Error analyzing recorded ride: ' + err.message);
    }
  };

  const triggerUploadClick = () => {
    globalFileInputRef.current?.click();
  };

  const handleExportGpx = () => {
    if (!analysis) return;
    const gpxText = exportAnalysisToGPX(analysis);
    const safeName = (analysis.name || 'ride').replace(/\s+/g, '_');
    downloadFile(gpxText, `${safeName}.gpx`);
  };

  const handleCloseTrack = () => {
    setAnalysis(null);
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
    setAnalysis({
      ...analysis,
      pitStops: updatedStops,
      stoppedTimeSeconds: Math.max(analysis.stoppedTimeSeconds, totalStoppedSec),
    });
  };

  const handleDeleteStop = (stopId: string) => {
    if (!analysis) return;
    const updatedStops = analysis.pitStops.filter(s => s.id !== stopId);
    setAnalysis({
      ...analysis,
      pitStops: updatedStops,
      // Don't recalculate stoppedTimeSeconds — it's derived from GPS data (total - moving),
      // not from pit stop annotations. Deleting a user tag doesn't change actual stopped time.
    });
  };

  const handleSaveRideName = (newName: string) => {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      name: newName,
    });
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
    setAnalysis({
      ...analysis,
      ...calib,
    });
  };

  const activeScrubPoint = 
    analysis && scrubIndex !== null && analysis.points[scrubIndex]
      ? {
          speedKmh: analysis.points[scrubIndex].speedKmh,
          elev: analysis.points[scrubIndex].ele,
          bearing: analysis.points[scrubIndex].bearing,
          distKm: analysis.points[scrubIndex].distanceFromStartKm,
          lean: analysis.points[scrubIndex].estimatedLeanAngle || 0,
        }
      : null;

  return (
    <div className={`min-h-screen transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#080c10] text-[#e2e8f0]'} pb-16`}>
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
        onExportGpx={handleExportGpx}
        isRecordingLive={isRecordingLive}
        hasActiveRide={!!analysis}
        rideName={
          currentTab === 'home'
            ? analysis
              ? `Active: ${analysis.name}`
              : 'Ready for GPX or Live Track'
            : analysis
            ? analysis.name
            : 'No track loaded'
        }
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">
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
              onStartRecording={() => setCurrentTab('cockpit')}
              theme={theme}
              activeRideName={analysis ? analysis.name : null}
              activeRideDistanceKm={analysis ? analysis.totalDistanceKm : null}
              onResumeRide={() => setCurrentTab('analysis')}
              onClearRide={handleCloseTrack}
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
              onStartRecording={() => setCurrentTab('cockpit')}
              theme={theme}
              activeRideName={null}
              activeRideDistanceKm={null}
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
              onCloseTrack={handleCloseTrack}
              onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
              theme={theme}
            />

            {/* Quick Route Switcher & Live Mode Trigger */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs font-mono shadow-sm ${
              theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0d131a] border-[#1e2a38]'
            }`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${theme === 'light' ? 'text-slate-500' : 'text-[#8f9ca8]'}`}>
                  Routes:
                </span>
                {[
                  { name: 'Mulshi Ghat', data: SAMPLE_GPX_DATA, title: SAMPLE_GPX_NAME },
                  { name: 'Saturday Morning', data: SATURDAY_MORNING_GPX, title: SATURDAY_MORNING_NAME },
                  { name: 'Mulshi Return', data: MULSHI_RETURN_GPX, title: MULSHI_RETURN_NAME },
                  { name: 'Twisties Apex', data: HIGH_RES_TWISTIES_GPX, title: HIGH_RES_TWISTIES_NAME },
                ].map(r => (
                  <button
                    key={r.name}
                    onClick={() => handleLoadSample(r.data, r.title)}
                    className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-[11px] font-bold ${
                      analysis.name === r.title
                        ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs'
                        : theme === 'light'
                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-sky-600'
                        : 'bg-[#131b24] border-[#1e2a38] text-slate-300 hover:bg-[#1a2533] hover:text-sky-400'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>

              {/* Live Record action — subtle pulse instead of aggressive ping */}
              <button
                onClick={() => setCurrentTab('cockpit')}
                className="px-3 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ml-auto"
                title="Open live handlebar GPS dashboard"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <Radio className="w-3 h-3 text-red-400" />
                <span>Record Live Ride</span>
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
                  <span>Map & Scrub</span>
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
                  <span>Telemetry & Lean</span>
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
        )}

        {/* Tab 2: Live GPS Logger */}
        {currentTab === 'cockpit' && (
          <div className="animate-in fade-in duration-300">
            <LiveCockpitLogger
              onRideRecorded={handleLiveRideRecorded}
              isRecording={isRecordingLive}
              setIsRecording={setIsRecordingLive}
              theme={theme}
            />
          </div>
        )}

        {/* Tab 3: Tips & Help Guide */}
        {currentTab === 'faq' && (
          <div className="animate-in fade-in duration-300">
            <FaqAndArchitecture theme={theme} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Optimized for one-hand thumb reach) */}
      <nav 
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-2 flex items-center justify-around text-[10px] font-mono shadow-lg ${
          theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
        }`}
        aria-label="Mobile Bottom Navigation"
      >
        <button
          id="mobile-tab-home"
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'home'
              ? theme === 'light' ? 'text-sky-600 font-bold' : 'text-sky-400 font-bold'
              : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          id="mobile-tab-analysis"
          onClick={() => {
            if (!analysis) {
              setCurrentTab('home');
              setSessionNotice('Upload a GPX file or choose a demo ride to view stats.');
              setTimeout(() => setSessionNotice(null), 4000);
            } else {
              setCurrentTab('analysis');
            }
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors relative ${
            currentTab === 'analysis'
              ? theme === 'light' ? 'text-sky-600 font-bold' : 'text-sky-400 font-bold'
              : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Ride Stats</span>
          {analysis && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-0 right-2" />
          )}
        </button>

        <button
          id="mobile-tab-cockpit"
          onClick={() => setCurrentTab('cockpit')}
          className={`flex flex-col items-center gap-1 relative cursor-pointer transition-colors ${
            currentTab === 'cockpit'
              ? theme === 'light' ? 'text-emerald-600 font-bold' : 'text-emerald-400 font-bold'
              : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Record</span>
          {isRecordingLive && (
            <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-1 right-2 animate-ping" />
          )}
        </button>

        <button
          id="mobile-tab-garage"
          onClick={() => setIsGarageOpen(true)}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            theme === 'light' ? 'text-slate-600 hover:text-sky-600' : 'text-[#8f9ca8] hover:text-sky-400'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>My Rides</span>
        </button>

        <button
          id="mobile-tab-faq"
          onClick={() => setCurrentTab('faq')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'faq'
              ? theme === 'light' ? 'text-slate-950 font-bold' : 'text-white font-bold'
              : theme === 'light' ? 'text-slate-500 hover:text-slate-900' : 'text-[#8f9ca8] hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </button>
      </nav>

      {/* Saved Rides Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        currentAnalysis={analysis}
        onSelectRide={(gpxText, name) => {
          handleFileLoaded(gpxText, name);
        }}
        onLoadSample={handleLoadSample}
        onCloseTrack={handleCloseTrack}
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

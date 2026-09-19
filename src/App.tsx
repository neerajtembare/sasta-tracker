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
import { UploadZone } from './components/UploadZone';
import { GarageModal } from './components/GarageModal';
import { StopEditorModal } from './components/StopEditorModal';
import { RideDetailsEditorModal } from './components/RideDetailsEditorModal';
import { RideCalibrationModal } from './components/RideCalibrationModal';
import { LandingView } from './components/LandingView';
import { parseGPX } from './utils/gpxParser';
import { exportAnalysisToGPX, downloadFile } from './utils/gpxExporter';
import { SAMPLE_GPX_DATA, SAMPLE_GPX_NAME } from './data/sampleRide';
import { RideAnalysis, PitStop, TrackPoint, AppTheme } from './types';
import { Radio, Gauge, HelpCircle, FolderArchive, Home } from 'lucide-react';

export type AppTab = 'home' | 'analysis' | 'cockpit' | 'faq';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [analysis, setAnalysis] = useState<RideAnalysis | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isRecordingLive, setIsRecordingLive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);

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
  const [focusedCoordinate, setFocusedCoordinate] = useState<{ lat: number; lon: number; label?: string } | null>(null);

  const uploadZoneRef = useRef<HTMLDivElement>(null);

  const handleLoadSample = (gpxData?: string, name?: string) => {
    try {
      const dataToParse = gpxData || SAMPLE_GPX_DATA;
      const parsed = parseGPX(dataToParse);
      parsed.name = name || SAMPLE_GPX_NAME;
      setAnalysis(parsed);
      setScrubIndex(null);
      setCurrentTab('analysis');
      setErrorMessage(null);
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
    uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.click();
  };

  const handleExportGpx = () => {
    if (!analysis) return;
    const gpxText = exportAnalysisToGPX(analysis);
    const safeName = (analysis.name || 'ride').replace(/\s+/g, '_');
    downloadFile(gpxText, `${safeName}.gpx`);
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
        rideName={analysis ? analysis.name : 'No track loaded'}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Error message alert */}
        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-300 font-sans text-xs rounded-lg flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="underline font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab 0: Landing Page (Default & Mobile Onboarding) */}
        {(currentTab === 'home' || (currentTab === 'analysis' && !analysis)) && (
          <div className="animate-in fade-in duration-300">
            <LandingView
              onFileLoaded={handleFileLoaded}
              onSelectRide={(gpxData, routeName) => handleLoadSample(gpxData, routeName)}
              onStartRecording={() => setCurrentTab('cockpit')}
              theme={theme}
            />
          </div>
        )}

        {/* Tab 1: Ride Stats & Telemetry Analysis */}
        {currentTab === 'analysis' && analysis && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
            {/* Hero Metrics Bar with Edit Ride Name & Calibration */}
            <HeroTelemetry
              analysis={analysis}
              activeScrubPoint={activeScrubPoint}
              onEditRideName={() => setIsRideNameEditorOpen(true)}
              onOpenStops={() => handleOpenAddStop()}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              theme={theme}
            />

            {/* Key Ride Insights (Lean Angle, Max Velocity Burst, Fuel Efficiency) */}
            <RideInsightsCard
              analysis={analysis}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              theme={theme}
            />

            {/* Speed Zone Dwell Histogram (Velocity Distribution) */}
            <SpeedZoneHistogram 
              analysis={analysis}
              theme={theme} 
            />

            {/* Map Viewer & Speed Heatmap with Stop Locating */}
            <MapViewer
              analysis={analysis}
              scrubIndex={scrubIndex}
              onScrubChange={setScrubIndex}
              onOpenAddStopAtPoint={(pt) => handleOpenAddStop(pt)}
              onEditStop={(stop) => handleOpenEditStop(stop)}
              focusedCoordinate={focusedCoordinate}
              theme={theme}
            />

            {/* Synchronized Telemetry Charts */}
            <TelemetryCharts
              analysis={analysis}
              scrubIndex={scrubIndex}
              onScrubChange={setScrubIndex}
              theme={theme}
            />

            {/* Speed Traps, Stops & Ride Sections with Centering Callback */}
            <SpeedTrapsAndSectors
              analysis={analysis}
              onSelectCoordinate={(lat, lon, label) => {
                setFocusedCoordinate({ lat, lon, label });
              }}
              onOpenAddStop={() => handleOpenAddStop()}
              onEditStop={(stop) => handleOpenEditStop(stop)}
              onDeleteStop={(stopId) => handleDeleteStop(stopId)}
              theme={theme}
            />

            {/* Upload Zone for analyzing another file */}
            <div ref={uploadZoneRef} className="pt-2">
              <UploadZone
                onFileLoaded={handleFileLoaded}
                onLoadSample={handleLoadSample}
                currentRideName={analysis.name}
                theme={theme}
              />
            </div>
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
      <div 
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t px-2 py-2 flex items-center justify-around text-[10px] font-mono ${
          theme === 'light' ? 'bg-white/95 border-slate-200 text-slate-600' : 'bg-[#0d131a]/95 border-[#1e2a38] text-[#8f9ca8]'
        }`}
      >
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'home' ? 'text-sky-500 font-bold' : theme === 'light' ? 'text-slate-500' : 'text-[#8f9ca8]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </button>

        <button
          onClick={() => {
            if (!analysis) {
              handleLoadSample();
            } else {
              setCurrentTab('analysis');
            }
          }}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'analysis' ? 'text-sky-500 font-bold' : theme === 'light' ? 'text-slate-500' : 'text-[#8f9ca8]'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Ride Stats</span>
        </button>

        <button
          onClick={() => setCurrentTab('cockpit')}
          className={`flex flex-col items-center gap-1 relative cursor-pointer transition-colors ${
            currentTab === 'cockpit' ? 'text-cyan-500 font-bold' : theme === 'light' ? 'text-slate-500' : 'text-[#8f9ca8]'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Record</span>
          {isRecordingLive && (
            <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-1 right-2 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setIsGarageOpen(true)}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>My Rides</span>
        </button>

        <button
          onClick={() => setCurrentTab('faq')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
            currentTab === 'faq' ? (theme === 'light' ? 'text-slate-900 font-bold' : 'text-white font-bold') : theme === 'light' ? 'text-slate-500' : 'text-[#8f9ca8]'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </button>
      </div>

      {/* Saved Rides Garage Modal */}
      <GarageModal
        isOpen={isGarageOpen}
        onClose={() => setIsGarageOpen(false)}
        currentAnalysis={analysis}
        onSelectRide={(gpxText, name) => {
          handleFileLoaded(gpxText, name);
        }}
        onLoadSample={handleLoadSample}
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
    </div>
  );
}

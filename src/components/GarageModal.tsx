import React, { useState, useEffect } from 'react';
import { 
  SavedRide, 
  getGarageRides, 
  deleteGarageRide, 
  saveRideToGarage, 
  clearAllGarageRides,
  isGarageLocked,
  verifyGaragePin,
  setGaragePin,
  hasGaragePin
} from '../utils/storage';
import { RideAnalysis, AppTheme } from '../types';
import { formatDurationSummary } from '../utils/units';
import { exportAnalysisToGPX, downloadFile } from '../utils/gpxExporter';
import { 
  FolderArchive, 
  X, 
  Play, 
  Trash2, 
  Download, 
  Save, 
  Check, 
  Navigation,
  Zap,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  Search,
  ShieldCheck,
  Cloud
} from 'lucide-react';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalysis?: RideAnalysis | null;
  onSelectRide: (gpxContent: string, name: string, id?: string) => void;
  onLoadSample: () => void;
  onCloseTrack?: () => void;
  onOpenCompare?: () => void;
  onOpenCloudSync?: () => void;
  theme?: AppTheme;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  currentAnalysis,
  onSelectRide,
  onLoadSample,
  onCloseTrack,
  onOpenCompare,
  onOpenCloudSync,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [rides, setRides] = useState<SavedRide[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search and PIN Security
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfiguringPin, setIsConfiguringPin] = useState(false);
  const [newPinValue, setNewPinValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRides(getGarageRides());
      setIsLocked(isGarageLocked());
      setPinInput('');
      setPinError(false);
      setSearchQuery('');
      setIsConfiguringPin(false);
      setConfirmDeleteId(null);
      setIsConfirmClearOpen(false);
      setSavedSuccess(false);
      setBackupFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyGaragePin(pinInput)) {
      setIsLocked(false);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setGaragePin(newPinValue.trim() || null);
    setIsConfiguringPin(false);
    setNewPinValue('');
    setBackupFeedback({ 
      type: 'success', 
      message: newPinValue.trim() ? 'Garage PIN lock enabled!' : 'Garage PIN lock removed.' 
    });
    setTimeout(() => setBackupFeedback(null), 3000);
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const activeRideBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#1e2a38]';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-slate-900' : 'bg-[#131b24] border-[#1e2a38] hover:border-sky-500/50 hover:bg-[#1a2533] text-white';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const footerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';

  // If garage is locked, show quick numeric PIN screen
  if (isLocked) {
    return (
      <div 
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
      >
        <div 
          onClick={e => e.stopPropagation()}
          className={`border rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center space-y-4 cursor-default ${modalBg}`}
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-black text-base uppercase tracking-wider">
              Garage PIN Protected
            </h3>
            <p className={`text-xs font-mono mt-1 ${subTextColor}`}>
              Enter your PIN to access and manage saved rides
            </p>
          </div>
          <form onSubmit={handleUnlock} className="w-full space-y-3">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoFocus
              placeholder="••••"
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              className={`w-full text-center tracking-widest text-xl font-mono font-black py-2.5 px-3 rounded-xl border focus:outline-none focus:border-amber-400 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            />
            {pinError && (
              <div className="text-xs font-mono text-rose-400 font-bold">
                Incorrect PIN. Please try again.
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 py-2 rounded-xl border text-xs font-mono font-bold cursor-pointer ${
                  isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono cursor-pointer"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const handleSaveCurrent = () => {
    if (!currentAnalysis) return;
    const gpxText = exportAnalysisToGPX(currentAnalysis);
    try {
      saveRideToGarage({
        name: currentAnalysis.name,
        distanceKm: currentAnalysis.totalDistanceKm,
        maxSpeedKmh: currentAnalysis.maxSpeedKmh,
        durationSeconds: currentAnalysis.totalDurationSeconds,
        avgSpeedKmh: currentAnalysis.movingAvgSpeedKmh || currentAnalysis.overallAvgSpeedKmh,
        movingTimeSeconds: currentAnalysis.movingTimeSeconds,
        elevGainM: currentAnalysis.elevGainM,
        gpxContent: gpxText,
      });
      setRides(getGarageRides());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e: any) {
      setBackupFeedback({ type: 'error', message: e?.message || 'Failed to save ride to storage.' });
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    const updated = deleteGarageRide(id);
    setRides(updated);
    setConfirmDeleteId(null);
  };

  const handleDownload = (ride: SavedRide, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(ride.gpxContent, `${ride.name.replace(/\s+/g, '_')}.gpx`);
  };

  const displayedRides = rides.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.date.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn cursor-pointer"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-2xl max-h-[90dvh] overscroll-contain flex flex-col shadow-2xl overflow-hidden cursor-default ${modalBg}`}
      >
        {/* Header */}
        <div className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between ${headerBg}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider">
                Rider's Garage & Saved Rides
              </h3>
              <p className={`text-[11px] font-mono ${subTextColor}`}>
                Offline storage in your browser — zero server uploads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsConfiguringPin(prev => !prev)}
              title={hasGaragePin() ? 'Garage PIN protection active (click to change or remove)' : 'Set Garage PIN protection'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                hasGaragePin()
                  ? 'text-amber-400 hover:bg-amber-500/20'
                  : isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'
              }`}
            >
              {hasGaragePin() ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PIN Configuration Bar */}
        {isConfiguringPin && (
          <form onSubmit={handleSavePin} className="p-3 border-b flex items-center justify-between gap-2 font-mono text-xs bg-amber-500/10 border-amber-500/30">
            <div className="flex items-center gap-2 flex-1">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder={hasGaragePin() ? "Enter new PIN (or blank to disable PIN)" : "Enter 4-digit numeric PIN"}
                value={newPinValue}
                onChange={e => setNewPinValue(e.target.value)}
                className={`w-full py-1 px-2.5 rounded-lg border text-xs font-mono ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setIsConfiguringPin(false)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${
                  isLight ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer"
              >
                Save PIN
              </button>
            </div>
          </form>
        )}        {/* Action bar for active loaded ride */}
        {currentAnalysis && (
          <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${activeRideBg}`}>
            <div>
              <div className={`text-[10px] font-mono uppercase tracking-wider font-bold ${subTextColor}`}>
                ACTIVE TRACK IN ANALYZER:
              </div>
              <div className="text-sm font-bold font-mono truncate max-w-xs sm:max-w-md">
                {currentAnalysis.name}
              </div>
              <div className={`text-[11px] font-mono flex items-center gap-2 mt-0.5 ${subTextColor}`}>
                <span>{currentAnalysis.totalDistanceKm.toFixed(1)} km</span>
                <span>•</span>
                <span className="text-rose-500 font-bold">Max {currentAnalysis.maxSpeedKmh.toFixed(0)} km/h</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveCurrent}
                className={`px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                  savedSuccess
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black'
                    : isLight
                    ? 'bg-white hover:bg-slate-100 border-slate-300 text-emerald-700'
                    : 'bg-[#0d131a] hover:bg-[#1c2633] border-emerald-500/40 text-emerald-400'
                }`}
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to Garage</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  const gpx = exportAnalysisToGPX(currentAnalysis);
                  downloadFile(gpx, `${currentAnalysis.name.replace(/\s+/g, '_')}.gpx`);
                }}
                title="Download GPX file"
                className={`px-3 py-1.5 border rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-sky-700' : 'bg-[#0d131a] hover:bg-[#1c2633] border-sky-500/40 text-sky-400'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>

              {onCloseTrack && (
                <button
                  onClick={() => {
                    onCloseTrack();
                    onClose();
                  }}
                  title="Unload this track from the analyzer"
                  className={`px-3 py-1.5 border rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isLight ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700' : 'bg-rose-950/30 hover:bg-rose-900/40 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Unload</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Saved Rides Header & Management Controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-700/20">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-sans uppercase tracking-wider font-bold ${subTextColor}`}>
                Saved Rides ({rides.length})
              </span>
              {rides.length > 0 && (
                <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded border font-bold ${
                  isLight ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                }`}>
                  Newest First
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {onOpenCompare && rides.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCompare();
                  }}
                  title="Side-by-side Ghost Track Comparison of 2 rides"
                  className={`px-2 py-1 text-[10px] font-sans font-bold border rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    isLight ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-amber-500/35'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>Compare Runs</span>
                </button>
              )}

              {onOpenCloudSync && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenCloudSync();
                  }}
                  title="Backup JSON Vaults & GitHub Gist Sync"
                  className={`px-2 py-1 text-[10px] font-sans font-bold border rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    isLight ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-300' : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border-sky-500/35'
                  }`}
                >
                  <Cloud className="w-3 h-3" />
                  <span>Backups &amp; Sync</span>
                </button>
              )}

              {rides.length > 0 && !isConfirmClearOpen && (
                <button
                  type="button"
                  onClick={() => setIsConfirmClearOpen(true)}
                  className={`text-[10px] font-sans underline cursor-pointer ml-1 ${isLight ? 'text-rose-600 hover:text-rose-800' : 'text-rose-400 hover:text-rose-300'}`}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {isConfirmClearOpen && (
            <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono ${
              isLight ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
            }`}>
              <span>Delete all saved rides from this device? This cannot be undone.</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearOpen(false)}
                  className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAllGarageRides();
                    setRides([]);
                    setIsConfirmClearOpen(false);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                >
                  Confirm Clear All
                </button>
              </div>
            </div>
          )}

          {/* Search bar for quick filtering */}
          {rides.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search saved rides by title or date..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-xl border focus:outline-none focus:border-sky-500 transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400' : 'bg-[#0b0f14] border-[#1e2a38] text-white placeholder:text-slate-500'
                }`}
              />
            </div>
          )}

          {backupFeedback && (
            <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200 ${
              backupFeedback.type === 'success'
                ? isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : isLight ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {backupFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{backupFeedback.message}</span>
            </div>
          )}

          {/* Rides List */}
          {displayedRides.length > 0 ? (
            <div className="space-y-2">
              {displayedRides.map((r, idx) => (
                <div
                  key={r.id}
                  className={`p-3 border rounded-xl flex items-center justify-between gap-2 transition-all shadow-sm ${itemBg}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectRide(r.gpxContent, r.name, r.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                  >
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                    }`}>
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-sans font-bold flex items-center gap-2 truncate">
                        <span className="truncate">{r.name}</span>
                        {idx === 0 && !searchQuery && (
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ${
                            isLight ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                          }`}>
                            LATEST
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] font-sans mt-0.5 flex items-center gap-1.5 flex-wrap telemetry-num ${subTextColor}`}>
                        <span>{r.distanceKm ? r.distanceKm.toFixed(1) : 0} km</span>
                        {r.durationSeconds && r.durationSeconds > 0 && (
                          <>
                            <span>•</span>
                            <span>{formatDurationSummary(r.durationSeconds)}</span>
                          </>
                        )}
                        {r.avgSpeedKmh && r.avgSpeedKmh > 0 && (
                          <>
                            <span>•</span>
                            <span>Avg {Math.round(r.avgSpeedKmh)} km/h</span>
                          </>
                        )}
                        <span>•</span>
                        <span className={`font-bold ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
                          Max {r.maxSpeedKmh ? r.maxSpeedKmh.toFixed(0) : 0} km/h
                        </span>
                        <span>•</span>
                        <span>{r.date}</span>
                        {r.mountMode && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            r.mountMode === 'pocket' 
                              ? (isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30')
                              : (isLight ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30')
                          }`}>
                            {r.mountMode}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={e => handleDownload(r, e)}
                      title="Export GPX file"
                      aria-label={`Export ${r.name} as GPX`}
                      className={`p-2 border rounded-lg transition-colors cursor-pointer ${
                        isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#0d131a] hover:bg-[#1c2633] border-[#223140] text-slate-300 hover:text-white'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === r.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={e => handleDelete(r.id, e)}
                          title="Confirm permanent delete"
                          className="px-2 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
                        >
                          Delete?
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          title="Cancel delete"
                          className={`px-1.5 py-1.5 rounded-lg border font-sans text-[10px] cursor-pointer ${
                            isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={e => handleDelete(r.id, e)}
                        title="Delete ride"
                        aria-label={`Delete ${r.name}`}
                        className={`p-2 border rounded-lg transition-colors cursor-pointer ${
                          isLight ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600' : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRide(r.gpxContent, r.name, r.id);
                        onClose();
                      }}
                      className={`text-xs font-sans flex items-center gap-1 pl-1 font-bold cursor-pointer ${
                        isLight ? 'text-sky-700' : 'text-sky-400'
                      }`}
                    >
                      <span>View</span>
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Clean Empty State */
            <div className={`p-8 text-center font-sans rounded-2xl border border-dashed flex flex-col items-center justify-center space-y-3 ${
              isLight ? 'border-slate-300 bg-slate-50 text-slate-600' : 'border-[#1e2a38] bg-[#0d131a] text-[#8f9ca8]'
            }`}>
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              }`}>
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <h4 className={`font-heading font-black text-sm uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {searchQuery ? `No Rides Match "${searchQuery}"` : 'Your Garage is Empty'}
                </h4>
                <p className={`text-xs max-w-sm mt-1 leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {searchQuery
                    ? 'Try searching with a different term or clear the search bar.'
                    : 'Record a ride from the Handlebar Cockpit or import a GPX track to save your runs here.'}
                </p>
              </div>

              {!searchQuery && (
                <div className="pt-2 flex items-center gap-2 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSample();
                      onClose();
                    }}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold font-sans transition-all cursor-pointer ${
                      isLight
                        ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border-sky-500/30'
                    }`}
                  >
                    <span>Load Demo Route to Test</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 sm:px-5 py-3 border-t flex items-center justify-between text-[11px] font-sans ${footerBg}`}>
          <span className={subTextColor}>Saved locally on this device (works offline)</span>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-1.5 border rounded-xl transition-colors cursor-pointer font-bold ${
              isLight ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800' : 'bg-[#1c2633] hover:bg-[#263547] border-[#2a3a4d] text-white'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

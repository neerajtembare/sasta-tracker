import React, { useState, useEffect, useRef } from 'react';
import { SavedRide, getGarageRides, deleteGarageRide, saveRideToGarage, importGarageBackup } from '../utils/storage';
import { RideAnalysis, AppTheme } from '../types';
import { exportAnalysisToGPX, downloadFile } from '../utils/gpxExporter';
import { 
  SAMPLE_GPX_DATA,
  SAMPLE_GPX_NAME,
  HIGH_RES_TWISTIES_GPX, 
  HIGH_RES_TWISTIES_NAME,
  SATURDAY_MORNING_GPX,
  SATURDAY_MORNING_NAME,
  MULSHI_RETURN_GPX,
  MULSHI_RETURN_NAME
} from '../data/sampleRide';
import { 
  FolderArchive, 
  X, 
  Play, 
  Trash2, 
  Download, 
  Save, 
  Check, 
  Sparkles,
  Navigation,
  Zap,
  MapPin,
  FileUp,
  FileDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface GarageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalysis?: RideAnalysis | null;
  onSelectRide: (gpxContent: string, name: string, id?: string) => void;
  onLoadSample: () => void;
  onCloseTrack?: () => void;
  theme?: AppTheme;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  isOpen,
  onClose,
  currentAnalysis,
  onSelectRide,
  onLoadSample,
  onCloseTrack,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [rides, setRides] = useState<SavedRide[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRides(getGarageRides());
      setSavedSuccess(false);
      setBackupFeedback(null);
    }
  }, [isOpen]);

  const handleExportBackup = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (rides.length === 0) {
      setBackupFeedback({ type: 'error', message: 'No custom rides in garage to export.' });
      setTimeout(() => setBackupFeedback(null), 3000);
      return;
    }
    const backupPayload = {
      app: 'sasta-tracker',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: rides.length,
      rides: rides,
    };
    downloadFile(JSON.stringify(backupPayload, null, 2), `sasta_tracker_garage_backup_${new Date().toISOString().slice(0, 10)}.json`);
    setBackupFeedback({ type: 'success', message: `Exported ${rides.length} rides to JSON backup!` });
    setTimeout(() => setBackupFeedback(null), 3500);
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const ridesArray = Array.isArray(parsed) ? parsed : parsed.rides;
        if (!Array.isArray(ridesArray)) {
          throw new Error('Unrecognized JSON format: expected array of rides');
        }
        const updated = importGarageBackup(ridesArray);
        setRides(updated);
        setBackupFeedback({ type: 'success', message: `Successfully restored ${ridesArray.length} rides!` });
        setTimeout(() => setBackupFeedback(null), 4000);
      } catch (err: any) {
        setBackupFeedback({ type: 'error', message: err.message || 'Failed to restore rides from JSON.' });
        setTimeout(() => setBackupFeedback(null), 5000);
      } finally {
        if (restoreFileInputRef.current) {
          restoreFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  const handleSaveCurrent = () => {
    if (!currentAnalysis) return;
    const gpxText = exportAnalysisToGPX(currentAnalysis);
    try {
      saveRideToGarage({
        name: currentAnalysis.name,
        distanceKm: currentAnalysis.totalDistanceKm,
        maxSpeedKmh: currentAnalysis.maxSpeedKmh,
        gpxContent: gpxText,
      });
      setRides(getGarageRides());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e: any) {
      alert(e.message || 'Failed to save ride.');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteGarageRide(id);
    setRides(updated);
  };

  const handleDownload = (ride: SavedRide, e: React.MouseEvent) => {
    e.stopPropagation();
    downloadFile(ride.gpxContent, `${ride.name.replace(/\s+/g, '_')}.gpx`);
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const activeRideBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#141d26] border-[#1e2a38]';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-slate-900' : 'bg-[#131b24] border-[#1e2a38] hover:border-sky-500/50 hover:bg-[#1a2533] text-white';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const footerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className={`border rounded-2xl w-full max-w-2xl max-h-[90dvh] overscroll-contain flex flex-col shadow-2xl overflow-hidden ${modalBg}`}>
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
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>        {/* Action bar for active loaded ride */}
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

        {/* Saved Rides & Built-in Samples List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          <div className={`text-[10px] font-mono uppercase tracking-wider font-bold mb-1 ${subTextColor}`}>
            BUILT-IN TEST & BENCHMARK SAMPLES:
          </div>

          {/* User's Saturday Morning GPX File */}
          <div
            onClick={() => {
              onSelectRide(SATURDAY_MORNING_GPX, SATURDAY_MORNING_NAME);
              onClose();
            }}
            className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm ${itemBg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold flex items-center gap-2">
                  <span>Saturday Morning Ride (Pune - Wai - Satara)</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/30 rounded font-mono font-bold">
                    YOUR GPX LOG
                  </span>
                </div>
                <div className={`text-[11px] font-mono mt-0.5 ${subTextColor}`}>
                  High-speed highway & ghat climb sections • 89 KB original GPX log
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-sky-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
              <span>Load</span>
              <Play className="w-3 h-3 fill-current" />
            </span>
          </div>

          {/* User's Mulshi Return GPX File */}
          <div
            onClick={() => {
              onSelectRide(MULSHI_RETURN_GPX, MULSHI_RETURN_NAME);
              onClose();
            }}
            className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm ${itemBg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold flex items-center gap-2">
                  <span>Mulshi Lake Return Run (Ghats & Twisties)</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded font-mono font-bold">
                    YOUR GPX LOG
                  </span>
                </div>
                <div className={`text-[11px] font-mono mt-0.5 ${subTextColor}`}>
                  Scenic twisties around Mulshi & Pirangut • 26 KB original GPX log
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-amber-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
              <span>Load</span>
              <Play className="w-3 h-3 fill-current" />
            </span>
          </div>

          {/* Western Ghats Tour Sample */}
          <div
            onClick={() => {
              onLoadSample();
              onClose();
            }}
            className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm ${itemBg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold flex items-center gap-2">
                  <span>Western Ghats Tour (Pune - Wai - Mahabaleshwar)</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded font-mono font-bold">
                    PRE-TAGGED STOPS
                  </span>
                </div>
                <div className={`text-[11px] font-mono mt-0.5 ${subTextColor}`}>
                  128.6 km • Max 104 km/h • 1,440m Climb • 72 Satellites • Pre-configured chai & fuel stops
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-emerald-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
              <span>Load</span>
              <Play className="w-3 h-3 fill-current" />
            </span>
          </div>

          {/* High-Res 1-Second GPS Sample */}
          <div
            onClick={() => {
              onSelectRide(HIGH_RES_TWISTIES_GPX, HIGH_RES_TWISTIES_NAME);
              onClose();
            }}
            className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm ${itemBg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold flex items-center gap-2">
                  <span>Pasarni Ghat Mountain Hairpins (1Hz High-Res)</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 rounded font-mono font-bold">
                    1-SEC LOGGING
                  </span>
                </div>
                <div className={`text-[11px] font-mono mt-0.5 ${subTextColor}`}>
                  120 continuous 1-second fixes • Apex braking • 42° Lean angles • Fluid S-curve road trace
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-cyan-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-bold">
              <span>Load</span>
              <Play className="w-3 h-3 fill-current" />
            </span>
          </div>

          {/* User Saved Rides Header + Backup / Restore Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mb-1 border-t border-slate-700/20">
            <div className={`text-[10px] font-mono uppercase tracking-wider font-bold ${subTextColor}`}>
              SAVED RIDES IN YOUR BROWSER ({rides.length}):
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                type="file"
                ref={restoreFileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={handleRestoreFileSelected}
              />

              <button
                onClick={() => restoreFileInputRef.current?.click()}
                title="Restore saved rides from a previously exported JSON backup"
                className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FileUp className="w-3 h-3" />
                <span>Restore Backup</span>
              </button>

              <button
                onClick={handleExportBackup}
                title="Export all garage rides to a JSON backup file"
                className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FileDown className="w-3 h-3" />
                <span>Backup JSON</span>
              </button>

              {rides.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete all saved rides from your browser garage?')) {
                      localStorage.removeItem('sasta_tracker_garage');
                      setRides([]);
                    }
                  }}
                  className="text-[10px] font-mono text-rose-400 hover:text-rose-300 underline cursor-pointer ml-1"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {backupFeedback && (
            <div className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200 ${
              backupFeedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}>
              {backupFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{backupFeedback.message}</span>
            </div>
          )}

          {rides.length > 0 ? (
            rides.map(r => (
              <div
                key={r.id}
                onClick={() => {
                  onSelectRide(r.gpxContent, r.name, r.id);
                  onClose();
                }}
                className={`p-3.5 border rounded-xl flex items-center justify-between gap-3 cursor-pointer group transition-all shadow-sm ${itemBg}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-500">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold">
                      {r.name}
                    </div>
                    <div className={`text-[11px] font-mono mt-0.5 flex items-center gap-2 ${subTextColor}`}>
                      <span>{r.distanceKm ? r.distanceKm.toFixed(1) : 0} km</span>
                      <span>•</span>
                      <span className="text-rose-500 font-bold">Max {r.maxSpeedKmh ? r.maxSpeedKmh.toFixed(0) : 0} km/h</span>
                      <span>•</span>
                      <span>Saved: {r.date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={e => handleDownload(r, e)}
                    title="Export GPX"
                    className={`p-2 border rounded-lg transition-colors cursor-pointer ${
                      isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#0d131a] hover:bg-[#1c2633] border-[#223140] text-slate-300 hover:text-white'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={e => handleDelete(r.id, e)}
                    title="Delete ride"
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono text-sky-500 group-hover:translate-x-1 transition-transform flex items-center gap-1 pl-1 font-bold">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={`p-6 text-center font-mono text-xs border border-dashed rounded-xl ${
              isLight ? 'border-slate-300 text-slate-500 bg-slate-50' : 'border-[#1e2a38] text-[#8f9ca8] bg-[#0d131a]'
            }`}>
              No custom rides saved yet. Click "Save to Garage" above or record a ride in the GPS Cockpit!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-4 sm:px-5 py-3 border-t flex items-center justify-between text-[11px] font-mono ${footerBg}`}>
          <span className={subTextColor}>Private browser storage (works offline)</span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 border rounded-xl transition-colors cursor-pointer ${
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

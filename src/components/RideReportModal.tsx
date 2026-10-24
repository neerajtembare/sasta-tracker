import React from 'react';
import { RideAnalysis, AppTheme, UnitSystem } from '../types';
import { convertSpeed, convertDistance, convertElevation, convertFuelVolume } from '../utils/units';
import { 
  Printer, 
  Download, 
  X, 
  FileText, 
  Bike, 
  Clock, 
  Flame, 
  Mountain, 
  Fuel, 
  Compass, 
  CheckCircle2, 
  MapPin,
  Calendar,
  Layers
} from 'lucide-react';

interface RideReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: RideAnalysis;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const RideReportModal: React.FC<RideReportModalProps> = ({
  isOpen,
  onClose,
  analysis,
  theme = 'dark',
  unitSystem = 'metric',
}) => {
  if (!isOpen || !analysis) return null;

  const isLight = theme === 'light';

  // Format helpers
  const formatTime = (totalSec: number) => {
    if (!totalSec || isNaN(totalSec)) return '00:00';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const distConverted = convertDistance(analysis.totalDistanceKm, unitSystem);
  const maxSpeedConverted = convertSpeed(analysis.maxSpeedKmh, unitSystem);
  const movingAvgConverted = convertSpeed(analysis.movingAvgSpeedKmh, unitSystem);
  const overallAvgConverted = convertSpeed(analysis.overallAvgSpeedKmh, unitSystem);
  const elevGainConverted = convertElevation(analysis.elevGainM, unitSystem);
  const elevLossConverted = convertElevation(analysis.elevLossM, unitSystem);
  const elevMinConverted = convertElevation(analysis.elevMinM, unitSystem);
  const elevMaxConverted = convertElevation(analysis.elevMaxM, unitSystem);

  // Fuel calculation
  const kmPerLiter = analysis.fuelMileageKmpl || 32;
  const fuelPrice = analysis.fuelPricePerLiter || 104;
  const estimatedFuelLiters = analysis.customFuelLiters 
    ? analysis.customFuelLiters 
    : kmPerLiter > 0 ? analysis.totalDistanceKm / kmPerLiter : 0;
  const fuelVolumeConverted = convertFuelVolume(estimatedFuelLiters, unitSystem);
  const estimatedFuelCost = Math.round(estimatedFuelLiters * fuelPrice);

  const saddleEfficiency = analysis.totalDurationSeconds > 0
    ? Math.round((analysis.movingTimeSeconds / analysis.totalDurationSeconds) * 100)
    : 100;

  const lateralG = (Math.tan(((analysis.maxEstimatedLean || 0) * Math.PI) / 180)).toFixed(2);

  const startDateStr = analysis.startTime 
    ? new Date(analysis.startTime).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown Date';

  const startTimeStr = analysis.startTime 
    ? new Date(analysis.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  const endTimeStr = analysis.endTime 
    ? new Date(analysis.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Telemetry Export Handler
  const handleDownloadCsv = () => {
    if (!analysis.points || analysis.points.length === 0) return;

    const headers = [
      'Index',
      'Time_ISO',
      'Latitude',
      'Longitude',
      'Elevation_Meters',
      'Speed_Kmh',
      'Speed_Mph',
      'Cumulative_Dist_Km',
      'Bearing_Deg',
      'Est_Lean_Angle_Deg',
      'Satellite_Count',
    ];

    const rows = analysis.points.map((pt, idx) => [
      idx + 1,
      pt.time || '',
      pt.lat.toFixed(6),
      pt.lon.toFixed(6),
      pt.ele !== null ? pt.ele.toFixed(1) : '',
      pt.speedKmh.toFixed(2),
      (pt.speedKmh * 0.621371).toFixed(2),
      pt.distanceFromStartKm.toFixed(3),
      pt.bearing !== null ? pt.bearing.toFixed(1) : '',
      pt.estimatedLeanAngle !== undefined ? pt.estimatedLeanAngle.toFixed(1) : '',
      pt.sat !== null ? pt.sat : '',
    ]);

    const csvContent = [
      `# ThrottleLog Motorcycle Ride Telemetry Dossier`,
      `# Ride Name: ${analysis.name}`,
      `# Date: ${startDateStr}`,
      `# Bike: ${analysis.bikeModel || 'Motorcycle'}`,
      `# Total Distance: ${analysis.totalDistanceKm.toFixed(2)} km`,
      `# Max Speed: ${analysis.maxSpeedKmh.toFixed(1)} km/h`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${analysis.name.replace(/\s+/g, '_')}_telemetry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const subTextColor = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const tableBorder = isLight ? 'border-slate-200' : 'border-[#1e2a38]';
  const tableHeaderBg = isLight ? 'bg-slate-100 text-slate-700' : 'bg-[#141d26] text-slate-300';
  const cardSectionBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111922] border-[#1e2a38]';

  return (
    <div 
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn print-modal-overlay cursor-pointer"
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-4xl max-h-[94dvh] overscroll-contain flex flex-col shadow-2xl overflow-hidden print-modal-card cursor-default ${modalBg}`}
      >
        {/* Modal Header & Quick Actions */}
        <div className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between no-print ${cardSectionBg}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider">
                Official Ride Dossier & PDF Export
              </h3>
              <p className={`text-[11px] font-mono ${subTextColor}`}>
                Print to PDF or export full tabular telemetry for your records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              title="Download raw GPS telemetry in CSV spreadsheet format"
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#182330] hover:bg-[#223142] border-[#293c52] text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              title="Open browser print dialogue to print or save as PDF"
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 print-container" id="printable-ride-dossier">
          {/* Document Header */}
          <div className="border-b pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-sky-500 font-bold uppercase tracking-wider">
                <span>⚡ THROTTLELOG TELEMETRY REPORT</span>
                <span>•</span>
                <span>100% PRIVATE & OFFLINE</span>
              </div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mt-1">
                {analysis.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>{startDateStr}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{startTimeStr} — {endTimeStr}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Bike className="w-3.5 h-3.5 text-amber-400" />
                  <span>{analysis.bikeModel || 'Motorcycle'}</span>
                </span>
              </div>
            </div>

            <div className="sm:text-right font-mono text-xs text-slate-400 shrink-0">
              <div className="text-[10px] uppercase text-sky-500 font-bold">REPORT IDENTIFIER</div>
              <div className="font-bold text-white mt-0.5">#{Math.abs(analysis.points.length * 31).toString(16).toUpperCase()}-DOSSIER</div>
              <div className="text-[10px] mt-0.5">{analysis.points.length} GPS Points Analyzed</div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>1. Executive Telemetry Overview</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className="text-[10px] text-slate-400 uppercase">TOTAL DISTANCE</div>
                <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
                  {distConverted.value.toFixed(1)} <span className="text-xs">{distConverted.unit.toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{analysis.segments.length} segment(s)</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className="text-[10px] text-slate-400 uppercase">TOP SPEED</div>
                <div className="text-xl sm:text-2xl font-black text-rose-500 mt-1">
                  {maxSpeedConverted.value.toFixed(0)} <span className="text-xs">{maxSpeedConverted.unit.toUpperCase()}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Avg: {movingAvgConverted.value.toFixed(1)} {movingAvgConverted.unit}</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className="text-[10px] text-slate-400 uppercase">SADDLE DURATION</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
                  {formatTime(analysis.movingTimeSeconds)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{saddleEfficiency}% efficiency in saddle</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className="text-[10px] text-slate-400 uppercase">PEAK LEAN & G-FORCE</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
                  {Math.round(analysis.maxEstimatedLean || 0)}° <span className="text-xs text-slate-400">({lateralG}G)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Calculated centripetal roll</div>
              </div>
            </div>
          </div>

          {/* Secondary Details Table */}
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>2. Detailed Mission Parameters</span>
            </h2>
            <div className={`border rounded-xl overflow-hidden font-mono text-xs ${tableBorder}`}>
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg} w-1/3`}>Total Duration</td>
                    <td className="p-2.5">{formatTime(analysis.totalDurationSeconds)} (Stopped: {formatTime(analysis.stoppedTimeSeconds)})</td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Elevation Profile</td>
                    <td className="p-2.5">
                      Gain: +{elevGainConverted.value?.toFixed(0) ?? 0} {elevGainConverted.unit} | Loss: -{elevLossConverted.value?.toFixed(0) ?? 0} {elevLossConverted.unit} (Min: {elevMinConverted.value?.toFixed(0) ?? 0}m, Max: {elevMaxConverted.value?.toFixed(0) ?? 0}m)
                    </td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Estimated Fuel & Cost</td>
                    <td className="p-2.5">
                      ~{fuelVolumeConverted.value.toFixed(2)} {fuelVolumeConverted.unit} consumed (Est. ₹{estimatedFuelCost} @ {kmPerLiter} km/L)
                    </td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Pace Metrics</td>
                    <td className="p-2.5">
                      Moving Pace: {movingAvgConverted.value.toFixed(1)} {movingAvgConverted.unit} | Overall Pace: {overallAvgConverted.value.toFixed(1)} {overallAvgConverted.unit}
                    </td>
                  </tr>
                  <tr>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>GPS Satellite Health</td>
                    <td className="p-2.5">
                      Avg Satellites: {analysis.avgSatellites ? analysis.avgSatellites.toFixed(1) : 'Standard Fix'} | Best HDOP: {analysis.bestHdop ? analysis.bestHdop.toFixed(1) : 'High Precision'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pit Stops & Marked Waypoints */}
          {analysis.pitStops && analysis.pitStops.length > 0 && (
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>3. Pit Stops & Marked Waypoints ({analysis.pitStops.length})</span>
              </h2>
              <div className={`border rounded-xl overflow-hidden font-mono text-xs ${tableBorder}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b font-bold ${tableHeaderBg} ${tableBorder}`}>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Name / Label</th>
                      <th className="p-2.5">Route Distance</th>
                      <th className="p-2.5">Duration</th>
                      <th className="p-2.5">GPS Coordinate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.pitStops.map((stop, idx) => (
                      <tr key={stop.id || idx} className={`border-b last:border-0 ${tableBorder}`}>
                        <td className="p-2.5 font-bold text-sky-400">{idx + 1}</td>
                        <td className="p-2.5 capitalize">{stop.category}</td>
                        <td className="p-2.5 font-bold">{stop.name}</td>
                        <td className="p-2.5">{convertDistance(stop.distanceKm, unitSystem).value.toFixed(1)} {unitSystem === 'imperial' ? 'mi' : 'km'}</td>
                        <td className="p-2.5">{formatTime(stop.durationSeconds)}</td>
                        <td className="p-2.5 text-slate-400 text-[11px]">{stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer certification & watermark */}
          <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Verified Motorcycle Telemetry Record • ThrottleLog</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Generated: {new Date().toLocaleString()} • throttlelog.vercel.app
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { formatDurationSummary, formatSafeTime, formatSafeDateTime } from '../utils/units';
import { downloadFile } from '../utils/gpxExporter';
import { getRiderProfile } from '../utils/riderProfile';
import {
  Printer,
  Download,
  X,
  FileText,
  Bike,
  Clock,
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
}

export const RideReportModal: React.FC<RideReportModalProps> = ({
  isOpen,
  onClose,
  analysis,
  theme = 'dark',
}) => {
  if (!isOpen || !analysis) return null;

  const isLight = theme === 'light';
  const profile = getRiderProfile();
  const bikeLabel = analysis.bikeModel || profile.bikeModel || 'Motorcycle';

  const formatTime = (totalSec: number) => formatDurationSummary(totalSec);

  const effectiveDistKm = analysis.userDistanceOverrideKm || analysis.totalDistanceKm;

  // Fuel calculation
  const kmPerLiter = analysis.fuelMileageKmpl || profile.fuelMileageKmpl || 32;
  const fuelPrice = analysis.fuelPricePerLiter || profile.fuelPricePerLiter || 104;
  const currencySymbol = profile.currencySymbol || '₹';
  const estimatedFuelLiters = analysis.customFuelLiters
    ? analysis.customFuelLiters
    : kmPerLiter > 0 ? effectiveDistKm / kmPerLiter : 0;
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

  const startTimeStr = formatSafeTime(analysis.startTime);
  const endTimeStr = formatSafeTime(analysis.endTime);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Telemetry Export Handler (km/h & metric)
  const handleDownloadCsv = () => {
    if (!analysis.points || analysis.points.length === 0) return;

    const headers = [
      'Index',
      'Time_ISO',
      'Latitude',
      'Longitude',
      'Elevation_Meters',
      'Speed_Kmh',
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
      pt.distanceFromStartKm.toFixed(3),
      pt.bearing !== null ? pt.bearing.toFixed(1) : '',
      pt.estimatedLeanAngle !== undefined ? pt.estimatedLeanAngle.toFixed(1) : '',
      pt.sat !== null ? pt.sat : '',
    ]);

    const csvContent = [
      `# ThrottleLog Motorcycle Ride Telemetry Dossier`,
      `# Ride Name: ${analysis.name}`,
      `# Date: ${startDateStr}`,
      `# Bike: ${bikeLabel}`,
      `# Total Distance: ${effectiveDistKm.toFixed(2)} km`,
      `# Max Speed: ${analysis.maxSpeedKmh.toFixed(1)} km/h`,
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    downloadFile(csvContent, `${analysis.name.replace(/\s+/g, '_')}_telemetry.csv`, 'text/csv;charset=utf-8');
  };

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/80';
  const subTextColor = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const tableBorder = isLight ? 'border-slate-200' : 'border-[#1e2a38]';
  const tableHeaderBg = isLight ? 'bg-slate-100 text-slate-800' : 'bg-[#141d26] text-slate-300';
  const cardSectionBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#111922] border-[#1e2a38]';
  const rawHost = typeof window !== 'undefined' ? window.location.host : '';
  const hostLabel = rawHost && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawHost) ? rawHost : 'ThrottleLog Offline';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-2 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-sm animate-fadeIn print-modal-overlay cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-4xl max-h-[90dvh] overscroll-contain flex flex-col shadow-2xl overflow-hidden print-modal-card cursor-default ${modalBg}`}
      >
        {/* Modal Header & Quick Actions */}
        <div className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between no-print ${cardSectionBg}`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
              isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
            }`}>
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider">
                Official Ride Dossier &amp; PDF Export
              </h3>
              <p className={`text-[11px] font-sans ${subTextColor}`}>
                Print to PDF or export full tabular telemetry for your records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadCsv}
              title="Download raw GPS telemetry in CSV spreadsheet format"
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#182330] hover:bg-[#223142] border-[#293c52] text-slate-200'
              }`}
            >
              <Download className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Open browser print dialogue to print or save as PDF"
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-mono font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close telemetry report"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#1c2633]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 print-container" id="printable-ride-dossier">
          {/* Document Header */}
          <div className={`border-b pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${tableBorder}`}>
            <div>
              <div className={`flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                <span>THROTTLELOG TELEMETRY REPORT</span>
                <span>•</span>
                <span>100% PRIVATE &amp; OFFLINE</span>
              </div>
              <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mt-1">
                {analysis.name}
              </h1>
              <div className={`flex flex-wrap items-center gap-3 mt-2 text-xs font-mono ${subTextColor}`}>
                <span className="flex items-center gap-1">
                  <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
                  <span>{startDateStr}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 telemetry-num">
                  <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                  <span>{startTimeStr} — {endTimeStr}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Bike className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                  <span>{bikeLabel}</span>
                </span>
              </div>
            </div>

            <div className={`sm:text-right font-mono text-xs shrink-0 ${subTextColor}`}>
              <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>REPORT IDENTIFIER</div>
              <div className={`font-bold mt-0.5 telemetry-num ${isLight ? 'text-slate-900' : 'text-white'}`}>#{Math.abs(analysis.points.length * 31).toString(16).toUpperCase()}-DOSSIER</div>
              <div className="text-[10px] mt-0.5 telemetry-num">{analysis.points.length} GPS Points Analyzed</div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div>
            <h2 className={`text-xs font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              <Compass className="w-3.5 h-3.5" />
              <span>1. Executive Telemetry Overview</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono telemetry-num">
              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className={`text-[10px] uppercase ${subTextColor}`}>TOTAL DISTANCE</div>
                <div className={`text-xl sm:text-2xl font-black mt-1 ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                  {effectiveDistKm.toFixed(1)} <span className="text-xs">KM</span>
                </div>
                <div className={`text-[10px] mt-1 ${subTextColor}`}>{analysis.segments.length} segment(s)</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className={`text-[10px] uppercase ${subTextColor}`}>TOP SPEED</div>
                <div className={`text-xl sm:text-2xl font-black mt-1 ${isLight ? 'text-rose-700' : 'text-rose-500'}`}>
                  {analysis.maxSpeedKmh.toFixed(0)} <span className="text-xs">KM/H</span>
                </div>
                <div className={`text-[10px] mt-1 ${subTextColor}`}>Avg: {analysis.movingAvgSpeedKmh.toFixed(1)} km/h</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className={`text-[10px] uppercase ${subTextColor}`}>SADDLE DURATION</div>
                <div className={`text-xl sm:text-2xl font-black mt-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                  {formatTime(analysis.movingTimeSeconds)}
                </div>
                <div className={`text-[10px] mt-1 ${subTextColor}`}>{saddleEfficiency}% efficiency in saddle</div>
              </div>

              <div className={`p-3.5 border rounded-xl ${cardSectionBg}`}>
                <div className={`text-[10px] uppercase ${subTextColor}`}>PEAK LEAN &amp; G-FORCE</div>
                <div className={`text-xl sm:text-2xl font-black mt-1 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  {Math.round(analysis.maxEstimatedLean || 0)}° <span className={`text-xs ${subTextColor}`}>({lateralG}G)</span>
                </div>
                <div className={`text-[10px] mt-1 ${subTextColor}`}>Calculated centripetal roll</div>
              </div>
            </div>
          </div>

          {/* Secondary Details Table */}
          <div>
            <h2 className={`text-xs font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
              <Layers className="w-3.5 h-3.5" />
              <span>2. Detailed Mission Parameters</span>
            </h2>
            <div className={`border rounded-xl overflow-hidden font-mono text-xs telemetry-num ${tableBorder}`}>
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg} w-1/3`}>Total Duration</td>
                    <td className="p-2.5">{formatTime(analysis.totalDurationSeconds)} (Stopped: {formatTime(analysis.stoppedTimeSeconds)})</td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Elevation Profile</td>
                    <td className="p-2.5">
                      Gain: +{Math.round(analysis.elevGainM)} m | Loss: -{Math.round(analysis.elevLossM)} m (Min: {analysis.elevMinM !== null ? Math.round(analysis.elevMinM) : 0}m, Max: {analysis.elevMaxM !== null ? Math.round(analysis.elevMaxM) : 0}m)
                    </td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Estimated Fuel &amp; Cost</td>
                    <td className="p-2.5">
                      ~{estimatedFuelLiters.toFixed(2)} L consumed (Est. {currencySymbol}{estimatedFuelCost} @ {kmPerLiter} km/L)
                    </td>
                  </tr>
                  <tr className={`border-b ${tableBorder}`}>
                    <td className={`p-2.5 font-bold ${tableHeaderBg}`}>Pace Metrics</td>
                    <td className="p-2.5">
                      Moving Pace: {analysis.movingAvgSpeedKmh.toFixed(1)} km/h | Overall Pace: {analysis.overallAvgSpeedKmh.toFixed(1)} km/h
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
              <h2 className={`text-xs font-mono font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                <MapPin className="w-3.5 h-3.5" />
                <span>3. Pit Stops &amp; Marked Waypoints ({analysis.pitStops.length})</span>
              </h2>
              <div className={`border rounded-xl overflow-hidden font-mono text-xs telemetry-num ${tableBorder}`}>
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
                        <td className={`p-2.5 font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{idx + 1}</td>
                        <td className="p-2.5 capitalize">{stop.category}</td>
                        <td className="p-2.5 font-bold font-sans">{stop.name}</td>
                        <td className="p-2.5">{stop.distanceKm.toFixed(1)} km</td>
                        <td className="p-2.5">{formatTime(stop.durationSeconds)}</td>
                        <td className={`p-2.5 text-[11px] ${subTextColor}`}>{stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer certification & watermark */}
          <div className={`pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono ${tableBorder} ${subTextColor}`}>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span>Verified Motorcycle Telemetry Record • ThrottleLog</span>
            </div>
            <div className={`text-[11px] ${subTextColor}`}>
              Generated: {formatSafeDateTime(new Date().toISOString())} • {hostLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

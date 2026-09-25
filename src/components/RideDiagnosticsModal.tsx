import React, { useState } from 'react';
import { RideAnalysis, AppTheme } from '../types';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  MapPin, 
  Clock, 
  Activity, 
  Mountain, 
  Zap, 
  Radio, 
  Compass, 
  Send, 
  ShieldCheck, 
  FileSpreadsheet,
  Table as TableIcon,
  Layers,
  ChevronRight,
  Share2
} from 'lucide-react';
import { exportAnalysisToGPX, downloadFile } from '../utils/gpxExporter';

interface RideDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: RideAnalysis;
  theme?: AppTheme;
  onSelectCoordinate?: (lat: number, lon: number, label?: string) => void;
  onScrubToIndex?: (index: number) => void;
}

export const RideDiagnosticsModal: React.FC<RideDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  analysis,
  theme = 'dark',
  onSelectCoordinate,
  onScrubToIndex,
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'specs' | 'segments' | 'export'>('specs');
  const [copiedCoords, setCopiedCoords] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'moving' | 'stopped'>('all');

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec)) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.round(sec % 60);
    if (h > 0) return `${h}h ${m}m ${s > 0 ? `${s}s` : ''}`;
    if (m > 0) return `${m}m ${s > 0 ? `${s}s` : ''}`;
    return `${s}s`;
  };

  const formatDetailedTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return isoString;
    }
  };

  const handleCopy = (text: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }

    if (id === 'summary') {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } else {
      setCopiedCoords(id);
      setTimeout(() => setCopiedCoords(null), 2000);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {
      console.warn('Fallback copy error:', e);
    }
  };
  const startPt = analysis.points[0];
  const endPt = analysis.points[analysis.points.length - 1];

  const startCoordStr = startPt ? `${startPt.lat.toFixed(6)}, ${startPt.lon.toFixed(6)}` : '—';
  const endCoordStr = endPt ? `${endPt.lat.toFixed(6)}, ${endPt.lon.toFixed(6)}` : '—';

  // Sampling calculations
  const totalFixes = analysis.points.length;
  const avgSamplingIntervalSec = analysis.totalDurationSeconds > 0 && totalFixes > 1
    ? (analysis.totalDurationSeconds / (totalFixes - 1)).toFixed(1)
    : '—';
  const avgSpatialResolutionMeters = analysis.totalDistanceKm > 0 && totalFixes > 1
    ? ((analysis.totalDistanceKm * 1000) / (totalFixes - 1)).toFixed(1)
    : '—';

  // Elevation net
  const netElevationDelta = analysis.elevEndM !== null && analysis.elevStartM !== null
    ? (analysis.elevEndM - analysis.elevStartM).toFixed(0)
    : '—';

  // Activity classification
  const act = analysis.activityType || { label: 'Motorbike Ride', emoji: '🏍️' };

  // Status badges
  const movingPct = Math.round((analysis.movingTimeSeconds / Math.max(1, analysis.totalDurationSeconds)) * 100);
  const stoppedPct = Math.max(0, 100 - movingPct);

  // Generate WhatsApp / Strava Markdown summary
  const generateRideSummary = () => {
    const lines = [
      `🏍️ **${analysis.name}**`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📍 Distance: ${analysis.totalDistanceKm.toFixed(1)} km${analysis.userDistanceOverrideKm ? ` (Odo Calibrated: ${analysis.userDistanceOverrideKm} km)` : ''}`,
      `⏱️ Total Elapsed: ${formatDuration(analysis.totalDurationSeconds)}`,
      `🚴 Saddle Moving: ${formatDuration(analysis.movingTimeSeconds)} (${movingPct}%)`,
      `🛑 Pit Breaks: ${formatDuration(analysis.stoppedTimeSeconds)} (${analysis.pitStops.length} stops)`,
      `⚡ Top Speed: ${analysis.maxSpeedKmh.toFixed(1)} km/h`,
      `💨 Moving Average: ${analysis.movingAvgSpeedKmh.toFixed(1)} km/h`,
      `⛰️ Elevation Gain: +${analysis.elevGainM.toFixed(0)}m (Max: ${analysis.elevMaxM !== null ? `${analysis.elevMaxM.toFixed(0)}m` : '—'})`,
      analysis.maxEstimatedLean > 0 ? `📐 Max Apex Lean: ${analysis.maxEstimatedLean}°` : null,
      `🧭 Track Fixes: ${totalFixes} GPS coordinates`,
      startPt ? `🚩 Start: ${startCoordStr}` : null,
      endPt ? `🏁 Finish: ${endCoordStr}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Tracked via Sasta Tracker (Free & Private GPX Analyzer)`
    ].filter(Boolean);
    return lines.join('\n');
  };

  // Export CSV splits
  const handleExportCSV = () => {
    const headers = ['Segment', 'Distance_km', 'Duration_sec', 'Moving_sec', 'Avg_Speed_kmh', 'Max_Speed_kmh', 'Elev_Gain_m', 'Elev_Loss_m'];
    const rows = analysis.segments.map((s, i) => [
      i + 1,
      s.distanceKm.toFixed(3),
      Math.round(s.durationSeconds),
      Math.round(s.movingTimeSeconds),
      s.avgSpeedKmh.toFixed(1),
      s.maxSpeedKmh.toFixed(1),
      s.elevGain.toFixed(1),
      s.elevLoss.toFixed(1)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csvContent, `${(analysis.name || 'ride').replace(/\s+/g, '_')}_segments.csv`, 'text/csv');
  };

  const handleExportGPX = () => {
    const gpxText = exportAnalysisToGPX(analysis);
    downloadFile(gpxText, `${(analysis.name || 'ride').replace(/\s+/g, '_')}.gpx`);
  };

  // Filtered segments
  const filteredSegments = analysis.segments.filter(s => {
    if (segmentFilter === 'moving') return s.movingTimeSeconds > 0 && s.avgSpeedKmh > 2.5;
    if (segmentFilter === 'stopped') return s.avgSpeedKmh <= 2.5 || s.movingTimeSeconds === 0;
    return true;
  });

  const cardBg = isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-[#0d131a] text-white border-[#1e2a38]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const statBoxBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const tableBorder = isLight ? 'border-slate-200' : 'border-[#1e2a38]';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className={`w-full max-w-4xl max-h-[92dvh] overscroll-contain rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${cardBg}`}>
        {/* Modal Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3 ${statBoxBg}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl sm:text-2xl shrink-0">{act.emoji}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-sm sm:text-base uppercase tracking-wider truncate">
                  {analysis.name}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded-full shrink-0">
                  {act.label}
                </span>
              </div>
              <p className={`text-xs font-mono truncate ${subText}`}>
                Full Telemetry &amp; Raw GPS Diagnostic Specifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(generateRideSummary(), 'summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                copiedSummary
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-[#1c2633] border-[#2a3a4d] text-slate-300 hover:text-white'
              }`}
              title="Copy complete ride telemetry markdown to clipboard"
            >
              {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isLight ? 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100' : 'bg-[#1c2633] border-[#2a3a4d] text-[#8f9ca8] hover:text-white'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`px-5 pt-3 border-b flex items-center gap-2 ${statBoxBg}`}>
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'specs'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('segments')}
            className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'segments'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Segments &amp; Splits ({analysis.segments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'export'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share &amp; Export</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs font-mono">
          {/* TAB 1: TELEMETRY SPECS */}
          {activeTab === 'specs' && (
            <div className="space-y-6">
              {/* Primary Metric Grid */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Distance &amp; Time Efficiency
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Total Distance</span>
                    <strong className="text-base sm:text-lg font-black text-sky-400">
                      {analysis.totalDistanceKm.toFixed(2)} <span className="text-[10px]">KM</span>
                    </strong>
                    {analysis.userDistanceOverrideKm && (
                      <span className="text-[10px] text-emerald-400 block mt-0.5">
                        Odo: {analysis.userDistanceOverrideKm} km
                      </span>
                    )}
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Elapsed Time</span>
                    <strong className="text-base sm:text-lg font-black">
                      {formatDuration(analysis.totalDurationSeconds)}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>
                      Includes halts
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-emerald-500`}>Moving Saddle</span>
                    <strong className="text-base sm:text-lg font-black text-emerald-400">
                      {formatDuration(analysis.movingTimeSeconds)}
                    </strong>
                    <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
                      {movingPct}% in motion
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-amber-500`}>Stopped Breaks</span>
                    <strong className="text-base sm:text-lg font-black text-amber-400">
                      {formatDuration(analysis.stoppedTimeSeconds)}
                    </strong>
                    <span className="text-[10px] text-amber-400 block mt-0.5 font-bold">
                      {stoppedPct}% stopped ({analysis.pitStops.length} breaks)
                    </span>
                  </div>
                </div>
              </div>

              {/* Speed & Velocity Matrix */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Speed &amp; Velocity Matrix
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-rose-500`}>Peak Velocity</span>
                    <strong className="text-base sm:text-lg font-black text-rose-400">
                      {analysis.maxSpeedKmh.toFixed(1)} <span className="text-[10px]">km/h</span>
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Top burst record</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-emerald-500`}>Moving Average</span>
                    <strong className="text-base sm:text-lg font-black text-emerald-400">
                      {analysis.movingAvgSpeedKmh.toFixed(1)} <span className="text-[10px]">km/h</span>
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Excluding halts</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Overall Elapsed Avg</span>
                    <strong className="text-base sm:text-lg font-black">
                      {analysis.overallAvgSpeedKmh.toFixed(1)} <span className="text-[10px]">km/h</span>
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Including pit-stops</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-cyan-500`}>Max Lean Roll</span>
                    <strong className="text-base sm:text-lg font-black text-cyan-400">
                      {analysis.maxEstimatedLean > 0 ? `${analysis.maxEstimatedLean}°` : '—'}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Cornering apex</span>
                  </div>
                </div>
              </div>

              {/* Elevation & Terrain */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Elevation &amp; Altitude Profile
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase text-indigo-500`}>Elevation Gain</span>
                    <strong className="text-base sm:text-lg font-black text-indigo-400">
                      +{analysis.elevGainM.toFixed(0)} <span className="text-[10px]">M</span>
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Ascent total</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Elevation Loss</span>
                    <strong className="text-base sm:text-lg font-black">
                      −{analysis.elevLossM.toFixed(0)} <span className="text-[10px]">M</span>
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Descent total</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Elevation Range</span>
                    <strong className="text-sm sm:text-base font-bold">
                      {analysis.elevMinM !== null ? `${analysis.elevMinM.toFixed(0)}m` : '0m'} – {analysis.elevMaxM !== null ? `${analysis.elevMaxM.toFixed(0)}m` : '—'}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Min to max alt</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Net Altitude Δ</span>
                    <strong className="text-sm sm:text-base font-bold">
                      {netElevationDelta !== '—' ? `${Number(netElevationDelta) >= 0 ? '+' : ''}${netElevationDelta} m` : '—'}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>
                      Start {analysis.elevStartM !== null ? `${analysis.elevStartM.toFixed(0)}m` : '—'} → End {analysis.elevEndM !== null ? `${analysis.elevEndM.toFixed(0)}m` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Dates & GPS Coordinates */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Timestamps &amp; GPS Coordinates (From GPX Header)
                </h4>
                <div className={`rounded-xl border divide-y ${statBoxBg} ${tableBorder}`}>
                  {/* Start Timestamp */}
                  <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className={`font-medium ${subText}`}>Start Date &amp; Time:</span>
                    <span className="font-bold text-slate-100">{formatDetailedTime(analysis.startTime)}</span>
                  </div>

                  {/* End Timestamp */}
                  <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className={`font-medium ${subText}`}>Finish Date &amp; Time:</span>
                    <span className="font-bold text-slate-100">{formatDetailedTime(analysis.endTime)}</span>
                  </div>

                  {/* Start Coords */}
                  <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className={`font-medium ${subText}`}>Start GPS Coordinates:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400">{startCoordStr}</span>
                      {startPt && (
                        <button
                          onClick={() => handleCopy(startCoordStr, 'start')}
                          className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 cursor-pointer ${
                            copiedCoords === 'start' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold' : statBoxBg
                          }`}
                          title="Copy Start Latitude & Longitude"
                        >
                          {copiedCoords === 'start' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCoords === 'start' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* End Coords */}
                  <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className={`font-medium ${subText}`}>Finish GPS Coordinates:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-400">{endCoordStr}</span>
                      {endPt && (
                        <button
                          onClick={() => handleCopy(endCoordStr, 'end')}
                          className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 cursor-pointer ${
                            copiedCoords === 'end' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold' : statBoxBg
                          }`}
                          title="Copy Finish Latitude & Longitude"
                        >
                          {copiedCoords === 'end' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCoords === 'end' ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bounding Box */}
                  {analysis.boundingBox && (
                    <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className={`font-medium ${subText}`}>Bounding Box (N / S / E / W):</span>
                      <span className="text-[11px] text-slate-300">
                        {analysis.boundingBox.maxLat.toFixed(4)}° N, {analysis.boundingBox.minLat.toFixed(4)}° S • {analysis.boundingBox.maxLon.toFixed(4)}° E, {analysis.boundingBox.minLon.toFixed(4)}° W
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hardware & GPS Signal Health */}
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Hardware &amp; GPS Signal Health
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Total GPS Fixes</span>
                    <strong className="text-base font-bold text-sky-400">{totalFixes.toLocaleString()}</strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>{analysis.segments.length} raw track segments</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>Sampling Interval</span>
                    <strong className="text-base font-bold">{avgSamplingIntervalSec} sec/fix</strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>Avg ~{avgSpatialResolutionMeters}m between fixes</span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>GPS Satellites</span>
                    <strong className="text-base font-bold text-emerald-400">
                      {analysis.avgSatellites ? `${analysis.avgSatellites} avg` : 'Lock OK'}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>
                      {analysis.maxSatellites ? `Peak: ${analysis.maxSatellites} sats` : 'Standard GPS fix'}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border ${statBoxBg}`}>
                    <span className={`text-[10px] block uppercase ${subText}`}>HDOP Precision</span>
                    <strong className="text-base font-bold text-sky-400">
                      {analysis.bestHdop ? `${analysis.bestHdop.toFixed(1)} HDOP` : 'High'}
                    </strong>
                    <span className={`text-[10px] block mt-0.5 ${subText}`}>
                      {analysis.bestHdop && analysis.bestHdop < 1.2 ? 'Sub-meter grade' : 'Good accuracy'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEGMENTS & SPLITS TABLE */}
          {activeTab === 'segments' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-700/30">
                <div className="flex items-center gap-1">
                  <span className={`${subText} mr-1`}>Filter:</span>
                  {(['all', 'moving', 'stopped'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSegmentFilter(mode)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold capitalize cursor-pointer transition-colors ${
                        segmentFilter === mode
                          ? 'bg-sky-500 text-slate-950 shadow-xs'
                          : statBoxBg
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${statBoxBg}`}
                  >
                    <Download className="w-3 h-3 text-sky-400" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/40">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className={`border-b border-slate-700/60 ${statBoxBg} text-[10px] uppercase ${subText}`}>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Distance</th>
                      <th className="p-2.5">Duration</th>
                      <th className="p-2.5">Moving Time</th>
                      <th className="p-2.5">Avg Speed</th>
                      <th className="p-2.5">Max Speed</th>
                      <th className="p-2.5">Elev Δ</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSegments.map((s, idx) => {
                      const isStopped = s.avgSpeedKmh <= 2.5 || s.movingTimeSeconds === 0;
                      const isSlow = !isStopped && s.avgSpeedKmh < 20;
                      const statusColor = isStopped
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : isSlow
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                      const statusLabel = isStopped ? 'Stopped' : isSlow ? 'Slow' : 'Moving';
                      const firstPt = s.points[0];

                      return (
                        <tr 
                          key={s.index || idx}
                          className={`hover:bg-slate-800/30 transition-colors ${
                            idx % 2 === 0 ? '' : 'bg-slate-900/20'
                          }`}
                        >
                          <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold">
                            {s.distanceKm >= 1 ? `${s.distanceKm.toFixed(2)} km` : `${Math.round(s.distanceKm * 1000)} m`}
                          </td>
                          <td className="p-2.5 text-slate-300">{formatDuration(s.durationSeconds)}</td>
                          <td className="p-2.5 text-slate-300">{formatDuration(s.movingTimeSeconds)}</td>
                          <td className="p-2.5 font-bold text-sky-400">{s.avgSpeedKmh.toFixed(1)} km/h</td>
                          <td className="p-2.5 text-slate-400">{s.maxSpeedKmh.toFixed(1)} km/h</td>
                          <td className="p-2.5">
                            <span className={s.elevGain >= s.elevLoss ? 'text-indigo-400' : 'text-slate-400'}>
                              {s.elevGain >= s.elevLoss ? `+${s.elevGain.toFixed(0)}m` : `−${s.elevLoss.toFixed(0)}m`}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            {firstPt && (
                              <button
                                onClick={() => {
                                  onSelectCoordinate?.(firstPt.lat, firstPt.lon, `Segment #${idx + 1}`);
                                  const globalIdx = analysis.points.findIndex(p => p.lat === firstPt.lat && p.lon === firstPt.lon);
                                  if (globalIdx >= 0 && onScrubToIndex) onScrubToIndex(globalIdx);
                                  onClose();
                                }}
                                className="px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-[10px] cursor-pointer inline-flex items-center gap-1"
                                title="Locate & scrub map to this segment"
                              >
                                <span>Locate</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SHARE & EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Formatted Ride Report (WhatsApp / Strava / Instagram)
                </h4>
                <div className={`p-4 rounded-xl border relative font-mono text-xs whitespace-pre-wrap leading-relaxed ${statBoxBg}`}>
                  {generateRideSummary()}
                  <div className="mt-3 pt-3 border-t border-slate-700/40 flex justify-end">
                    <button
                      onClick={() => handleCopy(generateRideSummary(), 'summary')}
                      className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSummary ? 'Copied to Clipboard!' : 'Copy Formatted Text'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2.5 ${subText}`}>
                  Export Data Formats
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-4 rounded-xl border space-y-2.5 ${statBoxBg}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      <span>Standard GPX File</span>
                    </div>
                    <p className={`text-xs ${subText}`}>
                      Export standard XML GPX track format with updated pit-stop waypoints and telemetry tags.
                    </p>
                    <button
                      onClick={handleExportGPX}
                      className="w-full py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .GPX</span>
                    </button>
                  </div>

                  <div className={`p-4 rounded-xl border space-y-2.5 ${statBoxBg}`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                      <span>CSV Segments &amp; Splits</span>
                    </div>
                    <p className={`text-xs ${subText}`}>
                      Export tabular spreadsheet of every segment, distance, duration, elevation delta, and speed.
                    </p>
                    <button
                      onClick={handleExportCSV}
                      className="w-full py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/40 font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

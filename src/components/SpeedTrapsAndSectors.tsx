import React, { useState } from 'react';
import { RideAnalysis, PitStop, AppTheme, UnitSystem } from '../types';
import { formatDurationSummary } from '../utils/units';
import { 
  Zap, 
  Download, 
  MapPin, 
  Milestone, 
  Layers 
} from 'lucide-react';
import { downloadFile, exportAnalysisToGPX } from '../utils/gpxExporter';

interface SpeedTrapsAndSectorsProps {
  analysis: RideAnalysis;
  onSelectCoordinate?: (lat: number, lon: number, label?: string) => void;
  onOpenAddStop?: () => void;
  onEditStop?: (stop: PitStop) => void;
  onDeleteStop?: (stopId: string) => void;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
}

export const SpeedTrapsAndSectors: React.FC<SpeedTrapsAndSectorsProps> = ({
  analysis,
  onSelectCoordinate,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [columnMode, setColumnMode] = useState<'sections' | 'splits'>('splits');

  const formatSec = (sec: number) => {
    if (!sec || isNaN(sec)) return '—';
    if (sec < 60) return `${Math.round(sec)}s`;
    return formatDurationSummary(sec);
  };

  const handleExportGPX = () => {
    const gpxStr = exportAnalysisToGPX(analysis);
    downloadFile(gpxStr, `${analysis.name.toLowerCase().replace(/\s+/g, '_')}_cleaned.gpx`, 'application/gpx+xml');
  };

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-[#141d26] border-[#223140] hover:bg-[#1a2530]';
  const subText = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const borderTone = isLight ? 'border-slate-200' : 'border-[#1e2a38]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 telemetry-num">
      {/* 1. Peak Speed Zones */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-colors ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-rose-500" />
              <span>Speed Traps &amp; Peaks</span>
            </h3>
            <span className={`text-[10px] font-mono border px-2 py-0.5 rounded font-bold ${
              isLight ? 'text-rose-700 border-rose-300 bg-rose-50' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
            }`}>
              TOP {analysis.speedTraps.length}
            </span>
          </div>

          <div className="space-y-1.5 font-mono max-h-[240px] overflow-y-auto pr-1">
            {analysis.speedTraps.length > 0 ? (
              analysis.speedTraps.map((trap, idx) => {
                const isTop = idx === 0;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectCoordinate?.(trap.lat, trap.lon, `Speed Trap ${trap.position}: ${trap.speedKmh.toFixed(1)} km/h`);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer group ${
                      isTop
                        ? isLight ? 'border-rose-300 bg-rose-50/70 hover:bg-rose-100/70' : 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20'
                        : itemBg
                    }`}
                    title="Click to center on map"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center font-black text-xs ${
                          isTop
                            ? 'bg-rose-500 text-slate-950 shadow-sm'
                            : isLight ? 'bg-slate-200 text-slate-700' : 'bg-[#1e2a38] text-slate-300'
                        }`}
                      >
                        {trap.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">
                            {trap.speedKmh.toFixed(1)} km/h
                          </span>
                          <span className={`text-[10px] ${isTop ? (isLight ? 'text-rose-700 font-bold' : 'text-rose-400 font-bold') : subText}`}>
                            {trap.deltaLabel}
                          </span>
                        </div>
                        <div className={`text-[10px] font-sans ${subText}`}>
                          {trap.distanceKm.toFixed(1)} km mark • {trap.time ? new Date(trap.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Track'}
                        </div>
                      </div>
                    </div>

                    <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" />
                  </button>
                );
              })
            ) : (
              <div className={`text-xs ${subText} py-4 text-center`}>
                Top speed: {analysis.maxSpeedKmh.toFixed(1)} km/h
              </div>
            )}
          </div>
        </div>

        <div className={`mt-3 pt-2 border-t ${borderTone} flex items-center justify-between text-[11px] font-sans ${subText}`}>
          <span>Maximum velocity:</span>
          <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {analysis.maxSpeedKmh.toFixed(1)} km/h
          </strong>
        </div>
      </div>

      {/* 2. Strava Splits / Ride Sections */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-colors ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-slate-800'}`}>
              <button
                type="button"
                onClick={() => setColumnMode('splits')}
                className={`px-2 py-1 rounded text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                  columnMode === 'splits'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                <Milestone className="w-3 h-3" />
                <span>Splits</span>
              </button>
              <button
                type="button"
                onClick={() => setColumnMode('sections')}
                className={`px-2 py-1 rounded text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                  columnMode === 'sections'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Sections</span>
              </button>
            </div>

            <span className={`text-[10px] font-mono border px-2 py-0.5 rounded font-bold ${
              isLight ? 'text-sky-700 border-sky-300 bg-sky-50' : 'text-sky-400 border-sky-500/30 bg-sky-500/10'
            }`}>
              {columnMode === 'splits' ? `${analysis.splits?.length || 0} SPLITS` : `${analysis.segments.length} SECTIONS`}
            </span>
          </div>

          {columnMode === 'splits' && analysis.splits && analysis.splits.length > 0 ? (
            <div className="space-y-1.5 font-mono max-h-[215px] overflow-y-auto pr-1 text-xs">
              {analysis.splits.map((split, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border flex items-center justify-between hover:border-sky-400/50 transition-colors ${itemBg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded font-bold text-[10px] flex items-center justify-center ${
                      isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-500/20 text-sky-400'
                    }`}>
                      {split.splitIndex}
                    </span>
                    <div>
                      <div className={`font-bold text-xs font-sans ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {split.label}
                      </div>
                      <div className={`text-[10px] font-sans ${subText}`}>
                        {formatSec(split.movingTimeSeconds)} moving
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className={`font-bold text-xs ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                      {split.avgSpeedKmh.toFixed(1)} km/h
                    </div>
                    <div className={`text-[10px] ${subText}`}>
                      +{split.elevGainM}m gain
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5 font-mono max-h-[215px] overflow-y-auto pr-1 text-xs">
              {analysis.segments.map((seg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-center justify-between hover:border-sky-400/50 transition-colors ${itemBg}`}
                >
                  <div>
                    <span className={`font-bold text-xs font-sans ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Section #{idx + 1}
                    </span>
                    <div className={`text-[10px] font-sans ${subText}`}>
                      {seg.distanceKm.toFixed(1)} km • {seg.points.length} GPS fixes
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className={`font-bold text-xs ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                      Max {seg.maxSpeedKmh.toFixed(1)} km/h
                    </div>
                    <div className={`text-[10px] ${subText}`}>
                      +{seg.elevGain.toFixed(0)}m / -{seg.elevLoss.toFixed(0)}m
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clean GPX Download */}
        <div className={`mt-3 pt-2 border-t ${borderTone}`}>
          <button
            type="button"
            onClick={handleExportGPX}
            className={`w-full py-2 border rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-sans ${
              isLight 
                ? 'bg-slate-100 hover:bg-sky-600 hover:text-white text-sky-700 border-slate-300' 
                : 'bg-[#131b24] hover:bg-sky-500 hover:text-slate-950 text-sky-400 border-[#1e2a38]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Clean GPX File</span>
          </button>
        </div>
      </div>
    </div>
  );
};

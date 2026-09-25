import React, { useState, useMemo } from 'react';
import { RideAnalysis, PitStop, SpeedTrap, AppTheme, UnitSystem } from '../types';
import { convertSpeed, convertDistance } from '../utils/units';
import { 
  Zap, 
  Coffee, 
  Fuel, 
  Utensils, 
  Camera, 
  Wrench, 
  Flag, 
  Download, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  Trash2, 
  MapPin, 
  Filter, 
  Clock, 
  Compass, 
  Milestone, 
  ArrowRight, 
  TrendingUp, 
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
  onOpenAddStop,
  onEditStop,
  onDeleteStop,
  theme = 'dark',
  unitSystem = 'metric',
}) => {
  const isLight = theme === 'light';
  // Stop duration filter: 300 = 5 mins, 600 = 10 mins, 180 = 3 mins, 0 = all
  const [minDurationFilter, setMinDurationFilter] = useState<number>(300);
  // View mode in column 3: 'sections' vs 'splits' (Strava style)
  const [column3Mode, setColumn3Mode] = useState<'sections' | 'splits'>('splits');

  const formatSec = (sec: number) => {
    if (!sec || isNaN(sec)) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const formatTimeRange = (startIso: string | null, durationSec: number) => {
    if (!startIso) return null;
    try {
      const dStart = new Date(startIso);
      const dEnd = new Date(dStart.getTime() + durationSec * 1000);
      const timeStart = dStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const timeEnd = dEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${timeStart} → ${timeEnd}`;
    } catch {
      return null;
    }
  };

  const getPitIcon = (cat: PitStop['category']) => {
    switch (cat) {
      case 'chai':
        return <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'fuel':
        return <Fuel className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'dhaba':
        return <Utensils className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'scenic':
        return <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'mechanic':
        return <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'traffic':
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
  };

  const getStopTypeBadge = (pit: PitStop) => {
    const mins = Math.round(pit.durationSeconds / 60);
    if (pit.category === 'traffic' || mins < 4) {
      return { label: 'Traffic / Signal Delay', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    }
    if (mins >= 30) {
      return { label: 'Meal / Major Halt', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    }
    if (mins >= 12) {
      return { label: 'Pit Stop / Chai', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
    return { label: 'Quick Pause', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  };

  // Filter stops according to user's minimum duration setting
  const filteredStops = useMemo(() => {
    return (analysis.pitStops || []).filter(stop => {
      if (minDurationFilter === 0) return true;
      return stop.durationSeconds >= minDurationFilter;
    });
  }, [analysis.pitStops, minDurationFilter]);

  const hiddenTrafficCount = (analysis.pitStops || []).length - filteredStops.length;

  const handleExportGPX = () => {
    const gpxStr = exportAnalysisToGPX(analysis);
    downloadFile(gpxStr, `${analysis.name.toLowerCase().replace(/\s+/g, '_')}_cleaned.gpx`, 'application/gpx+xml');
  };

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-[#141d26] border-[#223140] hover:bg-[#1a2530]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const borderTone = isLight ? 'border-slate-200' : 'border-[#1e2a38]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Peak Speed Zones */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-colors ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-rose-500" />
              <span>Speed Traps & Peaks</span>
            </h3>
            <span className="text-[10px] font-mono text-rose-500 border border-rose-500/30 px-2 py-0.5 rounded bg-rose-500/10 font-bold">
              TOP {analysis.speedTraps.length}
            </span>
          </div>

          <div className="space-y-1.5 font-mono max-h-[220px] overflow-y-auto pr-1">
            {analysis.speedTraps.length > 0 ? (
              analysis.speedTraps.map((trap, idx) => {
                const isTop = idx === 0;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      const spd = convertSpeed(trap.speedKmh, unitSystem);
                      onSelectCoordinate?.(trap.lat, trap.lon, `Speed Trap ${trap.position}: ${spd.value} ${spd.unit}`);
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer group ${
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
                            {convertSpeed(trap.speedKmh, unitSystem).value.toFixed(1)} {convertSpeed(trap.speedKmh, unitSystem).unit}
                          </span>
                          <span className={`text-[10px] ${isTop ? 'text-rose-400 font-bold' : subText}`}>
                            {trap.deltaLabel}
                          </span>
                        </div>
                        <div className={`text-[10px] ${subText}`}>
                          {convertDistance(trap.distanceKm, unitSystem).unit} {convertDistance(trap.distanceKm, unitSystem).value.toFixed(1)} • {trap.time ? new Date(trap.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Track'}
                        </div>
                      </div>
                    </div>

                    <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400 transition-colors" />
                  </div>
                );
              })
            ) : (
              <div className={`text-xs ${subText} py-4 text-center`}>
                Top speed: {analysis.maxSpeedKmh.toFixed(1)} km/h
              </div>
            )}
          </div>
        </div>

        <div className={`mt-3 pt-2 border-t ${borderTone} flex items-center justify-between text-[11px] ${subText}`}>
          <span>Maximum velocity:</span>
          <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {analysis.maxSpeedKmh.toFixed(1)} km/h
          </strong>
        </div>
      </div>

      {/* 2. Stops & Breaks with Timing & Map Click */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-colors ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-500" />
              <span>Stops & Breaks</span>
            </h3>
            
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded bg-amber-500/10 font-bold">
                {filteredStops.length} STOPS
              </span>
              {onOpenAddStop && (
                <button
                  onClick={onOpenAddStop}
                  title="Log a new stop"
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Log Stop</span>
                </button>
              )}
            </div>
          </div>

          {/* User Stop Duration Filter Selector */}
          <div className={`flex items-center gap-1 text-[10px] font-mono mb-2.5 pb-2 border-b ${borderTone} overflow-x-auto`}>
            <span className={`${subText} flex items-center gap-0.5 mr-1`}>
              <Filter className="w-2.5 h-2.5" /> Min:
            </span>
            {[
              { label: '≥ 5m (Default)', val: 300 },
              { label: '≥ 10m', val: 600 },
              { label: '≥ 3m', val: 180 },
              { label: 'All Stops', val: 0 },
            ].map(f => (
              <button
                key={f.val}
                onClick={() => setMinDurationFilter(f.val)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer whitespace-nowrap ${
                  minDurationFilter === f.val 
                    ? 'bg-amber-500 text-slate-950 font-bold' 
                    : isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-[#141d26] text-[#8f9ca8] hover:text-white border border-[#223140]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {hiddenTrafficCount > 0 && (
            <div className={`text-[10px] font-mono mb-2 px-2 py-1 rounded border ${isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#141d26] border-[#223140] text-[#8f9ca8]'}`}>
              ℹ️ Hidden {hiddenTrafficCount} short traffic/signal delay{hiddenTrafficCount > 1 ? 's' : ''} (&lt;{Math.round(minDurationFilter / 60)}m).
            </div>
          )}

          <div className="space-y-2 font-mono max-h-[200px] overflow-y-auto pr-1">
            {filteredStops.length > 0 ? (
              filteredStops.map((pit, idx) => {
                const timeRange = formatTimeRange(pit.startTime, pit.durationSeconds);
                const badge = getStopTypeBadge(pit);

                return (
                  <div
                    key={pit.id || idx}
                    onClick={() => onSelectCoordinate?.(pit.lat, pit.lon, `Stop: ${pit.name}`)}
                    className={`p-2.5 rounded-lg border hover:border-amber-400 transition-all group cursor-pointer ${itemBg}`}
                    title="Click to view and zoom on map"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={`flex items-center gap-1.5 font-bold truncate max-w-[170px] ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {getPitIcon(pit.category)}
                        <span className="truncate group-hover:text-amber-400 transition-colors">{pit.name}</span>
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-500 font-mono font-bold text-[11px] bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          {Math.round(pit.durationSeconds / 60)} min
                        </span>

                        {/* Edit Button */}
                        {onEditStop && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditStop(pit);
                            }}
                            title="Edit this stop"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLight ? 'text-slate-400 hover:text-amber-600 hover:bg-slate-200' : 'text-[#8f9ca8] hover:text-amber-400 hover:bg-[#1a2530]'
                            }`}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {onDeleteStop && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remove stop "${pit.name}"?`)) {
                                onDeleteStop(pit.id);
                              }
                            }}
                            title="Delete this stop"
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              isLight ? 'text-slate-400 hover:text-rose-600 hover:bg-slate-200' : 'text-[#8f9ca8] hover:text-rose-400 hover:bg-[#1a2530]'
                            }`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timing & Badge line */}
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      {timeRange ? (
                        <span className="flex items-center gap-1 font-mono text-sky-400 font-bold">
                          <Clock className="w-3 h-3 text-sky-400" />
                          {timeRange}
                        </span>
                      ) : (
                        <span className={subText}>Logged Pit Stop</span>
                      )}

                      <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Location & Click hint */}
                    <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${borderTone} ${subText}`}>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" />
                        km {pit.distanceKm.toFixed(1)} into ride
                      </span>
                      <span className="text-[9px] text-amber-400/80 group-hover:text-amber-400 font-bold">
                        Locate on map ↗
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={`text-xs ${subText} py-4 text-center space-y-2`}>
                <p>No stops longer than {Math.round(minDurationFilter / 60)} minutes found.</p>
                {onOpenAddStop && (
                  <button
                    onClick={onOpenAddStop}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Click to Log a Stop</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`mt-3 pt-2 border-t ${borderTone} flex items-center justify-between text-[11px] ${subText}`}>
          <span>Total Break Time:</span>
          <strong className="text-amber-500 font-mono">{formatSec(analysis.stoppedTimeSeconds)}</strong>
        </div>
      </div>

      {/* 3. Strava Splits / Ride Sections */}
      <div className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between shadow-lg transition-colors ${cardBg}`}>
        <div>
          <div className="flex items-center justify-between mb-2.5">
            {/* Toggle between Strava Splits and GPX Track Sections */}
            <div className={`flex items-center gap-1 p-0.5 rounded-lg border ${isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/20 border-slate-800'}`}>
              <button
                onClick={() => setColumn3Mode('splits')}
                className={`px-2 py-1 rounded text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                  column3Mode === 'splits'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                <Milestone className="w-3 h-3" />
                <span>Splits</span>
              </button>
              <button
                onClick={() => setColumn3Mode('sections')}
                className={`px-2 py-1 rounded text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                  column3Mode === 'sections'
                    ? 'bg-sky-500 text-slate-950 shadow-sm'
                    : subText
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Sections</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-sky-500 border border-sky-500/30 px-2 py-0.5 rounded bg-sky-500/10 font-bold">
              {column3Mode === 'splits' ? `${analysis.splits?.length || 0} SPLITS` : `${analysis.segments.length} SECTIONS`}
            </span>
          </div>

          {column3Mode === 'splits' && analysis.splits && analysis.splits.length > 0 ? (
            <div className="space-y-1.5 font-mono max-h-[195px] overflow-y-auto pr-1 text-xs">
              {analysis.splits.map((split, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border flex items-center justify-between hover:border-sky-400/50 transition-colors ${itemBg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-sky-500/20 text-sky-400 font-bold text-[10px] flex items-center justify-center">
                      {split.splitIndex}
                    </span>
                    <div>
                      <div className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {split.label}
                      </div>
                      <div className={`text-[10px] ${subText}`}>
                        {formatSec(split.movingTimeSeconds)} moving
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-sky-400 font-bold text-xs">
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
            <div className="space-y-1.5 font-mono max-h-[195px] overflow-y-auto pr-1 text-xs">
              {analysis.segments.map((seg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-center justify-between hover:border-sky-400/50 transition-colors ${itemBg}`}
                >
                  <div>
                    <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Section #{idx + 1}
                    </span>
                    <div className={`text-[10px] ${subText}`}>
                      {seg.distanceKm.toFixed(1)} km • {seg.points.length} GPS fixes
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-sky-500 font-bold text-xs">
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
            onClick={handleExportGPX}
            className={`w-full py-2 border rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer font-mono ${
              isLight 
                ? 'bg-slate-100 hover:bg-sky-500 hover:text-white text-sky-600 border-slate-300' 
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

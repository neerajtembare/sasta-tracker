import React from 'react';
import { RideAnalysis, PitStop, AppTheme } from '../types';
import { 
  Coffee, 
  Fuel, 
  Utensils, 
  Camera, 
  Wrench, 
  AlertTriangle, 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  Clock, 
  Navigation, 
  Flag, 
  Sparkles,
  Milestone
} from 'lucide-react';

interface JourneyTimelineProps {
  analysis: RideAnalysis;
  onSelectCoordinate?: (lat: number, lon: number, label?: string) => void;
  onOpenAddStop?: () => void;
  onEditStop?: (stop: PitStop) => void;
  onDeleteStop?: (stopId: string) => void;
  theme?: AppTheme;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  analysis,
  onSelectCoordinate,
  onOpenAddStop,
  onEditStop,
  onDeleteStop,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const formatSec = (sec: number) => {
    if (!sec || isNaN(sec)) return '—';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m < 60) return `${m}m ${s > 0 ? `${s}s` : ''}`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  const getPitIcon = (cat: PitStop['category']) => {
    switch (cat) {
      case 'chai':
        return <Coffee className="w-4 h-4 text-amber-400" />;
      case 'fuel':
        return <Fuel className="w-4 h-4 text-sky-400" />;
      case 'dhaba':
        return <Utensils className="w-4 h-4 text-rose-400" />;
      case 'scenic':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      case 'mechanic':
        return <Wrench className="w-4 h-4 text-amber-500" />;
      case 'traffic':
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
      default:
        return <MapPin className="w-4 h-4 text-amber-400" />;
    }
  };

  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-xl';
  const itemBg = isLight ? 'bg-slate-50 border-slate-200 hover:bg-sky-50/50' : 'bg-[#131b24] border-[#1e2a38] hover:bg-[#1a2533]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const borderTone = isLight ? 'border-slate-200' : 'border-[#1e2a38]';

  const startTimeStr = analysis.startTime
    ? new Date(analysis.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '06:00 AM';

  const endTimeStr = analysis.endTime
    ? new Date(analysis.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '01:00 PM';

  const sortedStops = [...(analysis.pitStops || [])].sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <div className={`rounded-2xl border p-4 sm:p-6 space-y-5 transition-colors ${cardBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-black text-sm uppercase tracking-wider">
              Road Journey & Pit-Stop Timeline
            </h3>
            <p className={`text-[11px] font-mono ${subText}`}>
              Chai halts, fuel stops, and rest breaks along the route
            </p>
          </div>
        </div>

        {onOpenAddStop && (
          <button
            onClick={onOpenAddStop}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pit-Stop</span>
          </button>
        )}
      </div>

      {/* Journey Stats Bar */}
      <div className={`grid grid-cols-3 gap-2.5 p-3 rounded-xl border text-center font-mono text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090d12] border-[#1e2a38]'}`}>
        <div>
          <div className={`text-[10px] uppercase ${subText}`}>TOTAL DISTANCE</div>
          <div className="font-bold text-sky-400 text-sm mt-0.5">{analysis.totalDistanceKm.toFixed(1)} km</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase ${subText}`}>BREAK TIME</div>
          <div className="font-bold text-amber-400 text-sm mt-0.5">{formatSec(analysis.stoppedTimeSeconds)}</div>
        </div>
        <div>
          <div className={`text-[10px] uppercase ${subText}`}>TOTAL HALTS</div>
          <div className="font-bold text-emerald-400 text-sm mt-0.5">{sortedStops.length} stops</div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-amber-500 before:to-rose-500">
        {/* Departure Point */}
        <div className="relative">
          <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-400">
            🟢
          </div>
          <div className={`p-3 rounded-xl border flex items-center justify-between ${itemBg}`}>
            <div>
              <span className="font-mono font-bold text-xs text-emerald-400">
                DEPARTURE • 0.0 KM
              </span>
              <div className={`text-[11px] font-mono mt-0.5 ${subText}`}>
                Wheels rolling at {startTimeStr}
              </div>
            </div>
            {onSelectCoordinate && analysis.points?.[0] && (
              <button
                onClick={() => onSelectCoordinate(analysis.points[0].lat, analysis.points[0].lon, 'Start Point')}
                className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                  isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#0d131a] hover:bg-[#1f2c3a] border-[#223140] text-slate-300'
                }`}
                title="Locate start on map"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
        </div>

        {/* Pit Stops Along the Route */}
        {sortedStops.length > 0 ? (
          sortedStops.map((pit, idx) => (
            <div key={pit.id} className="relative">
              <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-[#0d131a] border-2 border-amber-500 flex items-center justify-center z-10 shadow-sm">
                {getPitIcon(pit.category)}
              </div>

              <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${itemBg}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-xs">
                      {pit.name}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded uppercase">
                      {formatSec(pit.durationSeconds)} HALT
                    </span>
                  </div>

                  <div className={`text-[11px] font-mono flex items-center gap-2 ${subText}`}>
                    <span>📍 {pit.distanceKm.toFixed(1)} km</span>
                    <span>•</span>
                    <span>Elevation: {pit.ele !== null && pit.ele !== undefined ? `${pit.ele.toFixed(0)}m` : '—'}</span>
                  </div>

                  {pit.notes && (
                    <p className={`text-[11px] italic font-sans ${subText}`}>
                      "{pit.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {onSelectCoordinate && (
                    <button
                      onClick={() => onSelectCoordinate(pit.lat, pit.lon, pit.name)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-sky-700' : 'bg-[#0d131a] hover:bg-[#1f2c3a] border-sky-500/30 text-sky-400'
                      }`}
                      title="Fly to this halt on map"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Fly to Map</span>
                    </button>
                  )}

                  {onEditStop && (
                    <button
                      onClick={() => onEditStop(pit)}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white border-[#223140]'
                      }`}
                      title="Edit stop"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {onDeleteStop && (
                    <button
                      onClick={() => onDeleteStop(pit.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                      title="Delete stop"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={`p-4 border border-dashed rounded-xl text-center font-mono text-xs ${subText}`}>
            No pit stops recorded yet. Continuous ride without stops detected.
          </div>
        )}

        {/* Arrival Point */}
        <div className="relative">
          <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-[10px] font-bold text-rose-400">
            🏁
          </div>
          <div className={`p-3 rounded-xl border flex items-center justify-between ${itemBg}`}>
            <div>
              <span className="font-mono font-bold text-xs text-rose-400">
                FINISH • {analysis.totalDistanceKm.toFixed(1)} KM
              </span>
              <div className={`text-[11px] font-mono mt-0.5 ${subText}`}>
                Ride concluded at {endTimeStr}
              </div>
            </div>
            {onSelectCoordinate && analysis.points?.[analysis.points.length - 1] && (
              <button
                onClick={() => onSelectCoordinate(
                  analysis.points[analysis.points.length - 1].lat,
                  analysis.points[analysis.points.length - 1].lon,
                  'Finish Line'
                )}
                className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors ${
                  isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-[#0d131a] hover:bg-[#1f2c3a] border-[#223140] text-slate-300'
                }`}
                title="Locate finish on map"
              >
                <Navigation className="w-3.5 h-3.5 text-rose-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { RideAnalysis, AppTheme, TrackPoint } from '../types';
import { parseGPX } from '../utils/gpxParser';
import { getGarageRides } from '../utils/storage';
import { formatDurationSummary } from '../utils/units';
import {
  SAMPLE_GPX_DATA,
  SAMPLE_GPX_NAME
} from '../data/sampleRide';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Clock,
  Navigation,
  TrendingUp,
  Gauge
} from 'lucide-react';

interface TrackComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAnalysis?: RideAnalysis | null;
  theme?: AppTheme;
}

interface SelectableRideOption {
  id: string;
  name: string;
  gpxContent: string;
  source: 'active' | 'garage' | 'sample';
}

export const TrackComparisonModal: React.FC<TrackComparisonModalProps> = ({
  isOpen,
  onClose,
  currentAnalysis,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const polyline1Ref = useRef<L.Polyline | null>(null);
  const polyline2Ref = useRef<L.Polyline | null>(null);
  const marker1Ref = useRef<L.Marker | null>(null);
  const marker2Ref = useRef<L.Marker | null>(null);

  // Available rides catalog
  const [availableRides, setAvailableRides] = useState<SelectableRideOption[]>([]);
  const [selectedRide1Id, setSelectedRide1Id] = useState<string>('');
  const [selectedRide2Id, setSelectedRide2Id] = useState<string>('');

  const [analysis1, setAnalysis1] = useState<RideAnalysis | null>(null);
  const [analysis2, setAnalysis2] = useState<RideAnalysis | null>(null);

  // Scrubber percentage (0 to 100)
  const [scrubPercent, setScrubPercent] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // Populate selectable rides on open
  useEffect(() => {
    if (!isOpen) return;

    const list: SelectableRideOption[] = [];

    if (currentAnalysis) {
      list.push({
        id: 'active-ride',
        name: `Current Track: ${currentAnalysis.name}`,
        gpxContent: '',
        source: 'active',
      });
    }

    // Garage rides
    const garage = getGarageRides();
    garage.forEach(g => {
      list.push({
        id: `garage-${g.id}`,
        name: `${g.name} (${g.distanceKm?.toFixed(1) || 0} km)`,
        gpxContent: g.gpxContent,
        source: 'garage',
      });
    });

    // Built-in sample fallback only if fewer than 2 rides available
    if (list.length < 2) {
      list.push({
        id: 'sample-benchmark',
        name: `Sample: ${SAMPLE_GPX_NAME}`,
        gpxContent: SAMPLE_GPX_DATA,
        source: 'sample',
      });
    }

    setAvailableRides(list);

    // Initial defaults
    if (list.length >= 2) {
      const default1 = currentAnalysis ? 'active-ride' : list[0].id;
      const default2 = list.find(r => r.id !== default1)?.id || list[1].id;
      setSelectedRide1Id(default1);
      setSelectedRide2Id(default2);
    }
  }, [isOpen, currentAnalysis]);

  // Parse Ride 1
  useEffect(() => {
    if (!selectedRide1Id || !isOpen) return;
    if (selectedRide1Id === 'active-ride' && currentAnalysis) {
      setAnalysis1(currentAnalysis);
      return;
    }
    const match = availableRides.find(r => r.id === selectedRide1Id);
    if (match && match.gpxContent) {
      try {
        setAnalysis1(parseGPX(match.gpxContent));
      } catch {
        setAnalysis1(null);
      }
    }
  }, [selectedRide1Id, availableRides, currentAnalysis, isOpen]);

  // Parse Ride 2
  useEffect(() => {
    if (!selectedRide2Id || !isOpen) return;
    if (selectedRide2Id === 'active-ride' && currentAnalysis) {
      setAnalysis2(currentAnalysis);
      return;
    }
    const match = availableRides.find(r => r.id === selectedRide2Id);
    if (match && match.gpxContent) {
      try {
        setAnalysis2(parseGPX(match.gpxContent));
      } catch {
        setAnalysis2(null);
      }
    }
  }, [selectedRide2Id, availableRides, currentAnalysis, isOpen]);

  // Playback timer
  useEffect(() => {
    if (isPlaying) {
      playTimerRef.current = window.setInterval(() => {
        setScrubPercent(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return Math.min(100, prev + 0.5);
        });
      }, 50);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying]);

  // Setup Leaflet map instance
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([18.5204, 73.8567], 12);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
        className: isLight ? '' : 'dark-map-tiles',
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
        } catch {}
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, isLight]);

  // Render Polylines for both rides
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old
    if (polyline1Ref.current) map.removeLayer(polyline1Ref.current);
    if (polyline2Ref.current) map.removeLayer(polyline2Ref.current);

    const bounds = L.latLngBounds([]);

    // Ride 1 (Baseline: Sky/Cyan)
    if (analysis1 && analysis1.points.length > 0) {
      const coords1: L.LatLngTuple[] = analysis1.points.map(p => [p.lat, p.lon]);
      polyline1Ref.current = L.polyline(coords1, {
        color: isLight ? '#0284c7' : '#00f0ff',
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
      polyline1Ref.current.bindTooltip(`Baseline: ${analysis1.name}`, { sticky: true });
      coords1.forEach(c => bounds.extend(c));
    }

    // Ride 2 (Ghost: Amber/Yellow)
    if (analysis2 && analysis2.points.length > 0) {
      const coords2: L.LatLngTuple[] = analysis2.points.map(p => [p.lat, p.lon]);
      polyline2Ref.current = L.polyline(coords2, {
        color: isLight ? '#d97706' : '#ffe600',
        weight: 4,
        opacity: 0.9,
        dashArray: '6, 6',
      }).addTo(map);
      polyline2Ref.current.bindTooltip(`Ghost: ${analysis2.name}`, { sticky: true });
      coords2.forEach(c => bounds.extend(c));
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [analysis1, analysis2, isLight]);

  // Interpolate point at scrub percentage
  const getPointAtPercent = (pts: TrackPoint[], pct: number): TrackPoint | null => {
    if (!pts || pts.length === 0) return null;
    const index = Math.min(pts.length - 1, Math.floor((pct / 100) * (pts.length - 1)));
    return pts[index];
  };

  const currentPt1 = useMemo(() => analysis1 ? getPointAtPercent(analysis1.points, scrubPercent) : null, [analysis1, scrubPercent]);
  const currentPt2 = useMemo(() => analysis2 ? getPointAtPercent(analysis2.points, scrubPercent) : null, [analysis2, scrubPercent]);

  // Update animated scrubber cursor markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Marker 1 (Cyan)
    if (currentPt1) {
      const pos: L.LatLngTuple = [currentPt1.lat, currentPt1.lon];
      const icon1 = L.divIcon({
        className: 'marker-ride-1',
        html: `<div style="width:24px; height:24px; border-radius:50%; background:#00f0ff; border:3px solid #000; box-shadow:0 0 10px #00f0ff; display:flex; align-items:center; justify-content:center; color:#000; font-size:10px; font-weight:900;">1</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      if (!marker1Ref.current) {
        marker1Ref.current = L.marker(pos, { icon: icon1 }).addTo(map);
      } else {
        marker1Ref.current.setIcon(icon1);
        marker1Ref.current.setLatLng(pos);
      }
    }

    // Marker 2 (Yellow)
    if (currentPt2) {
      const pos: L.LatLngTuple = [currentPt2.lat, currentPt2.lon];
      const icon2 = L.divIcon({
        className: 'marker-ride-2',
        html: `<div style="width:24px; height:24px; border-radius:50%; background:#ffe600; border:3px solid #000; box-shadow:0 0 10px #ffe600; display:flex; align-items:center; justify-content:center; color:#000; font-size:10px; font-weight:900;">2</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      if (!marker2Ref.current) {
        marker2Ref.current = L.marker(pos, { icon: icon2 }).addTo(map);
      } else {
        marker2Ref.current.setIcon(icon2);
        marker2Ref.current.setLatLng(pos);
      }
    }
  }, [currentPt1, currentPt2]);

  // Speed Differential SVG Graph
  const chartWidth = 600;
  const chartHeight = 100;
  const sampleCount = 60;

  const chartData = useMemo(() => {
    if (!analysis1 || !analysis2) return [];
    const maxSpeed = Math.max(analysis1.maxSpeedKmh, analysis2.maxSpeedKmh, 80);

    const data: { pct: number; s1: number; s2: number; delta: number; y1: number; y2: number }[] = [];
    for (let i = 0; i <= sampleCount; i++) {
      const pct = (i / sampleCount) * 100;
      const p1 = getPointAtPercent(analysis1.points, pct);
      const p2 = getPointAtPercent(analysis2.points, pct);
      const s1 = p1 ? p1.speedKmh : 0;
      const s2 = p2 ? p2.speedKmh : 0;
      const delta = s2 - s1;
      const y1 = chartHeight - (s1 / maxSpeed) * (chartHeight - 15);
      const y2 = chartHeight - (s2 / maxSpeed) * (chartHeight - 15);
      data.push({ pct, s1, s2, delta, y1, y2 });
    }
    return data;
  }, [analysis1, analysis2]);

  if (!isOpen) return null;

  // Comparison metrics calculations
  const timeDeltaSec = (analysis2?.movingTimeSeconds || 0) - (analysis1?.movingTimeSeconds || 0);
  const isFaster = timeDeltaSec < 0;
  const absTimeDelta = Math.abs(timeDeltaSec);
  const timeDeltaFormatted = formatDurationSummary(absTimeDelta);

  const avgSpeedDelta = (analysis2?.movingAvgSpeedKmh || 0) - (analysis1?.movingAvgSpeedKmh || 0);
  const maxSpeedDelta = (analysis2?.maxSpeedKmh || 0) - (analysis1?.maxSpeedKmh || 0);
  const distDeltaKm = (analysis2?.totalDistanceKm || 0) - (analysis1?.totalDistanceKm || 0);

  const modalBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d131a] border-[#1e2a38] text-white';
  const subTextColor = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const cardBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[9500] flex items-center justify-center p-2 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`border rounded-2xl w-full max-w-5xl h-[90dvh] max-h-[900px] overscroll-contain flex flex-col shadow-2xl overflow-hidden cursor-default ${modalBg}`}
      >
        {/* Header Bar */}
        <div className={`p-4 border-b flex items-center justify-between gap-3 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-[#1e2a38]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'}`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Side-by-Side Track Comparison</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isLight ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-sky-500/15 text-sky-400 border-sky-500/30'}`}>
                  GHOST TRACK
                </span>
              </h3>
              <p className={`text-[11px] font-sans ${subTextColor}`}>
                Compare corner speeds, braking points, and sector times across two runs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close track comparison modal"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isLight
                ? 'border-slate-300 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                : 'border-slate-700/50 hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ride Selector Dropdowns */}
        <div className={`p-3 border-b grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono ${cardBg}`}>
          {/* Baseline Ride 1 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${isLight ? 'bg-sky-600' : 'bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]'}`}></div>
            <label htmlFor="compare-ride-1" className={`font-bold shrink-0 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Ride 1:</label>
            <select
              id="compare-ride-1"
              value={selectedRide1Id}
              onChange={e => setSelectedRide1Id(e.target.value)}
              className={`flex-1 min-w-0 py-1.5 px-2.5 rounded-lg border truncate focus:outline-none focus:border-sky-400 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            >
              {availableRides.map(r => (
                <option key={`r1-${r.id}`} value={r.id} disabled={r.id === selectedRide2Id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Ride 2 */}
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${isLight ? 'bg-amber-600' : 'bg-[#ffe600] shadow-[0_0_8px_#ffe600]'}`}></div>
            <label htmlFor="compare-ride-2" className={`font-bold shrink-0 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Ghost:</label>
            <select
              id="compare-ride-2"
              value={selectedRide2Id}
              onChange={e => setSelectedRide2Id(e.target.value)}
              className={`flex-1 min-w-0 py-1.5 px-2.5 rounded-lg border truncate focus:outline-none focus:border-amber-400 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
              }`}
            >
              {availableRides.map(r => (
                <option key={`r2-${r.id}`} value={r.id} disabled={r.id === selectedRide1Id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Telemetry Delta Scorecards */}
        {analysis1 && analysis2 && (
          <div className={`p-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono telemetry-num ${isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/60 border-[#1e2a38]'}`}>
            {/* Time Split */}
            <div className={`p-2.5 rounded-xl border ${isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/60'}`}>
              <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${subTextColor}`}>
                <span>Time Split</span>
                <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <div className="text-base font-black mt-1 flex items-center gap-1.5">
                <span className={isFaster ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}>
                  {isFaster ? `-${timeDeltaFormatted}` : `+${timeDeltaFormatted}`}
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 font-sans ${subTextColor}`}>
                {isFaster ? 'Ghost was faster' : 'Ghost was slower'}
              </div>
            </div>

            {/* Avg Speed Delta */}
            <div className={`p-2.5 rounded-xl border ${isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/60'}`}>
              <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${subTextColor}`}>
                <span>Avg Speed Delta</span>
                <Gauge className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <div className="text-base font-black mt-1 flex items-center gap-1.5">
                <span className={avgSpeedDelta >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}>
                  {avgSpeedDelta >= 0 ? `+${avgSpeedDelta.toFixed(1)}` : avgSpeedDelta.toFixed(1)} km/h
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 ${subTextColor}`}>
                {analysis1.movingAvgSpeedKmh.toFixed(0)} vs {analysis2.movingAvgSpeedKmh.toFixed(0)} km/h
              </div>
            </div>

            {/* Max Speed Delta */}
            <div className={`p-2.5 rounded-xl border ${isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/60'}`}>
              <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${subTextColor}`}>
                <span>Peak Speed</span>
                <TrendingUp className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <div className="text-base font-black mt-1 flex items-center gap-1.5">
                <span className={maxSpeedDelta >= 0 ? (isLight ? 'text-amber-700' : 'text-amber-400') : (isLight ? 'text-sky-700' : 'text-sky-400')}>
                  {analysis2.maxSpeedKmh.toFixed(0)} km/h
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 ${subTextColor}`}>
                vs {analysis1.maxSpeedKmh.toFixed(0)} km/h ({maxSpeedDelta >= 0 ? `+${maxSpeedDelta.toFixed(0)}` : maxSpeedDelta.toFixed(0)})
              </div>
            </div>

            {/* Distance Delta */}
            <div className={`p-2.5 rounded-xl border ${isLight ? 'border-slate-200 bg-white shadow-xs' : 'border-slate-800 bg-slate-900/60'}`}>
              <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${subTextColor}`}>
                <span>Distance</span>
                <Navigation className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <div className="text-base font-black mt-1 flex items-center gap-1.5">
                <span>{analysis2.totalDistanceKm.toFixed(1)} km</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${subTextColor}`}>
                vs {analysis1.totalDistanceKm.toFixed(1)} km ({distDeltaKm >= 0 ? `+${distDeltaKm.toFixed(1)}` : distDeltaKm.toFixed(1)})
              </div>
            </div>
          </div>
        )}

        {/* Interactive Leaflet Comparison Map */}
        <div className="flex-1 relative min-h-[220px] [isolation:isolate]">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Live Scrubber Info Overlay */}
          <div className={`absolute top-3 right-3 z-[1000] backdrop-blur-md p-2.5 rounded-xl border shadow-xl font-mono text-[11px] space-y-1 telemetry-num ${
            isLight ? 'bg-white/95 border-slate-300 text-slate-900' : 'bg-slate-950/85 border-slate-800 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLight ? 'bg-sky-600' : 'bg-[#00f0ff]'}`}></span>
              <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Ride 1 Speed:</span>
              <span className={`font-bold ${isLight ? 'text-sky-700' : 'text-[#00f0ff]'}`}>{currentPt1?.speedKmh.toFixed(0) || 0} km/h</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLight ? 'bg-amber-600' : 'bg-[#ffe600]'}`}></span>
              <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>Ride 2 Speed:</span>
              <span className={`font-bold ${isLight ? 'text-amber-700' : 'text-[#ffe600]'}`}>{currentPt2?.speedKmh.toFixed(0) || 0} km/h</span>
            </div>
            {currentPt1 && currentPt2 && (
              <div className={`pt-1 border-t flex items-center justify-between text-[10px] ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                <span className={subTextColor}>Delta at {scrubPercent.toFixed(0)}%:</span>
                <span className={`font-black ${currentPt2.speedKmh >= currentPt1.speedKmh ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}`}>
                  {currentPt2.speedKmh >= currentPt1.speedKmh ? '+' : ''}{(currentPt2.speedKmh - currentPt1.speedKmh).toFixed(1)} km/h
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Speed vs Distance Differential Chart & Scrubber */}
        <div className={`p-3 border-t font-mono flex flex-col gap-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-[#1e2a38]'}`}>
          <div className="flex items-center justify-between text-xs flex-wrap gap-1.5">
            <span className={`font-bold text-[11px] flex items-center gap-2 flex-wrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span>Differential Speed Graph (Distance %):</span>
              <span className={`text-[10px] ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>Green = Ghost Faster</span>
              <span className={`text-[10px] ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>Red = Ghost Slower</span>
            </span>
            <span className={`text-[11px] font-bold telemetry-num ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{scrubPercent.toFixed(0)}% Distance</span>
          </div>

          {/* SVG Differential Chart */}
          <div className={`relative w-full h-14 rounded-lg overflow-hidden border ${isLight ? 'bg-white border-slate-300' : 'bg-slate-900/90 border-slate-800'}`}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="w-full h-full">
              {/* Shaded Delta Polygons */}
              {chartData.map((d, i) => {
                if (i === 0) return null;
                const prev = chartData[i - 1];
                const x1 = (prev.pct / 100) * chartWidth;
                const x2 = (d.pct / 100) * chartWidth;
                const isGhostFaster = d.delta >= 0;
                const fillColor = isGhostFaster ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
                const points = `${x1},${prev.y1} ${x2},${d.y1} ${x2},${d.y2} ${x1},${prev.y2}`;
                return <polygon key={`poly-${i}`} points={points} fill={fillColor} />;
              })}

              {/* Ride 1 Baseline Line */}
              <polyline
                fill="none"
                stroke={isLight ? '#0284c7' : '#00f0ff'}
                strokeWidth="2"
                points={chartData.map(d => `${(d.pct / 100) * chartWidth},${d.y1}`).join(' ')}
              />

              {/* Ride 2 Ghost Line */}
              <polyline
                fill="none"
                stroke={isLight ? '#d97706' : '#ffe600'}
                strokeWidth="2"
                strokeDasharray="4 2"
                points={chartData.map(d => `${(d.pct / 100) * chartWidth},${d.y2}`).join(' ')}
              />

              {/* Scrub line indicator */}
              <line
                x1={(scrubPercent / 100) * chartWidth}
                y1="0"
                x2={(scrubPercent / 100) * chartWidth}
                y2={chartHeight}
                stroke={isLight ? '#0f172a' : '#ffffff'}
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Slider and Playback Controls */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Ghost'}</span>
            </button>

            <button
              type="button"
              onClick={() => { setScrubPercent(0); setIsPlaying(false); }}
              aria-label="Reset comparison scrub to 0%"
              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                isLight
                  ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600'
                  : 'border-slate-700 hover:bg-slate-800 text-slate-400'
              }`}
              title="Reset to 0%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              aria-label="Scrub track comparison progress"
              min="0"
              max="100"
              step="0.2"
              value={scrubPercent}
              onChange={e => setScrubPercent(parseFloat(e.target.value))}
              className={`flex-1 accent-sky-400 cursor-pointer h-1.5 rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

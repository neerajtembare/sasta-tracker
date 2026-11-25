import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RideAnalysis, TrackPoint, PitStop, AppTheme } from '../types';
import { haversineDistance } from '../utils/gpxParser';
import {
  Layers,
  MapPin,
  Coffee,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Repeat,
  Crosshair,
  ChevronUp,
  ChevronDown,
  Check,
  Zap,
  Mountain,
  Gauge,
  TrendingUp,
  ArrowDownRight,
  X
} from 'lucide-react';
import { GroupMemberInfo } from '../hooks/useGroupRide';
import { formatSafeTime } from '../utils/units';
import { getRiderProfile } from '../utils/riderProfile';
import { triggerHaptic } from '../utils/audioChimes';

interface MapViewerProps {
  analysis: RideAnalysis;
  scrubIndex: number | null;
  onScrubChange: (index: number | null) => void;
  onEditStop?: (stop: PitStop) => void;
  focusedCoordinate?: { lat: number; lon: number; label?: string } | null;
  theme?: AppTheme;
  onOpenDiagnostics?: () => void;
  groupMembers?: GroupMemberInfo[];
}

const PIN_BADGE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const TURNAROUND_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`;
const FLAG_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>`;

const getCategoryBadgeSpec = (cat: string): { label: string; color: string; svg: string } => {
  switch (cat) {
    case 'chai':
      return {
        label: 'Tea Break',
        color: '#f59e0b',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
      };
    case 'fuel':
      return {
        label: 'Fuel',
        color: '#10b981',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`,
      };
    case 'dhaba':
      return {
        label: 'Food Stop',
        color: '#fb923c',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
      };
    case 'scenic':
      return {
        label: 'Scenic',
        color: '#38bdf8',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
      };
    case 'mechanic':
      return {
        label: 'Service',
        color: '#a78bfa',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
      };
    case 'rest':
      return {
        label: 'Rest',
        color: '#f43f5e',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9h6v6H9z"/></svg>`,
      };
    case 'traffic':
      return {
        label: 'Traffic',
        color: '#facc15',
        svg: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="18" x="7" y="3" rx="2"/><circle cx="12" cy="8" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>`,
      };
    default:
      return {
        label: 'Stop',
        color: '#f59e0b',
        svg: PIN_BADGE_SVG,
      };
  }
};

// Speed to color function for map and YouTube-style scrubber
export const getSpeedColor = (speedKmh: number, maxSpeedKmh: number) => {
  if (speedKmh < 2.0) return '#64748b'; // Slate: Stationary
  const top = Math.max(maxSpeedKmh, 40);
  const ratio = Math.min(1, Math.max(0, speedKmh / top));
  if (ratio < 0.25) return '#0284c7'; // Deep Sky
  if (ratio < 0.55) return '#10b981'; // Emerald
  if (ratio < 0.80) return '#f59e0b'; // Amber
  return '#f43f5e'; // Coral Rose
};

export const MapViewer: React.FC<MapViewerProps> = ({
  analysis,
  scrubIndex,
  onScrubChange,
  onEditStop,
  focusedCoordinate,
  theme = 'dark',
  onOpenDiagnostics,
  groupMembers,
}) => {
  const isLight = theme === 'light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const scrubberMarkerRef = useRef<L.Marker | null>(null);
  const focusedMarkerRef = useRef<L.Marker | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const currentMapStyleRef = useRef<string>('');
  const scrubIndexRef = useRef<number | null>(scrubIndex);
  scrubIndexRef.current = scrubIndex;

  // Base Map Tile Style initialized from Settings default
  const initialLayerPref = getRiderProfile().defaultMapLayer;
  const [mapStyle, setMapStyle] = useState<'osm' | 'satellite' | 'dark' | 'sunlight'>(
    initialLayerPref === 'satellite'
      ? 'satellite'
      : initialLayerPref === 'dark'
      ? 'dark'
      : initialLayerPref === 'sunlight'
      ? 'sunlight'
      : 'osm'
  );
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  // Default pit stops to TRUE so riders immediately see and can click/edit stops
  const [showPitStops, setShowPitStops] = useState(true);
  const [showPointDots] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showHeatmapLegend, setShowHeatmapLegend] = useState(true);

  // Out & Back Route Detection and Mode
  const [routeMode, setRouteMode] = useState<'all' | 'split' | 'outbound' | 'return'>('all');

  // Playback & Video Scrubber states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 1x, 2x, 5x, 10x
  const [isLooping, setIsLooping] = useState(true);
  const [followBike, setFollowBike] = useState(false);

  // YouTube-Style Scrubber & Collapsible tray states
  const [isScrubberExpanded, setIsScrubberExpanded] = useState(false);
  const [hoverScrub, setHoverScrub] = useState<{
    pct: number;
    pt: TrackPoint;
    idx: number;
    x: number;
  } | null>(null);
  const scrubberBarRef = useRef<HTMLDivElement>(null);

  // Compute turnaround point (point of maximum straight-line displacement from start)
  const turnaroundIndex = useMemo(() => {
    if (!analysis.points || analysis.points.length < 10) return -1;
    const start = analysis.points[0];
    let maxDisplacement = 0;
    let maxIdx = -1;
    for (let i = 0; i < analysis.points.length; i++) {
      const pt = analysis.points[i];
      const d = haversineDistance(start.lat, start.lon, pt.lat, pt.lon);
      if (d > maxDisplacement) {
        maxDisplacement = d;
        maxIdx = i;
      }
    }
    const end = analysis.points[analysis.points.length - 1];
    const endDisplacement = haversineDistance(start.lat, start.lon, end.lat, end.lon);
    // If turnaround occurred between 20% and 85% of points, and ride returned substantially closer to start
    const isOutAndBack =
      maxIdx > analysis.points.length * 0.2 &&
      maxIdx < analysis.points.length * 0.85 &&
      endDisplacement < maxDisplacement * 0.75;

    return isOutAndBack ? maxIdx : -1;
  }, [analysis.points]);

  const activePoints = analysis.points;

  // Pre-calculated Leaflet coordinates tuple array to avoid O(N) allocations during playback/scrubbing
  const activeCoords = useMemo(() => {
    return activePoints.map(p => [p.lat, p.lon] as L.LatLngTuple);
  }, [activePoints]);

  const currentIndex = scrubIndex !== null ? Math.min(scrubIndex, activePoints.length - 1) : 0;
  const currentPoint = activePoints[currentIndex] || activePoints[0];

  // Instant road gradient % (slope = Δele / Δdist * 100)
  const currentGradient = useMemo(() => {
    if (!activePoints || activePoints.length < 5) return 0;
    const prevIdx = Math.max(0, currentIndex - 3);
    const nextIdx = Math.min(activePoints.length - 1, currentIndex + 3);
    const pPrev = activePoints[prevIdx];
    const pNext = activePoints[nextIdx];
    if (!pPrev || !pNext || pPrev.ele === null || pNext.ele === null) return 0;
    const distM = (pNext.distanceFromStartKm - pPrev.distanceFromStartKm) * 1000;
    if (distM < 5) return 0;
    const dEle = pNext.ele - pPrev.ele;
    const slope = (dEle / distM) * 100;
    return Math.max(-30, Math.min(30, slope));
  }, [activePoints, currentIndex]);

  // Elevation Profile SVG path & boundaries
  const elevationProfileData = useMemo(() => {
    if (!activePoints || activePoints.length < 2) return null;
    let minEle = Infinity;
    let maxEle = -Infinity;
    const totalDist = activePoints[activePoints.length - 1].distanceFromStartKm || 1;

    const step = Math.max(1, Math.floor(activePoints.length / 200));
    const sampled: Array<{ xPct: number; ele: number; distKm: number }> = [];

    for (let i = 0; i < activePoints.length; i += step) {
      const p = activePoints[i];
      const ele = p.ele !== null ? p.ele : (sampled[sampled.length - 1]?.ele || 0);
      if (ele < minEle) minEle = ele;
      if (ele > maxEle) maxEle = ele;
      sampled.push({
        xPct: (p.distanceFromStartKm / totalDist) * 100,
        ele,
        distKm: p.distanceFromStartKm
      });
    }

    if (minEle === Infinity) {
      minEle = 0;
      maxEle = 100;
    }
    const eleRange = Math.max(10, maxEle - minEle);
    const svgHeight = 44;
    const pointsStr = sampled.map(s => {
      const y = svgHeight - ((s.ele - minEle) / eleRange) * (svgHeight - 6) - 3;
      return `${s.xPct.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const areaPath = `0,${svgHeight} ` + pointsStr + ` 100,${svgHeight}`;

    return {
      minEle: Math.round(minEle),
      maxEle: Math.round(maxEle),
      elevGain: Math.round(analysis.elevGainM),
      elevUnit: 'm',
      pointsStr,
      areaPath,
      sampled
    };
  }, [activePoints, analysis.elevGainM]);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate elapsed ride time up to scrub position
  const getElapsedTime = (index: number) => {
    if (!analysis.points[0]?.time || !activePoints[index]?.time) {
      return index * 2;
    }
    const t0 = new Date(analysis.points[0].time).getTime();
    const tCur = new Date(activePoints[index].time).getTime();
    return Math.max(0, (tCur - t0) / 1000);
  };

  const elapsedSeconds = getElapsedTime(currentIndex);
  const totalDuration = analysis.totalDurationSeconds || activePoints.length * 2;

  // Video playback loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        const cur = scrubIndexRef.current === null ? 0 : scrubIndexRef.current;
        const next = cur + 1;
        if (next >= activePoints.length) {
          if (isLooping) {
            onScrubChange(0);
          } else {
            setIsPlaying(false);
          }
        } else {
          onScrubChange(next);
          if (followBike && mapInstanceRef.current && activePoints[next]) {
            const p = activePoints[next];
            mapInstanceRef.current.panTo([p.lat, p.lon], { animate: true, duration: 0.2 });
          }
        }
      }, Math.max(40, Math.round(300 / playbackSpeed)));
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackSpeed, isLooping, followBike, activePoints, onScrubChange]);

  // Automated ResizeObserver to prevent grey tiles when switching tabs or resizing
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Speed Profile SVG path & boundaries
  const speedProfileData = useMemo(() => {
    if (!activePoints || activePoints.length < 2) return null;
    const maxSpeed = Math.max(10, analysis.maxSpeedKmh);
    const totalDist = activePoints[activePoints.length - 1].distanceFromStartKm || 1;

    const step = Math.max(1, Math.floor(activePoints.length / 200));
    const sampled: Array<{ xPct: number; speed: number; distKm: number }> = [];

    for (let i = 0; i < activePoints.length; i += step) {
      const p = activePoints[i];
      const speed = Math.max(0, p.speedKmh);
      sampled.push({
        xPct: (p.distanceFromStartKm / totalDist) * 100,
        speed,
        distKm: p.distanceFromStartKm,
      });
    }

    const svgHeight = 44;
    const pointsStr = sampled.map(s => {
      const y = svgHeight - (s.speed / maxSpeed) * (svgHeight - 6) - 3;
      return `${s.xPct.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const areaPath = `0,${svgHeight} ` + pointsStr + ` 100,${svgHeight}`;

    return {
      minSpeed: 0,
      maxSpeed: Math.round(maxSpeed),
      avgSpeed: Math.round(analysis.movingAvgSpeedKmh),
      speedUnit: 'km/h',
      pointsStr,
      areaPath,
      sampled,
    };
  }, [activePoints, analysis.maxSpeedKmh, analysis.movingAvgSpeedKmh]);

  // Proportional pit-stop notches for timeline chapter marks
  const pitStopNotches = useMemo(() => {
    if (!analysis.pitStops || analysis.pitStops.length === 0 || analysis.totalDistanceKm <= 0) return [];
    return analysis.pitStops.map(pit => {
      const pct = Math.min(100, Math.max(0, (pit.distanceKm / analysis.totalDistanceKm) * 100));
      return {
        ...pit,
        pct,
      };
    });
  }, [analysis.pitStops, analysis.totalDistanceKm]);

  // Scrubber mouse & touch handlers for hover preview & seeking
  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePoints.length < 2) return;
    const targetEl = e.currentTarget || scrubberBarRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const clientX = e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.min(Math.floor(pct * (activePoints.length - 1)), activePoints.length - 1);
    const pt = activePoints[idx];
    setHoverScrub({
      pct: pct * 100,
      pt,
      idx,
      x: clientX - rect.left,
    });
  };

  const handleScrubberMouseLeave = () => {
    setHoverScrub(null);
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePoints.length < 2) return;
    const targetEl = e.currentTarget || scrubberBarRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.min(Math.floor(pct * (activePoints.length - 1)), activePoints.length - 1);
    onScrubChange(idx);
  };

  // Mobile touch dragging handler for scrubber tracks and dual SVG profile graphs
  const handleScrubberTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (activePoints.length < 2 || !e.touches || e.touches.length === 0) return;
    const targetEl = e.currentTarget || scrubberBarRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const clientX = e.touches[0].clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const idx = Math.min(Math.floor(pct * (activePoints.length - 1)), activePoints.length - 1);
    const pt = activePoints[idx];
    setHoverScrub({
      pct: pct * 100,
      pt,
      idx,
      x: clientX - rect.left,
    });
    onScrubChange(idx);
  };

  const handleScrubberTouchEnd = () => {
    setHoverScrub(null);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 2;
        const next = Math.min(activePoints.length - 1, (scrubIndexRef.current || 0) + step);
        onScrubChange(next);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 2;
        const prev = Math.max(0, (scrubIndexRef.current || 0) - step);
        onScrubChange(prev);
      } else if (e.code === 'Home') {
        e.preventDefault();
        onScrubChange(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        onScrubChange(activePoints.length - 1);
      }
      // Note: 'D' key for diagnostics is handled globally in App.tsx — removed here to prevent double-fire
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePoints.length, onScrubChange, onOpenDiagnostics]);

  // Initialize and update base Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Update Tile Layers ONLY when mapStyle changes to avoid tile flickering & net::ERR_ABORTED errors
    if (currentMapStyleRef.current !== mapStyle || !tileLayerRef.current) {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      if (overlayTileLayerRef.current) {
        map.removeLayer(overlayTileLayerRef.current);
        overlayTileLayerRef.current = null;
      }

      if (mapStyle === 'osm') {
        tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);
      } else if (mapStyle === 'satellite') {
        tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 18,
          maxZoom: 19,
          attribution: '&copy; Esri',
        }).addTo(map);
        overlayTileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxNativeZoom: 18,
          maxZoom: 19,
          opacity: 0.85,
        }).addTo(map);
      } else if (mapStyle === 'dark') {
        tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap Dark',
          className: 'dark-map-tiles',
        }).addTo(map);
      } else if (mapStyle === 'sunlight') {
        tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap High-Contrast',
          className: 'sunlight-map-tiles',
        }).addTo(map);
      }
      currentMapStyleRef.current = mapStyle;
    }

    // Clear old vector layers (preserve the base tile layers so they don't reload or cancel network requests)
    map.eachLayer(layer => {
      if (layer !== tileLayerRef.current && layer !== overlayTileLayerRef.current) {
        map.removeLayer(layer);
      }
    });
    traveledPolylineRef.current = null;
    scrubberMarkerRef.current = null;
    if (focusedMarkerRef.current) {
      focusedMarkerRef.current = null;
    }

    const allCoords: L.LatLngTuple[] = [];
    const maxKmh = analysis.maxSpeedKmh;
    const pts = analysis.points;

    // Hardware-accelerated HTML5 Canvas Renderer for high-performance rendering (100x fewer DOM nodes)
    const canvasRenderer = L.canvas({ padding: 0.5 });

    // 1. Draw Route Lines Based on Selected Route Mode
    if (routeMode === 'split' && turnaroundIndex > 0) {
      // Outbound Segment (Start -> Turnaround) in vibrant Sky Blue
      const outboundCoords: L.LatLngTuple[] = [];
      for (let i = 0; i <= turnaroundIndex; i++) {
        outboundCoords.push([pts[i].lat, pts[i].lon]);
      }
      allCoords.push(...outboundCoords);

      // Underline shadow
      L.polyline(outboundCoords, {
        color: isLight ? '#0f172a' : '#000000',
        weight: 7,
        opacity: 0.6,
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);

      // Outbound solid Cyan line
      const outboundLine = L.polyline(outboundCoords, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);
      outboundLine.bindTooltip('<b>Outbound Leg (Leg 1)</b>', { sticky: true });

      // Return Segment (Turnaround -> Finish) in vibrant Coral Rose with slight visual offset
      const returnCoords: L.LatLngTuple[] = [];
      for (let i = turnaroundIndex; i < pts.length; i++) {
        // Micro offset (+0.00006 deg lat/lon ~ 6 meters) so overlapping roads don't occlude
        returnCoords.push([pts[i].lat + 0.00005, pts[i].lon + 0.00005]);
      }
      allCoords.push(...returnCoords);

      L.polyline(returnCoords, {
        color: isLight ? '#0f172a' : '#000000',
        weight: 7,
        opacity: 0.6,
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);

      // Return dashed Coral line
      const returnLine = L.polyline(returnCoords, {
        color: '#f43f5e',
        weight: 5,
        opacity: 0.95,
        dashArray: '8, 6',
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);
      returnLine.bindTooltip('<b>Return Leg (Leg 2 - Offset View)</b>', { sticky: true });

      // Turnaround Marker Pin
      const turnPt = pts[turnaroundIndex];
      const turnIcon = L.divIcon({
        className: 'turnaround-marker',
        html: `<div style="padding:3px 8px; background:#0f172a; border:2px solid #f59e0b; color:#f59e0b; font-family:monospace; font-weight:bold; font-size:10px; border-radius:12px; box-shadow:0 0 10px rgba(245,158,11,0.5); white-space:nowrap; display:inline-flex; align-items:center; gap:4px;">${TURNAROUND_SVG}<span>TURNAROUND</span></div>`,
        iconSize: [110, 22],
        iconAnchor: [55, 11],
      });
      L.marker([turnPt.lat, turnPt.lon], { icon: turnIcon })
        .addTo(map)
        .bindPopup(`<b>Turnaround Point</b><br/>Farthest point: ${turnPt.distanceFromStartKm.toFixed(1)} km mark`);

    } else if (routeMode === 'outbound' && turnaroundIndex > 0) {
      // Outbound only
      const outboundCoords: L.LatLngTuple[] = [];
      for (let i = 0; i <= turnaroundIndex; i++) {
        outboundCoords.push([pts[i].lat, pts[i].lon]);
      }
      allCoords.push(...outboundCoords);

      L.polyline(outboundCoords, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);

    } else if (routeMode === 'return' && turnaroundIndex > 0) {
      // Return only
      const returnCoords: L.LatLngTuple[] = [];
      for (let i = turnaroundIndex; i < pts.length; i++) {
        returnCoords.push([pts[i].lat, pts[i].lon]);
      }
      allCoords.push(...returnCoords);

      L.polyline(returnCoords, {
        color: '#f43f5e',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        renderer: canvasRenderer,
      }).addTo(map);

    } else {
      // Full Speed Heatmap Mode — Aggregated speed bucket chunking (100x fewer DOM polylines)
      analysis.segments.forEach(seg => {
        const segCoords = seg.points.map(p => [p.lat, p.lon] as L.LatLngTuple);
        allCoords.push(...segCoords);

        // High contrast under-line
        L.polyline(segCoords, {
          color: isLight ? '#0f172a' : '#05080b',
          weight: 7,
          opacity: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
          renderer: canvasRenderer,
        }).addTo(map);

        // Group consecutive points sharing the same color into continuous polyline chunks.
        // Adjacent chunks share boundary vertices so the rendered speed line has zero gaps.
        const chunks: Array<{
          coords: L.LatLngTuple[];
          color: string;
          avgSpeed: number;
          startDist: number;
          endDist: number;
        }> = [];

        let currentCoords: L.LatLngTuple[] = [];
        let currentColor = '';
        let speedSum = 0;
        let speedCount = 0;
        let chunkStartDist = 0;
        let chunkEndDist = 0;

        for (let i = 0; i < seg.points.length; i++) {
          const pt = seg.points[i];
          const ptColor = getSpeedColor(pt.speedKmh, maxKmh);
          const coord: L.LatLngTuple = [pt.lat, pt.lon];

          if (currentCoords.length === 0) {
            currentCoords.push(coord);
            currentColor = ptColor;
            speedSum = pt.speedKmh;
            speedCount = 1;
            chunkStartDist = pt.distanceFromStartKm;
            chunkEndDist = pt.distanceFromStartKm;
          } else if (ptColor === currentColor) {
            currentCoords.push(coord);
            speedSum += pt.speedKmh;
            speedCount++;
            chunkEndDist = pt.distanceFromStartKm;
          } else {
            // Append boundary point so the previous line connects seamlessly to this point
            currentCoords.push(coord);
            chunkEndDist = pt.distanceFromStartKm;
            chunks.push({
              coords: currentCoords,
              color: currentColor,
              avgSpeed: speedCount > 0 ? speedSum / speedCount : 0,
              startDist: chunkStartDist,
              endDist: chunkEndDist,
            });

            // Start new chunk with boundary point as first vertex
            currentCoords = [coord];
            currentColor = ptColor;
            speedSum = pt.speedKmh;
            speedCount = 1;
            chunkStartDist = pt.distanceFromStartKm;
            chunkEndDist = pt.distanceFromStartKm;
          }
        }

        if (currentCoords.length > 1) {
          chunks.push({
            coords: currentCoords,
            color: currentColor,
            avgSpeed: speedCount > 0 ? speedSum / speedCount : 0,
            startDist: chunkStartDist,
            endDist: chunkEndDist,
          });
        }

        // Render aggregated speed chunks via HTML5 Canvas
        chunks.forEach(chunk => {
          const poly = L.polyline(chunk.coords, {
            color: chunk.color,
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
            renderer: canvasRenderer,
          }).addTo(map);

          poly.bindTooltip(
            `<div style="font-family:monospace; font-size:11px; padding:3px 6px; background:${isLight ? '#ffffff' : '#0d131a'}; color:${isLight ? '#0f172a' : '#ffffff'}; border:1px solid ${chunk.color}; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.4);">
              <strong style="color:${chunk.color}; font-size:12px;">~${Math.round(chunk.avgSpeed)} km/h</strong><br/>
              <span style="opacity:0.8; font-size:10px;">${chunk.startDist.toFixed(1)} – ${chunk.endDist.toFixed(1)} km</span>
            </div>`,
            { sticky: true }
          );
        });
      });
    }

    // 2. Clickable GPS Point Dots (optional)
    if (showPointDots && pts.length < 600) {
      pts.forEach((pt, idx) => {
        const dotColor = getSpeedColor(pt.speedKmh, maxKmh);
        const dot = L.circleMarker([pt.lat, pt.lon], {
          radius: 3,
          color: isLight ? '#ffffff' : '#090c0a',
          weight: 1,
          fillColor: dotColor,
          fillOpacity: 0.9,
          renderer: canvasRenderer,
        }).addTo(map);

        dot.on('click', () => {
          onScrubChange(idx);
        });
      });
    }

    // 4. Dynamic Traveled Polyline Overlay (updates on scrub)
    const traveledPolyline = L.polyline([], {
      color: '#38bdf8',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      renderer: canvasRenderer,
    }).addTo(map);
    traveledPolylineRef.current = traveledPolyline;

    // 5. Start & Finish Markers
    if (pts.length > 0) {
      let startPt = pts[0];
      let endPt = pts[pts.length - 1];
      let startLabel = 'Track Start';
      let finishLabel = 'Finish Line';

      if (routeMode === 'outbound' && turnaroundIndex > 0) {
        endPt = pts[turnaroundIndex];
        finishLabel = 'Turnaround Point';
      } else if (routeMode === 'return' && turnaroundIndex > 0) {
        startPt = pts[turnaroundIndex];
        startLabel = 'Return Leg Start';
      }

      // Start Marker
      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `<div style="width:26px; height:26px; background:#0f172a; border:2px solid #10b981; color:#10b981; border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:monospace; font-weight:900; font-size:11px; box-shadow:0 0 10px rgba(16,185,129,0.5);">ST</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const startTimeText = formatSafeTime(startPt.time);
      L.marker([startPt.lat, startPt.lon], { icon: startIcon })
        .addTo(map)
        .bindPopup(`<b>${startLabel}</b>${startTimeText && startTimeText !== '—' ? `<br/>${startTimeText}` : ''}`);

      // Finish Marker
      const finishIcon = L.divIcon({
        className: 'custom-finish-marker',
        html: `<div style="width:26px; height:26px; background:#0f172a; border:2px solid #f43f5e; color:#f43f5e; border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:monospace; font-weight:900; font-size:11px; box-shadow:0 0 10px rgba(244,63,94,0.5);">FIN</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const endTimeText = formatSafeTime(endPt.time);
      L.marker([endPt.lat, endPt.lon], { icon: finishIcon })
        .addTo(map)
        .bindPopup(`<b>${finishLabel}</b>${endTimeText && endTimeText !== '—' ? `<br/>${endTimeText}` : ''}`);

      // Fit map bounds safely
      if (allCoords.length > 1) {
        try {
          const bounds = L.latLngBounds(allCoords);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
          }
        } catch {
          // ignore bounds errors
        }
      } else if (allCoords.length === 1) {
        map.setView(allCoords[0], 14);
      }
    }

    // 6. Add Pit Stop markers IF explicitly enabled by user
    if (showPitStops && analysis.pitStops.length > 0) {
      analysis.pitStops.forEach(pit => {
        const badge = getCategoryBadgeSpec(pit.category);
        // Clean, compact circular SVG pin badge — clicks open editor modal
        const pitIcon = L.divIcon({
          className: 'pit-marker',
          html: `<div style="width:28px; height:28px; border-radius:50%; background:#0f172a; border:2px solid ${badge.color}; color:${badge.color}; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.6); cursor:pointer;">${badge.svg}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([pit.lat, pit.lon], { icon: pitIcon }).addTo(map);

        // Hover tooltip for quick preview
        const stopTooltipEl = document.createElement('div');
        stopTooltipEl.style.cssText = 'font-family:monospace; font-size:11px; padding:2px 6px;';
        const mins = Math.round(pit.durationSeconds / 60);
        const hasDurationInName = /\(\d+\s*m(?:in)?\)/i.test(pit.name);
        stopTooltipEl.textContent = `${pit.name}${!hasDurationInName && mins > 0 ? ` (${mins} min)` : ''} — Click to edit`;
        marker.bindTooltip(stopTooltipEl, { direction: 'top', offset: [0, -14] });

        // Click opens StopEditorModal instead of a static popup
        marker.on('click', () => {
          onEditStop?.(pit);
        });
      });
    }

    // 7. Distance Milestone Markers (every 10 km or 25 km)
    if (showMilestones && pts.length > 1) {
      const totalDistKm = analysis.totalDistanceKm;
      const stepDist = totalDistKm > 60 ? 25 : 10;
      let nextMilestone = stepDist;
      for (let i = 1; i < pts.length; i++) {
        const ptDist = pts[i].distanceFromStartKm ?? 0;
        if (ptDist >= nextMilestone && ptDist < totalDistKm - 1) {
          const msLabel = `${Math.round(nextMilestone)} km`;
          const msIcon = L.divIcon({
            className: 'custom-milestone-marker',
            html: `<div style="padding:2px 6px; background:#0f172a; border:1.5px solid #38bdf8; color:#38bdf8; border-radius:6px; font-family:monospace; font-weight:800; font-size:10px; box-shadow:0 2px 6px rgba(0,0,0,0.6); white-space:nowrap; display:inline-flex; align-items:center; gap:3px;">${FLAG_SVG}<span>${msLabel}</span></div>`,
            iconSize: [52, 20],
            iconAnchor: [26, 10],
          });
          L.marker([pts[i].lat, pts[i].lon], { icon: msIcon })
            .addTo(map)
            .bindTooltip(`Milestone: ${msLabel} reached`, { direction: 'top', offset: [0, -10] });
          nextMilestone += stepDist;
        }
      }
    }

    const resizeTimer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
    };

  }, [analysis, mapStyle, showPitStops, showPointDots, routeMode, turnaroundIndex, isLight, showMilestones]);

  // Clean up Leaflet map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.stop();
        } catch { }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
      tileLayerRef.current = null;
      overlayTileLayerRef.current = null;
      currentMapStyleRef.current = '';
    };
  }, []);

  // Update scrubber cursor marker & Traveled route on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const pt = activePoints[currentIndex];
    if (pt) {
      const scrubPos: L.LatLngTuple = [pt.lat, pt.lon];
      const heading = pt.bearing !== null ? pt.bearing : 0;
      const speed = `${Math.round(pt.speedKmh)} km/h`;

      const markerHtml = `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          <!-- Pulse halo -->
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(56,189,248,0.35); animation:ping 1.5s infinite;"></div>
          <!-- Rotating Heading Arrow -->
          <div style="position:relative; width:28px; height:28px; border-radius:50%; background:#0f172a; border:2px solid #38bdf8; display:flex; align-items:center; justify-content:center; box-shadow:0 0 14px #38bdf8; transform:rotate(${heading}deg);">
            <div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:10px solid #38bdf8; transform:translateY(-2px);"></div>
          </div>
          <!-- Floating live speed tag -->
          <div style="position:absolute; top:-24px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid #38bdf8; color:#38bdf8; font-family:monospace; font-size:10px; font-weight:900; padding:1px 6px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.8);">
            ${speed}
          </div>
        </div>
      `;

      const cursorIcon = L.divIcon({
        className: 'scrubber-marker',
        html: markerHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      if (!scrubberMarkerRef.current) {
        scrubberMarkerRef.current = L.marker(scrubPos, { icon: cursorIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        scrubberMarkerRef.current.setIcon(cursorIcon);
        scrubberMarkerRef.current.setLatLng(scrubPos);
      }

      if (traveledPolylineRef.current) {
        traveledPolylineRef.current.setLatLngs(activeCoords.slice(0, currentIndex + 1));
      }
    }
  }, [currentIndex, activePoints, activeCoords]);

  // Center and highlight stop / coordinate when selected by user from list
  useEffect(() => {
    if (!focusedCoordinate || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    setShowPitStops(true);
    map.flyTo([focusedCoordinate.lat, focusedCoordinate.lon], 15, { duration: 1.0 });

    if (focusedMarkerRef.current) {
      focusedMarkerRef.current.remove();
    }

    const beaconIcon = L.divIcon({
      className: 'focused-beacon-marker',
      html: `<div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:rgba(245, 158, 11, 0.4); animation:ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width:30px; height:30px; border-radius:50%; background:#0f172a; border:2px solid #f59e0b; color:#f59e0b; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px rgba(245,158,11,0.6); z-index:10;">
          ${PIN_BADGE_SVG}
        </div>
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker([focusedCoordinate.lat, focusedCoordinate.lon], {
      icon: beaconIcon,
      zIndexOffset: 3000,
    }).addTo(map);

    if (focusedCoordinate.label) {
      const popupDiv = document.createElement('div');
      popupDiv.style.cssText = `font-family:monospace; font-size:12px; font-weight:bold; color:${isLight ? '#0f172a' : '#f1f5f9'}; padding:3px 6px;`;
      popupDiv.textContent = focusedCoordinate.label;
      marker.bindPopup(popupDiv).openPopup();
    }

    focusedMarkerRef.current = marker;
  }, [focusedCoordinate, isLight]);

  // Live Crew Friend Markers on Map
  const friendMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!groupMembers || groupMembers.length === 0) {
      friendMarkersRef.current.forEach(m => m.remove());
      friendMarkersRef.current.clear();
      return;
    }

    groupMembers.forEach(m => {
      if (!m.location) return;
      const pos: L.LatLngTuple = [m.location.lat, m.location.lon];
      const initial = m.name.slice(0, 1).toUpperCase();
      const color = m.color || '#ffe600';
      const speedText = `${Math.round(m.location.speedKmh)} km/h`;

      const html = `
        <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
          <div style="width:26px; height:26px; border-radius:50%; background:${color}; border:2px solid #000; box-shadow:0 0 10px ${color}; display:flex; align-items:center; justify-content:center; color:#000; font-family:monospace; font-weight:900; font-size:11px;">
            ${initial}
          </div>
          <div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:9px; font-weight:bold; padding:0 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.8);">
            ${m.name}: ${speedText}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `friend-marker-${m.riderId}`,
        html,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      let marker = friendMarkersRef.current.get(m.riderId);
      if (!marker) {
        marker = L.marker(pos, { icon, zIndexOffset: 900 }).addTo(map);
        friendMarkersRef.current.set(m.riderId, marker);
      } else {
        marker.setIcon(icon);
        marker.setLatLng(pos);
      }
    });

    friendMarkersRef.current.forEach((marker, id) => {
      if (!groupMembers.some(m => m.riderId === id)) {
        marker.remove();
        friendMarkersRef.current.delete(id);
      }
    });
  }, [groupMembers]);

  // Recenter map bounds
  const recenterMap = () => {
    if (!mapInstanceRef.current) return;
    const allCoords = analysis.points.map(p => [p.lat, p.lon] as L.LatLngTuple);
    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(allCoords, { padding: [36, 36] });
    }
  };

  // Styling helpers based on theme
  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const scrubBarBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const subText = isLight ? 'text-slate-600' : 'text-[#8f9ca8]';
  const buttonBg = isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-[#1c2633] border-[#2a3a4d] text-[#8f9ca8] hover:text-white';
  const maxTopSpeedRef = Math.max(analysis.maxSpeedKmh, 40);
  const lowThreshKmh = Math.round(maxTopSpeedRef * 0.55);
  const highThreshKmh = Math.round(maxTopSpeedRef * 0.80);

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden flex flex-col shadow-xl ${cardBg}`}>
      {/* Map Header Toolbar — Streamlined & Glanceable */}
      <div className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap ${headerBg}`}>
        {/* Route mode & Display toggles */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap max-w-full">
          {/* Out & Back Route Mode Selector (When out-and-back route detected) */}
          {turnaroundIndex > 0 && (
            <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
              <button
                type="button"
                onClick={() => setRouteMode('all')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors ${routeMode === 'all'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                  }`}
                title="Full ride with speed gradient"
              >
                <span className="hidden sm:inline">Speed Heatmap</span>
                <span className="sm:hidden">Heatmap</span>
              </button>
              <button
                type="button"
                onClick={() => setRouteMode('split')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors ${routeMode === 'split'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                  }`}
                title="Distinguish Outbound (Cyan) vs Return (Rose) legs side-by-side"
              >
                <span className="hidden sm:inline">Split Out / Back</span>
                <span className="sm:hidden">Split</span>
              </button>
              <button
                type="button"
                onClick={() => setRouteMode('outbound')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors hidden sm:inline-block ${routeMode === 'outbound'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                  }`}
                title="Only view outbound leg"
              >
                Outbound
              </button>
              <button
                type="button"
                onClick={() => setRouteMode('return')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors hidden sm:inline-block ${routeMode === 'return'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                  }`}
                title="Only view return leg"
              >
                Return
              </button>
            </div>
          )}

          {/* Toggle Stops */}
          <button
            type="button"
            id="btn-toggle-pit-stops"
            onClick={() => setShowPitStops(!showPitStops)}
            className={`px-2 sm:px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${showPitStops
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : buttonBg
              }`}
            title="Toggle stationary pit stop pins on the map"
            aria-label="Toggle pit stops"
          >
            <MapPin className="w-3 h-3" />
            <span>Stops ({analysis.pitStops.length})</span>
          </button>
        </div>
      </div>

      {/* Map DOM Element with Floating Controls */}
      <div className="relative w-full flex-1 min-h-0 [isolation:isolate]">
        <div
          ref={mapContainerRef}
          id="leaflet-map-canvas"
          className={`w-full h-[280px] sm:h-[360px] md:h-[440px] landscape:h-[220px] sm:landscape:h-[230px] transition-all ${
            isLight ? 'light-leaflet-container' : ''
          }`}
        />

        {/* Floating Map Layer FAB */}
        <div className="absolute top-3 right-3 z-[400]">
          <button
            type="button"
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            title="Switch Map Style (Street / Satellite / Dark)"
            aria-label="Switch map tile style"
            className={`w-9 h-9 rounded-full border shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${isLight
                ? 'bg-white/95 hover:bg-slate-50 text-sky-700 border-slate-300'
                : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border-slate-700/80'
              }`}
          >
            <Layers className="w-4 h-4" />
          </button>

          {isLayersOpen && (
            <div className={`absolute right-0 top-11 border rounded-xl p-1.5 shadow-2xl flex flex-col gap-1 w-40 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${isLight ? 'bg-white/95 border-slate-300' : 'bg-slate-900/95 border-slate-700'
              }`}>
              <button
                type="button"
                onClick={() => { setMapStyle('osm'); setIsLayersOpen(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mapStyle === 'osm'
                    ? 'bg-sky-500 text-slate-950'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                  }`}
              >
                <span>Street</span>
                {mapStyle === 'osm' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => { setMapStyle('satellite'); setIsLayersOpen(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mapStyle === 'satellite'
                    ? 'bg-sky-500 text-slate-950'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                  }`}
              >
                <span>Satellite</span>
                {mapStyle === 'satellite' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => { setMapStyle('dark'); setIsLayersOpen(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mapStyle === 'dark'
                    ? 'bg-sky-500 text-slate-950'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                  }`}
              >
                <span>Dark</span>
                {mapStyle === 'dark' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => { setMapStyle('sunlight'); setIsLayersOpen(false); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${mapStyle === 'sunlight'
                    ? 'bg-sky-500 text-slate-950'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                  }`}
              >
                <span>Sunlight</span>
                {mapStyle === 'sunlight' && <Check className="w-3.5 h-3.5" />}
              </button>

              <div className={`my-0.5 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`} />

              <button
                type="button"
                id="btn-toggle-milestones"
                onClick={() => setShowMilestones(!showMilestones)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  showMilestones
                    ? isLight ? 'bg-sky-50 text-sky-700' : 'bg-sky-500/20 text-sky-300'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Km Markers</span>
                {showMilestones && <Check className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                id="btn-toggle-heatmap-legend"
                onClick={() => setShowHeatmapLegend(!showHeatmapLegend)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  showHeatmapLegend
                    ? isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300'
                    : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Speed Legend</span>
                {showHeatmapLegend && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Floating Zoom (desktop) & Recenter Controls on Bottom Right */}
        <div className="absolute bottom-4 right-3 z-[400] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              mapInstanceRef.current?.zoomIn();
            }}
            title="Zoom In"
            aria-label="Zoom in map"
            className={`hidden md:flex w-9 h-9 rounded-xl border shadow-xl items-center justify-center font-black text-lg cursor-pointer active:scale-95 transition-all ${isLight ? 'bg-white/95 hover:bg-slate-50 text-sky-700 border-slate-300' : 'bg-slate-900/90 hover:bg-slate-800 text-sky-400 border-slate-700/80'
              }`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              mapInstanceRef.current?.zoomOut();
            }}
            title="Zoom Out"
            aria-label="Zoom out map"
            className={`hidden md:flex w-9 h-9 rounded-xl border shadow-xl items-center justify-center font-black text-lg cursor-pointer active:scale-95 transition-all ${isLight ? 'bg-white/95 hover:bg-slate-50 text-sky-700 border-slate-300' : 'bg-slate-900/90 hover:bg-slate-800 text-sky-400 border-slate-700/80'
              }`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              recenterMap();
            }}
            title="Recenter track"
            aria-label="Recenter route on map"
            className={`w-9 h-9 rounded-xl border shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${isLight ? 'bg-white/95 hover:bg-slate-50 text-sky-700 border-slate-300' : 'bg-slate-900/90 hover:bg-slate-800 text-sky-400 border-slate-700/80'
              }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Speed Heatmap Legend */}
        {showHeatmapLegend && routeMode === 'all' && (
          <div className={`absolute top-3 left-3 z-[400] max-w-[calc(100%-3.75rem)] flex-wrap backdrop-blur-md border rounded-lg px-2 py-1 shadow-xl flex items-center gap-x-2 gap-y-1 text-[10px] font-mono select-none ${isLight ? 'bg-white/95 border-slate-300 text-slate-700' : 'bg-slate-900/90 border-slate-700/80 text-slate-300'
            }`}>
            <span className="font-bold hidden sm:inline">Speed:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shadow-xs" />
              <span className="telemetry-num">&le; {lowThreshKmh} km/h</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block shadow-xs" />
              <span className="telemetry-num">{lowThreshKmh}–{highThreshKmh} km/h</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block shadow-xs" />
              <span className="telemetry-num">&gt; {highThreshKmh} km/h</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHeatmapLegend(false)}
              aria-label="Hide speed heatmap legend"
              className={`ml-0.5 cursor-pointer ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              title="Hide legend"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* SPEED-COLORED SCRUBBER & PLAYBACK CONTROLS */}
      <div className={`p-3 sm:p-4 border-t space-y-2.5 transition-all ${scrubBarBg}`}>
        {/* COMPACT MODE: Minimal sleek speed line with live pill & play button */}
        {!isScrubberExpanded ? (
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            <button
              type="button"
              id="btn-scrubber-play-compact"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pause ride simulation' : 'Play ride simulation'}
              className={`p-2 rounded-xl font-bold text-xs flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0 ${isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                }`}
              title={isPlaying ? 'Pause simulation (Space)' : 'Play simulation (Space)'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            {/* Clickable Clean Minimal Progress Track */}
            <div
              ref={scrubberBarRef}
              id="scrubber-bar-track-compact"
              onClick={handleScrubberClick}
              onMouseMove={handleScrubberMouseMove}
              onMouseLeave={handleScrubberMouseLeave}
              onTouchStart={handleScrubberTouch}
              onTouchMove={handleScrubberTouch}
              onTouchEnd={handleScrubberTouchEnd}
              className={`relative flex-1 h-3 rounded-full cursor-pointer overflow-hidden border shadow-inner group touch-none select-none ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-900 border-slate-700/60'
                }`}
              title="Click or drag to scrub route"
            >
              {/* Progress Fill in vibrant sky/cyan */}
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-full transition-all"
                style={{ width: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
              />

              {/* Chapter Notches */}
              {pitStopNotches.map(pit => (
                <div
                  key={pit.id}
                  className="absolute top-0 bottom-0 w-1 bg-amber-400 pointer-events-none z-10"
                  style={{ left: `${pit.pct}%` }}
                />
              ))}

              {/* Progress Playhead Pip */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-sky-400 shadow-[0_0_8px_#38bdf8] pointer-events-none -ml-1.5 transition-all"
                style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
              />
            </div>

            {/* Live Readout Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 font-mono text-xs telemetry-num">
              <span className={`font-black ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                {Math.round(currentPoint.speedKmh)} <span className="text-[10px] font-normal">km/h</span>
              </span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>•</span>
              <span className={`text-[11px] font-bold hidden sm:inline-flex items-center gap-1 ${currentGradient > 2
                  ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                  : currentGradient < -2
                    ? isLight ? 'text-amber-700' : 'text-amber-400'
                    : subText
                }`}>
                <Mountain className="w-3 h-3" />
                <span>{currentGradient > 0 ? `+${currentGradient.toFixed(1)}%` : `${currentGradient.toFixed(1)}%`}</span>
              </span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>•</span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>
                {currentPoint.distanceFromStartKm.toFixed(1)} km
              </span>
            </div>

            {/* Expand Toggle */}
            <button
              type="button"
              id="btn-scrubber-expand"
              onClick={() => setIsScrubberExpanded(true)}
              aria-label="Expand full playback controls"
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono shrink-0 ${buttonBg}`}
              title="Expand full playback controls"
            >
              <ChevronUp className={`w-3.5 h-3.5 ${isLight ? 'text-sky-700' : 'text-sky-400'}`} />
              <span className="hidden sm:inline font-bold">Full Controls</span>
            </button>
          </div>
        ) : (
          /* EXPANDED MODE: Full speed-colored scrubber with chapter marks & telemetry */
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Floating Scrubber Mini-HUD for Mobile Thumb Scrubbing */}
            <div className={`flex items-center justify-between text-[11px] sm:text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors telemetry-num ${isLight
                ? 'bg-sky-50 border-sky-200 text-sky-900 shadow-sm'
                : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
              }`}>
              <div className="flex items-center gap-2 font-bold truncate">
                <span className={`inline-flex items-center gap-1 ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                  <Zap className="w-3 h-3" />
                  {currentPoint.speedKmh.toFixed(1)} km/h
                </span>
                <span className="opacity-30">|</span>
                <span className="inline-flex items-center gap-1">
                  <Mountain className="w-3 h-3" />
                  {currentPoint.ele !== null ? `${Math.round(currentPoint.ele)}m` : '—'}
                </span>
                <span className="opacity-30">|</span>
                <span className={
                  currentGradient > 2
                    ? isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'
                    : currentGradient < -2
                      ? isLight ? 'text-amber-700 font-bold' : 'text-amber-400 font-bold'
                      : subText
                }>
                  {currentGradient > 0 ? `+${currentGradient.toFixed(1)}%` : `${currentGradient.toFixed(1)}%`}
                </span>
              </div>
              <div className="flex items-center gap-2 font-bold shrink-0">
                <span className={`inline-flex items-center gap-1 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  <Gauge className="w-3 h-3" />
                  {currentPoint.estimatedLeanAngle ? `${Math.round(currentPoint.estimatedLeanAngle)}° lean` : '0°'}
                </span>
                <span className="opacity-30">|</span>
                <span className={`inline-flex items-center gap-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <MapPin className="w-3 h-3" />
                  {currentPoint.distanceFromStartKm.toFixed(1)} km
                </span>
                <button
                  type="button"
                  id="btn-scrubber-hud-collapse"
                  onClick={() => setIsScrubberExpanded(false)}
                  aria-label="Collapse playback bar"
                  className={`ml-1 p-1 rounded cursor-pointer transition-colors ${isLight ? 'hover:bg-sky-200/70 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-700/30 text-slate-400 hover:text-white'
                    }`}
                  title="Collapse scrubber bar"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Speed Scrubber Container with Hover Tooltip */}
            <div className="space-y-1 relative">
              {/* Floating Hover Preview Card */}
              {hoverScrub && (
                <div
                  className={`absolute -top-11 z-40 -translate-x-1/2 pointer-events-none px-2.5 py-1 rounded-lg border shadow-2xl font-mono text-[10px] whitespace-nowrap flex items-center gap-2 telemetry-num ${isLight ? 'bg-white text-slate-900 border-sky-400' : 'bg-[#0f172a] text-white border-sky-400/60'
                    }`}
                  style={{ left: `${hoverScrub.pct}%` }}
                >
                  <div className="flex items-center gap-1 font-bold">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: getSpeedColor(hoverScrub.pt.speedKmh, analysis.maxSpeedKmh) }}
                    />
                    <span className={isLight ? 'text-sky-700' : 'text-sky-400'}>{hoverScrub.pt.speedKmh.toFixed(1)} km/h</span>
                  </div>
                  <span className={subText}>|</span>
                  <span>{hoverScrub.pt.distanceFromStartKm.toFixed(1)} km</span>
                  <span className={subText}>|</span>
                  <span>{formatTime(getElapsedTime(hoverScrub.idx))}</span>
                </div>
              )}

              {/* The Timeline Track */}
              <div
                ref={scrubberBarRef}
                id="scrubber-bar-track-expanded"
                onClick={handleScrubberClick}
                onMouseMove={handleScrubberMouseMove}
                onMouseLeave={handleScrubberMouseLeave}
                onTouchStart={handleScrubberTouch}
                onTouchMove={handleScrubberTouch}
                onTouchEnd={handleScrubberTouchEnd}
                className={`relative w-full h-3.5 rounded-lg cursor-pointer overflow-hidden border shadow-inner group touch-none select-none ${isLight ? 'bg-slate-200 border-slate-300' : 'bg-slate-900 border-slate-700/80'
                  }`}
                title="Click or drag to scrub route"
              >
                {/* Progress Fill in vibrant sky/cyan */}
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 rounded-lg transition-all"
                  style={{ width: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                />

                {/* Chapter Notches for Pit-Stops */}
                {pitStopNotches.map(pit => (
                  <div
                    key={pit.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const globalIdx = activePoints.findIndex(p => Math.abs(p.distanceFromStartKm - pit.distanceKm) < 0.2);
                      if (globalIdx >= 0) onScrubChange(globalIdx);
                    }}
                    title={`Stop: ${pit.name} at ${pit.distanceKm.toFixed(1)} km`}
                    className="absolute top-0 bottom-0 w-1.5 bg-amber-400 border-x border-black/80 hover:w-2.5 hover:bg-amber-300 transition-all z-20 cursor-pointer"
                    style={{ left: `${pit.pct}%` }}
                  />
                ))}

                {/* Glowing Playhead Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-sky-400 shadow-[0_0_12px_#38bdf8] pointer-events-none -ml-2 transition-all z-30 flex items-center justify-center"
                  style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                </div>
              </div>

              {/* Timestamp & Distance Scrubber Legend Bar */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono gap-1 telemetry-num">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-bold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>{formatTime(elapsedSeconds)}</span>
                  <span className={subText}>/</span>
                  <span className={subText}>{formatTime(totalDuration)}</span>
                </div>

                {/* Pit-stop chapter legend pill */}
                {analysis.pitStops.length > 0 && (
                  <div className={`hidden md:flex items-center gap-1 text-[10px] font-mono ${isLight ? 'text-amber-700' : 'text-amber-400/90'}`}>
                    <Coffee className="w-3 h-3" />
                    <span>{analysis.pitStops.length} chapter stops marked on track</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 sm:gap-3 truncate text-right">
                  <span className="truncate">
                    {currentPoint.distanceFromStartKm.toFixed(1)} km / {analysis.totalDistanceKm.toFixed(1)} km
                  </span>
                  <span className={`shrink-0 ${subText}`}>
                    ({Math.round((currentIndex / Math.max(1, activePoints.length - 1)) * 100)}%)
                  </span>
                </div>
              </div>

              {/* DUAL TELEMETRY PROFILES: SPEED GRAPH + ELEVATION GRAPH */}
              <div className="space-y-2 pt-2 pb-1">
                {/* 1. Interactive Speed Profile Strip */}
                {speedProfileData && (
                  <div>
                    <div className={`flex items-center justify-between text-[10px] font-mono pb-0.5 px-1 telemetry-num ${subText}`}>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>Min:</span>
                        <strong className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>{speedProfileData.minSpeed} {speedProfileData.speedUnit}</strong>
                      </span>
                      <span className={`text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        Speed Profile <span className={`${subText} font-normal hidden sm:inline`}>(Avg: {speedProfileData.avgSpeed} {speedProfileData.speedUnit})</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>Peak:</span>
                        <strong className={isLight ? 'text-emerald-700' : 'text-emerald-400'}>{speedProfileData.maxSpeed} {speedProfileData.speedUnit}</strong>
                      </span>
                    </div>
                    <div
                      id="speed-profile-interactive-strip"
                      className={`relative w-full h-11 rounded-lg border overflow-hidden cursor-pointer group shadow-inner touch-none select-none ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950/80 border-slate-800'
                        }`}
                      onClick={handleScrubberClick}
                      onMouseMove={handleScrubberMouseMove}
                      onMouseLeave={handleScrubberMouseLeave}
                      onTouchStart={handleScrubberTouch}
                      onTouchMove={handleScrubberTouch}
                      onTouchEnd={handleScrubberTouchEnd}
                      title="Click or drag to scrub speed profile"
                    >
                      <svg
                        viewBox="0 0 100 44"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        <defs>
                          <linearGradient id="speedProfileGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isLight ? '#059669' : '#10b981'} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={isLight ? '#059669' : '#10b981'} stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={speedProfileData.areaPath}
                          fill="url(#speedProfileGradient)"
                        />
                        <polyline
                          points={speedProfileData.pointsStr}
                          fill="none"
                          stroke={isLight ? '#059669' : '#10b981'}
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Synchronized Playhead Cursor Line */}
                      <div
                        className="absolute inset-y-0 w-0.5 bg-amber-500 shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all z-10"
                        style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 2. Interactive Elevation Profile Strip */}
                {elevationProfileData && (
                  <div>
                    <div className={`flex items-center justify-between text-[10px] font-mono pb-0.5 px-1 telemetry-num ${subText}`}>
                      <span className="flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3" />
                        <span>Min:</span>
                        <strong className={isLight ? 'text-sky-700' : 'text-sky-300'}>{elevationProfileData.minEle}{elevationProfileData.elevUnit}</strong>
                      </span>
                      <span className={`text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                        Elevation Profile <span className={`${subText} font-normal hidden sm:inline`}>(+{elevationProfileData.elevGain}{elevationProfileData.elevUnit} Gain)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Mountain className="w-3 h-3" />
                        <span>Max:</span>
                        <strong className={isLight ? 'text-sky-700' : 'text-sky-300'}>{elevationProfileData.maxEle}{elevationProfileData.elevUnit}</strong>
                      </span>
                    </div>
                    <div
                      id="elevation-profile-interactive-strip"
                      className={`relative w-full h-11 rounded-lg border overflow-hidden cursor-pointer group shadow-inner touch-none select-none ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950/80 border-slate-800'
                        }`}
                      onClick={handleScrubberClick}
                      onMouseMove={handleScrubberMouseMove}
                      onMouseLeave={handleScrubberMouseLeave}
                      onTouchStart={handleScrubberTouch}
                      onTouchMove={handleScrubberTouch}
                      onTouchEnd={handleScrubberTouchEnd}
                      title="Click or drag to scrub elevation profile"
                    >
                      <svg
                        viewBox="0 0 100 44"
                        preserveAspectRatio="none"
                        className="w-full h-full"
                      >
                        <defs>
                          <linearGradient id="eleProfileGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isLight ? '#0284c7' : '#38bdf8'} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={isLight ? '#0284c7' : '#38bdf8'} stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={elevationProfileData.areaPath}
                          fill="url(#eleProfileGradient)"
                        />
                        <polyline
                          points={elevationProfileData.pointsStr}
                          fill="none"
                          stroke={isLight ? '#0284c7' : '#38bdf8'}
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Synchronized Playhead Vertical Line */}
                      <div
                        className="absolute inset-y-0 w-0.5 bg-amber-500 shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all z-10"
                        style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Playback Controls and Telemetry Snapshot */}
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1.5 border-t ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-scrubber-reset"
                  onClick={() => onScrubChange(0)}
                  title="Reset to Start (Home)"
                  aria-label="Reset playback to start"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  id="btn-scrubber-rewind"
                  onClick={() => onScrubChange(Math.max(0, currentIndex - 20))}
                  title="Step Back 20 fixes (Shift+Left)"
                  aria-label="Rewind 20 track points"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  id="btn-scrubber-play-expanded"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause Simulation (Space)' : 'Play Simulation (Space)'}
                  aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                    }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  type="button"
                  id="btn-scrubber-ffwd"
                  onClick={() => onScrubChange(Math.min(activePoints.length - 1, currentIndex + 20))}
                  title="Step Forward 20 fixes (Shift+Right)"
                  aria-label="Fast-forward 20 track points"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                {/* Playback Speed Selector */}
                <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
                  {[1, 2, 5, 10].map(spd => (
                    <button
                      type="button"
                      key={spd}
                      id={`btn-scrubber-speed-${spd}`}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${playbackSpeed === spd
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : subText
                        }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Loop & Follow-Marker toggles */}
                <button
                  type="button"
                  id="btn-scrubber-loop"
                  onClick={() => setIsLooping(!isLooping)}
                  title="Loop playback continuously"
                  aria-label="Toggle loop playback"
                  aria-pressed={isLooping}
                  className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1 ${isLooping
                      ? isLight ? 'bg-sky-50 border-sky-300 text-sky-700 font-bold' : 'bg-sky-500/15 border-sky-500/40 text-sky-300 font-bold'
                      : buttonBg
                    }`}
                >
                  <Repeat className="w-3 h-3" />
                  <span className="hidden sm:inline">Loop</span>
                </button>

                <button
                  type="button"
                  id="btn-scrubber-follow"
                  onClick={() => setFollowBike(!followBike)}
                  title="Keep camera centered on rider marker"
                  aria-label="Toggle follow marker camera"
                  aria-pressed={followBike}
                  className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1 ${followBike
                      ? isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                      : buttonBg
                    }`}
                >
                  <Crosshair className="w-3 h-3" />
                  <span className="hidden sm:inline">Follow</span>
                </button>
              </div>

              {/* Collapse Button */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  id="btn-scrubber-collapse"
                  onClick={() => setIsScrubberExpanded(false)}
                  aria-label="Minimize scrubber controls"
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1 ${buttonBg}`}
                  title="Collapse scrubber to compact bar"
                >
                  <ChevronDown className={`w-3.5 h-3.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} />
                  <span className="hidden sm:inline">Minimize</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

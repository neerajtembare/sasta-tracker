import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { RideAnalysis, TrackPoint, PitStop, AppTheme } from '../types';
import { interpolateTrackPoints, snapToRoadsOSRM } from '../utils/pathSmoother';
import { haversineDistance } from '../utils/gpxParser';
import { 
  Maximize2, 
  Minimize2, 
  Layers, 
  MapPin, 
  Coffee, 
  Fuel, 
  Utensils, 
  Camera, 
  Wrench,
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Compass,
  Crosshair,
  FastForward,
  Rewind,
  Repeat,
  Sparkles,
  Sliders,
  CheckCircle2,
  Route,
  Plus,
  ArrowRight,
  ArrowLeftRight,
  ChevronUp,
  ChevronDown,
  Activity,
  SlidersHorizontal
} from 'lucide-react';

interface MapViewerProps {
  analysis: RideAnalysis;
  scrubIndex: number | null;
  onScrubChange: (index: number | null) => void;
  onOpenAddStopAtPoint?: (point: TrackPoint) => void;
  onEditStop?: (stop: PitStop) => void;
  focusedCoordinate?: { lat: number; lon: number; label?: string } | null;
  theme?: AppTheme;
  onOpenDiagnostics?: () => void;
}

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
  onOpenAddStopAtPoint,
  onEditStop,
  focusedCoordinate,
  theme = 'dark',
  onOpenDiagnostics,
}) => {
  const isLight = theme === 'light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const scrubberMarkerRef = useRef<L.Marker | null>(null);
  const focusedMarkerRef = useRef<L.Marker | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const snappedPolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);
  const currentMapStyleRef = useRef<string>('');
  const scrubIndexRef = useRef<number | null>(scrubIndex);
  scrubIndexRef.current = scrubIndex;

  // Base Map Tile Style (100% free, zero API key dependencies)
  // CartoDB free basemaps: Dark Matter (dark) and Voyager (light)
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'osm' | 'street'>(
    isLight ? 'street' : 'dark'
  );

  // Sync map style when global theme changes unless user explicitly picked satellite/osm
  useEffect(() => {
    if (isLight && mapStyle === 'dark') {
      setMapStyle('street');
    } else if (!isLight && mapStyle === 'street') {
      setMapStyle('dark');
    }
  }, [isLight]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  // Default pit stops to TRUE so riders immediately see and can click/edit stops
  const [showPitStops, setShowPitStops] = useState(true);
  const [showPointDots, setShowPointDots] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);
  const [showHeatmapLegend, setShowHeatmapLegend] = useState(true);

  // Out & Back Route Detection and Mode:
  // 'all' = Standard speed heatmap
  // 'split' = Outbound in Cyan, Return in Coral (with distinct visual offset)
  // 'outbound' = Outbound only
  // 'return' = Return only
  const [routeMode, setRouteMode] = useState<'all' | 'split' | 'outbound' | 'return'>('all');

  // Playback & Video Scrubber states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 0.5x, 1x, 2x, 5x, 10x
  const [isLooping, setIsLooping] = useState(true);
  const [followBike, setFollowBike] = useState(false);
  const [isSmoothed, setIsSmoothed] = useState(false);
  const [snappedRoads, setSnappedRoads] = useState<L.LatLngTuple[] | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);

  // YouTube-Style Scrubber & Collapsible tray states
  // Default to compact mode — less overwhelming for new users
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

  // Points to use for simulation/scrubbing (raw vs spline-smoothed)
  const activePoints = useMemo(() => {
    if (isSmoothed && analysis.points.length > 3) {
      return interpolateTrackPoints(analysis.points, 40);
    }
    return analysis.points;
  }, [analysis.points, isSmoothed]);

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
      pointsStr,
      areaPath,
      sampled
    };
  }, [activePoints]);

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

      L.control.zoom({ position: 'bottomright' }).addTo(map);
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

      if (mapStyle === 'dark') {
        tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; CARTO',
        }).addTo(map);
      } else if (mapStyle === 'street') {
        tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '&copy; CARTO',
        }).addTo(map);
      } else if (mapStyle === 'satellite') {
        tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18,
        }).addTo(map);
        overlayTileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18,
          opacity: 0.85,
        }).addTo(map);
      } else if (mapStyle === 'osm') {
        tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
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
    if (snappedPolylineRef.current) {
      snappedPolylineRef.current = null;
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
        html: `<div style="padding:3px 7px; background:#0f172a; border:2px solid #f59e0b; color:#f59e0b; font-family:monospace; font-weight:bold; font-size:10px; border-radius:12px; box-shadow:0 0 10px rgba(245,158,11,0.5); white-space:nowrap;">🔄 TURNAROUND</div>`,
        iconSize: [100, 22],
        iconAnchor: [50, 11],
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
              <strong style="color:${chunk.color}; font-size:12px;">~${chunk.avgSpeed.toFixed(0)} km/h</strong><br/>
              <span style="opacity:0.8; font-size:10px;">km ${chunk.startDist.toFixed(1)} – ${chunk.endDist.toFixed(1)}</span>
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
      L.marker([startPt.lat, startPt.lon], { icon: startIcon })
        .addTo(map)
        .bindPopup(`<b>${startLabel}</b><br/>${startPt.time ? new Date(startPt.time).toLocaleTimeString() : ''}`);

      // Finish Marker
      const finishIcon = L.divIcon({
        className: 'custom-finish-marker',
        html: `<div style="width:26px; height:26px; background:#0f172a; border:2px solid #f43f5e; color:#f43f5e; border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:monospace; font-weight:900; font-size:11px; box-shadow:0 0 10px rgba(244,63,94,0.5);">FIN</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([endPt.lat, endPt.lon], { icon: finishIcon })
        .addTo(map)
        .bindPopup(`<b>${finishLabel}</b><br/>${endPt.time ? new Date(endPt.time).toLocaleTimeString() : ''}`);

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
      const getCategoryEmoji = (cat: string) => {
        switch (cat) {
          case 'chai': return '☕';
          case 'fuel': return '⛽';
          case 'dhaba': return '🍛';
          case 'scenic': return '📸';
          case 'mechanic': return '🔧';
          case 'rest': return '🛑';
          case 'traffic': return '🚦';
          default: return '📍';
        }
      };

      analysis.pitStops.forEach(pit => {
        const emoji = getCategoryEmoji(pit.category);
        // Clean, compact circular pin badge — clicks open editor modal
        const pitIcon = L.divIcon({
          className: 'pit-marker',
          html: `<div style="width:28px; height:28px; border-radius:50%; background:#0f172a; border:2px solid #f59e0b; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:13px; box-shadow:0 2px 8px rgba(0,0,0,0.6); cursor:pointer;">
            ${emoji}
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([pit.lat, pit.lon], { icon: pitIcon }).addTo(map);

        // Hover tooltip for quick preview
        marker.bindTooltip(
          `<div style="font-family:monospace; font-size:11px; padding:2px 6px;">${emoji} ${pit.name} (${Math.round(pit.durationSeconds / 60)}m) — Click to edit</div>`,
          { direction: 'top', offset: [0, -14] }
        );

        // Click opens StopEditorModal instead of a static popup
        marker.on('click', () => {
          onEditStop?.(pit);
        });
      });
    }

    // 7. Distance Milestone Markers (every 10km or 25km)
    if (showMilestones && pts.length > 1) {
      const stepKm = analysis.totalDistanceKm > 60 ? 25 : 10;
      let nextMilestone = stepKm;
      for (let i = 1; i < pts.length; i++) {
        const ptDist = pts[i].distanceFromStartKm ?? 0;
        if (ptDist >= nextMilestone && ptDist < analysis.totalDistanceKm - 1) {
          const msIcon = L.divIcon({
            className: 'custom-milestone-marker',
            html: `<div style="padding:2px 6px; background:#0f172a; border:1.5px solid #38bdf8; color:#38bdf8; border-radius:6px; font-family:monospace; font-weight:800; font-size:10px; box-shadow:0 2px 6px rgba(0,0,0,0.6); white-space:nowrap;">🚩 ${Math.round(nextMilestone)}k</div>`,
            iconSize: [42, 20],
            iconAnchor: [21, 10],
          });
          L.marker([pts[i].lat, pts[i].lon], { icon: msIcon })
            .addTo(map)
            .bindTooltip(`Milestone: ${Math.round(nextMilestone)} km reached`, { direction: 'top', offset: [0, -10] });
          nextMilestone += stepKm;
        }
      }
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

  }, [analysis, mapStyle, showPitStops, showPointDots, routeMode, turnaroundIndex, isLight, showMilestones]);

  // Clean up Leaflet map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
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
      const speed = pt.speedKmh.toFixed(0);

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
            ${speed} km/h
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
        <div style="width:30px; height:30px; border-radius:50%; background:#0f172a; border:2px solid #f59e0b; color:#f59e0b; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 0 12px rgba(245,158,11,0.6); z-index:10;">
          📍
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
      popupDiv.style.cssText = 'font-family:monospace; font-size:12px; font-weight:bold; color:#0f172a; padding:3px 6px;';
      popupDiv.textContent = focusedCoordinate.label;
      marker.bindPopup(popupDiv).openPopup();
    }

    focusedMarkerRef.current = marker;
  }, [focusedCoordinate]);

  // Recenter map bounds
  const recenterMap = () => {
    if (!mapInstanceRef.current) return;
    const allCoords = analysis.points.map(p => [p.lat, p.lon] as L.LatLngTuple);
    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(allCoords, { padding: [36, 36] });
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  };

  // OSRM Snap Roads
  const handleSnapRoads = async () => {
    if (snappedRoads) {
      if (snappedPolylineRef.current) {
        snappedPolylineRef.current.remove();
        snappedPolylineRef.current = null;
      }
      setSnappedRoads(null);
      return;
    }
    setIsSnapping(true);
    try {
      const snapped = await snapToRoadsOSRM(analysis.points);
      if (snapped && snapped.length > 0) {
        const coords: L.LatLngTuple[] = snapped.map(p => [p.lat, p.lon]);
        setSnappedRoads(coords);
        if (mapInstanceRef.current) {
          if (snappedPolylineRef.current) {
            snappedPolylineRef.current.remove();
          }
          const polyline = L.polyline(coords, {
            color: '#38bdf8',
            weight: 4,
            opacity: 0.9,
            dashArray: '4, 4',
          }).addTo(mapInstanceRef.current);
          snappedPolylineRef.current = polyline;
        }
      }
    } catch (e) {
      console.warn('Snap roads error:', e);
    } finally {
      setIsSnapping(false);
    }
  };

  // Styling helpers based on theme
  const cardBg = isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-100' : 'bg-[#0d131a] border-[#1e2a38] text-white shadow-black/40';
  const headerBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const scrubBarBg = isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#131b24] border-[#1e2a38]';
  const subText = isLight ? 'text-slate-500' : 'text-[#8f9ca8]';
  const buttonBg = isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-[#1c2633] border-[#2a3a4d] text-[#8f9ca8] hover:text-white';

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden flex flex-col shadow-xl ${cardBg} ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-[100dvh]' : ''
      }`}
    >
      {/* Map Header Toolbar — Simplified: no duplicate ride name, specs, or badges */}
      <div className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-2 flex-wrap ${headerBg}`}>
        {/* Map view & Route mode controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap max-w-full">
          {/* Out & Back Route Mode Selector (When out-and-back route detected) */}
          {turnaroundIndex > 0 && (
            <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
              <button
                onClick={() => setRouteMode('all')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                  routeMode === 'all'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                }`}
                title="Full ride with speed gradient"
              >
                <span className="hidden sm:inline">Speed Heatmap</span>
                <span className="sm:hidden">Heatmap</span>
              </button>
              <button
                onClick={() => setRouteMode('split')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                  routeMode === 'split'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                }`}
                title="Distinguish Outbound (Cyan) vs Return (Rose) legs side-by-side"
              >
                <span className="hidden sm:inline">Split Out / Back</span>
                <span className="sm:hidden">Split</span>
              </button>
              <button
                onClick={() => setRouteMode('outbound')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors hidden sm:inline-block ${
                  routeMode === 'outbound'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                }`}
                title="Only view outbound leg"
              >
                Outbound
              </button>
              <button
                onClick={() => setRouteMode('return')}
                className={`px-2 py-1 rounded cursor-pointer transition-colors hidden sm:inline-block ${
                  routeMode === 'return'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                    : subText
                }`}
                title="Only view return leg"
              >
                Return
              </button>
            </div>
          )}

          {/* Map Layer Switcher */}
          <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
            <button
              id="map-style-standard"
              onClick={() => setMapStyle(isLight ? 'street' : 'dark')}
              className={`px-2 py-1 rounded uppercase cursor-pointer transition-colors ${
                mapStyle === 'dark' || mapStyle === 'street'
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-xs'
                  : subText
              }`}
              title={isLight ? 'Stadia Alidade Smooth Light' : 'Stadia Alidade Smooth Dark'}
            >
              {isLight ? 'Light' : 'Dark'}
            </button>
            <button
              id="map-style-satellite"
              onClick={() => setMapStyle('satellite')}
              className={`px-2 py-1 rounded uppercase cursor-pointer transition-colors ${
                mapStyle === 'satellite' ? 'bg-sky-500 text-slate-950 font-bold shadow-xs' : subText
              }`}
              title="ESRI World Imagery Satellite"
            >
              Satellite
            </button>
            <button
              id="map-style-osm"
              onClick={() => setMapStyle('osm')}
              className={`px-2 py-1 rounded uppercase cursor-pointer transition-colors ${
                mapStyle === 'osm' ? 'bg-sky-500 text-slate-950 font-bold shadow-xs' : subText
              }`}
              title="OpenStreetMap Standard Global Map (Free, Zero API Key)"
            >
              OSM
            </button>
          </div>

          {/* Milestones Toggle */}
          <button
            id="btn-toggle-milestones"
            onClick={() => setShowMilestones(!showMilestones)}
            title="Toggle Distance Milestones on Route"
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showMilestones
                ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                : buttonBg
            }`}
          >
            <span>🚩</span>
            <span className="hidden sm:inline">Milestones</span>
          </button>

          {/* Speed Heatmap Legend Toggle */}
          <button
            id="btn-toggle-heatmap-legend"
            onClick={() => setShowHeatmapLegend(!showHeatmapLegend)}
            title="Toggle Speed Heatmap Legend"
            className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showHeatmapLegend
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : buttonBg
            }`}
          >
            <span className="hidden sm:inline">Legend</span>
            <span className="sm:hidden">⚡</span>
          </button>

          {/* Toggle Stops */}
          <button
            id="btn-toggle-pit-stops"
            onClick={() => setShowPitStops(!showPitStops)}
            className={`px-2 sm:px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showPitStops
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : buttonBg
            }`}
            title="Toggle stationary pit stop pins on the map"
          >
            <MapPin className="w-3 h-3" />
            <span className="hidden sm:inline">Stops ({analysis.pitStops.length})</span>
            <span className="sm:hidden">{analysis.pitStops.length}</span>
          </button>

          {/* Recenter */}
          <button
            id="btn-map-recenter"
            onClick={recenterMap}
            title="Recenter track in view"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
          >
            <Navigation className="w-3.5 h-3.5 text-sky-400" />
          </button>

          {/* Fullscreen */}
          <button
            id="btn-map-fullscreen"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Map DOM Element with Floating Speed Heatmap Legend */}
      <div className="relative w-full flex-1 min-h-0">
        <div 
          ref={mapContainerRef} 
          id="leaflet-map-canvas"
          className={`w-full transition-all ${
            isFullscreen ? 'h-full min-h-[220px]' : 'h-[360px] sm:h-[460px]'
          }`}
        />

        {/* Floating Speed Heatmap Legend */}
        {showHeatmapLegend && routeMode === 'all' && (
          <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg px-2.5 py-1.5 shadow-xl flex items-center gap-2.5 text-[10px] font-mono select-none">
            <span className="font-bold text-slate-300">Speed:</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shadow-xs" />
              <span className="text-slate-300">&le; {Math.round(Math.max(analysis.maxSpeedKmh, 40) * 0.55)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block shadow-xs" />
              <span className="text-slate-300">{Math.round(Math.max(analysis.maxSpeedKmh, 40) * 0.55)}–{Math.round(Math.max(analysis.maxSpeedKmh, 40) * 0.80)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block shadow-xs" />
              <span className="text-slate-300">&gt; {Math.round(Math.max(analysis.maxSpeedKmh, 40) * 0.80)} km/h</span>
            </div>
            <button
              onClick={() => setShowHeatmapLegend(false)}
              className="ml-1 text-slate-400 hover:text-white cursor-pointer"
              title="Hide legend"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* YOUTUBE-STYLE SPEED-COLORED SCRUBBER & CONTROLS */}
      <div className={`p-3 sm:p-4 border-t space-y-2.5 transition-all ${scrubBarBg}`}>
        {/* COMPACT MODE: Minimal sleek speed line with live pill & play button */}
        {!isScrubberExpanded ? (
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            <button
              id="btn-scrubber-play-compact"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded-xl font-bold text-xs flex items-center justify-center transition-all shadow-md cursor-pointer shrink-0 ${
                isPlaying
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
              className="relative flex-1 h-3 rounded-full cursor-pointer overflow-hidden bg-slate-900 border border-slate-700/60 shadow-inner group touch-none select-none"
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
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 font-mono text-xs">
              <span className="text-sky-400 font-black">
                {currentPoint.speedKmh.toFixed(0)} <span className="text-[10px] font-normal">km/h</span>
              </span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>•</span>
              <span className={`text-[11px] font-bold ${currentGradient > 2 ? 'text-emerald-400' : currentGradient < -2 ? 'text-amber-400' : subText} hidden sm:inline`}>
                {currentGradient > 0 ? `⛰️ +${currentGradient.toFixed(1)}%` : `⛰️ ${currentGradient.toFixed(1)}%`}
              </span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>•</span>
              <span className={`text-[11px] ${subText} hidden sm:inline`}>
                {currentPoint.distanceFromStartKm.toFixed(1)} km
              </span>
            </div>

            {/* Expand Toggle */}
            <button
              id="btn-scrubber-expand"
              onClick={() => setIsScrubberExpanded(true)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono shrink-0 ${buttonBg}`}
              title="Expand full playback controls"
            >
              <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline font-bold">Full Controls</span>
            </button>
          </div>
        ) : (
          /* EXPANDED MODE: Full YouTube-style speed-colored scrubber with chapter marks & telemetry */
          <div className="space-y-2.5 animate-in fade-in duration-150">
            {/* Floating Scrubber Mini-HUD for Mobile Thumb Scrubbing */}
            <div className={`flex items-center justify-between text-[11px] sm:text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
              isLight
                ? 'bg-sky-50/80 border-sky-200 text-sky-800 shadow-sm'
                : 'bg-sky-500/10 border-sky-500/20 text-sky-300'
            }`}>
              <div className="flex items-center gap-2 font-bold truncate">
                <span className="text-sky-400">⚡ {currentPoint.speedKmh.toFixed(1)} km/h</span>
                <span className="opacity-30">|</span>
                <span>⛰️ {currentPoint.ele !== null ? `${Math.round(currentPoint.ele)}m` : '—'}</span>
                <span className="opacity-30">|</span>
                <span className={currentGradient > 2 ? 'text-emerald-400 font-bold' : currentGradient < -2 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {currentGradient > 0 ? `+${currentGradient.toFixed(1)}%` : `${currentGradient.toFixed(1)}%`}
                </span>
              </div>
              <div className="flex items-center gap-2 font-bold shrink-0">
                <span className="text-amber-400">
                  📐 {currentPoint.estimatedLeanAngle ? `${Math.round(currentPoint.estimatedLeanAngle)}° lean` : '0°'}
                </span>
                <span className="opacity-30">|</span>
                <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                  📍 {currentPoint.distanceFromStartKm.toFixed(1)} km
                </span>
                <button
                  id="btn-scrubber-hud-collapse"
                  onClick={() => setIsScrubberExpanded(false)}
                  className={`ml-1.5 p-1 rounded hover:bg-slate-700/30 text-slate-400 hover:text-white cursor-pointer transition-colors`}
                  title="Collapse scrubber bar"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* YouTube-Style Speed Scrubber Container with Hover Tooltip */}
            <div className="space-y-1 relative">
              {/* Floating Hover Preview Card */}
              {hoverScrub && (
                <div 
                  className="absolute -top-11 z-40 -translate-x-1/2 pointer-events-none px-2.5 py-1 rounded-lg bg-[#0f172a] text-white border border-sky-400/60 shadow-2xl font-mono text-[10px] whitespace-nowrap flex items-center gap-2"
                  style={{ left: `${hoverScrub.pct}%` }}
                >
                  <div className="flex items-center gap-1 font-bold">
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ background: getSpeedColor(hoverScrub.pt.speedKmh, analysis.maxSpeedKmh) }} 
                    />
                    <span className="text-sky-400">{hoverScrub.pt.speedKmh.toFixed(1)} km/h</span>
                  </div>
                  <span className="text-slate-500">|</span>
                  <span>{hoverScrub.pt.distanceFromStartKm.toFixed(1)} km</span>
                  <span className="text-slate-500">|</span>
                  <span>{formatTime(getElapsedTime(hoverScrub.idx))}</span>
                </div>
              )}

              {/* The Timeline Track - Clean High Contrast Bar without barcode stripes */}
              <div 
                ref={scrubberBarRef}
                id="scrubber-bar-track-expanded"
                onClick={handleScrubberClick}
                onMouseMove={handleScrubberMouseMove}
                onMouseLeave={handleScrubberMouseLeave}
                onTouchStart={handleScrubberTouch}
                onTouchMove={handleScrubberTouch}
                onTouchEnd={handleScrubberTouchEnd}
                className="relative w-full h-3.5 rounded-lg cursor-pointer overflow-hidden bg-slate-900 border border-slate-700/80 shadow-inner group touch-none select-none"
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
                    title={`Stop: ${pit.name} at km ${pit.distanceKm.toFixed(1)}`}
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
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono gap-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sky-400 font-bold">{formatTime(elapsedSeconds)}</span>
                  <span className={subText}>/</span>
                  <span className={subText}>{formatTime(totalDuration)}</span>
                </div>

                {/* Pit-stop chapter legend pill */}
                {analysis.pitStops.length > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-[10px] text-amber-400/90 font-mono">
                    <span>☕ {analysis.pitStops.length} chapter stops marked on track</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 sm:gap-3 truncate text-right">
                  <span className="truncate">
                    {currentPoint.distanceFromStartKm.toFixed(1)} / {analysis.totalDistanceKm.toFixed(1)} km
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
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-0.5 px-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        <span>⚡ Min:</span>
                        <strong className="text-emerald-400">{speedProfileData.minSpeed} km/h</strong>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1">
                        Speed Profile <span className="text-slate-500 font-normal hidden sm:inline">(Avg: {speedProfileData.avgSpeed} km/h)</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span>🚀 Peak:</span>
                        <strong className="text-emerald-400">{speedProfileData.maxSpeed} km/h</strong>
                      </span>
                    </div>
                    <div 
                      id="speed-profile-interactive-strip"
                      className="relative w-full h-11 bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden cursor-pointer group shadow-inner touch-none select-none"
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
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={speedProfileData.areaPath}
                          fill="url(#speedProfileGradient)"
                        />
                        <polyline
                          points={speedProfileData.pointsStr}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Synchronized Playhead Cursor Line */}
                      <div 
                        className="absolute inset-y-0 w-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all z-10"
                        style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 2. Interactive Elevation Profile Strip */}
                {elevationProfileData && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-0.5 px-1">
                      <span className="flex items-center gap-1 text-slate-400">
                        <span>📉 Min:</span>
                        <strong className="text-sky-300">{elevationProfileData.minEle}m</strong>
                      </span>
                      <span className="text-[10px] text-sky-400 font-bold tracking-wider uppercase flex items-center gap-1">
                        Elevation Profile <span className="text-slate-500 font-normal hidden sm:inline">(+{analysis.elevGainM.toFixed(0)}m Gain)</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <span>📈 Max:</span>
                        <strong className="text-sky-300">{elevationProfileData.maxEle}m</strong>
                      </span>
                    </div>
                    <div 
                      id="elevation-profile-interactive-strip"
                      className="relative w-full h-11 bg-slate-950/80 rounded-lg border border-slate-800 overflow-hidden cursor-pointer group shadow-inner touch-none select-none"
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
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
                          </linearGradient>
                        </defs>
                        <polygon
                          points={elevationProfileData.areaPath}
                          fill="url(#eleProfileGradient)"
                        />
                        <polyline
                          points={elevationProfileData.pointsStr}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>

                      {/* Synchronized Playhead Vertical Line */}
                      <div 
                        className="absolute inset-y-0 w-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all z-10"
                        style={{ left: `${(currentIndex / Math.max(1, activePoints.length - 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Playback Controls and Telemetry Snapshot */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1.5 border-t border-slate-200/20">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  id="btn-scrubber-reset"
                  onClick={() => onScrubChange(0)}
                  title="Reset to Start (Home)"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-scrubber-rewind"
                  onClick={() => onScrubChange(Math.max(0, currentIndex - 20))}
                  title="Step Back 20 fixes (Shift+Left)"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <Rewind className="w-3.5 h-3.5" />
                </button>

                <button
                  id="btn-scrubber-play-expanded"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause Simulation (Space)' : 'Play Simulation (Space)'}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  id="btn-scrubber-ffwd"
                  onClick={() => onScrubChange(Math.min(activePoints.length - 1, currentIndex + 20))}
                  title="Step Forward 20 fixes (Shift+Right)"
                  className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
                >
                  <FastForward className="w-3.5 h-3.5" />
                </button>

                {/* Playback Speed Selector */}
                <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
                  {[1, 2, 5, 10].map(spd => (
                    <button
                      key={spd}
                      id={`btn-scrubber-speed-${spd}`}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        playbackSpeed === spd
                          ? 'bg-sky-500 text-slate-950 font-bold'
                          : subText
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Collapse Button — telemetry readouts already in the mini-HUD above */}
              <div className="flex items-center justify-end">
                <button
                  id="btn-scrubber-collapse"
                  onClick={() => setIsScrubberExpanded(false)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-[10px] font-mono flex items-center gap-1 ${buttonBg}`}
                  title="Collapse scrubber to compact bar"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
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

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
  ArrowLeftRight
} from 'lucide-react';

interface MapViewerProps {
  analysis: RideAnalysis;
  scrubIndex: number | null;
  onScrubChange: (index: number | null) => void;
  onOpenAddStopAtPoint?: (point: TrackPoint) => void;
  onEditStop?: (stop: PitStop) => void;
  focusedCoordinate?: { lat: number; lon: number; label?: string } | null;
  theme?: AppTheme;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  analysis,
  scrubIndex,
  onScrubChange,
  onOpenAddStopAtPoint,
  onEditStop,
  focusedCoordinate,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const scrubberMarkerRef = useRef<L.Marker | null>(null);
  const focusedMarkerRef = useRef<L.Marker | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const snappedPolylineRef = useRef<L.Polyline | null>(null);
  const scrubIndexRef = useRef<number | null>(scrubIndex);
  scrubIndexRef.current = scrubIndex;

  // Base Map Tile Style
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'topo' | 'street'>(
    isLight ? 'street' : 'dark'
  );

  // Sync map style when global theme changes unless user explicitly picked satellite/topo
  useEffect(() => {
    if (isLight && mapStyle === 'dark') {
      setMapStyle('street');
    } else if (!isLight && mapStyle === 'street') {
      setMapStyle('dark');
    }
  }, [isLight]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  // Default pit stops to FALSE to keep the map clean and decluttered!
  const [showPitStops, setShowPitStops] = useState(false);
  const [showPointDots, setShowPointDots] = useState(false);
  const [showDirectionArrows, setShowDirectionArrows] = useState(true);

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

  const currentIndex = scrubIndex !== null ? Math.min(scrubIndex, activePoints.length - 1) : 0;
  const currentPoint = activePoints[currentIndex] || activePoints[0];

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
        const next = Math.min(activePoints.length - 1, (scrubIndexRef.current || 0) + 2);
        onScrubChange(next);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const prev = Math.max(0, (scrubIndexRef.current || 0) - 2);
        onScrubChange(prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePoints.length, onScrubChange]);

  // Speed to color function
  const getSpeedColor = (speedKmh: number, maxSpeedKmh: number) => {
    if (speedKmh < 2.0) return '#64748b'; // Slate: Stationary
    const top = Math.max(maxSpeedKmh, 40);
    const ratio = Math.min(1, Math.max(0, speedKmh / top));
    if (ratio < 0.25) return '#0284c7'; // Deep Sky
    if (ratio < 0.55) return '#10b981'; // Emerald
    if (ratio < 0.80) return '#f59e0b'; // Amber
    return '#f43f5e'; // Coral Rose
  };

  // Initialize and update base Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old layers
    map.eachLayer(layer => {
      map.removeLayer(layer);
    });
    traveledPolylineRef.current = null;
    scrubberMarkerRef.current = null;
    if (focusedMarkerRef.current) {
      focusedMarkerRef.current = null;
    }
    if (snappedPolylineRef.current) {
      snappedPolylineRef.current = null;
    }

    // Free Tile Layers
    if (mapStyle === 'dark') {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
    } else if (mapStyle === 'street') {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
    } else if (mapStyle === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
      }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        opacity: 0.85,
      }).addTo(map);
    } else if (mapStyle === 'topo') {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
      }).addTo(map);
    }

    const allCoords: L.LatLngTuple[] = [];
    const maxKmh = analysis.maxSpeedKmh;
    const pts = analysis.points;

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
      }).addTo(map);

      // Outbound solid Cyan line
      const outboundLine = L.polyline(outboundCoords, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
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
      }).addTo(map);

      // Return dashed Coral line
      const returnLine = L.polyline(returnCoords, {
        color: '#f43f5e',
        weight: 5,
        opacity: 0.95,
        dashArray: '8, 6',
        lineCap: 'round',
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
      }).addTo(map);

    } else {
      // Full Speed Heatmap Mode
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
        }).addTo(map);

        // Speed-colored segmented track
        for (let i = 0; i < seg.points.length - 1; i++) {
          const p1 = seg.points[i];
          const p2 = seg.points[i + 1];
          const segSpeed = (p1.speedKmh + p2.speedKmh) / 2;
          const color = getSpeedColor(segSpeed, maxKmh);

          const subLine = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
            color,
            weight: 4.5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          subLine.bindTooltip(
            `<div style="font-family:monospace; font-size:11px; padding:2px 4px; background:${isLight ? '#fff' : '#111512'}; color:${isLight ? '#000' : '#fff'}; border:1px solid ${color};">
              <strong style="color:${color}; font-size:12px;">${segSpeed.toFixed(1)} km/h</strong><br/>
              Ele: ${p1.ele !== null ? p1.ele.toFixed(0) + 'm' : '—'}<br/>
              Dist: ${p1.distanceFromStartKm.toFixed(1)} km
            </div>`,
            { sticky: true }
          );
        }
      });
    }

    // 2. Direction Chevrons along track (shows ride flow on overlapping paths)
    if (showDirectionArrows && pts.length > 15) {
      const arrowStep = Math.max(12, Math.floor(pts.length / 25));
      for (let i = 5; i < pts.length - 5; i += arrowStep) {
        const pt = pts[i];
        const nextPt = pts[Math.min(pts.length - 1, i + 2)];
        // Calculate heading
        const dLon = ((nextPt.lon - pt.lon) * Math.PI) / 180;
        const lat1 = (pt.lat * Math.PI) / 180;
        const lat2 = (nextPt.lat * Math.PI) / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

        const isReturnLeg = turnaroundIndex > 0 && i >= turnaroundIndex;
        const arrowColor = isReturnLeg ? '#f43f5e' : '#38bdf8';

        const arrowIcon = L.divIcon({
          className: 'dir-arrow',
          html: `<div style="transform:rotate(${bearing}deg); width:16px; height:16px; display:flex; align-items:center; justify-content:center;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${arrowColor}">
              <path d="M12 2L2 22L12 17L22 22L12 2Z" />
            </svg>
          </div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker([pt.lat, pt.lon], { icon: arrowIcon, interactive: false }).addTo(map);
      }
    }

    // 3. Clickable GPS Point Dots (optional)
    if (showPointDots && pts.length < 600) {
      pts.forEach((pt, idx) => {
        const dotColor = getSpeedColor(pt.speedKmh, maxKmh);
        const dot = L.circleMarker([pt.lat, pt.lon], {
          radius: 3,
          color: isLight ? '#ffffff' : '#090c0a',
          weight: 1,
          fillColor: dotColor,
          fillOpacity: 0.9,
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
    }).addTo(map);
    traveledPolylineRef.current = traveledPolyline;

    // 5. Start & Finish Markers
    if (pts.length > 0) {
      const startPt = pts[0];
      const endPt = pts[pts.length - 1];

      // Start Marker
      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `<div style="width:26px; height:26px; background:#0f172a; border:2px solid #10b981; color:#10b981; border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:monospace; font-weight:900; font-size:11px; box-shadow:0 0 10px rgba(16,185,129,0.5);">ST</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([startPt.lat, startPt.lon], { icon: startIcon })
        .addTo(map)
        .bindPopup(`<b>Track Start</b><br/>${startPt.time ? new Date(startPt.time).toLocaleTimeString() : ''}`);

      // Finish Marker
      const finishIcon = L.divIcon({
        className: 'custom-finish-marker',
        html: `<div style="width:26px; height:26px; background:#0f172a; border:2px solid #f43f5e; color:#f43f5e; border-radius:6px; display:flex; align-items:center; justify-content:center; font-family:monospace; font-weight:900; font-size:11px; box-shadow:0 0 10px rgba(244,63,94,0.5);">FIN</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([endPt.lat, endPt.lon], { icon: finishIcon })
        .addTo(map)
        .bindPopup(`<b>Finish Line</b><br/>${endPt.time ? new Date(endPt.time).toLocaleTimeString() : ''}`);

      // Fit map bounds safely
      if (allCoords.length > 0) {
        map.fitBounds(allCoords, { padding: [36, 36] });
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
        // Clean, compact circular pin badge (not an obstructive 120px banner)
        const pitIcon = L.divIcon({
          className: 'pit-marker',
          html: `<div style="width:28px; height:28px; border-radius:50%; background:#0f172a; border:2px solid #f59e0b; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:13px; box-shadow:0 2px 8px rgba(0,0,0,0.6); cursor:pointer;">
            ${emoji}
          </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([pit.lat, pit.lon], { icon: pitIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif; font-size:12px; line-height:1.4; color:#0f172a; min-width:180px;">
            <div style="font-weight:bold; font-size:13px; color:#b45309; margin-bottom:4px; display:flex; align-items:center; gap:4px;">
              <span>${emoji}</span>
              <span>${pit.name}</span>
            </div>
            <div><b>Duration:</b> ${Math.round(pit.durationSeconds / 60)} minutes</div>
            <div><b>Distance:</b> ${pit.distanceKm.toFixed(1)} km into ride</div>
            ${pit.notes ? `<div style="margin-top:5px; padding-top:4px; border-top:1px dashed #cbd5e1; font-style:italic; color:#475569;">"${pit.notes}"</div>` : ''}
          </div>
        `);
      });
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

  }, [analysis, mapStyle, showPitStops, showPointDots, showDirectionArrows, routeMode, turnaroundIndex, isLight]);

  // Clean up Leaflet map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
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
        const traveledCoords = activePoints.slice(0, currentIndex + 1).map(p => [p.lat, p.lon] as L.LatLngTuple);
        traveledPolylineRef.current.setLatLngs(traveledCoords);
      }
    }
  }, [currentIndex, activePoints]);

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
      marker.bindPopup(`<div style="font-family:monospace; font-size:12px; font-weight:bold; color:#0f172a; padding:3px 6px;">${focusedCoordinate.label}</div>`).openPopup();
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
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : ''
      }`}
    >
      {/* Map Header Toolbar */}
      <div className={`px-3 sm:px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5 ${headerBg}`}>
        {/* Left: GPS Track identity & Out-and-back detection indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider">
            {analysis.name || 'GPS Ride Route'}
          </span>
          <span className={`text-xs font-mono ${subText}`}>
            ({analysis.points.length} GPS Fixes)
          </span>

          {/* Out & Back Detected Badge */}
          {turnaroundIndex > 0 && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <ArrowLeftRight className="w-3 h-3" />
                <span>Out & Back Route</span>
              </span>
            </div>
          )}
        </div>

        {/* Right: Map view & Route mode controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
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
                Speed Heatmap
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
                Split Out / Back
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
              onClick={() => setMapStyle(isLight ? 'street' : 'dark')}
              className={`px-2 py-1 rounded uppercase cursor-pointer ${
                mapStyle === 'dark' || mapStyle === 'street'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : subText
              }`}
            >
              {isLight ? 'Standard' : 'Dark'}
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              className={`px-2 py-1 rounded uppercase cursor-pointer ${
                mapStyle === 'satellite' ? 'bg-sky-500 text-slate-950 font-bold' : subText
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapStyle('topo')}
              className={`px-2 py-1 rounded uppercase cursor-pointer hidden sm:inline-block ${
                mapStyle === 'topo' ? 'bg-sky-500 text-slate-950 font-bold' : subText
              }`}
            >
              Topo
            </button>
          </div>

          {/* Direction Arrows Toggle */}
          <button
            onClick={() => setShowDirectionArrows(!showDirectionArrows)}
            title="Toggle Direction Arrows along route"
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showDirectionArrows
                ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                : buttonBg
            }`}
          >
            <ArrowRight className="w-3 h-3" />
            <span className="hidden sm:inline">Arrows</span>
          </button>

          {/* Toggle Stops (Default clean/hidden!) */}
          <button
            onClick={() => setShowPitStops(!showPitStops)}
            className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              showPitStops
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : buttonBg
            }`}
            title="Toggle stationary pit stops on the map"
          >
            <MapPin className="w-3 h-3" />
            <span>Stops ({analysis.pitStops.length})</span>
          </button>

          {/* Recenter */}
          <button
            onClick={recenterMap}
            title="Recenter track"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
          >
            <Navigation className="w-3.5 h-3.5 text-sky-400" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Map DOM Element */}
      <div 
        ref={mapContainerRef} 
        id="leaflet-map-canvas"
        className={`w-full transition-all ${
          isFullscreen ? 'h-[calc(100vh-170px)]' : 'h-[360px] sm:h-[460px]'
        }`}
      />

      {/* VIDEO-PLAYER STYLE SCRUBBER & SIMULATION CONTROLLER */}
      <div className={`p-3 sm:p-4 border-t space-y-2.5 ${scrubBarBg}`}>
        {/* Scrubber Range Slider */}
        <div className="space-y-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min="0"
              max={activePoints.length - 1}
              value={currentIndex}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                onScrubChange(val);
              }}
              className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-sky-500 bg-slate-700/40 hover:accent-sky-400 transition-all"
            />
          </div>

          {/* Timestamp & Distance Scrubber Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold">{formatTime(elapsedSeconds)}</span>
              <span className={subText}>/</span>
              <span className={subText}>{formatTime(totalDuration)}</span>
            </div>

            <div className="flex items-center gap-3">
              <span>
                DIST: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{currentPoint.distanceFromStartKm.toFixed(1)} km</strong> / {analysis.totalDistanceKm.toFixed(1)} km
              </span>
              <span className={subText}>
                ({Math.round((currentIndex / Math.max(1, activePoints.length - 1)) * 100)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Playback Controls and Telemetry Snapshot */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/20">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onScrubChange(0)}
              title="Reset to Start"
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onScrubChange(Math.max(0, currentIndex - 20))}
              title="Step Back 20 fixes"
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>

            <button
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
              onClick={() => onScrubChange(Math.min(activePoints.length - 1, currentIndex + 20))}
              title="Step Forward 20 fixes"
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${buttonBg}`}
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            {/* Playback Speed Selector */}
            <div className={`flex border rounded-lg p-0.5 text-[10px] font-mono ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#0d131a] border-[#1e2a38]'}`}>
              {[1, 2, 5, 10].map(spd => (
                <button
                  key={spd}
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

          {/* Live Scrub Telemetry Values */}
          <div className="flex items-center gap-3 sm:gap-5 text-xs font-mono">
            <div>
              <span className={`text-[10px] block ${subText}`}>SPEED</span>
              <strong className="text-sky-400 font-black text-sm">
                {currentPoint.speedKmh.toFixed(1)} <span className="text-[10px] font-normal">km/h</span>
              </strong>
            </div>

            <div>
              <span className={`text-[10px] block ${subText}`}>ALTITUDE</span>
              <strong className={isLight ? 'text-slate-900 font-bold text-sm' : 'text-white font-bold text-sm'}>
                {currentPoint.ele !== null ? `${currentPoint.ele.toFixed(0)}m` : '—'}
              </strong>
            </div>

            <div>
              <span className={`text-[10px] block ${subText}`}>HEADING</span>
              <strong className="text-emerald-400 font-bold text-sm">
                {currentPoint.bearing !== null ? `${Math.round(currentPoint.bearing)}°` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

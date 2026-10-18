import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { GroupMemberInfo, SosAlert, CrewNotification } from '../hooks/useGroupRide';
import { AppTheme, UnitSystem, RideAnalysis, PitStop, TrackPoint } from '../types';
import { openGoogleMapsNavigation, openGoogleMapsRoute } from '../utils/navigation';
import { preCacheRouteTiles, preCacheRegionalArea, CacheProgress, LatLngBounds } from '../utils/mapCache';
import { 
  Crosshair, 
  Users, 
  Share2, 
  AlertTriangle, 
  LogOut, 
  Navigation, 
  Copy, 
  Check, 
  Edit3,
  Coffee,
  Radio,
  Scan,
  Compass,
  RotateCw,
  MapPin,
  Route,
  Download,
  ArrowUp,
  Layers,
  Sun,
  Moon,
  Volume2,
  Plus,
  Minus
} from 'lucide-react';
import { triggerHaptic, playWarningChime } from '../utils/audioChimes';

interface MyLocationData {
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number | null;
}

interface CrewLiveMapProps {
  myLocation: MyLocationData | null;
  myRiderName: string;
  myColor: string;
  isHost: boolean;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  roomCode?: string;
  lastRoomCode?: string;
  isConnected?: boolean;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  onTriggerSos?: () => void;
  onDismissSos?: () => void;
  onLeaveRoom?: () => void;
  onRejoinRoom?: () => void;
  crewNotification?: CrewNotification | null;
  onDismissCrewNotification?: () => void;
  onShareWhatsApp?: () => void;
  onCopyInviteLink?: () => void;
  copiedLink?: boolean;
  onGoToCockpit?: () => void;
  onUpdateRiderName?: (newName: string) => void;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  pointsCount?: number;
  totalDistanceMeters?: number;
  onToggleCrewList?: () => void;
  onOpenCrewManage?: (tab?: 'active' | 'saved' | 'create' | 'join') => void;
  focusedRiderId?: string | null;
  activeRoute?: RideAnalysis | null;
  onSelectRider?: (riderId: string) => void;
  isOnRadar?: boolean;
  onToggleRadar?: (enable?: boolean) => void;
  onJoinSharedRoute?: (route: any) => void;
  starredRiderIds?: string[];
  externalMapLayer?: MapLayerType;
}

export type MapLayerType = 'dark' | 'streets' | 'satellite' | 'sunlight';

export const CrewLiveMap: React.FC<CrewLiveMapProps> = ({
  myLocation,
  myRiderName,
  myColor,
  isHost,
  members,
  sosAlert,
  roomCode = '',
  lastRoomCode = '',
  isConnected = false,
  theme = 'dark',
  unitSystem = 'metric',
  externalMapLayer,
  onTriggerSos,
  onDismissSos,
  onLeaveRoom,
  onRejoinRoom,
  crewNotification = null,
  onDismissCrewNotification,
  onShareWhatsApp,
  onCopyInviteLink,
  copiedLink = false,
  onGoToCockpit,
  onUpdateRiderName,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  pointsCount = 0,
  totalDistanceMeters = 0,
  onToggleCrewList,
  onOpenCrewManage,
  focusedRiderId = null,
  activeRoute = null,
  onSelectRider,
  isOnRadar = true,
  onToggleRadar,
  onJoinSharedRoute,
  starredRiderIds = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  const myMarkerRef = useRef<L.Marker | null>(null);
  const prevMyPosRef = useRef<{ lat: number; lon: number; speedKmh: number; heading: number | null } | null>(null);
  const memberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const memberCacheRef = useRef<Map<string, { lat: number; lon: number; speedText: string; bearing: number | null; isOnline: boolean; isStopped: boolean; isHost: boolean; color: string; isStarred?: boolean }>>(new Map());
  const sosMarkerRef = useRef<L.Marker | null>(null);

  // Active Route layers
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeGlowPolylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Orientation & Compass state (Solves "map is inverted" on motorcycle mounts)
  const [orientationMode, setOrientationMode] = useState<'north' | 'course'>('north');
  const [isFlipped180, setIsFlipped180] = useState<boolean>(false);

  // Offline route tile caching state
  const [isCachingRoute, setIsCachingRoute] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);
  const [cacheSuccessMsg, setCacheSuccessMsg] = useState<string | null>(null);

  // Default to Dark map for eye comfort and stealth motorcycle cockpit look
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('sasta_sunlight_mode') === 'true') {
        return 'sunlight';
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    if (externalMapLayer) {
      setMapLayer(externalMapLayer);
    }
  }, [externalMapLayer]);

  const [isLayerPopoverOpen, setIsLayerPopoverOpen] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>('me');
  const [hasInitialFit, setHasInitialFit] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Inline handle editor
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [tempHandle, setTempHandle] = useState(myRiderName);

  // Expose universal navigation helper to global window for Leaflet popup click handlers
  useEffect(() => {
    (window as any).__navTo = (lat: number, lon: number) => {
      triggerHaptic(30);
      openGoogleMapsNavigation(lat, lon);
    };
    return () => {
      delete (window as any).__navTo;
    };
  }, []);

  // Keyboard shortcut listener to close open overlays on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLeaveModalOpen) setIsLeaveModalOpen(false);
        if (isLayerPopoverOpen) setIsLayerPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isLeaveModalOpen, isLayerPopoverOpen]);

  // Current heading from myLocation
  const myHeading = myLocation?.heading !== null && myLocation?.heading !== undefined ? myLocation.heading : null;

  // Calculate rotation for map container
  // North-up: 0° (or 180° if flipped by user).
  // Course-up: rotated by -myHeading so bike's forward path is ALWAYS UP on phone screen!
  const targetMapRotation = useMemo(() => {
    let base = 0;
    if (orientationMode === 'course' && myHeading !== null) {
      base = -myHeading;
    }
    return (isFlipped180 ? 180 : 0) + base;
  }, [orientationMode, myHeading, isFlipped180]);

  // Cardinal direction helper
  const getCardinal = (deg: number | null) => {
    if (deg === null) return 'N';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return dirs[idx];
  };

  // Focus specific rider when requested externally (e.g. from formation list)
  useEffect(() => {
    if (focusedRiderId) {
      setSelectedRiderId(focusedRiderId);
      if (focusedRiderId === 'me') {
        if (myLocation && mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([myLocation.lat, myLocation.lon], 16, { animate: true, duration: 0.8 });
        }
      } else {
        const m = members.find(member => member.riderId === focusedRiderId);
        if (m && m.location && mapInstanceRef.current) {
          triggerHaptic(20);
          mapInstanceRef.current.flyTo([m.location.lat, m.location.lon], 16, { animate: true, duration: 0.8 });
        }
      }
    }
  }, [focusedRiderId, members, myLocation]);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true);
      triggerHaptic(25);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const isLight = theme === 'light';

  // Format speed based on unit system
  const formatSpeed = (kmh: number) => {
    if (unitSystem === 'imperial') {
      return `${Math.round(kmh * 0.621371)} mph`;
    }
    return `${Math.round(kmh)} km/h`;
  };

  // Format distance
  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '...';
    if (unitSystem === 'imperial') {
      const feet = meters * 3.28084;
      if (feet < 1000) return `${Math.round(feet)} ft`;
      return `${(meters / 1609.34).toFixed(1)} mi`;
    }
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const primaryStarredMember = useMemo(() => {
    if (!starredRiderIds || starredRiderIds.length === 0) return null;
    const starredList = members.filter(m => starredRiderIds.includes(m.riderId) && m.location && m.isOnline !== false);
    if (starredList.length === 0) return null;
    starredList.sort((a, b) => (a.distanceFromMeMeters ?? 999999) - (b.distanceFromMeMeters ?? 999999));
    return starredList[0];
  }, [members, starredRiderIds]);

  // Convoy Separation Watchdog: Alert rider via Bluetooth intercom when primary starred buddy falls behind
  const lastSeparationWarningRef = useRef<number>(0);
  useEffect(() => {
    if (!primaryStarredMember || !myLocation) return;
    const dist = primaryStarredMember.distanceFromMeMeters ?? 0;
    const mySpeed = myLocation.speedKmh ?? 0;
    const now = Date.now();

    // If rider is actively cruising (> 25 km/h) and primary starred buddy falls > 2000m behind
    if (dist > 2000 && mySpeed > 25) {
      if (now - lastSeparationWarningRef.current > 60000) {
        lastSeparationWarningRef.current = now;
        playWarningChime();
        triggerHaptic([80, 50, 80]);
      }
    }
  }, [primaryStarredMember?.distanceFromMeMeters, myLocation?.speedKmh]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    const initialLat = myLocation?.lat || members.find(m => m.location)?.location?.lat || 18.5204;
    const initialLon = myLocation?.lon || members.find(m => m.location)?.location?.lon || 73.8567;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    map.on('dragstart', () => {
      setSelectedRiderId(null);
    });

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const handleResize = () => {
      map.invalidateSize();
    };
    const handleOrientation = () => {
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 300);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Tile Layer Changes (ArcGIS Dark Gray Canvas, OSM Streets, Satellite via ArcGIS)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }
    if (overlayTileLayerRef.current) {
      overlayTileLayerRef.current.remove();
      overlayTileLayerRef.current = null;
    }

    if (mapLayer === 'streets') {
      tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
    } else if (mapLayer === 'satellite') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: '&copy; Esri World Imagery',
      }).addTo(map);
      overlayTileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 18,
        opacity: 0.85,
      }).addTo(map);
    } else if (mapLayer === 'sunlight') {
      // High-contrast, maximum luminance CARTO Voyager base with contrast/saturation boost
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; CARTO &copy; OpenStreetMap',
        className: 'sunlight-map-tiles',
      }).addTo(map);
    } else {
      // Pristine Dark Mode Map (Esri Dark Gray with maxNativeZoom: 16 so street level 17-19 does not go blank)
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 16,
        attribution: '&copy; Esri Dark Canvas',
      }).addTo(map);
      overlayTileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 16,
        opacity: 0.85,
      }).addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 50);
  }, [mapLayer]);

  // ─── Active Route Rendering (Polyline, Start, Finish, Pit Stops) ───
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Cleanup existing route layers
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeGlowPolylineRef.current) {
      routeGlowPolylineRef.current.remove();
      routeGlowPolylineRef.current = null;
    }
    routeMarkersRef.current.forEach(m => m.remove());
    routeMarkersRef.current = [];

    if (!activeRoute || !activeRoute.points || activeRoute.points.length < 2) return;

    const latLngs: L.LatLngTuple[] = activeRoute.points.map(p => [p.lat, p.lon]);

    if (mapLayer === 'sunlight') {
      // High-contrast dual-stroke Rally GPS route for blinding sunlight:
      // Heavy 8px jet-black casing underneath, 4.5px neon yellow (#ffe600) core on top
      const casing = L.polyline(latLngs, {
        color: '#000000',
        weight: 8,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeGlowPolylineRef.current = casing;

      const line = L.polyline(latLngs, {
        color: '#ffe600',
        weight: 4.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routePolylineRef.current = line;
    } else {
      // 1. Route outer ambient glow
      const glow = L.polyline(latLngs, {
        color: '#00f0ff',
        weight: 6,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeGlowPolylineRef.current = glow;

      // 2. High-contrast main route line
      const line = L.polyline(latLngs, {
        color: '#00e5ff',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routePolylineRef.current = line;
    }

    // 3. Start Marker
    const startPt = activeRoute.points[0];
    const startHtml = `
      <div style="background:#10b981; color:#080c10; font-family:monospace; font-weight:900; font-size:9px; padding:2px 6px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 0 10px #10b981; white-space:nowrap; display:flex; align-items:center; gap:2px;">
        <span>🟢</span> <span>START</span>
      </div>
    `;
    const startIcon = L.divIcon({ className: 'route-start-badge', html: startHtml, iconAnchor: [24, 10] });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon, zIndexOffset: 700 }).addTo(map);
    routeMarkersRef.current.push(startMarker);

    // 4. Finish Marker (with 1-tap Google Maps Navigation)
    const endPt = activeRoute.points[activeRoute.points.length - 1];
    const finishHtml = `
      <div style="background:#f59e0b; color:#080c10; font-family:monospace; font-weight:900; font-size:9px; padding:2px 6px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 0 10px #f59e0b; white-space:nowrap; display:flex; align-items:center; gap:2px;">
        <span>🏁</span> <span>FINISH</span>
      </div>
    `;
    const finishIcon = L.divIcon({ className: 'route-finish-badge', html: finishHtml, iconAnchor: [24, 10] });
    const finishMarker = L.marker([endPt.lat, endPt.lon], { icon: finishIcon, zIndexOffset: 700 }).addTo(map);
    const finishPopup = `
      <div style="font-family:monospace; text-align:center; padding:4px; min-width:140px;">
        <div style="font-weight:900; font-size:12px; color:#fff; margin-bottom:2px;">🏁 ${activeRoute.name || 'Destination'}</div>
        <div style="font-size:10px; color:#38bdf8; margin-bottom:8px;">${activeRoute.totalDistanceKm.toFixed(1)} km Total</div>
        <button onclick="window.__navTo(${endPt.lat}, ${endPt.lon})" style="width:100%; background:#06b6d4; color:#080c10; font-weight:900; font-size:10px; padding:6px; border-radius:6px; border:none; cursor:pointer;">
          🧭 Google Maps Nav
        </button>
      </div>
    `;
    finishMarker.bindPopup(finishPopup, { offset: [0, -10] });
    routeMarkersRef.current.push(finishMarker);

    // 5. Pit Stop Markers (fuel, chai, scenic, dhaba)
    if (activeRoute.pitStops && activeRoute.pitStops.length > 0) {
      activeRoute.pitStops.forEach(stop => {
        const emoji = stop.category === 'chai' ? '☕' : stop.category === 'fuel' ? '⛽' : stop.category === 'dhaba' ? '🍛' : '📍';
        const stopHtml = `
          <div style="background:#0f172a; border:1.5px solid #38bdf8; color:#38bdf8; font-family:monospace; font-size:9px; font-weight:bold; padding:2px 5px; border-radius:10px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.7); display:flex; align-items:center; gap:2px;">
            <span>${emoji}</span> <span>${stop.name || 'Pit Stop'}</span>
          </div>
        `;
        const stopIcon = L.divIcon({ className: 'route-pitstop-badge', html: stopHtml, iconAnchor: [20, 10] });
        const stopMarker = L.marker([stop.lat, stop.lon], { icon: stopIcon, zIndexOffset: 650 }).addTo(map);
        const stopPopup = `
          <div style="font-family:monospace; text-align:center; padding:4px; min-width:140px;">
            <div style="font-weight:900; font-size:11px; color:#fff;">${emoji} ${stop.name}</div>
            <div style="font-size:9px; color:#94a3b8; margin-bottom:6px;">${stop.distanceKm.toFixed(1)} km mark</div>
            <button onclick="window.__navTo(${stop.lat}, ${stop.lon})" style="width:100%; background:#38bdf8; color:#080c10; font-weight:900; font-size:9px; padding:5px; border-radius:6px; border:none; cursor:pointer;">
              🧭 Navigate in Maps
            </button>
          </div>
        `;
        stopMarker.bindPopup(stopPopup, { offset: [0, -10] });
        routeMarkersRef.current.push(stopMarker);
      });
    }
  }, [activeRoute, mapLayer]);

  // ─── Offline Route Map Tile Pre-Caching ───
  const handleCacheOfflineRoute = async () => {
    if (!activeRoute || !activeRoute.points || activeRoute.points.length === 0) return;
    triggerHaptic(30);
    setIsCachingRoute(true);
    setCacheSuccessMsg(null);

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    activeRoute.points.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLng) minLng = p.lon;
      if (p.lon > maxLng) maxLng = p.lon;
    });

    const bounds: LatLngBounds = {
      minLat: minLat - 0.02,
      maxLat: maxLat + 0.02,
      minLng: minLng - 0.02,
      maxLng: maxLng + 0.02,
    };

    try {
      const result = await preCacheRouteTiles(bounds, 'dark', (progress) => {
        setCacheProgress(progress);
      });
      setCacheSuccessMsg(`Saved ${result.cached} tiles offline!`);
      triggerHaptic(40);
      setTimeout(() => {
        setIsCachingRoute(false);
        setCacheProgress(null);
        setCacheSuccessMsg(null);
      }, 3500);
    } catch {
      setIsCachingRoute(false);
      setCacheProgress(null);
    }
  };

  // ─── Offline Regional 25km Map Area Pre-Caching (For Unmapped Mountain Ghats) ───
  const handleCacheRegionalMap = async () => {
    if (!myLocation) return;
    triggerHaptic(30);
    setIsCachingRoute(true);
    setCacheSuccessMsg(null);

    try {
      const result = await preCacheRegionalArea(
        myLocation.lat,
        myLocation.lon,
        25,
        mapLayer === 'sunlight' ? 'street' : 'dark',
        (progress) => {
          setCacheProgress(progress);
        }
      );
      setCacheSuccessMsg(`Saved 25km Region (${result.cached} tiles) offline!`);
      triggerHaptic(40);
      setTimeout(() => {
        setIsCachingRoute(false);
        setCacheProgress(null);
        setCacheSuccessMsg(null);
      }, 3500);
    } catch {
      setIsCachingRoute(false);
      setCacheProgress(null);
    }
  };

  // ─── Update "YOU" Marker (Optimized, Lag-Free with Delta Rendering) ───
  useEffect(() => {
    if (!mapInstanceRef.current || !myLocation) {
      if (myMarkerRef.current) {
        myMarkerRef.current.remove();
        myMarkerRef.current = null;
        prevMyPosRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;
    const pos: L.LatLngTuple = [myLocation.lat, myLocation.lon];
    const initial = myRiderName.charAt(0).toUpperCase() || 'Y';
    const color = myColor || '#00f0ff';
    const speed = formatSpeed(myLocation.speedKmh);
    const heading = myLocation.heading !== null && myLocation.heading !== undefined ? myLocation.heading : null;

    // In Course-Up mode, the map rotates to heading so the forward indicator points straight UP (0deg).
    // In North-Up mode, the forward indicator rotates to heading.
    const arrowRotation = orientationMode === 'course' ? 0 : (heading !== null ? heading : 0);

    const prev = prevMyPosRef.current;
    const headingDelta = prev?.heading !== null && heading !== null ? Math.abs((prev?.heading || 0) - heading) : 999;
    const speedDelta = prev ? Math.abs(prev.speedKmh - myLocation.speedKmh) : 999;
    const isFirstTime = !myMarkerRef.current || !prev;

    // Centered 360° direction arrow
    const headingArrow = heading !== null 
      ? `<div class="live-rider-arrow-me" style="position:absolute; inset:0; display:flex; justify-content:center; align-items:flex-start; transform:rotate(${arrowRotation}deg); pointer-events:none; transition:transform 0.25s ease;">
           <div style="width:0; height:0; border-left:4.5px solid transparent; border-right:4.5px solid transparent; border-bottom:8px solid ${color}; transform:translateY(-4px); filter:drop-shadow(0 0 4px ${color});"></div>
         </div>`
      : '';

    const myLeaderCrown = isHost
      ? `<div style="position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">👑 LEADER</div>`
      : '';

    const html = `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Tap to customize your callsign & bike">
        ${myLeaderCrown}
        <div style="position:absolute; width:34px; height:34px; border-radius:50%; background:${color}; opacity:0.25; border:1.5px solid ${color};"></div>
        ${headingArrow}
        <div style="position:relative; width:26px; height:26px; border-radius:50%; background:${color}; border:2px solid #080c10; box-shadow:0 0 10px ${color}, 0 2px 5px rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:11px;">
          ${initial}
        </div>
        <div style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); background:#080c10; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.8);">
          YOU
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'live-rider-marker-me',
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (!myMarkerRef.current) {
      myMarkerRef.current = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map);
      myMarkerRef.current.on('click', () => {
        triggerHaptic(30);
        if (onOpenCrewManage) {
          onOpenCrewManage('active');
        }
      });
      prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading };
    } else {
      // Always update position smoothly (zero DOM thrashing)
      myMarkerRef.current.setLatLng(pos);

      // Zero-GC in-place rotation of the direction arrow without destroying DOM
      const el = myMarkerRef.current.getElement();
      if (el && heading !== null) {
        const arrowEl = el.querySelector('.live-rider-arrow-me') as HTMLElement | null;
        if (arrowEl) {
          arrowEl.style.transform = `rotate(${arrowRotation}deg)`;
        }
      }

      if (isFirstTime) {
        myMarkerRef.current.setIcon(icon);
        prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading };
      }
    }

    if (selectedRiderId === 'me') {
      map.panTo(pos, { animate: true, duration: 0.5 });
    }
  }, [myLocation, myRiderName, myColor, unitSystem, selectedRiderId, isHost, orientationMode]);

  // ─── Update Member Markers (Optimized Delta Cache, Lag-Free) ───
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove obsolete markers
    memberMarkersRef.current.forEach((marker, id) => {
      if (!members.some(m => m.riderId === id)) {
        marker.remove();
        memberMarkersRef.current.delete(id);
        memberCacheRef.current.delete(id);
      }
    });

    // Add or update markers for connected members
    members.forEach(m => {
      if (!m.location) return;
      const pos: L.LatLngTuple = [m.location.lat, m.location.lon];
      const initial = m.name.charAt(0).toUpperCase() || 'R';
      const color = m.color || '#ffe600';
      const speed = formatSpeed(m.location.speedKmh);
      const isStopped = m.location.status === 'stopped' || m.location.speedKmh < 2.0;
      const bearing = m.location.bearing;
      const isOnline = m.isOnline !== false;
      const statusTag = !isOnline ? 'OFFLINE' : isStopped ? 'STOP' : speed;
      const isStarred = Boolean(starredRiderIds && starredRiderIds.includes(m.riderId));

      const prev = memberCacheRef.current.get(m.riderId);
      const bearingDelta = prev?.bearing !== null && bearing !== null ? Math.abs((prev?.bearing || 0) - (bearing || 0)) : 999;
      const needRebuild = !prev || prev.speedText !== statusTag || bearingDelta > 3.0 || prev.isOnline !== isOnline || prev.isStopped !== isStopped || prev.color !== color || prev.isStarred !== isStarred;

      // Centered 360° rotating direction arrow
      const bearingArrow = bearing !== null && bearing !== undefined
        ? `<div class="live-rider-arrow" style="position:absolute; inset:0; display:flex; justify-content:center; align-items:flex-start; transform:rotate(${bearing}deg); pointer-events:none; transition:transform 0.25s ease;">
             <div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:7px solid ${color}; transform:translateY(-3px); filter:drop-shadow(0 0 3px ${color});"></div>
           </div>`
        : '';

      const leaderCrown = m.isHost
        ? `<div style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">👑 LEADER</div>`
        : '';

      const starBadge = isStarred
        ? `<div style="position:absolute; top:-16px; right:-6px; font-size:11px; filter:drop-shadow(0 0 3px #fbbf24); z-index:10;">⭐</div>`
        : '';

      const haloRing = isStarred
        ? `<div style="position:absolute; width:34px; height:34px; border-radius:50%; border:2px dashed #fbbf24; opacity:0.85;"></div>`
        : '';

      const opacity = isOnline ? '1' : '0.65';

      const html = `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center; opacity:${opacity}; cursor:pointer;" title="Tap to focus ${m.name}">
          ${haloRing}
          ${leaderCrown}
          ${starBadge}
          ${bearingArrow}
          <div style="width:24px; height:24px; border-radius:50%; background:${color}; border:2px solid ${isStarred ? '#fbbf24' : '#080c10'}; box-shadow:0 0 ${isStarred ? '12px #fbbf24' : `8px ${color}`}, 0 2px 4px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:10px;">
            ${initial}
          </div>
          <div style="position:absolute; bottom:-15px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid ${isStarred ? '#fbbf24' : color}; color:${isStarred ? '#fbbf24' : color}; font-family:monospace; font-size:8px; font-weight:bold; padding:1px 3px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">
            ${isStarred ? '⭐ ' : ''}${m.name}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `live-rider-marker-${m.riderId}`,
        html,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      let marker = memberMarkersRef.current.get(m.riderId);
      if (!marker) {
        marker = L.marker(pos, { icon, zIndexOffset: isStarred ? 960 : 900 }).addTo(map);
        marker.on('click', () => {
          triggerHaptic(20);
          setSelectedRiderId(m.riderId);
          if (onSelectRider) onSelectRider(m.riderId);
          if (m.location) {
            map.flyTo([m.location.lat, m.location.lon], 16, { animate: true, duration: 0.6 });
          }
        });
        memberMarkersRef.current.set(m.riderId, marker);
        memberCacheRef.current.set(m.riderId, {
          lat: m.location.lat,
          lon: m.location.lon,
          speedText: statusTag,
          bearing: bearing ?? null,
          isOnline,
          isStopped,
          isHost: m.isHost,
          color,
          isStarred,
        });
      } else {
        // High-speed direct position update without DOM destruction
        marker.setLatLng(pos);
        marker.setZIndexOffset(isStarred ? 960 : 900);

        // Zero-GC in-place rotation of the direction arrow without destroying DOM
        const el = marker.getElement();
        if (el && bearing !== null && bearing !== undefined) {
          const arrowEl = el.querySelector('.live-rider-arrow') as HTMLElement | null;
          if (arrowEl) {
            arrowEl.style.transform = `rotate(${bearing}deg)`;
          }
        }

        // Only rebuild DOM icon if identity, host status, online state or star status changed
        const identityOrStateChanged = !prev || prev.isOnline !== isOnline || prev.isHost !== m.isHost || prev.color !== color || prev.isStarred !== isStarred;
        if (identityOrStateChanged) {
          marker.setIcon(icon);
        }

        memberCacheRef.current.set(m.riderId, {
          lat: m.location.lat,
          lon: m.location.lon,
          speedText: statusTag,
          bearing: bearing ?? null,
          isOnline,
          isStopped,
          isHost: m.isHost,
          color,
          isStarred,
        });
      }
    });
  }, [members, unitSystem, starredRiderIds]);

  // SOS Marker (Crisp solid alert marker)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (!sosAlert) {
      if (sosMarkerRef.current) {
        sosMarkerRef.current.remove();
        sosMarkerRef.current = null;
      }
      return;
    }

    const pos: L.LatLngTuple = [sosAlert.lat, sosAlert.lon];
    const html = `
      <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:38px; height:38px; border-radius:50%; background:#ef4444; opacity:0.3; border:2px solid #ef4444;"></div>
        <div style="position:relative; width:28px; height:28px; border-radius:50%; background:#ef4444; border:2px solid #fff; box-shadow:0 0 12px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px;">
          🚨
        </div>
        <div style="position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#7f1d1d; border:1px solid #ef4444; color:#fff; font-family:monospace; font-size:9px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap;">
          SOS: ${sosAlert.fromName}
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'live-rider-sos-beacon',
      html,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!sosMarkerRef.current) {
      sosMarkerRef.current = L.marker(pos, { icon, zIndexOffset: 2000 }).addTo(map);
    } else {
      sosMarkerRef.current.setIcon(icon);
      sosMarkerRef.current.setLatLng(pos);
    }

    map.flyTo(pos, 16, { animate: true, duration: 1.2 });
  }, [sosAlert]);

  // Draw Active Planned / Shared Route on Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear previous route polylines and destination markers
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }
    if (routeGlowPolylineRef.current) {
      routeGlowPolylineRef.current.remove();
      routeGlowPolylineRef.current = null;
    }
    routeMarkersRef.current.forEach(m => m.remove());
    routeMarkersRef.current = [];

    if (activeRoute && activeRoute.points && activeRoute.points.length > 0) {
      const latLngs: L.LatLngTuple[] = activeRoute.points.map(p => [p.lat, p.lon]);

      // Outer neon cyan glow
      const glow = L.polyline(latLngs, {
        color: '#00f0ff',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routeGlowPolylineRef.current = glow;

      // Inner crisp route line
      const poly = L.polyline(latLngs, {
        color: '#00f0ff',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routePolylineRef.current = poly;

      // Destination flag marker
      const destPt = activeRoute.points[activeRoute.points.length - 1];
      const destIcon = L.divIcon({
        className: 'route-destination-flag',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translateY(-12px);">
            <div style="background:#00f0ff; color:#080c10; font-family:monospace; font-size:9px; font-weight:900; padding:2px 6px; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.8); white-space:nowrap; display:flex; align-items:center; gap:3px;">
              <span>🏁</span>
              <span>${activeRoute.name || 'Finish'}</span>
            </div>
            <div style="width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:6px solid #00f0ff;"></div>
          </div>
        `,
        iconSize: [100, 30],
        iconAnchor: [50, 30],
      });
      const destMarker = L.marker([destPt.lat, destPt.lon], { icon: destIcon, zIndexOffset: 850 }).addTo(map);
      routeMarkersRef.current.push(destMarker);
    }
  }, [activeRoute]);

  // Dynamic Initial Bounds: auto-encompass active riders on cold-start ONLY (never hijacks camera mid-ride)
  useEffect(() => {
    if (!mapInstanceRef.current || hasInitialFit) return;
    const activeMembers = members.filter(m => m.location && m.isOnline !== false);

    const points: L.LatLngTuple[] = [];
    if (myLocation) points.push([myLocation.lat, myLocation.lon]);

    activeMembers.forEach(m => {
      if (m.location) {
        if (m.distanceFromMeMeters === undefined || m.distanceFromMeMeters <= 100000) {
          points.push([m.location.lat, m.location.lon]);
        }
      }
    });

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: true });
      setHasInitialFit(true);
    } else if (points.length === 1) {
      mapInstanceRef.current.setView(points[0], 15);
      setHasInitialFit(true);
    }
  }, [myLocation, members, hasInitialFit]);

  // Fit bounds to include all crew members
  const handleFitAllRiders = () => {
    if (!mapInstanceRef.current) return;
    triggerHaptic(25);

    const points: L.LatLngTuple[] = [];
    if (myLocation) points.push([myLocation.lat, myLocation.lon]);
    members.forEach(m => {
      if (m.location && m.isOnline !== false) {
        points.push([m.location.lat, m.location.lon]);
      }
    });

    if (points.length === 0) return;

    if (points.length === 1) {
      mapInstanceRef.current.flyTo(points[0], 16, { animate: true, duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
    }
    setSelectedRiderId(null);
  };

  // Recenter on My Location
  const handleRecenterMe = () => {
    if (!mapInstanceRef.current || !myLocation) return;
    triggerHaptic(25);
    mapInstanceRef.current.flyTo([myLocation.lat, myLocation.lon], 16, {
      animate: true,
      duration: 0.8,
    });
    setSelectedRiderId('me');
  };

  // Pan to selected member
  const handleSelectMember = (member: GroupMemberInfo) => {
    if (!mapInstanceRef.current || !member.location) return;
    triggerHaptic(20);
    setSelectedRiderId(member.riderId);
    mapInstanceRef.current.flyTo([member.location.lat, member.location.lon], 16, {
      animate: true,
      duration: 0.8,
    });
  };

  const handleSaveHandle = () => {
    if (tempHandle.trim() && onUpdateRiderName) {
      onUpdateRiderName(tempHandle.trim());
      setIsEditingHandle(false);
      triggerHaptic(30);
    }
  };

  const totalRiders = members.length + 1;

  return (
    <div className={`relative flex flex-col w-full h-full flex-1 overflow-hidden select-none ${isLight ? 'bg-slate-100' : 'bg-[#080c10]'}`}>

      {/* ─────────────────────────────────────────────────────────────
          LEAFLET MAP CANVAS
      ───────────────────────────────────────────────────────────── */}
      <div 
        ref={mapContainerRef} 
        style={{
          transform: `rotate(${targetMapRotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
          width: orientationMode === 'course' || isFlipped180 ? '140%' : '100%',
          height: orientationMode === 'course' || isFlipped180 ? '140%' : '100%',
          top: orientationMode === 'course' || isFlipped180 ? '-20%' : '0',
          left: orientationMode === 'course' || isFlipped180 ? '-20%' : '0',
          position: 'absolute',
        }}
        className="cursor-grab active:cursor-grabbing" 
      />

      {/* Cold-Start Satellite Acquisition Pill */}
      {!myLocation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-full bg-slate-950/92 backdrop-blur-md border border-amber-500/50 text-amber-300 font-mono text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Acquiring GPS fix...</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SLEEK FLOATING STATUS CAPSULE (Google Maps Style)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        {/* Squad Status Pill */}
        <div 
          onClick={() => {
            if (onToggleRadar) {
              triggerHaptic(30);
              onToggleRadar();
            }
          }}
          className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-full backdrop-blur-md shadow-xl text-white font-mono text-xs cursor-pointer transition-all active:scale-95 border ${
            isOnRadar 
              ? 'bg-slate-950/95 border-cyan-500/60 hover:border-cyan-400' 
              : 'bg-slate-950/95 border-amber-500/60 hover:border-amber-400'
          }`}
          title={isOnRadar ? 'Live on Radar (100km). Tap to go off radar (Ghost mode)' : 'Off Radar (Ghost mode). Tap to go live on radar'}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${isOnRadar ? 'bg-emerald-400 ring-2 ring-emerald-400/50 animate-pulse' : 'bg-amber-400'}`} />
          <span className="font-heading font-black tracking-wide text-white uppercase text-xs">
            {isOnRadar ? 'Crew Radar' : 'Off Radar'}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
            100km
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            {members.filter(m => m.location && m.isOnline !== false).length + (isOnRadar ? 1 : 0)} ACTIVE
          </span>
        </div>

        {/* Right Action: Callsign / Profile Customizer & SOS Emergency Alert */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {onOpenCrewManage && (
            <button
              onClick={() => {
                triggerHaptic(20);
                onOpenCrewManage();
              }}
              className="h-10 px-2.5 sm:px-3 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-700/80 hover:border-cyan-400 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-xl cursor-pointer transition-all active:scale-95"
              title="Edit Callsign, Motorcycle Model & Radar Color"
            >
              <div 
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-slate-950 shrink-0 shadow-xs" 
                style={{ backgroundColor: myColor || '#00f0ff' }}
              >
                {(myRiderName || 'R').charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[65px] sm:max-w-[105px] truncate">{myRiderName || 'Rider'}</span>
              <Edit3 className="w-3 h-3 text-cyan-400 shrink-0" />
            </button>
          )}

          {isConnected && onTriggerSos && (
            <button
              onClick={() => {
                if (confirm('🚨 Broadcast REGROUP alert with your live GPS location to all crew members?')) {
                  onTriggerSos();
                }
              }}
              className="h-10 px-3.5 rounded-full bg-rose-600 hover:bg-rose-500 backdrop-blur-md border border-rose-400 text-white font-mono font-black text-xs flex items-center gap-1.5 shadow-xl shadow-rose-950/60 cursor-pointer transition-all active:scale-95"
              title="Broadcast Emergency SOS / Regroup to Crew"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>SOS</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CONVOY PROXIMITY PILL (Shows primary starred buddy distance & speed)
      ───────────────────────────────────────────────────────────── */}
      {primaryStarredMember && primaryStarredMember.distanceFromMeMeters !== undefined && (
        <div
          onClick={() => {
            triggerHaptic(20);
            if (primaryStarredMember.location && mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([primaryStarredMember.location.lat, primaryStarredMember.location.lon], 16, { animate: true, duration: 0.6 });
            }
          }}
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto px-3 py-1 rounded-full backdrop-blur-md border shadow-xl font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap animate-in fade-in ${
            primaryStarredMember.distanceFromMeMeters > 2500
              ? 'bg-amber-950/95 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-slate-950/95 border-amber-500/60 text-white'
          }`}
          title="Tap to center map on your primary starred convoy buddy"
        >
          <span className="text-amber-400">⭐</span>
          <span className="font-black text-amber-300">{primaryStarredMember.name}:</span>
          <span>
            {primaryStarredMember.distanceFromMeMeters < 1000
              ? `${Math.round(primaryStarredMember.distanceFromMeMeters)}m`
              : `${(primaryStarredMember.distanceFromMeMeters / 1000).toFixed(1)}km`}
          </span>
          {primaryStarredMember.location?.speedKmh !== undefined && (
            <span className="text-cyan-400 text-[10px]">
              ({Math.round(primaryStarredMember.location.speedKmh)} km/h)
            </span>
          )}
          {primaryStarredMember.distanceFromMeMeters > 2500 && (
            <span className="text-amber-400 font-black text-[10px] ml-0.5">• LAGGING</span>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1-TAP REJOIN PILL ON MAP (If disconnected but last squad known)
      ───────────────────────────────────────────────────────────── */}
      {!isConnected && lastRoomCode && onRejoinRoom && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <button
            onClick={onRejoinRoom}
            className="h-8 px-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-black text-xs flex items-center gap-1.5 shadow-xl shadow-amber-500/30 cursor-pointer transition-all active:scale-95 animate-in fade-in"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Rejoin Crew "{lastRoomCode}"</span>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREW EVENT NOTIFICATION TOAST (Join / Leave / Host Closed)
      ───────────────────────────────────────────────────────────── */}
      {crewNotification && (
        <div className="absolute top-12 left-2 right-2 sm:left-auto sm:right-2 sm:max-w-sm z-30 pointer-events-auto animate-in slide-in-from-top-2 duration-200">
          <div className={`p-2.5 rounded-xl backdrop-blur-md border shadow-xl flex items-center justify-between gap-2 font-mono text-xs ${
            crewNotification.type === 'join'
              ? 'bg-emerald-950/92 border-emerald-500/60 text-emerald-200 shadow-emerald-950/40'
              : crewNotification.type === 'leave'
              ? 'bg-slate-900/92 border-slate-700 text-slate-300 shadow-black/40'
              : 'bg-cyan-950/92 border-cyan-500/60 text-cyan-200 shadow-cyan-950/40'
          }`}>
            <span className="font-bold truncate">{crewNotification.text}</span>
            {onDismissCrewNotification && (
              <button
                onClick={onDismissCrewNotification}
                className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SAFETY LEAVE CONFIRMATION MODAL
      ───────────────────────────────────────────────────────────── */}
      {isLeaveModalOpen && (
        <div 
          onClick={e => { if (e.target === e.currentTarget) setIsLeaveModalOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in cursor-pointer"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-700/80 p-4 shadow-2xl font-mono space-y-3 pointer-events-auto cursor-default"
          >
            <div className="flex items-center gap-2 text-rose-400 font-heading font-black text-sm uppercase tracking-wider">
              <LogOut className="w-4 h-4" />
              <span>{isHost ? 'End Crew Ride?' : 'Leave Crew Radar?'}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isHost ? (
                <>You are the <strong>Crew Leader</strong>. Leaving will end the live radar session for all connected riders.</>
              ) : (
                <>Disconnect from squad <strong>{roomCode}</strong>? Your personal GPS track recording in Garage will continue.</>
              )}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Stay with Crew
              </button>
              <button
                onClick={() => {
                  setIsLeaveModalOpen(false);
                  if (onLeaveRoom) onLeaveRoom();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer shadow-md shadow-rose-900/30 transition-colors"
              >
                {isHost ? 'End Ride' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE MAPS-STYLE FLOATING RE-CENTER FAB (BOTTOM-RIGHT)
      ───────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          bottom: 'max(4.5rem, calc(env(safe-area-inset-bottom) + 4.2rem))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
        className="absolute z-20 flex flex-col gap-2 pointer-events-auto"
      >
        <button
          onClick={handleRecenterMe}
          className={`w-12 h-12 rounded-full backdrop-blur-md border shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
            selectedRiderId === 'me'
              ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-cyan-500/40 ring-2 ring-cyan-400/50'
              : 'bg-slate-950/90 border-slate-700 text-cyan-400 hover:bg-slate-900 hover:border-cyan-400'
          }`}
          title="Recenter on My Location (GPS)"
          aria-label="Recenter Map"
        >
          <Crosshair className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* Offline Caching Progress / Success Pill */}
      {(cacheProgress || cacheSuccessMsg) && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 py-1 rounded-full bg-slate-950/95 backdrop-blur-md border border-emerald-500/60 text-emerald-300 font-mono text-[11px] font-bold shadow-xl flex items-center gap-2 whitespace-nowrap animate-in fade-in">
          {cacheProgress && !cacheSuccessMsg && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Caching Offline Map: {cacheProgress.percentage}% ({cacheProgress.cached}/{cacheProgress.total})</span>
            </>
          )}
          {cacheSuccessMsg && (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{cacheSuccessMsg}</span>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SOS BANNER OVERLAY (Clean, solid, non-bouncing warning banner)
      ───────────────────────────────────────────────────────────── */}
      {sosAlert && (
        <div className="absolute top-12 left-2 right-12 z-20 p-2 rounded-xl bg-rose-950/95 backdrop-blur-md border-2 border-rose-500 text-white font-mono text-xs shadow-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span>🚨</span>
            <span className="font-bold text-rose-300 truncate text-[11px]">
              REGROUP: {sosAlert.fromName}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🚨 ${sosAlert.fromName}, we received your emergency SOS! The squad is en route to your GPS location: https://maps.google.com/?q=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1"
              title="Send WhatsApp emergency confirmation to rider"
            >
              <Share2 className="w-3 h-3" />
              <span>WA</span>
            </a>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Maps</span>
            </a>
            {onDismissSos && (
              <button
                onClick={onDismissSos}
                className="px-1.5 py-0.5 rounded border border-rose-700 text-rose-300 text-[10px]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

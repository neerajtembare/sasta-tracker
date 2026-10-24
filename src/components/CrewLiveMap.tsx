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
import { speakAlert } from '../utils/tts';

function calcHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const lambda1 = (lon1 * Math.PI) / 180;
  const lambda2 = (lon2 * Math.PI) / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

function getDirectionArrow(angle: number): { arrow: string; label: string } {
  if (angle >= 337.5 || angle < 22.5) return { arrow: '↑', label: 'AHEAD' };
  if (angle >= 22.5 && angle < 67.5) return { arrow: '↗', label: 'HALF-RIGHT' };
  if (angle >= 67.5 && angle < 112.5) return { arrow: '→', label: 'RIGHT' };
  if (angle >= 112.5 && angle < 157.5) return { arrow: '↘', label: 'BEHIND-RIGHT' };
  if (angle >= 157.5 && angle < 202.5) return { arrow: '↓', label: 'BEHIND' };
  if (angle >= 202.5 && angle < 247.5) return { arrow: '↙', label: 'BEHIND-LEFT' };
  if (angle >= 247.5 && angle < 292.5) return { arrow: '←', label: 'LEFT' };
  return { arrow: '↖', label: 'HALF-LEFT' };
}

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
  leaderId?: string | null;
  onSetSquadLeader?: (targetRiderId: string, targetName: string) => void;
  onClaimSquadLeader?: () => void;
  trailedRiderId?: string | null;
  onTrailRider?: (targetRiderId: string | null) => void;
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
  isTrackingActive?: boolean;
  onToggleTracking?: (enable?: boolean) => void;
  onJoinSharedRoute?: (route: any) => void;
  starredRiderIds?: string[];
  externalMapLayer?: MapLayerType;
  onChangeMapLayer?: (layer: MapLayerType) => void;
}

export type MapLayerType = 'dark' | 'streets' | 'satellite' | 'sunlight';

export const CrewLiveMap: React.FC<CrewLiveMapProps> = ({
  myLocation,
  myRiderName,
  myColor,
  isHost,
  leaderId = null,
  onSetSquadLeader,
  onClaimSquadLeader,
  trailedRiderId = null,
  onTrailRider,
  members,
  sosAlert,
  roomCode = '',
  lastRoomCode = '',
  isConnected = false,
  theme = 'dark',
  unitSystem = 'metric',
  externalMapLayer,
  onChangeMapLayer,
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

  // Orientation & Compass state (Course-Up direction follow vs North-Up)
  const [orientationMode, setOrientationMode] = useState<'north' | 'course'>(() => {
    try {
      const saved = localStorage.getItem('throttlelog_map_orientation') || localStorage.getItem('sasta_map_orientation');
      if (saved === 'north' || saved === 'course') return saved;
    } catch {}
    return 'course'; // Default to course-up (direction follow) for live motorcycle navigation
  });
  const [isFlipped180, setIsFlipped180] = useState<boolean>(false);

  const handleToggleOrientation = () => {
    triggerHaptic(25);
    setOrientationMode(prev => {
      const next = prev === 'course' ? 'north' : 'course';
      try {
        localStorage.setItem('throttlelog_map_orientation', next);
        localStorage.setItem('sasta_map_orientation', next);
      } catch {}
      return next;
    });
  };

  // Offline route tile caching state
  const [isCachingRoute, setIsCachingRoute] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<CacheProgress | null>(null);
  const [cacheSuccessMsg, setCacheSuccessMsg] = useState<string | null>(null);

  // Default to Dark map for eye comfort and stealth motorcycle cockpit look
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    try {
      const isSun = localStorage.getItem('throttlelog_sunlight_mode') === 'true' || localStorage.getItem('sasta_sunlight_mode') === 'true';
      if (typeof window !== 'undefined' && isSun) {
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

  const isFreePanning = selectedRiderId === null;

  // Calculate rotation for map container
  // North-up: 0° (or 180° if flipped by user).
  // Course-up: rotated by -myHeading so bike's forward path is ALWAYS UP on phone screen!
  // In Free Exploration mode (user dragging/browsing): keep North-Up (0°) so pan gestures match finger movement 1:1!
  const targetMapRotation = useMemo(() => {
    let base = 0;
    if (orientationMode === 'course' && myHeading !== null && !isFreePanning) {
      base = -myHeading;
    }
    return (isFlipped180 ? 180 : 0) + base;
  }, [orientationMode, myHeading, isFlipped180, isFreePanning]);

  // Cardinal direction helper
  const getCardinal = (deg: number | null) => {
    if (deg === null) return 'N';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return dirs[idx];
  };

  // Trailing polyline layers
  const trailingPolylineRef = useRef<L.Polyline | null>(null);
  const trailingGlowRef = useRef<L.Polyline | null>(null);

  // Trailed member & live guidance metrics
  const trailedMember = useMemo(() => {
    if (!trailedRiderId) return null;
    return members.find(m => m.riderId === trailedRiderId) || null;
  }, [trailedRiderId, members]);

  const trailingStats = useMemo(() => {
    if (!trailedMember || !trailedMember.location || !myLocation) return null;
    const distMeters = calcHaversineMeters(
      myLocation.lat,
      myLocation.lon,
      trailedMember.location.lat,
      trailedMember.location.lon
    );
    const targetBearing = calcBearingDegrees(
      myLocation.lat,
      myLocation.lon,
      trailedMember.location.lat,
      trailedMember.location.lon
    );
    const relativeAngle = ((targetBearing - (myHeading ?? 0)) + 360) % 360;
    const direction = getDirectionArrow(relativeAngle);
    return {
      distMeters,
      targetBearing,
      relativeAngle,
      direction,
      speedKmh: trailedMember.location.speedKmh,
      isStopped: trailedMember.location.status === 'stopped' || (trailedMember.location.speedKmh || 0) < 2.5,
    };
  }, [trailedMember, myLocation, myHeading]);

  const squadLeader = useMemo(() => {
    return members.find(m => (m.isHost || m.riderId === leaderId) && m.isOnline);
  }, [members, leaderId]);

  const selectedMember = useMemo(() => {
    if (!selectedRiderId || selectedRiderId === 'me') return null;
    return members.find(m => m.riderId === selectedRiderId) || null;
  }, [selectedRiderId, members]);

  // Trailing vector guidance polyline on Leaflet map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const cleanup = () => {
      if (trailingPolylineRef.current) {
        trailingPolylineRef.current.remove();
        trailingPolylineRef.current = null;
      }
      if (trailingGlowRef.current) {
        trailingGlowRef.current.remove();
        trailingGlowRef.current = null;
      }
    };

    if (!trailedRiderId || !myLocation) {
      cleanup();
      return;
    }

    const target = members.find(m => m.riderId === trailedRiderId);
    if (!target || !target.location || typeof target.location.lat !== 'number' || typeof target.location.lon !== 'number') {
      cleanup();
      return;
    }

    const latlngs: L.LatLngExpression[] = [
      [myLocation.lat, myLocation.lon],
      [target.location.lat, target.location.lon],
    ];

    if (!trailingPolylineRef.current) {
      trailingGlowRef.current = L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
      }).addTo(map);

      trailingPolylineRef.current = L.polyline(latlngs, {
        color: '#fbbf24',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.95,
        lineCap: 'round',
      }).addTo(map);
    } else {
      trailingGlowRef.current?.setLatLngs(latlngs);
      trailingPolylineRef.current.setLatLngs(latlngs);
    }
  }, [trailedRiderId, myLocation?.lat, myLocation?.lon, members]);

  // Trailing separation distance audio watchdog (intercom TTS)
  const lastTrailingLagRef = useRef<number>(0);
  useEffect(() => {
    if (!trailingStats || !trailedMember) return;
    const now = Date.now();
    if (trailingStats.distMeters > 1500 && now - lastTrailingLagRef.current > 180000) {
      lastTrailingLagRef.current = now;
      playWarningChime();
      speakAlert(`Trailing alert: ${trailedMember.name} is ${formatDistance(trailingStats.distMeters)} ahead.`);
    }
  }, [trailingStats?.distMeters, trailedMember?.name]);

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

  // Note: Convoy safety, battery, runaway, separation & roll call watchdogs run globally in App.tsx via convoyWatchdog

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
      // High-contrast, maximum luminance OSM base with contrast/saturation boost
      tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
        className: 'sunlight-map-tiles',
      }).addTo(map);
    } else {
      // Pristine Dark Mode Map (High-performance, zero-key OSM with dark cockpit filter)
      tileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap Dark',
        className: 'dark-map-tiles',
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
      const result = await preCacheRouteTiles(bounds, 11, 14, (progress) => {
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
    const initial = myRiderName ? myRiderName.trim().charAt(0).toUpperCase() : 'N';
    const color = myColor || '#00f0ff';
    const speed = formatSpeed(myLocation.speedKmh);
    const heading = myLocation.heading !== null && myLocation.heading !== undefined ? myLocation.heading : null;

    // Counter-rotation so text & initials stay 100% horizontal and upright at all times
    const counterRotation = 0;

    // Arrow navigation chevron always rotates to true travel heading
    const arrowRotation = heading !== null ? heading : 0;

    const prev = prevMyPosRef.current as any;
    const isFirstTime = !myMarkerRef.current || !prev;
    const profileChanged = prev && (prev.name !== myRiderName || prev.color !== color || prev.orientationMode !== orientationMode || prev.isHost !== isHost);

    // Google Maps-style forward headlight beam & navigation chevron
    const forwardIndicator = heading !== null 
      ? `<div class="live-rider-beam-me" style="position:absolute; inset:0; display:flex; justify-content:center; align-items:flex-start; transform:rotate(${arrowRotation}deg); transform-origin:center center; pointer-events:none; transition:transform 0.25s ease;">
           <!-- Forward Illumination Light Cone -->
           <div style="position:absolute; top:-36px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:18px solid transparent; border-right:18px solid transparent; border-bottom:40px solid ${color}; opacity:0.18; filter:blur(2px);"></div>
           <!-- High-Visibility 3D Navigation Chevron -->
           <div style="position:absolute; top:-14px; left:50%; transform:translateX(-50%); filter:drop-shadow(0 0 6px ${color});">
             <svg viewBox="0 0 24 24" width="22" height="22">
               <path d="M12 2 L22 20 L12 15 L2 20 Z" fill="${color}" stroke="#080c10" stroke-width="1.8" stroke-linejoin="round"/>
             </svg>
           </div>
         </div>`
      : '';

    const myLeaderCrown = isHost
      ? `<div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%) rotate(${counterRotation}deg); background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">👑 LEADER</div>`
      : '';

    const html = `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Tap to customize your callsign & bike">
        ${forwardIndicator}
        ${myLeaderCrown}
        <!-- Pulsing radar halo -->
        <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:${color}; opacity:0.2; border:1.5px solid ${color};"></div>
        <!-- Center initial badge (Counter-rotated to always be upright) -->
        <div style="position:relative; width:28px; height:28px; border-radius:50%; background:${color}; border:2.5px solid #080c10; box-shadow:0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:12px; transform:rotate(${counterRotation}deg); transition:transform 0.3s ease;">
          ${initial}
        </div>
        <!-- Upright label below -->
        <div style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%) rotate(${counterRotation}deg); background:#080c10; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:900; padding:1px 5px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.9); transition:transform 0.3s ease;">
          YOU
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'live-rider-marker-me',
      html,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!myMarkerRef.current) {
      myMarkerRef.current = L.marker(pos, { icon, zIndexOffset: 1000 }).addTo(map);
      myMarkerRef.current.on('click', () => {
        triggerHaptic(30);
        if (onOpenCrewManage) {
          onOpenCrewManage('active');
        }
      });
      prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading, name: myRiderName, color, orientationMode, isHost } as any;
    } else {
      myMarkerRef.current.setLatLng(pos);

      // In-place rotation or full re-render on profile/mode changes
      if (isFirstTime || profileChanged) {
        myMarkerRef.current.setIcon(icon);
        prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading, name: myRiderName, color, orientationMode, isHost } as any;
      } else {
        const el = myMarkerRef.current.getElement();
        if (el && heading !== null) {
          const beamEl = el.querySelector('.live-rider-beam-me') as HTMLElement | null;
          if (beamEl) {
            beamEl.style.transform = `rotate(${arrowRotation}deg)`;
          }
        }
      }
    }

    // Google Maps-style look-ahead horizon camera follow
    if (selectedRiderId === 'me') {
      if (orientationMode === 'course' && heading !== null && myLocation.speedKmh >= 5) {
        // Forward look-ahead: offset camera ~100m ahead along heading
        const offsetMeters = 100;
        const rad = (heading * Math.PI) / 180;
        const dLat = (offsetMeters / 111320) * Math.cos(rad);
        const dLon = (offsetMeters / (111320 * Math.cos((myLocation.lat * Math.PI) / 180))) * Math.sin(rad);
        map.panTo([myLocation.lat + dLat, myLocation.lon + dLon], { animate: true, duration: 0.5 });
      } else {
        map.panTo(pos, { animate: true, duration: 0.5 });
      }
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

      const memberCounterRotation = 0;
      const memberArrowRotation = bearing !== null ? bearing : 0;

      // Centered Google Maps-style 3D navigation chevron
      const bearingArrow = bearing !== null && bearing !== undefined
        ? `<div class="live-rider-arrow" style="position:absolute; inset:0; display:flex; justify-content:center; align-items:flex-start; transform:rotate(${memberArrowRotation}deg); transform-origin:center center; pointer-events:none; transition:transform 0.25s ease;">
             <div style="position:absolute; top:-12px; left:50%; transform:translateX(-50%); filter:drop-shadow(0 0 5px ${color});">
               <svg viewBox="0 0 24 24" width="18" height="18">
                 <path d="M12 2 L22 20 L12 15 L2 20 Z" fill="${color}" stroke="#080c10" stroke-width="1.8" stroke-linejoin="round"/>
               </svg>
             </div>
           </div>`
        : '';

      const leaderCrown = m.isHost
        ? `<div class="upright-counter-rotate" style="position:absolute; top:-18px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8); transition:transform 0.3s ease;">👑 LEADER</div>`
        : '';

      const starBadge = isStarred
        ? `<div class="upright-counter-rotate" style="position:absolute; top:-18px; right:-6px; transform:rotate(${memberCounterRotation}deg); transform-origin:center center; font-size:11px; filter:drop-shadow(0 0 3px #fbbf24); z-index:10; transition:transform 0.3s ease;">⭐</div>`
        : '';

      const haloRing = isStarred
        ? `<div style="position:absolute; width:44px; height:44px; border-radius:50%; border:2px dashed #fbbf24; opacity:0.85;"></div>`
        : '';

      const opacity = isOnline ? '1' : '0.65';

      // Speed/status tag styling: green for cruising, amber for stopped, slate for offline
      const statusColor = !isOnline ? '#64748b' : isStopped ? '#f59e0b' : '#10b981';
      const statusBg = !isOnline ? '#0f172a' : isStopped ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';

      const html = `
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; opacity:${opacity}; cursor:pointer;" title="Tap to focus ${m.name}">
          ${haloRing}
          ${leaderCrown}
          ${starBadge}
          ${bearingArrow}
          <div class="upright-counter-rotate" style="width:28px; height:28px; border-radius:50%; background:${color}; border:2px solid ${isStarred ? '#fbbf24' : '#080c10'}; box-shadow:0 0 ${isStarred ? '12px #fbbf24' : `8px ${color}`}, 0 2px 4px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:11px; transform:rotate(${memberCounterRotation}deg); transform-origin:center center; transition:transform 0.3s ease;">
            ${initial}
          </div>
          <div class="upright-counter-rotate" style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:#0f172a; border:1px solid ${isStarred ? '#fbbf24' : color}; color:${isStarred ? '#fbbf24' : color}; font-family:monospace; font-size:8px; font-weight:bold; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.85); transition:transform 0.3s ease;">
            ${isStarred ? '⭐ ' : ''}${m.name}
          </div>
          <div class="upright-counter-rotate live-rider-speed" style="position:absolute; bottom:-28px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:${statusBg}; border:1px solid ${statusColor}; color:${statusColor}; font-family:monospace; font-size:7px; font-weight:900; padding:0.5px 3.5px; border-radius:3px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.7); transition:transform 0.3s ease; letter-spacing:0.3px;">
            ${statusTag}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `live-rider-marker-${m.riderId}`,
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
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

        // Zero-GC in-place rotation of the direction arrow & upright labels without destroying DOM
        const el = marker.getElement();
        if (el) {
          if (bearing !== null && bearing !== undefined) {
            const arrowEl = el.querySelector('.live-rider-arrow') as HTMLElement | null;
            if (arrowEl) {
              arrowEl.style.transform = `rotate(${memberArrowRotation}deg)`;
            }
          }
          const uprightEls = el.querySelectorAll('.upright-counter-rotate') as NodeListOf<HTMLElement>;
          uprightEls.forEach((upEl) => {
            if (upEl.textContent?.includes(m.name) || upEl.textContent?.includes('LEADER')) {
              upEl.style.transform = `translateX(-50%) rotate(${memberCounterRotation}deg)`;
            } else {
              upEl.style.transform = `rotate(${memberCounterRotation}deg)`;
            }
          });

          // In-place speed/status tag text and color update (avoids full icon rebuild for speed changes)
          const speedEl = el.querySelector('.live-rider-speed') as HTMLElement | null;
          if (speedEl && prev && prev.speedText !== statusTag) {
            speedEl.textContent = statusTag;
            speedEl.style.color = statusColor;
            speedEl.style.borderColor = statusColor;
            speedEl.style.backgroundColor = statusBg;
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
  }, [members, unitSystem, starredRiderIds, targetMapRotation, orientationMode, myHeading]);

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
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
        className="cursor-grab active:cursor-grabbing w-full h-full" 
      />

      {/* Cold-Start Satellite Acquisition Pill */}
      {!myLocation && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-full bg-slate-950/92 backdrop-blur-md border border-amber-500/50 text-amber-300 font-mono text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Acquiring GPS fix...</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CONVOY PROXIMITY PILL (Shows primary starred buddy distance & speed)
      ───────────────────────────────────────────────────────────── */}
      {!trailedRiderId && primaryStarredMember && primaryStarredMember.distanceFromMeMeters !== undefined && (
        <div 
          onClick={() => {
            triggerHaptic(20);
            if (primaryStarredMember.location && mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([primaryStarredMember.location.lat, primaryStarredMember.location.lon], 16, { animate: true, duration: 0.6 });
            }
          }}
          style={{
            top: sosAlert 
              ? 'max(8.5rem, calc(env(safe-area-inset-top) + 8.0rem))' 
              : 'max(3.8rem, calc(env(safe-area-inset-top) + 3.4rem))',
          }}
          className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto px-3 py-1 rounded-full backdrop-blur-md border shadow-xl font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap animate-in fade-in ${
            primaryStarredMember.distanceFromMeMeters > 2500
              ? 'bg-amber-950/95 border-amber-500 text-amber-300 animate-pulse'
              : 'bg-slate-950/95 border-amber-500/60 text-white'
          }`}
          title="Tap to center map on your primary starred convoy buddy"
        >
          <span className="text-amber-400">⭐</span>
          <span className="font-black text-amber-300">{primaryStarredMember.name}:</span>
          <span>
            {formatDistance(primaryStarredMember.distanceFromMeMeters)}
          </span>
          {primaryStarredMember.location?.speedKmh !== undefined && (
            <span className="text-cyan-400 text-[10px]">
              ({formatSpeed(primaryStarredMember.location.speedKmh)})
            </span>
          )}
          {primaryStarredMember.distanceFromMeMeters > 2500 && (
            <span className="text-amber-400 font-black text-[10px] ml-0.5">• LAGGING</span>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CREW EVENT NOTIFICATION TOAST (Join / Leave / Host Closed)
      ───────────────────────────────────────────────────────────── */}
      {crewNotification && (
        <div 
          style={{
            top: sosAlert 
              ? 'max(8.5rem, calc(env(safe-area-inset-top) + 8.0rem))' 
              : 'max(3.8rem, calc(env(safe-area-inset-top) + 3.4rem))',
          }}
          className="absolute left-2 right-2 sm:left-auto sm:right-2 sm:max-w-sm z-30 pointer-events-auto animate-in slide-in-from-top-2 duration-200"
        >
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
          GOOGLE MAPS-STYLE FLOATING LIVE SPEEDOMETER HUD (BOTTOM-LEFT)
      ───────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          bottom: 'max(4.5rem, calc(env(safe-area-inset-bottom) + 4.2rem))',
          left: 'max(0.75rem, env(safe-area-inset-left))',
        }}
        className="absolute z-30 pointer-events-auto animate-in fade-in duration-200"
      >
        <div 
          onClick={() => triggerHaptic(20)}
          className={`px-2.5 py-1.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex flex-col items-center justify-center font-mono cursor-pointer transition-all active:scale-95 ${
          isLight 
            ? 'bg-white/95 border-slate-300 text-slate-800' 
            : 'bg-[#0d131a]/95 border-[#1e2a38] text-white shadow-black/80'
        }`}>
          <div className="flex items-baseline gap-1">
            <span className="font-heading font-black text-2xl tracking-tighter text-cyan-400">
              {myLocation ? Math.round(unitSystem === 'imperial' ? myLocation.speedKmh * 0.621371 : myLocation.speedKmh) : '0'}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              {unitSystem === 'imperial' ? 'mph' : 'km/h'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${myLocation && myLocation.speedKmh > 2.5 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{myLocation && myLocation.speedKmh > 2.5 ? 'CRUISING' : 'IDLE'}</span>
          </div>
          {isRecording && totalDistanceMeters !== undefined && totalDistanceMeters > 0 && (
            <div className="text-[8px] font-bold text-rose-400 mt-0.5 border-t border-slate-800/80 pt-0.5 w-full text-center">
              REC • {unitSystem === 'imperial'
                ? `${((totalDistanceMeters / 1000) * 0.621371).toFixed(1)} mi`
                : `${(totalDistanceMeters / 1000).toFixed(1)} km`}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE MAPS-STYLE FLOATING MAP CONTROLS (BOTTOM-RIGHT)
      ───────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          bottom: 'max(4.5rem, calc(env(safe-area-inset-bottom) + 4.2rem))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
        className="absolute z-30 flex flex-col items-center gap-2 pointer-events-auto"
      >
        {/* Glove-friendly Zoom In / Out & Layer Quick Toggle */}
        <div className="flex flex-col gap-1.5 mb-0.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              mapInstanceRef.current?.zoomIn();
            }}
            className="w-10 h-10 rounded-xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 bg-slate-950/90 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 text-lg font-black"
            title="Zoom In (Map)"
            aria-label="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              mapInstanceRef.current?.zoomOut();
            }}
            className="w-10 h-10 rounded-xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 bg-slate-950/90 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500 text-lg font-black"
            title="Zoom Out (Map)"
            aria-label="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              const next = mapLayer === 'dark' ? 'sunlight' : mapLayer === 'sunlight' ? 'satellite' : 'dark';
              setMapLayer(next);
              onChangeMapLayer?.(next);
            }}
            className="w-10 h-10 rounded-xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 bg-slate-950/90 border-slate-700 text-cyan-400 hover:text-white hover:border-slate-500"
            title={`Map Theme: ${mapLayer.toUpperCase()} • Tap to cycle Dark / Sunlight / Satellite`}
            aria-label="Toggle Map Theme"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Google Maps-style Compass / Heading Follow Mode Toggle */}
        <button
          type="button"
          onClick={handleToggleOrientation}
          className={`w-11 h-11 rounded-full backdrop-blur-md border shadow-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-90 ${
            orientationMode === 'course'
              ? 'bg-slate-950/95 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/30'
              : 'bg-slate-950/90 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
          title={orientationMode === 'course' ? 'Course-Up (Map rotates with bike) • Tap for North-Up' : 'North-Up • Tap for Course-Up (Direction Follow)'}
          aria-label="Toggle Map Orientation"
        >
          <div 
            style={{ 
              transform: `rotate(${orientationMode === 'course' && myHeading !== null ? -myHeading : 0}deg)`,
              transition: 'transform 0.25s ease'
            }}
            className="flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Red North Needle */}
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[8px] border-b-rose-500" />
            {/* Silver South Needle */}
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[8px] border-t-slate-300" />
          </div>
          <span className="text-[7.5px] font-black tracking-tighter mt-0.5 leading-none text-slate-400">
            {orientationMode === 'course' ? 'HDG' : 'N'}
          </span>
        </button>

        {/* Recenter FAB */}
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

      {/* ─────────────────────────────────────────────────────────────
          TRAILING RIDER LIVE GUIDANCE HUD
      ───────────────────────────────────────────────────────────── */}
      {trailedMember && trailingStats && (
        <div 
          style={{ 
            top: sosAlert ? 'max(7.2rem, calc(env(safe-area-inset-top) + 6.8rem))' : 'max(3.8rem, calc(env(safe-area-inset-top) + 3.4rem))',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-30 pointer-events-none flex justify-center animate-in slide-in-from-top-2 duration-150"
        >
          <div className="pointer-events-auto w-full max-w-md px-3 py-2 rounded-2xl bg-slate-950/95 backdrop-blur-xl border-2 border-amber-500/80 text-white font-mono shadow-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shrink-0 shadow-md">
                {trailingStats.direction.arrow}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-heading font-black text-xs text-amber-300 truncate">
                    {trailedMember.isHost || trailedMember.riderId === leaderId ? '👑 ' : '🧭 '}{trailedMember.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {trailingStats.direction.label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2">
                  <span className="font-black text-cyan-400">
                    {formatDistance(trailingStats.distMeters)}
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">
                    {trailingStats.isStopped 
                      ? 'STOPPED' 
                      : `${Math.round(unitSystem === 'imperial' ? (trailingStats.speedKmh || 0) * 0.621371 : (trailingStats.speedKmh || 0))} ${unitSystem === 'imperial' ? 'mph' : 'km/h'}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {trailedMember.location && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(25);
                    openGoogleMapsNavigation(trailedMember.location!.lat, trailedMember.location!.lon);
                  }}
                  className="p-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md"
                  title="Open Google Maps navigation to rider"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  onTrailRider?.(null);
                  speakAlert('Stopped trailing rider');
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300 cursor-pointer transition-all active:scale-95"
                title="Stop trailing"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          1-TAP FOLLOW SQUAD LEADER PILL (WHEN NOT TRAILING)
          Positioned below the trailing HUD / callout banner zone to avoid overlap
      ───────────────────────────────────────────────────────────── */}
      {!trailedRiderId && squadLeader && squadLeader.riderId !== 'me' && (
        <div 
          style={{ 
            top: sosAlert ? 'max(9.5rem, calc(env(safe-area-inset-top) + 9.2rem))' : 'max(6.5rem, calc(env(safe-area-inset-top) + 6.2rem))',
          }}
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-auto animate-in slide-in-from-top-1 duration-150"
        >
          <button
            type="button"
            onClick={() => {
              triggerHaptic(30);
              onTrailRider?.(squadLeader.riderId);
              speakAlert(`Now trailing ride leader ${squadLeader.name}`);
            }}
            className="px-3.5 py-1.5 rounded-full bg-slate-950/92 hover:bg-slate-900 border border-amber-500/70 text-amber-300 font-mono text-xs font-black shadow-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 backdrop-blur-md"
          >
            <span>👑 Follow Leader ({squadLeader.name})</span>
            {squadLeader.distanceFromMeMeters !== undefined && (
              <span className="text-[10px] text-amber-400/80 bg-amber-500/20 px-1 rounded">
                {formatDistance(squadLeader.distanceFromMeMeters)}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FOCUSED RIDER BOTTOM ACTION CARD
      ───────────────────────────────────────────────────────────── */}
      {selectedMember && selectedMember.riderId !== 'me' && (
        <div 
          style={{ 
            bottom: 'max(4.8rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-40 pointer-events-none flex justify-center animate-in slide-in-from-bottom-2 duration-150"
        >
          <div className={`pointer-events-auto w-full max-w-md p-3 sm:p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl space-y-2.5 font-mono ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-900' : 'bg-slate-950/98 border-cyan-500/40 text-white'
          }`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: selectedMember.color || '#00f0ff' }} 
                />
                <div className="truncate">
                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                    <span>{selectedMember.name}</span>
                    {selectedMember.bikeModel && (
                      <span className="text-[10px] text-slate-400 font-normal">({selectedMember.bikeModel})</span>
                    )}
                    {(selectedMember.isHost || selectedMember.riderId === leaderId) && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black">
                        👑 LEAD
                      </span>
                    )}
                    {trailedRiderId === selectedMember.riderId && (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-black animate-pulse">
                        🧭 TRAILING
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                    <span>
                      {selectedMember.isOnline 
                        ? (selectedMember.location?.speedKmh && selectedMember.location.speedKmh >= 2.5 
                            ? `Cruising at ${formatSpeed(selectedMember.location.speedKmh)}` 
                            : 'Stopped')
                        : 'Offline'}
                    </span>
                    {selectedMember.location?.batteryPct !== undefined && (
                      <span>🔋 {selectedMember.location.batteryPct}%</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-right">
                  <div className="font-black text-cyan-400 text-xs">
                    {formatDistance(selectedMember.distanceFromMeMeters)}
                  </div>
                  <div className="text-[9px] text-slate-500">Separation</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRiderId('me')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer ml-1"
                  title="Close card"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(25);
                  if (trailedRiderId === selectedMember.riderId) {
                    onTrailRider?.(null);
                    speakAlert(`Stopped trailing ${selectedMember.name}`);
                  } else {
                    onTrailRider?.(selectedMember.riderId);
                    speakAlert(`Now trailing ${selectedMember.name}`);
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-md ${
                  trailedRiderId === selectedMember.riderId
                    ? 'bg-amber-500 text-slate-950 font-black shadow-amber-500/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950'
                }`}
              >
                <span>{trailedRiderId === selectedMember.riderId ? '✕ Stop Trailing' : '🧭 Trail This Rider'}</span>
              </button>

              {!(selectedMember.isHost || selectedMember.riderId === leaderId) && onSetSquadLeader && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    onSetSquadLeader(selectedMember.riderId, selectedMember.name);
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-amber-950/60 border border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  title="Make this rider the squad leader"
                >
                  <span>👑 Make Lead</span>
                </button>
              )}

              {selectedMember.location && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    openGoogleMapsNavigation(selectedMember.location!.lat, selectedMember.location!.lon);
                  }}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  title="Navigate directly to rider in Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE MAPS-STYLE PROMINENT RE-CENTER BUTTON (WHEN FREE-PANNING)
      ───────────────────────────────────────────────────────────── */}
      {selectedRiderId === null && myLocation && (
        <div 
          style={{ 
            bottom: 'max(4.8rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
          }}
          className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-in slide-in-from-bottom-2 duration-150"
        >
          <button
            type="button"
            onClick={handleRecenterMe}
            className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono shadow-2xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 ring-2 ring-cyan-300 shadow-cyan-500/40"
            title="Snap back to current motorcycle location & resume direction follow"
          >
            <Crosshair className="w-4 h-4 stroke-[2.8]" />
            <span>Re-center</span>
          </button>
        </div>
      )}

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
        <div 
          style={{
            top: 'max(3.8rem, calc(env(safe-area-inset-top) + 3.4rem))',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-50 pointer-events-none flex justify-center animate-in slide-in-from-top-2 duration-200"
        >
          <div className="pointer-events-auto w-full max-w-md p-2.5 rounded-2xl bg-rose-950/95 backdrop-blur-md border-2 border-rose-500 text-white font-mono text-xs shadow-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-base animate-pulse">🚨</span>
              <span className="font-bold text-rose-300 truncate text-[11px]">
                EMERGENCY SOS: {sosAlert.fromName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`🚨 ${sosAlert.fromName}, we received your emergency SOS! The squad is en route to your GPS location: https://maps.google.com/?q=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Send WhatsApp emergency confirmation to rider"
              >
                <Share2 className="w-3 h-3" />
                <span>WhatsApp</span>
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <Navigation className="w-3 h-3" />
                <span>Navigate</span>
              </a>
              {onDismissSos && (
                <button
                  type="button"
                  onClick={onDismissSos}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] cursor-pointer transition-all active:scale-95"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

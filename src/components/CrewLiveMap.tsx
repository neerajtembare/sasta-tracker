import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { GroupMemberInfo, SosAlert, CrewNotification } from '../hooks/useGroupRide';
import { CALLOUT_PRESETS, CalloutPreset } from '../utils/callouts';
import { AppTheme, RideAnalysis } from '../types';
import { openGoogleMapsNavigation } from '../utils/navigation';
import { readMigratedStorageKey, writeMigratedStorageKey } from '../utils/units';
import { getRiderProfile } from '../utils/riderProfile';
import {
  Crosshair,
  Share2,
  AlertTriangle,
  Navigation,
  Coffee,
  Compass,
  Layers,
  Crown,
  Fuel,
  ShieldCheck,
  Battery,
  X,
} from 'lucide-react';
import { triggerHaptic, playWarningChime } from '../utils/audioChimes';
import { speakAlert } from '../utils/tts';

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  accuracy?: number | null;
}

interface CrewLiveMapProps {
  myLocation: MyLocationData | null;
  myRiderName: string;
  myRiderId?: string;
  myColor: string;
  isHost: boolean;
  leaderId?: string | null;
  onSetSquadLeader?: (targetRiderId: string, targetName: string) => void;
  onClaimSquadLeader?: () => void;
  trailedRiderId?: string | null;
  onTrailRider?: (targetRiderId: string | null) => void;
  members: GroupMemberInfo[];
  sosAlert: SosAlert | null;
  theme?: AppTheme;
  onCancelSos?: () => void;
  onDismissSos?: () => void;
  crewNotification?: CrewNotification | null;
  onDismissCrewNotification?: () => void;
  focusedRiderId?: string | null;
  activeRoute?: RideAnalysis | null;
  onSelectRider?: (riderId: string) => void;
  isOnRadar?: boolean;
  externalMapLayer?: MapLayerType;
  onChangeMapLayer?: (layer: MapLayerType) => void;
  onSendCallout?: (preset: CalloutPreset) => void;
  onOpenProfile?: () => void;
  hasActiveCallout?: boolean;
}

export type MapLayerType = 'dark' | 'streets' | 'satellite' | 'sunlight';

export const CrewLiveMap: React.FC<CrewLiveMapProps> = ({
  myLocation,
  myRiderName,
  myRiderId,
  myColor,
  isHost,
  leaderId = null,
  onSetSquadLeader,
  trailedRiderId = null,
  onTrailRider,
  members,
  sosAlert,
  theme = 'dark',
  onCancelSos,
  onDismissSos,
  crewNotification = null,
  onDismissCrewNotification,
  focusedRiderId = null,
  activeRoute = null,
  onSelectRider,
  isOnRadar = true,
  externalMapLayer,
  onChangeMapLayer,
  onSendCallout,
  onOpenProfile,
  hasActiveCallout = false,
}) => {

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayTileLayerRef = useRef<L.TileLayer | null>(null);

  const myMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const prevMyPosRef = useRef<{ lat: number; lon: number; speedKmh: number; heading: number | null } | null>(null);
  const memberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const memberCacheRef = useRef<Map<string, { lat: number; lon: number; speedText: string; bearing: number | null; isOnline: boolean; isStopped: boolean; isHost: boolean; color: string; isStarred?: boolean }>>(new Map());
  const sosMarkerRef = useRef<L.Marker | null>(null);

  // Highway speed adaptive zoom & Smart Stop Intent
  const lastAutoZoomTsRef = useRef<number>(0);
  const hadMovingSpeedRef = useRef<boolean>(false);
  const stopTimestampRef = useRef<number | null>(null);
  const lastStopPromptTsRef = useRef<number>(0);
  const [stopIntentActive, setStopIntentActive] = useState<boolean>(false);

  // Active Route layers
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routeGlowPolylineRef = useRef<L.Polyline | null>(null);
  const routeMarkersRef = useRef<L.Marker[]>([]);

  // Orientation & Compass state (Course-Up direction follow vs North-Up)
  const [orientationMode, setOrientationMode] = useState<'north' | 'course'>(() => {
    const saved = readMigratedStorageKey('throttlelog_map_orientation', 'sasta_map_orientation');
    if (saved === 'north' || saved === 'course') return saved;
    const pref = getRiderProfile().defaultMapOrientation;
    if (pref === 'north' || pref === 'course') return pref;
    return 'course';
  });
  const [stopIntentEnabled, setStopIntentEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('throttlelog_stop_intent_v1') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const syncPrefs = () => {
      const savedOrient = readMigratedStorageKey('throttlelog_map_orientation', 'sasta_map_orientation');
      if (savedOrient === 'north' || savedOrient === 'course') {
        setOrientationMode(savedOrient);
      }
      try {
        setStopIntentEnabled(localStorage.getItem('throttlelog_stop_intent_v1') !== 'false');
      } catch {}
    };
    window.addEventListener('throttlelog-hud-prefs', syncPrefs);
    return () => window.removeEventListener('throttlelog-hud-prefs', syncPrefs);
  }, []);

  const handleToggleOrientation = () => {
    triggerHaptic(25);
    setOrientationMode(prev => {
      const next = prev === 'course' ? 'north' : 'course';
      writeMigratedStorageKey('throttlelog_map_orientation', 'sasta_map_orientation', next);
      return next;
    });
  };

  // Default to Dark map for eye comfort and stealth motorcycle cockpit look
  const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
    const savedLayer = readMigratedStorageKey('throttlelog_map_layer', 'sasta_map_layer');
    if (savedLayer === 'dark' || savedLayer === 'streets' || savedLayer === 'satellite' || savedLayer === 'sunlight') {
      return savedLayer;
    }
    const isSun = readMigratedStorageKey('throttlelog_sunlight_mode', 'sasta_sunlight_mode') === 'true';
    if (isSun) return 'sunlight';
    return getRiderProfile().defaultMapLayer || 'dark';
  });

  useEffect(() => {
    if (externalMapLayer) {
      setMapLayer(externalMapLayer);
    }
  }, [externalMapLayer]);

  const [selectedRiderId, setSelectedRiderId] = useState<string | null>('me');
  const [hasInitialFit, setHasInitialFit] = useState(false);

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

  // Current heading from myLocation with persistence when stationary
  const myHeading = myLocation?.heading !== null && myLocation?.heading !== undefined ? myLocation.heading : null;
  const lastKnownHeadingRef = useRef<number | null>(null);
  if (myHeading !== null) {
    lastKnownHeadingRef.current = myHeading;
  }
  const effectiveCourseHeading = myHeading !== null ? myHeading : lastKnownHeadingRef.current;

  const isFreePanning = selectedRiderId === null;

  // Calculate rotation for map container
  // North-up: 0° (or 180° if flipped by user).
  // Course-up: rotated by -effectiveCourseHeading so bike's forward path is ALWAYS UP on phone screen!
  // In Free Exploration mode (user dragging/browsing): keep North-Up (0°) so pan gestures match finger movement 1:1!
  const targetMapRotation = useMemo(() => {
    if (orientationMode === 'course' && effectiveCourseHeading !== null && !isFreePanning) {
      return -effectiveCourseHeading;
    }
    return 0;
  }, [orientationMode, effectiveCourseHeading, isFreePanning]);

  // Synchronize CSS rotation on map container & counter-rotate all marker text/badges
  useEffect(() => {
    if (!mapContainerRef.current) return;
    mapContainerRef.current.style.transform = `translate(-50%, -50%) rotate(${targetMapRotation}deg)`;

    const counterRotateEls = mapContainerRef.current.querySelectorAll<HTMLElement>('.upright-counter-rotate');
    counterRotateEls.forEach(el => {
      if (el.dataset.translateX === 'center' || el.style.transform.includes('translateX(-50%)')) {
        el.dataset.translateX = 'center';
        el.style.transform = `translateX(-50%) rotate(${-targetMapRotation}deg)`;
      } else {
        el.style.transform = `rotate(${-targetMapRotation}deg)`;
      }
    });
  }, [targetMapRotation]);

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

  const isLight = theme === 'light';

  // Format speed (standardized on km/h)
  const formatSpeed = (kmh: number) => `${Math.round(kmh)} km/h`;

  // Format distance (standardized on m / km)
  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return '...';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // inRoads-style Convoy Pack Spread & Shape Intelligence
  const convoySpreadData = useMemo(() => {
    const onlineMembers = members.filter(m => m.isOnline !== false && m.location);
    if (onlineMembers.length === 0) return null;

    const totalRiders = onlineMembers.length + 1;
    let maxDist = 0;
    let farthestMember: GroupMemberInfo = onlineMembers[0];

    onlineMembers.forEach(m => {
      const d = m.distanceFromMeMeters ?? 0;
      if (d > maxDist) {
        maxDist = d;
        farthestMember = m;
      }
    });

    let state: 'tight' | 'stretched' | 'separated' = 'tight';
    if (maxDist > 1800) {
      state = 'separated';
    } else if (maxDist > 400) {
      state = 'stretched';
    }

    return {
      totalRiders,
      maxDist,
      farthestMember,
      state,
    };
  }, [members]);

  // Smart Stop Intent Watcher ("Tell, Don't Poll" - Auto-prompts Chai/Fuel when halted after cruising in Crew mode)
  useEffect(() => {
    if (!myLocation || !isOnRadar || !stopIntentEnabled) {
      if (stopIntentActive) setStopIntentActive(false);
      return;
    }
    const speed = myLocation.speedKmh || 0;
    const now = Date.now();

    if (speed > 25) {
      hadMovingSpeedRef.current = true;
      stopTimestampRef.current = null;
    } else if (speed < 2.5 && hadMovingSpeedRef.current) {
      if (!stopTimestampRef.current) {
        stopTimestampRef.current = now;
      } else if (now - stopTimestampRef.current > 45000 && now - lastStopPromptTsRef.current > 180000) {
        lastStopPromptTsRef.current = now;
        setStopIntentActive(true);
        setTimeout(() => setStopIntentActive(false), 12000);
      }
    }
  }, [myLocation?.speedKmh, isOnRadar, stopIntentEnabled]);

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

    const orientTimers: ReturnType<typeof setTimeout>[] = [];
    const timer = setTimeout(() => {
      if (mapInstanceRef.current === map) map.invalidateSize();
    }, 200);

    const handleResize = () => {
      if (mapInstanceRef.current === map) map.invalidateSize();
    };
    const handleOrientation = () => {
      orientTimers.push(setTimeout(() => { if (mapInstanceRef.current === map) map.invalidateSize(); }, 100));
      orientTimers.push(setTimeout(() => { if (mapInstanceRef.current === map) map.invalidateSize(); }, 300));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      clearTimeout(timer);
      orientTimers.forEach(t => clearTimeout(t));
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      try {
        map.stop();
      } catch {}
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

    const layerTimer = setTimeout(() => {
      if (mapInstanceRef.current === map) map.invalidateSize();
    }, 50);
    return () => clearTimeout(layerTimer);
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
      <div style="background:#10b981; color:#080c10; font-family:var(--font-chivo),sans-serif; font-weight:900; font-size:9px; padding:2px 6px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 0 10px #10b981; white-space:nowrap; display:flex; align-items:center; gap:3px;">
        <span style="width:6px; height:6px; border-radius:50%; background:#080c10; display:inline-block;"></span> <span>START</span>
      </div>
    `;
    const startIcon = L.divIcon({ className: 'route-start-badge', html: startHtml, iconAnchor: [24, 10] });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon, zIndexOffset: 700 }).addTo(map);
    routeMarkersRef.current.push(startMarker);

    // 4. Finish Marker (with 1-tap Google Maps Navigation)
    const endPt = activeRoute.points[activeRoute.points.length - 1];
    const finishHtml = `
      <div style="background:#f59e0b; color:#080c10; font-family:var(--font-chivo),sans-serif; font-weight:900; font-size:9px; padding:2px 6px; border-radius:12px; border:1.5px solid #fff; box-shadow:0 0 10px #f59e0b; white-space:nowrap; display:flex; align-items:center; gap:3px;">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#080c10" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        <span>FINISH</span>
      </div>
    `;
    const finishIcon = L.divIcon({ className: 'route-finish-badge', html: finishHtml, iconAnchor: [24, 10] });
    const finishMarker = L.marker([endPt.lat, endPt.lon], { icon: finishIcon, zIndexOffset: 700 }).addTo(map);
    const finishPopup = `
      <div style="font-family:var(--font-chivo),sans-serif; text-align:center; padding:4px; min-width:140px;">
        <div style="font-weight:900; font-size:12px; color:#fff; margin-bottom:2px;">${escapeHtml(activeRoute.name || 'Destination')}</div>
        <div style="font-size:10px; color:#38bdf8; margin-bottom:8px;">${activeRoute.totalDistanceKm.toFixed(1)} km Total</div>
        <button onclick="window.__navTo(${endPt.lat}, ${endPt.lon})" style="width:100%; background:#06b6d4; color:#080c10; font-weight:900; font-size:10px; padding:6px; border-radius:6px; border:none; cursor:pointer;">
          Open Google Maps
        </button>
      </div>
    `;
    finishMarker.bindPopup(finishPopup, { offset: [0, -10] });
    routeMarkersRef.current.push(finishMarker);

    // 5. Pit Stop Markers (fuel, chai, scenic, dhaba)
    if (activeRoute.pitStops && activeRoute.pitStops.length > 0) {
      activeRoute.pitStops.forEach(stop => {
        const tag = stop.category === 'chai' ? 'CHAI' : stop.category === 'fuel' ? 'FUEL' : stop.category === 'dhaba' ? 'DHABA' : 'STOP';
        const stopHtml = `
          <div style="background:#0f172a; border:1.5px solid #38bdf8; color:#38bdf8; font-family:var(--font-chivo),sans-serif; font-size:9px; font-weight:bold; padding:2px 5px; border-radius:10px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.7); display:flex; align-items:center; gap:3px;">
            <span style="font-size:7px; color:#fbbf24; font-weight:900;">${tag}</span> <span>${escapeHtml(stop.name || 'Pit Stop')}</span>
          </div>
        `;
        const stopIcon = L.divIcon({ className: 'route-pitstop-badge', html: stopHtml, iconAnchor: [20, 10] });
        const stopMarker = L.marker([stop.lat, stop.lon], { icon: stopIcon, zIndexOffset: 650 }).addTo(map);
        const stopPopup = `
          <div style="font-family:var(--font-chivo),sans-serif; text-align:center; padding:4px; min-width:140px;">
            <div style="font-weight:900; font-size:11px; color:#fff;">${tag}: ${escapeHtml(stop.name)}</div>
            <div style="font-size:9px; color:#94a3b8; margin-bottom:6px;">${stop.distanceKm.toFixed(1)} km mark</div>
            <button onclick="window.__navTo(${stop.lat}, ${stop.lon})" style="width:100%; background:#38bdf8; color:#080c10; font-weight:900; font-size:9px; padding:5px; border-radius:6px; border:none; cursor:pointer;">
              Navigate in Maps
            </button>
          </div>
        `;
        stopMarker.bindPopup(stopPopup, { offset: [0, -10] });
        routeMarkersRef.current.push(stopMarker);
      });
    }
  }, [activeRoute, mapLayer]);

  // ─── Update "YOU" Marker (Optimized, Lag-Free with Delta Rendering) ───
  useEffect(() => {
    if (!mapInstanceRef.current || !myLocation) {
      if (myMarkerRef.current) {
        myMarkerRef.current.remove();
        myMarkerRef.current = null;
        prevMyPosRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;
    const pos: L.LatLngTuple = [myLocation.lat, myLocation.lon];
    const initial = myRiderName ? myRiderName.trim().charAt(0).toUpperCase() : 'R';
    const color = myColor || '#00f0ff';
    const heading = myLocation.heading !== null && myLocation.heading !== undefined ? myLocation.heading : null;

    // Counter-rotation so text & initials stay 100% horizontal and upright at all times
    const counterRotation = -targetMapRotation;

    // Arrow navigation chevron always rotates to true travel heading
    const arrowRotation = heading !== null ? heading : 0;

    const prev = prevMyPosRef.current as any;
    const isFirstTime = !myMarkerRef.current || !prev;
    const profileChanged = prev && (prev.name !== myRiderName || prev.color !== color || prev.orientationMode !== orientationMode || prev.isHost !== isHost || prev.targetMapRotation !== targetMapRotation);

    // Google Maps-style GPS Accuracy Halo Circle
    const accuracyRadius = Math.max(6, Math.min(myLocation.accuracy || 15, 60));
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(pos, {
        radius: accuracyRadius,
        color: color,
        fillColor: color,
        fillOpacity: 0.08,
        weight: 1,
        dashArray: '3, 4',
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(pos);
      accuracyCircleRef.current.setRadius(accuracyRadius);
    }

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
      ? `<div class="upright-counter-rotate" data-translate-x="center" style="position:absolute; top:-20px; left:50%; transform:translateX(-50%) rotate(${counterRotation}deg); transform-origin:center center; background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8); transition:transform 0.3s ease; display:flex; align-items:center; gap:2px;"><svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M2 19h20v2H2v-2zm0-8l5 3 5-7 5 7 5-3v6H2v-6z"/></svg>LEADER</div>`
      : '';

    const html = `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="Tap to open Rider Settings">
        ${forwardIndicator}
        ${myLeaderCrown}
        <!-- Pulsing radar halo -->
        <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:${color}; opacity:0.2; border:1.5px solid ${color};"></div>
        <!-- Center initial badge (Counter-rotated to always be upright) -->
        <div class="upright-counter-rotate" style="position:relative; width:28px; height:28px; border-radius:50%; background:${color}; border:2.5px solid #080c10; box-shadow:0 0 12px ${color}, 0 2px 6px rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:12px; transform:rotate(${counterRotation}deg); transform-origin:center center; transition:transform 0.3s ease;">
          ${escapeHtml(initial)}
        </div>
        <!-- Upright label below -->
        <div class="upright-counter-rotate" data-translate-x="center" style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%) rotate(${counterRotation}deg); transform-origin:center center; background:#080c10; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:900; padding:1px 5px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.9); transition:transform 0.3s ease;">
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
        if (onOpenProfile) {
          onOpenProfile();
        }
      });
      prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading, name: myRiderName, color, orientationMode, isHost, targetMapRotation } as any;
    } else {
      myMarkerRef.current.setLatLng(pos);

      // In-place rotation or full re-render on profile/mode changes
      if (isFirstTime || profileChanged) {
        myMarkerRef.current.setIcon(icon);
        prevMyPosRef.current = { lat: myLocation.lat, lon: myLocation.lon, speedKmh: myLocation.speedKmh, heading, name: myRiderName, color, orientationMode, isHost, targetMapRotation } as any;
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

    // Google Maps-style look-ahead horizon camera follow & Highway Speed Adaptive Zoom
    if (selectedRiderId === 'me') {
      const now = Date.now();
      if (now - lastAutoZoomTsRef.current > 12000) {
        const curZoom = map.getZoom();
        if (myLocation.speedKmh > 65 && curZoom > 14) {
          lastAutoZoomTsRef.current = now;
          map.setZoom(14, { animate: true });
        } else if (myLocation.speedKmh < 22 && curZoom < 16) {
          lastAutoZoomTsRef.current = now;
          map.setZoom(16, { animate: true });
        }
      }

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
  }, [myLocation, myRiderName, myColor, selectedRiderId, isHost, orientationMode, targetMapRotation]);

  // ─── Update Member Markers (Optimized Delta Cache, Lag-Free) ───
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // When Solo Private mode (!isOnRadar), hide other riders completely from the full map
    const visibleMembers = isOnRadar ? members : [];

    // Remove obsolete markers
    memberMarkersRef.current.forEach((marker, id) => {
      if (!visibleMembers.some(m => m.riderId === id)) {
        marker.remove();
        memberMarkersRef.current.delete(id);
        memberCacheRef.current.delete(id);
      }
    });

    // Add or update markers for connected members
    visibleMembers.forEach(m => {
      if (!m.location) return;
      const pos: L.LatLngTuple = [m.location.lat, m.location.lon];
      const initial = m.name.charAt(0).toUpperCase() || 'R';
      const color = m.color || '#ffe600';
      const speed = formatSpeed(m.location.speedKmh);
      const isStopped = m.location.status === 'stopped' || m.location.speedKmh < 2.0;
      const bearing = m.location.bearing;
      const isOnline = m.isOnline !== false;
      const statusTag = !isOnline ? 'OFFLINE' : isStopped ? 'STOP' : speed;

      const prev = memberCacheRef.current.get(m.riderId);

      const memberCounterRotation = -targetMapRotation;
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
        ? `<div class="upright-counter-rotate" data-translate-x="center" style="position:absolute; top:-18px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8); transition:transform 0.3s ease; display:flex; align-items:center; gap:2px;"><svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M2 19h20v2H2v-2zm0-8l5 3 5-7 5 7 5-3v6H2v-6z"/></svg>LEADER</div>`
        : '';

      const opacity = isOnline ? '1' : '0.65';

      // Speed/status tag styling: green for cruising, amber for stopped, slate for offline
      const statusColor = !isOnline ? '#64748b' : isStopped ? '#f59e0b' : '#10b981';
      const statusBg = !isOnline ? '#0f172a' : isStopped ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';

      const html = `
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; opacity:${opacity}; cursor:pointer;" title="Tap to focus ${escapeHtml(m.name)}">
          ${leaderCrown}
          ${bearingArrow}
          <div class="upright-counter-rotate" style="width:28px; height:28px; border-radius:50%; background:${color}; border:2px solid #080c10; box-shadow:0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:11px; transform:rotate(${memberCounterRotation}deg); transform-origin:center center; transition:transform 0.3s ease;">
            ${escapeHtml(initial)}
          </div>
          <div class="upright-counter-rotate" data-translate-x="center" style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:#0f172a; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:bold; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.85); transition:transform 0.3s ease;">
            ${escapeHtml(m.name)}
          </div>
          <div class="upright-counter-rotate live-rider-speed" data-translate-x="center" style="position:absolute; bottom:-28px; left:50%; transform:translateX(-50%) rotate(${memberCounterRotation}deg); transform-origin:center center; background:${statusBg}; border:1px solid ${statusColor}; color:${statusColor}; font-family:monospace; font-size:7px; font-weight:900; padding:0.5px 3.5px; border-radius:3px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.7); transition:transform 0.3s ease; letter-spacing:0.3px;">
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
        marker = L.marker(pos, { icon, zIndexOffset: 900 }).addTo(map);
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
        });
      } else {
        // High-speed direct position update without DOM destruction
        marker.setLatLng(pos);
        marker.setZIndexOffset(900);

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

        // Only rebuild DOM icon if identity, host status or online state changed
        const identityOrStateChanged = !prev || prev.isOnline !== isOnline || prev.isHost !== m.isHost || prev.color !== color;
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
        });
      }
    });
  }, [members, isOnRadar, targetMapRotation, orientationMode, myHeading]);

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
        <div style="position:relative; width:28px; height:28px; border-radius:50%; background:#ef4444; border:2px solid #fff; box-shadow:0 0 12px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:14px;">
          !
        </div>
        <div style="position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#7f1d1d; border:1px solid #ef4444; color:#fff; font-family:monospace; font-size:9px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap;">
          SOS: ${escapeHtml(sosAlert.fromName)}
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
    const activeMembers = isOnRadar ? members.filter(m => m.location && m.isOnline !== false) : [];

    const points: L.LatLngTuple[] = [];
    if (myLocation) points.push([myLocation.lat, myLocation.lon]);

    activeMembers.forEach(m => {
      if (m.location) {
        if (m.distanceFromMeMeters === undefined || m.distanceFromMeMeters <= 100000) {
          points.push([m.location.lat, m.location.lon]);
        }
      }
    });

    const getVisibleMapPadding = (): [number, number] => {
      const el = mapContainerRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return [60, 60];
      const minViewportDim = Math.min(parent.clientWidth, parent.clientHeight);
      const safePad = Math.max(55, Math.round((Math.min(el.clientWidth, el.clientHeight) - minViewportDim) / 2) + 55);
      return [safePad, safePad];
    };

    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: getVisibleMapPadding(), maxZoom: 15, animate: true });
      setHasInitialFit(true);
    } else if (points.length === 1) {
      mapInstanceRef.current.setView(points[0], 15);
      setHasInitialFit(true);
    }
  }, [myLocation, members, hasInitialFit, isOnRadar]);

  // Fit bounds to include all crew members
  const handleFitAllRiders = () => {
    if (!mapInstanceRef.current) return;
    triggerHaptic(25);

    const points: L.LatLngTuple[] = [];
    if (myLocation) points.push([myLocation.lat, myLocation.lon]);
    if (isOnRadar) {
      members.forEach(m => {
        if (m.location && m.isOnline !== false) {
          points.push([m.location.lat, m.location.lon]);
        }
      });
    }

    if (points.length === 0) return;

    if (points.length === 1) {
      mapInstanceRef.current.flyTo(points[0], 16, { animate: true, duration: 0.8 });
    } else {
      const el = mapContainerRef.current;
      const parent = el?.parentElement;
      const minViewportDim = el && parent ? Math.min(parent.clientWidth, parent.clientHeight) : 0;
      const safePad = el && parent
        ? Math.max(60, Math.round((Math.min(el.clientWidth, el.clientHeight) - minViewportDim) / 2) + 60)
        : 60;
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [safePad, safePad], maxZoom: 15, animate: true });
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

  return (
    <div className={`relative flex flex-col w-full h-full flex-1 overflow-hidden select-none ${isLight ? 'bg-slate-100' : 'bg-[#080c10]'}`}>

      {/* ─────────────────────────────────────────────────────────────
          LEAFLET MAP CANVAS (Oversized Square >= Diagonal for Zero-Clip Rotation)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-auto z-0 [isolation:isolate]">
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            width: '150vmax',
            height: '150vmax',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) rotate(${targetMapRotation}deg)`,
            transformOrigin: '50% 50%',
            transition: 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
          className="cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          UNIFIED TOP FLOATING ALERT & GUIDANCE STACK (NON-OVERLAPPING)
      ───────────────────────────────────────────────────────────── */}
      {(sosAlert ||
        (trailedMember && trailingStats) ||
        !myLocation ||
        (isOnRadar && !trailedRiderId && convoySpreadData) ||
        (isOnRadar && crewNotification) ||
        (isOnRadar && !trailedRiderId && squadLeader && squadLeader.riderId !== 'me')) && (
        <div
          style={{
            top: !sosAlert && hasActiveCallout
              ? 'calc(env(safe-area-inset-top, 0px) + 9.6rem)'
              : 'calc(env(safe-area-inset-top, 0px) + 4.05rem)',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-30 pointer-events-none flex flex-col items-center gap-1.5"
        >
          {/* 1. SOS BANNER OVERLAY (Highest Priority) */}
          {sosAlert && (() => {
            const isMySos = myRiderId && sosAlert.fromId
              ? sosAlert.fromId === myRiderId
              : Boolean(
                  (sosAlert.fromId && sosAlert.fromId === myRiderName) ||
                  (sosAlert.fromName && sosAlert.fromName.trim().toLowerCase() === (myRiderName || '').trim().toLowerCase())
                );
            return (
              <div className="pointer-events-auto w-full max-w-md animate-in slide-in-from-top-2 duration-200">
                <div className={`w-full p-2.5 rounded-2xl backdrop-blur-md border-2 font-sans text-xs shadow-2xl flex items-center justify-between gap-2 ${
                  isMySos
                    ? isLight ? 'bg-amber-50/98 border-amber-500 text-amber-950' : 'bg-amber-950/95 border-amber-500 text-white'
                    : isLight ? 'bg-rose-50/98 border-rose-500 text-rose-950' : 'bg-rose-950/95 border-rose-500 text-white'
                }`}>
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertTriangle className={`w-4 h-4 shrink-0 animate-pulse ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
                    <span className={`font-bold truncate text-[11px] ${
                      isMySos
                        ? isLight ? 'text-amber-900' : 'text-amber-300'
                        : isLight ? 'text-rose-800' : 'text-rose-300'
                    }`}>
                      {isMySos ? 'YOU BROADCAST EMERGENCY SOS' : `EMERGENCY SOS: ${sosAlert.fromName}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isMySos ? (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(50);
                          if (onCancelSos) onCancelSos();
                          else if (onDismissSos) onDismissSos();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer transition-all active:scale-95 animate-pulse"
                        title="Notify entire squad that you are safe"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>I&apos;m Safe / Cancel SOS</span>
                      </button>
                    ) : (
                      <>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`${sosAlert.fromName}, we received your emergency SOS! The squad is en route to your GPS location: https://maps.google.com/?q=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Send WhatsApp emergency confirmation to rider"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(30);
                            openGoogleMapsNavigation(sosAlert.lat, sosAlert.lon, sosAlert.fromName);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Navigate to emergency location in Google Maps"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Navigate</span>
                        </button>
                        {onDismissSos && (
                          <button
                            type="button"
                            onClick={onDismissSos}
                            title="Dismiss alert locally"
                            aria-label="Dismiss SOS alert"
                            className={`p-1 rounded-lg border cursor-pointer transition-all active:scale-95 ${
                              isLight
                                ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2. TRAILING RIDER LIVE GUIDANCE HUD */}
          {trailedMember && trailingStats && (
            <div className="pointer-events-auto w-full max-w-md animate-in slide-in-from-top-2 duration-150">
              <div className={`w-full px-3 py-2 rounded-2xl backdrop-blur-xl border-2 border-amber-500/80 font-sans shadow-2xl flex items-center justify-between gap-2 ${
                isLight ? 'bg-white/95 text-slate-900' : 'bg-slate-950/95 text-white'
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shrink-0 shadow-md">
                    {trailingStats.direction.arrow}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`font-heading font-black text-xs truncate flex items-center gap-1 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                        {(trailedMember.isHost || trailedMember.riderId === leaderId) ? (
                          <Crown className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Navigation className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{trailedMember.name}</span>
                      </span>
                      <span className={`text-[10px] font-bold shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        {trailingStats.direction.label}
                      </span>
                    </div>
                    <div className={`text-[11px] flex items-center gap-2 telemetry-num ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      <span className={`font-black ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                        {formatDistance(trailingStats.distMeters)}
                      </span>
                      <span>•</span>
                      <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                        {trailingStats.isStopped
                          ? 'STOPPED'
                          : `${Math.round(trailingStats.speedKmh || 0)} km/h`}
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
                        openGoogleMapsNavigation(trailedMember.location!.lat, trailedMember.location!.lon, trailedMember.name);
                      }}
                      className="p-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md"
                      title="Open Google Maps navigation to rider"
                      aria-label="Open Google Maps navigation to rider"
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
                    className={`p-1.5 rounded-xl border cursor-pointer transition-all active:scale-95 ${
                      isLight
                        ? 'bg-slate-100 hover:bg-rose-50 border-slate-300 hover:border-rose-400 text-slate-600 hover:text-rose-700'
                        : 'bg-slate-800 hover:bg-rose-950 border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-300'
                    }`}
                    title="Stop trailing"
                    aria-label="Stop trailing rider"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Cold-Start Satellite Acquisition Pill */}
          {!myLocation && (
            <div className={`px-3 py-1 rounded-full backdrop-blur-md border font-sans text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap animate-in fade-in ${
              isLight
                ? 'bg-amber-50/95 border-amber-400 text-amber-900'
                : 'bg-slate-950/92 border-amber-500/50 text-amber-300'
            }`}>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Acquiring GPS fix...</span>
            </div>
          )}

          {/* 4. INROADS-STYLE CONVOY PACK SPREAD HUD (1-TAP FIT ALL RIDERS) */}
          {isOnRadar && !trailedRiderId && convoySpreadData && (
            <button
              type="button"
              onClick={handleFitAllRiders}
              className={`pointer-events-auto px-3.5 py-1.5 rounded-full backdrop-blur-md border shadow-xl font-sans text-[11px] font-bold flex items-center gap-2 cursor-pointer transition-all active:scale-95 whitespace-nowrap animate-in fade-in telemetry-num ${
                convoySpreadData.state === 'separated'
                  ? isLight ? 'bg-rose-50/95 border-rose-400 text-rose-900 animate-pulse' : 'bg-rose-950/95 border-rose-500 text-rose-200 animate-pulse shadow-rose-950/60'
                  : convoySpreadData.state === 'stretched'
                  ? isLight ? 'bg-amber-50/95 border-amber-400 text-amber-900' : 'bg-amber-950/95 border-amber-500/70 text-amber-200 shadow-amber-950/40'
                  : isLight ? 'bg-white/95 border-emerald-400 text-slate-900' : 'bg-slate-950/95 border-emerald-500/60 text-white shadow-emerald-950/30'
              }`}
              title="Tap to fit all convoy riders into map view"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                convoySpreadData.state === 'separated'
                  ? 'bg-rose-500 animate-ping'
                  : convoySpreadData.state === 'stretched'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`} />
              {convoySpreadData.state === 'separated' ? (
                <span>
                  <span className={`font-black ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>PACK SPREAD</span>
                  <span className="mx-1 text-slate-400">•</span>
                  <span>{convoySpreadData.farthestMember.name} {formatDistance(convoySpreadData.maxDist)} behind</span>
                </span>
              ) : convoySpreadData.state === 'stretched' ? (
                <span>
                  <span className={`font-black ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>CONVOY STRETCHED</span>
                  <span className="mx-1 text-slate-400">•</span>
                  <span>{convoySpreadData.totalRiders} riders · {formatDistance(convoySpreadData.maxDist)}</span>
                </span>
              ) : (
                <span>
                  <span className={`font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>CONVOY TIGHT</span>
                  <span className="mx-1 text-slate-400">•</span>
                  <span>{convoySpreadData.totalRiders} riders · {formatDistance(convoySpreadData.maxDist)}</span>
                </span>
              )}
            </button>
          )}

          {/* 5. CREW EVENT NOTIFICATION TOAST (Join / Leave / Host Closed) */}
          {isOnRadar && crewNotification && (
            <div className="pointer-events-auto w-full sm:max-w-sm animate-in slide-in-from-top-2 duration-200">
              <div className={`p-2.5 rounded-xl backdrop-blur-md border shadow-xl flex items-center justify-between gap-2 font-sans text-xs ${
                crewNotification.type === 'join'
                  ? isLight ? 'bg-emerald-50/95 border-emerald-400 text-emerald-900' : 'bg-emerald-950/92 border-emerald-500/60 text-emerald-200 shadow-emerald-950/40'
                  : crewNotification.type === 'leave'
                  ? isLight ? 'bg-white/95 border-slate-300 text-slate-800' : 'bg-slate-900/92 border-slate-700 text-slate-300 shadow-black/40'
                  : isLight ? 'bg-cyan-50/95 border-cyan-400 text-cyan-900' : 'bg-cyan-950/92 border-cyan-500/60 text-cyan-200 shadow-cyan-950/40'
              }`}>
                <span className="font-bold truncate">{crewNotification.text}</span>
                {onDismissCrewNotification && (
                  <button
                    type="button"
                    onClick={onDismissCrewNotification}
                    aria-label="Dismiss notification"
                    className={`p-0.5 cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 6. 1-TAP FOLLOW SQUAD LEADER PILL (WHEN NOT TRAILING) */}
          {isOnRadar && !trailedRiderId && squadLeader && squadLeader.riderId !== 'me' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                onTrailRider?.(squadLeader.riderId);
                speakAlert(`Now trailing ride leader ${squadLeader.name}`);
              }}
              className={`pointer-events-auto px-3.5 py-1.5 rounded-full border font-sans text-xs font-black shadow-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 backdrop-blur-md animate-in slide-in-from-top-1 duration-150 telemetry-num ${
                isLight
                  ? 'bg-white/95 hover:bg-amber-50 border-amber-400 text-amber-800'
                  : 'bg-slate-950/92 hover:bg-slate-900 border-amber-500/70 text-amber-300'
              }`}
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>Follow Leader ({squadLeader.name})</span>
              {squadLeader.distanceFromMeMeters !== undefined && (
                <span className={`text-[10px] px-1.5 rounded ${
                  isLight ? 'text-amber-800 bg-amber-100' : 'text-amber-300 bg-amber-500/20'
                }`}>
                  {formatDistance(squadLeader.distanceFromMeMeters)}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SMART STOP INTENT PROMPT ("Tell, Don't Poll" One-Tap FYIs)
      ───────────────────────────────────────────────────────────── */}
      {isOnRadar && stopIntentActive && (
        <div 
          style={{ 
            bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom) + 5.2rem))',
            left: 'max(1rem, env(safe-area-inset-left))',
            right: 'max(1rem, env(safe-area-inset-right))',
          }}
          className="absolute z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className={`pointer-events-auto max-w-sm w-full p-2.5 rounded-2xl border shadow-2xl backdrop-blur-md font-sans text-xs flex flex-col gap-2 ${
            isLight
              ? 'bg-white/95 border-cyan-500/60 text-slate-900'
              : 'bg-slate-950/95 border-cyan-500/60 text-white'
          }`}>
            <div className={`flex items-center justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              <span className={`font-heading font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Cruising Paused • Broadcast Stop?</span>
              </span>
              <button 
                type="button"
                onClick={() => setStopIntentActive(false)}
                aria-label="Dismiss stop prompt"
                className={`p-0.5 cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  const preset = CALLOUT_PRESETS.find(p => p.type === 'fuel') || CALLOUT_PRESETS[0];
                  if (onSendCallout) onSendCallout(preset);
                  setStopIntentActive(false);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-300'
                }`}
              >
                <Fuel className="w-3.5 h-3.5" /> Fuel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  const preset = CALLOUT_PRESETS.find(p => p.type === 'chai') || CALLOUT_PRESETS[1];
                  if (onSendCallout) onSendCallout(preset);
                  setStopIntentActive(false);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-800'
                    : 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/50 text-orange-300'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" /> Chai
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(30);
                  const preset = CALLOUT_PRESETS.find(p => p.type === 'regroup') || CALLOUT_PRESETS[2];
                  if (onSendCallout) onSendCallout(preset);
                  setStopIntentActive(false);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-cyan-50 hover:bg-cyan-100 border-cyan-300 text-cyan-800'
                    : 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500/50 text-cyan-300'
                }`}
              >
                <Compass className="w-3.5 h-3.5" /> Regroup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          GOOGLE MAPS-STYLE FLOATING MAP CONTROLS (BOTTOM-RIGHT)
      ───────────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          bottom: 'max(4.5rem, calc(env(safe-area-inset-bottom) + 4.2rem))',
          right: 'max(0.75rem, env(safe-area-inset-right))',
        }}
        className="absolute z-40 flex flex-col items-center gap-2 pointer-events-auto"
      >
        {/* Zoom In / Out hidden on <768px phones and compact landscape so controls stay clear of TopMapCapsule; pinch-to-zoom works on mobile */}
        <div className="flex flex-col gap-1.5 mb-0.5">
          <div className="hidden md:flex mobile-landscape-hidden flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                mapInstanceRef.current?.zoomIn();
              }}
              className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 text-xl font-black ${
                isLight
                  ? 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                  : 'bg-slate-950/90 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500'
              }`}
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
              className={`w-11 h-11 rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 text-xl font-black ${
                isLight
                  ? 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400'
                  : 'bg-slate-950/90 border-slate-700 text-slate-200 hover:text-white hover:border-slate-500'
              }`}
              title="Zoom Out (Map)"
              aria-label="Zoom Out"
            >
              −
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              const next: MapLayerType =
                mapLayer === 'dark' ? 'streets' : mapLayer === 'streets' ? 'sunlight' : mapLayer === 'sunlight' ? 'satellite' : 'dark';
              setMapLayer(next);
              onChangeMapLayer?.(next);
            }}
            className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-2xl backdrop-blur-md border shadow-xl flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
              isLight
                ? 'bg-white/95 border-slate-300 text-cyan-700 hover:bg-slate-100 hover:border-slate-400'
                : 'bg-slate-950/90 border-slate-700 text-cyan-400 hover:text-white hover:border-slate-500'
            }`}
            title={`Map Style: ${mapLayer.toUpperCase()} • Tap to cycle Dark / Streets / Sunlight / Satellite`}
            aria-label={`Cycle map style (currently ${mapLayer})`}
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>

        {/* Google Maps-style Compass / Heading Follow Mode Toggle */}
        <button
          type="button"
          onClick={handleToggleOrientation}
          className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full backdrop-blur-md border shadow-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-90 ${
            orientationMode === 'course'
              ? isLight
                ? 'bg-cyan-50/95 border-cyan-500 text-cyan-700 ring-2 ring-cyan-400/40'
                : 'bg-slate-950/95 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/30'
              : isLight
              ? 'bg-white/95 border-slate-300 text-slate-600 hover:border-slate-400'
              : 'bg-slate-950/90 border-slate-700 text-slate-400 hover:border-slate-500'
          }`}
          title={orientationMode === 'course' ? 'Course-Up (Map rotates with bike) • Tap for North-Up' : 'North-Up • Tap for Course-Up (Direction Follow)'}
          aria-label="Toggle Map Orientation"
        >
          <div 
            style={{ 
              transform: `rotate(${orientationMode === 'course' && effectiveCourseHeading !== null ? -effectiveCourseHeading : 0}deg)`,
              transition: 'transform 0.25s ease'
            }}
            className="flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Red North Needle */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-rose-500" />
            {/* Silver South Needle */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[9px] border-t-slate-400" />
          </div>
          <span className={`text-[8px] font-black tracking-tighter mt-0.5 leading-none ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {orientationMode === 'course' ? 'HDG' : 'N'}
          </span>
        </button>

        {/* Recenter FAB (Single Google Maps location button) */}
        <button
          onClick={handleRecenterMe}
          className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full backdrop-blur-md border shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-90 relative ${
            selectedRiderId === 'me'
              ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-cyan-500/40 ring-2 ring-cyan-400/50'
              : isLight
              ? 'bg-white/95 border-slate-300 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-500'
              : 'bg-slate-950/90 border-slate-700 text-cyan-400 hover:bg-slate-900 hover:border-cyan-400'
          }`}
          title="Recenter on My Location (GPS)"
          aria-label="Recenter Map"
        >
          <Crosshair className={`w-5 h-5 ${selectedRiderId === 'me' ? 'stroke-[2.6]' : 'stroke-[2.2]'}`} />
          {selectedRiderId !== 'me' && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          FOCUSED RIDER BOTTOM ACTION CARD
      ───────────────────────────────────────────────────────────── */}
      {isOnRadar && selectedMember && selectedMember.riderId !== 'me' && (
        <div 
          style={{ 
            bottom: 'max(4.8rem, calc(env(safe-area-inset-bottom) + 4.5rem))',
            left: 'max(0.6rem, env(safe-area-inset-left))',
            right: 'max(0.6rem, env(safe-area-inset-right))',
          }}
          className="absolute z-40 pointer-events-none flex justify-center animate-in slide-in-from-bottom-2 duration-150"
        >
          <div className={`pointer-events-auto w-full max-w-md p-3 sm:p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl space-y-2.5 font-sans ${
            isLight ? 'bg-white/98 border-slate-300 text-slate-900' : 'bg-slate-950/98 border-cyan-500/40 text-white'
          }`}>
            <div className={`flex items-center justify-between pb-1.5 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: selectedMember.color || '#00f0ff' }} 
                />
                <div className="truncate">
                  <div className={`font-bold text-xs truncate flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <span>{selectedMember.name}</span>
                    {selectedMember.bikeModel && (
                      <span className={`text-[10px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>({selectedMember.bikeModel})</span>
                    )}
                    {(selectedMember.isHost || selectedMember.riderId === leaderId) && (
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black inline-flex items-center gap-1 ${
                        isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      }`}>
                        <Crown className="w-2.5 h-2.5" /> LEAD
                      </span>
                    )}
                    {trailedRiderId === selectedMember.riderId && (
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black animate-pulse inline-flex items-center gap-1 ${
                        isLight ? 'bg-cyan-50 text-cyan-800 border-cyan-300' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                      }`}>
                        <Compass className="w-2.5 h-2.5" /> TRAILING
                      </span>
                    )}
                  </div>
                  <div className={`text-[10px] flex items-center gap-2 telemetry-num ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    <span>
                      {selectedMember.isOnline 
                        ? (selectedMember.location?.speedKmh && selectedMember.location.speedKmh >= 2.5 
                            ? `Cruising at ${formatSpeed(selectedMember.location.speedKmh)}` 
                            : 'Stopped')
                        : 'Offline'}
                    </span>
                    {selectedMember.location?.batteryPct !== undefined && (
                      <span className="inline-flex items-center gap-0.5">
                        <Battery className="w-3 h-3" /> {selectedMember.location.batteryPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-right telemetry-num">
                  <div className={`font-black text-xs ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`}>
                    {formatDistance(selectedMember.distanceFromMeMeters)}
                  </div>
                  <div className="text-[9px] text-slate-500">Separation</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRiderId('me')}
                  className={`p-1 rounded-lg cursor-pointer ml-1 ${
                    isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Close card"
                  aria-label="Close rider card"
                >
                  <X className="w-3.5 h-3.5" />
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
                {trailedRiderId === selectedMember.riderId ? (
                  <><X className="w-3.5 h-3.5" /> Stop Trailing</>
                ) : (
                  <><Compass className="w-3.5 h-3.5" /> Trail Rider</>
                )}
              </button>

              {!(selectedMember.isHost || selectedMember.riderId === leaderId) && onSetSquadLeader && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    onSetSquadLeader(selectedMember.riderId, selectedMember.name);
                  }}
                  className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-amber-50 border-slate-300 hover:border-amber-400 text-slate-700 hover:text-amber-800'
                      : 'bg-slate-800 hover:bg-amber-950/60 border-slate-700 hover:border-amber-500/50 text-slate-200 hover:text-amber-300'
                  }`}
                  title="Make this rider the squad leader"
                >
                  <Crown className="w-3.5 h-3.5" /> Make Lead
                </button>
              )}

              {selectedMember.location && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    openGoogleMapsNavigation(selectedMember.location!.lat, selectedMember.location!.lon, selectedMember.name);
                  }}
                  className={`p-2 rounded-xl border font-bold text-xs flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 hover:text-slate-900'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                  }`}
                  title="Navigate directly to rider in Google Maps"
                  aria-label="Navigate directly to rider in Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

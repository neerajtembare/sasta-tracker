import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GroupMemberInfo, SosAlert, CrewNotification } from '../hooks/useGroupRide';
import { AppTheme, UnitSystem } from '../types';
import { 
  Crosshair, 
  Users, 
  Share2, 
  AlertTriangle, 
  LogOut, 
  Navigation, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2,
  Edit3,
  Coffee,
  Radio,
  Scan
} from 'lucide-react';
import { triggerHaptic } from '../utils/audioChimes';

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
}

export type MapLayerType = 'streets' | 'satellite';

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
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const myMarkerRef = useRef<L.Marker | null>(null);
  const memberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const sosMarkerRef = useRef<L.Marker | null>(null);

  // Street map (OpenStreetMap) default - reliable, free, zero API/403 errors
  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>('me');
  const [hasInitialFit, setHasInitialFit] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Inline handle editor
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [tempHandle, setTempHandle] = useState(myRiderName);

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

  const toggleFullscreen = () => {
    triggerHaptic(20);
    setIsFullscreen(prev => {
      const next = !prev;
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 50);
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
      return next;
    });
  };

  // Keyboard shortcut: Esc to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 150);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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

  // Handle Tile Layer Changes (Street via OpenStreetMap, Satellite via ArcGIS - NO broken Carto CDN dark tiles)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;
    let attribution = '&copy; OpenStreetMap contributors';

    if (mapLayer === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = '&copy; Esri World Imagery';
    }

    const newLayer = L.tileLayer(url, { maxZoom, attribution });
    newLayer.addTo(map);
    tileLayerRef.current = newLayer;
  }, [mapLayer]);

  // Update "YOU" Marker (Crisp, high-contrast, zero continuous GPU repaints)
  useEffect(() => {
    if (!mapInstanceRef.current || !myLocation) {
      if (myMarkerRef.current) {
        myMarkerRef.current.remove();
        myMarkerRef.current = null;
      }
      return;
    }

    const map = mapInstanceRef.current;
    const pos: L.LatLngTuple = [myLocation.lat, myLocation.lon];
    const initial = myRiderName.charAt(0).toUpperCase() || 'Y';
    const color = myColor || '#00f0ff';
    const speed = formatSpeed(myLocation.speedKmh);
    const heading = myLocation.heading !== null && myLocation.heading !== undefined ? myLocation.heading : null;

    const headingArrow = heading !== null 
      ? `<div style="position:absolute; top:-7px; left:50%; transform:translateX(-50%) rotate(${heading}deg); width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:7px solid ${color};"></div>`
      : '';

    const myLeaderCrown = isHost
      ? `<div style="position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">👑 LEADER</div>`
      : '';

    const html = `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        ${myLeaderCrown}
        <div style="position:absolute; width:34px; height:34px; border-radius:50%; background:${color}; opacity:0.25; border:1.5px solid ${color};"></div>
        ${headingArrow}
        <div style="position:relative; width:26px; height:26px; border-radius:50%; background:${color}; border:2px solid #080c10; box-shadow:0 0 10px ${color}, 0 2px 5px rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:11px;">
          ${initial}
        </div>
        <div style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); background:#080c10; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 5px rgba(0,0,0,0.8);">
          YOU • ${speed}
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
    } else {
      myMarkerRef.current.setIcon(icon);
      myMarkerRef.current.setLatLng(pos);
    }

    if (selectedRiderId === 'me') {
      map.panTo(pos, { animate: true, duration: 0.5 });
    }
  }, [myLocation, myRiderName, myColor, unitSystem, selectedRiderId, isHost]);

  // Update Member Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove obsolete markers
    memberMarkersRef.current.forEach((marker, id) => {
      if (!members.some(m => m.riderId === id)) {
        marker.remove();
        memberMarkersRef.current.delete(id);
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

      const bearingArrow = bearing !== null && bearing !== undefined
        ? `<div style="position:absolute; top:-6px; left:50%; transform:translateX(-50%) rotate(${bearing}deg); width:0; height:0; border-left:3.5px solid transparent; border-right:3.5px solid transparent; border-bottom:6px solid ${color};"></div>`
        : '';

      const statusTag = isStopped ? 'STOP' : speed;
      const leaderCrown = m.isHost
        ? `<div style="position:absolute; top:-16px; left:50%; transform:translateX(-50%); background:#f59e0b; color:#080c10; font-family:monospace; font-size:8px; font-weight:900; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">👑 LEADER</div>`
        : '';

      const html = `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          ${leaderCrown}
          ${bearingArrow}
          <div style="width:24px; height:24px; border-radius:50%; background:${color}; border:2px solid #080c10; box-shadow:0 0 8px ${color}, 0 2px 4px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:10px;">
            ${initial}
          </div>
          <div style="position:absolute; bottom:-15px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:8px; font-weight:bold; padding:1px 3px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.8);">
            ${m.name}: ${statusTag}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `live-rider-marker-${m.riderId}`,
        html,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const distText = formatDistance(m.distanceFromMeMeters);
      const roleLabel = m.isHost ? '👑 Crew Leader' : 'Crew Member';
      const gmapsLink = `https://www.google.com/maps/dir/?api=1&destination=${m.location.lat.toFixed(6)},${m.location.lon.toFixed(6)}`;
      const popupHtml = `
        <div style="font-family:monospace; min-width:145px; text-align:center; padding:2px;">
          <div style="font-weight:900; font-size:12px; color:#fff; margin-bottom:2px;">${m.name}</div>
          <div style="font-size:9px; color:#f59e0b; font-weight:bold; margin-bottom:4px;">${roleLabel}</div>
          <div style="font-size:10px; color:#38bdf8; margin-bottom:8px;">
            ${distText} • ${statusTag}
          </div>
          <a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:4px; width:100%; background:#06b6d4; color:#080c10; font-weight:900; font-size:10px; padding:5px 8px; border-radius:6px; text-decoration:none;">
            🧭 Navigate in Maps
          </a>
        </div>
      `;

      let marker = memberMarkersRef.current.get(m.riderId);
      if (!marker) {
        marker = L.marker(pos, { icon, zIndexOffset: 900 }).addTo(map);
        marker.bindPopup(popupHtml, { offset: [0, -12] });
        marker.on('click', () => {
          setSelectedRiderId(m.riderId);
        });
        memberMarkersRef.current.set(m.riderId, marker);
      } else {
        marker.setIcon(icon);
        marker.setLatLng(pos);
        marker.setPopupContent(popupHtml);
      }
    });
  }, [members, unitSystem]);

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

  // Initial Auto-fit Bounds
  useEffect(() => {
    if (!mapInstanceRef.current || hasInitialFit) return;

    const points: L.LatLngTuple[] = [];
    if (myLocation) points.push([myLocation.lat, myLocation.lon]);
    members.forEach(m => {
      if (m.location) points.push([m.location.lat, m.location.lon]);
    });

    if (points.length > 0) {
      if (points.length === 1) {
        mapInstanceRef.current.setView(points[0], 15);
      } else {
        const bounds = L.latLngBounds(points);
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
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
      if (m.location) points.push([m.location.lat, m.location.lon]);
    });

    if (points.length === 0) return;

    if (points.length === 1) {
      mapInstanceRef.current.flyTo(points[0], 16, { animate: true, duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(points);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], animate: true });
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
    <div className={`relative flex flex-col overflow-hidden transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none shadow-none' 
        : 'h-[calc(100dvh-108px)] md:h-[calc(100dvh-64px)] min-h-[420px] w-full rounded-xl sm:rounded-2xl border shadow-xl'
    } ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#080c10] border-[#1e2a38]'}`}>

      {/* ─────────────────────────────────────────────────────────────
          LEAFLET MAP CANVAS
      ───────────────────────────────────────────────────────────── */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full relative z-0 cursor-grab active:cursor-grabbing" 
      />

      {/* Cold-Start Satellite Acquisition Pill */}
      {!myLocation && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-full bg-slate-950/92 backdrop-blur-md border border-amber-500/50 text-amber-300 font-mono text-[11px] font-bold shadow-xl flex items-center gap-1.5 whitespace-nowrap animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Acquiring GPS fix...</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ULTRA-COMPACT DYNAMIC ISLAND TOP HUD BAR (Height: 32px)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none gap-1.5">
        
        {/* Left: Manage Crew Pill & Callsign */}
        <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
          <button
            onClick={() => onOpenCrewManage ? onOpenCrewManage(isConnected ? 'active' : 'saved') : onToggleCrewList?.()}
            className="h-8 px-2.5 rounded-full bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 hover:border-cyan-400 text-white font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
            title="Open Crew Management (Make Crew, Join Crew, Saved Squads)"
          >
            {isConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 animate-pulse" />
                <span className="font-heading font-black tracking-wider text-cyan-400">Crew Radar</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {roomCode}
                </span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200">Manage Crew</span>
              </>
            )}
          </button>

          {/* Callsign Tag (Compact on mobile, full on desktop) */}
          {isEditingHandle ? (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-cyan-400 rounded-full h-8 px-2 shadow-md">
              <input
                type="text"
                maxLength={15}
                value={tempHandle}
                onChange={e => setTempHandle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveHandle();
                  if (e.key === 'Escape') setIsEditingHandle(false);
                }}
                placeholder="Callsign..."
                className="bg-transparent text-[11px] font-mono font-bold text-white focus:outline-none w-20"
                autoFocus
              />
              <button
                onClick={handleSaveHandle}
                className="px-2 py-0.5 bg-cyan-500 text-slate-950 font-bold text-[9px] rounded-full cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTempHandle(myRiderName);
                setIsEditingHandle(true);
              }}
              className="hidden sm:flex h-8 px-2.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white font-mono text-[11px] items-center gap-1.5 shadow-md cursor-pointer transition-colors"
              title="Tap to change your rider callsign"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: myColor || '#00f0ff' }} />
              <span className="font-bold truncate max-w-[90px]">{myRiderName}</span>
              <Edit3 className="w-2.5 h-2.5 text-slate-500" />
            </button>
          )}
        </div>

        {/* Right: Map Controls, Layer Toggle & Maximize (Clean, spacious, unclipped) */}
        <div className="flex items-center gap-1 pointer-events-auto shrink-0">
          {/* 1-Tap Garage Route Recording Sync */}
          {isRecording ? (
            <button
              onClick={onStopRecording}
              className="h-8 px-2 sm:px-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
              title="Track is actively logging to your Garage. Tap to stop and save."
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              <span className="font-black">REC</span>
              {totalDistanceMeters > 0 && (
                <span className="hidden sm:inline text-rose-200">
                  ({(totalDistanceMeters / 1000).toFixed(1)} km)
                </span>
              )}
            </button>
          ) : onStartRecording ? (
            <button
              onClick={onStartRecording}
              className="h-8 px-2 sm:px-2.5 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 font-mono font-bold text-[10px] flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
              title="Start logging route to your Garage while riding with crew"
            >
              <Radio className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Record</span>
            </button>
          ) : null}

          {/* Layer Toggle: Prominent Street | Sat with dedicated space */}
          <div className="flex items-center bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-full h-8 p-0.5 shadow-md text-[10px] font-mono font-bold shrink-0">
            <button
              onClick={() => setMapLayer('streets')}
              className={`px-2.5 h-full rounded-full transition-colors cursor-pointer ${
                mapLayer === 'streets' ? 'bg-cyan-500 text-slate-950 font-black shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="OpenStreetMap Standard Global Street View"
            >
              Street
            </button>
            <button
              onClick={() => setMapLayer('satellite')}
              className={`px-2.5 h-full rounded-full transition-colors cursor-pointer ${
                mapLayer === 'satellite' ? 'bg-cyan-500 text-slate-950 font-black shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Satellite View"
            >
              Sat
            </button>
          </div>

          {/* Maximize Button */}
          <button
            onClick={toggleFullscreen}
            className={`h-8 w-8 sm:w-auto sm:px-2.5 rounded-full backdrop-blur-md border font-mono font-bold text-[11px] flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all active:scale-95 shrink-0 ${
              isFullscreen
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950'
                : 'bg-slate-950/85 hover:bg-slate-900 border-cyan-500/50 text-cyan-300'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Maximize Map (Esc)'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Exit' : 'Max'}</span>
          </button>

          {/* Leave Button (Desktop) */}
          {isConnected && onLeaveRoom && (
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="hidden md:flex h-8 w-8 rounded-full bg-slate-950/85 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-600 text-slate-400 hover:text-rose-300 items-center justify-center shadow-md cursor-pointer transition-colors"
              title={isHost ? "End Crew Ride" : "Leave Crew"}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-950 border border-slate-700/80 p-4 shadow-2xl font-mono space-y-3 pointer-events-auto">
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
          RIGHT FLOATING ACTION BUTTONS: Recenter, Fit Convoy, Crew Roster, SOS
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute right-2 top-12 z-10 flex flex-col gap-2 pointer-events-auto">
        {/* Recenter on Me */}
        <button
          onClick={handleRecenterMe}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full backdrop-blur-md border shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
            selectedRiderId === 'me'
              ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-cyan-500/40 ring-2 ring-cyan-400/50'
              : 'bg-slate-950/90 border-slate-700/80 text-cyan-400 hover:bg-slate-900 hover:border-cyan-400'
          }`}
          title="Recenter on Me (GPS)"
        >
          <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Fit All Crew Riders (Convoy Bounds) */}
        <button
          onClick={handleFitAllRiders}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-700/80 hover:border-sky-400 text-sky-400 hover:text-sky-300 shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-95"
          title="Fit Convoy (Show all riders on map)"
        >
          <Scan className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Squad Members Roster & Crew Management */}
        <button
          onClick={() => onOpenCrewManage ? onOpenCrewManage(isConnected ? 'active' : 'saved') : onToggleCrewList?.()}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-700/80 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 relative"
          title="Open Crew Management (Make, Join, Delete & Manage Squads)"
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          {isConnected && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-slate-950 font-mono font-black text-[9px] flex items-center justify-center shadow-xs">
              {totalRiders}
            </span>
          )}
        </button>

        {/* SOS / Regroup Ping */}
        {isConnected && onTriggerSos && (
          <button
            onClick={() => {
              if (confirm('🚨 Broadcast REGROUP alert with your live GPS location to all crew members?')) {
                onTriggerSos();
              }
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-600 hover:bg-rose-500 backdrop-blur-md border border-rose-400/80 text-white shadow-lg shadow-rose-900/50 flex items-center justify-center cursor-pointer transition-all active:scale-95"
            title="Emergency SOS / Call Regroup"
          >
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>

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

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FLOATING RIDER TELEMETRY TRAY (Slim 32px height)
      ───────────────────────────────────────────────────────────── */}
      {isConnected && (
        <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none flex flex-col gap-1.5">
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            
            {/* Card: YOU */}
            <div
              onClick={handleRecenterMe}
              className={`h-8 flex items-center gap-1.5 px-2.5 rounded-full backdrop-blur-md border shadow-md cursor-pointer transition-all shrink-0 select-none ${
                selectedRiderId === 'me'
                  ? 'bg-cyan-950/90 border-cyan-400 text-white ring-1 ring-cyan-400'
                  : 'bg-slate-950/85 border-slate-800 text-slate-300'
              }`}
            >
              <div 
                className="w-4 h-4 rounded-full font-black text-slate-950 flex items-center justify-center text-[9px] shrink-0"
                style={{ backgroundColor: myColor || '#00f0ff' }}
              >
                {myRiderName.charAt(0).toUpperCase()}
              </div>
              <div className="font-mono text-[11px] font-bold flex items-center gap-1">
                <span>YOU</span>
                {isHost && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/25 border border-amber-500/40 text-amber-300 font-black">
                    LEADER
                  </span>
                )}
                <span className="text-cyan-400">
                  {myLocation ? formatSpeed(myLocation.speedKmh) : 'GPS...'}
                </span>
              </div>
            </div>

            {/* Member Cards */}
            {members.map(m => {
              const isSelected = selectedRiderId === m.riderId;
              const isWeak = m.isStale || (Date.now() - m.lastSeen > 25000);
              const isStopped = !isWeak && m.location && (m.location.status === 'stopped' || m.location.speedKmh < 2.0);
              const speedText = m.location ? formatSpeed(m.location.speedKmh) : '...';
              const distText = formatDistance(m.distanceFromMeMeters);
              const gmapsUrl = m.location
                ? `https://www.google.com/maps/dir/?api=1&destination=${m.location.lat.toFixed(6)},${m.location.lon.toFixed(6)}`
                : null;

              return (
                <div
                  key={m.riderId}
                  onClick={() => handleSelectMember(m)}
                  className={`h-8 flex items-center gap-1.5 px-2.5 rounded-full backdrop-blur-md border shadow-md cursor-pointer transition-all shrink-0 select-none ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-400 text-white ring-1 ring-cyan-400'
                      : 'bg-slate-950/85 border-slate-800 text-slate-300'
                  }`}
                >
                  <div 
                    className="w-4 h-4 rounded-full font-black text-slate-950 flex items-center justify-center text-[9px] shrink-0"
                    style={{ backgroundColor: m.color || '#ffe600' }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-mono text-[11px] font-bold flex items-center gap-1">
                    <span className="text-white">{m.name}</span>
                    {m.isHost && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-500/40 text-amber-300 font-black flex items-center gap-0.5">
                        👑 LEADER
                      </span>
                    )}
                    {isWeak ? (
                      <span className="text-amber-400 text-[10px] font-bold">Signal Weak</span>
                    ) : (
                      <span className={isStopped ? 'text-amber-400' : 'text-emerald-400'}>
                        {isStopped ? 'STOP' : speedText}
                      </span>
                    )}
                    <span className="text-slate-500">•</span>
                    <span className="text-sky-300">{distText}</span>
                  </div>

                  {gmapsUrl && (
                    <a
                      href={gmapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="h-5 px-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 transition-colors ml-0.5 flex items-center gap-1 font-bold text-[9px]"
                      title={`Open Google Maps turn-by-turn navigation to ${m.name}`}
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Directions</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

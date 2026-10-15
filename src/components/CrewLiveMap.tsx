import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { GroupMemberInfo, SosAlert } from '../hooks/useGroupRide';
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
  MessageCircle
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
  roomCode: string;
  theme?: AppTheme;
  unitSystem?: UnitSystem;
  onTriggerSos: () => void;
  onDismissSos?: () => void;
  onLeaveRoom: () => void;
  onShareWhatsApp: () => void;
  onCopyInviteLink: () => void;
  copiedLink: boolean;
  onGoToCockpit?: () => void;
  onUpdateRiderName?: (newName: string) => void;
}

export type MapLayerType = 'streets' | 'satellite';

export const CrewLiveMap: React.FC<CrewLiveMapProps> = ({
  myLocation,
  myRiderName,
  myColor,
  isHost,
  members,
  sosAlert,
  roomCode,
  theme = 'dark',
  unitSystem = 'metric',
  onTriggerSos,
  onDismissSos,
  onLeaveRoom,
  onShareWhatsApp,
  onCopyInviteLink,
  copiedLink,
  onGoToCockpit,
  onUpdateRiderName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const myMarkerRef = useRef<L.Marker | null>(null);
  const memberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const sosMarkerRef = useRef<L.Marker | null>(null);

  // Street map (OpenStreetMap) is default - 100% free, reliable, no API key or Carto 403 errors
  const [mapLayer, setMapLayer] = useState<MapLayerType>('streets');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>('me');
  const [hasInitialFit, setHasInitialFit] = useState(false);

  // Inline handle editor
  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [tempHandle, setTempHandle] = useState(myRiderName);

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
    if (meters === undefined || meters === null) return 'Locating...';
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

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Disengage auto-follow when user manually drags or pans the map
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
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
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

  // Update "YOU" Marker
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
      ? `<div style="position:absolute; top:-8px; left:50%; transform:translateX(-50%) rotate(${heading}deg); width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-bottom:8px solid ${color};"></div>`
      : '';

    const html = `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:40px; height:40px; border-radius:50%; background:${color}; opacity:0.35; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        ${headingArrow}
        <div style="position:relative; width:30px; height:30px; border-radius:50%; background:${color}; border:2.5px solid #080c10; box-shadow:0 0 16px ${color}, 0 4px 8px rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:12px;">
          ${initial}
        </div>
        <div style="position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); background:#080c10; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:9px; font-weight:900; padding:1px 5px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.8); letter-spacing:0.5px;">
          YOU • ${speed}
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
    } else {
      myMarkerRef.current.setIcon(icon);
      myMarkerRef.current.setLatLng(pos);
    }

    if (selectedRiderId === 'me') {
      map.panTo(pos, { animate: true, duration: 0.5 });
    }
  }, [myLocation, myRiderName, myColor, unitSystem, selectedRiderId]);

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
        ? `<div style="position:absolute; top:-7px; left:50%; transform:translateX(-50%) rotate(${bearing}deg); width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:7px solid ${color};"></div>`
        : '';

      const statusTag = isStopped ? 'STOP' : speed;

      const html = `
        <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
          ${bearingArrow}
          <div style="width:28px; height:28px; border-radius:50%; background:${color}; border:2px solid #080c10; box-shadow:0 0 12px ${color}, 0 3px 6px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#080c10; font-family:monospace; font-weight:900; font-size:11px;">
            ${initial}
          </div>
          <div style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); background:#0f172a; border:1px solid ${color}; color:${color}; font-family:monospace; font-size:9px; font-weight:bold; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.8);">
            ${m.name}: ${statusTag}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: `live-rider-marker-${m.riderId}`,
        html,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      let marker = memberMarkersRef.current.get(m.riderId);
      if (!marker) {
        marker = L.marker(pos, { icon, zIndexOffset: 900 }).addTo(map);
        marker.on('click', () => {
          setSelectedRiderId(m.riderId);
          map.flyTo(pos, 16, { animate: true, duration: 1 });
        });
        memberMarkersRef.current.set(m.riderId, marker);
      } else {
        marker.setIcon(icon);
        marker.setLatLng(pos);
      }
    });
  }, [members, unitSystem]);

  // SOS Flashing Marker
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
      <div style="position:relative; width:50px; height:50px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:48px; height:48px; border-radius:50%; background:#ef4444; opacity:0.5; animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:relative; width:34px; height:34px; border-radius:50%; background:#ef4444; border:3px solid #fff; box-shadow:0 0 20px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px;">
          🚨
        </div>
        <div style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); background:#7f1d1d; border:1px solid #ef4444; color:#fff; font-family:monospace; font-size:10px; font-weight:900; padding:2px 6px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.9);">
          SOS: ${sosAlert.fromName}
        </div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'live-rider-sos-beacon',
      html,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
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
        mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      }
      setHasInitialFit(true);
    }
  }, [myLocation, members, hasInitialFit]);

  // Fit bounds to include all crew members
  const handleFitAllRiders = () => {
    if (!mapInstanceRef.current) return;
    triggerHaptic(30);

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
      mapInstanceRef.current.fitBounds(bounds, { padding: [70, 70], animate: true });
    }
    setSelectedRiderId(null);
  };

  // Recenter on My Location
  const handleRecenterMe = () => {
    if (!mapInstanceRef.current || !myLocation) return;
    triggerHaptic(30);
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
      triggerHaptic(40);
    }
  };

  const totalRiders = members.length + 1;

  return (
    <div className={`relative flex flex-col overflow-hidden transition-all duration-300 ${
      isFullscreen 
        ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none shadow-none' 
        : 'h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] min-h-[520px] w-full rounded-2xl border shadow-2xl'
    } ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#080c10] border-[#1e2a38]'}`}>

      {/* ─────────────────────────────────────────────────────────────
          LEAFLET MAP CANVAS
      ───────────────────────────────────────────────────────────── */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full relative z-0 cursor-grab active:cursor-grabbing" 
      />

      {/* ─────────────────────────────────────────────────────────────
          TOP STREAMLINED HUD: Room Code, Rider Handle, Layers, Maximize & Invite
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Crew Status & Callsign */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          {/* Room Code Badge with 1-Tap Copy */}
          <button
            onClick={onCopyInviteLink}
            className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 hover:border-cyan-400 text-white font-mono text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
            title="Click to copy 1-tap join link"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-heading font-black tracking-wider text-cyan-400">
              {roomCode}
            </span>
            {copiedLink ? (
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Copied!
              </span>
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
            <span className="text-slate-600">|</span>
            <span className="text-[11px] font-bold text-slate-300">
              {totalRiders} {totalRiders === 1 ? 'Rider' : 'Riders'}
            </span>
          </button>

          {/* Callsign Editor Pill */}
          {isEditingHandle ? (
            <div className="flex items-center gap-1 bg-slate-950/90 border border-cyan-400 rounded-xl p-0.5 shadow-lg">
              <input
                type="text"
                maxLength={18}
                value={tempHandle}
                onChange={e => setTempHandle(e.target.value)}
                placeholder="Rider handle..."
                className="px-2 py-1 bg-transparent text-xs font-mono font-bold text-white focus:outline-none w-24 sm:w-32"
                autoFocus
              />
              <button
                onClick={handleSaveHandle}
                className="px-2 py-1 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-lg cursor-pointer"
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
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors"
              title="Click to change your rider callsign"
            >
              <div 
                className="w-4 h-4 rounded-full text-slate-950 font-black text-[9px] flex items-center justify-center"
                style={{ backgroundColor: myColor || '#00f0ff' }}
              >
                {myRiderName.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-slate-200">{myRiderName}</span>
              <Edit3 className="w-2.5 h-2.5 text-slate-500" />
            </button>
          )}
        </div>

        {/* Right: Map Controls, Maximize & Quick Actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto ml-auto">
          {/* Map Layer Switcher: Street (OSM) / Satellite (Esri) */}
          <div className="flex items-center bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-0.5 shadow-lg text-[11px] font-mono font-bold">
            <button
              onClick={() => setMapLayer('streets')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                mapLayer === 'streets'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
            <button
              onClick={() => setMapLayer('satellite')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                mapLayer === 'satellite'
                  ? 'bg-cyan-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Prominent Maximize / Fullscreen Map Button */}
          <button
            onClick={toggleFullscreen}
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95 ${
              isFullscreen
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950'
                : 'bg-slate-950/90 hover:bg-slate-900 border-cyan-500/50 hover:border-cyan-400 text-cyan-300'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Maximize Map for Handlebar Cockpit'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Maximize</span>
              </>
            )}
          </button>

          {/* Single WhatsApp Invite Button */}
          <button
            onClick={onShareWhatsApp}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 backdrop-blur-md border border-emerald-400/40 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer transition-colors active:scale-95"
            title="Invite friends on WhatsApp with 1-tap link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          {/* Leave Button */}
          <button
            onClick={onLeaveRoom}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-950/90 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-600 text-slate-400 hover:text-rose-300 font-mono text-xs font-bold flex items-center gap-1 shadow-lg cursor-pointer transition-colors"
            title="Leave this group ride"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT FLOATING ACTION BUTTONS: Recenter, Fit, SOS
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute right-3 top-16 z-10 flex flex-col gap-2 pointer-events-auto">
        {/* Recenter on Me */}
        <button
          onClick={handleRecenterMe}
          className={`p-3 rounded-xl backdrop-blur-md border shadow-lg cursor-pointer transition-all ${
            selectedRiderId === 'me'
              ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-cyan-500/40'
              : 'bg-slate-950/90 border-slate-700/80 text-cyan-400 hover:bg-slate-900'
          }`}
          title="Recenter on My Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Fit All Crew Riders */}
        <button
          onClick={handleFitAllRiders}
          className="p-3 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/80 hover:border-cyan-400 text-slate-200 hover:text-white shadow-lg cursor-pointer transition-colors"
          title="Zoom to Fit All Crew Members"
        >
          <Users className="w-5 h-5" />
        </button>

        {/* SOS / Regroup Ping */}
        <button
          onClick={onTriggerSos}
          className="p-3 rounded-xl bg-rose-600/90 hover:bg-rose-500 backdrop-blur-md border border-rose-400/60 text-white shadow-lg shadow-rose-900/40 cursor-pointer transition-colors"
          title="Send Regroup Ping to All Crew Members"
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SOS BANNER OVERLAY (If alert received)
      ───────────────────────────────────────────────────────────── */}
      {sosAlert && (
        <div className="absolute top-16 left-3 right-16 z-20 p-3 rounded-xl bg-rose-950/95 backdrop-blur-md border border-rose-500 text-white font-mono text-xs shadow-2xl flex items-center justify-between gap-2 animate-bounce">
          <div className="flex items-center gap-2 truncate">
            <span className="text-base">🚨</span>
            <span className="font-bold text-rose-300 truncate">
              REGROUP: {sosAlert.fromName} requested meet up!
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${sosAlert.lat.toFixed(6)},${sosAlert.lon.toFixed(6)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Navigate</span>
            </a>
            {onDismissSos && (
              <button
                onClick={onDismissSos}
                className="px-2 py-1 rounded border border-rose-700 hover:bg-rose-800 text-rose-300 text-xs"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FLOATING RIDER CHIPS TRAY (Speed, Distance & 1-Tap Navigation)
      ───────────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none flex flex-col gap-2">
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          
          {/* Card: YOU */}
          <div
            onClick={handleRecenterMe}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl backdrop-blur-md border shadow-lg cursor-pointer transition-all shrink-0 select-none ${
              selectedRiderId === 'me'
                ? 'bg-cyan-950/90 border-cyan-400 text-white ring-1 ring-cyan-400'
                : 'bg-slate-950/85 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div 
              className="w-7 h-7 rounded-lg font-black text-slate-950 flex items-center justify-center text-xs shrink-0 shadow-sm"
              style={{ backgroundColor: myColor || '#00f0ff' }}
            >
              {myRiderName.charAt(0).toUpperCase()}
            </div>
            <div className="font-mono text-left">
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span>{myRiderName}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">YOU</span>
              </div>
              <div className="text-[11px] text-cyan-400 font-bold">
                {myLocation ? formatSpeed(myLocation.speedKmh) : 'Acquiring GPS...'}
              </div>
            </div>
          </div>

          {/* Member Cards */}
          {members.map(m => {
            const isSelected = selectedRiderId === m.riderId;
            const isStopped = m.location && (m.location.status === 'stopped' || m.location.speedKmh < 2.0);
            const speedText = m.location ? formatSpeed(m.location.speedKmh) : 'Locating...';
            const distText = formatDistance(m.distanceFromMeMeters);
            const gmapsUrl = m.location
              ? `https://www.google.com/maps/dir/?api=1&destination=${m.location.lat.toFixed(6)},${m.location.lon.toFixed(6)}`
              : null;

            return (
              <div
                key={m.riderId}
                onClick={() => handleSelectMember(m)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl backdrop-blur-md border shadow-lg cursor-pointer transition-all shrink-0 select-none ${
                  isSelected
                    ? 'bg-slate-900/90 border-cyan-400 text-white ring-1 ring-cyan-400'
                    : 'bg-slate-950/85 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div 
                  className="w-7 h-7 rounded-lg font-black text-slate-950 flex items-center justify-center text-xs shrink-0 shadow-sm"
                  style={{ backgroundColor: m.color || '#ffe600' }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="font-mono text-left">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{m.name}</span>
                    {isStopped && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-0.5">
                        <Coffee className="w-2.5 h-2.5" /> STOP
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold">
                    <span className={isStopped ? 'text-amber-400' : 'text-emerald-400'}>
                      {speedText}
                    </span>
                    <span>•</span>
                    <span className="text-sky-300">{distText}</span>
                  </div>
                </div>

                {/* 1-Tap Google Maps Navigation to this rider */}
                {gmapsUrl && (
                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="p-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 transition-colors ml-1"
                    title={`Open Google Maps directions to ${m.name}`}
                  >
                    <Navigation className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

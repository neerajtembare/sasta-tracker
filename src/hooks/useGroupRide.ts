import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { haversineDistance } from '../utils/gpxParser';
import { playWaypointChime, playWarningChime } from '../utils/audioChimes';

export interface GroupRiderLocation {
  riderId: string;
  name: string;
  color: string;
  lat: number;
  lon: number;
  speedKmh: number;
  bearing: number | null;
  timestamp: number;
  status: 'riding' | 'stopped' | 'sos';
  batteryPct?: number;
}

export interface GroupMemberInfo {
  riderId: string;
  name: string;
  color: string;
  isHost: boolean;
  lastSeen: number;
  location?: GroupRiderLocation;
  distanceFromMeMeters?: number;
}

export interface SosAlert {
  fromName: string;
  lat: number;
  lon: number;
  timestamp: number;
}

export const MOTORCYCLE_CALLSIGNS = [
  'ApexRider', 'GhostRider', 'ThunderRider', 'NightHawk', 'TrailBlazer',
  'TurboRider', 'ShadowRider', 'HyperRider', 'Maverick', 'Viper',
  'Phantom', 'Raptor', 'IronClaw', 'RoadWarrior', 'TorqueRider',
  'NinjaRider', 'ApexPredator', 'MotoNomad', 'StormRider', 'FalconRider'
];

export function generateRandomRiderName(): string {
  const prefix = MOTORCYCLE_CALLSIGNS[Math.floor(Math.random() * MOTORCYCLE_CALLSIGNS.length)];
  const num = Math.floor(10 + Math.random() * 89);
  return `${prefix}-${num}`;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelay',
    credential: 'openrelay',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelay',
    credential: 'openrelay',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelay',
    credential: 'openrelay',
  },
];

export const RIDER_COLORS = [
  '#00f0ff', // Electric Cyan
  '#ffe600', // Neon Amber/Yellow
  '#ff3366', // Hot Coral Rose
  '#00ff88', // Emerald Spring
  '#a855f7', // Vivid Purple
  '#38bdf8', // Sky Blue
  '#f97316', // Blaze Orange
  '#ec4899', // Hot Pink
];

export function getRiderColor(id: string): string {
  if (!id) return RIDER_COLORS[1];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
  }
  const idx = Math.abs(hash) % RIDER_COLORS.length;
  return RIDER_COLORS[idx];
}

function sanitizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

export function useGroupRide() {
  const [roomCode, setRoomCode] = useState<string>('');
  const [riderName, setRiderName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('sasta_rider_name') || localStorage.getItem('throttlelog_rider_name');
      if (saved && saved.trim()) return saved.trim();
      const generated = generateRandomRiderName();
      localStorage.setItem('sasta_rider_name', generated);
      return generated;
    } catch {
      return generateRandomRiderName();
    }
  });
  const [riderId] = useState<string>(() => 'rider_' + Math.random().toString(36).substring(2, 9));
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [members, setMembers] = useState<Map<string, GroupMemberInfo>>(new Map());
  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const peerToRiderMapRef = useRef<Map<string, string>>(new Map());
  const myLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const retryTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);

  // Broadcast location or message to all connected peers
  const broadcastMessage = useCallback((payload: any) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          // ignore transient send errors
        }
      }
    });
  }, []);

  // Handle incoming data message from a peer
  const handleIncomingData = useCallback((data: any, fromPeerId: string) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'GREETING') {
      const g = data.payload;
      if (g?.riderId) {
        peerToRiderMapRef.current.set(fromPeerId, g.riderId);
        setMembers(prev => {
          const next = new Map(prev);
          const existing = next.get(g.riderId);
          let dist: number | undefined = undefined;
          if (myLocationRef.current && g.location) {
            dist = haversineDistance(
              myLocationRef.current.lat,
              myLocationRef.current.lon,
              g.location.lat,
              g.location.lon
            );
          }
          next.set(g.riderId, {
            riderId: g.riderId,
            name: g.name,
            color: g.color || RIDER_COLORS[1],
            isHost: !!g.isHost,
            lastSeen: Date.now(),
            location: g.location || existing?.location,
            distanceFromMeMeters: dist ?? existing?.distanceFromMeMeters,
          });
          return next;
        });
      }
    } else if (data.type === 'LOCATION_UPDATE') {
      const loc: GroupRiderLocation = data.payload;
      if (loc?.riderId) {
        peerToRiderMapRef.current.set(fromPeerId, loc.riderId);
        setMembers(prev => {
          const next = new Map(prev);
          const existing = next.get(loc.riderId) || {
            riderId: loc.riderId,
            name: loc.name,
            color: loc.color,
            isHost: false,
            lastSeen: Date.now(),
          };

          let dist: number | undefined = undefined;
          if (myLocationRef.current) {
            dist = haversineDistance(
              myLocationRef.current.lat,
              myLocationRef.current.lon,
              loc.lat,
              loc.lon
            );
          }

          next.set(loc.riderId, {
            ...existing,
            name: loc.name,
            lastSeen: Date.now(),
            location: loc,
            distanceFromMeMeters: dist,
          });
          return next;
        });
      }
    } else if (data.type === 'HEARTBEAT') {
      const hbRiderId = data.riderId;
      if (hbRiderId) {
        peerToRiderMapRef.current.set(fromPeerId, hbRiderId);
        setMembers(prev => {
          const existing = prev.get(hbRiderId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(hbRiderId, {
            ...existing,
            lastSeen: Date.now(),
          });
          return next;
        });
      }
    } else if (data.type === 'LEAVE') {
      const leavingId = data.riderId;
      if (leavingId) {
        setMembers(prev => {
          if (!prev.has(leavingId)) return prev;
          const next = new Map(prev);
          next.delete(leavingId);
          return next;
        });
      }
    } else if (data.type === 'RENAME') {
      const rId = data.riderId;
      const newName = data.newName;
      if (rId && newName) {
        setMembers(prev => {
          const existing = prev.get(rId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(rId, {
            ...existing,
            name: newName,
            location: existing.location ? { ...existing.location, name: newName } : undefined,
          });
          return next;
        });
      }
    } else if (data.type === 'SOS_PING') {
      const alert: SosAlert = data.payload;
      setSosAlert(alert);
      playWarningChime();
    } else if (data.type === 'PEER_LIST' && Array.isArray(data.peers)) {
      // Connect to other members shared by host
      data.peers.forEach((peerId: string) => {
        if (peerId !== peerRef.current?.id && !connectionsRef.current.has(peerId)) {
          connectToPeer(peerId);
        }
      });
    }
  }, []);

  // Connect to a peer
  const connectToPeer = useCallback((targetPeerId: string) => {
    if (!peerRef.current || peerRef.current.disconnected) return;
    try {
      const conn = peerRef.current.connect(targetPeerId, { reliable: false });
      setupConnection(conn);
    } catch (err) {
      console.warn('Failed connecting to peer:', targetPeerId, err);
    }
  }, []);

  // Setup connection event handlers
  const setupConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      connectionsRef.current.set(conn.peer, conn);
      setIsConnected(true);
      setConnectionStatus('connected');
      setStatusMessage(`Connected with ${connectionsRef.current.size} rider(s)`);

      // Immediately send greeting identity so rider appears on HUD without waiting for GPS movement
      const myColor = getRiderColor(riderId);
      try {
        conn.send({
          type: 'GREETING',
          payload: {
            riderId,
            name: riderName || 'Rider',
            color: myColor,
            isHost,
            location: myLocationRef.current ? {
              riderId,
              name: riderName || 'Rider',
              color: myColor,
              lat: myLocationRef.current.lat,
              lon: myLocationRef.current.lon,
              speedKmh: 0,
              bearing: null,
              timestamp: Date.now(),
              status: 'stopped',
            } : undefined,
          },
        });
      } catch {}

      // If we are host, announce other peers to newly connected rider
      if (isHost) {
        const allPeerIds = Array.from(connectionsRef.current.keys()).concat(peerRef.current?.id || '');
        conn.send({ type: 'PEER_LIST', peers: allPeerIds });
      }
    });

    conn.on('data', (data) => {
      handleIncomingData(data, conn.peer);
    });

    conn.on('close', () => {
      const rId = peerToRiderMapRef.current.get(conn.peer);
      connectionsRef.current.delete(conn.peer);
      if (rId) {
        peerToRiderMapRef.current.delete(conn.peer);
        setMembers(prev => {
          if (!prev.has(rId)) return prev;
          const next = new Map(prev);
          next.delete(rId);
          return next;
        });
      }
    });

    conn.on('error', (err) => {
      console.warn('Connection error with peer:', conn.peer, err);
    });
  }, [handleIncomingData, isHost, riderId, riderName]);

  // Create a new Group Ride as Host
  const createRoom = useCallback((name: string, customCode?: string) => {
    const cleanName = name.trim() || generateRandomRiderName();
    setRiderName(cleanName);
    try {
      localStorage.setItem('sasta_rider_name', cleanName);
      localStorage.setItem('throttlelog_rider_name', cleanName);
    } catch {}

    const generated = customCode 
      ? sanitizeCode(customCode) 
      : 'RIDE' + Math.floor(1000 + Math.random() * 9000);
    
    setRoomCode(generated);
    setIsHost(true);
    setConnectionStatus('connecting');
    setStatusMessage('Starting private group room...');

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryCountRef.current = 0;

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const hostPeerId = `sasta-${generated}-host`;
    const peer = new Peer(hostPeerId, {
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    peer.on('open', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setStatusMessage(`Room ${generated} created! Share code or link with your crew.`);
      playWaypointChime();
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('disconnected', () => {
      try {
        peer.reconnect();
      } catch {}
    });

    peer.on('error', (err: any) => {
      if (err.type === 'unavailable-id') {
        setStatusMessage('Room code already in use. Generating alternate...');
        createRoom(cleanName);
      } else {
        setConnectionStatus('error');
        setStatusMessage(err.message || 'Peer connection error');
      }
    });

    peerRef.current = peer;
  }, [setupConnection]);

  // Join an existing Group Ride with automatic 3x retry
  const joinRoom = useCallback((code: string, name?: string) => {
    const cleanCode = sanitizeCode(code);
    if (!cleanCode) {
      setStatusMessage('Please enter a valid 4-8 digit room code');
      return;
    }
    const cleanName = (name && name.trim()) || riderName || generateRandomRiderName();
    setRiderName(cleanName);
    try {
      localStorage.setItem('sasta_rider_name', cleanName);
      localStorage.setItem('throttlelog_rider_name', cleanName);
    } catch {}

    setRoomCode(cleanCode);
    setIsHost(false);
    setConnectionStatus('connecting');
    setStatusMessage(`Connecting to room ${cleanCode}...`);

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryCountRef.current = 0;

    if (peerRef.current) {
      peerRef.current.destroy();
    }

    const myPeerId = `sasta-${cleanCode}-${riderId}`;
    const peer = new Peer(myPeerId, {
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    const attemptHostConnection = () => {
      try {
        const hostPeerId = `sasta-${cleanCode}-host`;
        const conn = peer.connect(hostPeerId, { reliable: false });
        setupConnection(conn);
      } catch (e) {
        console.warn('Error connecting to host peer:', e);
      }
    };

    peer.on('open', () => {
      attemptHostConnection();
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('disconnected', () => {
      try {
        peer.reconnect();
      } catch {}
    });

    peer.on('error', (err: any) => {
      console.warn('Peer error during join:', err);
      if (retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setStatusMessage(`Connecting to room leader (Attempt ${retryCountRef.current}/3)...`);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          attemptHostConnection();
        }, 1200);
      } else {
        setConnectionStatus('error');
        setStatusMessage('Could not find room leader. Check room code or ensure leader is active.');
      }
    });

    peerRef.current = peer;
  }, [riderId, riderName, setupConnection]);

  // Update rider's callsign / name on the fly and notify all peers
  const updateRiderName = useCallback((newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setRiderName(clean);
    try {
      localStorage.setItem('sasta_rider_name', clean);
      localStorage.setItem('throttlelog_rider_name', clean);
    } catch {}
    broadcastMessage({
      type: 'RENAME',
      riderId,
      newName: clean,
    });
  }, [broadcastMessage, riderId]);

  // Leave Group Ride
  const leaveRoom = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryCountRef.current = 0;
    try {
      broadcastMessage({ type: 'LEAVE', riderId });
    } catch {}
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connectionsRef.current.clear();
    peerToRiderMapRef.current.clear();
    setMembers(new Map());
    setIsConnected(false);
    setIsHost(false);
    setRoomCode('');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setSosAlert(null);
  }, [broadcastMessage, riderId]);

  // Update my current GPS location and broadcast to crew
  const updateMyLocation = useCallback((
    lat: number,
    lon: number,
    speedKmh: number,
    bearing: number | null
  ) => {
    myLocationRef.current = { lat, lon };

    // Update distances to members on local radar when my location updates
    setMembers(prev => {
      let changed = false;
      const next = new Map(prev);
      next.forEach((member, id) => {
        if (member.location) {
          const d = haversineDistance(lat, lon, member.location.lat, member.location.lon);
          if (member.distanceFromMeMeters === undefined || Math.abs(member.distanceFromMeMeters - d) > 2) {
            next.set(id, { ...member, distanceFromMeMeters: d });
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });

    if (!isConnected) return;

    // Determine status (stopped if <2 km/h)
    const status: 'riding' | 'stopped' = speedKmh < 2.0 ? 'stopped' : 'riding';
    const myColor = getRiderColor(riderId);

    const payload: GroupRiderLocation = {
      riderId,
      name: riderName || 'Rider',
      color: myColor,
      lat,
      lon,
      speedKmh,
      bearing,
      timestamp: Date.now(),
      status,
    };

    broadcastMessage({
      type: 'LOCATION_UPDATE',
      payload,
    });
  }, [isConnected, riderId, riderName, broadcastMessage]);

  // Trigger SOS / Regroup Ping
  const triggerSos = useCallback(() => {
    if (!myLocationRef.current || !isConnected) return;
    const alert: SosAlert = {
      fromName: riderName || 'Crew Member',
      lat: myLocationRef.current.lat,
      lon: myLocationRef.current.lon,
      timestamp: Date.now(),
    };
    broadcastMessage({
      type: 'SOS_PING',
      payload: alert,
    });
    setSosAlert(alert);
    playWarningChime();
  }, [isConnected, riderName, broadcastMessage]);

  // 5-second keep-alive heartbeat to maintain WebRTC DataConnection across cellular carrier NAT timeouts
  useEffect(() => {
    if (!isConnected) return;
    const heartbeatInterval = setInterval(() => {
      broadcastMessage({
        type: 'HEARTBEAT',
        riderId,
        timestamp: Date.now(),
      });
    }, 5000);
    return () => clearInterval(heartbeatInterval);
  }, [isConnected, riderId, broadcastMessage]);

  // Periodic cleanup of stale riders (lost signal in tunnels or dead battery > 45s)
  useEffect(() => {
    if (!isConnected) return;
    const cleanupInterval = setInterval(() => {
      setMembers(prev => {
        let changed = false;
        const now = Date.now();
        const next = new Map(prev);
        prev.forEach((info, id) => {
          if (now - info.lastSeen > 45000) {
            next.delete(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 10000);
    return () => clearInterval(cleanupInterval);
  }, [isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  return {
    roomCode,
    riderName,
    riderId,
    myColor: getRiderColor(riderId),
    isHost,
    isConnected,
    connectionStatus,
    statusMessage,
    members: Array.from(members.values()),
    sosAlert,
    createRoom,
    joinRoom,
    leaveRoom,
    updateMyLocation,
    triggerSos,
    dismissSos: () => setSosAlert(null),
    updateRiderName,
  };
}

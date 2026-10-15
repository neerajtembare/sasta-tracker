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
  isStale?: boolean;
}

export interface CrewNotification {
  id: string;
  text: string;
  type: 'join' | 'leave' | 'info' | 'alert';
  timestamp: number;
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
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
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
  const [lastRoomCode, setLastRoomCode] = useState<string>(() => {
    try {
      return localStorage.getItem('sasta_last_crew') || '';
    } catch {
      return '';
    }
  });
  const [crewNotification, setCrewNotification] = useState<CrewNotification | null>(null);
  const notificationTimeoutRef = useRef<any>(null);

  const postCrewNotification = useCallback((text: string, type: 'join' | 'leave' | 'info' | 'alert' = 'info') => {
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    const notif: CrewNotification = {
      id: 'notif_' + Date.now(),
      text,
      type,
      timestamp: Date.now(),
    };
    setCrewNotification(notif);
    notificationTimeoutRef.current = setTimeout(() => {
      setCrewNotification(null);
    }, 4500);
  }, []);



  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const peerToRiderMapRef = useRef<Map<string, string>>(new Map());
  const myLocationRef = useRef<{ lat: number; lon: number; speedKmh: number; bearing: number | null } | null>(null);
  const membersRef = useRef<Map<string, GroupMemberInfo>>(new Map());
  const retryTimeoutRef = useRef<any>(null);
  const joinAttemptRef = useRef<number>(0);
  const isHostRef = useRef<boolean>(false);
  const riderNameRef = useRef<string>(riderName);
  const isManualLeaveRef = useRef<boolean>(false);
  const reconnectIntervalRef = useRef<any>(null);
  const activeRoomCodeRef = useRef<string>('');
  const hasSwitchedFromHostRef = useRef<boolean>(false);

  isHostRef.current = isHost;
  riderNameRef.current = riderName;

  // Sync state members to membersRef
  const updateMembersState = useCallback((updater: (prev: Map<string, GroupMemberInfo>) => Map<string, GroupMemberInfo>) => {
    setMembers(prev => {
      const next = updater(prev);
      membersRef.current = next;
      return next;
    });
  }, []);

  // Broadcast message to all directly connected peers
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

  // Host Star-Relay: forward data packets to all other peers (excluding the origin peer)
  // Guarantees all riders receive telemetry even if mobile carrier CGNAT blocks direct P2P mesh
  const relayToOthers = useCallback((data: any, excludePeerId: string) => {
    if (!isHostRef.current) return;
    connectionsRef.current.forEach((conn, peerId) => {
      if (peerId !== excludePeerId && conn.open) {
        try {
          conn.send(data);
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
      if (g?.riderId && g.riderId !== riderId) {
        peerToRiderMapRef.current.set(fromPeerId, g.riderId);
        updateMembersState(prev => {
          const isNew = !prev.has(g.riderId);
          if (isNew) {
            playWaypointChime();
            postCrewNotification(`🏍️ ${g.name || 'A rider'} joined the crew radar!`, 'join');
          }
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
            isStale: false,
          });
          return next;
        });

        // If we are Host: relay this rider's greeting to all other riders
        if (isHostRef.current) {
          relayToOthers(data, fromPeerId);
        }
      }
    } else if (data.type === 'LOCATION_UPDATE') {
      const loc: GroupRiderLocation = data.payload;
      if (loc?.riderId && loc.riderId !== riderId) {
        peerToRiderMapRef.current.set(fromPeerId, loc.riderId);
        updateMembersState(prev => {
          const existing = prev.get(loc.riderId);
          // If we already have a newer timestamp from direct mesh, don't overwrite with older relayed packet
          if (existing?.location && existing.location.timestamp > loc.timestamp) {
            return prev;
          }

          const next = new Map(prev);
          const base = existing || {
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
            ...base,
            name: loc.name,
            lastSeen: Date.now(),
            location: loc,
            distanceFromMeMeters: dist,
            isStale: false,
          });
          return next;
        });

        // If Host: forward this location update to all other squad members
        if (isHostRef.current) {
          relayToOthers(data, fromPeerId);
        }
      }
    } else if (data.type === 'CREW_SYNC' && Array.isArray(data.members)) {
      // Instant synchronization of all existing riders in the squad from the host
      updateMembersState(prev => {
        const next = new Map(prev);
        data.members.forEach((m: GroupMemberInfo) => {
          if (m && m.riderId && m.riderId !== riderId) {
            const existing = next.get(m.riderId);
            let dist = m.distanceFromMeMeters;
            if (myLocationRef.current && m.location) {
              dist = haversineDistance(
                myLocationRef.current.lat,
                myLocationRef.current.lon,
                m.location.lat,
                m.location.lon
              );
            }
            next.set(m.riderId, {
              ...m,
              distanceFromMeMeters: dist ?? existing?.distanceFromMeMeters,
              lastSeen: Date.now(),
              isStale: false,
            });
          }
        });
        return next;
      });
    } else if (data.type === 'HEARTBEAT') {
      const hbRiderId = data.riderId;
      if (hbRiderId && hbRiderId !== riderId) {
        peerToRiderMapRef.current.set(fromPeerId, hbRiderId);
        updateMembersState(prev => {
          const existing = prev.get(hbRiderId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(hbRiderId, {
            ...existing,
            lastSeen: Date.now(),
            isStale: false,
          });
          return next;
        });

        if (isHostRef.current) {
          relayToOthers(data, fromPeerId);
        }
      }
    } else if (data.type === 'LEAVE') {
      const leavingId = data.riderId;
      if (leavingId && leavingId !== riderId) {
        updateMembersState(prev => {
          if (!prev.has(leavingId)) return prev;
          const leaver = prev.get(leavingId);
          if (leaver) {
            postCrewNotification(`👋 ${leaver.name} left the crew.`, 'leave');
          }
          const next = new Map(prev);
          next.delete(leavingId);
          return next;
        });

        if (isHostRef.current) {
          relayToOthers(data, fromPeerId);
        }
      }
    } else if (data.type === 'HOST_CLOSED') {
      // Crew leader closed the room
      isManualLeaveRef.current = true;
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setStatusMessage(`Crew Leader (${data.riderName || 'Leader'}) ended the crew ride.`);
      postCrewNotification(`🏁 Crew Leader (${data.riderName || 'Leader'}) ended the crew ride.`, 'info');
      updateMembersState(() => new Map());
    } else if (data.type === 'RENAME') {
      const rId = data.riderId;
      const newName = data.newName;
      if (rId && newName && rId !== riderId) {
        updateMembersState(prev => {
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

        if (isHostRef.current) {
          relayToOthers(data, fromPeerId);
        }
      }
    } else if (data.type === 'SOS_PING') {
      const alert: SosAlert = data.payload;
      setSosAlert(alert);
      playWarningChime();

      if (isHostRef.current) {
        relayToOthers(data, fromPeerId);
      }
    } else if (data.type === 'PEER_LIST' && Array.isArray(data.peers)) {
      // Connect directly to other members shared by host for mesh redundancy
      data.peers.forEach((peerId: string) => {
        if (peerId && peerId !== peerRef.current?.id && !connectionsRef.current.has(peerId)) {
          connectToPeer(peerId);
        }
      });
    }
  }, [postCrewNotification, relayToOthers, riderId, updateMembersState]);

  // Connect to a peer
  const connectToPeer = useCallback((targetPeerId: string) => {
    if (!peerRef.current || peerRef.current.disconnected) return;
    try {
      const conn = peerRef.current.connect(targetPeerId, {
        reliable: true,
        serialization: 'json',
      });
      setupConnection(conn);
    } catch (err) {
      console.warn('Failed connecting to peer:', targetPeerId, err);
    }
  }, []);

  // Setup connection event handlers
  const setupConnection = useCallback((conn: DataConnection) => {
    // 8-second watchdog for WebRTC data channel handshake
    const handshakeTimer = setTimeout(() => {
      if (!conn.open && !connectionsRef.current.has(conn.peer)) {
        console.warn('WebRTC data channel handshake timed out for:', conn.peer);
        try { conn.close(); } catch {}
      }
    }, 8000);

    const handleOpen = () => {
      clearTimeout(handshakeTimer);
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
        reconnectIntervalRef.current = null;
      }
      joinAttemptRef.current = 0;
      connectionsRef.current.set(conn.peer, conn);
      setIsConnected(true);
      setConnectionStatus('connected');
      setStatusMessage(`Connected with ${connectionsRef.current.size} rider(s)`);

      // Immediately send greeting identity so rider appears on HUD without waiting for GPS movement
      const myColor = getRiderColor(riderId);
      const activeName = riderNameRef.current || 'Rider';
      const activeIsHost = isHostRef.current;
      try {
        conn.send({
          type: 'GREETING',
          payload: {
            riderId,
            name: activeName,
            color: myColor,
            isHost: activeIsHost,
            location: myLocationRef.current ? {
              riderId,
              name: activeName,
              color: myColor,
              lat: myLocationRef.current.lat,
              lon: myLocationRef.current.lon,
              speedKmh: myLocationRef.current.speedKmh || 0,
              bearing: myLocationRef.current.bearing,
              timestamp: Date.now(),
              status: (myLocationRef.current.speedKmh || 0) < 2.0 ? 'stopped' : 'riding',
            } : undefined,
          },
        });
      } catch {}

      // If we are host, announce other peers to newly connected rider so all members mesh together
      if (activeIsHost) {
        const allPeerIds = Array.from(connectionsRef.current.keys()).concat(peerRef.current?.id || '');
        conn.send({ type: 'PEER_LIST', peers: allPeerIds });

        // Immediately send full crew state so new rider sees all riders and their positions with 0 waiting!
        const currentMembers = Array.from(membersRef.current.values());
        if (currentMembers.length > 0) {
          conn.send({
            type: 'CREW_SYNC',
            members: currentMembers,
          });
        }
      }
    };

    if (conn.open) {
      handleOpen();
    } else {
      conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
      handleIncomingData(data, conn.peer);
    });

    conn.on('close', () => {
      clearTimeout(handshakeTimer);
      const rId = peerToRiderMapRef.current.get(conn.peer);
      connectionsRef.current.delete(conn.peer);
      if (rId) {
        peerToRiderMapRef.current.delete(conn.peer);
        updateMembersState(prev => {
          if (!prev.has(rId)) return prev;
          const next = new Map(prev);
          next.delete(rId);
          return next;
        });
      }

      // Check if client lost connection to host / all peers
      if (!isHostRef.current && connectionsRef.current.size === 0) {
        setIsConnected(false);
        if (isManualLeaveRef.current || !activeRoomCodeRef.current) {
          setConnectionStatus('disconnected');
          setStatusMessage('Disconnected from group ride.');
        } else {
          // Cellular dropout detected — trigger silent auto-reconnect loop
          setConnectionStatus('connecting');
          setStatusMessage('Reconnecting to crew...');

          if (!reconnectIntervalRef.current) {
            let attempts = 0;
            reconnectIntervalRef.current = setInterval(() => {
              if (isManualLeaveRef.current || !activeRoomCodeRef.current || attempts >= 8) {
                if (reconnectIntervalRef.current) clearInterval(reconnectIntervalRef.current);
                reconnectIntervalRef.current = null;
                if (attempts >= 8) {
                  setConnectionStatus('disconnected');
                  setStatusMessage(`Could not reconnect to crew "${activeRoomCodeRef.current}". Tap to rejoin.`);
                }
                return;
              }
              attempts += 1;
              setStatusMessage(`Signal searching... Reconnecting (Attempt ${attempts}/8)...`);
              joinRoom(activeRoomCodeRef.current, riderNameRef.current);
            }, 5000);
          }
        }
      } else {
        setStatusMessage(`Connected with ${connectionsRef.current.size} rider(s)`);
      }
    });

    conn.on('error', (err) => {
      clearTimeout(handshakeTimer);
      console.warn('Connection error with peer:', conn.peer, err);
    });
  }, [handleIncomingData, riderId, updateMembersState]);

  // Join an existing Group Ride as a squad member
  const joinRoom = useCallback((code: string, name?: string) => {
    isManualLeaveRef.current = false;
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    const cleanCode = sanitizeCode(code);
    if (!cleanCode) {
      setStatusMessage('Please enter a valid 4-8 digit room code');
      return;
    }
    const cleanName = (name && name.trim()) || riderNameRef.current || generateRandomRiderName();
    setRiderName(cleanName);
    riderNameRef.current = cleanName;
    try {
      localStorage.setItem('sasta_rider_name', cleanName);
      localStorage.setItem('throttlelog_rider_name', cleanName);
      localStorage.setItem('sasta_last_crew', cleanCode);
    } catch {}

    setRoomCode(cleanCode);
    setLastRoomCode(cleanCode);
    activeRoomCodeRef.current = cleanCode;
    setIsHost(false);
    isHostRef.current = false;
    setConnectionStatus('connecting');
    setStatusMessage(`Connecting to squad "${cleanCode}"...`);

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    joinAttemptRef.current = 0;

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }

    // Unique random session suffix guarantees zero ID collisions or socket locks on 0.peerjs.com
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const myPeerId = `sasta-${cleanCode}-${riderId}-${randomSuffix}`;
    const hostPeerId = `sasta-${cleanCode}-host`;

    const peer = new Peer(myPeerId, {
      config: {
        iceServers: ICE_SERVERS,
      },
    });

    const attemptHostConnection = () => {
      if (!peer || peer.destroyed || isManualLeaveRef.current) return;
      try {
        const conn = peer.connect(hostPeerId, {
          reliable: true,
          serialization: 'json',
        });
        setupConnection(conn);
      } catch (e) {
        console.warn('Error connecting to host peer:', e);
      }
    };

    peer.on('open', () => {
      setStatusMessage(`Locating squad leader for "${cleanCode}"...`);
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
      console.warn('Peer error during join:', err.type, err);
      if (err.type === 'peer-unavailable') {
        // Host peer was not found on signaling server
        if (joinAttemptRef.current < 3 && !isManualLeaveRef.current && activeRoomCodeRef.current === cleanCode) {
          joinAttemptRef.current += 1;
          setStatusMessage(`Locating squad leader... (Attempt ${joinAttemptRef.current}/3)`);
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = setTimeout(() => {
            attemptHostConnection();
          }, 1500);
        } else {
          setConnectionStatus('error');
          setStatusMessage(`Squad leader for "${cleanCode}" not found yet. The leader might not have started the ride.`);
        }
      } else if (err.type === 'unavailable-id') {
        // ID taken on signaling server, retry with a fresh session ID
        if (!isManualLeaveRef.current && activeRoomCodeRef.current === cleanCode) {
          setTimeout(() => {
            joinRoom(cleanCode, cleanName);
          }, 300);
        }
      } else {
        setConnectionStatus('error');
        setStatusMessage(err.message || 'Connection error. Check cellular network.');
      }
    });

    peerRef.current = peer;
  }, [riderId, setupConnection]);

  // Create a new Group Ride as Host
  const createRoom = useCallback((name: string, customCode?: string) => {
    isManualLeaveRef.current = false;
    hasSwitchedFromHostRef.current = false;
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    const cleanName = name.trim() || generateRandomRiderName();
    setRiderName(cleanName);
    riderNameRef.current = cleanName;
    try {
      localStorage.setItem('sasta_rider_name', cleanName);
      localStorage.setItem('throttlelog_rider_name', cleanName);
    } catch {}

    const sanitized = customCode ? sanitizeCode(customCode) : '';
    const generated = sanitized || ('RIDE' + Math.floor(1000 + Math.random() * 9000));
    
    setRoomCode(generated);
    setLastRoomCode(generated);
    activeRoomCodeRef.current = generated;
    try {
      localStorage.setItem('sasta_last_crew', generated);
    } catch {}
    setIsHost(true);
    isHostRef.current = true;
    setConnectionStatus('connecting');
    setStatusMessage(`Starting squad room "${generated}"...`);

    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    joinAttemptRef.current = 0;

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
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
      setStatusMessage(`Squad "${generated}" active. Transmitting radar...`);
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
        // Someone is ALREADY hosting this exact squad code!
        // Seamlessly switch to client mode and join the existing leader
        if (!hasSwitchedFromHostRef.current) {
          hasSwitchedFromHostRef.current = true;
          console.log(`Squad "${generated}" is already hosted. Joining leader...`);
          setStatusMessage(`Squad "${generated}" is already active! Joining crew leader...`);
          try { peer.destroy(); } catch {}
          peerRef.current = null;
          setTimeout(() => {
            if (!isManualLeaveRef.current) {
              joinRoom(generated, cleanName);
            }
          }, 200);
        }
      } else {
        setConnectionStatus('error');
        setStatusMessage(err.message || 'Peer connection error');
      }
    });

    peerRef.current = peer;
  }, [setupConnection, joinRoom]);

  // Rejoin the last room
  const rejoinRoom = useCallback(() => {
    const targetCode = activeRoomCodeRef.current || lastRoomCode;
    if (targetCode) {
      joinRoom(targetCode, riderNameRef.current);
    }
  }, [lastRoomCode, joinRoom]);

  // Update rider's callsign / name on the fly and notify all peers
  const updateRiderName = useCallback((newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setRiderName(clean);
    riderNameRef.current = clean;
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
    isManualLeaveRef.current = true;
    activeRoomCodeRef.current = '';
    joinAttemptRef.current = 0;
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    try {
      if (isHostRef.current) {
        broadcastMessage({
          type: 'HOST_CLOSED',
          riderId,
          riderName: riderNameRef.current,
        });
      } else {
        broadcastMessage({ type: 'LEAVE', riderId });
      }
    } catch {}
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    connectionsRef.current.clear();
    peerToRiderMapRef.current.clear();
    updateMembersState(() => new Map());
    setIsConnected(false);
    setIsHost(false);
    isHostRef.current = false;
    setRoomCode('');
    setConnectionStatus('disconnected');
    setStatusMessage('');
    setSosAlert(null);
  }, [broadcastMessage, riderId, updateMembersState]);

  // Update my current GPS location and broadcast to crew
  const updateMyLocation = useCallback((
    lat: number,
    lon: number,
    speedKmh: number,
    bearing: number | null
  ) => {
    myLocationRef.current = { lat, lon, speedKmh, bearing };

    // Update distances to members on local radar when my location updates
    updateMembersState(prev => {
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
      name: riderNameRef.current || 'Rider',
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
  }, [isConnected, riderId, broadcastMessage, updateMembersState]);

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

  // 3.5-second continuous location broadcast & keep-alive
  // Guarantees all peers receive live coordinates even if watchPosition is stationary
  useEffect(() => {
    if (!isConnected) return;
    const heartbeatInterval = setInterval(() => {
      if (myLocationRef.current) {
        const myColor = getRiderColor(riderId);
        const speed = myLocationRef.current.speedKmh || 0;
        broadcastMessage({
          type: 'LOCATION_UPDATE',
          payload: {
            riderId,
            name: riderNameRef.current || 'Rider',
            color: myColor,
            lat: myLocationRef.current.lat,
            lon: myLocationRef.current.lon,
            speedKmh: speed,
            bearing: myLocationRef.current.bearing,
            timestamp: Date.now(),
            status: speed < 2.0 ? 'stopped' : 'riding',
          },
        });
      } else {
        broadcastMessage({
          type: 'HEARTBEAT',
          riderId,
          timestamp: Date.now(),
        });
      }
    }, 3500);
    return () => clearInterval(heartbeatInterval);
  }, [isConnected, riderId, broadcastMessage]);

  // Periodic cleanup of stale riders (marked weak >25s, removed >60s)
  useEffect(() => {
    if (!isConnected) return;
    const cleanupInterval = setInterval(() => {
      updateMembersState(prev => {
        let changed = false;
        const now = Date.now();
        const next = new Map(prev);
        prev.forEach((info, id) => {
          const age = now - info.lastSeen;
          if (age > 60000) {
            next.delete(id);
            changed = true;
          } else if (age > 25000 && !info.isStale) {
            next.set(id, { ...info, isStale: true });
            changed = true;
          } else if (age <= 25000 && info.isStale) {
            next.set(id, { ...info, isStale: false });
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(cleanupInterval);
  }, [isConnected, updateMembersState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  return {
    roomCode,
    lastRoomCode,
    riderName,
    riderId,
    myColor: getRiderColor(riderId),
    isHost,
    isConnected,
    connectionStatus,
    statusMessage,
    members: Array.from(members.values()),
    sosAlert,
    crewNotification,
    createRoom,
    joinRoom,
    rejoinRoom,
    leaveRoom,
    updateMyLocation,
    triggerSos,
    dismissSos: () => setSosAlert(null),
    dismissCrewNotification: () => setCrewNotification(null),
    updateRiderName,
  };
}

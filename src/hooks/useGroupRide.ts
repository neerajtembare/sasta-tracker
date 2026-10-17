import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { haversineDistance } from '../utils/gpxParser';
import { playWaypointChime, playWarningChime } from '../utils/audioChimes';
import { getSavedIdentity, saveIdentity } from '../utils/cookieStorage';

export interface GroupRiderLocation {
  riderId: string;
  name: string;
  color: string;
  bikeModel?: string;
  lat: number;
  lon: number;
  speedKmh: number;
  bearing: number | null;
  leanAngle?: number;
  timestamp: number;
  status: 'riding' | 'stopped' | 'sos';
  batteryPct?: number;
}

export interface GroupMemberInfo {
  riderId: string;
  name: string;
  color: string;
  bikeModel?: string;
  isHost: boolean;
  lastSeen: number;
  location?: GroupRiderLocation;
  distanceFromMeMeters?: number;
  isStale?: boolean;
  isOnline?: boolean;
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

export interface RiderProfile {
  id: string;
  name: string;
  bikeModel?: string;
  color: string;
  squadName: string;
  isLoggedIn: boolean;
}

export interface FriendEntry {
  id: string;
  name: string;
  bikeModel?: string;
  color: string;
}

export const MOTORCYCLE_CALLSIGNS = [
  'Neeraj', 'Rahul', 'Sam', 'Sid', 'Aryan',
  'GhostRider', 'ThunderRider', 'ApexRider', 'NightHawk', 'Maverick'
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
  if (!id) return RIDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
  }
  const idx = Math.abs(hash) % RIDER_COLORS.length;
  return RIDER_COLORS[idx];
}

export const DEFAULT_SQUAD_NAME = 'Sunday Morning Crew';

const STORAGE_KEYS = {
  USER_PROFILE: 'sasta_rider_profile_v3',
  ROSTER_CACHE: 'sasta_crew_roster_cache_v3',
  CUSTOM_FRIENDS: 'sasta_custom_friends_v3',
  SQUAD_NAME: 'sasta_crew_squad_name_v3',
};

// Seed default known crew friends for instant zero-wait friend radar
export const DEFAULT_KNOWN_MEMBERS: FriendEntry[] = [
  { id: 'neeraj', name: 'Neeraj', bikeModel: 'KTM Duke 390', color: '#00f0ff' },
  { id: 'rahul', name: 'Rahul', bikeModel: 'Continental GT 650', color: '#ffe600' },
  { id: 'sam', name: 'Sam', bikeModel: 'Triumph Speed 400', color: '#ff3366' },
];

function sanitizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
];

export function useGroupRide() {
  // 1. Persistent Rider Identity Dual-Loaded from Cookies + LocalStorage + URL Params
  const [profile, setProfile] = useState<RiderProfile>(() => {
    try {
      // Priority 1: Check URL search params for 1-tap friend invite (e.g. ?rider=Rahul)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const riderParam = params.get('rider') || params.get('name') || params.get('who');
        const squadParam = params.get('squad') || params.get('crew') || params.get('room');
        
        if (riderParam && riderParam.trim()) {
          const cleanName = riderParam.trim();
          const cleanId = sanitizeKey(cleanName) || 'rider';
          // Find matching bike if known
          const matched = DEFAULT_KNOWN_MEMBERS.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
          const newProfile: RiderProfile = {
            id: cleanId,
            name: cleanName,
            bikeModel: matched?.bikeModel || 'Motorcycle',
            color: matched?.color || getRiderColor(cleanId),
            squadName: squadParam?.trim() || DEFAULT_SQUAD_NAME,
            isLoggedIn: true,
          };
          saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
          saveIdentity('sasta_rider_name', cleanName);
          // Clean URL param without page reload
          try {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete('rider');
            cleanUrl.searchParams.delete('name');
            cleanUrl.searchParams.delete('who');
            window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
          } catch {}
          return newProfile;
        }
      }

      // Priority 2: Persistent Cookie / LocalStorage
      const savedRaw = getSavedIdentity(STORAGE_KEYS.USER_PROFILE);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.name && parsed.id) return parsed;
      }

      // Priority 3: Legacy rider name
      const legacyName = getSavedIdentity('sasta_rider_name') || 'Neeraj';
      const cleanId = sanitizeKey(legacyName) || 'neeraj';
      const matched = DEFAULT_KNOWN_MEMBERS.find(m => m.name.toLowerCase() === legacyName.toLowerCase());
      const fallbackProfile: RiderProfile = {
        id: cleanId,
        name: legacyName,
        bikeModel: matched?.bikeModel || 'KTM Duke 390',
        color: matched?.color || getRiderColor(cleanId),
        squadName: DEFAULT_SQUAD_NAME,
        isLoggedIn: true,
      };
      saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(fallbackProfile));
      return fallbackProfile;
    } catch {
      return {
        id: 'neeraj',
        name: 'Neeraj',
        bikeModel: 'KTM Duke 390',
        color: '#00f0ff',
        squadName: DEFAULT_SQUAD_NAME,
        isLoggedIn: true,
      };
    }
  });

  // 2. Custom Friends List (saved to cookies + localStorage)
  const [customFriends, setCustomFriends] = useState<FriendEntry[]>(() => {
    try {
      const raw = getSavedIdentity(STORAGE_KEYS.CUSTOM_FRIENDS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Combined squad members list (default friends + custom friends)
  const getAllSquadFriends = useCallback((): FriendEntry[] => {
    const list = [...DEFAULT_KNOWN_MEMBERS];
    customFriends.forEach(cf => {
      if (!list.some(m => m.id === cf.id)) {
        list.push(cf);
      }
    });
    return list;
  }, [customFriends]);

  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('connected');
  const [statusMessage, setStatusMessage] = useState<string>('Crew Radar Active • All friends auto-connected');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // 3. Crew Members Map (Pre-seeded with all squad friends so map is NEVER empty!)
  const [members, setMembers] = useState<Map<string, GroupMemberInfo>>(() => {
    const map = new Map<string, GroupMemberInfo>();
    
    // Seed from persistent cache if available
    try {
      const raw = getSavedIdentity(STORAGE_KEYS.ROSTER_CACHE);
      if (raw) {
        const parsed: GroupMemberInfo[] = JSON.parse(raw);
        parsed.forEach(m => {
          if (m && m.riderId && m.riderId !== profile.id) {
            map.set(m.riderId, { ...m, isOnline: false, isStale: true });
          }
        });
      }
    } catch {}

    // Ensure all default friends are visible
    DEFAULT_KNOWN_MEMBERS.forEach(def => {
      if (def.id !== profile.id && !map.has(def.id)) {
        map.set(def.id, {
          riderId: def.id,
          name: def.name,
          color: def.color,
          bikeModel: def.bikeModel,
          isHost: false,
          lastSeen: Date.now() - 3600000,
          isOnline: false,
          isStale: true,
        });
      }
    });

    return map;
  });

  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);
  const [crewNotification, setCrewNotification] = useState<CrewNotification | null>(null);

  // References
  const profileRef = useRef<RiderProfile>(profile);
  profileRef.current = profile;

  const membersRef = useRef<Map<string, GroupMemberInfo>>(members);
  membersRef.current = members;

  const myLocationRef = useRef<{ lat: number; lon: number; speedKmh: number; bearing: number | null; leanAngle?: number } | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const discoveryIntervalRef = useRef<any>(null);
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

  // Update members state and persist cache to Cookie & LocalStorage
  const updateMembersState = useCallback((updater: (prev: Map<string, GroupMemberInfo>) => Map<string, GroupMemberInfo>) => {
    setMembers(prev => {
      const next = updater(prev);
      membersRef.current = next;
      try {
        const arr = Array.from(next.values());
        saveIdentity(STORAGE_KEYS.ROSTER_CACHE, JSON.stringify(arr));
      } catch {}
      return next;
    });
  }, []);

  // Broadcast payload across all channels (WebRTC peers + BroadcastChannel)
  const broadcastPayload = useCallback((payload: any) => {
    // 1. Cross-tab BroadcastChannel (instant 0ms sync for same browser or dual testing)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(payload);
      } catch {}
    }

    // 2. WebRTC P2P DataChannels
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch {}
      }
    });
  }, []);

  // Handle incoming data message from any transport
  const handleIncomingMessage = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;
    const currentMyId = profileRef.current.id;

    if (data.type === 'LOCATION' || data.type === 'HEARTBEAT') {
      const loc: GroupRiderLocation = data.payload;
      if (loc && loc.riderId && loc.riderId !== currentMyId) {
        updateMembersState(prev => {
          const isPreviouslyOffline = !prev.has(loc.riderId) || !prev.get(loc.riderId)?.isOnline;
          if (isPreviouslyOffline) {
            playWaypointChime();
            postCrewNotification(`🏍️ ${loc.name || 'Friend'} joined the Crew Radar!`, 'join');
          }

          const next = new Map(prev);
          const existing = next.get(loc.riderId);
          let dist: number | undefined = undefined;
          if (myLocationRef.current && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
            dist = haversineDistance(
              myLocationRef.current.lat,
              myLocationRef.current.lon,
              loc.lat,
              loc.lon
            );
          }

          const hasValidCoords = typeof loc.lat === 'number' && typeof loc.lon === 'number';

          next.set(loc.riderId, {
            riderId: loc.riderId,
            name: loc.name || existing?.name || 'Rider',
            color: loc.color || existing?.color || getRiderColor(loc.riderId),
            bikeModel: loc.bikeModel || existing?.bikeModel,
            isHost: false,
            lastSeen: Date.now(),
            location: hasValidCoords ? {
              ...loc,
              color: loc.color || existing?.color || getRiderColor(loc.riderId),
            } : existing?.location,
            distanceFromMeMeters: dist ?? existing?.distanceFromMeMeters,
            isStale: false,
            isOnline: true,
          });
          return next;
        });
      }
    } else if (data.type === 'SOS_PING') {
      const alert: SosAlert = data.payload;
      setSosAlert(alert);
      playWarningChime();
      postCrewNotification(`🚨 REGROUP ALERT from ${alert.fromName}!`, 'alert');
    }
  }, [postCrewNotification, updateMembersState]);

  // Setup BroadcastChannel for instant same-browser / pair testing
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const squadKey = sanitizeKey(profile.squadName);
    const channel = new BroadcastChannel(`sasta_crew_${squadKey}`);
    channel.onmessage = (event) => {
      handleIncomingMessage(event.data);
    };
    broadcastChannelRef.current = channel;

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [profile.squadName, handleIncomingMessage]);

  // ─── P2P Mesh Auto-Connect Engine ────────────────────────────────
  const connectToPeer = useCallback((targetPeerId: string) => {
    if (!peerRef.current || peerRef.current.destroyed || peerRef.current.disconnected) return;
    if (connectionsRef.current.has(targetPeerId)) {
      const existing = connectionsRef.current.get(targetPeerId);
      if (existing && existing.open) return;
    }

    try {
      const conn = peerRef.current.connect(targetPeerId, {
        reliable: true,
        serialization: 'json',
      });

      conn.on('open', () => {
        connectionsRef.current.set(targetPeerId, conn);
        setIsConnected(true);
        setConnectionStatus('connected');
        setStatusMessage(`Crew Radar Connected • ${connectionsRef.current.size} squad mate(s) live`);

        // Send presence greeting immediately upon connection
        const greetingPayload: any = {
          riderId: profileRef.current.id,
          name: profileRef.current.name,
          color: profileRef.current.color,
          bikeModel: profileRef.current.bikeModel,
          timestamp: Date.now(),
          status: 'stopped',
        };
        if (myLocationRef.current) {
          Object.assign(greetingPayload, myLocationRef.current);
          greetingPayload.status = (myLocationRef.current.speedKmh || 0) < 2.0 ? 'stopped' : 'riding';
        }
        conn.send({
          type: myLocationRef.current ? 'LOCATION' : 'HEARTBEAT',
          payload: greetingPayload,
        });
      });

      conn.on('data', (data) => {
        handleIncomingMessage(data);
      });

      conn.on('close', () => {
        connectionsRef.current.delete(targetPeerId);
      });

      conn.on('error', () => {
        connectionsRef.current.delete(targetPeerId);
      });
    } catch {
      // transient connection attempt
    }
  }, [handleIncomingMessage]);

  // Initialize PeerJS mesh
  useEffect(() => {
    if (!profile.isLoggedIn) return;

    const squadKey = sanitizeKey(profile.squadName);
    const riderKey = sanitizeKey(profile.id);
    const myPeerId = `sasta_${squadKey}_${riderKey}`;

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }

    const peer = new Peer(myPeerId, {
      config: { iceServers: ICE_SERVERS },
    });

    peer.on('open', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setStatusMessage('Crew Radar Active • All friends auto-connected');

      // Auto-connect to ALL other squad members (both default friends and custom additions)
      const friends = getAllSquadFriends();
      friends.forEach(m => {
        if (m.id !== profile.id) {
          const targetPeerId = `sasta_${squadKey}_${m.id}`;
          connectToPeer(targetPeerId);
        }
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        connectionsRef.current.set(conn.peer, conn);
        setIsConnected(true);
        setConnectionStatus('connected');

        // Greet back with current location or presence heartbeat
        const greetingPayload: any = {
          riderId: profileRef.current.id,
          name: profileRef.current.name,
          color: profileRef.current.color,
          bikeModel: profileRef.current.bikeModel,
          timestamp: Date.now(),
          status: 'stopped',
        };
        if (myLocationRef.current) {
          Object.assign(greetingPayload, myLocationRef.current);
          greetingPayload.status = (myLocationRef.current.speedKmh || 0) < 2.0 ? 'stopped' : 'riding';
        }
        conn.send({
          type: myLocationRef.current ? 'LOCATION' : 'HEARTBEAT',
          payload: greetingPayload,
        });
      });

      conn.on('data', (data) => {
        handleIncomingMessage(data);
      });

      conn.on('close', () => {
        connectionsRef.current.delete(conn.peer);
      });
    });

    peer.on('disconnected', () => {
      try { peer.reconnect(); } catch {}
    });

    peer.on('error', (err) => {
      console.warn('Crew peer warning:', err);
    });

    peerRef.current = peer;

    // Periodic discovery loop: try reconnecting to offline members every 8s
    discoveryIntervalRef.current = setInterval(() => {
      if (!peer || peer.destroyed || peer.disconnected) return;
      const friends = getAllSquadFriends();
      friends.forEach(m => {
        if (m.id !== profile.id && !connectionsRef.current.has(`sasta_${squadKey}_${m.id}`)) {
          connectToPeer(`sasta_${squadKey}_${m.id}`);
        }
      });
    }, 8000);

    return () => {
      if (discoveryIntervalRef.current) clearInterval(discoveryIntervalRef.current);
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch {}
        peerRef.current = null;
      }
    };
  }, [profile.isLoggedIn, profile.id, profile.squadName, connectToPeer, getAllSquadFriends, handleIncomingMessage]);

  // Auto-reconnect when phone unlocks, browser tab wakes from background, or network reconnects
  useEffect(() => {
    if (!profile.isLoggedIn) return;

    const handleWakeup = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      
      // 1. If PeerJS disconnected from broker, reconnect immediately
      if (peerRef.current && peerRef.current.disconnected && !peerRef.current.destroyed) {
        try {
          peerRef.current.reconnect();
        } catch {}
      }

      // 2. Re-dial any squad peers that aren't open
      const squadKey = sanitizeKey(profileRef.current.squadName);
      const friends = getAllSquadFriends();
      friends.forEach(m => {
        if (m.id !== profileRef.current.id) {
          const targetId = `sasta_${squadKey}_${m.id}`;
          const existingConn = connectionsRef.current.get(targetId);
          if (!existingConn || !existingConn.open) {
            connectToPeer(targetId);
          }
        }
      });
    };

    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('online', handleWakeup);
    window.addEventListener('focus', handleWakeup);

    return () => {
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('online', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
    };
  }, [profile.isLoggedIn, connectToPeer, getAllSquadFriends]);

  // ── Background Execution Keeper (Survives switching to Google Maps & Lock Screen) ──
  // Inaudible audio loop that tricks mobile browsers (iOS WebKit & Android Chrome)
  // into keeping background geolocation & JS peer mesh timers active when Google Maps is open.
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!profile.isLoggedIn || !isConnected) {
      if (silentAudioRef.current) {
        try { silentAudioRef.current.pause(); } catch {}
        silentAudioRef.current = null;
      }
      return;
    }

    const startSilentKeeper = () => {
      if (typeof Audio === 'undefined') return;
      try {
        if (!silentAudioRef.current) {
          const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
          audio.loop = true;
          audio.volume = 0.01;
          silentAudioRef.current = audio;
        }
        silentAudioRef.current.play().catch(() => {});
      } catch {}
    };

    startSilentKeeper();
    const handleUserTouch = () => {
      startSilentKeeper();
      window.removeEventListener('click', handleUserTouch);
      window.removeEventListener('touchstart', handleUserTouch);
    };
    window.addEventListener('click', handleUserTouch, { once: true });
    window.addEventListener('touchstart', handleUserTouch, { once: true });

    return () => {
      window.removeEventListener('click', handleUserTouch);
      window.removeEventListener('touchstart', handleUserTouch);
      if (silentAudioRef.current) {
        try { silentAudioRef.current.pause(); } catch {}
        silentAudioRef.current = null;
      }
    };
  }, [profile.isLoggedIn, isConnected]);

  // Periodic heartbeat / location broadcast every 3 seconds (ensures instant online presence)
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (!profile.isLoggedIn) return;
      const payload: any = {
        riderId: profile.id,
        name: profile.name,
        color: profile.color,
        bikeModel: profile.bikeModel,
        timestamp: Date.now(),
        status: 'stopped',
      };
      if (myLocationRef.current) {
        Object.assign(payload, myLocationRef.current);
        payload.status = (myLocationRef.current.speedKmh || 0) < 2.5 ? 'stopped' : 'riding';
      }
      broadcastPayload({
        type: myLocationRef.current ? 'LOCATION' : 'HEARTBEAT',
        payload,
      });
    }, 3000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [profile, broadcastPayload]);

  // Age out stale / offline members every 5 seconds
  useEffect(() => {
    const ageInterval = setInterval(() => {
      const now = Date.now();
      updateMembersState(prev => {
        let changed = false;
        const next = new Map(prev);
        prev.forEach((info, id) => {
          const age = now - info.lastSeen;
          const isOffline = age > 90000; // > 1.5 minutes without heartbeat
          const isStale = age > 25000;   // > 25s without heartbeat

          if (info.isOnline && isOffline) {
            next.set(id, { ...info, isOnline: false, isStale: true });
            changed = true;
          } else if (info.isOnline && isStale && !info.isStale) {
            next.set(id, { ...info, isStale: true });
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);

    return () => clearInterval(ageInterval);
  }, [updateMembersState]);

  // Public Methods
  const updateMyLocation = useCallback((lat: number, lon: number, speedKmh: number, bearing: number | null, leanAngle?: number) => {
    myLocationRef.current = { lat, lon, speedKmh, bearing, leanAngle };

    // Broadcast immediately upon position update
    broadcastPayload({
      type: 'LOCATION',
      payload: {
        riderId: profileRef.current.id,
        name: profileRef.current.name,
        color: profileRef.current.color,
        bikeModel: profileRef.current.bikeModel,
        lat,
        lon,
        speedKmh,
        bearing,
        leanAngle,
        timestamp: Date.now(),
        status: speedKmh < 2.5 ? 'stopped' : 'riding',
      },
    });
  }, [broadcastPayload]);

  const triggerSos = useCallback(() => {
    const loc = myLocationRef.current;
    if (!loc) return;
    const alert: SosAlert = {
      fromName: profile.name,
      lat: loc.lat,
      lon: loc.lon,
      timestamp: Date.now(),
    };
    setSosAlert(alert);
    broadcastPayload({
      type: 'SOS_PING',
      payload: alert,
    });
    playWarningChime();
    postCrewNotification(`🚨 You broadcast an EMERGENCY REGROUP alert!`, 'alert');
  }, [profile.name, broadcastPayload, postCrewNotification]);

  // Switch rider callsign / bike with dual-storage persistence
  const loginRider = useCallback((name: string, bikeModel?: string, color?: string, squadName?: string) => {
    const cleanName = (name && name.trim()) || 'Rider';
    const cleanId = sanitizeKey(cleanName) || 'rider_' + Date.now();
    const matched = DEFAULT_KNOWN_MEMBERS.find(m => m.name.toLowerCase() === cleanName.toLowerCase());
    
    const newProfile: RiderProfile = {
      id: cleanId,
      name: cleanName,
      bikeModel: bikeModel || matched?.bikeModel || 'Motorcycle',
      color: color || matched?.color || getRiderColor(cleanId),
      squadName: squadName || DEFAULT_SQUAD_NAME,
      isLoggedIn: true,
    };
    setProfile(newProfile);
    
    // Save to both persistent Cookie and LocalStorage
    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
    saveIdentity('sasta_rider_name', cleanName);
    
    postCrewNotification(`👋 Checked in as ${cleanName}! Live on Crew Radar.`, 'join');
  }, [postCrewNotification]);

  const logoutRider = useCallback(() => {
    setProfile(prev => ({ ...prev, isLoggedIn: false }));
    const updated = { ...profile, isLoggedIn: false };
    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
    setMembers(new Map());
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setStatusMessage('Logged out. Check in to rejoin crew radar.');
  }, [profile]);

  const updateRiderName = useCallback((newName: string) => {
    if (!newName.trim()) return;
    loginRider(newName.trim(), profile.bikeModel, profile.color, profile.squadName);
  }, [loginRider, profile.bikeModel, profile.color, profile.squadName]);

  // Add a new friend to the squad roster & auto-connect
  const addSquadFriend = useCallback((name: string, bikeModel?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanId = sanitizeKey(cleanName) || 'friend_' + Date.now();
    const newFriend: FriendEntry = {
      id: cleanId,
      name: cleanName,
      bikeModel: bikeModel || 'Motorcycle',
      color: getRiderColor(cleanId),
    };

    setCustomFriends(prev => {
      const next = [...prev.filter(f => f.id !== cleanId), newFriend];
      saveIdentity(STORAGE_KEYS.CUSTOM_FRIENDS, JSON.stringify(next));
      return next;
    });

    // Add to members map immediately
    updateMembersState(prev => {
      const next = new Map(prev);
      if (!next.has(cleanId)) {
        next.set(cleanId, {
          riderId: cleanId,
          name: cleanName,
          color: newFriend.color,
          bikeModel: newFriend.bikeModel,
          isHost: false,
          lastSeen: Date.now() - 3600000,
          isOnline: false,
          isStale: true,
        });
      }
      return next;
    });

    postCrewNotification(`Added ${cleanName} to squad roster!`, 'info');

    // Attempt connecting to friend immediately
    if (peerRef.current && !peerRef.current.disconnected) {
      const squadKey = sanitizeKey(profileRef.current.squadName);
      connectToPeer(`sasta_${squadKey}_${cleanId}`);
    }
  }, [connectToPeer, postCrewNotification, updateMembersState]);

  // Generate personalized WhatsApp invite link (so friend opens app and is instantly connected without typing)
  const getFriendInviteUrl = useCallback((friendName?: string) => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    if (friendName) {
      return `${base}?rider=${encodeURIComponent(friendName)}`;
    }
    return base;
  }, []);

  const membersArray = useMemo(() => Array.from(members.values()), [members]);
  const squadFriendsArray = useMemo(() => getAllSquadFriends(), [getAllSquadFriends]);

  return {
    profile,
    loginRider,
    logoutRider,
    roomCode: profile.squadName,
    lastRoomCode: profile.squadName,
    riderName: profile.name,
    riderId: profile.id,
    myColor: profile.color,
    bikeModel: profile.bikeModel,
    isHost: false,
    isConnected,
    connectionStatus,
    statusMessage,
    members: membersArray,
    squadFriends: squadFriendsArray,
    addSquadFriend,
    getFriendInviteUrl,
    sosAlert,
    crewNotification,
    updateMyLocation,
    triggerSos,
    dismissSos: () => setSosAlert(null),
    dismissCrewNotification: () => setCrewNotification(null),
    updateRiderName,
    // Backwards compatibility stubs for UI components
    createRoom: (name: string) => loginRider(name),
    joinRoom: (code: string, name?: string) => loginRider(name || profile.name, undefined, undefined, code),
    rejoinRoom: () => loginRider(profile.name),
    leaveRoom: logoutRider,
  };
}

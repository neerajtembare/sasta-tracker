import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haversineDistance } from '../utils/gpxParser';
import { 
  playWaypointChime, 
  playWarningChime, 
  playSosChime, 
  playRouteSharedChime, 
  playRadarJoinChime 
} from '../utils/audioChimes';
import { getSavedIdentity, saveIdentity } from '../utils/cookieStorage';
import { SimpleMqttClient, MqttConnectionStatus } from '../utils/mqttClient';
import { playVoiceBlastAudio } from '../utils/voiceBlast';

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

export interface SharedRouteInfo {
  riderId: string;
  riderName: string;
  routeName: string;
  distanceKm: number;
  destination: { lat: number; lon: number };
  points?: Array<{ lat: number; lon: number }>;
  timestamp: number;
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
  sharedRoute?: SharedRouteInfo;
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

export interface VoiceBlastPayload {
  riderId: string;
  riderName: string;
  bikeModel?: string;
  color?: string;
  audioBase64: string;
  durationMs: number;
  mimeType?: string;
  timestamp: number;
}

export interface ActiveVoiceBlast {
  riderId: string;
  riderName: string;
  bikeModel?: string;
  color?: string;
  durationMs: number;
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

export const DEFAULT_SQUAD_NAME = 'Global Crew';

const STORAGE_KEYS = {
  USER_PROFILE: 'sasta_rider_profile_v4',
  CUSTOM_FRIENDS: 'sasta_custom_friends_v4',
};

export const DEFAULT_KNOWN_MEMBERS: FriendEntry[] = [];

function sanitizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
}

function generateUniqueRiderId(namePrefix: string = 'rider'): string {
  const prefix = sanitizeKey(namePrefix) || 'rider';
  const rand = Math.random().toString(36).substring(2, 7);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${rand}${time}`;
}

export function useGroupRide() {
  // 1. Persistent Unique Rider Identity (loaded from Cookie/LocalStorage/URL)
  const [profile, setProfile] = useState<RiderProfile>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const riderParam = params.get('rider') || params.get('name') || params.get('who');
        const squadParam = params.get('squad') || params.get('crew') || params.get('room');

        if (riderParam && riderParam.trim()) {
          const cleanName = riderParam.trim();
          const cleanId = generateUniqueRiderId(cleanName);
          const newProfile: RiderProfile = {
            id: cleanId,
            name: cleanName,
            bikeModel: 'Motorcycle',
            color: getRiderColor(cleanId),
            squadName: squadParam?.trim() || DEFAULT_SQUAD_NAME,
            isLoggedIn: true,
          };
          saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
          saveIdentity('sasta_rider_name', cleanName);
          return newProfile;
        }
      }

      const savedRaw = getSavedIdentity(STORAGE_KEYS.USER_PROFILE);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed.name && parsed.id) return parsed;
      }

      // Default name or clean generic Rider identity
      const legacyName = getSavedIdentity('sasta_rider_name') || 'Rider';
      const cleanId = generateUniqueRiderId(legacyName);
      const fallback: RiderProfile = {
        id: cleanId,
        name: legacyName,
        bikeModel: 'Motorcycle',
        color: getRiderColor(cleanId),
        squadName: DEFAULT_SQUAD_NAME,
        isLoggedIn: true,
      };
      saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(fallback));
      return fallback;
    } catch {
      const fallbackId = generateUniqueRiderId('rider');
      return {
        id: fallbackId,
        name: 'Rider',
        bikeModel: 'Motorcycle',
        color: '#00f0ff',
        squadName: DEFAULT_SQUAD_NAME,
        isLoggedIn: true,
      };
    }
  });

  // 2. Custom Friends List
  const [customFriends, setCustomFriends] = useState<FriendEntry[]>(() => {
    try {
      const raw = getSavedIdentity(STORAGE_KEYS.CUSTOM_FRIENDS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const getAllSquadFriends = useCallback((): FriendEntry[] => {
    return [...customFriends];
  }, [customFriends]);

  const [isOnRadar, setIsOnRadar] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('sasta_on_radar');
        return saved !== 'false';
      }
    } catch {}
    return true;
  });
  const isOnRadarRef = useRef(isOnRadar);
  isOnRadarRef.current = isOnRadar;

  const [connectionStatus, setConnectionStatus] = useState<MqttConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to Global Crew Radar...');
  const [isConnected, setIsConnected] = useState<boolean>(true);

  // 3. Live Crew Members Map (populated exclusively by real live rider signals)
  const [members, setMembers] = useState<Map<string, GroupMemberInfo>>(new Map());
  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);
  const [crewNotification, setCrewNotification] = useState<CrewNotification | null>(null);
  const [activeVoiceBlast, setActiveVoiceBlast] = useState<ActiveVoiceBlast | null>(null);
  const voiceBlastTimeoutRef = useRef<any>(null);

  // References
  const profileRef = useRef<RiderProfile>(profile);
  profileRef.current = profile;

  const membersRef = useRef<Map<string, GroupMemberInfo>>(members);
  membersRef.current = members;

  const myLocationRef = useRef<{ lat: number; lon: number; speedKmh: number; bearing: number | null; leanAngle?: number } | null>(null);
  const mqttClientRef = useRef<SimpleMqttClient | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const lastLocationBroadcastTimeRef = useRef<number>(0);

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

  // Handle incoming data message from MQTT relay or local BroadcastChannel
  const handleIncomingMessage = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;
    const currentMyId = profileRef.current.id;

    if (data.type === 'LOCATION' || data.type === 'HEARTBEAT') {
      const loc: GroupRiderLocation = data.payload;
      if (!loc || !loc.riderId || loc.riderId === currentMyId) return;

      setMembers(prev => {
        const next = new Map(prev);
        const existing = next.get(loc.riderId);
        const isPreviouslyOffline = !existing || !existing.isOnline;

        if (isPreviouslyOffline) {
          playRadarJoinChime();
          postCrewNotification(`🏍️ ${loc.name || 'Rider'} joined the Crew Radar!`, 'join');
        }

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
          sharedRoute: existing?.sharedRoute,
        });

        membersRef.current = next;
        return next;
      });
    } else if (data.type === 'ROUTE_SHARE') {
      const share: SharedRouteInfo = data.payload;
      if (share && share.riderId && share.riderId !== currentMyId) {
        setMembers(prev => {
          const next = new Map(prev);
          const current = next.get(share.riderId);
          if (current) {
            next.set(share.riderId, {
              ...current,
              sharedRoute: share,
              lastSeen: Date.now(),
              isOnline: true,
            });
          } else {
            next.set(share.riderId, {
              riderId: share.riderId,
              name: share.riderName || 'Rider',
              color: getRiderColor(share.riderId),
              isHost: false,
              lastSeen: Date.now(),
              isOnline: true,
              sharedRoute: share,
            });
          }
          membersRef.current = next;
          return next;
        });
        playRouteSharedChime();
        postCrewNotification(`🗺️ ${share.riderName || 'Rider'} loaded route: "${share.routeName}" (${share.distanceKm.toFixed(1)} km)`, 'info');
      }
    } else if (data.type === 'ROUTE_CLEAR') {
      const riderId = data.riderId;
      if (riderId) {
        setMembers(prev => {
          const next = new Map(prev);
          const current = next.get(riderId);
          if (current) {
            next.set(riderId, {
              ...current,
              sharedRoute: undefined,
            });
            membersRef.current = next;
          }
          return next;
        });
      }
    } else if (data.type === 'SOS_PING') {
      const alert: SosAlert = data.payload;
      if (alert && alert.fromName) {
        setSosAlert(alert);
        playSosChime();
        postCrewNotification(`🚨 REGROUP ALERT from ${alert.fromName}!`, 'alert');
      }
    } else if (data.type === 'OFFLINE') {
      const riderId = data.riderId;
      if (riderId && riderId !== currentMyId) {
        setMembers(prev => {
          if (!prev.has(riderId)) return prev;
          const next = new Map(prev);
          const current = next.get(riderId)!;
          next.set(riderId, { ...current, isOnline: false, isStale: true });
          membersRef.current = next;
          return next;
        });
      }
    } else if (data.type === 'VOICE_BLAST') {
      const blast: VoiceBlastPayload = data.payload;
      if (blast && blast.riderId && blast.riderId !== currentMyId && blast.audioBase64) {
        // Automatically play voice blast through connected Bluetooth helmet intercom (Sena/Cardo/AirPods)
        playVoiceBlastAudio(blast.audioBase64, blast.mimeType || 'audio/webm');

        if (voiceBlastTimeoutRef.current) clearTimeout(voiceBlastTimeoutRef.current);
        setActiveVoiceBlast({
          riderId: blast.riderId,
          riderName: blast.riderName || 'Rider',
          bikeModel: blast.bikeModel,
          color: blast.color || getRiderColor(blast.riderId),
          durationMs: blast.durationMs || 3000,
          timestamp: blast.timestamp || Date.now(),
        });
        postCrewNotification(`🗣️ Voice blast from ${blast.riderName || 'Rider'}`, 'info');
        voiceBlastTimeoutRef.current = setTimeout(() => {
          setActiveVoiceBlast(null);
        }, (blast.durationMs || 3000) + 2500);
      }
    }
  }, [postCrewNotification]);

  // Broadcast payload to both MQTT relay and local BroadcastChannel
  const broadcastPayload = useCallback((payload: any) => {
    // 1. Local cross-tab sync
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(payload);
      } catch {}
    }

    // 2. Global MQTT WebSocket relay
    if (mqttClientRef.current) {
      // Broadcast to universal global radar channel so all app users see each other
      mqttClientRef.current.publish('throttlelog/v1/radar/global', payload);

      // Also publish to custom squad channel if explicitly joined a distinct squad
      const squadKey = sanitizeKey(profileRef.current.squadName);
      if (squadKey && squadKey !== 'global' && squadKey !== 'globalcrew') {
        mqttClientRef.current.publish(`throttlelog/v1/squad/${squadKey}`, payload);
      }
    }
  }, []);

  // Setup BroadcastChannel for 0ms cross-tab local testing
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('throttlelog_local_radar');
    channel.onmessage = (event) => {
      handleIncomingMessage(event.data);
    };
    broadcastChannelRef.current = channel;

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [handleIncomingMessage]);

  // Initialize Global MQTT Radar Client
  useEffect(() => {
    if (!profile.isLoggedIn) return;

    const squadKey = sanitizeKey(profile.squadName);
    const client = new SimpleMqttClient({
      clientId: profile.id,
      onMessage: (_topic, data) => {
        handleIncomingMessage(data);
      },
      onStatusChange: (status, detail) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setIsConnected(true);
          setStatusMessage('Crew Radar Active • Everyone is live and visible');
        } else if (status === 'connecting') {
          setStatusMessage(detail || 'Connecting to Crew Radar...');
        } else if (status === 'disconnected') {
          setIsConnected(false);
          setStatusMessage('Crew Radar reconnecting...');
        } else {
          setIsConnected(false);
          setStatusMessage('Crew Radar network reconnect in progress...');
        }
      },
    });

    client.connect();

    // Universal open radar topic: ensures ANYONE using the app is directly visible
    client.subscribe('throttlelog/v1/radar/global');

    // Custom squad-specific topic only if explicitly in a distinct squad
    if (squadKey && squadKey !== 'global' && squadKey !== 'globalcrew') {
      client.subscribe(`throttlelog/v1/squad/${squadKey}`);
    }

    mqttClientRef.current = client;

    return () => {
      client.destroy();
      mqttClientRef.current = null;
    };
  }, [profile.isLoggedIn, profile.id, profile.squadName, handleIncomingMessage]);

  // Periodic heartbeat / location broadcast every 2.5 seconds
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (!profile.isLoggedIn || !isOnRadarRef.current) return;
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
    }, 2500);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [profile, broadcastPayload]);

  // Age out stale / offline members every 4 seconds
  useEffect(() => {
    const ageInterval = setInterval(() => {
      const now = Date.now();
      setMembers(prev => {
        let changed = false;
        const next = new Map(prev);

        prev.forEach((info, id) => {
          const age = now - info.lastSeen;
          // After 25 seconds without a packet, mark stale/stopped
          if (info.isOnline && age > 25000 && !info.isStale) {
            next.set(id, { ...info, isStale: true });
            changed = true;
          }
          // After 75 seconds without a packet, mark offline but NEVER delete from convoy map
          if (info.isOnline && age > 75000) {
            next.set(id, { ...info, isOnline: false, isStale: true });
            changed = true;
          }
          // Only prune ghosts after 4 hours of complete silence
          if (age > 4 * 60 * 60 * 1000) {
            next.delete(id);
            changed = true;
          }
        });

        if (changed) {
          membersRef.current = next;
          return next;
        }
        return prev;
      });
    }, 4000);

    return () => clearInterval(ageInterval);
  }, []);

  // Public Methods
  const updateMyLocation = useCallback((lat: number, lon: number, speedKmh: number, bearing: number | null, leanAngle?: number) => {
    myLocationRef.current = { lat, lon, speedKmh, bearing, leanAngle };

    if (!isOnRadarRef.current) return;

    // Rate-limit position broadcasts to 1500ms to preserve mobile battery and avoid public broker burst-disconnects
    const now = Date.now();
    if (now - lastLocationBroadcastTimeRef.current < 1500) {
      return;
    }
    lastLocationBroadcastTimeRef.current = now;

    // Broadcast immediately upon GPS position fix
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

  const toggleOnRadar = useCallback((enable?: boolean) => {
    setIsOnRadar(prev => {
      const next = enable !== undefined ? enable : !prev;
      isOnRadarRef.current = next;
      try {
        localStorage.setItem('sasta_on_radar', String(next));
      } catch {}

      if (!next) {
        // Going off radar: send OFFLINE packet so friends see us disappear from live radar immediately
        broadcastPayload({
          type: 'OFFLINE',
          riderId: profileRef.current.id,
        });
        postCrewNotification('👻 Off Radar (Ghost mode) enabled. You are hidden from friends.', 'info');
      } else {
        // Coming back on radar: send HEARTBEAT/LOCATION
        postCrewNotification('🟢 Back on Crew Radar! You are visible to friends.', 'join');
        const payload: any = {
          riderId: profileRef.current.id,
          name: profileRef.current.name,
          color: profileRef.current.color,
          bikeModel: profileRef.current.bikeModel,
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
      }
      return next;
    });
  }, [broadcastPayload, postCrewNotification]);

  const broadcastActiveRoute = useCallback((route: { name?: string; distanceKm?: number; destination?: { lat: number; lon: number }; points?: Array<{ lat: number; lon: number }> } | null) => {
    if (!route) {
      broadcastPayload({
        type: 'ROUTE_CLEAR',
        riderId: profileRef.current.id,
      });
      return;
    }

    // Downsample points to ~60 points max so MQTT payload stays compact (< 4KB)
    let sampledPoints: Array<{ lat: number; lon: number }> | undefined = undefined;
    if (route.points && route.points.length > 0) {
      const pts = route.points;
      const step = Math.max(1, Math.floor(pts.length / 60));
      sampledPoints = [];
      for (let i = 0; i < pts.length; i += step) {
        sampledPoints.push({ lat: Number(pts[i].lat.toFixed(5)), lon: Number(pts[i].lon.toFixed(5)) });
      }
      const lastPt = pts[pts.length - 1];
      const lastSampled = sampledPoints[sampledPoints.length - 1];
      if (!lastSampled || lastSampled.lat !== Number(lastPt.lat.toFixed(5)) || lastSampled.lon !== Number(lastPt.lon.toFixed(5))) {
        sampledPoints.push({ lat: Number(lastPt.lat.toFixed(5)), lon: Number(lastPt.lon.toFixed(5)) });
      }
    }

    const dest = route.destination || (sampledPoints && sampledPoints.length > 0 ? sampledPoints[sampledPoints.length - 1] : undefined);
    if (!dest) return;

    const sharePayload: SharedRouteInfo = {
      riderId: profileRef.current.id,
      riderName: profileRef.current.name,
      routeName: route.name || 'Weekend Ride',
      distanceKm: route.distanceKm || 0,
      destination: dest,
      points: sampledPoints,
      timestamp: Date.now(),
    };

    broadcastPayload({
      type: 'ROUTE_SHARE',
      payload: sharePayload,
    });

    postCrewNotification(`🗺️ Shared your route "${sharePayload.routeName}" with crew radar!`, 'info');
  }, [broadcastPayload, postCrewNotification]);

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

  const loginRider = useCallback((name: string, bikeModel?: string, color?: string, squadName?: string) => {
    const cleanName = (name && name.trim()) || 'Rider';
    const cleanId = generateUniqueRiderId(cleanName);
    const newProfile: RiderProfile = {
      id: cleanId,
      name: cleanName,
      bikeModel: bikeModel || 'Motorcycle',
      color: color || getRiderColor(cleanId),
      squadName: squadName || DEFAULT_SQUAD_NAME,
      isLoggedIn: true,
    };
    setProfile(newProfile);

    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
    saveIdentity('sasta_rider_name', cleanName);

    postCrewNotification(`👋 Checked in as ${cleanName}! Live on Crew Radar.`, 'join');
  }, [postCrewNotification]);

  const logoutRider = useCallback(() => {
    setProfile(prev => ({ ...prev, isLoggedIn: false }));
    setMembers(new Map());
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setStatusMessage('Logged out. Check in to rejoin crew radar.');
  }, []);

  const updateProfile = useCallback((name: string, bikeModel?: string, color?: string) => {
    const cleanName = (name && name.trim()) || profileRef.current.name || 'Rider';
    const updated: RiderProfile = {
      ...profileRef.current,
      name: cleanName,
      bikeModel: bikeModel !== undefined && bikeModel.trim() ? bikeModel.trim() : profileRef.current.bikeModel,
      color: color || profileRef.current.color,
    };
    setProfile(updated);
    profileRef.current = updated;

    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
    saveIdentity('sasta_rider_name', cleanName);

    // Immediately broadcast updated profile so other riders see the new name & color right away
    const payload: any = {
      riderId: updated.id,
      name: updated.name,
      color: updated.color,
      bikeModel: updated.bikeModel,
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

    postCrewNotification(`Callsign updated: ${cleanName}`, 'info');
  }, [broadcastPayload, postCrewNotification]);

  const updateRiderName = useCallback((newName: string, bikeModel?: string, color?: string) => {
    if (!newName.trim()) return;
    updateProfile(newName.trim(), bikeModel, color);
  }, [updateProfile]);

  const addSquadFriend = useCallback((name: string, bikeModel?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanId = generateUniqueRiderId(cleanName);
    const newFriend: FriendEntry = {
      id: cleanId,
      name: cleanName,
      bikeModel: bikeModel || 'Motorcycle',
      color: getRiderColor(cleanId),
    };

    setCustomFriends(prev => {
      const next = [...prev.filter(f => f.name.toLowerCase() !== cleanName.toLowerCase()), newFriend];
      saveIdentity(STORAGE_KEYS.CUSTOM_FRIENDS, JSON.stringify(next));
      return next;
    });

    postCrewNotification(`Added ${cleanName} to squad roster!`, 'info');
  }, [postCrewNotification]);

  const getFriendInviteUrl = useCallback((friendName?: string) => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    if (friendName) {
      return `${base}?rider=${encodeURIComponent(friendName)}`;
    }
    return base;
  }, []);

  const sendVoiceBlast = useCallback((audioBase64: string, durationMs: number, mimeType: string = 'audio/webm') => {
    if (!audioBase64) return;
    const payload: VoiceBlastPayload = {
      riderId: profileRef.current.id,
      riderName: profileRef.current.name,
      bikeModel: profileRef.current.bikeModel,
      color: profileRef.current.color,
      audioBase64,
      durationMs,
      mimeType,
      timestamp: Date.now(),
    };
    broadcastPayload({
      type: 'VOICE_BLAST',
      payload,
    });
    postCrewNotification(`🎙️ Voice blast sent to crew radar!`, 'info');
  }, [broadcastPayload, postCrewNotification]);

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
    dismissCrewNotification: () => setCrewNotification(null),
    activeVoiceBlast,
    dismissVoiceBlast: () => setActiveVoiceBlast(null),
    sendVoiceBlast,
    updateMyLocation,
    triggerSos,
    dismissSos: () => setSosAlert(null),
    isOnRadar,
    toggleOnRadar,
    broadcastActiveRoute,
    updateRiderName,
    updateProfile,
    createRoom: (name: string) => loginRider(name),
    joinRoom: (code: string, name?: string) => loginRider(name || profile.name, undefined, undefined, code),
    rejoinRoom: () => loginRider(profile.name),
    leaveRoom: logoutRider,
  };
}

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haversineDistance } from '../utils/gpxParser';
import { 
  playWaypointChime, 
  playSosChime, 
  playRouteSharedChime, 
  playRadarJoinChime,
  playRegroupChime,
  triggerHaptic
} from '../utils/audioChimes';
import { getSavedIdentity, saveIdentity } from '../utils/cookieStorage';
import { SimpleMqttClient, MqttConnectionStatus } from '../utils/mqttClient';
import {
  deriveRoomCryptoContext,
  encryptCrewPayload,
  decryptCrewPayload,
  sanitizeSquadKey,
  SquadCryptoContext,
} from '../utils/crewCrypto';
import { resetConvoyWatchdog } from '../utils/convoyWatchdog';
import { playVoiceBlastAudio } from '../utils/voiceBlast';
import { RiderCallout, CalloutPreset, playCalloutAlert } from '../utils/callouts';
import { speakAlert } from '../utils/tts';
import { saveRiderProfile } from '../utils/riderProfile';
export type { RiderCallout, CalloutPreset } from '../utils/callouts';

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
  isCharging?: boolean;
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
  fromId?: string;
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
  VOICE_BLAST_MUTED: 'throttlelog_voice_blast_muted',
};

const MAX_VOICE_BLAST_B64_CHARS = 140_000;
const VOICE_BLAST_ALLOWED_MIMES = /^audio\/(?:webm|mp4|aac|ogg|wav)(?:\s*;\s*codecs=[a-z0-9.,_-]+)?$/i;
const VOICE_BLAST_BASE64_RE = /^[A-Za-z0-9+/=]+$/;
const VOICE_BLAST_SENDER_COOLDOWN_MS = 4000;
const VOICE_BLAST_GLOBAL_COOLDOWN_MS = 1500;

export const DEFAULT_KNOWN_MEMBERS: FriendEntry[] = [];

function getLeaderStorageKey(squadName: string): string {
  const key = sanitizeSquadKey(squadName) || 'global';
  return `sasta_squad_leader_${key}`;
}

function generateUniqueRiderId(namePrefix: string = 'rider'): string {
  const prefix = sanitizeSquadKey(namePrefix) || 'rider';
  const rand = typeof globalThis.crypto?.getRandomValues === 'function'
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 6)
    : Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${rand}${time}`;
}

export function useGroupRide() {
  // 1. Persistent Unique Rider Identity (never overwrite an existing saved profile from ?rider= URL links)
  const [profile, setProfile] = useState<RiderProfile>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const riderParam = params.get('rider') || params.get('name') || params.get('who');
        const squadParam = params.get('squad') || params.get('crew') || params.get('room');

        const savedRaw = getSavedIdentity(STORAGE_KEYS.USER_PROFILE);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed.name && parsed.id) {
            if (squadParam && squadParam.trim()) {
              parsed.squadName = squadParam.trim();
              saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(parsed));
            }
            return parsed;
          }
        }

        const existingCallsign =
          getSavedIdentity('throttlelog_rider_name') ||
          getSavedIdentity('sasta_rider_name');
        const hasNamedCallsign = Boolean(existingCallsign && existingCallsign.trim() && existingCallsign.trim() !== 'Rider');

        if (!hasNamedCallsign && riderParam && riderParam.trim()) {
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
          saveIdentity('throttlelog_rider_name', cleanName);
          saveIdentity('sasta_rider_name', cleanName);
          return newProfile;
        }

        const fallbackName = hasNamedCallsign ? existingCallsign!.trim() : 'Rider';
        const cleanId = generateUniqueRiderId(fallbackName);
        const fallback: RiderProfile = {
          id: cleanId,
          name: fallbackName,
          bikeModel: 'Motorcycle',
          color: getRiderColor(cleanId),
          squadName: squadParam?.trim() || DEFAULT_SQUAD_NAME,
          isLoggedIn: true,
        };
        saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(fallback));
        return fallback;
      }

      const fallbackId = generateUniqueRiderId('rider');
      return {
        id: fallbackId,
        name: 'Rider',
        bikeModel: 'Motorcycle',
        color: '#00f0ff',
        squadName: DEFAULT_SQUAD_NAME,
        isLoggedIn: true,
      };
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
        const params = new URLSearchParams(window.location.search);
        if (params.get('room') || params.get('crew') || params.get('squad')) {
          return true;
        }
        const saved = localStorage.getItem('sasta_on_radar');
        // Default OFF for solo privacy unless user explicitly switched Crew Radar Live
        return saved === 'true';
      }
    } catch {}
    return false;
  });
  const isOnRadarRef = useRef(isOnRadar);
  isOnRadarRef.current = isOnRadar;

  const [connectionStatus, setConnectionStatus] = useState<MqttConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Solo Private Mode • Hidden from Crew Radar');
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 3. Live Crew Members Map (populated exclusively by real live rider signals)
  const [members, setMembers] = useState<Map<string, GroupMemberInfo>>(new Map());
  const [sosAlert, setSosAlert] = useState<SosAlert | null>(null);
  const sosAlertRef = useRef<SosAlert | null>(sosAlert);
  sosAlertRef.current = sosAlert;

  const [crewNotification, setCrewNotification] = useState<CrewNotification | null>(null);
  const [activeVoiceBlast, setActiveVoiceBlast] = useState<ActiveVoiceBlast | null>(null);
  const voiceBlastTimeoutRef = useRef<any>(null);
  const [isVoiceBlastMuted, setIsVoiceBlastMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.VOICE_BLAST_MUTED) === 'true';
    } catch {
      return false;
    }
  });
  const isVoiceBlastMutedRef = useRef<boolean>(isVoiceBlastMuted);
  isVoiceBlastMutedRef.current = isVoiceBlastMuted;
  const lastVoiceBlastBySenderRef = useRef<Map<string, number>>(new Map());
  const lastGlobalVoiceBlastAtRef = useRef<number>(0);

  const [activeCallout, setActiveCallout] = useState<RiderCallout | null>(null);
  const calloutTimeoutRef = useRef<any>(null);
  const [isConvoyRegrouped, setIsConvoyRegrouped] = useState<boolean>(false);
  const wasSeparatedRef = useRef<boolean>(true);
  const lastRegroupNotificationTimeRef = useRef<number>(0);

  // 4. Squad Leader Designation (scoped per room)
  const [leaderId, setLeaderId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(getLeaderStorageKey(profile.squadName)) || null;
    } catch {
      return null;
    }
  });
  const leaderIdRef = useRef<string | null>(leaderId);
  leaderIdRef.current = leaderId;

  const toggleVoiceBlastMuted = useCallback((muted?: boolean) => {
    setIsVoiceBlastMuted(prev => {
      const next = muted !== undefined ? muted : !prev;
      isVoiceBlastMutedRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEYS.VOICE_BLAST_MUTED, String(next));
      } catch {}
      return next;
    });
  }, []);

  // References
  const profileRef = useRef<RiderProfile>(profile);
  profileRef.current = profile;

  // Browser Battery API integration for live squad battery monitoring
  const batteryPctRef = useRef<number | undefined>(undefined);
  const isChargingRef = useRef<boolean | undefined>(undefined);
  const [myBattery, setMyBattery] = useState<{ level?: number; isCharging?: boolean }>({});

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    try {
      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          const update = () => {
            const level = Math.round(battery.level * 100);
            const charging = battery.charging;
            batteryPctRef.current = level;
            isChargingRef.current = charging;
            setMyBattery({ level, isCharging: charging });
          };
          update();
          battery.addEventListener('levelchange', update);
          battery.addEventListener('chargingchange', update);
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const membersRef = useRef<Map<string, GroupMemberInfo>>(members);
  membersRef.current = members;

  const myLocationRef = useRef<{ lat: number; lon: number; speedKmh: number; bearing: number | null; leanAngle?: number } | null>(null);
  const mqttClientRef = useRef<SimpleMqttClient | null>(null);
  const activeCryptoRef = useRef<SquadCryptoContext | null>(null);
  const sentOfflineClientsRef = useRef<WeakSet<SimpleMqttClient>>(new WeakSet());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const lastLocationBroadcastTimeRef = useRef<number>(0);
  const lastDistanceRecalcRef = useRef<number>(0);
  const lastDistanceCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const commitMembers = useCallback((next: Map<string, GroupMemberInfo>) => {
    membersRef.current = next;
    setMembers(next);
  }, []);

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

  const gracefulOfflineAndDestroy = useCallback(async (
    client: SimpleMqttClient | null,
    cryptoCtx: SquadCryptoContext | null,
    riderId: string
  ) => {
    if (!client || sentOfflineClientsRef.current.has(client)) return;
    sentOfflineClientsRef.current.add(client);
    if (cryptoCtx) {
      try {
        const envelope = await encryptCrewPayload(cryptoCtx.secret, cryptoCtx.roomHash, {
          type: 'OFFLINE',
          riderId,
          timestamp: Date.now(),
        });
        client.publish(cryptoCtx.topic, envelope, false);
      } catch {}
      setTimeout(() => client.destroy(), 180);
    } else {
      client.destroy();
    }
  }, []);

  // Handle incoming data message from encrypted MQTT relay or same-room BroadcastChannel
  const handleIncomingMessage = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;
    const currentMyId = profileRef.current.id;

    if (data.type === 'LOCATION' || data.type === 'HEARTBEAT') {
      const loc: GroupRiderLocation & { leaderId?: string } = data.payload;
      if (!loc || !loc.riderId || loc.riderId === currentMyId) return;

      if (typeof loc.leaderId === 'string' && loc.leaderId.trim() && !leaderIdRef.current) {
        const syncedLeader = loc.leaderId.trim();
        leaderIdRef.current = syncedLeader;
        setLeaderId(syncedLeader);
        try {
          localStorage.setItem(getLeaderStorageKey(profileRef.current.squadName), syncedLeader);
        } catch {}
      }

      const prev = membersRef.current;
      const next = new Map(prev);
      const existing = next.get(loc.riderId);
      const isPreviouslyOffline = !existing || !existing.isOnline;

      let dist: number | undefined = undefined;
      if (myLocationRef.current && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
        dist = haversineDistance(
          myLocationRef.current.lat,
          myLocationRef.current.lon,
          loc.lat,
          loc.lon
        );
      }

      const hasValidCoords =
        typeof loc.lat === 'number' &&
        typeof loc.lon === 'number' &&
        Number.isFinite(loc.lat) &&
        Number.isFinite(loc.lon) &&
        loc.lat >= -90 &&
        loc.lat <= 90 &&
        loc.lon >= -180 &&
        loc.lon <= 180;

      next.set(loc.riderId, {
        riderId: loc.riderId,
        name: loc.name || existing?.name || 'Rider',
        color: loc.color || existing?.color || getRiderColor(loc.riderId),
        bikeModel: loc.bikeModel || existing?.bikeModel,
        isHost: loc.riderId === leaderIdRef.current,
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

      commitMembers(next);
      if (isPreviouslyOffline) {
        playRadarJoinChime();
        postCrewNotification(`🏍️ ${loc.name || 'Rider'} joined the Crew Radar!`, 'join');
      }
    } else if (data.type === 'ROUTE_SHARE') {
      const share: SharedRouteInfo = data.payload;
      if (share && share.riderId && share.riderId !== currentMyId) {
        const next = new Map(membersRef.current);
        const current = next.get(share.riderId);
        if (current) {
          next.set(share.riderId, {
            ...current,
            sharedRoute: share,
            isHost: share.riderId === leaderIdRef.current,
            lastSeen: Date.now(),
            isOnline: true,
          });
        } else {
          next.set(share.riderId, {
            riderId: share.riderId,
            name: share.riderName || 'Rider',
            color: getRiderColor(share.riderId),
            isHost: share.riderId === leaderIdRef.current,
            lastSeen: Date.now(),
            isOnline: true,
            sharedRoute: share,
          });
        }
        commitMembers(next);
        playRouteSharedChime();
        postCrewNotification(`🗺️ ${share.riderName || 'Rider'} loaded route: "${share.routeName}" (${(share.distanceKm || 0).toFixed(1)} km)`, 'info');
      }
    } else if (data.type === 'ROUTE_CLEAR') {
      const riderId = data.riderId;
      if (riderId && riderId !== currentMyId) {
        const current = membersRef.current.get(riderId);
        if (current) {
          const next = new Map(membersRef.current);
          next.set(riderId, {
            ...current,
            sharedRoute: undefined,
          });
          commitMembers(next);
        }
      }
    } else if (data.type === 'SOS_PING') {
      const alert: SosAlert = data.payload;
      if (
        alert &&
        typeof alert.fromId === 'string' &&
        alert.fromId.length > 0 &&
        alert.fromId !== currentMyId &&
        typeof alert.lat === 'number' &&
        typeof alert.lon === 'number' &&
        Number.isFinite(alert.lat) &&
        Number.isFinite(alert.lon)
      ) {
        const senderName = alert.fromName && alert.fromName.trim() ? alert.fromName.trim() : 'a squad member';
        sosAlertRef.current = alert;
        setSosAlert(alert);
        playSosChime();
        triggerHaptic([150, 60, 150, 60, 300]);
        speakAlert(`Emergency! S O S alert from ${senderName}! Pull over and check map immediately!`, {
          rate: 1.0,
          pitch: 1.05,
        });
        postCrewNotification(`🚨 EMERGENCY SOS from ${senderName}!`, 'alert');
      }
    } else if (data.type === 'SOS_CANCEL') {
      const clearerId = typeof data.payload?.fromId === 'string' ? data.payload.fromId.trim() : '';
      const currentSos = sosAlertRef.current;
      if (!currentSos || !clearerId) return;

      const isOriginalSender = Boolean(currentSos.fromId && clearerId === currentSos.fromId);
      const isAuthorizedLeader = Boolean(leaderIdRef.current && clearerId === leaderIdRef.current);
      if (!isOriginalSender && !isAuthorizedLeader) {
        console.warn('Rejected unauthorized SOS_CANCEL from', clearerId);
        return;
      }

      const clearerName = (data.payload && data.payload.fromName) || 'Squad Member';
      sosAlertRef.current = null;
      setSosAlert(null);
      playWaypointChime();
      triggerHaptic(50);
      speakAlert(`Emergency alert cleared by ${clearerName}. All riders safe.`);
      postCrewNotification(`🟢 Emergency SOS cleared by ${clearerName}. All safe!`, 'info');
    } else if (data.type === 'OFFLINE') {
      const riderId = data.riderId;
      if (riderId && riderId !== currentMyId && membersRef.current.has(riderId)) {
        const next = new Map(membersRef.current);
        const current = next.get(riderId)!;
        if (current.isOnline || !current.isStale) {
          next.set(riderId, { ...current, isOnline: false, isStale: true });
          commitMembers(next);
        }
      }
    } else if (data.type === 'VOICE_BLAST') {
      const blast: VoiceBlastPayload = data.payload;
      const now = Date.now();
      const mime = (blast?.mimeType || 'audio/webm').trim();
      const validPayload =
        blast &&
        typeof blast.riderId === 'string' &&
        blast.riderId.length > 0 &&
        blast.riderId !== currentMyId &&
        typeof blast.audioBase64 === 'string' &&
        blast.audioBase64.length > 0 &&
        blast.audioBase64.length <= MAX_VOICE_BLAST_B64_CHARS &&
        VOICE_BLAST_BASE64_RE.test(blast.audioBase64) &&
        VOICE_BLAST_ALLOWED_MIMES.test(mime);

      if (validPayload) {
        const lastFromSender = lastVoiceBlastBySenderRef.current.get(blast.riderId) || 0;
        if (
          now - lastFromSender < VOICE_BLAST_SENDER_COOLDOWN_MS ||
          now - lastGlobalVoiceBlastAtRef.current < VOICE_BLAST_GLOBAL_COOLDOWN_MS
        ) {
          return;
        }
        lastVoiceBlastBySenderRef.current.set(blast.riderId, now);
        lastGlobalVoiceBlastAtRef.current = now;

        const safeDurationMs = Math.min(Math.max(Number(blast.durationMs) || 3000, 500), 10000);
        const senderLabel = blast.riderName || 'Rider';

        if (!isVoiceBlastMutedRef.current) {
          playVoiceBlastAudio(blast.audioBase64, mime);
        }

        if (voiceBlastTimeoutRef.current) clearTimeout(voiceBlastTimeoutRef.current);
        setActiveVoiceBlast({
          riderId: blast.riderId,
          riderName: senderLabel,
          bikeModel: blast.bikeModel,
          color: blast.color || getRiderColor(blast.riderId),
          durationMs: safeDurationMs,
          timestamp: blast.timestamp || now,
        });
        postCrewNotification(
          isVoiceBlastMutedRef.current
            ? `🔇 Voice blast from ${senderLabel} (Autoplay muted)`
            : `🗣️ Voice blast from ${senderLabel}`,
          'info'
        );
        voiceBlastTimeoutRef.current = setTimeout(() => {
          setActiveVoiceBlast(null);
        }, safeDurationMs + 2500);
      }
    } else if (data.type === 'CALLOUT') {
      const callout: RiderCallout = data.payload;
      if (callout && callout.riderId && callout.riderId !== currentMyId) {
        playCalloutAlert(callout.riderName || 'Rider', callout.spokenText || callout.message);

        if (calloutTimeoutRef.current) clearTimeout(calloutTimeoutRef.current);
        setActiveCallout(callout);
        postCrewNotification(`${callout.icon || '📣'} ${callout.riderName}: ${callout.title}`, 'info');

        calloutTimeoutRef.current = setTimeout(() => {
          setActiveCallout(null);
        }, 10000);
      }
    } else if (data.type === 'SET_LEADER') {
      const newLeaderId = typeof data.payload?.leaderId === 'string' ? data.payload.leaderId.trim() : '';
      const senderId = typeof data.payload?.senderId === 'string' ? data.payload.senderId.trim() : '';
      const newLeaderName = data.payload?.leaderName || 'Squad Member';
      if (!newLeaderId || !senderId) return;

      const existingLeader = leaderIdRef.current;
      const leaderIsCurrentActiveOther = Boolean(
        existingLeader &&
        existingLeader !== currentMyId &&
        membersRef.current.get(existingLeader)?.isOnline
      );
      const isAuthorized =
        existingLeader === null ||
        senderId === existingLeader ||
        (existingLeader !== currentMyId && !leaderIsCurrentActiveOther);

      if (!isAuthorized) {
        console.warn('Rejected unauthorized SET_LEADER claim from', senderId);
        return;
      }

      setLeaderId(newLeaderId);
      leaderIdRef.current = newLeaderId;
      try {
        localStorage.setItem(getLeaderStorageKey(profileRef.current.squadName), newLeaderId);
      } catch {}

      const next = new Map<string, GroupMemberInfo>();
      membersRef.current.forEach((val, key) => {
        next.set(key, { ...val, isHost: key === newLeaderId });
      });
      commitMembers(next);
      playRegroupChime();
      speakAlert(`${newLeaderName} is now the ride leader.`);
      postCrewNotification(`👑 ${newLeaderName} is now the Ride Lead!`, 'info');
    }
  }, [postCrewNotification, commitMembers]);

  // Broadcast payload to encrypted MQTT relay and scoped local BroadcastChannel
  const broadcastPayload = useCallback((payload: any) => {
    // 1. Local cross-tab sync scoped to same squad
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          squadKey: sanitizeSquadKey(profileRef.current.squadName) || 'global',
          data: payload,
        });
      } catch {}
    }

    // 2. Encrypted Global MQTT WebSocket relay
    const client = mqttClientRef.current;
    const cryptoCtx = activeCryptoRef.current;
    if (!client || !cryptoCtx) return;

    const isCritical =
      typeof payload === 'object' &&
      payload !== null &&
      (payload.type === 'SOS_PING' ||
        payload.type === 'SOS_CANCEL' ||
        payload.type === 'CALLOUT' ||
        payload.type === 'ROUTE_SHARE' ||
        payload.type === 'SET_LEADER' ||
        payload.type === 'OFFLINE');

    encryptCrewPayload(cryptoCtx.secret, cryptoCtx.roomHash, payload)
      .then(envelope => {
        if (mqttClientRef.current === client && activeCryptoRef.current?.roomHash === cryptoCtx.roomHash) {
          client.publish(cryptoCtx.topic, envelope, isCritical);
        }
      })
      .catch(() => {});
  }, []);

  // Setup BroadcastChannel for 0ms cross-tab local testing (isolated by squadKey)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('throttlelog_local_radar');
    channel.onmessage = (event) => {
      const msg = event.data;
      if (msg && typeof msg === 'object' && 'squadKey' in msg && 'data' in msg) {
        const myKey = sanitizeSquadKey(profileRef.current.squadName) || 'global';
        if (msg.squadKey === myKey) {
          handleIncomingMessage(msg.data);
        }
      }
    };
    broadcastChannelRef.current = channel;

    return () => {
      channel.close();
      broadcastChannelRef.current = null;
    };
  }, [handleIncomingMessage]);

  // Initialize Global MQTT Radar Client (ONLY when Crew Radar is actively enabled)
  useEffect(() => {
    if (!profile.isLoggedIn || !isOnRadar) {
      commitMembers(new Map());
      activeCryptoRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setStatusMessage('Solo Private Mode • Hidden from Crew Radar');
      resetConvoyWatchdog('solo');
      return;
    }

    let cancelled = false;

    // Reset member cache & leader key when joining/switching squad
    commitMembers(new Map());
    lastVoiceBlastBySenderRef.current.clear();
    setIsConnected(false);
    setConnectionStatus('connecting');
    setStatusMessage('Deriving squad key & connecting to Crew Radar...');
    try {
      const savedLeader = localStorage.getItem(getLeaderStorageKey(profile.squadName)) || null;
      setLeaderId(savedLeader);
      leaderIdRef.current = savedLeader;
    } catch {
      setLeaderId(null);
      leaderIdRef.current = null;
    }
    resetConvoyWatchdog(profile.squadName);

    let client: SimpleMqttClient | null = null;

    (async () => {
      try {
        const cryptoCtx = await deriveRoomCryptoContext(profile.squadName);
        if (cancelled) return;
        activeCryptoRef.current = cryptoCtx;

        const willEnvelope = await encryptCrewPayload(cryptoCtx.secret, cryptoCtx.roomHash, {
          type: 'OFFLINE',
          riderId: profile.id,
          timestamp: Date.now(),
        });
        if (cancelled) return;

        client = new SimpleMqttClient({
          clientId: profile.id,
          will: {
            topic: cryptoCtx.topic,
            payload: willEnvelope,
            qos: 0,
            retain: false,
          },
          onMessage: (_topic, envelope) => {
            decryptCrewPayload(cryptoCtx.secret, cryptoCtx.roomHash, envelope)
              .then(decrypted => {
                if (!cancelled && decrypted) {
                  handleIncomingMessage(decrypted);
                }
              })
              .catch(() => {});
          },
          onStatusChange: (status, detail) => {
            if (cancelled) return;
            setConnectionStatus(status);
            if (status === 'connected') {
              setIsConnected(true);
              setStatusMessage(
                cryptoCtx.isPrivate
                  ? `Squad [${profile.squadName}] Encrypted • Private squad radar live`
                  : 'Crew Radar Active • Encrypted global relay live'
              );
              const helloPayload: any = {
                riderId: profileRef.current.id,
                name: profileRef.current.name,
                color: profileRef.current.color,
                bikeModel: profileRef.current.bikeModel,
                leaderId: leaderIdRef.current || undefined,
                timestamp: Date.now(),
                status: 'stopped',
                batteryPct: batteryPctRef.current,
                isCharging: isChargingRef.current,
              };
              if (myLocationRef.current) {
                Object.assign(helloPayload, myLocationRef.current);
                helloPayload.status = (myLocationRef.current.speedKmh || 0) < 2.5 ? 'stopped' : 'riding';
              }
              encryptCrewPayload(cryptoCtx.secret, cryptoCtx.roomHash, {
                type: myLocationRef.current ? 'LOCATION' : 'HEARTBEAT',
                payload: helloPayload,
              })
                .then(envelope => {
                  if (!cancelled && client && mqttClientRef.current === client) {
                    client.publish(cryptoCtx.topic, envelope, false);
                  }
                })
                .catch(() => {});
            } else if (status === 'connecting') {
              setIsConnected(false);
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

        mqttClientRef.current = client;
        client.connect();
        client.subscribe(cryptoCtx.topic);
      } catch (err) {
        if (!cancelled) {
          setIsConnected(false);
          setConnectionStatus('error');
          setStatusMessage('Unable to initialize encrypted Crew Radar');
          console.warn('Crew Radar init warning:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      const closingCrypto = activeCryptoRef.current;
      activeCryptoRef.current = null;
      if (mqttClientRef.current === client) {
        mqttClientRef.current = null;
      }
      if (client) {
        gracefulOfflineAndDestroy(client, closingCrypto, profileRef.current.id);
      }
      resetConvoyWatchdog();
    };
  }, [profile.isLoggedIn, profile.id, profile.squadName, isOnRadar, handleIncomingMessage, commitMembers, gracefulOfflineAndDestroy]);

  // Unified idle heartbeat every 2.5s (skips if movement broadcast just sent within 2.3s)
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (!profile.isLoggedIn || !isOnRadarRef.current) return;
      const now = Date.now();
      if (now - lastLocationBroadcastTimeRef.current < 2300) return;

      lastLocationBroadcastTimeRef.current = now;
      const payload: any = {
        riderId: profile.id,
        name: profile.name,
        color: profile.color,
        bikeModel: profile.bikeModel,
        leaderId: leaderIdRef.current || undefined,
        timestamp: now,
        status: 'stopped',
        batteryPct: batteryPctRef.current,
        isCharging: isChargingRef.current,
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
      const prev = membersRef.current;
      if (prev.size === 0) return;

      let changed = false;
      const next = new Map(prev);

      prev.forEach((info, id) => {
        const age = now - info.lastSeen;
        if (info.isOnline && age > 25000 && !info.isStale) {
          next.set(id, { ...info, isStale: true });
          changed = true;
        }
        if (info.isOnline && age > 75000) {
          next.set(id, { ...info, isOnline: false, isStale: true });
          changed = true;
        }
        if (age > 4 * 60 * 60 * 1000) {
          next.delete(id);
          changed = true;
        }
      });

      if (changed) {
        commitMembers(next);
      }
    }, 4000);

    return () => clearInterval(ageInterval);
  }, [commitMembers]);

  // Convoy Regroup Convergence Engine:
  // Detects when all active squad members converge within 40 meters at a stop (e.g. tea stall, toll booth)
  useEffect(() => {
    const regroupInterval = setInterval(() => {
      if (!profile.isLoggedIn || !isOnRadarRef.current || !myLocationRef.current) return;

      const onlineWithLoc = Array.from(membersRef.current.values()).filter(
        m => m.isOnline && m.location && typeof m.distanceFromMeMeters === 'number'
      );

      // Only evaluate if there's at least 1 other squad member active
      if (onlineWithLoc.length === 0) return;

      const mySpeed = myLocationRef.current.speedKmh || 0;
      const distances = onlineWithLoc.map(m => m.distanceFromMeMeters as number);
      const maxDist = Math.max(...distances);

      // Condition: All active squad members are within 40m AND speed is low (< 18 km/h or stopped)
      const allClose = maxDist <= 40;
      const isSlowOrStopped = mySpeed < 18;

      if (allClose && isSlowOrStopped) {
        const now = Date.now();
        // Trigger if previously separated and at least 2 minutes since last chime
        if (wasSeparatedRef.current && (now - lastRegroupNotificationTimeRef.current > 120000)) {
          wasSeparatedRef.current = false;
          lastRegroupNotificationTimeRef.current = now;
          setIsConvoyRegrouped(true);
          playRegroupChime();
          triggerHaptic([70, 40, 70, 40, 120]);
          postCrewNotification(`🟢 Convoy Regrouped! All ${onlineWithLoc.length + 1} riders assembled.`, 'join');
        }
      } else if (maxDist > 120 || mySpeed > 25) {
        // Convoy has departed / separated on the open road
        wasSeparatedRef.current = true;
        setIsConvoyRegrouped(false);
      }
    }, 3500);

    return () => clearInterval(regroupInterval);
  }, [profile.isLoggedIn, postCrewNotification]);

  // Public Methods
  const updateMyLocation = useCallback((lat: number, lon: number, speedKmh: number, bearing: number | null, leanAngle?: number) => {
    myLocationRef.current = { lat, lon, speedKmh, bearing, leanAngle };

    const now = Date.now();
    const prevDistPos = lastDistanceCoordsRef.current;
    const movedSinceRecalc = !prevDistPos || haversineDistance(prevDistPos.lat, prevDistPos.lon, lat, lon) >= 5;
    if (movedSinceRecalc && now - lastDistanceRecalcRef.current >= 1000 && membersRef.current.size > 0) {
      lastDistanceRecalcRef.current = now;
      lastDistanceCoordsRef.current = { lat, lon };
      const nextMembers = new Map<string, GroupMemberInfo>();
      let distChanged = false;
      membersRef.current.forEach((m, id) => {
        if (m.location && typeof m.location.lat === 'number' && typeof m.location.lon === 'number') {
          const updatedDist = haversineDistance(lat, lon, m.location.lat, m.location.lon);
          nextMembers.set(id, { ...m, distanceFromMeMeters: updatedDist });
          distChanged = true;
        } else {
          nextMembers.set(id, m);
        }
      });
      if (distChanged) {
        commitMembers(nextMembers);
      }
    }

    if (!isOnRadarRef.current) return;

    // Rate-limit position broadcasts to 1500ms to preserve mobile battery and avoid public broker burst-disconnects
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
        leaderId: leaderIdRef.current || undefined,
        lat,
        lon,
        speedKmh,
        bearing,
        leanAngle,
        timestamp: Date.now(),
        status: speedKmh < 2.5 ? 'stopped' : 'riding',
        batteryPct: batteryPctRef.current,
        isCharging: isChargingRef.current,
      },
    });
  }, [broadcastPayload, commitMembers]);

  const toggleOnRadar = useCallback((enable?: boolean) => {
    const next = enable !== undefined ? enable : !isOnRadarRef.current;
    isOnRadarRef.current = next;
    setIsOnRadar(next);
    try {
      localStorage.setItem('sasta_on_radar', String(next));
    } catch {}

    if (!next) {
      // Going off radar: notify local BroadcastChannel AND flush encrypted OFFLINE before closing MQTT socket
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            squadKey: sanitizeSquadKey(profileRef.current.squadName) || 'global',
            data: { type: 'OFFLINE', riderId: profileRef.current.id },
          });
        } catch {}
      }
      const activeClient = mqttClientRef.current;
      const activeCrypto = activeCryptoRef.current;
      mqttClientRef.current = null;
      activeCryptoRef.current = null;
      if (activeClient) {
        gracefulOfflineAndDestroy(activeClient, activeCrypto, profileRef.current.id);
      }
      resetConvoyWatchdog('solo');
      postCrewNotification('👻 Off Radar (Ghost mode) enabled. You are hidden from friends.', 'info');
    } else {
      // Coming back on radar: send HEARTBEAT/LOCATION immediately
      lastLocationBroadcastTimeRef.current = Date.now();
      postCrewNotification('🟢 Back on Crew Radar! You are visible to friends.', 'join');
      const payload: any = {
        riderId: profileRef.current.id,
        name: profileRef.current.name,
        color: profileRef.current.color,
        bikeModel: profileRef.current.bikeModel,
        leaderId: leaderIdRef.current || undefined,
        timestamp: Date.now(),
        status: 'stopped',
        batteryPct: batteryPctRef.current,
        isCharging: isChargingRef.current,
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
  }, [broadcastPayload, postCrewNotification, gracefulOfflineAndDestroy]);

  const broadcastActiveRoute = useCallback((route: { name?: string; distanceKm?: number; destination?: { lat: number; lon: number }; points?: Array<{ lat: number; lon: number }> } | null) => {
    if (!route) {
      if (isOnRadarRef.current) {
        broadcastPayload({
          type: 'ROUTE_CLEAR',
          riderId: profileRef.current.id,
        });
      }
      return;
    }
    if (!isOnRadarRef.current) return;

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
    const hasValidLoc =
      myLocationRef.current !== null &&
      Number.isFinite(myLocationRef.current.lat) &&
      Number.isFinite(myLocationRef.current.lon);
    const loc = hasValidLoc ? myLocationRef.current! : { lat: 0, lon: 0 };
    const senderName = profile.name && profile.name.trim() ? profile.name.trim() : 'Rider';
    const alert: SosAlert = {
      fromId: profile.id,
      fromName: senderName,
      lat: loc.lat,
      lon: loc.lon,
      timestamp: Date.now(),
    };
    sosAlertRef.current = alert;
    setSosAlert(alert);
    broadcastPayload({
      type: 'SOS_PING',
      payload: alert,
    });
    playSosChime();
    triggerHaptic([200, 100, 200, 100, 400]);
    speakAlert(`Emergency S O S alert broadcast to squad for ${senderName}.`);
    postCrewNotification(
      hasValidLoc
        ? '🚨 You broadcast an EMERGENCY S O S alert!'
        : '🚨 Emergency S O S broadcast (awaiting live GPS fix)',
      'alert'
    );
  }, [profile.id, profile.name, broadcastPayload, postCrewNotification]);

  const cancelSos = useCallback(() => {
    const senderName = profile.name && profile.name.trim() ? profile.name.trim() : 'Rider';
    broadcastPayload({
      type: 'SOS_CANCEL',
      payload: {
        fromId: profile.id,
        fromName: senderName,
        timestamp: Date.now(),
      },
    });
    sosAlertRef.current = null;
    setSosAlert(null);
    triggerHaptic([100, 50, 100]);
    postCrewNotification(`🟢 You cancelled the emergency SOS alert. Squad notified.`, 'info');
    speakAlert(`Emergency S O S cancelled. Squad notified you are safe.`);
  }, [profile.id, profile.name, broadcastPayload, postCrewNotification]);

  const dismissSos = useCallback(() => {
    // Authoritatively verify sender identity by riderId when present; fall back to name only for legacy packets
    const isMine = sosAlert?.fromId
      ? sosAlert.fromId === profile.id
      : Boolean(sosAlert?.fromName && sosAlert.fromName === profile.name);
    if (isMine) {
      cancelSos();
    } else {
      sosAlertRef.current = null;
      setSosAlert(null);
    }
  }, [sosAlert, profile.name, profile.id, cancelSos]);

  const loginRider = useCallback((name: string, bikeModel?: string, color?: string, squadName?: string) => {
    const cleanName = (name && name.trim()) || 'Rider';
    const cleanId = profileRef.current.id || generateUniqueRiderId(cleanName);
    const resolvedBike = bikeModel !== undefined ? bikeModel.trim() : (profileRef.current.bikeModel || 'Motorcycle');
    const resolvedColor = color || profileRef.current.color || getRiderColor(cleanId);
    const newProfile: RiderProfile = {
      id: cleanId,
      name: cleanName,
      bikeModel: resolvedBike || 'Motorcycle',
      color: resolvedColor,
      squadName: squadName || DEFAULT_SQUAD_NAME,
      isLoggedIn: true,
    };
    setProfile(newProfile);
    profileRef.current = newProfile;

    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(newProfile));
    saveIdentity('sasta_rider_name', cleanName);
    saveRiderProfile({
      callsign: cleanName,
      bikeModel: newProfile.bikeModel,
      color: resolvedColor,
    });

    postCrewNotification(`👋 Checked in as ${cleanName}! Live on Crew Radar.`, 'join');
  }, [postCrewNotification]);

  const logoutRider = useCallback(() => {
    setProfile(prev => ({ ...prev, isLoggedIn: false }));
    commitMembers(new Map());
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setStatusMessage('Logged out. Check in to rejoin crew radar.');
    resetConvoyWatchdog();
  }, [commitMembers]);

  const updateProfile = useCallback((name: string, bikeModel?: string, color?: string) => {
    const cleanName = (name && name.trim()) || profileRef.current.name || 'Rider';
    const nextBike = bikeModel !== undefined ? (bikeModel.trim() || 'Motorcycle') : (profileRef.current.bikeModel || 'Motorcycle');
    const nextColor = color || profileRef.current.color;
    const updated: RiderProfile = {
      ...profileRef.current,
      name: cleanName,
      bikeModel: nextBike,
      color: nextColor,
    };
    setProfile(updated);
    profileRef.current = updated;

    saveIdentity(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
    saveIdentity('sasta_rider_name', cleanName);
    saveRiderProfile({
      callsign: cleanName,
      bikeModel: nextBike,
      color: nextColor,
    });

    if (isOnRadarRef.current) {
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
    }
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
    let base = window.location.origin + window.location.pathname;
    // When running inside Android Capacitor APK or localhost dev environment, ensure live public URL is shared
    if (base.includes('localhost') || base.startsWith('capacitor://') || base.startsWith('http://localhost') || !base.startsWith('https://')) {
      base = 'https://throttlelog.vercel.app/';
    }
    const params = new URLSearchParams();
    const currentSquad = profileRef.current.squadName;
    if (currentSquad && currentSquad !== DEFAULT_SQUAD_NAME) {
      params.set('crew', currentSquad);
    }
    if (friendName) {
      params.set('rider', friendName);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, []);

  const sendVoiceBlast = useCallback((audioBase64: string, durationMs: number, mimeType: string = 'audio/webm') => {
    if (!audioBase64) return;
    const cleanMime = (mimeType || 'audio/webm').trim();
    if (
      audioBase64.length > MAX_VOICE_BLAST_B64_CHARS ||
      !VOICE_BLAST_BASE64_RE.test(audioBase64) ||
      !VOICE_BLAST_ALLOWED_MIMES.test(cleanMime)
    ) {
      postCrewNotification('⚠️ Voice blast exceeded 8s/100KB limit or invalid audio format.', 'alert');
      return;
    }
    const payload: VoiceBlastPayload = {
      riderId: profileRef.current.id,
      riderName: profileRef.current.name,
      bikeModel: profileRef.current.bikeModel,
      color: profileRef.current.color,
      audioBase64,
      durationMs: Math.min(Math.max(Number(durationMs) || 3000, 500), 10000),
      mimeType: cleanMime,
      timestamp: Date.now(),
    };
    broadcastPayload({
      type: 'VOICE_BLAST',
      payload,
    });
    postCrewNotification(`🎙️ Voice blast sent to crew radar!`, 'info');
  }, [broadcastPayload, postCrewNotification]);

  const sendCallout = useCallback((preset: CalloutPreset) => {
    const payload: RiderCallout = {
      id: `callout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      riderId: profileRef.current.id,
      riderName: profileRef.current.name,
      bikeModel: profileRef.current.bikeModel,
      color: profileRef.current.color,
      type: preset.type,
      icon: preset.icon,
      title: preset.label,
      message: preset.spokenText,
      spokenText: preset.spokenText,
      timestamp: Date.now(),
    };

    // Locally announce & show confirmation for the sender
    playCalloutAlert('You', preset.spokenText);
    setActiveCallout(payload);
    if (calloutTimeoutRef.current) clearTimeout(calloutTimeoutRef.current);
    calloutTimeoutRef.current = setTimeout(() => {
      setActiveCallout(null);
    }, 10000);

    // Broadcast over MQTT to all squad members on the radar
    broadcastPayload({
      type: 'CALLOUT',
      payload,
    });

    postCrewNotification(`Sent callout: "${preset.label}"`, 'info');
  }, [broadcastPayload, postCrewNotification]);

  const setSquadLeader = useCallback((targetRiderId: string, targetName: string) => {
    const myId = profileRef.current.id;
    const existingLeader = leaderIdRef.current;
    const leaderOnlineOther = Boolean(
      existingLeader &&
      existingLeader !== myId &&
      membersRef.current.get(existingLeader)?.isOnline
    );
    if (existingLeader !== null && existingLeader !== myId && leaderOnlineOther) {
      postCrewNotification('⚠️ Only the current active Ride Lead can reassign leadership.', 'alert');
      return;
    }

    setLeaderId(targetRiderId);
    leaderIdRef.current = targetRiderId;
    try {
      localStorage.setItem(getLeaderStorageKey(profileRef.current.squadName), targetRiderId);
    } catch {}
    const next = new Map<string, GroupMemberInfo>();
    membersRef.current.forEach((val, key) => {
      next.set(key, { ...val, isHost: key === targetRiderId });
    });
    commitMembers(next);
    broadcastPayload({
      type: 'SET_LEADER',
      payload: { leaderId: targetRiderId, leaderName: targetName, senderId: myId },
    });
    playRegroupChime();
    speakAlert(`${targetName} is now the ride leader.`);
    postCrewNotification(`👑 ${targetName} designated as Ride Lead!`, 'info');
  }, [broadcastPayload, postCrewNotification, commitMembers]);

  const claimSquadLeader = useCallback(() => {
    setSquadLeader(profileRef.current.id, profileRef.current.name);
  }, [setSquadLeader]);

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
    leaderId,
    isHost: profile.id === leaderId,
    setSquadLeader,
    claimSquadLeader,
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
    isVoiceBlastMuted,
    toggleVoiceBlastMuted,
    sendVoiceBlast,
    activeCallout,
    dismissCallout: () => setActiveCallout(null),
    sendCallout,
    isConvoyRegrouped,
    updateMyLocation,
    triggerSos,
    cancelSos,
    dismissSos,
    isOnRadar,
    toggleOnRadar,
    myBattery,
    broadcastActiveRoute,
    updateRiderName,
    updateProfile,
    createRoom: (name: string) => loginRider(name),
    joinRoom: (code: string, name?: string) => {
      loginRider(name || profileRef.current.name, undefined, undefined, code);
      if (!isOnRadarRef.current) {
        isOnRadarRef.current = true;
        setIsOnRadar(true);
        try {
          localStorage.setItem('sasta_on_radar', 'true');
        } catch {}
      }
      postCrewNotification(`🛰️ Joined Squad [${code}] on Crew Radar`, 'join');
    },
    rejoinRoom: () => loginRider(profile.name),
    leaveRoom: logoutRider,
  };
}

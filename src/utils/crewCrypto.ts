/**
 * Room-Derived Web Crypto AES-GCM Encryption & Topic Hashing for Crew Radar
 *
 * Ensures public MQTT relay brokers (HiveMQ / EMQX) never see plaintext rider GPS,
 * callsigns, routes, SOS alerts, or PTT voice audio, and rejects unauthenticated or
 * cross-room spoofed control packets via AES-GCM 128-bit authentication tags + AAD.
 */

export interface EncryptedSquadEnvelope {
  v: 2;
  enc: 1;
  roomHash: string;
  iv: string;
  ct: string;
}

export interface SquadCryptoContext {
  squadKey: string;
  roomHash: string;
  topic: string;
  secret: string;
  isPrivate: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const derivedKeyCache = new Map<string, Promise<CryptoKey>>();

export function sanitizeSquadKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) unavailable in this context');
  }
  return subtle;
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getRoomAesKey(secret: string, roomHash: string): Promise<CryptoKey> {
  const cacheKey = `${roomHash}:${secret}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) return cached;

  const keyPromise = (async () => {
    const subtle = getSubtleCrypto();
    const baseKey = await subtle.importKey(
      'raw',
      encoder.encode(secret),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(`throttlelog-aes-gcm-v2:${roomHash}`),
        iterations: 5000,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  if (derivedKeyCache.size >= 16) {
    const firstKey = derivedKeyCache.keys().next().value;
    if (firstKey !== undefined) derivedKeyCache.delete(firstKey);
  }
  derivedKeyCache.set(cacheKey, keyPromise);

  try {
    return await keyPromise;
  } catch (err) {
    derivedKeyCache.delete(cacheKey);
    throw err;
  }
}

export async function deriveRoomCryptoContext(squadName: string): Promise<SquadCryptoContext> {
  const cleaned = sanitizeSquadKey(squadName);
  const isPrivate = Boolean(cleaned && cleaned !== 'global' && cleaned !== 'globalcrew');
  const squadKey = isPrivate ? cleaned : 'global';

  if (isPrivate) {
    const fullHash = await sha256Hex(`throttlelog:topic:v2:${cleaned}`);
    const roomHash = fullHash.slice(0, 24);
    return {
      squadKey,
      roomHash,
      topic: `throttlelog/v2/squad/${roomHash}`,
      secret: cleaned,
      isPrivate: true,
    };
  }

  return {
    squadKey: 'global',
    roomHash: 'global00',
    topic: 'throttlelog/v2/radar/global',
    secret: 'throttlelog_open_global_v2',
    isPrivate: false,
  };
}

export async function encryptCrewPayload(
  secret: string,
  roomHash: string,
  payload: unknown
): Promise<EncryptedSquadEnvelope> {
  const subtle = getSubtleCrypto();
  const key = await getRoomAesKey(secret, roomHash);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const encrypted = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode(roomHash),
    },
    key,
    plaintext
  );

  return {
    v: 2,
    enc: 1,
    roomHash,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptCrewPayload(
  secret: string,
  roomHash: string,
  raw: unknown
): Promise<any | null> {
  if (!raw || typeof raw !== 'object') return null;
  const env = raw as Partial<EncryptedSquadEnvelope>;
  if (
    env.v !== 2 ||
    env.enc !== 1 ||
    env.roomHash !== roomHash ||
    typeof env.iv !== 'string' ||
    typeof env.ct !== 'string'
  ) {
    return null;
  }

  try {
    const subtle = getSubtleCrypto();
    const key = await getRoomAesKey(secret, roomHash);
    const iv = base64ToBytes(env.iv);
    if (iv.length !== 12) return null;
    const ct = base64ToBytes(env.ct);
    const decrypted = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: encoder.encode(roomHash),
      },
      key,
      ct
    );
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    // Reject tampered, cross-room, or malformed ciphertext silently
    return null;
  }
}

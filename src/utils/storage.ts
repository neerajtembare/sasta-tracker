export interface SavedRide {
  id: string;
  name: string;
  date: string;
  gpxContent: string;
  distanceKm: number;
  maxSpeedKmh: number;
  createdAt?: number;
  durationSeconds?: number;
  avgSpeedKmh?: number;
  movingTimeSeconds?: number;
  elevGainM?: number;
  rideType?: 'solo' | 'crew';
  mountMode?: 'handlebar' | 'pocket';
}

const STORAGE_KEY = 'throttlelog_garage_v2';
const LEGACY_SASTA_STORAGE_KEY = 'sasta_tracker_garage';
const OLD_STORAGE_KEY = 'kinetic_motogpx_garage';
const PIN_STORAGE_KEY = 'throttlelog_garage_pin_v2';
const LEGACY_PIN_STORAGE_KEY = 'sasta_tracker_garage_pin';
const DB_NAME = 'SastaTrackerGarageDB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_rides';

// In-memory cache for ultra-fast synchronous UI queries
let memoryCache: SavedRide[] | null = null;
let isSessionUnlocked = false;
let cachedDbPromise: Promise<IDBDatabase | null> | null = null;
const dirtyUpserts = new Map<string, SavedRide>();
const dirtyDeletes = new Set<string>();
let clearedAllBeforeIdb = false;

export function generateSafeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback if in non-secure context
    }
  }
  return 'ride_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// ─── IndexedDB Promise Helpers ─────────────────────────────────────
function openIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (cachedDbPromise) {
    return cachedDbPromise;
  }
  cachedDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => { cachedDbPromise = null; };
        db.onversionchange = () => {
          db.close();
          cachedDbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        cachedDbPromise = null;
        resolve(null);
      };
    } catch {
      cachedDbPromise = null;
      resolve(null);
    }
  });
  return cachedDbPromise;
}

// ─── Atomic IndexedDB Helpers ─────────────────────────────────────
let idbInitPromise: Promise<SavedRide[]> | null = null;

async function putRideInIndexedDB(ride: SavedRide): Promise<void> {
  const db = await openIDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(ride);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deleteRideFromIndexedDB(id: string): Promise<void> {
  const db = await openIDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearAllInIndexedDB(): Promise<void> {
  const db = await openIDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function batchPutRidesInIndexedDB(rides: SavedRide[]): Promise<void> {
  const db = await openIDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const ride of rides) {
        store.put(ride);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function initIndexedDB(): Promise<SavedRide[]> {
  if (idbInitPromise) return idbInitPromise;

  idbInitPromise = (async () => {
    const db = await openIDB();
    if (!db) return getGarageRides();

    return new Promise<SavedRide[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const results = req.result;
          if (Array.isArray(results) && results.length > 0 && !clearedAllBeforeIdb) {
            const mergedMap = new Map<string, SavedRide>();
            for (const item of results) {
              if (item?.id && !dirtyDeletes.has(item.id)) {
                mergedMap.set(item.id, item);
              }
            }
            for (const [id, ride] of dirtyUpserts.entries()) {
              if (!dirtyDeletes.has(id)) {
                mergedMap.set(id, ride);
              }
            }
            const merged = Array.from(mergedMap.values()).sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
            memoryCache = merged;
            // Mirror recent 15 rides to localStorage as fast offline fallback
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 15)));
            } catch {
              // Ignore quota
            }
            resolve(merged);
          } else if (clearedAllBeforeIdb) {
            const dirtyOnly = Array.from(dirtyUpserts.values()).sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
            memoryCache = dirtyOnly;
            resolve(dirtyOnly);
          } else {
            // If IndexedDB is empty on first migration, seed from legacy localStorage
            const local = getGarageRides();
            if (local.length > 0) {
              batchPutRidesInIndexedDB(local).catch(() => {});
            }
            resolve(local);
          }
        };
        req.onerror = () => resolve(getGarageRides());
      } catch {
        resolve(getGarageRides());
      }
    });
  })();

  return idbInitPromise;
}

// Kick off IndexedDB initialization in browser environment
if (typeof window !== 'undefined') {
  initIndexedDB().catch(err => console.warn('IndexedDB init notice:', err));
}

// Helper to extract timestamp from ride
function getRideTimestamp(ride: SavedRide): number {
  if (ride.createdAt && !isNaN(ride.createdAt)) return ride.createdAt;
  if (ride.date) {
    const parsed = Date.parse(ride.date);
    if (!isNaN(parsed)) return parsed;
  }
  // Try extracting timestamp from ID like 'ride_1760000000000_...'
  if (ride.id && ride.id.startsWith('ride_')) {
    const parts = ride.id.split('_');
    const ts = parseInt(parts[1], 10);
    if (!isNaN(ts)) return ts;
  }
  return 0;
}

// ─── Synchronous Garage Storage API ───────────────────────────────
export function getGarageRides(): SavedRide[] {
  if (memoryCache !== null) {
    return memoryCache;
  }

  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_SASTA_STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
      }
    }
    if (!raw) {
      memoryCache = [];
      return [];
    }
    const parsed = JSON.parse(raw);
    const list: SavedRide[] = Array.isArray(parsed) ? parsed : [];
    // Always sort newest first
    list.sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
    memoryCache = list;
    return memoryCache;
  } catch (e) {
    console.error('Error reading garage rides from localStorage', e);
    memoryCache = [];
    return [];
  }
}

function syncLocalStorageMirror(rides: SavedRide[]): void {
  // Mirror recent 15 rides to localStorage with quota-safe trimming
  let list = [...rides].slice(0, 15);
  let attempts = 0;
  while (attempts < 5) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return;
    } catch {
      if (list.length > 1) {
        list = list.slice(0, list.length - 1);
        attempts++;
      } else {
        break;
      }
    }
  }
}

export function saveRideToGarage(ride: Omit<SavedRide, 'id' | 'date'> & { id?: string; createdAt?: number }): SavedRide {
  const rides = getGarageRides();
  const id = ride.id || generateSafeId();
  const now = Date.now();
  const nowFormatted = new Date(now).toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const existingIndex = rides.findIndex(r => r.id === id);
  let savedRecord: SavedRide;

  if (existingIndex >= 0) {
    savedRecord = {
      ...rides[existingIndex],
      ...ride,
      id,
      date: nowFormatted,
      createdAt: ride.createdAt ?? rides[existingIndex].createdAt ?? now,
    };
  } else {
    savedRecord = {
      ...ride,
      id,
      date: nowFormatted,
      createdAt: ride.createdAt ?? now,
    };
  }

  // Prepend to top — newest ride is ALWAYS at index 0!
  const otherRides = rides.filter(r => r.id !== id);
  const updatedList = [savedRecord, ...otherRides].sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));

  dirtyDeletes.delete(id);
  dirtyUpserts.set(id, savedRecord);
  memoryCache = updatedList;

  // Atomic IndexedDB write — NEVER clears the DB!
  putRideInIndexedDB(savedRecord).catch(e => {
    console.warn('Atomic IndexedDB put error:', e);
  });

  // Mirror recent rides to localStorage
  syncLocalStorageMirror(updatedList);

  if (typeof window !== 'undefined') {
    import('./cloudSync').then(m => m.triggerBackgroundAutoSync()).catch(() => {});
  }
  return savedRecord;
}

export function updateGarageRide(id: string, updates: Partial<Omit<SavedRide, 'id'>>): SavedRide[] {
  const rides = getGarageRides();
  const idx = rides.findIndex(r => r.id === id);
  if (idx < 0) return rides;

  // Preserve original chronological createdAt so editing a title never bumps old rides to LATEST
  const updatedRecord: SavedRide = {
    ...rides[idx],
    ...updates,
    createdAt: rides[idx].createdAt ?? getRideTimestamp(rides[idx]),
  };

  const updatedList = rides.map(r => (r.id === id ? updatedRecord : r)).sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
  dirtyDeletes.delete(id);
  dirtyUpserts.set(id, updatedRecord);
  memoryCache = updatedList;

  // Atomic IndexedDB update
  putRideInIndexedDB(updatedRecord).catch(e => {
    console.warn('Atomic IndexedDB update error:', e);
  });

  syncLocalStorageMirror(updatedList);
  return updatedList;
}

export function deleteGarageRide(id: string): SavedRide[] {
  const rides = getGarageRides().filter(r => r.id !== id);
  dirtyUpserts.delete(id);
  dirtyDeletes.add(id);
  memoryCache = rides;

  // Atomic IndexedDB deletion
  deleteRideFromIndexedDB(id).catch(e => {
    console.warn('Atomic IndexedDB delete error:', e);
  });

  syncLocalStorageMirror(rides);
  return rides;
}

export function clearAllGarageRides(): void {
  clearedAllBeforeIdb = true;
  dirtyUpserts.clear();
  dirtyDeletes.clear();
  memoryCache = [];
  clearAllInIndexedDB().catch(e => {
    console.warn('IndexedDB clear error:', e);
  });
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_SASTA_STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch {}
}

export function importGarageBackup(importedRides: any[]): SavedRide[] {
  if (!Array.isArray(importedRides)) {
    throw new Error('Invalid backup file format: expected array of rides');
  }
  const current = getGarageRides();
  const currentMap = new Map<string, SavedRide>(current.map(r => [r.id, r]));

  let countAdded = 0;
  for (const r of importedRides) {
    if (!r || typeof r !== 'object' || !r.name || !r.gpxContent) continue;
    const safeId = r.id || generateSafeId();
    const rideCreated = r.createdAt && !isNaN(Number(r.createdAt))
      ? Number(r.createdAt)
      : (r.date ? Date.parse(r.date) || Date.now() : Date.now());
    currentMap.set(safeId, {
      id: safeId,
      name: String(r.name),
      date: r.date ? String(r.date) : new Date().toLocaleDateString(),
      createdAt: rideCreated,
      gpxContent: String(r.gpxContent),
      distanceKm: Number(r.distanceKm) || 0,
      maxSpeedKmh: Number(r.maxSpeedKmh) || 0,
      durationSeconds: r.durationSeconds !== undefined ? Number(r.durationSeconds) : undefined,
      avgSpeedKmh: r.avgSpeedKmh !== undefined ? Number(r.avgSpeedKmh) : undefined,
      movingTimeSeconds: r.movingTimeSeconds !== undefined ? Number(r.movingTimeSeconds) : undefined,
      elevGainM: r.elevGainM !== undefined ? Number(r.elevGainM) : undefined,
      rideType: r.rideType === 'crew' || r.rideType === 'solo' ? r.rideType : undefined,
      mountMode: r.mountMode === 'handlebar' || r.mountMode === 'pocket' ? r.mountMode : undefined,
    });
    countAdded++;
  }

  if (countAdded === 0) {
    throw new Error('No valid rides found in backup file');
  }

  const merged = Array.from(currentMap.values()).sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
  memoryCache = merged;
  batchPutRidesInIndexedDB(merged).catch(e => {
    console.warn('Batch put error in importGarageBackup:', e);
  });
  syncLocalStorageMirror(merged);
  return merged;
}

// ─── Optional Garage PIN / Salted SHA-256 Hash Protection ─────────
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const totalLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(totalLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map(n => n.toString(16).padStart(8, '0')).join('');
}

function derivePinDigest(pin: string, saltHex: string): string {
  let acc = `${saltHex}:${pin}`;
  for (let i = 0; i < 2500; i++) {
    acc = sha256HexSync(`${acc}:${saltHex}`);
  }
  return `v2:${saltHex}:${acc}`;
}

function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function hasGaragePin(): boolean {
  try {
    return Boolean(localStorage.getItem(PIN_STORAGE_KEY) || localStorage.getItem(LEGACY_PIN_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function getGaragePin(): string | null {
  // Never expose raw PIN string outside storage module
  return hasGaragePin() ? '[SET]' : null;
}

export function setGaragePin(newPin: string | null): void {
  try {
    localStorage.removeItem(LEGACY_PIN_STORAGE_KEY);
    if (!newPin || newPin.trim() === '') {
      localStorage.removeItem(PIN_STORAGE_KEY);
      isSessionUnlocked = true;
    } else {
      const salt = generateSaltHex();
      localStorage.setItem(PIN_STORAGE_KEY, derivePinDigest(newPin.trim(), salt));
      isSessionUnlocked = true;
    }
  } catch (e) {
    console.error('Failed to set PIN', e);
  }
}

export function isGarageLocked(): boolean {
  if (!hasGaragePin()) return false;
  return !isSessionUnlocked;
}

export function verifyGaragePin(enteredPin: string): boolean {
  try {
    const clean = enteredPin.trim();
    const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
    if (storedHash && storedHash.startsWith('v2:')) {
      const parts = storedHash.split(':');
      if (parts.length === 3) {
        const expected = derivePinDigest(clean, parts[1]);
        if (constantTimeEquals(storedHash, expected)) {
          isSessionUnlocked = true;
          return true;
        }
        return false;
      }
    }

    // Legacy migration: verify plaintext once, immediately upgrade to salted SHA-256, and purge plaintext key
    const legacyPin = localStorage.getItem(LEGACY_PIN_STORAGE_KEY);
    if (legacyPin) {
      if (constantTimeEquals(clean, legacyPin.trim())) {
        setGaragePin(clean);
        isSessionUnlocked = true;
        return true;
      }
      return false;
    }

    isSessionUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function lockGarageSession(): void {
  isSessionUnlocked = false;
}

// ─── Premade Groups / Saved Crews ─────────────────────────────────
export interface SavedCrew {
  id: string; // e.g. "crew_1728900000"
  name: string; // e.g. "Sunday Ghats Riders"
  code: string; // e.g. "SUNDAY" or "PUNE44"
  members: string[]; // e.g. ["Neeraj", "Rahul", "Sam"]
  createdAt: number;
  lastActive?: number;
}

const SAVED_CREWS_STORAGE_KEY = 'throttlelog_saved_crews';

export function getSavedCrews(): SavedCrew[] {
  try {
    const raw = localStorage.getItem(SAVED_CREWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCrew(crew: SavedCrew): SavedCrew[] {
  try {
    const current = getSavedCrews();
    const existingIndex = current.findIndex(c => c.id === crew.id);
    let updated: SavedCrew[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...crew, lastActive: Date.now() };
    } else {
      updated = [{ ...crew, lastActive: Date.now() }, ...current];
    }
    localStorage.setItem(SAVED_CREWS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save crew', e);
    return getSavedCrews();
  }
}

export function deleteCrew(crewId: string): SavedCrew[] {
  try {
    const current = getSavedCrews();
    const updated = current.filter(c => c.id !== crewId);
    localStorage.setItem(SAVED_CREWS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedCrews();
  }
}

export function addMemberToCrew(crewId: string, memberName: string): SavedCrew[] {
  const cleanName = memberName.trim();
  if (!cleanName) return getSavedCrews();
  const current = getSavedCrews();
  const crew = current.find(c => c.id === crewId);
  if (!crew) return current;
  if (crew.members.includes(cleanName)) return current;
  const updatedCrew: SavedCrew = {
    ...crew,
    members: [...crew.members, cleanName],
  };
  return saveCrew(updatedCrew);
}

export function removeMemberFromCrew(crewId: string, memberName: string): SavedCrew[] {
  const current = getSavedCrews();
  const crew = current.find(c => c.id === crewId);
  if (!crew) return current;
  const updatedCrew: SavedCrew = {
    ...crew,
    members: crew.members.filter(m => m !== memberName),
  };
  return saveCrew(updatedCrew);
}

// ─── Crash & Live Session Recovery Storage (IndexedDB + Synchronous Fallback) ─
export interface LiveRecoveryData {
  points: any[];
  elapsedSeconds: number;
  movingSeconds: number;
  stoppedSeconds: number;
  totalDistanceMeters: number;
  waypoints: any[];
  timestamp: number;
  rideType?: 'solo' | 'crew';
  mountMode?: 'handlebar' | 'pocket';
}

const RECOVERY_DB_NAME = 'ThrottleLogRecoveryDB';
const RECOVERY_DB_VERSION = 2;
const RECOVERY_STORE_NAME = 'active_session';
const RECOVERY_POINTS_STORE = 'recovery_points';
const RECOVERY_STORAGE_KEY = 'throttlelog_live_recovery_v1';
const LEGACY_RECOVERY_KEY = 'sasta_live_recovery_v1';

let recoveryDbPromise: Promise<IDBDatabase | null> | null = null;

function openRecoveryIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (recoveryDbPromise) return recoveryDbPromise;

  recoveryDbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(RECOVERY_DB_NAME, RECOVERY_DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db: IDBDatabase = event.target.result;
        if (!db.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
          db.createObjectStore(RECOVERY_STORE_NAME, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(RECOVERY_POINTS_STORE)) {
          db.createObjectStore(RECOVERY_POINTS_STORE, { keyPath: 'idx' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          recoveryDbPromise = null;
        };
        db.onclose = () => {
          recoveryDbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        recoveryDbPromise = null;
        resolve(null);
      };
    } catch {
      recoveryDbPromise = null;
      resolve(null);
    }
  });

  return recoveryDbPromise;
}

export interface IncrementalRecoveryDelta {
  newPoints: Array<{ idx: number; point: any }>;
  totalPointsCount: number;
  metadata: Omit<LiveRecoveryData, 'points'>;
  resetPoints?: boolean;
  fallbackTailPoints?: any[];
}

/**
 * Incrementally appends new GPS trackpoints and session metadata to IndexedDB
 * without re-serializing multi-hour point arrays every 15 seconds.
 */
export async function saveRecoveryDelta(delta: IncrementalRecoveryDelta): Promise<boolean> {
  let idbSaved = false;

  try {
    const db = await openRecoveryIDB();
    if (db) {
      idbSaved = await new Promise<boolean>(resolve => {
        try {
          const tx = db.transaction([RECOVERY_STORE_NAME, RECOVERY_POINTS_STORE], 'readwrite');
          const metaStore = tx.objectStore(RECOVERY_STORE_NAME);
          const pointsStore = tx.objectStore(RECOVERY_POINTS_STORE);

          if (delta.resetPoints) {
            pointsStore.clear();
            metaStore.delete('current');
          }

          for (const entry of delta.newPoints) {
            pointsStore.put({ idx: entry.idx, pt: entry.point });
          }

          metaStore.put({
            key: 'meta',
            ...delta.metadata,
            totalPointsCount: delta.totalPointsCount,
          });

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    }
  } catch (e) {
    console.warn('IDB incremental recovery save warning:', e);
  }

  // Secondary: write lightweight summary when IDB succeeds, or bounded tail when IDB is unavailable
  try {
    const tailPts = delta.fallbackTailPoints || delta.newPoints.slice(-20).map(p => p.point);
    const lightSnapshot = JSON.stringify({
      ...delta.metadata,
      points: idbSaved ? [] : tailPts,
      totalPointsCount: delta.totalPointsCount,
      idbBacked: idbSaved,
      truncatedForStorage: !idbSaved && delta.totalPointsCount > tailPts.length,
    });
    localStorage.setItem(RECOVERY_STORAGE_KEY, lightSnapshot);
  } catch {
    // Quota reached on localStorage is safely ignored when IDB has the full point set
  }

  return idbSaved;
}

export async function saveRecoverySnapshot(data: LiveRecoveryData): Promise<void> {
  const pts = data.points || [];
  await saveRecoveryDelta({
    newPoints: pts.map((point, idx) => ({ idx, point })),
    totalPointsCount: pts.length,
    resetPoints: true,
    fallbackTailPoints: pts.slice(-500),
    metadata: {
      elapsedSeconds: data.elapsedSeconds,
      movingSeconds: data.movingSeconds,
      stoppedSeconds: data.stoppedSeconds,
      totalDistanceMeters: data.totalDistanceMeters,
      waypoints: data.waypoints,
      timestamp: data.timestamp,
      rideType: data.rideType,
      mountMode: data.mountMode,
    },
  });
}

export async function loadRecoverySnapshot(): Promise<LiveRecoveryData | null> {
  // 1. Primary: Read incremental v2 recovery metadata + points from IndexedDB
  try {
    const db = await openRecoveryIDB();
    if (db) {
      const result = await new Promise<LiveRecoveryData | null>(resolve => {
        try {
          const tx = db.transaction([RECOVERY_STORE_NAME, RECOVERY_POINTS_STORE], 'readonly');
          const metaStore = tx.objectStore(RECOVERY_STORE_NAME);
          const pointsStore = tx.objectStore(RECOVERY_POINTS_STORE);

          const metaReq = metaStore.get('meta');
          const ptsReq = pointsStore.getAll();
          const legacyReq = metaStore.get('current');

          tx.oncomplete = () => {
            const meta = metaReq.result;
            const rows: Array<{ idx: number; pt: any }> = ptsReq.result || [];
            if (meta && rows.length > 0) {
              rows.sort((a, b) => a.idx - b.idx);
              resolve({
                points: rows.map(r => r.pt),
                elapsedSeconds: meta.elapsedSeconds || 0,
                movingSeconds: meta.movingSeconds || 0,
                stoppedSeconds: meta.stoppedSeconds || 0,
                totalDistanceMeters: meta.totalDistanceMeters || 0,
                waypoints: meta.waypoints || [],
                timestamp: meta.timestamp || Date.now(),
                rideType: meta.rideType,
                mountMode: meta.mountMode,
              });
              return;
            }
            const legacy = legacyReq.result;
            if (legacy && Array.isArray(legacy.points) && legacy.points.length > 0) {
              resolve(legacy as LiveRecoveryData);
              return;
            }
            resolve(null);
          };
          tx.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (result && result.points && result.points.length > 0) {
        return result;
      }
    }
  } catch (e) {
    console.warn('IDB recovery read warning:', e);
  }

  // 2. Fallback to localStorage / legacy keys
  try {
    let raw = localStorage.getItem(RECOVERY_STORAGE_KEY) || localStorage.getItem(LEGACY_RECOVERY_KEY);
    if (!raw) {
      raw = sessionStorage.getItem('sasta_live_recovery');
    }
    if (raw) {
      const parsed = JSON.parse(raw) as LiveRecoveryData;
      if (parsed && Array.isArray(parsed.points) && parsed.points.length > 0) {
        return parsed;
      }
    }
  } catch {}

  return null;
}

export async function clearRecoverySnapshot(): Promise<void> {
  try {
    const db = await openRecoveryIDB();
    if (db) {
      await new Promise<void>(resolve => {
        try {
          const tx = db.transaction([RECOVERY_STORE_NAME, RECOVERY_POINTS_STORE], 'readwrite');
          const metaStore = tx.objectStore(RECOVERY_STORE_NAME);
          const pointsStore = tx.objectStore(RECOVERY_POINTS_STORE);
          metaStore.delete('meta');
          metaStore.delete('current');
          pointsStore.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {}

  try {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_RECOVERY_KEY);
    sessionStorage.removeItem('sasta_live_recovery');
  } catch {}
}

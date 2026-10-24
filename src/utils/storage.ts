export interface SavedRide {
  id: string;
  name: string;
  date: string;
  gpxContent: string;
  distanceKm: number;
  maxSpeedKmh: number;
  createdAt?: number;
}

const STORAGE_KEY = 'sasta_tracker_garage';
const OLD_STORAGE_KEY = 'kinetic_motogpx_garage';
const PIN_STORAGE_KEY = 'sasta_tracker_garage_pin';
const DB_NAME = 'SastaTrackerGarageDB';
const DB_VERSION = 1;
const STORE_NAME = 'saved_rides';

// In-memory cache for ultra-fast synchronous UI queries
let memoryCache: SavedRide[] | null = null;
let isSessionUnlocked = false;

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
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
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
          if (Array.isArray(results) && results.length > 0) {
            results.sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
            memoryCache = results;
            // Mirror recent 15 rides to localStorage as fast offline fallback
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, 15)));
            } catch {
              // Ignore quota
            }
            resolve(results);
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
      raw = localStorage.getItem(OLD_STORAGE_KEY);
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
      createdAt: now,
    };
  } else {
    savedRecord = {
      ...ride,
      id,
      date: nowFormatted,
      createdAt: now,
    };
  }

  // Prepend to top — newest ride is ALWAYS at index 0!
  const otherRides = rides.filter(r => r.id !== id);
  const updatedList = [savedRecord, ...otherRides].sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));

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

  const updatedRecord: SavedRide = {
    ...rides[idx],
    ...updates,
    createdAt: Date.now(),
  };

  const otherRides = rides.filter(r => r.id !== id);
  const updatedList = [updatedRecord, ...otherRides].sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
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
  memoryCache = rides;

  // Atomic IndexedDB deletion
  deleteRideFromIndexedDB(id).catch(e => {
    console.warn('Atomic IndexedDB delete error:', e);
  });

  syncLocalStorageMirror(rides);
  return rides;
}

export function clearAllGarageRides(): void {
  memoryCache = [];
  clearAllInIndexedDB().catch(e => {
    console.warn('IndexedDB clear error:', e);
  });
  try {
    localStorage.removeItem(STORAGE_KEY);
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

// ─── Optional Garage PIN / Password Protection ────────────────────
export function getGaragePin(): string | null {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setGaragePin(newPin: string | null): void {
  try {
    if (!newPin || newPin.trim() === '') {
      localStorage.removeItem(PIN_STORAGE_KEY);
      isSessionUnlocked = true;
    } else {
      localStorage.setItem(PIN_STORAGE_KEY, newPin.trim());
      isSessionUnlocked = true;
    }
  } catch (e) {
    console.error('Failed to set PIN', e);
  }
}

export function isGarageLocked(): boolean {
  const pin = getGaragePin();
  if (!pin) return false;
  return !isSessionUnlocked;
}

export function verifyGaragePin(enteredPin: string): boolean {
  const pin = getGaragePin();
  if (!pin) {
    isSessionUnlocked = true;
    return true;
  }
  if (enteredPin.trim() === pin) {
    isSessionUnlocked = true;
    return true;
  }
  return false;
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

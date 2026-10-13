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

async function saveToIndexedDB(rides: SavedRide[]): Promise<void> {
  const db = await openIDB();
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Clear and re-populate to keep exact order and avoid stale records
      store.clear();
      for (const ride of rides) {
        store.put(ride);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      resolve();
    }
  });
}

export async function initIndexedDB(): Promise<SavedRide[]> {
  const db = await openIDB();
  if (!db) return getGarageRides();

  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result;
        if (Array.isArray(results) && results.length > 0) {
          memoryCache = results;
          // Synchronize back to localStorage top 10 as fallback
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(results.slice(0, 10)));
          } catch {
            // Ignore quota
          }
          resolve(results);
        } else {
          // If IndexedDB is empty, seed from localStorage
          const local = getGarageRides();
          if (local.length > 0) {
            saveToIndexedDB(local).catch(() => {});
          }
          resolve(local);
        }
      };
      req.onerror = () => resolve(getGarageRides());
    } catch {
      resolve(getGarageRides());
    }
  });
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

function persistRides(ridesToPersist: SavedRide[]): SavedRide[] {
  // Ensure strict newest-first sorting before persisting
  const sorted = [...ridesToPersist].sort((a, b) => getRideTimestamp(b) - getRideTimestamp(a));
  memoryCache = sorted;

  // 1. Asynchronously persist to high-capacity IndexedDB (gigabytes available)
  saveToIndexedDB(memoryCache).catch(e => {
    console.warn('Background IndexedDB sync warning:', e);
  });

  // 2. Also keep recent rides in localStorage as instant sync fallback
  let list = [...memoryCache];
  let attempts = 0;
  while (attempts < 5) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return memoryCache;
    } catch (e) {
      if (list.length > 1) {
        list = list.slice(0, list.length - 1);
        attempts++;
      } else {
        break;
      }
    }
  }

  return memoryCache;
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
  const updatedList = [savedRecord, ...otherRides].slice(0, 100);

  persistRides(updatedList);
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
  return persistRides([updatedRecord, ...otherRides]);
}

export function deleteGarageRide(id: string): SavedRide[] {
  const rides = getGarageRides().filter(r => r.id !== id);
  return persistRides(rides);
}

export function clearAllGarageRides(): void {
  persistRides([]);
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
    currentMap.set(safeId, {
      id: safeId,
      name: String(r.name),
      date: r.date ? String(r.date) : new Date().toLocaleDateString(),
      gpxContent: String(r.gpxContent),
      distanceKm: Number(r.distanceKm) || 0,
      maxSpeedKmh: Number(r.maxSpeedKmh) || 0,
    });
    countAdded++;
  }

  if (countAdded === 0) {
    throw new Error('No valid rides found in backup file');
  }

  const merged = Array.from(currentMap.values()).slice(0, 100);
  return persistRides(merged);
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

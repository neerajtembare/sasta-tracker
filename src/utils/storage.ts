export interface SavedRide {
  id: string;
  name: string;
  date: string;
  gpxContent: string;
  distanceKm: number;
  maxSpeedKmh: number;
}

const STORAGE_KEY = 'kinetic_motogpx_garage';

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

export function getGarageRides(): SavedRide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading garage rides from localStorage', e);
    return [];
  }
}

function persistRidesWithQuotaEviction(ridesToPersist: SavedRide[]) {
  let list = [...ridesToPersist];
  let attempts = 0;
  while (attempts < 5) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return list;
    } catch (e) {
      // If quota exceeded, evict the oldest ride from the bottom of the list and retry
      if (list.length > 1) {
        console.warn('Storage quota exceeded, evicting oldest ride to make space...');
        list = list.slice(0, list.length - 1);
        attempts++;
      } else {
        throw new Error('Browser storage quota exceeded. Please clear some storage space.');
      }
    }
  }
  throw new Error('Browser storage quota exceeded. Please clear some storage space.');
}

export function saveRideToGarage(ride: Omit<SavedRide, 'id' | 'date'> & { id?: string }): SavedRide {
  const rides = getGarageRides();
<<<<<<< Updated upstream
  const newRide: SavedRide = {
    ...ride,
    id: 'ride_' + Date.now(),
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };

  // Prepend to top and limit to 10 stored rides
  const updated = [newRide, ...rides.filter(r => r.name !== ride.name)].slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage limit reached, saving fewer items', e);
  }
  return newRide;
=======
  const id = ride.id || generateSafeId();
  
  // If ride already exists with this ID, update it in-place
  const existingIndex = rides.findIndex(r => r.id === id);
  const nowFormatted = new Date().toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  let updatedList: SavedRide[];
  let savedRecord: SavedRide;

  if (existingIndex >= 0) {
    savedRecord = {
      ...rides[existingIndex],
      ...ride,
      id,
      date: rides[existingIndex].date, // preserve original recorded date
    };
    updatedList = [...rides];
    updatedList[existingIndex] = savedRecord;
  } else {
    savedRecord = {
      ...ride,
      id,
      date: nowFormatted,
    };
    // Prepend to top and limit to 15 stored rides
    updatedList = [savedRecord, ...rides].slice(0, 15);
  }

  persistRidesWithQuotaEviction(updatedList);
  return savedRecord;
}

export function updateGarageRide(id: string, updates: Partial<Omit<SavedRide, 'id'>>): SavedRide[] {
  const rides = getGarageRides();
  const idx = rides.findIndex(r => r.id === id);
  if (idx < 0) return rides;

  rides[idx] = {
    ...rides[idx],
    ...updates,
  };

  persistRidesWithQuotaEviction(rides);
  return rides;
>>>>>>> Stashed changes
}

export function deleteGarageRide(id: string): SavedRide[] {
  const rides = getGarageRides().filter(r => r.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
  } catch (e) {
    console.error(e);
  }
  return rides;
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

  const merged = Array.from(currentMap.values()).slice(0, 30);
  persistRidesWithQuotaEviction(merged);
  return merged;
}


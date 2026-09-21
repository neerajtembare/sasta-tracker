export interface SavedRide {
  id: string;
  name: string;
  date: string;
  gpxContent: string;
  distanceKm: number;
  maxSpeedKmh: number;
}

const STORAGE_KEY = 'sasta_tracker_garage';
const OLD_STORAGE_KEY = 'kinetic_motogpx_garage';

export function getGarageRides(): SavedRide[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw);
      }
    }
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading garage rides from localStorage', e);
    return [];
  }
}

export function saveRideToGarage(ride: Omit<SavedRide, 'id' | 'date'>): SavedRide {
  const rides = getGarageRides();
  const id = 'crypto' in window ? crypto.randomUUID() : 'ride_' + Date.now() + Math.random().toString(36).substring(7);
  const newRide: SavedRide = {
    ...ride,
    id,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };

  // Prepend to top and limit to 10 stored rides. Don't deduplicate by name, allow multiple saves of same name.
  const updated = [newRide, ...rides].slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage limit reached', e);
    throw new Error('Storage limit reached. Delete some old rides from the Garage first.');
  }
  return newRide;
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

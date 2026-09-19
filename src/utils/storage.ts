export interface SavedRide {
  id: string;
  name: string;
  date: string;
  gpxContent: string;
  distanceKm: number;
  maxSpeedKmh: number;
}

const STORAGE_KEY = 'kinetic_motogpx_garage';

export function getGarageRides(): SavedRide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading garage rides from localStorage', e);
    return [];
  }
}

export function saveRideToGarage(ride: Omit<SavedRide, 'id' | 'date'>): SavedRide {
  const rides = getGarageRides();
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

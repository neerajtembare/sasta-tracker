import { getGarageRides, SavedRide } from './storage';
import { getSavedIdentity, saveIdentity } from './cookieStorage';

export type StartupScreen = 'dashboard' | 'cockpit' | 'map';
export type DefaultMountMode = 'handlebar' | 'pocket';

export interface RiderProfileData {
  callsign: string;
  bikeModel: string;
  color: string;
  initialOdoKm: number;
  defaultStartupScreen: StartupScreen;
  defaultMountMode: DefaultMountMode;
}

export interface BikeLifetimeStats {
  totalBikeOdoKm: number;
  totalTrackedKm: number;
  totalRides: number;
  maxSpeedKmh: number;
  totalDurationHours: number;
  totalElevGainM: number;
  lastRideDate: string | null;
}

const STORAGE_KEY_CALLSIGN = 'throttlelog_rider_name';
const LEGACY_KEY_CALLSIGN = 'sasta_rider_name';
const STORAGE_KEY_BIKE = 'throttlelog_bike_model';
const LEGACY_KEY_BIKE = 'sasta_bike_model';
const STORAGE_KEY_COLOR = 'throttlelog_rider_color';
const LEGACY_KEY_COLOR = 'sasta_rider_color';
const STORAGE_KEY_INITIAL_ODO = 'throttlelog_initial_odo_km';
const STORAGE_KEY_STARTUP = 'throttlelog_default_startup_view';
const STORAGE_KEY_MOUNT = 'throttlelog_default_mount_mode';

export function getRiderProfile(): RiderProfileData {
  let callsign = 'Rider';
  let bikeModel = '';
  let color = '#00f0ff';
  let initialOdoKm = 0;
  let defaultStartupScreen: StartupScreen = 'dashboard';
  let defaultMountMode: DefaultMountMode = 'handlebar';

  try {
    const savedName = getSavedIdentity(STORAGE_KEY_CALLSIGN) || getSavedIdentity(LEGACY_KEY_CALLSIGN);
    if (savedName && savedName.trim()) callsign = savedName.trim();

    const savedBike = getSavedIdentity(STORAGE_KEY_BIKE) || getSavedIdentity(LEGACY_KEY_BIKE);
    if (savedBike && savedBike.trim()) bikeModel = savedBike.trim();

    const savedColor = getSavedIdentity(STORAGE_KEY_COLOR) || getSavedIdentity(LEGACY_KEY_COLOR);
    if (savedColor && savedColor.trim()) color = savedColor.trim();

    if (typeof localStorage !== 'undefined') {
      const savedOdo = localStorage.getItem(STORAGE_KEY_INITIAL_ODO);
      if (savedOdo && !isNaN(Number(savedOdo))) {
        initialOdoKm = Math.max(0, Number(savedOdo));
      }

      const savedStartup = localStorage.getItem(STORAGE_KEY_STARTUP);
      if (savedStartup === 'dashboard' || savedStartup === 'cockpit' || savedStartup === 'map') {
        defaultStartupScreen = savedStartup as StartupScreen;
      }

      const savedMount = localStorage.getItem(STORAGE_KEY_MOUNT);
      if (savedMount === 'handlebar' || savedMount === 'pocket') {
        defaultMountMode = savedMount as DefaultMountMode;
      }
    }
  } catch {}

  return {
    callsign,
    bikeModel,
    color,
    initialOdoKm,
    defaultStartupScreen,
    defaultMountMode,
  };
}

export function saveRiderProfile(updates: Partial<RiderProfileData>): RiderProfileData {
  try {
    if (updates.callsign !== undefined) {
      saveIdentity(STORAGE_KEY_CALLSIGN, updates.callsign.trim());
      saveIdentity(LEGACY_KEY_CALLSIGN, updates.callsign.trim());
    }

    if (updates.bikeModel !== undefined) {
      saveIdentity(STORAGE_KEY_BIKE, updates.bikeModel.trim());
      saveIdentity(LEGACY_KEY_BIKE, updates.bikeModel.trim());
    }

    if (updates.color !== undefined) {
      saveIdentity(STORAGE_KEY_COLOR, updates.color);
      saveIdentity(LEGACY_KEY_COLOR, updates.color);
    }

    if (typeof localStorage !== 'undefined') {
      if (updates.initialOdoKm !== undefined) {
        localStorage.setItem(STORAGE_KEY_INITIAL_ODO, String(Math.max(0, updates.initialOdoKm)));
      }

      if (updates.defaultStartupScreen !== undefined) {
        localStorage.setItem(STORAGE_KEY_STARTUP, updates.defaultStartupScreen);
      }

      if (updates.defaultMountMode !== undefined) {
        localStorage.setItem(STORAGE_KEY_MOUNT, updates.defaultMountMode);
      }
    }
  } catch (e) {
    console.warn('Error saving rider profile:', e);
  }

  return getRiderProfile();
}

export function getBikeLifetimeStats(): BikeLifetimeStats {
  const profile = getRiderProfile();
  const rides: SavedRide[] = getGarageRides();

  let totalTrackedKm = 0;
  let maxSpeedKmh = 0;
  let totalDurationSec = 0;
  let totalElevGainM = 0;
  let lastRideDate: string | null = null;

  for (const ride of rides) {
    if (ride.distanceKm && !isNaN(ride.distanceKm)) {
      totalTrackedKm += ride.distanceKm;
    }
    if (ride.maxSpeedKmh && !isNaN(ride.maxSpeedKmh)) {
      maxSpeedKmh = Math.max(maxSpeedKmh, ride.maxSpeedKmh);
    }
    if (ride.durationSeconds && !isNaN(ride.durationSeconds)) {
      totalDurationSec += ride.durationSeconds;
    }
    if (ride.elevGainM && !isNaN(ride.elevGainM)) {
      totalElevGainM += ride.elevGainM;
    }
  }

  if (rides.length > 0 && rides[0].date) {
    lastRideDate = rides[0].date;
  }

  const totalBikeOdoKm = profile.initialOdoKm + totalTrackedKm;
  const totalDurationHours = Number((totalDurationSec / 3600).toFixed(1));

  return {
    totalBikeOdoKm: Number(totalBikeOdoKm.toFixed(1)),
    totalTrackedKm: Number(totalTrackedKm.toFixed(1)),
    totalRides: rides.length,
    maxSpeedKmh: Math.round(maxSpeedKmh),
    totalDurationHours,
    totalElevGainM: Math.round(totalElevGainM),
    lastRideDate,
  };
}

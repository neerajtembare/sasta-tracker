import { getGarageRides, SavedRide } from './storage';
import { getSavedIdentity, saveIdentity } from './cookieStorage';

export type StartupScreen = 'dashboard' | 'cockpit' | 'map';
export type DefaultMountMode = 'handlebar' | 'pocket';
export type MountOrientationPref = 'auto' | 'portrait' | 'landscape';
export type DefaultMapLayer = 'dark' | 'streets' | 'satellite' | 'sunlight';
export type DefaultMapOrientation = 'course' | 'north';

export interface RiderProfileData {
  callsign: string;
  bikeModel: string;
  color: string;
  initialOdoKm: number;
  defaultStartupScreen: StartupScreen;
  defaultMountMode: DefaultMountMode;
  mountOrientation: MountOrientationPref;
  defaultMapLayer: DefaultMapLayer;
  defaultMapOrientation: DefaultMapOrientation;
  fuelMileageKmpl: number;
  fuelPricePerLiter: number;
  currencySymbol: string;
}

export interface BikeLifetimeStats {
  totalBikeOdoKm: number;
  totalTrackedKm: number;
  totalRides: number;
  maxSpeedKmh: number;
  totalDurationHours: number;
  totalDurationSeconds: number;
  totalMovingSeconds: number;
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
const STORAGE_KEY_MOUNT_ORIENT = 'throttlelog_mount_orientation';
const STORAGE_KEY_MAP_LAYER = 'throttlelog_map_layer';
const LEGACY_KEY_MAP_LAYER = 'sasta_map_layer';
const STORAGE_KEY_MAP_ORIENT = 'throttlelog_map_orientation';
const LEGACY_KEY_MAP_ORIENT = 'sasta_map_orientation';
const STORAGE_KEY_MILEAGE = 'throttlelog_fuel_mileage_kmpl';
const STORAGE_KEY_FUEL_PRICE = 'throttlelog_fuel_price_per_liter';
const STORAGE_KEY_CURRENCY = 'throttlelog_currency_symbol';

export function getRiderProfile(): RiderProfileData {
  let callsign = 'Rider';
  let bikeModel = '';
  let color = '#00f0ff';
  let initialOdoKm = 0;
  let defaultStartupScreen: StartupScreen = 'dashboard';
  let defaultMountMode: DefaultMountMode = 'handlebar';
  let mountOrientation: MountOrientationPref = 'auto';
  let defaultMapLayer: DefaultMapLayer = 'dark';
  let defaultMapOrientation: DefaultMapOrientation = 'course';
  let fuelMileageKmpl = 32;
  let fuelPricePerLiter = 104;
  let currencySymbol = '₹';

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

      const savedMountOrient = localStorage.getItem(STORAGE_KEY_MOUNT_ORIENT);
      if (savedMountOrient === 'auto' || savedMountOrient === 'portrait' || savedMountOrient === 'landscape') {
        mountOrientation = savedMountOrient;
      }

      const savedMapLayer = localStorage.getItem(STORAGE_KEY_MAP_LAYER) || localStorage.getItem(LEGACY_KEY_MAP_LAYER);
      if (savedMapLayer === 'dark' || savedMapLayer === 'streets' || savedMapLayer === 'satellite' || savedMapLayer === 'sunlight') {
        defaultMapLayer = savedMapLayer;
      }

      const savedMapOrient = localStorage.getItem(STORAGE_KEY_MAP_ORIENT) || localStorage.getItem(LEGACY_KEY_MAP_ORIENT);
      if (savedMapOrient === 'course' || savedMapOrient === 'north') {
        defaultMapOrientation = savedMapOrient;
      }

      const savedMileage = localStorage.getItem(STORAGE_KEY_MILEAGE);
      if (savedMileage && Number(savedMileage) > 0) {
        fuelMileageKmpl = Number(savedMileage);
      }

      const savedFuelPrice = localStorage.getItem(STORAGE_KEY_FUEL_PRICE);
      if (savedFuelPrice && Number(savedFuelPrice) > 0) {
        fuelPricePerLiter = Number(savedFuelPrice);
      }

      const savedCurrency = localStorage.getItem(STORAGE_KEY_CURRENCY);
      if (savedCurrency && savedCurrency.trim()) {
        currencySymbol = savedCurrency.trim().slice(0, 4);
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
    mountOrientation,
    defaultMapLayer,
    defaultMapOrientation,
    fuelMileageKmpl,
    fuelPricePerLiter,
    currencySymbol,
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

      if (updates.mountOrientation !== undefined) {
        localStorage.setItem(STORAGE_KEY_MOUNT_ORIENT, updates.mountOrientation);
      }

      if (updates.defaultMapLayer !== undefined) {
        localStorage.setItem(STORAGE_KEY_MAP_LAYER, updates.defaultMapLayer);
        localStorage.setItem(LEGACY_KEY_MAP_LAYER, updates.defaultMapLayer);
      }

      if (updates.defaultMapOrientation !== undefined) {
        localStorage.setItem(STORAGE_KEY_MAP_ORIENT, updates.defaultMapOrientation);
        localStorage.setItem(LEGACY_KEY_MAP_ORIENT, updates.defaultMapOrientation);
      }

      if (updates.fuelMileageKmpl !== undefined && updates.fuelMileageKmpl > 0) {
        localStorage.setItem(STORAGE_KEY_MILEAGE, String(updates.fuelMileageKmpl));
      }

      if (updates.fuelPricePerLiter !== undefined && updates.fuelPricePerLiter > 0) {
        localStorage.setItem(STORAGE_KEY_FUEL_PRICE, String(updates.fuelPricePerLiter));
      }

      if (updates.currencySymbol !== undefined && updates.currencySymbol.trim()) {
        localStorage.setItem(STORAGE_KEY_CURRENCY, updates.currencySymbol.trim().slice(0, 4));
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
  let totalMovingSec = 0;
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
    const moveSec = ride.movingTimeSeconds ?? ride.durationSeconds;
    if (moveSec && !isNaN(moveSec)) {
      totalMovingSec += moveSec;
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
    totalDurationSeconds: Math.round(totalDurationSec),
    totalMovingSeconds: Math.round(totalMovingSec),
    totalElevGainM: Math.round(totalElevGainM),
    lastRideDate,
  };
}

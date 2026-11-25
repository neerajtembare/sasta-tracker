export type UnitSystem = 'metric' | 'imperial';

export const UNIT_STORAGE_KEY = 'throttlelog_unit_system';
const LEGACY_UNIT_STORAGE_KEY = 'sasta_unit_system';

/**
 * Reads a primary `throttlelog_*` key from localStorage, migrating any legacy `sasta_*` key once.
 */
export function readMigratedStorageKey(newKey: string, legacyKey: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const val = localStorage.getItem(newKey);
    if (val !== null) return val;
    const oldVal = localStorage.getItem(legacyKey);
    if (oldVal !== null) {
      localStorage.setItem(newKey, oldVal);
      localStorage.removeItem(legacyKey);
      return oldVal;
    }
  } catch {}
  return null;
}

export function writeMigratedStorageKey(newKey: string, value: string, legacyKey?: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(newKey, value);
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
  } catch {}
}

export function getStoredUnitSystem(): UnitSystem {
  return 'metric';
}

export function setStoredUnitSystem(_unit: UnitSystem): void {
  writeMigratedStorageKey(UNIT_STORAGE_KEY, 'metric', LEGACY_UNIT_STORAGE_KEY);
}

/**
 * Formats seconds cleanly into human-readable riding durations (e.g. "1h 35m", "42m", "0m")
 * without "95m" overflow or "1h 60m" rounding bugs.
 */
export function formatDurationSummary(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const totalMins = Math.floor(safeSec / 60);
  if (totalMins < 1) {
    return safeSec > 0 ? '< 1m' : '0m';
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

/**
 * Formats a latitude or longitude axis with proper Math.abs + N/S/E/W hemisphere sign.
 */
export function formatCoordAxis(val: number, axis: 'lat' | 'lon', decimals: number = 4): string {
  if (!Number.isFinite(val)) return '—';
  const hemi = axis === 'lat' ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(decimals)}° ${hemi}`;
}

/**
 * Safely formats a timestamp or Date without ever displaying "Invalid Date".
 */
export function formatSafeTime(
  value: number | string | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  fallback: string = '—'
): string {
  if (value === undefined || value === null || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString([], options);
}

export function formatSafeDateTime(
  value: number | string | Date | undefined | null,
  fallback: string = '—'
): string {
  if (value === undefined || value === null || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Speed helper (standardized on km/h)
 */
export function convertSpeed(kmh: number, _unit: UnitSystem = 'metric'): { value: number; unit: string } {
  return {
    value: Math.round(kmh * 10) / 10,
    unit: 'km/h',
  };
}

export function formatSpeed(kmh: number, _unit: UnitSystem = 'metric', decimals: number = 0): string {
  const converted = convertSpeed(kmh);
  return `${converted.value.toFixed(decimals)} ${converted.unit}`;
}

/**
 * Distance helper (standardized on km)
 */
export function convertDistance(km: number, _unit: UnitSystem = 'metric'): { value: number; unit: string } {
  return {
    value: Math.round(km * 10) / 10,
    unit: 'km',
  };
}

export function formatDistance(km: number, _unit: UnitSystem = 'metric', decimals: number = 1): string {
  const converted = convertDistance(km);
  return `${converted.value.toFixed(decimals)} ${converted.unit}`;
}

/**
 * Elevation helper (standardized on m)
 */
export function convertElevation(m: number | null, _unit: UnitSystem = 'metric'): { value: number | null; unit: string } {
  if (m === null || isNaN(m)) {
    return { value: null, unit: 'm' };
  }
  return {
    value: Math.round(m),
    unit: 'm',
  };
}

export function formatElevation(m: number | null, _unit: UnitSystem = 'metric'): string {
  const converted = convertElevation(m);
  if (converted.value === null) return '—';
  return `${converted.value} ${converted.unit}`;
}

/**
 * Fuel volume helper (standardized on L)
 */
export function convertFuelVolume(liters: number, _unit: UnitSystem = 'metric'): { value: number; unit: string } {
  return {
    value: Math.round(liters * 100) / 100,
    unit: 'L',
  };
}

/**
 * Fuel economy helper (standardized on km/L)
 */
export function convertFuelEconomy(kmpl: number, _unit: UnitSystem = 'metric'): { value: number; unit: string } {
  return {
    value: Math.round(kmpl * 10) / 10,
    unit: 'km/L',
  };
}

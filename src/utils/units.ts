export type UnitSystem = 'metric' | 'imperial';

export const UNIT_STORAGE_KEY = 'sasta_unit_system';

export function getStoredUnitSystem(): UnitSystem {
  try {
    const saved = localStorage.getItem(UNIT_STORAGE_KEY);
    return saved === 'imperial' ? 'imperial' : 'metric';
  } catch {
    return 'metric';
  }
}

export function setStoredUnitSystem(unit: UnitSystem): void {
  try {
    localStorage.setItem(UNIT_STORAGE_KEY, unit);
  } catch (e) {
    console.warn('Failed to save unit system preference:', e);
  }
}

/**
 * Speed conversion: km/h <-> mph
 */
export function convertSpeed(kmh: number, unit: UnitSystem = 'metric'): { value: number; unit: string } {
  if (unit === 'imperial') {
    return {
      value: Math.round(kmh * 0.621371 * 10) / 10,
      unit: 'mph',
    };
  }
  return {
    value: Math.round(kmh * 10) / 10,
    unit: 'km/h',
  };
}

export function formatSpeed(kmh: number, unit: UnitSystem = 'metric', decimals: number = 0): string {
  const converted = convertSpeed(kmh, unit);
  return `${converted.value.toFixed(decimals)} ${converted.unit}`;
}

/**
 * Distance conversion: km <-> mi
 */
export function convertDistance(km: number, unit: UnitSystem = 'metric'): { value: number; unit: string } {
  if (unit === 'imperial') {
    return {
      value: Math.round(km * 0.621371 * 10) / 10,
      unit: 'mi',
    };
  }
  return {
    value: Math.round(km * 10) / 10,
    unit: 'km',
  };
}

export function formatDistance(km: number, unit: UnitSystem = 'metric', decimals: number = 1): string {
  const converted = convertDistance(km, unit);
  return `${converted.value.toFixed(decimals)} ${converted.unit}`;
}

/**
 * Elevation conversion: meters <-> feet
 */
export function convertElevation(m: number | null, unit: UnitSystem = 'metric'): { value: number | null; unit: string } {
  const unitLabel = unit === 'imperial' ? 'ft' : 'm';
  if (m === null || isNaN(m)) {
    return { value: null, unit: unitLabel };
  }
  if (unit === 'imperial') {
    return {
      value: Math.round(m * 3.28084),
      unit: 'ft',
    };
  }
  return {
    value: Math.round(m),
    unit: 'm',
  };
}

export function formatElevation(m: number | null, unit: UnitSystem = 'metric'): string {
  const converted = convertElevation(m, unit);
  if (converted.value === null) return '—';
  return `${converted.value} ${converted.unit}`;
}

/**
 * Fuel volume conversion: Liters <-> Gallons (US)
 */
export function convertFuelVolume(liters: number, unit: UnitSystem = 'metric'): { value: number; unit: string } {
  if (unit === 'imperial') {
    return {
      value: Math.round(liters * 0.264172 * 100) / 100,
      unit: 'gal',
    };
  }
  return {
    value: Math.round(liters * 100) / 100,
    unit: 'L',
  };
}

/**
 * Fuel economy conversion: km/L <-> mpg (US)
 */
export function convertFuelEconomy(kmpl: number, unit: UnitSystem = 'metric'): { value: number; unit: string } {
  if (unit === 'imperial') {
    return {
      value: Math.round(kmpl * 2.35215 * 10) / 10,
      unit: 'mpg',
    };
  }
  return {
    value: Math.round(kmpl * 10) / 10,
    unit: 'km/L',
  };
}

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  time: string | null;
  speed: number; // m/s
  speedKmh: number; // km/h
  bearing: number | null; // degrees 0-360
  sat: number | null; // satellite count
  hdop: number | null;
  vdop: number | null;
  pdop: number | null;
  geoidheight: number | null;
  segmentIndex: number;
  distanceFromStartKm: number;
  estimatedLeanAngle?: number; // degrees
}

export interface Segment {
  index: number;
  points: TrackPoint[];
  distanceKm: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  elevGain: number;
  elevLoss: number;
}

export type PitStopCategory = 'chai' | 'fuel' | 'dhaba' | 'scenic' | 'mechanic' | 'rest' | 'traffic' | 'other';

export interface PitStop {
  id: string;
  category: PitStopCategory;
  name: string;
  notes?: string;
  lat: number;
  lon: number;
  ele: number | null;
  startTime: string | null;
  endTime?: string | null;
  locationName?: string;
  durationSeconds: number;
  segmentIndex: number;
  distanceKm: number;
  isAutoDetected?: boolean;
}

export type AppTheme = 'dark' | 'light';
export type UnitSystem = 'metric' | 'imperial';

export interface SpeedTrap {
  position: string; // #1, #2, #3...
  speedKmh: number;
  lat: number;
  lon: number;
  ele: number | null;
  time: string | null;
  distanceKm: number;
  deltaLabel: string;
}

export interface RideSplit {
  splitIndex: number;
  label: string;
  distanceKm: number;
  movingTimeSeconds: number;
  avgSpeedKmh: number;
  elevGainM: number;
}

export interface RideAnalysis {
  name: string;
  points: TrackPoint[];
  segments: Segment[];
  totalDistanceKm: number;
  userDistanceOverrideKm?: number | null;
  bikeModel?: string;
  fuelMileageKmpl?: number;
  fuelPricePerLiter?: number;
  customFuelLiters?: number | null;
  userNotes?: string;
  totalDurationSeconds: number;
  movingTimeSeconds: number;
  stoppedTimeSeconds: number;
  overallAvgSpeedKmh: number;
  movingAvgSpeedKmh: number;
  maxSpeedKmh: number;
  elevGainM: number;
  elevLossM: number;
  elevMinM: number | null;
  elevMaxM: number | null;
  elevStartM: number | null;
  elevEndM: number | null;
  startTime: string | null;
  endTime: string | null;
  avgSatellites: number | null;
  maxSatellites: number | null;
  bestHdop: number | null;
  maxEstimatedLean: number;
  pitStops: PitStop[];
  speedTraps: SpeedTrap[];
  splits?: RideSplit[];
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  activityType?: {
    label: string;
    emoji: string;
    category: 'walking' | 'cycling' | 'motorbike' | 'racing';
  };
}

export interface LiveGpsPoint {
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null; // m/s
  speedKmh: number;
  heading: number | null;
  altitude: number | null;
  timestamp: number;
  leanAngle?: number;
}

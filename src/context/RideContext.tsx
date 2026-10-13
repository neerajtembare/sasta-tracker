import React, { createContext, useEffect, useState, ReactNode } from 'react';
import * as storage from '../utils/storage';

export type Ride = {
  id: string;
  name: string;
  date: string;
  distanceKm: number;
  maxSpeedKmh: number;
  gpxContent: string;
};

export const RideContext = createContext({
  rides: [] as Ride[],
  addRide: (_r: Ride) => {},
  updateRide: (_id: string, _changes: Partial<Ride>) => {},
  deleteRide: (_id: string) => {},
  refreshRides: () => {},
});

export const RideProvider = ({ children }: { children: ReactNode }) => {
  const [rides, setRides] = useState<Ride[]>([]);

  const refreshRides = () => {
    const stored = storage.getGarageRides();
    setRides(stored as Ride[]);
  };

  useEffect(() => {
    refreshRides();
  }, []);

  const addRide = (r: Ride) => {
    storage.saveRideToGarage(r as any);
    refreshRides();
  };

  const updateRide = (id: string, changes: Partial<Ride>) => {
    storage.updateGarageRide(id, changes as any);
    refreshRides();
  };

  const deleteRide = (id: string) => {
    storage.deleteGarageRide(id);
    refreshRides();
  };

  return (
    <RideContext.Provider value={{ rides, addRide, updateRide, deleteRide, refreshRides }}>
      {children}
    </RideContext.Provider>
  );
};

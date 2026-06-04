// src/store/useTaxiStore.ts
// Zustand store for the taxi/driver module.

import { create } from 'zustand';
import type { TaxiRide, VehicleType, FareEstimate, Coordinates, DriverEarnings } from '../api/taxi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyDriverLocation {
  driverId: string;
  lat: number;
  lng: number;
}

export type TaxiPaymentMethod = 'cash' | 'card' | 'online';

export interface TaxiState {
  // Passenger state
  activeRide: TaxiRide | null;
  isSearching: boolean;
  selectedVehicleType: VehicleType;
  selectedPaymentMethod: TaxiPaymentMethod;
  fareEstimate: FareEstimate | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: Coordinates | null;
  dropoffCoords: Coordinates | null;
  nearbyDrivers: NearbyDriverLocation[];

  // Driver state
  driverLocation: Coordinates | null;
  isDriverOnline: boolean;
  incomingRide: import('../services/taxiSocket.service').NewRideRequestPayload | null;
  driverEarnings: DriverEarnings | null;

  // Actions
  setActiveRide: (ride: TaxiRide | null) => void;
  setIsSearching: (v: boolean) => void;
  setSelectedVehicleType: (t: VehicleType) => void;
  setSelectedPaymentMethod: (m: TaxiPaymentMethod) => void;
  setFareEstimate: (est: FareEstimate | null) => void;
  setPickup: (address: string, coords: Coordinates | null) => void;
  setDropoff: (address: string, coords: Coordinates | null) => void;
  setNearbyDrivers: (drivers: NearbyDriverLocation[]) => void;
  updateNearbyDriver: (driver: NearbyDriverLocation) => void;
  removeNearbyDriver: (driverId: string) => void;

  setDriverLocation: (loc: Coordinates) => void;
  setDriverOnline: (v: boolean) => void;
  setIncomingRide: (
    ride: import('../services/taxiSocket.service').NewRideRequestPayload | null,
  ) => void;
  setDriverEarnings: (e: DriverEarnings | null) => void;

  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initial = {
  activeRide: null,
  isSearching: false,
  selectedVehicleType: 'ride' as VehicleType,
  selectedPaymentMethod: 'cash' as TaxiPaymentMethod,
  fareEstimate: null,
  pickupAddress: '',
  dropoffAddress: '',
  pickupCoords: null,
  dropoffCoords: null,
  nearbyDrivers: [],
  driverLocation: null,
  isDriverOnline: false,
  incomingRide: null,
  driverEarnings: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTaxiStore = create<TaxiState>((set) => ({
  ...initial,

  setActiveRide: (ride) => set({ activeRide: ride }),
  setIsSearching: (v) => set({ isSearching: v }),
  setSelectedVehicleType: (t) => set({ selectedVehicleType: t, fareEstimate: null }),
  setSelectedPaymentMethod: (m) => set({ selectedPaymentMethod: m }),
  setFareEstimate: (est) => set({ fareEstimate: est }),

  setPickup: (address, coords) =>
    set({ pickupAddress: address, pickupCoords: coords, fareEstimate: null }),
  setDropoff: (address, coords) =>
    set({ dropoffAddress: address, dropoffCoords: coords, fareEstimate: null }),

  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),
  updateNearbyDriver: (driver) =>
    set((s) => {
      const existing = s.nearbyDrivers.findIndex((d) => d.driverId === driver.driverId);
      if (existing === -1) {
        return { nearbyDrivers: [...s.nearbyDrivers, driver] };
      }
      const next = [...s.nearbyDrivers];
      next[existing] = driver;
      return { nearbyDrivers: next };
    }),

  removeNearbyDriver: (driverId) =>
    set((s) => ({
      nearbyDrivers: s.nearbyDrivers.filter((d) => d.driverId !== driverId),
    })),

  setDriverLocation: (loc) => set({ driverLocation: loc }),
  setDriverOnline: (v) => set({ isDriverOnline: v }),
  setIncomingRide: (ride) => set({ incomingRide: ride }),
  setDriverEarnings: (e) => set({ driverEarnings: e }),

  reset: () => set(initial),
}));

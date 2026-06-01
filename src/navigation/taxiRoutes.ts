// src/navigation/taxiRoutes.ts
// Centralised route name constants and param types for the Taxi and Driver stacks.
// Import these instead of using raw string literals to get type safety and refactor safety.

// ─── Taxi (passenger) stack ───────────────────────────────────────────────────

export const TAXI_ROUTES = {
  HOME:        'TaxiHome',
  DESTINATION: 'TaxiDestination',
  MATCHED:     'TaxiMatched',
  RECEIPT:     'TaxiReceipt',
} as const;

export type TaxiRouteName = (typeof TAXI_ROUTES)[keyof typeof TAXI_ROUTES];

export type TaxiParamList = {
  [TAXI_ROUTES.HOME]:        undefined;
  [TAXI_ROUTES.DESTINATION]: undefined;
  [TAXI_ROUTES.MATCHED]:     { rideId: string };
  [TAXI_ROUTES.RECEIPT]: {
    rideId: string;
    fare: number;
    distanceKm: number;
    durationMin: number;
    pickupAddress: string;
    dropoffAddress: string;
    paymentMethod: string;
    driverId: string;
  };
};

// ─── Driver stack ─────────────────────────────────────────────────────────────

export const DRIVER_ROUTES = {
  HOME: 'DriverHome',
} as const;

export type DriverRouteName = (typeof DRIVER_ROUTES)[keyof typeof DRIVER_ROUTES];

export type DriverParamList = {
  [DRIVER_ROUTES.HOME]: undefined;
};

// ─── Root-level screen names that open each navigator ────────────────────────

export const ROOT_TAXI_SCREEN   = 'Taxi'   as const;
export const ROOT_DRIVER_SCREEN = 'Driver' as const;

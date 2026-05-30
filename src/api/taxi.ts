// src/api/taxi.ts
// Wraps all AJAN-5 taxi/driver REST endpoints.

import api from './client';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RideLocation {
  address: string;
  coordinates: [number, number]; // [lng, lat] — GeoJSON order
}

export type VehicleType = 'ride' | 'xl' | 'lux' | 'pet';
export type RideStatus = 'searching' | 'matched' | 'inProgress' | 'completed' | 'cancelled';

export interface TaxiRide {
  _id: string;
  passenger: string | { _id: string; name: string; phone?: string };
  driver?: any;
  pickup: RideLocation;
  dropoff: RideLocation;
  vehicleType: VehicleType;
  status: RideStatus;
  fare: number;
  distanceKm: number;
  durationMin: number;
  paymentMethod: string;
  requestedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledBy?: 'passenger' | 'driver';
  cancelReason?: string;
}

export interface FareEstimate {
  fare: number;
  distanceKm: number;
  durationMin: number;
  vehicleType: VehicleType;
}

export interface PlaceResult {
  placeId?: string;
  address: string;
  lat: number;
  lng: number;
}

export interface DriverEarnings {
  totalEarnings: number;
  totalRides: number;
  averageRating?: number;
  todayEarnings?: number;
  todayRides?: number;
  weeklyEarnings?: number;
}

// ─── Passenger endpoints ─────────────────────────────────────────────────────

/** POST /api/taxi/estimate */
export async function estimateFare(
  pickup: RideLocation,
  dropoff: RideLocation,
  vehicleType: VehicleType = 'ride',
): Promise<FareEstimate> {
  const { data } = await api.post('/taxi/estimate', { pickup, dropoff, vehicleType });
  return data;
}

export interface TaxiPaymentInfo {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

/** POST /api/taxi/rides */
export async function createRide(payload: {
  pickup: RideLocation;
  dropoff: RideLocation;
  vehicleType: VehicleType;
  paymentMethod?: string;
}): Promise<{ ride: TaxiRide; nearbyDriverCount: number; payment: TaxiPaymentInfo | null }> {
  const { data } = await api.post('/taxi/rides', payload);
  return data;
}

/** GET /api/taxi/rides/active — kullanıcının aktif yolculuğu (yoksa null) */
export async function getActiveRide(): Promise<TaxiRide | null> {
  try {
    const { data } = await api.get('/taxi/rides/active');
    return data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/** GET /api/taxi/rides/:id */
export async function getRide(id: string): Promise<TaxiRide> {
  const { data } = await api.get(`/taxi/rides/${id}`);
  return data;
}

/** PATCH /api/taxi/rides/:id/cancel */
export async function cancelRide(id: string, reason?: string): Promise<TaxiRide> {
  const { data } = await api.patch(`/taxi/rides/${id}/cancel`, { reason });
  return data.ride ?? data;
}

/** GET /api/taxi/places/search */
export async function searchPlaces(
  query: string,
  location?: Coordinates,
): Promise<PlaceResult[]> {
  const params: Record<string, string> = { q: query };
  if (location) {
    params.lat = String(location.lat);
    params.lng = String(location.lng);
  }
  const { data } = await api.get('/taxi/places/search', { params });
  return data.results ?? [];
}

// ─── Driver endpoints ─────────────────────────────────────────────────────────

/** PATCH /api/taxi/driver/status */
export async function updateDriverStatus(isOnline: boolean): Promise<void> {
  await api.patch('/taxi/driver/status', { isOnline });
}

/** PATCH /api/taxi/driver/location */
export async function updateDriverLocation(lat: number, lng: number): Promise<void> {
  await api.patch('/taxi/driver/location', { lat, lng });
}

/** PATCH /api/taxi/rides/:id/respond  action: 'accept' | 'reject' */
export async function respondToRide(
  rideId: string,
  action: 'accept' | 'reject',
): Promise<TaxiRide> {
  const { data } = await api.patch(`/taxi/rides/${rideId}/respond`, { action });
  return data.ride ?? data;
}

/** PATCH /api/taxi/rides/:id/complete */
export async function completeRide(rideId: string): Promise<TaxiRide> {
  const { data } = await api.patch(`/taxi/rides/${rideId}/complete`);
  return data.ride ?? data;
}

/** GET /api/taxi/driver/earnings */
export async function getDriverEarnings(): Promise<DriverEarnings> {
  const { data } = await api.get('/taxi/driver/earnings');
  return data;
}

/** GET /api/taxi/driver/me */
export async function getDriverProfile(): Promise<any> {
  const { data } = await api.get('/taxi/driver/me');
  return data;
}

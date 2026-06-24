// src/api/taxi.ts
// Wraps all AJAN-5 taxi/driver REST endpoints.

import api from './client';
import { useRegion } from '../store/useRegion';

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

export interface TaxiDriverInfo {
  _id: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  rating: number;
  ratingCount: number;
  photoUrl?: string;
  user?: { _id: string; name: string; phone?: string; photoUrl?: string };
}

export interface TaxiRide {
  _id: string;
  passenger: string | { _id: string; name: string; phone?: string };
  driver?: TaxiDriverInfo | null;
  pickup: RideLocation;
  dropoff: RideLocation;
  vehicleType: VehicleType;
  status: RideStatus;
  fare: number;
  distanceKm: number;
  durationMin: number;
  paymentMethod: string;
  requestedAt?: string;
  matchedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledBy?: 'passenger' | 'driver' | 'system';
  cancelReason?: string;
  passengerRating?: number | null;
  driverRating?: number | null;
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
  ratingCount?: number;
  todayEarnings?: number;
  todayRides?: number;
  todayRideCount?: number;
  weekRideCount?: number;
  weekEarnings?: number;
  weeklyEarnings?: number;
}

// ─── Passenger endpoints ─────────────────────────────────────────────────────

/** POST /api/taxi/estimate */
export async function estimateFare(
  pickup: RideLocation,
  dropoff: RideLocation,
  vehicleType: VehicleType = 'ride',
): Promise<FareEstimate> {
  const region = useRegion.getState().region;
  const { data } = await api.post('/taxi/estimate', { pickup, dropoff, vehicleType, region });
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
  const region = useRegion.getState().region;
  const { data } = await api.post('/taxi/rides', { ...payload, region });
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

/** GET /api/taxi/my-rides — yolcunun geçmiş yolculukları (sayfalama) */
export async function getMyRides(page = 1, limit = 20): Promise<{
  rides: TaxiRide[];
  total: number;
  page: number;
  pages: number;
}> {
  const res = await api.get('/taxi/my-rides', { params: { page, limit } });
  return res.data;
}

/** PATCH /api/taxi/rides/:id/rate — yolcu sürücüyü puanlar */
export async function rateRide(rideId: string, passengerRating: number): Promise<void> {
  await api.patch(`/taxi/rides/${rideId}/rate`, { passengerRating });
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

/** PATCH /api/taxi/rides/:id/start — sürücü yolculuğu başlatır (matched → inProgress) */
export async function startRide(rideId: string): Promise<TaxiRide> {
  const { data } = await api.patch(`/taxi/rides/${rideId}/start`);
  return data.ride ?? data;
}

/** PATCH /api/taxi/rides/:id/complete — sürücü yolculuğu tamamlar (inProgress → completed) */
export async function completeRide(rideId: string): Promise<TaxiRide> {
  const { data } = await api.patch(`/taxi/rides/${rideId}/complete`);
  return data.ride ?? data;
}

/** GET /api/taxi/driver/rides — sürücünün geçmiş yolculukları (cursor tabanlı) */
export async function getDriverRides(
  cursor?: string,
  limit = 20,
): Promise<{ rides: TaxiRide[]; nextCursor: string | null }> {
  const params: Record<string, any> = { limit };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get('/taxi/driver/rides', { params });
  return data;
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

// ─── Driver registration ──────────────────────────────────────────────────────

export interface DriverRegistrationPayload {
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  type: 'sedan' | 'van' | 'luxury' | 'pet';
  licenseNumber?: string;
}

export interface DriverRegistrationResult {
  message: string;
  driver: {
    _id: string;
    isApproved: boolean;
    vehiclePlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleColor: string;
    type: string;
  };
}

/** POST /api/taxi/driver/register */
export async function registerDriver(
  payload: DriverRegistrationPayload,
): Promise<DriverRegistrationResult> {
  const { data } = await api.post('/taxi/driver/register', payload);
  return data;
}

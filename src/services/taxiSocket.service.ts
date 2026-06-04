// src/services/taxiSocket.service.ts
// Socket.io client for the taxi/driver module.
// Usage:
//   taxiSocket.connect(token)   — call when user goes online or starts a ride
//   taxiSocket.disconnect()     — call on cleanup
//   taxiSocket.on(event, cb)    — subscribe to backend events
//   taxiSocket.emit(event, data)— send events to backend
//   taxiSocket.off(event, cb)   — unsubscribe

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://rezzy-backend.onrender.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverLocationPayload {
  driverId: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export interface RideStatusChangePayload {
  rideId: string;
  status: string;
  driver?: string;
  updatedAt: number;
}

export interface NewRideRequestPayload {
  rideId: string;
  pickup: { address: string; coordinates: [number, number] };
  dropoff: { address: string; coordinates: [number, number] };
  vehicleType: string;
  fare: number;
  distanceKm: number;
  durationMin: number;
  requestedAt: string;
}

export type TaxiSocketEvent =
  | 'driver:location:update'
  | 'ride:status_change'
  | 'ride:new_request'
  | 'driver:online:ack'
  | 'driver:offline:ack'
  | 'connect'
  | 'disconnect'
  | 'connect_error';

// ─── Service ──────────────────────────────────────────────────────────────────

class TaxiSocketService {
  private socket: Socket | null = null;

  /** Connect with a JWT token; no-op if already connected with the same token. */
  connect(token: string, role: 'passenger' | 'driver' = 'passenger'): void {
    if (this.socket?.connected) {
      if (__DEV__) console.log('[taxiSocket] already connected, skipping');
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token, role },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10_000,
    });

    if (__DEV__) {
      this.socket.on('connect', () =>
        console.log('[taxiSocket] connected', this.socket?.id),
      );
      this.socket.on('disconnect', (reason) =>
        console.log('[taxiSocket] disconnected', reason),
      );
      this.socket.on('connect_error', (err) =>
        console.log('[taxiSocket] connect_error', err.message),
      );
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    if (__DEV__) console.log('[taxiSocket] manually disconnected');
  }

  on<T = unknown>(event: TaxiSocketEvent | string, handler: (data: T) => void): void {
    this.socket?.on(event, handler as any);
  }

  off<T = unknown>(event: TaxiSocketEvent | string, handler: (data: T) => void): void {
    this.socket?.off(event, handler as any);
  }

  emit(event: string, data?: unknown): void {
    if (!this.socket?.connected) {
      if (__DEV__) console.warn('[taxiSocket] emit called but socket not connected', event);
      return;
    }
    this.socket.emit(event, data);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton — import taxiSocket anywhere
export const taxiSocket = new TaxiSocketService();

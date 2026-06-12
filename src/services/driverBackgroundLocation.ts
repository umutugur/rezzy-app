// src/services/driverBackgroundLocation.ts
// Sürücü çevrimiçiyken uygulama kapalı/arka planda olsa bile konum gönderir.
// Task, modül scope'unda tanımlanmalı — App.tsx bu dosyayı import eder.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';

export const DRIVER_LOCATION_TASK = 'rezvix-driver-location';

const API_BASE = 'https://rezzy-backend.onrender.com/api';
const AUTH_KEY = 'rezvix.auth.v2';

async function readToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations?.[locations.length - 1];
  if (!last) return;

  const token = await readToken();
  if (!token) return;

  try {
    await fetch(`${API_BASE}/taxi/driver/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lat: last.coords.latitude,
        lng: last.coords.longitude,
      }),
    });
  } catch {
    // arka planda sessiz geç — bir sonraki tetiklemede tekrar dener
  }
});

/** Çevrimiçi olunca çağrılır. Background izni yoksa sessizce no-op (degrade mod). */
export async function startDriverLocationUpdates(): Promise<boolean> {
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;

  const already = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  if (already) return true;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15_000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Rezvix — Çevrimiçisiniz',
      notificationBody: 'Çağrı bekleniyor 🚖',
      notificationColor: '#8C2F39',
    },
  });
  return true;
}

/** Çevrimdışı olunca çağrılır. */
export async function stopDriverLocationUpdates(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => {});
  }
}

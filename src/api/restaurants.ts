// src/api/restaurants.ts
import { api } from "./client";

export type OpeningHour = {
  day: number;
  open: string;
  close: string;
  isClosed: boolean;
};
export type ListRestaurantsParams = {
  city?: string;
  query?: string;
  limit?: number;
  cursor?: string;
};

export interface Restaurant {
  _id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  priceRange?: string;
  description?: string;
  iban?: string;
  ibanName?: string;
  bankName?: string;
  photos?: string[];
  menus?: any[];
  tables?: TableItem[];
  openingHours?: OpeningHour[];
  minPartySize?: number;
  maxPartySize?: number;
  slotMinutes?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  blackoutDates?: string[];
  [key: string]: any;
}

export type TableItem = { name: string; capacity: number; isActive?: boolean };

// ---- helpers ----
async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

export function normalizeMongoId(input: any): string {
  if (!input) return "";
  if (typeof input === "object" && input !== null) {
    return input._id ?? "";
  }
  const str = String(input);
  const match = str.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
  if (match) return match[1];
  if (/^[0-9a-fA-F]{24}$/.test(str.trim())) return str.trim();
  return str;
}

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---------- Availability tipleri ----------
export type AvailabilitySlot = {
  timeISO: string;
  label: string;
  isAvailable: boolean;
  _fallback?: boolean;
};
export type AvailabilityResponse = {
  date: string;
  partySize: number;
  slots: AvailabilitySlot[];
  debug?: any;
};

// ---------- REST çağrıları ----------
export async function listRestaurants(params: ListRestaurantsParams = {}): Promise<Restaurant[]> {
  return unwrap(api.get<Restaurant[]>("/restaurants", { params }));
}

export async function getRestaurant(id: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.get<Restaurant>(`/restaurants/${rid}`));
}

/**
 * Genel bilgileri günceller.
 * UI tarafında RP_General formunda tutulan alan isimlerini bozma:
 * - Düz alanlar: name, email, phone, city, address, description, iban, ibanName, bankName, mapAddress, googleMapsUrl
 * - Konum: _lat, _lng (string/number)
 * - Mevcut lokasyon tipi: _existingLocation (GeoJSON Point ya da {lat,lng})
 */
export async function updateRestaurant(id: string, form: any): Promise<Restaurant> {
  const rid = normalizeMongoId(id);

  // Sadece backend’in beklediği düz alanları gönder
  const FLAT_FIELDS = [
    "name",
    "email",
    "phone",
    "city",
    "address",
    "description",
    "iban",
    "ibanName",
    "bankName",
    "mapAddress",
    "googleMapsUrl",
  ] as const;

  const payload: any = {};
  for (const k of FLAT_FIELDS) {
    const v = form?.[k];
    if (v !== undefined) payload[k] = v;
  }

  // Konum (lat/lng) – sayıya çevir
  const latRaw = form?._lat;
  const lngRaw = form?._lng;
  const lat = latRaw === "" || latRaw == null ? null : Number(latRaw);
  const lng = lngRaw === "" || lngRaw == null ? null : Number(lngRaw);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const existing = form?._existingLocation;
    const isGeoJSONPoint =
      existing &&
      typeof existing === "object" &&
      existing.type === "Point" &&
      Array.isArray(existing.coordinates) &&
      existing.coordinates.length === 2;

    payload.location = isGeoJSONPoint
      ? { type: "Point", coordinates: [lng, lat] } // GeoJSON
      : { lat, lng }; // Düz obje
  }

  return unwrap(api.put<Restaurant>(`/restaurants/${rid}`, payload));
}

export async function updateOpeningHours(id: string, hours: OpeningHour[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/opening-hours`, { openingHours: hours }));
}

export async function updateTables(id: string, tables: any[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/tables`, { tables }));
}

export async function updatePolicies(id: string, payload: any): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/policies`, payload));
}

export async function updateMenus(id: string, menus: any[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/menus`, { menus }));
}

export async function addPhoto(id: string, uri: string, _fileName: string, _mimeType: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.post<Restaurant>(`/restaurants/${rid}/photos`, { fileUrl: uri }));
}

export async function removePhoto(id: string, url: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.request<Restaurant>({
      url: `/restaurants/${rid}/photos`,
      method: "DELETE",
      data: { url },
    })
  );
}

export async function getAvailability(
  input: { id: string; date: string | Date; partySize: number } | string,
  dateMaybe?: string | Date,
  partySizeMaybe?: number
): Promise<AvailabilityResponse> {
  let id: string;
  let dateVal: string | Date;
  let partySizeVal: number;

  if (typeof input === "object") {
    id = input.id;
    dateVal = input.date;
    partySizeVal = input.partySize;
  } else {
    id = input;
    dateVal = dateMaybe ?? new Date();
    partySizeVal = partySizeMaybe ?? 2;
  }

  const rid = normalizeMongoId(id);
  const dateStr = typeof dateVal === "string" ? dateVal.slice(0, 10) : toYMD(dateVal);

  const res = await api.get<AvailabilityResponse>(`/restaurants/${rid}/availability`, {
    params: { date: dateStr, partySize: Math.max(1, Number(partySizeVal) || 1) },
  });

  console.log("AVAIL req ->", `/restaurants/${rid}/availability`, { date: dateStr, partySize: partySizeVal });
  console.log("AVAIL res ->", res.data?.debug || "(no debug)", Array.isArray(res.data?.slots) ? res.data.slots.length : 0);

  return res.data;
}
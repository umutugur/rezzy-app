import { api } from "./client";
import { Platform } from "react-native";

export type OpeningHour = {
  day: number;          // 0 = Pazar, 6 = Cumartesi
  open: string;         // "10:00"
  close: string;        // "23:30"
  isClosed?: boolean;
};

export type TableItem = {
  _id?: string;
  name: string;
  capacity: number;
  isActive?: boolean;
};

export type Restaurant = {
  _id: string;
  name: string;
  city?: string;
  priceRange?: string;
  rating?: number;
  photos?: string[];
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  openingHours?: OpeningHour[];
  tables?: TableItem[];
  minPartySize?: number;
  maxPartySize?: number;
  slotMinutes?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  blackoutDates?: string[];
};

export type AvailabilitySlot = {
  timeISO: string;
  label: string;
  isAvailable: boolean;
  reason?: "full" | "blackout" | "closed" | "past" | "other";
};

export type AvailabilityResponse = {
  date: string;
  partySize: number;
  slots: AvailabilitySlot[];
};

// -----------------------------
// ID normalize helper (içi obje/string gelse bile düz 24h ID döndürür)
// -----------------------------
function ensureId(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    // "ObjectId('...')" formu geldiyse çek
    const m = val.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
    if (m) return m[1];
    // JSON string olabilir
    try {
      const maybe = JSON.parse(val);
      if (maybe && typeof maybe === "object" && maybe._id) return String(maybe._id);
    } catch {}
    // "{ _id: '...' }" gibi ham stringten yakalamayı dene
    const m2 = val.match(/_id['"]?\s*:\s*['"]?([0-9a-fA-F]{24})['"]?/);
    if (m2) return m2[1];
    return val;
  }
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as any)._id || "");
  }
  return String(val);
}

export async function listRestaurants(city?: string): Promise<Restaurant[]> {
  const { data } = await api.get<Restaurant[]>("/restaurants", {
    params: city ? { city } : {},
  });
  return data;
}

export async function getRestaurant(id: string): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.get<Restaurant>(`/restaurants/${encodeURIComponent(rid)}`);
  return data;
}

export async function getAvailability(params: { id: string; date: string; partySize: number; }): Promise<AvailabilityResponse> {
  const rid = ensureId(params.id);
  const ps = Math.max(1, params.partySize || 1);
  const { data } = await api.get<AvailabilityResponse>(`/restaurants/${encodeURIComponent(rid)}/availability`, {
    params: { date: params.date, partySize: ps },
  });
  return data;
}

export async function updateRestaurant(id: string, payload: Partial<Restaurant>): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.put<Restaurant>(`/restaurants/${encodeURIComponent(rid)}`, payload);
  return data;
}

export async function updateOpeningHours(id: string, openingHours: OpeningHour[]): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.put<Restaurant>(`/restaurants/${encodeURIComponent(rid)}/opening-hours`, { openingHours });
  return data;
}

export async function updateTables(id: string, tables: TableItem[]): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.put<Restaurant>(`/restaurants/${encodeURIComponent(rid)}/tables`, { tables });
  return data;
}

export async function updatePolicies(id: string, payload: {
  minPartySize?: number;
  maxPartySize?: number;
  slotMinutes?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  blackoutDates?: string[];
}): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.put<Restaurant>(`/restaurants/${encodeURIComponent(rid)}/policies`, payload);
  return data;
}

function normalizeUri(uri: string) {
  return Platform.OS === "ios" ? uri.replace("file://", "") : uri;
}

export async function addPhoto(
  id: string,
  fileUri: string,
  fileName?: string,
  mime?: string
) {
  const rid = ensureId(id);
  const form = new FormData();

  const name = fileName && fileName.includes(".")
    ? fileName
    : `photo_${Date.now()}.jpg`;

  const imagePart = {
    uri: normalizeUri(fileUri),
    name,
    type: mime || "image/jpeg",
  } as unknown as Blob;

  form.append("photo", imagePart);

  const { data } = await api.post(`/restaurants/${encodeURIComponent(rid)}/photo`, form);
  return data;
}

export async function removePhoto(id: string, url: string): Promise<Restaurant> {
  const rid = ensureId(id);
  const { data } = await api.delete<Restaurant>(`/restaurants/${encodeURIComponent(rid)}/photo`, {
    data: { url },
  });
  return data;
}

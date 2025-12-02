import { api } from "./client";

export type OpeningHour = {
  day: number;
  open: string;
  close: string;
  isClosed: boolean;
};

/**
 * Parameters for listing restaurants.  Region has been widened to `string`
 * to support any ISO country code.  Consumers should pass a valid
 * two‑letter country code (e.g. "TR", "US").
 */
export type ListRestaurantsParams = {
  city?: string;
  query?: string;
  region?: string;
  lat?: number;
  lng?: number;
  limit?: number;
  cursor?: string;

  // Assistant / filtre destek alanları (tamamı opsiyonel)
  people?: number;
  /** YYYY-MM-DD veya benzeri tarih string’i */
  date?: string;
  /** Örn: "18:00-22:00" gibi bir saat aralığı */
  timeRange?: string;
  /** Bütçe filtresi, örn: "₺", "₺₺", "₺₺₺" veya "low/medium/high" */
  budget?: string;
  /** Mekan tarzı / mutfak tipi, örn: "meyhane", "balık", "tapas" */
  style?: string;
  /** Sadece logging/analiz için; asistandan geldiğini belirtmek istersen */
  fromAssistant?: boolean;
};

export interface Restaurant {
  _id: string;
  name: string;
  /** ISO country code of the restaurant's region. */
  region?: string;
  preferredLanguage?: string;
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
  location?: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  mapAddress?: string;
  [key: string]: any;
}

export type TableItem = { name: string; capacity: number; isActive?: boolean };
export type AvailabilitySlot = {
  timeISO: string;
  label: string;
  isAvailable: boolean;
  _fallback?: boolean;
};
// ---- helpers ----
async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

export function normalizeMongoId(input: any): string {
  if (!input) return "";
  if (typeof input === "object" && input !== null) {
    return (input as any)._id ?? "";
  }
  const str = String(input);
  const match = str.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
  if (match) return match[1];
  if (/^[0-9a-fA-F]{24}$/.test(str.trim())) return str.trim();
  return str;
}

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// ---------- REST calls ----------
export async function listRestaurants(
  params: ListRestaurantsParams = {}
): Promise<Restaurant[]> {
  return unwrap(api.get<Restaurant[]>("/restaurants", { params }));
}

export async function getRestaurant(id: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.get<Restaurant>(`/restaurants/${rid}`));
}

export async function updateRestaurant(id: string, form: any): Promise<Restaurant> {
  const rid = normalizeMongoId(id);

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
    "region",
    "preferredLanguage",
  ] as const;

  const payload: any = {};
  for (const k of FLAT_FIELDS) {
    const v = form?.[k];
    if (v !== undefined) payload[k] = v;
  }

  const latRaw = form?._lat;
  const lngRaw = form?._lng;
  const lat = latRaw === "" || latRaw == null ? null : Number(latRaw);
  const lng = lngRaw === "" || lngRaw == null ? null : Number(lngRaw);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    payload.location = {
      type: "Point",
      coordinates: [lng, lat],
    };
  }

  return unwrap(api.put<Restaurant>(`/restaurants/${rid}`, payload));
}

export async function updateOpeningHours(
  id: string,
  hours: OpeningHour[]
): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.put<Restaurant>(`/restaurants/${rid}/opening-hours`, {
      openingHours: hours,
    })
  );
}

export async function updateTables(
  id: string,
  tables: any[]
): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.put<Restaurant>(`/restaurants/${rid}/tables`, { tables })
  );
}

export async function updatePolicies(
  id: string,
  payload: any
): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.put<Restaurant>(`/restaurants/${rid}/policies`, payload)
  );
}

export async function updateMenus(
  id: string,
  menus: any[]
): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.put<Restaurant>(`/restaurants/${rid}/menus`, { menus })
  );
}

export async function addPhoto(
  id: string,
  uri: string,
  _fileName: string,
  _mimeType: string
): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(
    api.post<Restaurant>(`/restaurants/${rid}/photos`, {
      fileUrl: uri,
    })
  );
}

export async function addPhotoMultipart(
  id: string,
  localUri: string,
  fileName: string,
  mimeType: string
): Promise<any> {
  const rid = normalizeMongoId(id);
  const form = new FormData();

  // RN/Expo için file objesi:
  form.append("file", {
    uri: localUri,
    name: fileName,
    type: mimeType,
  } as any);

  const { data } = await api.post(`/restaurants/${rid}/photos`, form);
  return data;
}

export async function removePhoto(
  id: string,
  url: string
): Promise<Restaurant> {
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
): Promise<{
  date: string;
  partySize: number;
  slots: AvailabilitySlot[];
  debug?: any;
}> {
  // ...
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
  const dateStr =
    typeof dateVal === "string"
      ? dateVal.slice(0, 10)
      : toYMD(dateVal);

    const res = await api.get<{
    date: string;
    partySize: number;
    slots: AvailabilitySlot[];
    debug?: any;
  }>(`/restaurants/${rid}/availability`, {
    params: {
      date: dateStr,
      partySize: Math.max(1, Number(partySizeVal) || 1),
    },
  });

  return res.data;
}
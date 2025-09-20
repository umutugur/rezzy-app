// src/api/restaurants.ts
//
// Bu modül Rezzy backend'ine yönelik restoran uç noktalarıyla iletişim
// kurmak için axios üzerinden HTTP istekleri gönderir. Ortak
// `api` örneği `src/api/client.ts` dosyasında tanımlıdır ve tüm
// isteklerde JWT token'ını header'a eklemek için bir interceptor
// içerir. Böylece burada ayrıca baseURL ayarlamak veya token eklemek
// zorunda kalmayız.

export type OpeningHour = {
  day: number;
  open: string;
  close: string;
  isClosed: boolean;
};

// Restoran tipi. Panelde kullanılan alanları içerir.
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

import { api } from "./client";

// Axios yanıtları `data` alanı içerisinde döner; bu yardımcı fonksiyon
// gelen yanıttan `data` alanını döndürerek çağıran kodun yalnızca veri
// ile ilgilenmesini sağlar. Tip güvenliği için generics kullanıyoruz.
async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

// Bazı durumlarda kimlik parametresi `{ _id: new ObjectId('...'), name: ... }`
// şeklinde gelebilir. Bu yardımcı, geçerli bir Mongo ObjectId'yi çıkartır.
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

// YYYY-MM-DD formatına normalize et
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

// Tüm restoranları listele. İsteğe bağlı olarak şehir filtresi
// uygulanabilir. `params` objesi axios'un `params` özelliğine aktarılır.
export async function listRestaurants(params: { city?: string } = {}): Promise<Restaurant[]> {
  return unwrap(api.get<Restaurant[]>("/restaurants", { params }));
}

// Belirli bir restoranın detayını getirir.
export async function getRestaurant(id: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.get<Restaurant>(`/restaurants/${rid}`));
}

// Genel restoran bilgilerini güncelle. Geriye güncellenmiş restoran
// nesnesini döndürür.
export async function updateRestaurant(id: string, payload: any): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}`, payload));
}

// Çalışma saatlerini güncelle.
export async function updateOpeningHours(id: string, hours: OpeningHour[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/opening-hours`, { openingHours: hours }));
}

// Masa listesini güncelle.
export async function updateTables(id: string, tables: any[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/tables`, { tables }));
}

// Rezervasyon politikalarını güncelle. Örneğin minPartySize, maxPartySize ve
// diğer politikalar `payload` içerisinde gönderilebilir. Geriye
// güncellenmiş restoran nesnesi döner.
export async function updatePolicies(id: string, payload: any): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/policies`, payload));
}

// Menüler listesini güncelle. Geriye güncellenmiş restoran nesnesi döner.
export async function updateMenus(id: string, menus: any[]): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.put<Restaurant>(`/restaurants/${rid}/menus`, { menus }));
}

// Fotoğraf ekle. Mobile tarafında base64 veya URI değerini doğrudan
// gönderiyoruz. Geriye güncellenmiş restoran nesnesi döner.
export async function addPhoto(id: string, uri: string, fileName: string, mimeType: string): Promise<Restaurant> {
  const rid = normalizeMongoId(id);
  return unwrap(api.post<Restaurant>(`/restaurants/${rid}/photos`, { fileUrl: uri }));
}

// Fotoğraf kaldır. Axios ile DELETE metodunda gövde göndermek için
// `data` alanı kullanılmalı.
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

/**
 * UYGUNLUK (SLOT) ÇEKME
 *
 * Ekranda şu imzayla çağırıyorsun:
 *   getAvailability({ id: restaurantId, date, partySize })
 * Aşağıdaki fonksiyon hem bu obje imzasını, hem de (id, date, partySize)
 * şeklindeki klasik imzayı destekler.
 */
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

  // Debug log (gerekirse kapat)
  console.log("AVAIL req ->", `/restaurants/${rid}/availability`, { date: dateStr, partySize: partySizeVal });
  console.log("AVAIL res ->", res.data?.debug || "(no debug)", Array.isArray(res.data?.slots) ? res.data.slots.length : 0);

  return res.data;
}

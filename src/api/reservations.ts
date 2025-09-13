import { api } from "./client";
import { Platform } from "react-native";

export type ReservationStatus = "pending" | "confirmed" | "arrived" | "no_show" | "cancelled";

export type Reservation = {
  _id: string;
  dateTimeUTC: string;
  partySize: number;
  totalPrice: number;
  depositAmount: number;
  status: ReservationStatus;
  receiptUrl?: string;
  user?: { name?: string; email?: string };
};

export type ReservationListResp = {
  items: Reservation[];
  total: number;
  page: number;
  limit: number;
};

// -----------------------------
// ID normalize helper (restaurantId için)
// -----------------------------
function ensureId(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    const m = val.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
    if (m) return m[1];
    try {
      const maybe = JSON.parse(val);
      if (maybe && typeof maybe === "object" && maybe._id) return String(maybe._id);
    } catch {}
    const m2 = val.match(/_id['"]?\s*:\s*['"]?([0-9a-fA-F]{24})['"]?/);
    if (m2) return m2[1];
    return val;
  }
  if (typeof val === "object" && val !== null && "_id" in val) {
    return String((val as any)._id || "");
  }
  return String(val);
}

export async function fetchReservationsByRestaurant(params: {
  restaurantId: string;
  from?: string;
  to?: string;
  status?: ReservationStatus;
  page?: number;
  limit?: number;
}) {
  const { restaurantId, ...q } = params;
  const rid = ensureId(restaurantId);
  const { data } = await api.get<ReservationListResp>(
    `/restaurants/${encodeURIComponent(rid)}/reservations`,
    { params: q }
  );
  return data;
}

export async function updateReservationStatus(rid: string, next: ReservationStatus) {
  if (next === "confirmed") {
    const { data } = await api.post<{ ok: true; qrDataUrl?: string }>(
      `/reservations/${rid}/approve`, {}
    );
    return data;
  }
  if (next === "cancelled") {
    const { data } = await api.post<{ ok: true }>(
      `/reservations/${rid}/reject`, {}
    );
    return data;
  }
  // Gerekirse diğer durumlar için backend eklenir
  throw new Error("Desteklenmeyen durum geçişi");
}

export type ReservationStats = {
  rangeLabel: string;
  totalCount: number;
  totalAmount: number;
  confirmedCount: number;
  pendingCount: number;
  rejectedCount: number;
};

export async function fetchReservationStats(params: {
  restaurantId: string;
  start?: string; // YYYY-MM-DD
  end?: string;   // YYYY-MM-DD
}) {
  const rid = ensureId(params.restaurantId);
  const { start, end } = params;
  const { data } = await api.get<{
    range: { from: string; to: string };
    counts: { total: number; pending: number; confirmed: number; arrived: number; cancelled: number };
    totals: { gross: number; deposit: number };
    byDay: Array<{ date: string; count: number; amount: number }>;
  }>(`/restaurants/${encodeURIComponent(rid)}/insights`, { params: { from: start, to: end } });

  return {
    rangeLabel: `${data.range.from} - ${data.range.to}`,
    totalCount: data.counts.total,
    totalAmount: data.totals.gross,
    confirmedCount: data.counts.confirmed,
    pendingCount: data.counts.pending,
    rejectedCount: data.counts.cancelled,
  } as ReservationStats;
}

// ----------------------------------------------------
// Eklenen / Tamamlanan fonksiyonlar
// ----------------------------------------------------

// (A) Müşteri rezervasyonu iptal et
export async function cancelReservation(rid: string) {
  const { data } = await api.post<{ ok: true; status: ReservationStatus }>(
    `/reservations/${rid}/cancel`, {}
  );
  return data;
}

// (B) QR data URL getir (müşteri detay ekranında gösterilecek)
export async function getReservationQR(rid: string) {
  const { data } = await api.get<{ qrDataUrl: string }>(
    `/reservations/${rid}/qr`
  );
  return data.qrDataUrl as string;
}

// (C) Dekont yükleme — RN FormData
function normalizeUri(uri: string) {
  return Platform.OS === "ios" ? uri.replace("file://", "") : uri;
}

export async function uploadReservationReceipt(
  rid: string,
  file: { uri: string; name?: string; type?: string }
) {
  const form = new FormData();

  // RN tip uyumu için bilinçli cast
  const part = {
    uri: normalizeUri(file.uri),
    name: file.name ?? `receipt_${Date.now()}.jpg`,
    type: file.type ?? "image/jpeg",
  } as unknown as Blob;

  form.append("file", part);

  const { data } = await api.post<{ receiptUrl: string; status: string }>(
    `/reservations/${rid}/receipt`,
    form
  );
  return data;
}

// (D) Eski çağrılara uyumluluk için kısa ad
export const uploadReceipt = uploadReservationReceipt;

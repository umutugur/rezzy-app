import { api } from "./client";
import { normalizeMongoId } from "./restaurants";
import { useAuth } from "../store/useAuth";
import { Platform } from "react-native";
// ✅ legacy import: uploadAsync burada
import * as FileSystem from "expo-file-system/legacy";

export interface Reservation {
  _id: string;
  dateTimeUTC: string;
  partySize: number;
  totalPrice?: number;
  depositAmount?: number;
  status: string;
  restaurantId?: any;
  userId?: any;
  receiptUrl?: string;
  arrivedCount?: number;
  underattended?: boolean;
  [key: string]: any;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "no_show"
  | "cancelled";

async function unwrap<T>(p: Promise<{ data: T }>): Promise<T> {
  const res = await p;
  return res.data;
}

export type CreateReservationPayload = {
  restaurantId: string;
  dateTimeISO: string;
  partySize: number;
  selections: { person: number; menuId: string; price?: number }[];
  notes?: string;
};

export async function createReservation(
  payload: CreateReservationPayload
): Promise<Reservation> {
  const body: any = { ...payload, dateTime: payload.dateTimeISO };
  return unwrap(api.post<Reservation>("/reservations", body));
}

export async function fetchReservationsByRestaurant(
  restId: string
): Promise<Reservation[]> {
  const rid = normalizeMongoId(restId);
  return unwrap(
    api.get<Reservation[]>(`/restaurants/${rid}/reservations`, {
      params: { _cb: Date.now() },
    })
  );
}

export async function updateReservationStatus(
  id: string,
  status: string
): Promise<Reservation> {
  return unwrap(api.put<Reservation>(`/restaurants/reservations/${id}/status`, { status }));
}

export async function getReservationQR(id: string): Promise<string> {
  const data = await unwrap(api.get<{ qrDataUrl: string }>(`/reservations/${id}/qr`));
  return data.qrDataUrl;
}

export async function cancelReservation(id: string): Promise<Reservation> {
  return unwrap(api.put<Reservation>(`/restaurants/reservations/${id}/status`, { status: "cancelled" }));
}

/* ----------------- Upload Receipt (axios → legacy uploadAsync fallback) ----------------- */


// src/api/reservations.ts (yalnızca uploadReceipt'i değiştiriyoruz)
import { API_BASE_URL } from "./client";


type FileLike = { uri: string; name?: string; type?: string };

export async function uploadReceipt(id: string, file: FileLike) {
  console.log("[uploadReceipt] ▶ start");
  console.log("[uploadReceipt] id =", id);
  console.log("[uploadReceipt] raw file =", file);

  // — Güvenli isim/MIME & URI normalize —
  const safeUri = file.uri?.startsWith("file://") ? file.uri : `file://${file.uri}`;
  const nameFromUri = (safeUri.split("/").pop() || "receipt");
  const extFromUri = (nameFromUri.split(".").pop() || "").toLowerCase();

  const guessFromExt = (ext: string) => {
    switch (ext) {
      case "jpg":
      case "jpeg": return "image/jpeg";
      case "png":  return "image/png";
      case "heic": return "image/heic";
      case "heif": return "image/heif";
      case "webp": return "image/webp";
      case "pdf":  return "application/pdf";
      default:     return "image/jpeg";
    }
  };

  const finalName =
    file.name && file.name.includes(".") ? file.name : (extFromUri ? nameFromUri : `${nameFromUri}.jpg`);

  const finalType = file.type || guessFromExt((finalName.split(".").pop() || "").toLowerCase());

  console.log("[uploadReceipt] normalized", {
    platform: Platform.OS,
    safeUri: safeUri.length > 90 ? safeUri.slice(0, 90) + "…" : safeUri,
    finalName,
    finalType,
  });

  // — FormData hazırlanıyor (fetch ile) —
  const form = new FormData();
  form.append("file", { uri: safeUri, name: finalName, type: finalType } as any);

  const url = `${API_BASE_URL}/reservations/${id}/receipt?_cb=${Date.now()}`;
  const { token } = useAuth.getState();

  console.log("[uploadReceipt] 🔼 fetch POST", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // ÖNEMLİ: Content-Type'ı ELLE AYARLAMA! fetch boundary'yi kendi ekler.
    },
    body: form,
  });

  console.log("[uploadReceipt] fetch done", { status: resp.status });

  // 404 için eski rotaya fallback
  if (resp.status === 404) {
    const fbUrl = `${API_BASE_URL}/restaurants/reservations/${id}/receipt?_cb=${Date.now()}`;
    console.log("[uploadReceipt] 🔁 fetch fallback POST", fbUrl);
    const fbResp = await fetch(fbUrl, {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    console.log("[uploadReceipt] fetch fallback done", { status: fbResp.status });
    if (!fbResp.ok) {
      const t = await fbResp.text().catch(() => "");
      throw new Error(`fallback failed: HTTP ${fbResp.status} – ${t.slice(0, 200)}`);
    }
    return await fbResp.json().catch(() => ({}));
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.log("[uploadReceipt] ❌ fetch error body", t.slice(0, 400));
    throw new Error(`upload failed: HTTP ${resp.status} – ${t.slice(0, 200)}`);
  }

  // Başarılı: JSON bekliyoruz
  const data = await resp.json().catch(() => ({}));
  console.log("[uploadReceipt] ✅ success keys", Object.keys(data || {}));
  return data;
}
export async function getMyReservations(): Promise<Reservation[]> {
  try {
    const res = await api.get<Reservation[]>(`/reservations`, {
      params: { _cb: Date.now() },
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    return res.data;
  } catch {
    return [];
  }
}

/** ✅ Listeler için hafif tip */
export type ReservationLite = Pick<
  Reservation,
  "_id" | "dateTimeUTC" | "partySize" | "totalPrice" | "depositAmount" |
  "status" | "restaurantId" | "userId" | "receiptUrl"
>;
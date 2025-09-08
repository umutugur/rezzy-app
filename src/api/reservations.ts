// api/reservations.ts
import { api } from "./client";
import * as FileSystem from "expo-file-system";
import { useAuth } from "../store/useAuth";

/* ---------- Types ---------- */

export type ReservationLite = {
  _id: string;
  restaurantId: { _id: string; name: string };
  dateTimeUTC: string;
  status: "pending" | "confirmed" | "arrived" | "no_show" | "cancelled" | string;
  receiptUrl?: string;
  partySize?: number;            // backend artık döndürüyor
  totalPrice?: number;           // opsiyonel (liste için)
  depositAmount?: number;        // opsiyonel (liste için)
};

export async function getMyReservations(status?: string) {
  const { data } = await api.get<ReservationLite[]>(
    `/reservations${status ? `?status=${encodeURIComponent(status)}` : ""}`
  );
  return data;
}

export type ReservationSelectionDto = {
  person: number;
  menuId: string;
  price: number; // kişi başı fiyat (snapshot)
};

export type ReservationDto = {
  _id: string;
  restaurantId: { _id: string; name: string; depositRate?: number } | string;
  userId: string;
  dateTimeUTC: string;
  status: "pending" | "confirmed" | "arrived" | "no_show" | "cancelled" | string;
  receiptUrl?: string;
  qrSig?: string;

  // ↓ Backend’in detayda döndürdükleri
  partySize: number;
  selections: ReservationSelectionDto[];
  totalPrice: number;
  depositAmount: number;

  checkinAt?: string;
  cancelledAt?: string;
  noShowAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getReservation(reservationId: string) {
  const { data } = await api.get<ReservationDto>(`/reservations/${reservationId}`);
  return data;
}

/* ---------- Create ---------- */

export type CreateReservationInput = {
  restaurantId: string;
  dateTimeISO: string;
  selections: Array<{ menuId: string; person: number }>;
  // partySize'ı burada vermesen de hesaplanır ve body'ye eklenir.
};

export type CreateReservationResponse = {
  reservationId: string;
  partySize: number;
  total: number;
  deposit: number;
  status: "pending" | "confirmed" | "arrived" | "no_show" | "cancelled";
  _id?: string;
};

function sumPartySize(selections: Array<{ person: number }>) {
  return (selections || []).reduce((a, s) => a + (Number(s.person) || 0), 0);
}

export async function createReservation(payload: CreateReservationInput): Promise<CreateReservationResponse> {
  if (!payload?.selections?.length) {
    throw new Error("En az bir seçim gerekli");
  }
  const partySize = sumPartySize(payload.selections);
  if (partySize < 1) {
    throw new Error("Kişi sayısı toplamı en az 1 olmalı");
  }

  const { data } = await api.post("/reservations", {
    restaurantId: payload.restaurantId,
    dateTimeISO: payload.dateTimeISO,
    // 👇 Backend validator gereği zorunlu
    partySize,
    selections: payload.selections.map(s => ({
      menuId: s.menuId,
      person: Number(s.person) || 0,
    })),
  });

  return data as CreateReservationResponse;
}

/* ---------- Receipt Upload ---------- */

export async function uploadReceipt(
  reservationId: string,
  file: { uri: string; name: string; type: string }
) {
  const token = useAuth.getState().token;
  const url = `${api.defaults.baseURL}/reservations/${reservationId}/receipt`;

  // Android content:// -> cache
  let fileUri = file.uri;
  if (fileUri.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}${file.name}`;
    await FileSystem.copyAsync({ from: fileUri, to: dest });
    fileUri = dest;
  }

  const res = await FileSystem.uploadAsync(url!, fileUri, {
    httpMethod: "POST",
    headers: { Authorization: `Bearer ${token}` },
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: file.type,
    parameters: { filename: file.name },
  });

  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status}: ${res.body}`);
  }

  return JSON.parse(res.body) as {
    receiptUrl: string;
    status: string;
    public_id?: string;
  };
}

/* ---------- Other actions ---------- */

export async function approveReservation(reservationId: string) {
  const { data } = await api.post(`/reservations/${reservationId}/approve`);
  return data as { ok: boolean; qrDataUrl: string };
}

export async function cancelReservation(reservationId: string) {
  const { data } = await api.post(`/reservations/${reservationId}/cancel`);
  return data as { ok: boolean; status: string };
}

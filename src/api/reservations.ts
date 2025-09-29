import { api } from "./client";
import { normalizeMongoId } from "./restaurants";

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
  arrivedCount?: number;                 // check-in’de girilen gerçek gelen kişi
  underattended?: boolean;               // eşik altı katılım var mı
  [key: string]: any;
}

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "no_show"
  | "cancelled";

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
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

/**
 * Restoran rezervasyonlarını getirir.
 * Sunucu hem [] hem { items, nextCursor } döndürebildiği için normalize ediyoruz.
 * Ayrıca 304’ü önlemek için client.ts’de cache-buster var; yine de burada da header/param koyuyoruz.
 */
export async function fetchReservationsByRestaurant(
  restId: string
): Promise<Reservation[]> {
  const rid = normalizeMongoId(restId);
  return unwrap(
    api.get<Reservation[]>(`/restaurants/${rid}/reservations`, {
      params: { _cb: Date.now() }, // ekstra güvenlik
    })
  );
}


export async function updateReservationStatus(
  id: string,
  status: string
): Promise<Reservation> {
  return unwrap(
    api.put<Reservation>(`/restaurants/reservations/${id}/status`, { status })
  );
}

export async function getReservationQR(id: string): Promise<string> {
  const data = await unwrap(
    api.get<{ qrDataUrl: string }>(`/reservations/${id}/qr`)
  );
  return data.qrDataUrl;
}

export async function cancelReservation(id: string): Promise<Reservation> {
  return unwrap(
    api.put<Reservation>(`/restaurants/reservations/${id}/status`, {
      status: "cancelled",
    })
  );
}

export async function uploadReceipt(
  id: string,
  file: { uri: string; name: string; type: string }
): Promise<Reservation> {
  const data = new FormData();
  data.append(
    "file",
    {
      uri: file.uri,
      name: file.name ?? "receipt.jpg",
      type: file.type ?? "image/jpeg",
    } as any
  );

  try {
    return await unwrap(
      api.post<Reservation>(`/reservations/${id}/receipt`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    );
  } catch (e: any) {
    if (e?.response?.status === 404) {
      return await unwrap(
        api.post<Reservation>(`/restaurants/reservations/${id}/receipt`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    }
    throw e;
  }
}

export async function getReservation(id: string): Promise<Reservation> {
  return unwrap(api.get<Reservation>(`/reservations/${id}`));
}

export async function getMyReservations(): Promise<Reservation[]> {
  try {
    // Aynı 304 önlemi burada da:
    const res = await api.get<Reservation[]>(`/reservations`, {
      params: { _cb: Date.now() },
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    return res.data;
  } catch {
    return [];
  }
}

/** ✅ Listeler için hafif tip (export edildi!) */
export type ReservationLite = Pick<
  Reservation,
  | "_id"
  | "dateTimeUTC"
  | "partySize"
  | "totalPrice"
  | "depositAmount"
  | "status"
  | "restaurantId"
  | "userId"
  | "receiptUrl"
>;

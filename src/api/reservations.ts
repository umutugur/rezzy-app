import { api } from "./client";
import { normalizeMongoId } from "./restaurants";
import { useAuth } from "../store/useAuth";
import { Platform } from "react-native";
// Legacy import contains uploadAsync for RN envs
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

// Exported types from original file
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

// Alias for a detailed reservation object returned from the backend. Currently
// identical to the Reservation interface, but defined separately for clarity
// and future extensibility.
export type ReservationDto = Reservation;

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

/** ✅ Stripe PaymentIntent (depozito için) */
export type CreateStripePaymentIntentPayload = {
  saveCard?: boolean;
};

export async function createStripePaymentIntent(
  reservationId: string,
  payload: CreateStripePaymentIntentPayload = {}
): Promise<any> {
  const rid = normalizeMongoId(reservationId);
  return unwrap(
    api.post<any>(`/reservations/${rid}/stripe-intent`, payload)
  );
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

/* ----------------- Upload Receipt with robust fallback ----------------- */

import { API_BASE_URL } from "./client";

type FileLike = { uri: string; name?: string; type?: string };

export async function uploadReceipt(id: string, file: FileLike) {
  console.log("[uploadReceipt] ▶ start");
  console.log("[uploadReceipt] id =", id);
  console.log("[uploadReceipt] raw file =", file);

  // Normalize URI and guess file name/type
  const safeUri = file.uri?.startsWith("file://") ? file.uri : `file://${file.uri}`;
  const nameFromUri = safeUri.split("/").pop() || "receipt";
  const extFromUri = (nameFromUri.split(".").pop() || "").toLowerCase();

  const guessFromExt = (ext: string) => {
    switch (ext) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "heic":
        return "image/heic";
      case "heif":
        return "image/heif";
      case "webp":
        return "image/webp";
      case "pdf":
        return "application/pdf";
      default:
        return "image/jpeg";
    }
  };

  const initialName = file.name && file.name.includes(".") ? file.name : (extFromUri ? nameFromUri : `${nameFromUri}.jpg`);
  const initialType = file.type || guessFromExt((initialName.split(".").pop() || "").toLowerCase());

  // Heic dosyaları iOS'ta büyük ve problemli olabiliyor; JPEG'e dönüştür.
  // Ayrıca dosya boyutu 10MB'den büyükse daha yüksek sıkıştırma uygula.
  let uploadUri = safeUri;
  let uploadName = initialName;
  let uploadType = initialType;
  try {
    // fetch basic file info to detect oversize images
    const info: any = await FileSystem.getInfoAsync(safeUri);
    // size may not exist on FileInfo if file does not exist; guard accordingly
    const fileSize: number | undefined = typeof info?.size === "number" ? info.size : undefined;
    // Convert/resize if HEIC/HEIF or if the file is larger than ~1MB.
    const needConvert = /\.hei[f|c]$/i.test(initialName) ||
      (fileSize !== undefined && fileSize > 1 * 1024 * 1024);
    if (needConvert) {
      // choose compression factor based on size: bigger files -> more compression
      // reduce quality more aggressively on larger files (>1MB)
      let compressFactor = 0.7;
      if (fileSize && fileSize > 1 * 1024 * 1024) {
        compressFactor = 0.4;
      }
      if (fileSize && fileSize > 10 * 1024 * 1024) {
        compressFactor = 0.3;
      }
      // Resize to reduce resolution and file size (width 1280px) before compression.
      const actions = [{ resize: { width: 1280 } }];
      const manipulated = await ImageManipulator.manipulateAsync(
        safeUri,
        actions,
        { compress: compressFactor, format: ImageManipulator.SaveFormat.JPEG }
      );
      uploadUri = manipulated.uri;
      uploadName = initialName.replace(/\.[^/.]+$/, ".jpg");
      uploadType = "image/jpeg";
      console.log("[uploadReceipt] converted image", {
        originalSize: fileSize,
        newUri: uploadUri,
        newName: uploadName,
        newType: uploadType,
      });
    }
  } catch (convErr) {
    console.warn("[uploadReceipt] image conversion or file info failed", convErr);
  }

  console.log("[uploadReceipt] normalized", {
    platform: Platform.OS,
    safeUri: safeUri.length > 90 ? safeUri.slice(0, 90) + "…" : safeUri,
    finalName: uploadName,
    finalType: uploadType,
  });

  // Build form data for fallback upload methods
  const form = new FormData();
  form.append("file", { uri: uploadUri, name: uploadName, type: uploadType } as any);

  const fullUrl = `${API_BASE_URL}/reservations/${id}/receipt?_cb=${Date.now()}`;
  const fallbackUrl = `${API_BASE_URL}/restaurants/reservations/${id}/receipt?_cb=${Date.now()}`;
  const { token } = useAuth.getState();

  // ---- Primary method: expo-file-system uploadAsync (only on Android) ----
  // iOS simulators have exhibited NSPOSIXErrorDomain 40 errors for even small files.
  // Therefore we skip uploadAsync on iOS and fallback to axios/fetch directly.
  if (Platform.OS !== "web" && Platform.OS !== "ios") {
    try {
      const options: any = {
        fieldName: "file",
        httpMethod: "POST",
        uploadType: (FileSystem as any).FileSystemUploadType?.MULTIPART || (FileSystem as any).FileSystemUploadType,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      };
      console.log("[uploadReceipt] 📤 uploadAsync POST", fullUrl);
      const res = await FileSystem.uploadAsync(fullUrl, uploadUri, options);
      console.log("[uploadReceipt] uploadAsync done", { status: res.status });
      if (res.status === 404) {
        console.log("[uploadReceipt] 🔁 uploadAsync fallback POST", fallbackUrl);
        const res2 = await FileSystem.uploadAsync(fallbackUrl, uploadUri, options);
        if (res2.status >= 400) {
          throw new Error(`fallback failed: HTTP ${res2.status} – ${res2.body.slice(0, 200)}`);
        }
        return JSON.parse(res2.body || "{}");
      }
      if (res.status >= 400) {
        throw new Error(`upload failed: HTTP ${res.status} – ${res.body.slice(0, 200)}`);
      }
      return JSON.parse(res.body || "{}");
    } catch (err: any) {
      console.warn("[uploadReceipt] uploadAsync error", err?.message || err);
      // On Android, you may want to attempt a binary upload fallback here.
      if (Platform.OS !== "macos") {
        try {
          const binHeaders: any = {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": uploadType,
            "Content-Disposition": `attachment; filename=\"${uploadName}\"`,
          };
          const binOpts: any = {
            httpMethod: "POST",
            uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT || (FileSystem as any).FileSystemUploadType?.BINARY,
            headers: binHeaders,
          };
          console.log("[uploadReceipt] 📤 uploadAsync (binary) POST", fullUrl);
          const binRes = await FileSystem.uploadAsync(fullUrl, uploadUri, binOpts);
          console.log("[uploadReceipt] binary uploadAsync done", { status: binRes.status });
          if (binRes.status === 404) {
            console.log("[uploadReceipt] 🔁 uploadAsync binary fallback POST", fallbackUrl);
            const binRes2 = await FileSystem.uploadAsync(fallbackUrl, uploadUri, binOpts);
            if (binRes2.status >= 400) {
              throw new Error(`binary fallback failed: HTTP ${binRes2.status} – ${binRes2.body.slice(0, 200)}`);
            }
            return JSON.parse(binRes2.body || "{}");
          }
          if (binRes.status >= 400) {
            throw new Error(`binary upload failed: HTTP ${binRes.status} – ${binRes.body.slice(0, 200)}`);
          }
          return JSON.parse(binRes.body || "{}");
        } catch (binErr: any) {
          console.warn("[uploadReceipt] binary uploadAsync error", binErr?.message || binErr);
          // Fall through to next method
        }
      }
    }
  }

  // ---- Secondary method: axios multipart (uses api interceptors) ----
  try {
    console.log("[uploadReceipt] 📦 axios POST", fullUrl);
    const response = await api.post(`/reservations/${id}/receipt`, form, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return response.data;
  } catch (e: any) {
    console.log("[uploadReceipt] axios error", e?.response?.data || e?.message || e);
    // Fall through to fetch
  }

  // ---- Final fallback: native fetch ----
  try {
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};
    console.log("[uploadReceipt] 🔼 fetch POST", fullUrl);
    const resp = await fetch(fullUrl, {
      method: "POST",
      headers,
      body: form,
    });
    console.log("[uploadReceipt] fetch done", { status: resp.status });
    if (resp.status === 404) {
      console.log("[uploadReceipt] 🔁 fetch fallback POST", fallbackUrl);
      const fbResp = await fetch(fallbackUrl, {
        method: "POST",
        headers,
        body: form,
      });
      if (!fbResp.ok) {
        const t = await fbResp.text().catch(() => "");
        throw new Error(`fallback failed: HTTP ${fbResp.status} – ${t.slice(0, 200)}`);
      }
      return await fbResp.json().catch(() => ({}));
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`upload failed: HTTP ${resp.status} – ${t.slice(0, 200)}`);
    }
    const data = await resp.json().catch(() => ({}));
    return data;
  } catch (err: any) {
    console.log("[uploadReceipt] ❌ fetch error", err?.message || err);
    throw err;
  }
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

/**
 * Fetch a single reservation by its identifier.
 * This uses a cache-busting parameter to avoid returning stale data and sets
 * cache-control headers to bypass any intermediary caches. It unwraps the
 * Axios response using the local `unwrap` helper.
 *
 * @param id Reservation ID
 */
export async function getReservation(id: string): Promise<ReservationDto> {
  return unwrap(
    api.get<ReservationDto>(`/reservations/${id}`, {
      params: { _cb: Date.now() },
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    })
  );
}

/** ✅ Listeler için hafif tip */
export type ReservationLite = Pick<
  Reservation,
  "_id" | "dateTimeUTC" | "partySize" | "totalPrice" | "depositAmount" | "status" | "restaurantId" | "userId" | "receiptUrl"
>;
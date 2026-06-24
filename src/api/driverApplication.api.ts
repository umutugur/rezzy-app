// src/api/driverApplication.api.ts
import api from "./client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DriverI18n = { tr?: string; en?: string; ru?: string; el?: string };

export type DriverDocRequirement = {
  _id: string;
  countryCode: string;
  key: string;
  i18n: DriverI18n;
  file: boolean;
  number: boolean;
  numberLabel: DriverI18n;
  expiry: boolean;
  required: boolean;
  order: number;
  isActive: boolean;
};

export type AppDocument = {
  requirementKey: string;
  fileUrl: string;
  number: string;
  expiry: string | null;
  status: "pending" | "verified" | "rejected";
  rejectReason: string | null;
};

export type DriverApplication = {
  _id: string;
  countryCode: string;
  vehicle: { plate: string; brand: string; model: string; color: string; type: string };
  selfieUrl: string;
  documents: AppDocument[];
  status: "draft" | "pending" | "approved" | "rejected";
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmitPayload = {
  countryCode: string;
  vehicle: { plate: string; brand: string; model: string; color: string; type: string };
  selfieUrl: string;
  documents: { requirementKey: string; fileUrl: string; number?: string; expiry?: string | null }[];
};

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * Ülkeye göre sürücü belge gereksinimlerini listeler.
 * GET /taxi/driver/requirements?country=<country> -> data.items
 */
export async function getDriverRequirements(country: string): Promise<DriverDocRequirement[]> {
  const { data } = await api.get("/taxi/driver/requirements", { params: { country } });
  return (data?.items ?? []) as DriverDocRequirement[];
}

/**
 * Giriş yapmış kullanıcının kendi sürücü başvurusunu döndürür.
 * Başvuru yoksa null döner.
 * GET /taxi/driver/application/me -> data.application
 */
export async function getMyDriverApplication(): Promise<DriverApplication | null> {
  const { data } = await api.get("/taxi/driver/application/me");
  return (data?.application ?? null) as DriverApplication | null;
}

/**
 * Yeni sürücü başvurusu oluşturur.
 * POST /taxi/driver/application -> data.application
 */
export async function submitDriverApplication(payload: SubmitPayload): Promise<DriverApplication> {
  const { data } = await api.post("/taxi/driver/application", payload);
  return data.application as DriverApplication;
}

/**
 * Reddedilen başvuruyu belgelerle birlikte yeniden gönderir.
 * PUT /taxi/driver/application/resubmit -> data.application
 */
export async function resubmitDriverApplication(
  documents: SubmitPayload["documents"],
): Promise<DriverApplication> {
  const { data } = await api.put("/taxi/driver/application/resubmit", { documents });
  return data.application as DriverApplication;
}

// Dosya yükleme için: uploads.ts içindeki `uploadToCloud` fonksiyonunu kullan.
// import { uploadToCloud } from "./uploads";
export { uploadToCloud } from "./uploads";

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

export type AppType = "driver" | "market" | "restaurant";

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
  appType?: AppType;
  payload?: Record<string, any>;
};

export type SubmitPayload = {
  countryCode: string;
  vehicle: { plate: string; brand: string; model: string; color: string; type: string };
  selfieUrl: string;
  documents: { requirementKey: string; fileUrl: string; number?: string; expiry?: string | null }[];
};

export type PartnerSubmitPayload = {
  appType: AppType;
  countryCode: string;
  payload: Record<string, any>; // driver:{plate,brand,model,color,type}; market/restaurant:{businessName,category,address,location,phone?}
  selfieUrl: string;
  documents: { requirementKey: string; fileUrl: string; number?: string; expiry?: string | null }[];
};

// ─── Generic /partner/* API Functions ──────────────────────────────────────────

/**
 * Uygulama türü ve ülkeye göre belge gereksinimlerini listeler.
 * GET /partner/requirements?appType=<appType>&country=<country> -> data.items
 */
export async function getPartnerRequirements(
  appType: AppType,
  country: string,
): Promise<DriverDocRequirement[]> {
  const { data } = await api.get("/partner/requirements", { params: { appType, country }, timeout: 15000 });
  return (data?.items ?? []) as DriverDocRequirement[];
}

/**
 * Giriş yapmış kullanıcının kendi partner başvurusunu döndürür.
 * Başvuru yoksa null döner.
 * GET /partner/application/me -> data.application
 */
export async function getMyPartnerApplication(): Promise<DriverApplication | null> {
  const { data } = await api.get("/partner/application/me", { timeout: 15000 });
  return (data?.application ?? null) as DriverApplication | null;
}

/**
 * Yeni partner başvurusu oluşturur.
 * POST /partner/application -> data.application
 */
export async function submitPartnerApplication(body: PartnerSubmitPayload): Promise<DriverApplication> {
  const { data } = await api.post("/partner/application", body);
  return data.application as DriverApplication;
}

/**
 * Reddedilen başvuruyu belgelerle birlikte yeniden gönderir.
 * PUT /partner/application/resubmit -> data.application
 */
export async function resubmitPartnerApplication(
  documents: PartnerSubmitPayload["documents"],
): Promise<DriverApplication> {
  const { data } = await api.put("/partner/application/resubmit", { documents });
  return data.application as DriverApplication;
}

// ─── Legacy Driver Aliases (DriverApplicationScreen uyumluluğu için) ────────────

/**
 * @deprecated Use getPartnerRequirements("driver", country) instead.
 * Ülkeye göre sürücü belge gereksinimlerini listeler.
 */
export async function getDriverRequirements(country: string): Promise<DriverDocRequirement[]> {
  return getPartnerRequirements("driver", country);
}

/**
 * @deprecated Use getMyPartnerApplication() instead.
 * Giriş yapmış kullanıcının kendi sürücü başvurusunu döndürür.
 */
export async function getMyDriverApplication(): Promise<DriverApplication | null> {
  return getMyPartnerApplication();
}

/**
 * @deprecated Use submitPartnerApplication() instead.
 * Yeni sürücü başvurusu oluşturur.
 */
export async function submitDriverApplication(payload: SubmitPayload): Promise<DriverApplication> {
  return submitPartnerApplication({
    appType: "driver",
    countryCode: payload.countryCode,
    payload: payload.vehicle ?? {},
    selfieUrl: payload.selfieUrl,
    documents: payload.documents,
  });
}

/**
 * @deprecated Use resubmitPartnerApplication() instead.
 * Reddedilen başvuruyu belgelerle birlikte yeniden gönderir.
 */
export async function resubmitDriverApplication(
  documents: SubmitPayload["documents"],
): Promise<DriverApplication> {
  return resubmitPartnerApplication(documents);
}

// Dosya yükleme için: uploads.ts içindeki `uploadToCloud` fonksiyonunu kullan.
// import { uploadToCloud } from "./uploads";
export { uploadToCloud } from "./uploads";

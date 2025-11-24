// src/api/client.ts
import axios, {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useAuth } from "../store/useAuth";

// === SABİT BASE_URL ===
const BASE_URL = "https://rezzy-backend.onrender.com/api";
if (__DEV__) console.log("[api] BASE_URL =", BASE_URL);

// ——— Helpers
function maskToken(t?: string | null) {
  if (!t) return "∅";
  return `${t.slice(0, 8)}…(${t.length})`;
}
function isFormDataLike(data: any): boolean {
  if (typeof FormData !== "undefined" && data instanceof FormData) return true;
  return !!(data && typeof data === "object" && Array.isArray((data as any)._parts));
}
function approxSize(data: any): string {
  try {
    if (!data) return "0B";
    if (isFormDataLike(data)) {
      const parts = (data as any)?._parts ?? [];
      return `~FormData parts=${parts.length}`;
    }
    const s = JSON.stringify(data);
    const bytes = new TextEncoder().encode(s).length;
    const kb = (bytes / 1024).toFixed(1);
    return `${kb}KB`;
  } catch {
    return "unknown";
  }
}

// İstek süresi ölçümü için metadata
type TimedConfig = InternalAxiosRequestConfig & { metadata?: { start: number } };

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// === Request Interceptor ===
api.interceptors.request.use((config: TimedConfig): TimedConfig => {
  const { token } = useAuth.getState();

  // headers hiçbir zaman undefined kalmasın
  config.headers = (config.headers ?? {}) as AxiosRequestHeaders;

  // Auth
  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  // SÜRE ÖLÇÜMÜ
  config.metadata = { start: Date.now() };

  // ---- CACHE BUSTER: SADECE GET ----
  const method = (config.method || "get").toLowerCase();
  if (method === "get") {
    const origUrl = config.url || "";
    const hasQuery = origUrl.includes("?");
    const sep = hasQuery ? "&" : "?";
    config.url = `${origUrl}${sep}_cb=${Date.now()}`;
  }

  // ---- CONTENT-TYPE YÖNETİMİ ----
  // FormData ise Content-Type'ı ASLA elle set etme (RN boundary ekler)
  const isFD = isFormDataLike(config.data);
  if (isFD) {
    if (config.headers) {
      delete (config.headers as any)["Content-Type"];
      delete (config.headers as any)["content-type"];
    }
  } else {
    // JSON ise Content-Type yoksa ekle
    const hasCT =
      (config.headers as any)["Content-Type"] ||
      (config.headers as any)["content-type"];
    if (!hasCT) {
      (config.headers as any)["Content-Type"] = "application/json";
    }
  }

  if (__DEV__) {
    const ctLog =
      (config.headers as any)["Content-Type"] ||
      (config.headers as any)["content-type"] ||
      (isFD ? "(auto by RN at runtime)" : "application/json");
    const absUrl =
      (config.baseURL ? config.baseURL.replace(/\/+$/, "") : "") +
      (config.url || "");
    console.log("[api:req]", (config.method || "get").toUpperCase(), absUrl);
    console.log("[api:req] hdr", {
      "Content-Type": ctLog,
      Authorization: token ? `Bearer ${maskToken(token)}` : "∅",
    });
    if (config.params) console.log("[api:req] params", config.params);
    if (config.data !== undefined) {
      console.log(
        "[api:req] body",
        isFD ? "FormData" : "JSON",
        approxSize(config.data)
      );
    }
  }

  return config;
});

// === Response Interceptor (401 -> refresh -> retry) ===
let refreshingPromise: Promise<void> | null = null;

async function doRefresh() {
  const { refreshToken } = useAuth.getState();
  if (__DEV__) console.log("[auth] trying refresh… hasRT=", !!refreshToken);
  if (!refreshToken) throw new Error("No refresh token");

  const resp = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
  const { token, refreshToken: newRT } = resp.data || {};
  await useAuth.getState().setAuth(token, undefined as any, newRT || refreshToken);

  if (__DEV__) console.log("[auth] token refreshed ✅ (new=", maskToken(token), ")");
}

api.interceptors.response.use(
  (r: AxiosResponse) => {
    if (__DEV__) {
      const cfg = (r.config || {}) as TimedConfig;
      const dur = cfg.metadata?.start ? Date.now() - cfg.metadata.start : undefined;
      const absUrl =
        (cfg.baseURL ? cfg.baseURL.replace(/\/+$/, "") : "") + (cfg.url || "");
      console.log("[api:res]", r.status, absUrl, dur != null ? `${dur}ms` : "");
    }
    return r;
  },
  async (error: AxiosError & { config?: TimedConfig }) => {
    const cfg = error?.config as TimedConfig | undefined;
    const status = error?.response?.status;
    const dur = cfg?.metadata?.start ? Date.now() - cfg.metadata.start : undefined;
    const absUrl = cfg
      ? (cfg.baseURL ? cfg.baseURL.replace(/\/+$/, "") : "") + (cfg.url || "")
      : "(no-config)";

    if (__DEV__) {
      const netErr = !error.response;
      const preview =
        (error as any)?.response?.data ??
        (error as any)?.toJSON?.() ??
        (error as any)?.message ??
        error;
      console.log("[api:err]", {
        status: status ?? "∅",
        net: netErr ? "yes" : "no",
        dur: dur != null ? `${dur}ms` : "∅",
      });
      console.log("[api:err] url", absUrl);
      if ((error as any)?.code) console.log("[api:err] code", (error as any).code);
      console.log("[api:err] resp", preview);
    }

    // 401 ise refresh dene
    if (status === 401 && cfg && !(cfg as any)._retry) {
      (cfg as any)._retry = true;

      if (!refreshingPromise) {
        refreshingPromise = doRefresh()
          .catch(async (e) => {
            if (__DEV__) {
              console.log(
                "[auth] refresh failed ❌",
                (e as any)?.response?.data || (e as any)?.message || e
              );
            }
            await useAuth.getState().clear();
            throw e;
          })
          .finally(() => {
            refreshingPromise = null;
          });
      }

      await refreshingPromise;

      const { token } = useAuth.getState();
      cfg.headers = (cfg.headers ?? {}) as AxiosRequestHeaders;
      if (token) {
        (cfg.headers as any).Authorization = `Bearer ${token}`;
        if (__DEV__) console.log("[api] retrying request with new token 🔁", absUrl);
      }
      return api(cfg);
    }

    return Promise.reject(error);
  }
);

export const API_BASE_URL = BASE_URL;
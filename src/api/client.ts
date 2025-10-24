import axios, { AxiosError } from "axios";
import { useAuth } from "../store/useAuth";

// === SENİN BASE_URL'İN DEĞİŞMEDİ ===
const BASE_URL = "https://rezzy-backend.onrender.com/api";
if (__DEV__) console.log("[api] BASE_URL =", BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// === Request Interceptor ===
api.interceptors.request.use((config) => {
  const { token } = useAuth.getState();

  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
    if (__DEV__) console.log("[api] attaching token ✅", config.url);
  } else {
    if (__DEV__) console.log("[api] no token ⚠️", config.url);
  }

  const hasQuery = (config.url || "").includes("?");
  const sep = hasQuery ? "&" : "?";
  config.url = `${config.url}${sep}_cb=${Date.now()}`;
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

  if (__DEV__) console.log("[auth] token refreshed ✅");
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError & { config?: any }) => {
    const original = error?.config as any;
    const status = error?.response?.status;

    if (__DEV__) {
      console.log("[api] response error", status, original?.url);
    }

    // Network veya backend erişim hatası
    if (!error.response && __DEV__) {
      console.warn("[api] Network error:", error.message);
    }

    // Sadece 401 durumunda refresh dener
    if (status === 401 && original && !original._retry) {
      original._retry = true;

      if (!refreshingPromise) {
        refreshingPromise = doRefresh()
          .catch(async (e) => {
            console.log(
              "[auth] refresh failed ❌",
              (e as any)?.response?.data || (e as any)?.message || e
            );
            await useAuth.getState().clear();
            throw e;
          })
          .finally(() => {
            refreshingPromise = null;
          });
      }

      await refreshingPromise;

      const { token } = useAuth.getState();
      original.headers = original.headers || {};
      if (token) {
        (original.headers as any).Authorization = `Bearer ${token}`;
        if (__DEV__) console.log("[api] retrying request with new token 🔁", original.url);
      }
      return api(original);
    }

    return Promise.reject(error);
  }
);
import axios from "axios";
import { useAuth } from "../store/useAuth";

export const api = axios.create({
  baseURL: "https://rezzy-backend.onrender.com/api",
  timeout: 30000,
});


api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;

  // Header'lar
  config.headers = (config.headers as any) ?? {};
  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  // 304'ü tetikleyen önbelleği devre dışı bırak
  (config.headers as any)["Cache-Control"] = "no-cache";
  (config.headers as any)["Pragma"] = "no-cache";
  // Bazı ortamlarda otomatik gelen ETag başlığını kesin sök
  if ((config.headers as any)["If-None-Match"]) {
    delete (config.headers as any)["If-None-Match"];
  }

  // Cache-buster query param
  config.params = {
    ...(config.params || {}),
    _cb: Date.now(),
  };

  // DEBUG
  console.log("Authorization header:", (config.headers as any)?.Authorization);
  return config;
});

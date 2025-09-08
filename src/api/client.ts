import axios from "axios";
import { useAuth } from "../store/useAuth";

export const api = axios.create({
  baseURL: "http://192.168.1.131:4000/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // DEBUG: konsola yaz
  console.log("Authorization header:", config.headers?.Authorization);
  return config;
});

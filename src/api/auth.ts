// src/api/auth.ts
import { api } from "./client";
import type { User } from "../store/useAuth";

export type LoginResp = {
  token: string;
  refreshToken?: string | null;
  user: User;
};

export async function login(email: string, password: string): Promise<LoginResp> {
  const { data } = await api.post<LoginResp>("/auth/login", { email, password });
    console.log("[auth] login resp:", data); // ✅ test log
  return data;
}

export async function register(name: string, email: string, password: string){
  const { data } = await api.post<LoginResp>("/auth/register", { name, email, password, role:"customer" });
  return data;
}

// Google: expo-auth-session ile idToken al; backend'e gönder
export async function googleSignIn(idToken: string): Promise<LoginResp> {
  const { data } = await api.post<LoginResp>("/auth/google", { idToken });
  return data;
}

export async function appleSignIn(identityToken: string): Promise<LoginResp> {
  const { data } = await api.post<LoginResp>("/auth/apple", { identityToken });
  return data;
}

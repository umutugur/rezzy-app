import { api } from "./client";
import type { User } from "../store/useAuth"; // oradan tipi al
export type LoginResp = {
  token: string;
  user: User; // { id, name, role, restaurantId? ... } — store’da genişlettin
};

export async function login(email: string, password: string): Promise<LoginResp> {
  const { data } = await api.post<LoginResp>("/auth/login", { email, password });
  return data;
}
export async function register(name: string, email: string, password: string){
  const { data } = await api.post("/auth/register", { name, email, password, role:"customer" });
  return data as { token: string };
}
// Google: expo-auth-session ile idToken al; backend'e gönder
export async function googleSignIn(idToken: string){
  const { data } = await api.post("/auth/google", { idToken });
  return data as { token: string };
}
export async function appleSignIn(identityToken: string){
  const { data } = await api.post("/auth/apple", { identityToken });
  return data as { token: string };
}

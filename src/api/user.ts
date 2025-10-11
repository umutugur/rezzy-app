import { api } from "./client";
import type { User } from "../store/useAuth";

/** Profilimi getir */
export async function getMe(): Promise<User> {
  const { data } = await api.get("/auth/me");
  return {
    id: data.id ?? data._id ?? data.user?.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    restaurantId: data.restaurantId || undefined,
    avatarUrl: data.avatarUrl || null,
    notificationPrefs: data.notificationPrefs || {},
    providers: data.providers || [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as User;
}

/** Profilimi güncelle */
export async function patchMe(patch: {
  name?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string | null;
  notificationPrefs?: { push?: boolean; sms?: boolean; email?: boolean };
}): Promise<User> {
  const { data } = await api.patch("/auth/me", patch);
  return {
    id: data.id ?? data._id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    restaurantId: data.restaurantId || undefined,
    avatarUrl: data.avatarUrl || null,
    notificationPrefs: data.notificationPrefs || {},
    providers: data.providers || [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  } as User;
}

/** Şifre değiştir */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await api.post("/auth/change-password", { currentPassword, newPassword });
  return data?.ok === true;
}

/** Avatar yükle → URL döner ve profili günceller */
export async function uploadAvatarRN(file: { uri: string; name?: string; type?: string }): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name ?? "avatar.jpg",
    type: file.type ?? "image/jpeg",
  } as any);

  const { data } = await api.post("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const url = data?.url || data?.secure_url || data?.Location || data?.data?.url;
  if (!url) throw new Error("Yükleme başarısız: URL alınamadı.");

  await patchMe({ avatarUrl: String(url) });
  return String(url);
}

/** 🔴 Hesabı sil (Apple gereksinimi) */
export async function deleteAccount(): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.delete("/users/me");
  return data;
}
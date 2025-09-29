// src/api/favorites.ts
import { api } from "./client";

/** Sunucunun döndürdüğü minimal restoran tipi (favorites listesi için) */
export type FavoriteRestaurant = {
  _id: string;
  name: string;
  city?: string;
  address?: string;
  photos?: string[];
  priceRange?: string;
  rating?: number | null;
};

type AddRemoveResp = { ok: boolean; count: number };
type ToggleResp = { ok: boolean; favorited: boolean; count: number };

async function unwrap<T>(p: Promise<{ data: T }>): Promise<T> {
  const { data } = await p;
  return data;
}

/** ✅ Favorilerimi getir */
export async function listFavorites() {
  return unwrap<FavoriteRestaurant[]>(api.get("/me/favorites", {
    // 304/ETag takılmalarını önlemek için hafif cache-buster
    params: { _cb: Date.now() },
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  }));
}

/** ✅ Favoriye ekle (idempotent) */
export async function addFavorite(restaurantId: string) {
  return unwrap<AddRemoveResp>(api.post(`/me/favorites/${restaurantId}`, {}));
}

/** ✅ Favoriden çıkar (idempotent) */
export async function removeFavorite(restaurantId: string) {
  return unwrap<AddRemoveResp>(api.delete(`/me/favorites/${restaurantId}`));
}

/** ✅ Toggle (varsa çıkar, yoksa ekle) */
export async function toggleFavorite(restaurantId: string) {
  return unwrap<ToggleResp>(api.post(`/me/favorites/${restaurantId}/toggle`, {}));
}

/** (Opsiyonel) Client-side yardımcı: favori mi? */
export function isFavorited(favs: FavoriteRestaurant[] | string[], id: string) {
  if (!Array.isArray(favs)) return false;
  const needle = String(id);
  // Hem obje listesi hem sadece id listesi ile çalışır
  return favs.some((f: any) => String(f?._id ?? f) === needle);
}

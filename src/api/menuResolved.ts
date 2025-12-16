// src/api/menuResolved.ts
import { api } from "./client";
import { normalizeMongoId } from "./restaurants";

export type ResolvedMenuItem = {
  _id?: string;
  id?: string;

  // bazı backendlere göre:
  orgItemId?: string | null;

  title: string;
  description?: string | null;
  price: number;
  photoUrl?: string | null;
  tags?: string[];

  order?: number;
  isActive?: boolean;
  isAvailable?: boolean;

  source?: "org" | "org_branch_override" | "local";
};

export type ResolvedMenuCategory = {
  _id?: string;
  id?: string;

  // bazı backendlere göre:
  orgCategoryId?: string | null;

  title: string;
  description?: string | null;

  order?: number;
  isActive?: boolean;

  source?: "org" | "org_branch_override" | "local";

  items: ResolvedMenuItem[];
};

export type ResolvedMenuResponse = {
  restaurantId?: string;
  organizationId?: string | null;
  categories: ResolvedMenuCategory[];
};

/**
 * Org + override + local merge edilmiş menü.
 * Beklenen endpoint: GET /restaurants/:id/menu/resolved
 */
export async function rpGetResolvedMenu(
  restaurantId: string,
  params?: { includeInactive?: boolean; includeUnavailable?: boolean }
): Promise<ResolvedMenuResponse> {
  const rid = normalizeMongoId(restaurantId);
  const res = await api.get<ResolvedMenuResponse>(`/restaurants/${rid}/menu/resolved`, { params });
  return res.data;
}
// src/api/menuResolved.ts
export async function rpGetPublicResolvedMenu(
  restaurantId: string
): Promise<ResolvedMenuResponse> {
  const rid = normalizeMongoId(restaurantId);
  const res = await api.get<ResolvedMenuResponse>(
    `/restaurants/${rid}/menu/public`
  );
  return res.data;
}
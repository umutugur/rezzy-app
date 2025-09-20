import { api } from "./client";
import type { ReservationLite } from "./reservations";

/** ----------------- küçük yardımcılar ----------------- */
async function unwrap<T>(p: Promise<{ data: T }>): Promise<T> {
  const { data } = await p;
  return data;
}

// --- KPI Types -------------------------------------------------
export type GroupKey = "day" | "week" | "month";

type KpiParams = {
  start?: string;
  end?: string;
  groupBy?: GroupKey;
};

/** ----------------- KPI (backend’e birebir uyumlu) -----------------
 * Backend routes (routes/admin.js):
 *  GET /admin/kpi/global
 *  GET /admin/kpi/restaurants/:rid
 *  GET /admin/kpi/users/:uid
 * Query: start=YYYY-MM-DD, end=YYYY-MM-DD, groupBy=day|week|month
 */

// Auto-detect karmaşasına gerek yok: doğru path’lere direkt git
export async function getAdminKpiGlobal(apiInstance: any, params?: KpiParams) {
  const q: any = {};
  if (params?.start) q.start = params.start;
  if (params?.end) q.end = params.end;
  if (params?.groupBy) q.groupBy = params.groupBy;
  return (await apiInstance.get("/admin/kpi/global", { params: q })).data;
}

export async function getAdminKpiRestaurant(
  apiInstance: any,
  restaurantId: string,
  params?: KpiParams
) {
  const q: any = {};
  if (params?.start) q.start = params.start;
  if (params?.end) q.end = params.end;
  if (params?.groupBy) q.groupBy = params.groupBy;
  return (await apiInstance.get(`/admin/kpi/restaurants/${restaurantId}`, { params: q })).data;
}

// Eski “configurable” arabirimi kullanan yerler için şeker kaplama:
export async function adminKpiGlobal(params?: KpiParams) {
  return getAdminKpiGlobal(api, params);
}
export async function adminKpiRestaurant(
  restaurantId: string,
  params?: KpiParams
) {
  return getAdminKpiRestaurant(api, restaurantId, params);
}
export async function adminKpiUser(userId: string, params?: KpiParams) {
  const q: any = {};
  if (params?.start) q.start = params.start;
  if (params?.end) q.end = params.end;
  if (params?.groupBy) q.groupBy = params.groupBy;
  return unwrap(api.get(`/admin/kpi/users/${userId}`, { params: q }));
}

/** ----------------- Types (export!) ----------------- */
export type AdminListRestaurantsParams = {
  city?: string;
  query?: string;
  limit?: number;
  cursor?: string;
};

export type AdminListUsersParams = {
  query?: string;
  role?: "" | "customer" | "restaurant" | "admin";
  banned?: "" | "true" | "false";
  limit?: number;
  cursor?: string;
};

export type AdminListReservationsParams = {
  status?: "" | "pending" | "confirmed" | "arrived" | "cancelled" | "no_show";
  restaurantId?: string;
  start?: string;
  end?: string;
  limit?: number;
  cursor?: string;
};

export type AdminListReviewsParams = {
  restaurantId?: string;
  status?: "" | "visible" | "hidden" | "removed";
  limit?: number;
  cursor?: string;
};

export type AdminListComplaintsParams = {
  restaurantId?: string;
  status?: "" | "open" | "resolved" | "dismissed";
  limit?: number;
  cursor?: string;
};

/** ----------------- Restaurants ----------------- */
export async function adminListRestaurants(
  params?: AdminListRestaurantsParams | string
) {
  const p =
    typeof params === "string"
      ? ({ city: params } as AdminListRestaurantsParams)
      : params ?? {};
  return unwrap(
    api.get<{ items: any[]; nextCursor?: string }>("/admin/restaurants", {
      params: p,
    })
  );
}

export async function adminGetRestaurant(id: string) {
  return unwrap(api.get(`/admin/restaurants/${id}`));
}

export async function adminListRestaurantReservations(
  id: string,
  params?: { limit?: number; cursor?: string }
) {
  return unwrap(
    api.get<{ items: ReservationLite[]; nextCursor?: string }>(
      `/admin/restaurants/${id}/reservations`,
      { params }
    )
  );
}

// ✅ Komisyon güncelle
export async function adminUpdateRestaurantCommission(
  id: string,
  commissionRate: number // 0..1 (örn. 0.05)
) {
  return unwrap(api.patch(`/admin/restaurants/${id}/commission`, { commissionRate }));
}

/** ----------------- Users ----------------- */
export async function adminListUsers(params?: AdminListUsersParams) {
  return unwrap(
    api.get<{ items: any[]; nextCursor?: string }>("/admin/users", { params })
  );
}

export async function adminGetUser(id: string) {
  return unwrap(api.get(`/admin/users/${id}`));
}

export async function adminBanUser(
  id: string,
  body: { reason: string; bannedUntil?: string }
) {
  return unwrap(api.post(`/admin/users/${id}/ban`, body));
}

export async function adminUnbanUser(id: string) {
  return unwrap(api.post(`/admin/users/${id}/unban`, {}));
}

// ✅ Rol güncelle
export async function adminUpdateUserRole(
  id: string,
  role: "customer" | "restaurant" | "admin"
) {
  return unwrap(api.post(`/admin/users/${id}/role`, { role }));
}

/** ----------------- Reservations (global) ----------------- */
export async function adminListReservations(params?: AdminListReservationsParams) {
  return unwrap(
    api.get<{ items: any[]; nextCursor?: string }>("/admin/reservations", {
      params,
    })
  );
}

/** ----------------- Reviews ----------------- */
export async function adminListReviews(params?: AdminListReviewsParams) {
  return unwrap(
    api.get<{ items: any[]; nextCursor?: string }>("/admin/reviews", {
      params,
    })
  );
}

export async function adminHideReview(id: string) {
  return unwrap(api.post(`/admin/reviews/${id}/hide`, {}));
}

export async function adminUnhideReview(id: string) {
  return unwrap(api.post(`/admin/reviews/${id}/unhide`, {}));
}

export async function adminDeleteReview(id: string) {
  return unwrap(api.delete(`/admin/reviews/${id}`));
}

/** ----------------- Complaints ----------------- */
export async function adminListComplaints(params?: AdminListComplaintsParams) {
  return unwrap(
    api.get<{ items: any[]; nextCursor?: string }>("/admin/complaints", {
      params,
    })
  );
}

export async function adminResolveComplaint(id: string) {
  return unwrap(api.post(`/admin/complaints/${id}/resolve`, {}));
}

export async function adminDismissComplaint(id: string) {
  return unwrap(api.post(`/admin/complaints/${id}/dismiss`, {}));
}

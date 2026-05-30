// src/api/market.api.ts
import api from "./client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MarketStoreCategory =
  | "supermarket"
  | "bakery"
  | "greengrocer"
  | "organic"
  | "pharmacy";

export type MarketStore = {
  _id: string;
  name: string;
  description: string;
  category: MarketStoreCategory;
  location?: { type: "Point"; coordinates: [number, number] };
  address: string;
  city: string;
  photos: string[];
  workingHours: { open: string; close: string; days: number[] };
  deliveryZoneKm: number;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  isActive: boolean;
  rating: number;
  totalOrders: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketProductCategory = {
  _id: string;
  key: string;
  i18n?: Record<string, { title: string; description?: string }>;
};

export type MarketProduct = {
  _id: string;
  title: string;
  description: string;
  price: number;
  unit: "kg" | "piece" | "litre" | "pack";
  stock: number;
  photos: string[];
  category?: MarketProductCategory | null;
  store: string;
  isActive: boolean;
  barcode?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "online";

export type MarketOrderItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
  unit: string;
  lineTotal: number;
};

export type MarketOrder = {
  _id: string;
  customer: string;
  store: MarketStore | string;
  items: MarketOrderItem[];
  type: "pickup" | "delivery";
  deliveryAddress?: any;
  status: MarketOrderStatus;
  paymentStatus: "pending" | "paid" | "refunded";
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  note: string;
  estimatedReadyAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type CreateOrderPayload = {
  storeId: string;
  items: { productId: string; qty: number }[];
  type: "pickup" | "delivery";
  deliveryAddressId?: string | null;
  note?: string;
  paymentMethod?: PaymentMethod;
};

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * Yakındaki marketleri listele.
 * lat/lng verilirse mesafeye göre sıralar; verilmezse rating'e göre.
 */
export async function getStores(
  lat?: number | null,
  lng?: number | null,
  radius?: number,
  category?: MarketStoreCategory | null,
): Promise<PaginatedResponse<MarketStore>> {
  const params: Record<string, any> = {};
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  if (radius != null) params.radius = radius;
  if (category) params.category = category;

  const res = await api.get("/market/stores", { params });
  return res.data as PaginatedResponse<MarketStore>;
}

/**
 * Tek market detayı.
 */
export async function getStoreDetail(id: string): Promise<MarketStore> {
  const res = await api.get(`/market/stores/${id}`);
  return res.data as MarketStore;
}

/**
 * Market ürünleri — opsiyonel kategori filtresi.
 */
export async function getProducts(
  storeId: string,
  category?: string | null,
): Promise<PaginatedResponse<MarketProduct>> {
  const params: Record<string, any> = { limit: 100 };
  if (category) params.category = category;

  const res = await api.get(`/market/stores/${storeId}/products`, { params });
  return res.data as PaginatedResponse<MarketProduct>;
}

/**
 * Sipariş oluştur.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<MarketOrder> {
  const res = await api.post("/market/orders", payload);
  return res.data as MarketOrder;
}

/**
 * Kullanıcının kendi siparişleri.
 */
export async function getMyOrders(
  status?: MarketOrderStatus,
): Promise<PaginatedResponse<MarketOrder>> {
  const params: Record<string, any> = {};
  if (status) params.status = status;

  const res = await api.get("/market/orders", { params });
  return res.data as PaginatedResponse<MarketOrder>;
}

/**
 * Tek sipariş detayı.
 */
export async function getOrderDetail(id: string): Promise<MarketOrder> {
  const res = await api.get(`/market/orders/${id}`);
  return res.data as MarketOrder;
}

// ─── Panel API (market_owner) ───────────────────────────────────────────────────

/**
 * Mağaza sahibinin gelen siparişleri.
 */
export async function getPanelOrders(
  status?: MarketOrderStatus,
): Promise<PaginatedResponse<MarketOrder>> {
  const params: Record<string, any> = { limit: 50 };
  if (status) params.status = status;

  const res = await api.get("/market/panel/orders", { params });
  return res.data as PaginatedResponse<MarketOrder>;
}

/**
 * Sipariş durumu güncelle.
 */
export async function updateOrderStatus(
  orderId: string,
  status: MarketOrderStatus,
): Promise<MarketOrder> {
  const res = await api.patch(`/market/panel/orders/${orderId}/status`, { status });
  return res.data?.order ?? (res.data as MarketOrder);
}

/**
 * Müşteri kendi siparişini iptal eder.
 * Yalnızca pending + ilk 5 dakika içinde çalışır.
 * Backend 409 dönerse kullanıcıya gösterilecek message içerir.
 */
export async function cancelOrder(orderId: string): Promise<MarketOrder> {
  const res = await api.patch(`/market/orders/${orderId}/cancel`);
  return res.data?.order ?? (res.data as MarketOrder);
}

// ─── Kategori tipi ──────────────────────────────────────────────────────────────
export type CoreCategory = {
  _id: string;
  key: string;
  i18n?: {
    tr?: { title: string; description?: string };
    en?: { title: string; description?: string };
    ru?: { title: string; description?: string };
    el?: { title: string; description?: string };
  };
  order?: number;
};

// ─── Panel Store API ────────────────────────────────────────────────────────────

/**
 * Market sahibinin kendi store bilgisini çeker.
 */
export async function getMyPanelStore(): Promise<MarketStore> {
  const res = await api.get("/market/panel/store");
  return res.data as MarketStore;
}

/**
 * Market sahibi kendi store'unu günceller.
 * Sadece izin verilen alanlar gönderilebilir.
 */
export type UpdateStorePayload = Partial<Pick<
  MarketStore,
  | "name"
  | "description"
  | "address"
  | "city"
  | "workingHours"
  | "deliveryZoneKm"
  | "minOrderAmount"
  | "deliveryFee"
  | "freeDeliveryThreshold"
  | "photos"
>>;

export async function updateMyPanelStore(payload: UpdateStorePayload): Promise<MarketStore> {
  const res = await api.patch("/market/panel/store", payload);
  return res.data as MarketStore;
}

// ─── Kategori API ────────────────────────────────────────────────────────────────

/**
 * Market ürün kategorilerini listeler (businessTypes: "market").
 */
export async function getMarketCategories(): Promise<{ items: CoreCategory[]; total: number }> {
  const res = await api.get("/market/categories");
  return res.data as { items: CoreCategory[]; total: number };
}

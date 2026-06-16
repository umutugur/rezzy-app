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
  pickupEnabled?: boolean;
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
  brand?: string;
  attributes?: { label: string; value: string }[];
  netQuantity?: number | null;
  netUnit?: "L" | "ml" | "kg" | "g" | "piece" | null;
  unitPrice?: { unitPrice: number; unitPriceUnit: string } | null;
  discountPrice?: number | null;
  effectivePrice?: number;
  discountPercent?: number;
  lowest30?: number;
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
  cancelReason?: string | null;
  cancelledBy?: string | null;
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
  pickup?: boolean,
): Promise<PaginatedResponse<MarketStore>> {
  const params: Record<string, any> = {};
  if (lat != null) params.lat = lat;
  if (lng != null) params.lng = lng;
  if (radius != null) params.radius = radius;
  if (category) params.category = category;
  if (pickup) params.pickup = 1;

  const res = await api.get("/market/stores", { params });
  return res.data as PaginatedResponse<MarketStore>;
}

export interface ProductDetailResponse {
  product: MarketProduct;
  related: MarketProduct[];
}

export async function getProduct(id: string): Promise<ProductDetailResponse> {
  const { data } = await api.get(`/market/products/${id}`);
  return data as ProductDetailResponse;
}

/**
 * Tek market detayı.
 */
export async function getStoreDetail(id: string): Promise<MarketStore> {
  const res = await api.get(`/market/stores/${id}`);
  return res.data as MarketStore;
}

/**
 * Market ürünleri — opsiyonel kategori + arama filtresi.
 */
export async function getProducts(
  storeId: string,
  category?: string | null,
  q?: string,
): Promise<PaginatedResponse<MarketProduct>> {
  const params: Record<string, any> = { limit: 100 };
  if (category) params.category = category;
  if (q && q.trim().length >= 2) params.q = q.trim();

  const res = await api.get(`/market/stores/${storeId}/products`, { params });
  return res.data as PaginatedResponse<MarketProduct>;
}

// ─── Koleksiyonlar ───────────────────────────────────────────────────────────

export interface MarketCollectionPreview {
  _id: string;
  title: string;
  kind: string;
  imageUrl?: string | null;
  products: MarketProduct[];
}

/**
 * Anasayfa koleksiyon önizlemeleri (her biri ürünlerin ilk N'ini içerir).
 */
export async function getMarketCollections(
  region?: string,
): Promise<{ items: MarketCollectionPreview[] }> {
  const { data } = await api.get("/market/collections", {
    params: { region: region || undefined },
  });
  return data;
}

/**
 * Tek koleksiyonun sayfalanmış ürün listesi.
 */
export async function getMarketCollection(
  id: string,
  page = 1,
): Promise<PaginatedResponse<MarketProduct>> {
  const { data } = await api.get(`/market/collections/${id}`, {
    params: { page, limit: 20 },
  });
  return data as PaginatedResponse<MarketProduct>;
}

// ─── Global Ürün Arama ───────────────────────────────────────────────────────

export interface MarketSearchResult {
  items: (MarketProduct & { store?: { _id: string; name: string } })[];
  total: number;
  page: number;
  limit: number;
  brands: string[];
}

export async function searchMarketProducts(params: {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string | null;
  brand?: string | null;
  discounted?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}): Promise<MarketSearchResult> {
  const { data } = await api.get("/market/search", {
    params: {
      q: params.q,
      lat: params.lat,
      lng: params.lng,
      radius: params.radius,
      category: params.category || undefined,
      brand: params.brand || undefined,
      discounted: params.discounted ? 1 : undefined,
      sort: params.sort || undefined,
      page: params.page || undefined,
      limit: params.limit || undefined,
    },
  });
  return data as MarketSearchResult;
}

export type CreateOrderResult = {
  order: MarketOrder;
  payment: {
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    currency: string;
  } | null;
};

/**
 * Sipariş oluştur.
 * Online ödeme seçildiyse `payment.clientSecret` döner (Stripe PaymentSheet için).
 * Nakit/kart seçildiyse `payment: null` döner.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const res = await api.post("/market/orders", payload);
  // Eski backend (sadece order döndürüyorsa) ile uyumluluk
  if (res.data && !res.data.order) {
    return { order: res.data as MarketOrder, payment: null };
  }
  return res.data as CreateOrderResult;
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
  | "pickupEnabled"
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

// ─── Market Panel — Ürün Yönetimi ────────────────────────────────────────────

export interface PanelProduct {
  _id: string;
  title: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  photos: string[];
  isActive: boolean;
  barcode?: string | null;
  brand?: string;
  attributes?: { label: string; value: string }[];
  netQuantity?: number | null;
  netUnit?: "L" | "ml" | "kg" | "g" | "piece" | null;
  discountPrice?: number | null;
  store: string;
  createdAt: string;
  updatedAt: string;
}

export async function getPanelProducts(
  page = 1,
  limit = 40,
): Promise<{ items: PanelProduct[]; total: number; page: number; limit: number }> {
  const { data } = await api.get('/market/panel/products', { params: { page, limit } });
  return data;
}

export async function createPanelProduct(
  payload: Pick<PanelProduct, 'title' | 'price' | 'unit' | 'stock'> & Partial<Pick<PanelProduct, 'description' | 'barcode' | 'brand' | 'attributes' | 'netQuantity' | 'netUnit'>> & { discountPrice?: number | null },
): Promise<PanelProduct> {
  const { data } = await api.post('/market/panel/products', payload);
  return data;
}

export async function updatePanelProduct(
  id: string,
  payload: Partial<Pick<PanelProduct, 'title' | 'price' | 'unit' | 'stock' | 'description' | 'isActive' | 'barcode' | 'brand' | 'attributes' | 'netQuantity' | 'netUnit'>> & { discountPrice?: number | null },
): Promise<PanelProduct> {
  const { data } = await api.patch(`/market/panel/products/${id}`, payload);
  return data;
}

export async function deletePanelProduct(id: string): Promise<void> {
  await api.delete(`/market/panel/products/${id}`);
}

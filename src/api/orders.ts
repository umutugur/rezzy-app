// src/api/orders.ts
import { api } from "./client";
import { normalizeMongoId } from "./restaurants";

async function unwrap<T>(p: Promise<{ data: T }>): Promise<T> {
  const res = await p;
  return res.data;
}

export type OpenOrderSessionPayload = {
  restaurantId: string;
  tableId?: string;
  reservationId?: string | null;
};

export type OrderItemPayload = {
  itemId: string;
  title: string;        // ✅ backend zorunlu istiyor
  qty: number;
  price?: number;
};

export type CreateOrderPayload = {
  restaurantId: string;
  tableId?: string;
  sessionId?: string;
  reservationId?: string;
  items: OrderItemPayload[];
  notes?: string;
  paymentMethod: "card" | "pay_at_venue"; // frontend state böyle kalsın
};

export type OrderDto = {
  _id: string;
  restaurantId: any;
  tableId?: any;
  sessionId?: string;
  reservationId?: string;
  items: any[];
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  [key: string]: any;
};

export type StripeIntentResponse = {
  paymentIntentClientSecret: string;
  customerId: string;
  ephemeralKey: string;
  publishableKey?: string;
};

export async function openOrderSession(
  payload: OpenOrderSessionPayload
): Promise<{ sessionId: string }> {
  // ✅ ID’leri net ve temiz gönder
  const body: any = {
    restaurantId: normalizeMongoId(payload.restaurantId),
  };

  if (payload.tableId) {
    body.tableId = payload.tableId;
  }

  // reservationId varsa normalize ederek gönder, yoksa hiç gönderme
  if (payload.reservationId) {
    body.reservationId = normalizeMongoId(payload.reservationId);
  }

  return unwrap(api.post(`/orders/sessions/open`, body));
}

export async function createOrder(
  payload: CreateOrderPayload
): Promise<OrderDto> {
  // ✅ title kontrolü (backend patlamasın)
  const missingTitle = (payload.items || []).find((x) => !x.title?.trim());
  if (missingTitle) {
    throw new Error("Sipariş kalemlerinde title eksik. (items.title zorunlu)");
  }

  const body = {
    restaurantId: normalizeMongoId(payload.restaurantId),
    tableId: payload.tableId,
    sessionId: payload.sessionId,
    reservationId: payload.reservationId,
    paymentMethod: payload.paymentMethod === "pay_at_venue" ? "venue" : "card", // ✅ backend uyumu
    notes: payload.notes,
    items: (payload.items || []).map((x) => ({
      itemId: normalizeMongoId(x.itemId),
      title: x.title,
      qty: x.qty,
      price: x.price,
    })),
  };

  return unwrap(api.post<OrderDto>(`/orders`, body));
}

export async function createOrderStripeIntent(
  orderId: string,
  payload: { saveCard?: boolean } = { saveCard: true }
): Promise<StripeIntentResponse> {
  const oid = normalizeMongoId(orderId);
  return unwrap(
    api.post<StripeIntentResponse>(`/orders/${oid}/stripe-intent`, payload)
  );
}

export async function listMyOrders(): Promise<OrderDto[]> {
  return unwrap(api.get<OrderDto[]>(`/orders/me`));
}

export async function listSessionOrders(sessionId: string) {
  const sid = normalizeMongoId(sessionId);
  return unwrap(api.get<OrderDto[]>(`/orders/sessions/${sid}/orders`));
}
export async function cancelOrder(orderId: string): Promise<OrderDto> {
  const oid = normalizeMongoId(orderId);
  // backend’de POST /orders/:orderId/cancel route’unu çağırıyoruz
  return unwrap(api.post<OrderDto>(`/orders/${oid}/cancel`, {}));
}

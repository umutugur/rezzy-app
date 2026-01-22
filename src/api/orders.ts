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

export type OrderItemModifierPayload = {
  groupId: string;
  optionId: string;
  groupTitle?: string;
  optionTitle: string;

  // ✅ store/useQrCart standardı
  priceDelta: number;

  // ✅ back-compat: bazı yerlerde price gelebilir
  price?: number;
};

export type OrderItemPayload = {
  itemId: string;
  title: string;        // ✅ backend zorunlu istiyor
  qty: number;

  // base price
  price?: number;

  // ✅ modifiers support
  modifiers?: OrderItemModifierPayload[];

  // ✅ unique per item+modifier set
  lineKey?: string;

  // ✅ opsiyonel: base + modifiers (1 adet)
  unitTotal?: number;
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
    items: (payload.items || []).map((x) => {
      const basePrice = Number(x.price ?? 0) || 0;
      const unitTotal = Number(x.unitTotal ?? x.price ?? 0) || 0;

      return {
        itemId: normalizeMongoId(x.itemId),
        title: x.title,
        qty: x.qty,

        // ✅ backend eski contract (price) ile uyumlu kalsın:
        // modifiers varsa unitTotal (modifiers dahil) gönder
        price: unitTotal || basePrice,

        // ✅ yeni alanlar (backend ignore edebilir)
        unitTotal: unitTotal || undefined,
        lineKey: x.lineKey,

        modifiers: (x.modifiers || []).map((m) => ({
          groupId: normalizeMongoId(m.groupId),
          optionId: normalizeMongoId(m.optionId),
          groupTitle: m.groupTitle,
          optionTitle: m.optionTitle,

          // ✅ tek kaynağa indir: priceDelta yoksa price'tan al
          priceDelta: Number(m.priceDelta ?? m.price ?? 0) || 0,
        })),
      };
    }),
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

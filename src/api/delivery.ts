// src/api/delivery.ts
import api from "./client";
import type { DeliveryRestaurant, DeliveryResolvedMenu } from "../delivery/deliveryTypes";

export async function listDeliveryRestaurants(args: { addressId: string }) {
  const res = await api.get("/delivery/restaurants", { params: { addressId: args.addressId } });

  console.log("[delivery/restaurants] raw:", JSON.stringify(res.data, null, 2)); // ✅ ekle

  return {
    address: res.data?.address,
    items: Array.isArray(res.data?.items) ? res.data.items : [],
  };
}

export async function getDeliveryRestaurant(restaurantId: string): Promise<DeliveryRestaurant> {
  const res = await api.get(`/restaurants/${restaurantId}`);
  return res.data as DeliveryRestaurant;
}

export async function getDeliveryMenu(restaurantId: string): Promise<DeliveryResolvedMenu> {
  // ✅ backend: /api/restaurants/:rid/menu/public
  const res = await api.get(`/restaurants/${restaurantId}/menu/public`);
  return res.data as DeliveryResolvedMenu;
}

// ✅ PaymentScreen’in beklediği export
export type DeliveryCartItemInput = {
  // Aynı ürün farklı opsiyon kombinasyonlarıyla sepete eklenebilsin diye
  // (ör: “Döner + soğan” ve “Döner + soğansız” ayrı satır)
  lineId?: string;

  itemId: string;
  qty: number;
  note?: string;

  // Opsiyon (modifier) seçimleri - backend snapshot olarak kaydeder
  modifierSelections?: Array<{
    groupId: string;
    optionIds: string[];
  }>;

  // İstersen base + opsiyon farkları dahil tekil fiyatı da gönder
  // (backend doğrulayıp yeniden hesaplayabilir)
  unitPrice?: number; // optional, may be ignored by backend
};

export type CreateDeliveryOrderInput = {
  restaurantId: string;
  addressId: string;
  items: DeliveryCartItemInput[];
  paymentMethod: "card" | "cash" | "card_on_delivery";
  hexId?: string;
};

export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
  const baseBody = {
    restaurantId: input.restaurantId,
    addressId: input.addressId,
    items: input.items,
    hexId: input.hexId,
  };

  // ✅ CARD -> /api/delivery/orders/checkout
  if (input.paymentMethod === "card") {
    const res = await api.post("/delivery/orders/checkout", baseBody);
    return res.data;
  }

  // ✅ CASH / CARD_ON_DELIVERY -> /api/delivery/orders
  const res = await api.post("/delivery/orders", { ...baseBody, paymentMethod: input.paymentMethod });
  return res.data;
}
// ✅ My Delivery Orders (mobile)
export type DeliveryOrderStatus = "new" | "accepted" | "on_the_way" | "delivered" | "cancelled";

export type MyDeliveryOrderDto = {
  _id: string;
  status: DeliveryOrderStatus;
  createdAt: string;

  restaurantId?: {
    _id?: string;
    name?: string;
    photos?: string[];
    logoUrl?: string;
  } | string;

  restaurantName?: string | null; // backend bunu döndürmüyorsa UI populate’dan alır
  currency?: string | null;

  subtotal?: number;
  deliveryFee?: number;
  total?: number;

  paymentMethod?: "card" | "cash" | "card_on_delivery";
  paymentStatus?: "pending" | "paid" | "failed" | "cancelled";

  addressText?: string | null;

  items?: Array<{
    itemId: string;
    itemTitle: string;
    basePrice: number;
    qty: number;
    note?: string;
    selectedModifiers?: Array<{
      groupId: string;
      groupTitle: string;
      options: Array<{
        optionId: string;
        optionTitle: string;
        priceDelta: number;
      }>;
    }>;
    unitTotal?: number;
    lineTotal?: number;
  }>;
};

export async function listMyDeliveryOrders(): Promise<MyDeliveryOrderDto[]> {
  const res = await api.get("/delivery/orders/my");

  console.log("[delivery/orders/my] raw:", JSON.stringify(res.data, null, 2)); // ✅ geçici

  const items = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
  return items as MyDeliveryOrderDto[];
}
export async function getMyDeliveryOrder(orderId: string) {
  const res = await api.get(`/delivery/orders/my/${orderId}`);
  return res.data as { ok: true; order: any; restaurant?: any };
}
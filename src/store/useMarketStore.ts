// src/store/useMarketStore.ts
import { create } from "zustand";
import type { MarketProduct } from "../api/market.api";
import { effectivePrice } from "../utils/marketPrice";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type MarketCartItem = {
  product: MarketProduct;
  qty: number;
};

export type DeliveryType = "pickup" | "delivery";

type MarketCartState = {
  // Sepet
  items: MarketCartItem[];
  storeId: string | null;
  deliveryType: DeliveryType;
  pickupOnly: boolean;
  selectedAddressId: string | null;

  // Sepet işlemleri
  addItem: (product: MarketProduct) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  setDeliveryType: (type: DeliveryType) => void;
  setPickupOnly: (v: boolean) => void;
  setSelectedAddressId: (id: string | null) => void;
  setStoreId: (id: string | null) => void;
};

// ─── Computed helpers (dışarıdan çağrılabilir) ──────────────────────────────────

export function computeSubtotal(items: MarketCartItem[]): number {
  return +items.reduce((acc, i) => acc + effectivePrice(i.product) * i.qty, 0).toFixed(2);
}

export function computeDeliveryFee(
  deliveryType: DeliveryType,
  subtotal: number,
  deliveryFee: number,
  freeDeliveryThreshold: number | null,
): number {
  if (deliveryType === "pickup") return 0;
  if (freeDeliveryThreshold != null && subtotal >= freeDeliveryThreshold) return 0;
  return deliveryFee;
}

export function computeTotal(subtotal: number, deliveryFee: number): number {
  return +(subtotal + deliveryFee).toFixed(2);
}

// ─── Store ──────────────────────────────────────────────────────────────────────

export const useMarketCart = create<MarketCartState>((set, get) => ({
  items: [],
  storeId: null,
  deliveryType: "delivery",
  pickupOnly: false,
  selectedAddressId: null,

  addItem(product) {
    set((state) => {
      // Farklı mağaza seçilince sepeti temizle
      if (state.storeId && state.storeId !== product.store) {
        return {
          items: [{ product, qty: 1 }],
          storeId: String(product.store),
        };
      }

      const existing = state.items.find((i) => i.product._id === product._id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product._id === product._id ? { ...i, qty: i.qty + 1 } : i,
          ),
          storeId: String(product.store),
        };
      }

      return {
        items: [...state.items, { product, qty: 1 }],
        storeId: String(product.store),
      };
    });
  },

  removeItem(productId) {
    set((state) => {
      const next = state.items.filter((i) => i.product._id !== productId);
      return {
        items: next,
        storeId: next.length === 0 ? null : state.storeId,
      };
    });
  },

  updateQty(productId, qty) {
    if (qty <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.product._id === productId ? { ...i, qty } : i,
      ),
    }));
  },

  clearCart() {
    set({ items: [], storeId: null, selectedAddressId: null, pickupOnly: false });
  },

  setDeliveryType(type) {
    set({ deliveryType: type });
  },

  setPickupOnly(v) {
    set({ pickupOnly: v });
  },

  setSelectedAddressId(id) {
    set({ selectedAddressId: id });
  },

  setStoreId(id) {
    set({ storeId: id });
  },
}));

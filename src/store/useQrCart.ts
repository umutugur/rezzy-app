// src/store/useQrCart.ts
import { create } from "zustand";

export type QrCartModifierSelection = {
  groupId: string;
  optionId: string;
  groupTitle?: string;
  optionTitle: string;
  priceDelta: number;
};

export type QrCartItem = {
  itemId: string;
  title: string;
  price: number; // base price
  qty: number;
  photoUrl?: string;
  categoryId?: string;

  // modifier support
  modifiers?: QrCartModifierSelection[];
  unitTotal?: number; // base + modifiers (single unit)
  lineKey?: string;   // unique per item+modifier set
};
function buildLineKey(itemId: string, mods?: QrCartModifierSelection[]) {
  if (!mods || mods.length === 0) return itemId;
  const sig = mods
    .slice()
    .sort((a, b) => (a.groupId + a.optionId).localeCompare(b.groupId + b.optionId))
    .map((m) => `${m.groupId}:${m.optionId}`)
    .join("|");
  return `${itemId}__${sig}`;
}

type QrCartState = {
  restaurantId: string | null;
  tableId: string | null;
  sessionId: string | null; // backend open-session döndürürse
  reservationId?: string | null; // opsiyonel (komisyon eşleştirme)
  notes: string;
  items: QrCartItem[];

  setContext: (ctx: {
    restaurantId?: string | null;
    tableId?: string | null;
    sessionId?: string | null;
    reservationId?: string | null;
  }) => void;

  addItem: (it: Omit<QrCartItem, "qty">) => void;
  removeItem: (itemId: string) => void;
  inc: (itemId: string) => void;
  dec: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;

  /** sepetteki ürünleri/notu temizler, restaurant/table/session context'i KORUR */
  clearItems: () => void;

  /** her şeyi sıfırlar (masa/restaurant değişirken kullan) */
  clear: () => void;

  setNotes: (notes: string) => void;
};

export const useQrCart = create<QrCartState>((set, get) => ({
  restaurantId: null,
  tableId: null,
  sessionId: null,
  reservationId: null,
  notes: "",
  items: [],

  // ✅ explicit null overwrite edebilsin diye "in" check kullanıyoruz
  setContext: (ctx) =>
    set((s) => ({
      ...s,
      restaurantId: "restaurantId" in ctx ? (ctx.restaurantId ?? null) : s.restaurantId,
      tableId: "tableId" in ctx ? (ctx.tableId ?? null) : s.tableId,
      sessionId: "sessionId" in ctx ? (ctx.sessionId ?? null) : s.sessionId,
      reservationId: "reservationId" in ctx ? (ctx.reservationId ?? null) : s.reservationId,
    })),

  addItem: (it) =>
    set((s) => {
      const mods = (it as any).modifiers as QrCartModifierSelection[] | undefined;
      const lineKey = buildLineKey(it.itemId, mods);

      const found = s.items.find(
        (x) => (x.lineKey ?? x.itemId) === lineKey
      );

      if (found) {
        return {
          ...s,
          items: s.items.map((x) =>
            (x.lineKey ?? x.itemId) === lineKey ? { ...x, qty: x.qty + 1 } : x
          ),
        };
      }

      return {
        ...s,
        items: [
          ...s.items,
          {
            ...(it as any),
            qty: 1,
            lineKey,
          },
        ],
      };
    }),

  removeItem: (lineKeyOrItemId) =>
    set((s) => ({
      ...s,
      items: s.items.filter(
        (x) => (x.lineKey ?? x.itemId) !== lineKeyOrItemId
      ),
    })),

  inc: (lineKeyOrItemId) =>
    set((s) => ({
      ...s,
      items: s.items.map((x) =>
        (x.lineKey ?? x.itemId) === lineKeyOrItemId
          ? { ...x, qty: x.qty + 1 }
          : x
      ),
    })),

  dec: (lineKeyOrItemId) =>
    set((s) => ({
      ...s,
      items: s.items
        .map((x) =>
          (x.lineKey ?? x.itemId) === lineKeyOrItemId
            ? { ...x, qty: x.qty - 1 }
            : x
        )
        .filter((x) => x.qty > 0),
    })),

  setQty: (lineKeyOrItemId, qty) =>
    set((s) => ({
      ...s,
      items: s.items
        .map((x) =>
          (x.lineKey ?? x.itemId) === lineKeyOrItemId ? { ...x, qty } : x
        )
        .filter((x) => x.qty > 0),
    })),

  // ✅ Sipariş sonrası / sepet temizlemede bunu çağır
  clearItems: () =>
    set((s) => ({
      ...s,
      notes: "",
      items: [],
    })),

  // ✅ Masa/restaurant değişince full reset
  clear: () =>
    set({
      restaurantId: null,
      tableId: null,
      sessionId: null,
      reservationId: null,
      notes: "",
      items: [],
    }),

  setNotes: (notes) => set({ notes }),
}));

export const selectTotal = (s: QrCartState) =>
  s.items.reduce((sum, it) => {
    const unit = isFinite(it.unitTotal as any)
      ? Number(it.unitTotal)
      : Number(it.price) || 0;
    return sum + unit * it.qty;
  }, 0);

export const selectCount = (s: QrCartState) =>
  s.items.reduce((sum, it) => sum + it.qty, 0);
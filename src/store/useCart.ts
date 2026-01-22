// src/store/useCart.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartState, CartItem } from "../delivery/deliveryTypes";

// -------------------------------
// Line-item support (modifiers)
// -------------------------------
// We keep CartItem typing (for compatibility) but store extra fields on each item.
// `lineId` lets the same product appear multiple times with different modifier selections.

type ModifierSelection = {
  groupId: string;
  optionIds: string[];
};

function stableString(v: any) {
  return String(v ?? "").trim();
}

function normalizeNote(note?: any) {
  return stableString(note);
}

function normalizeSelections(input?: any): ModifierSelection[] {
  const arr = Array.isArray(input) ? input : [];

  const cleaned: ModifierSelection[] = (arr as any[])
    .map((x) => {
      const groupId = stableString(x?.groupId);
      const optionIdsRaw = Array.isArray(x?.optionIds) ? (x.optionIds as any[]) : [];
      const optionIds = optionIdsRaw.map((o) => stableString(o)).filter(Boolean);
      return { groupId, optionIds } as ModifierSelection;
    })
    .filter((x) => x.groupId && x.optionIds.length > 0)
    .map((x) => ({
      groupId: x.groupId,
      optionIds: Array.from(new Set<string>(x.optionIds)).sort(),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId));

  return cleaned;
}

function selectionsKey(selections?: any) {
  const norm = normalizeSelections(selections);
  return JSON.stringify(norm);
}

// Deterministic line id: same product + same selections (+ same note) => same line
function buildLineId(args: { itemId: string; modifierSelections?: any; note?: any }) {
  const itemId = stableString(args.itemId);
  const selKey = selectionsKey(args.modifierSelections);
  const noteKey = normalizeNote(args.note);
  return `ln_${itemId}__${selKey}__${noteKey}`;
}

// Fallback random id for rare cases where itemId is missing
function makeRandomLineId() {
  return `ln_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getLineId(it: any): string {
  return stableString(it?.lineId);
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      restaurantName: null,
      currencySymbol: "₺",

      items: [],

      setRestaurant: ({ restaurantId, restaurantName, currencySymbol, resetIfDifferent }) => {
        const cur = get().restaurantId;
        const isDifferent = cur && cur !== restaurantId;

        if (resetIfDifferent && isDifferent) {
          set({ restaurantId, restaurantName, currencySymbol, items: [] });
          return;
        }

        set({ restaurantId, restaurantName, currencySymbol });
      },

      addItem: (item, qty = 1) => {
        const safeQty = Math.max(1, Math.floor(qty || 1));
        const prev = get().items as any[];

        const incomingAny: any = item as any;
        const incomingItemId = stableString(incomingAny?.itemId);

        // Normalize selections early so TS never infers unknown[]
        const incomingSelectionsNorm = normalizeSelections(incomingAny?.modifierSelections);
        const incomingSelKey = JSON.stringify(incomingSelectionsNorm);

        // Prefer explicit lineId if caller provides one; otherwise derive deterministically
        const explicitLineId = getLineId(incomingAny);
        const derivedLineId = incomingItemId
          ? buildLineId({
              itemId: incomingItemId,
              modifierSelections: incomingSelectionsNorm,
              note: incomingAny?.note,
            })
          : "";

        const targetLineId = explicitLineId || derivedLineId || makeRandomLineId();

        // Merge by lineId (explicit or derived)
        const idx = prev.findIndex((x) => stableString((x as any)?.lineId) === targetLineId);

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = {
            ...(next[idx] as any),
            qty: Number((next[idx] as any).qty || 0) + safeQty,
          };
          set({ items: next as any });
          return;
        }

        const nextItem: any = {
          ...(incomingAny || {}),
          itemId: incomingItemId || stableString(incomingAny?.itemId),
          qty: safeQty,
          lineId: targetLineId,

          // Store normalized selections (always array)
          modifierSelections: incomingSelectionsNorm,

          // Snapshot unit price (optional). If not provided, fallback to item.price.
          unitPrice: Number(incomingAny?.unitPrice ?? incomingAny?.price ?? 0) || 0,

          // Stable note
          note: incomingAny?.note != null ? String(incomingAny.note) : incomingAny?.note,

          // Debug/help key (non-breaking)
          _selKey: incomingSelKey,
        };

        set({ items: [nextItem as CartItem, ...(prev as any)] as any });
      },

      decItem: (idOrItemId) => {
        const key = String(idOrItemId);
        const prev = get().items as any[];

        // Prefer lineId match
        let idx = prev.findIndex((x) => stableString((x as any)?.lineId) === stableString(key));

        // Backward compatibility: if caller passes itemId, decrement the most-recent matching line
        if (idx < 0) {
          idx = prev.findIndex((x) => stableString((x as any)?.itemId) === stableString(key));
        }

        if (idx < 0) return;

        const it = prev[idx] as any;

        if (Number(it.qty || 0) <= 1) {
          const lineId = stableString(it?.lineId);
          const itemId = stableString(it?.itemId);

          // If this is a legacy item without lineId, fall back to removing by itemId
          if (!lineId && itemId) {
            set({ items: prev.filter((x) => stableString((x as any)?.itemId) !== itemId) as any });
            return;
          }

          set({ items: prev.filter((x) => stableString((x as any)?.lineId) !== lineId) as any });
          return;
        }

        const next = [...prev];
        next[idx] = { ...it, qty: Number(it.qty || 0) - 1 };
        set({ items: next as any });
      },

      removeItem: (idOrItemId) => {
        const key = String(idOrItemId);
        const prev = get().items as any[];

        const hasLine = prev.some((x) => stableString((x as any)?.lineId) === stableString(key));
        if (hasLine) {
          set({ items: prev.filter((x) => stableString((x as any)?.lineId) !== stableString(key)) as any });
          return;
        }

        // Legacy: remove all lines of the same product id
        set({ items: prev.filter((x) => stableString((x as any)?.itemId) !== stableString(key)) as any });
      },

      clear: () => {
        set({ items: [], restaurantId: null, restaurantName: null, currencySymbol: "₺" });
      },

      subtotal: () =>
        (get().items as any[]).reduce(
          (sum, x) =>
            sum +
            Number((x as any)?.unitPrice ?? (x as any)?.price ?? 0) * Number((x as any)?.qty ?? 0),
          0
        ),

      count: () => get().items.reduce((sum, x) => sum + x.qty, 0),
    }),
    {
      // force-migrate carts that were persisted with random lineIds
      name: "rezvix_delivery_cart_v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        restaurantId: s.restaurantId,
        restaurantName: s.restaurantName,
        currencySymbol: s.currencySymbol,
        items: s.items as any,
      }),
    }
  )
);
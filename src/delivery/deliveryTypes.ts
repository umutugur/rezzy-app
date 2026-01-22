// src/delivery/deliveryTypes.ts

export type CurrencyCode = "TRY" | "GBP";

export type DeliveryRestaurant = {
  _id: string;
  name: string;
  city?: string | null;
  address?: string | null;

  // card
  photos?: string[] | null;
  rating?: number | null;
  ratingCount?: number | null;

  // delivery meta
  deliveryActive?: boolean;
  deliveryMinOrderAmount?: number | null; // min sepet
  deliveryEtaMin?: number | null; // süre min
  deliveryEtaMax?: number | null; // süre max
  deliveryFee?: number | null;

  // distance in km - backend veya client hesaplayabilir
  distanceKm?: number | null;

  // region -> currency
  region?: "CY" | "UK" | "TR" | string;
};

export type MenuCategory = {
  _id: string;
  id?: string;            // opsiyonel
  title: string;
  description?: string | null;
  order?: number;
  isActive?: boolean;     // opsiyonel
};

export type MenuItem = {
  _id: string;
  title: string;
  description?: string | null;
  price: number;
  photoUrl?: string | null;
  isActive?: boolean;
  isAvailable?: boolean;
  tags?: string[];

  // ✅ Modifiers (optional)
  modifierGroupIds?: string[];
};

export type ResolvedMenuCategory = MenuCategory & {
  items: MenuItem[];
};

/* =======================
   Modifiers (Public menu)
======================= */

export type ModifierOption = {
  _id: string;
  title: string;
  price: number; // price delta
  order: number;
  isActive: boolean;
};

export type ModifierGroup = {
  _id: string;
  title: string;
  description?: string | null;
  minSelect: number;
  maxSelect: number;
  order: number;
  isActive: boolean;
  options: ModifierOption[];
};

// A cart line keeps a snapshot of the user's selections
export type ModifierSelection = {
  groupId: string;
  optionIds: string[];
};

export type DeliveryResolvedMenu = {
  restaurantId: string;
  categories: ResolvedMenuCategory[];

  // ✅ Optional: include modifier groups so mobile can render choices
  modifierGroups?: ModifierGroup[];
};

export type CartItem = {
  // ✅ Each cart row is a distinct line (same item can appear multiple times with different modifiers)
  lineId?: string;

  itemId: string;
  title: string;

  // Backward-compatible: existing code uses `price`.
  // Newer code may treat this as unit price (base + selected modifiers).
  price: number;

  qty: number;
  photoUrl?: string | null;
  note?: string | null;

  // ✅ Modifier snapshot for this cart line
  modifierSelections?: ModifierSelection[];

  // Optional presentation helper (preformatted string for UI)
  modifierSummary?: string | null;
};

export type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  currencySymbol: string;

  items: CartItem[];

  setRestaurant: (args: {
    restaurantId: string;
    restaurantName: string;
    currencySymbol: string;
    // farklı restorana geçerse sepeti sıfırlama ihtiyacı var
    resetIfDifferent?: boolean;
  }) => void;

  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  // Can be either a cart lineId (preferred) or an itemId (legacy)
  decItem: (id: string) => void;
  // Can be either a cart lineId (preferred) or an itemId (legacy)
  removeItem: (id: string) => void;
  clear: () => void;

  subtotal: () => number;
  count: () => number;
};
// src/api/promotions.api.ts
import api from "./client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PromoDiscountKind = "percent" | "fixed" | "free_delivery" | "fixed_price";

export type PromoDiscount = {
  kind: PromoDiscountKind;
  value: number;
  maxDiscount?: number | null;
};

export type PromoCampaign = {
  _id: string;
  title: string;
  description?: string;
  image?: string | null;
  /** Hangi yüzeye ait: market / restoran / taksi. Cüzdan yanıtında döner. */
  surface?: PromoSurface;
  discount: PromoDiscount;
  conditions?: {
    minSubtotal?: number;
    [key: string]: any;
  };
  validFrom?: string;
  validTo?: string;
  usageLimit?: {
    total?: number | null;
    showRemaining?: boolean;
  };
};

/** A coupon the user already owns (collected). */
export type WalletMineItem = {
  userCouponId: string;
  campaign: PromoCampaign;
  status: string;
  remaining: number | null;
};

export type WalletResponse = {
  mine: WalletMineItem[];
  collectible: PromoCampaign[];
};

/** A coupon that is already eligible for the current cart. */
export type ApplicableItem = {
  campaign: PromoCampaign;
  discount: number;
};

export type ApplicableResponse = {
  items: ApplicableItem[];
};

export type StoreBadgesResponse = {
  badges: Record<string, string>;
};

export type PromoSurface = "market" | "restaurant" | "taxi";

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * Kullanıcının cüzdanı: sahip olduğu (mine) + toplayabileceği (collectible) kuponlar.
 */
export async function getWallet(
  surface: PromoSurface | undefined,
  region: string,
): Promise<WalletResponse> {
  const { data } = await api.get("/promotions/wallet", {
    params: { ...(surface ? { surface } : {}), region },
    timeout: 15000,
  });
  return {
    mine: Array.isArray(data?.mine) ? data.mine : [],
    collectible: Array.isArray(data?.collectible) ? data.collectible : [],
  };
}

/**
 * Toplanabilir bir kampanyayı kullanıcı cüzdanına ekle.
 */
export async function collectCoupon(
  campaignId: string,
): Promise<{ item: WalletMineItem }> {
  const { data } = await api.post("/promotions/collect", { campaignId });
  return data as { item: WalletMineItem };
}

export type ApplicableParams = {
  surface: PromoSurface;
  /** Market/restaurant için zorunlu. Taxi'de gönderilmez. */
  storeId?: string;
  subtotal: number;
  /** Market/restaurant için. Taxi'de yok. */
  deliveryFee?: number;
  /** Taxi yüzeyi için araç tipi. */
  vehicleType?: string;
  paymentMethod?: string;
};

/**
 * Bu sepet/yolculuk için ŞU AN geçerli olan kuponlar (en iyi başta sıralı).
 * Taxi yüzeyinde storeId gönderilmez; bunun yerine vehicleType gönderilir.
 */
export async function getApplicable(
  params: ApplicableParams,
): Promise<ApplicableResponse> {
  // Taxi'de storeId backend'e gitmemeli (surface'a göre sunucu storeId beklemiyor).
  const query: Record<string, any> =
    params.surface === "taxi"
      ? {
          surface: params.surface,
          subtotal: params.subtotal,
          ...(params.vehicleType ? { vehicleType: params.vehicleType } : {}),
          ...(params.paymentMethod ? { paymentMethod: params.paymentMethod } : {}),
        }
      : params;

  const { data } = await api.get("/promotions/applicable", {
    params: query,
    timeout: 15000,
  });
  return { items: Array.isArray(data?.items) ? data.items : [] };
}

/**
 * Mağaza kartlarında gösterilecek promosyon rozetleri.
 */
export async function getStoreBadges(
  surface: PromoSurface,
  storeIds: string[],
): Promise<StoreBadgesResponse> {
  if (storeIds.length === 0) return { badges: {} };
  const { data } = await api.get("/promotions/store-badges", {
    params: { surface, storeIds: storeIds.join(",") },
    timeout: 15000,
  });
  return { badges: data?.badges ?? {} };
}

// ─── Display Helpers ─────────────────────────────────────────────────────────────

/**
 * İndirim özetini lokalize string'e çevir.
 * percent → "%X indirim", fixed → "X TL indirim",
 * free_delivery → "Ücretsiz teslimat", fixed_price → "Sabit fiyat X TL"
 */
export function discountSummary(
  discount: PromoDiscount,
  t: (key: string, options?: any) => string,
): string {
  switch (discount.kind) {
    case "percent":
      // pct param: TR şablonu "{{pct}}{{value}}" → "%15"; diğer diller {{pct}}'i yok sayar.
      return t("promotions.discount.percent", { value: discount.value, pct: "%" });
    case "fixed":
      return t("promotions.discount.fixed", { value: discount.value });
    case "free_delivery":
      return t("promotions.discount.freeDelivery");
    case "fixed_price":
      return t("promotions.discount.fixedPrice", { value: discount.value });
    default:
      return "";
  }
}

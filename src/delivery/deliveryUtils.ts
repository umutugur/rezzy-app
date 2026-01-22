// src/delivery/deliveryUtils.ts
import type { DeliveryRestaurant } from "./deliveryTypes";

export function currencySymbolFromRegion(region?: string | null): string {
  if (region === "UK") return "£";
  return "₺"; // CY/TR default
}

export function formatDistanceKm(km?: number | null): string {
  if (typeof km !== "number" || !Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatEta(min?: number | null, max?: number | null): string {
  const a = typeof min === "number" && min > 0 ? Math.round(min) : null;
  const b = typeof max === "number" && max > 0 ? Math.round(max) : null;

  if (a && b) return `${a}-${b} dk`;
  if (a) return `${a} dk`;
  if (b) return `${b} dk`;
  return "—";
}

export function formatMoney(n: number, symbol: string): string {
  const v = Number(n) || 0;
  // TR/UK ayrımını ekranda zaten region’dan yönetiyorsun, burada basit tutuyorum
  return `${symbol}${v.toLocaleString()}`;
}

export function pickDeliveryMeta(r: DeliveryRestaurant) {
  // 1) min order & fee: zone varsa onu kullan (address-specific)
  const zoneMin =
    typeof (r as any)?.deliveryZone?.minOrderAmount === "number"
      ? (r as any).deliveryZone.minOrderAmount
      : null;

  const zoneFee =
    typeof (r as any)?.deliveryZone?.feeAmount === "number"
      ? (r as any).deliveryZone.feeAmount
      : null;

  // 2) distance: _distanceMeters varsa onu baz al
  const meters =
    typeof (r as any)?._distanceMeters === "number"
      ? (r as any)._distanceMeters
      : null;

  const distanceKm =
    meters != null ? meters / 1000 : (typeof r.distanceKm === "number" ? r.distanceKm : null);

  // 3) eta: sen şimdilik “başka bir şey” demişsin; burada mevcut alanları okumaya devam
  const etaText = formatEta((r as any).deliveryEtaMin ?? null, (r as any).deliveryEtaMax ?? null);

  return {
    minOrder: zoneMin ?? (typeof r.deliveryMinOrderAmount === "number" ? r.deliveryMinOrderAmount : null),
    deliveryFee: zoneFee ?? (typeof (r as any).deliveryFee === "number" ? (r as any).deliveryFee : null),
    etaText,
    distanceText: formatDistanceKm(distanceKm),
  };
}
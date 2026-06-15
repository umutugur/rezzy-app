import type { MarketProduct } from "../api/market.api";

export function effectivePrice(p: MarketProduct): number {
  if (typeof p.effectivePrice === "number") return p.effectivePrice;
  const d = p.discountPrice;
  if (d != null && d >= 0 && d < p.price) return d;
  return p.price;
}

export function discountPercent(p: MarketProduct): number {
  if (typeof p.discountPercent === "number") return p.discountPercent;
  const eff = effectivePrice(p);
  if (eff >= p.price || p.price <= 0) return 0;
  return Math.round(((p.price - eff) / p.price) * 100);
}

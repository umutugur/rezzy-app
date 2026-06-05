// src/utils/format.ts

// ─── Date ────────────────────────────────────────────────────────────────────

/** Maps app language code → Intl locale string */
const LANG_LOCALE: Record<string, string> = {
  tr: "tr-TR",
  en: "en-GB",
  el: "el-GR",
  ru: "ru-RU",
};

/** Returns the Intl locale string for a given app language code. */
export function langToLocale(lang?: string): string {
  return LANG_LOCALE[lang ?? "tr"] ?? "tr-TR";
}

export function formatDateTime(iso: string, lang?: string) {
  const d = new Date(iso);
  return d.toLocaleString(langToLocale(lang));
}

export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

// ─── Currency ─────────────────────────────────────────────────────────────────

/** Maps region code → ISO 4217 currency code */
const REGION_CURRENCY: Record<string, string> = {
  TR: "TRY",
  CY: "TRY",
  UK: "GBP",
  US: "USD",
};

/** Returns the ISO 4217 currency code for a given region (e.g. "TR" → "TRY"). */
export function currencyFromRegion(region?: string | null): string {
  const r = String(region ?? "").toUpperCase();
  return REGION_CURRENCY[r] ?? "TRY";
}

/**
 * Formats an amount as a localized currency string.
 * @param amount  Numeric amount
 * @param region  Region code from useRegion store (e.g. "TR", "UK")
 * @param lang    Language code from useRegion/useI18n (e.g. "tr", "en")
 * @param fractionDigits  Max decimal places (default 2)
 */
export function formatCurrency(
  amount: number,
  region?: string | null,
  lang?: string | null,
  fractionDigits = 2,
): string {
  const currency = currencyFromRegion(region);
  const locale = langToLocale(lang ?? undefined);
  const n = isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits === 0 ? 0 : undefined,
    }).format(n);
  } catch {
    const symbols: Record<string, string> = { TRY: "₺", GBP: "£", USD: "$", EUR: "€" };
    return `${symbols[currency] ?? currency}${n.toFixed(fractionDigits)}`;
  }
}
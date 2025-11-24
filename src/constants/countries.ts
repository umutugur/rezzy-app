// List of supported countries for region selection.
// This file centralizes country metadata so the app can support
// additional regions without changing business logic elsewhere.  Each
// entry includes a two‑letter ISO code, a human readable name and a
// default language code.  Developers can extend this list to support
// more than 190 countries.  Flags are optional and purely for UI.

export type Country = {
  /** ISO 3166‑1 alpha‑2 country code (e.g. "TR" for Türkiye) */
  code: string;
  /** Localized name displayed in the UI */
  name: string;
  /** Emoji flag or other icon for the country */
  flag?: string;
  /** Language code to use as a default when this region is selected */
  defaultLanguage: string;
};

export const COUNTRIES: Country[] = [
  { code: "TR", name: "Türkiye", flag: "🇹🇷", defaultLanguage: "tr" },
  { code: "CY", name: "Kuzey Kıbrıs", flag: "🇨🇾", defaultLanguage: "tr" },
  { code: "UK", name: "Birleşik Krallık", flag: "🇬🇧", defaultLanguage: "en" },
  { code: "US", name: "United States", flag: "🇺🇸", defaultLanguage: "en" },
  // Add other countries here as needed.  Use ISO codes and provide
  // a reasonable default language to improve the initial experience.
];
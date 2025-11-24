// Central registry of supported languages.  Each entry maps a
// language code (ISO 639‑1) to a human friendly name.  Add more
// languages as translation files become available.

export type LanguageInfo = {
  code: string;
  name: string;
};

export const LANGUAGES: LanguageInfo[] = [
  { code: "tr", name: "Türkçe" },
  { code: "en", name: "English" },
  // Extend this array with additional languages (e.g. { code: "de", name: "Deutsch" }).
];
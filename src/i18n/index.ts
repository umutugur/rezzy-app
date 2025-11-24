// src/i18n/index.ts
import React from "react";
import i18n, { setLocale } from "./config";
import { useRegion } from "../store/useRegion";

/**
 * Basit helper: hook kullanmadan doğrudan çeviri almak istersen.
 * Örn: t("home.loading")
 */
export function t(key: string, options?: any): string {
  return i18n.t(key, options);
}

/**
 * Ekranlarda kullanmak için hook:
 * - useRegion.store içindeki language değiştikçe i18n.locale güncellenir
 * - t fonksiyonunu hazır verir
 */
export function useI18n() {
  const language = useRegion((s) => s.language || "tr");

  React.useEffect(() => {
    setLocale(language);
  }, [language]);

  return {
    t: (key: string, options?: any) => i18n.t(key, options),
    locale: i18n.locale,
    language,
  };
}

export default i18n;
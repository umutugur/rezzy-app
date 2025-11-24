// Use the `I18n` class instead of the default export when working with
// TypeScript.  The default export’s type lacks some instance properties
// like `locale`, `translations` and `fallbacks`, which leads to
// TypeScript errors.  Instantiating our own I18n object solves this
// problem.
import { I18n } from "i18n-js";
// Instead of accessing `Localization.locale` (which isn't defined in
// recent versions of expo-localization), import the helper to fetch
// locale information.  See https://docs.expo.dev/guides/localization/
import { getLocales } from "expo-localization";

// Import translation dictionaries.  Each file exports a plain object
// containing all translation keys for a given language.  New languages
// should be added by creating a JSON file under `src/locales` and
// including it in the `translations` object below.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import tr from "../locales/tr.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import en from "../locales/en.json";
// @ts-ignore
import el from "../locales/el.json";
// @ts-ignore
import ru from "../locales/ru.json";

// Create an instance of I18n with our translations.  Passing the
// dictionaries in the constructor avoids the need to set
// `i18n.translations` manually and satisfies the TypeScript type.
const translations = { tr, en, el, ru } as const;
const i18n = new I18n(translations);

// Enable fallback to the default locale whenever a key is missing in the
// current language.  Without this the library will return the key
// itself, which is usually undesirable.
i18n.enableFallback = true;

// Set the initial locale based on the device settings.  The
// `getLocales()` function returns an array of locale objects; we
// select the first one and use its `languageCode`.  This value can be
// overridden at runtime via `setLocale` when the user changes
// language.
{
  const locales = getLocales();
  const deviceLanguage = locales && locales.length > 0 ? locales[0].languageCode : undefined;
  if (deviceLanguage) {
    i18n.locale = deviceLanguage;
  }
}

/**
 * Update the current locale at runtime.  Components should call this
 * function when the language in the region store changes.  See
 * `src/store/useRegion.ts` and `App.tsx` for usage.
 *
 * @param lang ISO‑639‑1 language code (e.g. "en", "tr")
 */
export function setLocale(lang: string) {
  i18n.locale = lang.toLowerCase();
}

export default i18n;
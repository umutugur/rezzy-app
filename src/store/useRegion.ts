import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COUNTRIES } from "../constants/countries";

// Keys used in AsyncStorage for persisting the selected region, language
// and whether the user has explicitly chosen a region/language.  If the
// user hasn't made a choice we can infer the region from the device's
// country code (see setFromCountryCode below).
const REGION_KEY = "@rezzy.region";
const LANG_KEY = "@rezzy.language";
const USER_CHOICE_KEY = "@rezzy.region_user_choice";

/**
 * Zustand store for region and language selection.  Unlike the
 * previous implementation this version does not restrict the region or
 * language to a small union of values; instead any ISO‑style
 * two‑letter country code is accepted.  A companion list of
 * countries (COUNTRIES) defines the available options and default
 * language for each region.  The language can be any string and is
 * primarily used by the i18n library to select the appropriate
 * translations.
 */
type RegionState = {
  /** Two letter country/region code (e.g. "TR", "UK"). */
  region: string;
  /** Language code (ISO 639‑1) used for translations. */
  language: string;
  /** Whether the store has loaded persisted values. */
  initialized: boolean;
  /** Whether the user has explicitly selected region/language. */
  hasUserChoice: boolean;
  /** Load persisted region and language from AsyncStorage. */
  hydrate: () => Promise<void>;
  /** Persist the region and update the store. */
  setRegion: (region: string) => void;
  /** Persist the language and update the store. */
  setLanguage: (language: string) => void;
  /**
   * Guess region and language from an ISO country code.  Called once
   * on first launch if the user hasn't picked a region yet.  This
   * function checks whether the code exists in our list of
   * countries and sets the corresponding region and default
   * language.
   */
  setFromCountryCode: (code?: string | null) => void;
};

export const useRegion = create<RegionState>((set, get) => ({
  // Default to the first entry in our countries list.  This should
  // ideally be Türkiye to preserve the previous behaviour for Turkish
  // users but can be changed as needed.
  region: COUNTRIES[0]?.code ?? "TR",
  language: COUNTRIES[0]?.defaultLanguage ?? "tr",
  initialized: false,
  hasUserChoice: false,

  async hydrate() {
    try {
      const [r, l, u] = await Promise.all([
        AsyncStorage.getItem(REGION_KEY),
        AsyncStorage.getItem(LANG_KEY),
        AsyncStorage.getItem(USER_CHOICE_KEY),
      ]);

      // Normalize region: if it's a two‑letter string and exists in our
      // countries list use it; otherwise fall back to default.
      let region = (r && r.length === 2 ? r.toUpperCase() : undefined) || COUNTRIES[0]?.code;
      if (!region || !COUNTRIES.some((c) => c.code.toUpperCase() === region)) {
        region = COUNTRIES[0]?.code;
      }

      // Determine language: prefer persisted value; otherwise use the
      // default language associated with the region.  If both are
      // missing, default to Turkish.
      let language = l || COUNTRIES.find((c) => c.code.toUpperCase() === region)?.defaultLanguage || COUNTRIES[0]?.defaultLanguage || "tr";

      const hasUserChoice = u === "1";
      set({ region, language, hasUserChoice, initialized: true });
    } catch {
      // Even if something goes wrong we still mark initialization as
      // complete so the app can proceed.
      set({ initialized: true });
    }
  },

  setRegion(region: string) {
    const normalized = region.toUpperCase();
    set({ region: normalized, hasUserChoice: true });
    AsyncStorage.setItem(REGION_KEY, normalized).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});

    // When the region changes we may want to update the language to the
    // region's default if the current language does not belong to
    // any registered language.  This logic is intentionally not
    // automatic to avoid surprising the user; see setFromCountryCode.
  },

  setLanguage(language: string) {
    set({ language, hasUserChoice: true });
    AsyncStorage.setItem(LANG_KEY, language).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});
  },

  setFromCountryCode(code?: string | null) {
    const { initialized, hasUserChoice } = get();
    if (!initialized || hasUserChoice) return;
    if (!code) return;

    const upper = code.toUpperCase();
    const country = COUNTRIES.find((c) => c.code.toUpperCase() === upper);
    if (country) {
      set({ region: country.code, language: country.defaultLanguage });
      AsyncStorage.setItem(REGION_KEY, country.code).catch(() => {});
      AsyncStorage.setItem(LANG_KEY, country.defaultLanguage).catch(() => {});
    }
    // For unknown codes we simply leave the defaults in place.
  },
}));
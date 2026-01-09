import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COUNTRIES } from "../constants/countries";

const REGION_KEY = "@rezvix.region";
const LANG_KEY = "@rezvix.language";
const USER_CHOICE_KEY = "@rezvix.region_user_choice";

const DEFAULT_REGION = (COUNTRIES[0]?.code ?? "TR").toUpperCase();
const DEFAULT_LANGUAGE = COUNTRIES[0]?.defaultLanguage ?? "tr";

let __hydratePromise: Promise<void> | null = null;

type RegionState = {
  region: string;
  language: string;

  // Hydration = AsyncStorage read completed (region/lang loaded or defaults applied)
  hydrated: boolean;

  // Resolved = region selection decision finalized for this boot
  // (persisted choice OR user choice OR auto-geo applied)
  resolved: boolean;

  hasUserChoice: boolean;

  hydrate: () => Promise<void>;
  setRegion: (region: string) => void;
  setLanguage: (language: string) => void;

  // Best-effort geo/locale default. Must NEVER override persisted/user choice.
  // Non-async signature to avoid refactor ripple; internally awaits hydration.
  setFromCountryCode: (code?: string | null) => void;

  // Manual gate: allow App-level bootstrap to say "don’t auto-resolve anymore".
  markResolved: () => void;
};

export const useRegion = create<RegionState>((set, get) => ({
  region: DEFAULT_REGION,
  language: DEFAULT_LANGUAGE,

  hydrated: false,
  resolved: false,
  hasUserChoice: false,

  async hydrate() {
    // Idempotent + coalesce concurrent callers.
    if (get().hydrated) return;
    if (__hydratePromise) return __hydratePromise;

    __hydratePromise = (async () => {
      try {
        const [r, l, u] = await Promise.all([
          AsyncStorage.getItem(REGION_KEY),
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem(USER_CHOICE_KEY),
        ]);

        const persistedRegion =
          r && r.trim().length === 2 ? r.trim().toUpperCase() : undefined;

        const persistedLanguage = (l || "").trim() || undefined;

        const explicitUserChoice = u === "1" || u === "true" || u === "yes";
        const inferredUserChoice = !!persistedRegion && persistedRegion !== DEFAULT_REGION;
        const hasUserChoice = explicitUserChoice || inferredUserChoice;

        const nextRegion = persistedRegion ?? DEFAULT_REGION;

        const nextLanguage =
          persistedLanguage ||
          COUNTRIES.find((c) => c.code.toUpperCase() === nextRegion)?.defaultLanguage ||
          DEFAULT_LANGUAGE;

        // If persisted/user choice exists, treat decision as resolved for this boot.
        const resolved = hasUserChoice || !!persistedRegion || !!persistedLanguage;

        const prev = get();
        // Never downgrade flags that may have been set by app-level bootstrap.
        const nextResolved = prev.resolved || resolved;
        const nextHasUserChoice = prev.hasUserChoice || hasUserChoice;

        set({
          region: nextRegion,
          language: nextLanguage,
          hasUserChoice: nextHasUserChoice,
          hydrated: true,
          resolved: nextResolved,
        });
      } catch {
        // Hard fallback: defaults, but hydration still completes.
        const prev = get();
        set({
          region: DEFAULT_REGION,
          language: DEFAULT_LANGUAGE,
          hasUserChoice: prev.hasUserChoice || false,
          hydrated: true,
          resolved: prev.resolved || false,
        });
      } finally {
        __hydratePromise = null;
      }
    })();

    return __hydratePromise;
  },

  setRegion(region: string) {
    const normalized = String(region).toUpperCase();
    set({ region: normalized, hasUserChoice: true, hydrated: true, resolved: true });
    AsyncStorage.setItem(REGION_KEY, normalized).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});
  },

  setLanguage(language: string) {
    set({ language, hasUserChoice: true, hydrated: true, resolved: true });
    AsyncStorage.setItem(LANG_KEY, language).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});
  },

  setFromCountryCode(code?: string | null) {
    void (async () => {
      // If no code was determined, stop re-attempting.
      if (!code) {
        set({ resolved: true });
        return;
      }

      // Ensure AsyncStorage hydration completed before making a decision.
      if (!get().hydrated) {
        await get().hydrate();
      }

      // Re-read after hydration to avoid races.
      const snap = get();

      // Never override persisted/user choice or an already-resolved decision.
      if (snap.hasUserChoice) return;
      if (snap.resolved) return;

      const upper = String(code).toUpperCase();
      const country = COUNTRIES.find((c) => c.code.toUpperCase() === upper);

      if (!country) {
        // Stop re-attempting on every render.
        set({ resolved: true });
        return;
      }

      const nextRegion = country.code.toUpperCase();
      const nextLanguage = country.defaultLanguage || DEFAULT_LANGUAGE;

      set({
        region: nextRegion,
        language: nextLanguage,
        hydrated: true,
        resolved: true,
        hasUserChoice: false,
      });

      AsyncStorage.setItem(REGION_KEY, nextRegion).catch(() => {});
      AsyncStorage.setItem(LANG_KEY, nextLanguage).catch(() => {});
      // NOTE: We intentionally do NOT set USER_CHOICE_KEY here.
    })();
  },

  markResolved() {
    const prev = get();
    set({ resolved: true, hydrated: prev.hydrated || true });
  },
}));

let __regionHydrateStarted = false;
try {
  if (!__regionHydrateStarted) {
    __regionHydrateStarted = true;
    void useRegion.getState().hydrate();
  }
} catch {
  // no-op
}

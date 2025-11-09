// src/store/useRegion.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Region = "CY" | "UK";
export type Language = "tr" | "en";

type RegionState = {
  region: Region;
  language: Language;
  initialized: boolean;
  hasUserChoice: boolean;
  hydrate: () => Promise<void>;
  setRegion: (region: Region) => void;
  setLanguage: (language: Language) => void;
  setFromCountryCode: (code?: string | null) => void;
};

const REGION_KEY = "@rezzy.region";
const LANG_KEY = "@rezzy.language";
const USER_CHOICE_KEY = "@rezzy.region_user_choice";

export const useRegion = create<RegionState>((set, get) => ({
  region: "CY",
  language: "tr",
  initialized: false,
  hasUserChoice: false,

  hydrate: async () => {
    try {
      const [r, l, u] = await Promise.all([
        AsyncStorage.getItem(REGION_KEY),
        AsyncStorage.getItem(LANG_KEY),
        AsyncStorage.getItem(USER_CHOICE_KEY),
      ]);

      const region: Region = r === "UK" || r === "CY" ? (r as Region) : "CY";
      const language: Language =
        l === "en" || l === "tr"
          ? (l as Language)
          : region === "UK"
          ? "en"
          : "tr";
      const hasUserChoice = u === "1";

      set({ region, language, hasUserChoice, initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  setRegion: (region: Region) => {
    set({ region, hasUserChoice: true });
    AsyncStorage.setItem(REGION_KEY, region).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});
  },

  setLanguage: (language: Language) => {
    set({ language, hasUserChoice: true });
    AsyncStorage.setItem(LANG_KEY, language).catch(() => {});
    AsyncStorage.setItem(USER_CHOICE_KEY, "1").catch(() => {});
  },

  // Cihaz ülkesine göre ilk açılışta tahmin (kullanıcı henüz seçim yapmadıysa)
  setFromCountryCode: (code?: string | null) => {
    const { initialized, hasUserChoice } = get();
    if (!initialized || hasUserChoice) return;
    if (!code) return;

    const upper = code.toUpperCase();

    if (upper === "GB" || upper === "UK") {
      set({ region: "UK", language: "en" });
      AsyncStorage.setItem(REGION_KEY, "UK").catch(() => {});
      AsyncStorage.setItem(LANG_KEY, "en").catch(() => {});
      return;
    }

    if (upper === "CY" || upper === "TR") {
      set({ region: "CY", language: "tr" });
      AsyncStorage.setItem(REGION_KEY, "CY").catch(() => {});
      AsyncStorage.setItem(LANG_KEY, "tr").catch(() => {});
      return;
    }

    // Diğer ülkelerde mevcut default kalsın.
  },
}));
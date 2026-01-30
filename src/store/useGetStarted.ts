import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const KEY = "@rezvix.get_started_seen";

type GetStartedState = {
  isOpen: boolean;
  hasSeen: boolean;
  init: () => Promise<void>;
  open: () => void;
  close: () => void;
  markSeen: () => Promise<void>;
};

export const useGetStarted = create<GetStartedState>((set, get) => ({
  isOpen: false,
  hasSeen: false,

  async init() {
    try {
      const v = await AsyncStorage.getItem(KEY);
      const seen = v === "1" || v === "true" || v === "yes";
      set({ hasSeen: seen });
      if (!seen) set({ isOpen: true });
    } catch {
      set({ hasSeen: false, isOpen: true });
    }
  },

  open() {
    set({ isOpen: true });
  },

  close() {
    set({ isOpen: false });
  },

  async markSeen() {
    if (!get().hasSeen) set({ hasSeen: true });
    try {
      await AsyncStorage.setItem(KEY, "1");
    } catch {}
  },
}));

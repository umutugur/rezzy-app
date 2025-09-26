// src/store/useAuth.ts
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export type User = {
  id: string;
  name: string;
  role: "customer" | "restaurant" | "admin";
  email?: string;
  phone?: string;
  restaurantId?: string;
  avatarUrl?: string | null;
  notificationPrefs?: { push?: boolean; sms?: boolean; email?: boolean };
  providers?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type AuthState = {
  token?: string | null;
  user?: User | null;
  hydrated: boolean; // açılışta storage'tan okundu mu?

  // login/google/apple sonrası:
  setAuth: (t?: string, u?: User) => Promise<void>;

  // profil güncelleme vb. için:
  updateUser: (patch: Partial<User>) => void;

  // uygulama açılışında çağrılır:
  hydrate: () => Promise<void>;

  // profil > oturumu kapat:
  clear: () => Promise<void>;
};

const KEY = "rezzy.auth.v1";

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,

  setAuth: async (token, user) => {
    set({ token: token ?? null, user: user ?? null });
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify({ token, user }));
    } catch {
      // yut
    }
  },

  updateUser: (patch) =>
    set((s) => ({
      user: s.user ? { ...s.user, ...patch } : s.user ?? null,
    })),

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          token: parsed?.token ?? null,
          user: parsed?.user ?? null,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  clear: async () => {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // yut
    }
    set({ token: null, user: null });
  },
}));

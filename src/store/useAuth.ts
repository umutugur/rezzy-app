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

type IntendedRoute = { name: string; params?: any } | null;

type AuthState = {
  token?: string | null;
  user?: User | null;
  hydrated: boolean; // açılışta storage'tan okundu mu?

  /** login/google/apple sonrası */
  setAuth: (t?: string, u?: User) => Promise<void>;

  /** profil güncelleme vb. için */
  updateUser: (patch: Partial<User>) => void;

  /** uygulama açılışında çağrılır */
  hydrate: () => Promise<void>;

  /** profil > oturumu kapat */
  clear: () => Promise<void>;

  /** niyet edilen rota: login öncesi hatırlayıp, login sonrası oraya dön */
  intendedRoute: IntendedRoute;
  setIntended: (route: IntendedRoute) => Promise<void>;
  consumeIntended: () => Promise<IntendedRoute>;
};

const KEY = "rezzy.auth.v1";

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  intendedRoute: null,

  setAuth: async (token, user) => {
    set({ token: token ?? null, user: user ?? null });
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(
        KEY,
        JSON.stringify({ ...(parsed || {}), token, user })
      );
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
          intendedRoute: parsed?.intendedRoute ?? null,
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
    set({ token: null, user: null, intendedRoute: null });
  },

  setIntended: async (route) => {
    set({ intendedRoute: route });
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(
        KEY,
        JSON.stringify({ ...(parsed || {}), intendedRoute: route })
      );
    } catch {
      // yut
    }
  },

  consumeIntended: async () => {
    const route = get().intendedRoute ?? null;
    set({ intendedRoute: null });
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(
        KEY,
        JSON.stringify({ ...(parsed || {}), intendedRoute: null })
      );
    } catch {
      // yut
    }
    return route;
  },
}));
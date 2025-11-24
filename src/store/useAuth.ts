import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { Platform } from "react-native";
import { useRegion } from "./useRegion";

/**
 * Representation of an authenticated user.  The region and language
 * preferences are no longer constrained to a predefined list of codes;
 * any string is accepted.  Backend services should validate codes
 * where appropriate.
 */
export type User = {
  id: string;
  name: string;
  role: "customer" | "restaurant" | "admin" | "guest";
  email?: string | null;
  phone?: string | null;
  restaurantId?: string | null;
  avatarUrl?: string | null;
  notificationPrefs?: { push?: boolean; sms?: boolean; email?: boolean };
  providers?: string[];
  noShowCount?: number;
  riskScore?: number;
  preferredRegion?: string;
  preferredLanguage?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type IntendedRoute = { name: string; params?: any } | null;

type AuthState = {
  token?: string | null;
  refreshToken?: string | null;
  user?: User | null;
  hydrated: boolean;

  setAuth: (t?: string | null, u?: User | null, rt?: string | null) => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;

  intendedRoute: IntendedRoute;
  setIntended: (route: IntendedRoute) => Promise<void>;
  consumeIntended: () => Promise<IntendedRoute>;
  refreshAuthToken: () => Promise<boolean>;
};

const KEY = "rezzy.auth.v2";

// Derive API base URL without importing client.ts to avoid cyclic
// dependencies.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEV_LOCAL = Platform.OS === "android" ? "http://10.0.2.2:3000/api" : "http://localhost:3000/api";
const PROD_FALLBACK = "https://rezzy-backend.onrender.com/api";
const BASE_URL = ENV_URL || (__DEV__ ? DEV_LOCAL : PROD_FALLBACK);

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  intendedRoute: null,

  async setAuth(token, user, refreshToken) {
    const prev = get();
    const next = {
      token: token ?? prev.token ?? null,
      user: user === undefined ? prev.user ?? null : user,
      refreshToken: refreshToken ?? prev.refreshToken ?? null,
    };
    set(next);

    // Synchronize region and language preferences with the global store.
    try {
      const u = next.user;
      if (u) {
        const regionStore = useRegion.getState();
        if (u.preferredRegion) {
          regionStore.setRegion(u.preferredRegion);
        }
        if (u.preferredLanguage) {
          regionStore.setLanguage(u.preferredLanguage);
        }
      }
    } catch {
      // ignore errors silently
    }
    // Persist auth details in secure storage
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(KEY, JSON.stringify({ ...(parsed || {}), ...next }));
    } catch {}
  },

  updateUser(patch) {
    set((s) => {
      const merged = s.user ? { ...s.user, ...patch } : s.user ?? null;
      // Update region store when region or language changes
      try {
        if (merged) {
          const regionStore = useRegion.getState();
          if (merged.preferredRegion) {
            regionStore.setRegion(merged.preferredRegion);
          }
          if (merged.preferredLanguage) {
            regionStore.setLanguage(merged.preferredLanguage);
          }
        }
      } catch {}
      return { user: merged };
    });
  },

  async hydrate() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const user: User | null = parsed?.user ?? null;
        set({
          token: parsed?.token ?? null,
          refreshToken: parsed?.refreshToken ?? null,
          user,
          intendedRoute: parsed?.intendedRoute ?? null,
          hydrated: true,
        });
        // Apply stored preferences to region store
        try {
          if (user) {
            const regionStore = useRegion.getState();
            if (user.preferredRegion) {
              regionStore.setRegion(user.preferredRegion);
            }
            if (user.preferredLanguage) {
              regionStore.setLanguage(user.preferredLanguage);
            }
          }
        } catch {}
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  async clear() {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {}
    // We intentionally leave the region/language untouched so that the
    // guest user retains their last choice.  Only auth tokens and user
    // information are cleared.
    set({ token: null, refreshToken: null, user: null, intendedRoute: null });
  },

  async setIntended(route) {
    set({ intendedRoute: route });
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(KEY, JSON.stringify({ ...(parsed || {}), intendedRoute: route }));
    } catch {}
  },

  async consumeIntended() {
    const route = get().intendedRoute ?? null;
    set({ intendedRoute: null });
    try {
      const current = await SecureStore.getItemAsync(KEY);
      const parsed = current ? JSON.parse(current) : {};
      await SecureStore.setItemAsync(KEY, JSON.stringify({ ...(parsed || {}), intendedRoute: null }));
    } catch {}
    return route;
  },

  /**
   * Refresh the auth token using the refresh token.  On success
   * updates both tokens and returns true.  On failure clears the
   * current auth state and returns false.
   */
  async refreshAuthToken() {
    const { refreshToken, user } = get();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const newAccess = json?.token as string | undefined;
      const newRefresh = (json?.refreshToken as string | undefined) ?? refreshToken;
      if (newAccess) {
        await get().setAuth(newAccess, user ?? null, newRefresh);
        if (__DEV__) console.log("[auth] token refreshed ✅");
        return true;
      }
      return false;
    } catch (err) {
      if (__DEV__) console.log("[auth] refresh failed ❌", err);
      await get().clear();
      return false;
    }
  },
}));

// !!! Buraya interceptor koyma. !!!
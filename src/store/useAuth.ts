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
  restaurantName?: string | null;
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
  meLoaded: boolean;

  setAuth: (t?: string | null, u?: User | null, rt?: string | null) => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;
  fetchMe: () => Promise<User | null>;

  loginWithGoogle: (idToken: string) => Promise<boolean>;
  loginWithApple: (idToken: string, profile?: { name?: string | null; email?: string | null }) => Promise<boolean>;
  logout: () => Promise<void>;

  intendedRoute: IntendedRoute;
  setIntended: (route: IntendedRoute) => Promise<void>;
  consumeIntended: () => Promise<IntendedRoute>;
  refreshAuthToken: () => Promise<boolean>;
};

const KEY = "rezvix.auth.v2";

// Derive API base URL without importing client.ts to avoid cyclic
// dependencies.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL?.trim();
const DEV_LOCAL = Platform.OS === "android" ? "http://10.0.2.2:3000/api" : "http://localhost:3000/api";
const PROD_FALLBACK = "https://rezzy-backend.onrender.com/api";

const BASE_URL = ENV_URL || (__DEV__ ? DEV_LOCAL : PROD_FALLBACK);

function getRegionHeaders(): Record<string, string> {
  try {
    const { region, language } = useRegion.getState();
    const r = String(region || "").trim();
    const l = String(language || "").trim();

    const out: Record<string, string> = {};
    if (r) out["X-Region"] = r;
    if (l) out["Accept-Language"] = l;
    return out;
  } catch {
    return {};
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  meLoaded: false,
  intendedRoute: null,

  async setAuth(token, user, refreshToken) {
    const prev = get();
    const next = {
      token: token ?? prev.token ?? null,
      user: user === undefined ? prev.user ?? null : user,
      refreshToken: refreshToken ?? prev.refreshToken ?? null,
    };
    set(next);

    if (next.token) set({ meLoaded: true });

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

  async fetchMe() {
    const { token } = get();
    if (!token) {
      set({ meLoaded: true });
      return null;
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...getRegionHeaders(),
        },
      });

      if (!res.ok) {
        // Do not clear auth here; caller can decide.
        set({ meLoaded: true });
        return get().user ?? null;
      }

      const json = await res.json();
      const serverUser = (json?.user ?? json) as User | null;

      if (serverUser) {
        set({ user: serverUser, meLoaded: true });

        // Sync region + language from server user
        try {
          const regionStore = useRegion.getState();
          if (serverUser.preferredRegion) regionStore.setRegion(serverUser.preferredRegion);
          if (serverUser.preferredLanguage) regionStore.setLanguage(serverUser.preferredLanguage);
        } catch {}

        // Persist updated user back to secure storage
        try {
          const current = await SecureStore.getItemAsync(KEY);
          const curParsed = current ? JSON.parse(current) : {};
          await SecureStore.setItemAsync(
            KEY,
            JSON.stringify({ ...(curParsed || {}), token, user: serverUser, refreshToken: get().refreshToken ?? null })
          );
        } catch {}

        return serverUser;
      }

      set({ meLoaded: true });
      return null;
    } catch {
      set({ meLoaded: true });
      return get().user ?? null;
    }
  },

  async hydrate() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) {
        set({ hydrated: true, meLoaded: true });
        return;
      }

      const parsed = JSON.parse(raw);
      const storedToken = parsed?.token ?? null;
      const storedRefresh = parsed?.refreshToken ?? null;
      const storedUser: User | null = parsed?.user ?? null;
      const storedIntended = parsed?.intendedRoute ?? null;

      // Hydrate from storage only. /auth/me is fetched explicitly by App bootstrap.
      set({
        token: storedToken,
        refreshToken: storedRefresh,
        user: storedUser,
        intendedRoute: storedIntended,
        hydrated: true,
        meLoaded: !storedToken,
      });

      // If there is no token, we can still apply stored preferences (guest case).
      if (!storedToken) {
        try {
          if (storedUser) {
            const regionStore = useRegion.getState();
            if (storedUser.preferredRegion) regionStore.setRegion(storedUser.preferredRegion);
            if (storedUser.preferredLanguage) regionStore.setLanguage(storedUser.preferredLanguage);
          }
        } catch {}
      }

      return;
    } catch {
      set({ hydrated: true, meLoaded: true });
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

  async logout() {
    await get().clear();
  },

  async loginWithGoogle(idToken) {
    try {
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRegionHeaders() },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const token = json?.token as string | undefined;
      const refreshToken = json?.refreshToken as string | undefined;
      const user = json?.user as User | undefined;
      if (!token || !user) throw new Error("Invalid auth response");
      await get().setAuth(token, user, refreshToken ?? null);
      if (__DEV__) console.log("[auth] google login ✅");
      return true;
    } catch (err) {
      if (__DEV__) console.log("[auth] google login failed ❌", err);
      return false;
    }
  },

  async loginWithApple(idToken, profile) {
    try {
      const body: any = { idToken };
      if (profile?.name) body.name = profile.name;
      if (profile?.email) body.email = profile.email;

      const res = await fetch(`${BASE_URL}/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getRegionHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const token = json?.token as string | undefined;
      const refreshToken = json?.refreshToken as string | undefined;
      const user = json?.user as User | undefined;
      if (!token || !user) throw new Error("Invalid auth response");
      await get().setAuth(token, user, refreshToken ?? null);
      if (__DEV__) console.log("[auth] apple login ✅");
      return true;
    } catch (err) {
      if (__DEV__) console.log("[auth] apple login failed ❌", err);
      return false;
    }
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
        headers: { "Content-Type": "application/json", ...getRegionHeaders() },
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
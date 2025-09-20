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
  token?: string;
  user?: User;
  setAuth: (t?: string, u?: User) => void;
  updateUser: (patch: Partial<User>) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: undefined,
  user: undefined,
  setAuth: (token, user) => set({ token, user }),
  updateUser: (patch) =>
    set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
  clear: () => set({ token: undefined, user: undefined }),
}));

import { create } from "zustand";

export type User = { 
  id: string; 
  name: string; 
  role: "customer" | "restaurant" | "admin"; 
  email?: string;
  phone?: string;
  restaurantId?: string;   // ✅ restoran sahibi için
  noShowCount?: number;
  riskScore?: number;
  createdAt?: string;
  updatedAt?: string;
};

type AuthState = {
  token?: string;
  user?: User;
  setAuth: (t?: string, u?: User) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: undefined,
  user: undefined,
  setAuth: (token, user) => set({ token, user }),
  clear: () => set({ token: undefined, user: undefined }),
}));

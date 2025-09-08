import { create } from "zustand";

type User = { id: string; name: string; role: "customer"|"restaurant"|"admin" };
type AuthState = {
  token?: string;
  user?: User;
  setAuth: (t?: string, u?: User)=>void;
  clear: ()=>void;
};
export const useAuth = create<AuthState>((set)=>({
  token: undefined, user: undefined,
  setAuth: (token, user)=> set({ token, user }),
  clear: ()=> set({ token: undefined, user: undefined })
}));

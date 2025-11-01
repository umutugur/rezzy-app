import { create } from "zustand";

export type MenuSel = { person: number; menuId: string };
type State = {
  restaurantId?: string;
  dateTimeISO?: string;
  partySize: number;
  selections: MenuSel[];
  setRestaurant: (id: string)=>void;
  setDateTime: (iso: string)=>void;
  setParty: (n: number)=>void;
  setSelection: (person: number, menuId: string)=>void;
  reset: ()=>void;
};

export const useReservation = create<State>((set, get)=>({
  restaurantId: undefined, dateTimeISO: undefined, partySize: 1, selections: [],
  setRestaurant: (id)=> set({ restaurantId: id }),
  setDateTime: (iso)=> set({ dateTimeISO: iso }),
  setParty: (n) =>
    set((s) => {
      const next: MenuSel[] = [];
      for (let i = 1; i <= n; i++) {
        const existing = s.selections.find((sel) => sel.person === i);
        next.push(existing ?? { person: i, menuId: "" });
      }
      return { partySize: n, selections: next };
    }),
  setSelection: (person, menuId) => {
    set((s) => {
      const next = s.selections.map((sel) =>
        sel.person === person ? { ...sel, menuId } : sel
      );
      if (!next.some((sel) => sel.person === person)) {
        next.push({ person, menuId });
      }
      return { selections: next };
    });
  },
  reset: ()=> set({ restaurantId: undefined, dateTimeISO: undefined, partySize: 1, selections: [] })
}));

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
  setParty: (n)=> set({ partySize: n, selections: Array.from({length:n}).map((_,i)=>({ person:i+1, menuId:"" })) }),
  setSelection: (person, menuId)=>{
    const sel = get().selections.slice();
    const idx = sel.findIndex(s => s.person===person);
    if (idx>=0) sel[idx].menuId = menuId; else sel.push({ person, menuId });
    set({ selections: sel });
  },
  reset: ()=> set({ restaurantId: undefined, dateTimeISO: undefined, partySize: 1, selections: [] })
}));

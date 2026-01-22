// src/store/useDeliveryAddress.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserAddress } from "../api/addresses";

type DeliveryAddressState = {
  selectedAddressId: string | null;
  selectedAddress: UserAddress | null;

  setSelectedAddress: (addr: UserAddress) => void;
  setSelectedAddressFromList: (list: UserAddress[]) => void; // hydrate helper
  clearSelectedAddress: () => void;
};

export const useDeliveryAddress = create<DeliveryAddressState>()(
  persist(
    (set, get) => ({
      selectedAddressId: null,
      selectedAddress: null,

      setSelectedAddress: (addr) =>
        set({
          selectedAddressId: String(addr._id),
          selectedAddress: addr,
        }),

      setSelectedAddressFromList: (list) => {
        const id = get().selectedAddressId;
        if (!id) return;
        const found = list.find((x) => String(x._id) === String(id));
        if (!found) {
          set({ selectedAddressId: null, selectedAddress: null });
          return;
        }
        set({ selectedAddress: found });
      },

      clearSelectedAddress: () => set({ selectedAddressId: null, selectedAddress: null }),
    }),
    {
      name: "rezvix_delivery_address_v1",
      storage: createJSONStorage(() => AsyncStorage),
      // ✅ sadece id persist
      partialize: (s) => ({ selectedAddressId: s.selectedAddressId }),
    }
  )
);
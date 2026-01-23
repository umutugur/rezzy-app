// src/navigation/deliveryRoutes.ts
export const DeliveryRoutes = {
  AddressPicker: "AddressPicker",
  CreateAddress: "CreateAddress", // ✅ yeni
  DeliveryHome: "DeliveryHome",
  Orders: "Orders",
  DeliveryRestaurant: "DeliveryRestaurant",
  Cart: "Cart",
  Checkout: "Checkout",
} as const;

export type DeliveryRouteName = typeof DeliveryRoutes[keyof typeof DeliveryRoutes];

export type DeliveryStackParams = {
  [DeliveryRoutes.AddressPicker]:
    | { returnTo?: DeliveryRouteName; currentAddressId?: string }
    | undefined;

  [DeliveryRoutes.CreateAddress]: { backTo?: DeliveryRouteName } | undefined;

  [DeliveryRoutes.DeliveryHome]: undefined;
  [DeliveryRoutes.Orders]: undefined;
  [DeliveryRoutes.DeliveryRestaurant]: { restaurantId: string };
  [DeliveryRoutes.Cart]: undefined;

  // Checkout paramlarını genişletiyoruz (address geri dönecek)
  [DeliveryRoutes.Checkout]:
    | {
        restaurantId: string;
        addressId?: string;
        addressText?: string;
        address?: any;
      }
    | undefined;
};
// src/navigation/marketRoutes.ts

export const MarketRoutes = {
  Home:           "MarketHome",
  StoreDetail:    "MarketStoreDetail",
  ProductDetail:  "MarketProductDetail",
  Cart:           "MarketCart",
  OrderDetail:    "MarketOrderDetail",
  OwnerDashboard: "MarketOwnerDashboard",
  Search:         "MarketSearch",
  Collection:     "MarketCollection",
  MyCoupons:      "MarketMyCoupons",
} as const;

export type MarketRouteName = (typeof MarketRoutes)[keyof typeof MarketRoutes];

export type MarketStackParams = {
  [MarketRoutes.Home]:           undefined;
  [MarketRoutes.StoreDetail]:    { storeId: string; storeName?: string; initialServiceMode?: "delivery" | "pickup" };
  [MarketRoutes.ProductDetail]:  { productId: string; storeId?: string };
  [MarketRoutes.Cart]:           undefined;
  [MarketRoutes.OrderDetail]:    { orderId: string };
  [MarketRoutes.OwnerDashboard]: undefined;
  [MarketRoutes.Search]:         { initialQuery?: string; lat?: number; lng?: number };
  [MarketRoutes.Collection]:     { collectionId: string; title?: string };
  [MarketRoutes.MyCoupons]:      undefined;
};

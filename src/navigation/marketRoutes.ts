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
} as const;

export type MarketRouteName = (typeof MarketRoutes)[keyof typeof MarketRoutes];

export type MarketStackParams = {
  [MarketRoutes.Home]:           undefined;
  [MarketRoutes.StoreDetail]:    { storeId: string; storeName?: string };
  [MarketRoutes.ProductDetail]:  { productId: string };
  [MarketRoutes.Cart]:           undefined;
  [MarketRoutes.OrderDetail]:    { orderId: string };
  [MarketRoutes.OwnerDashboard]: undefined;
  [MarketRoutes.Search]:         { initialQuery?: string; lat?: number; lng?: number };
  [MarketRoutes.Collection]:     { collectionId: string; title?: string };
};

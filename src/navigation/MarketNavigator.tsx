// src/navigation/MarketNavigator.tsx
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

import { MarketRoutes, type MarketStackParams } from "./marketRoutes";
import { useTheme } from "../theme";

import MarketHomeScreen from "../screens/market/MarketHomeScreen";
import MarketStoreScreen from "../screens/market/MarketStoreScreen";
import MarketCartScreen from "../screens/market/MarketCartScreen";
import MarketOrderDetailScreen from "../screens/market/MarketOrderDetailScreen";
import MarketOwnerDashboardScreen from "../screens/market/MarketOwnerDashboardScreen";
import ProductDetailScreen from "../screens/market/ProductDetailScreen";
import MarketSearchScreen from "../screens/market/MarketSearchScreen";
import MarketCollectionScreen from "../screens/market/MarketCollectionScreen";
import MyCouponsScreen from "../screens/promotions/MyCouponsScreen";

const Stack = createStackNavigator<MarketStackParams>();

export default function MarketNavigator() {
  const { colors, typography, market } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={MarketRoutes.Home}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: market.main,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: typography.headingMd.fontSize,
          color: colors.textPrimary,
        },
      }}
    >
      <Stack.Screen
        name={MarketRoutes.Home}
        component={MarketHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={MarketRoutes.StoreDetail}
        component={MarketStoreScreen}
        options={({ route }) => ({
          title: (route.params as any)?.storeName ?? "Market",
        })}
      />
      <Stack.Screen
        name={MarketRoutes.ProductDetail}
        component={ProductDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={MarketRoutes.Cart}
        component={MarketCartScreen}
        options={{ title: "Sepet" }}
      />
      <Stack.Screen
        name={MarketRoutes.OrderDetail}
        component={MarketOrderDetailScreen}
        options={{ title: "Sipariş Detayı" }}
      />
      <Stack.Screen
        name={MarketRoutes.OwnerDashboard}
        component={MarketOwnerDashboardScreen}
        options={{ title: "Sipariş Yönetimi" }}
      />
      <Stack.Screen
        name={MarketRoutes.Search}
        component={MarketSearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={MarketRoutes.Collection}
        component={MarketCollectionScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={MarketRoutes.MyCoupons}
        component={MyCouponsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

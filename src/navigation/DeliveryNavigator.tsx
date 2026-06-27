// src/navigation/DeliveryNavigator.tsx
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { DeliveryRoutes, type DeliveryStackParams } from "./deliveryRoutes";

import DeliveryHomeScreen from "../screens/DeliveryHomeScreen";
import DeliveryRestaurantScreen from "../screens/DeliveryRestaurantScreen";
import CartScreen from "../screens/CartScreen";
import PaymentScreen from "../screens/PaymentScreen";
import DeliveryAddressPickerScreen from "../screens/DeliveryAddressPickerScreen";
import DeliveryCreateAddressScreen from "../screens/DeliveryCreateAddressScreen";
import MyOrdersScreen from "../screens/MyOrdersScreen";
import { useTheme } from "../theme";

const Stack = createStackNavigator<DeliveryStackParams>();

export default function DeliveryNavigator() {
  const { colors, typography } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName={DeliveryRoutes.DeliveryHome}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: "800",
          fontSize: typography.headingMd.fontSize,
          color: colors.textPrimary,
        },
      }}
    >
      <Stack.Screen
        name={DeliveryRoutes.AddressPicker}
        component={DeliveryAddressPickerScreen}
        options={{ title: "Teslimat Adresi" }}
      />
      <Stack.Screen
        name={DeliveryRoutes.Orders}
        component={MyOrdersScreen}
        options={{ title: "Siparişlerim" }}
      />
      <Stack.Screen
        name={DeliveryRoutes.CreateAddress}
        component={DeliveryCreateAddressScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={DeliveryRoutes.DeliveryHome}
        component={DeliveryHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={DeliveryRoutes.DeliveryRestaurant}
        component={DeliveryRestaurantScreen}
        options={{ title: "Menü" }}
      />
      <Stack.Screen
        name={DeliveryRoutes.Cart}
        component={CartScreen}
        options={{ title: "Sepet" }}
      />
      <Stack.Screen
        name={DeliveryRoutes.Checkout}
        component={PaymentScreen}
        options={{ title: "Ödeme" }}
      />
    </Stack.Navigator>
  );
}

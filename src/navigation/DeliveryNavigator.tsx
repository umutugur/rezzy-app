// src/navigation/DeliveryNavigator.tsx
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { DeliveryRoutes, type DeliveryStackParams } from "./deliveryRoutes";

import DeliveryHomeScreen from "../screens/DeliveryHomeScreen";
import DeliveryRestaurantScreen from "../screens/DeliveryRestaurantScreen";
import CartScreen from "../screens/CartScreen";
import PaymentScreen from "../screens/PaymentScreen";
import DeliveryAddressPickerScreen from "../screens/DeliveryAddressPickerScreen";
import DeliveryCreateAddressScreen from "../screens/DeliveryCreateAddressScreen"; // ✅ yeni ekran
import MyOrdersScreen from "../screens/MyOrdersScreen";

const Stack = createStackNavigator<DeliveryStackParams>();

export default function DeliveryNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={DeliveryRoutes.AddressPicker}
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "800" },
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
        options={{ title: "Adres Ekle" }}
      />

      <Stack.Screen
        name={DeliveryRoutes.DeliveryHome}
        component={DeliveryHomeScreen}
        options={{ title: "Paket Servis" }}
      />
      <Stack.Screen
        name={DeliveryRoutes.DeliveryRestaurant}
        component={DeliveryRestaurantScreen}
        options={{ title: "Menü" }}
      />
      <Stack.Screen name={DeliveryRoutes.Cart} component={CartScreen} options={{ title: "Sepet" }} />
      <Stack.Screen name={DeliveryRoutes.Checkout} component={PaymentScreen} options={{ title: "Ödeme" }} />
    </Stack.Navigator>
  );
}
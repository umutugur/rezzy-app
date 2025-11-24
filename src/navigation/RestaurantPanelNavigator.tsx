import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RestaurantHubScreen from "../screens/RestaurantPanel/RestaurantHubScreen";
import RP_Dashboard from "../screens/RestaurantPanel/RP_Dashboard";
import RP_Reservations from "../screens/RestaurantPanel/RP_Reservations";
import RP_General from "../screens/RestaurantPanel/RP_General";
import RP_Photos from "../screens/RestaurantPanel/RP_Photos";
import RP_Menus from "../screens/RestaurantPanel/RP_Menus";
import RP_Tables from "../screens/RestaurantPanel/RP_Tables";
import RP_Hours from "../screens/RestaurantPanel/RP_Hours";
import RP_Policies from "../screens/RestaurantPanel/RP_Policies";
import RP_MenuManager from "../screens/RestaurantPanel/RP_MenuManager";
export type RestaurantPanelParams = {
  RestaurantHub: { restaurantId: string };
  Dashboard: { restaurantId: string };
  Reservations: { restaurantId: string };
  General: { restaurantId: string };
  Photos: { restaurantId: string };
  Menus: { restaurantId: string };
  MenuManager: { restaurantId: string };  // ✅ YENİ kategori/ürün yönetimi
  Tables: { restaurantId: string };
  Hours: { restaurantId: string };
  Policies: { restaurantId: string };
};

const Stack = createNativeStackNavigator<RestaurantPanelParams>();

export default function RestaurantPanelNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTitle: "Rezzy" }}>
      <Stack.Screen
        name="RestaurantHub"
        component={RestaurantHubScreen}
        options={{ title: "Restoran Paneli" }}
      />
      <Stack.Screen name="Dashboard" component={RP_Dashboard} options={{ title: "Özet" }} />
      <Stack.Screen name="Reservations" component={RP_Reservations} options={{ title: "Rezervasyonlar" }} />
      <Stack.Screen name="General" component={RP_General} options={{ title: "Genel Bilgiler" }} />
      <Stack.Screen name="Photos" component={RP_Photos} options={{ title: "Fotoğraflar" }} />
      <Stack.Screen name="Menus" component={RP_Menus} options={{ title: "Menüler" }} />
      <Stack.Screen name="MenuManager" component={RP_MenuManager} options={{ title: "Menü Yönetimi" }}/>
      <Stack.Screen name="Tables" component={RP_Tables} options={{ title: "Masalar" }} />
      <Stack.Screen name="Hours" component={RP_Hours} options={{ title: "Çalışma Saatleri" }} />
      <Stack.Screen name="Policies" component={RP_Policies} options={{ title: "Rezervasyon Politikaları" }} />
    </Stack.Navigator>
  );
}
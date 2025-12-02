import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminHubScreen from "../screens/AdminPanel/AdminHubScreen";
import AdminGeneralScreen from "../screens/AdminPanel/AdminGeneralScreen";
import AdminRestaurantsScreen from "../screens/AdminPanel/AdminRestaurantsScreen";
import AdminReservationsScreen from "../screens/AdminPanel/AdminReservationsScreen";
import AdminUsersScreen from "../screens/AdminPanel/AdminUsersScreen";
import AdminFeedbackScreen from "../screens/AdminPanel/AdminFeedbackScreen";

export type AdminPanelParams = {
  AdminHub: undefined;
  AdminGeneral: undefined;
  AdminRestaurants: undefined;
  AdminReservations: undefined;
  AdminUsers: undefined;
  AdminFeedback: undefined;
};

const Stack = createNativeStackNavigator<AdminPanelParams>();

export default function AdminPanelNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTitle: "Rezvix" }}>
      <Stack.Screen
        name="AdminHub"
        component={AdminHubScreen}
        options={{ title: "Admin Paneli" }}
      />
      <Stack.Screen name="AdminGeneral" component={AdminGeneralScreen} options={{ title: "Genel KPI" }} />
      <Stack.Screen name="AdminRestaurants" component={AdminRestaurantsScreen} options={{ title: "Restoranlar" }} />
      <Stack.Screen name="AdminReservations" component={AdminReservationsScreen} options={{ title: "Rezervasyonlar" }} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: "Kullanıcılar" }} />
      <Stack.Screen name="AdminFeedback" component={AdminFeedbackScreen} options={{ title: "Yorum & Şikayet" }} />
    </Stack.Navigator>
  );
}
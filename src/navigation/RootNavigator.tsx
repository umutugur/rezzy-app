import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import RestaurantDetailScreen from "../screens/RestaurantDetailScreen";
import ReservationStep1Screen from "../screens/ReservationStep1Screen";
import ReservationStep2Screen from "../screens/ReservationStep2Screen";
import ReservationStep3Screen from "../screens/ReservationStep3Screen";
import ReservationDetailScreen from "../screens/ReservationDetailScreen";
import BookingsScreen from "../screens/BookingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { useAuth } from "../store/useAuth";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function TabsNav() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: "left",
        tabBarActiveTintColor: "#7B2C2C",
        tabBarInactiveTintColor: "#8A8A8A",
        tabBarIcon: ({ color, size }) => {
          const nameMap: Record<string, any> = {
            "Keşfet": "compass-outline",
            "Rezervasyonlar": "calendar-outline",
            "Profil": "person-circle-outline",
          };
          return <Ionicons name={nameMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Keşfet" component={HomeScreen} />
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const token = useAuth((s) => s.token);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {!token ? (
          <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="Tabs"
              component={TabsNav}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <Stack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <Stack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <Stack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <Stack.Screen name="Rezervasyon Detayı" component={ReservationDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

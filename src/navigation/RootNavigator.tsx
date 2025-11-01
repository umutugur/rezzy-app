// src/navigation/RootNavigator.tsx
import React from "react";
import { Platform, View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator, type StackNavigationOptions } from "@react-navigation/stack";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import RestaurantPanelNavigator from "../navigation/RestaurantPanelNavigator";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import RestaurantDetailScreen from "../screens/RestaurantDetailScreen";
import ReservationStep1Screen from "../screens/ReservationStep1Screen";
import ReservationStep2Screen from "../screens/ReservationStep2Screen";
import ReservationStep3Screen from "../screens/ReservationStep3Screen";
import ReservationDetailScreen from "../screens/ReservationDetailScreen";
import BookingsScreen from "../screens/BookingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RestaurantPanelScreen from "../screens/RestaurantPanelScreen";
import AdminPanelScreen from "../screens/AdminPanelScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import TermsScreen from "../screens/TermsScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import ContactScreen from "../screens/ContactScreen";
import AboutScreen from "../screens/AboutScreen";
import LicensesScreen from "../screens/LicensesScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";

import { useAuth } from "../store/useAuth";
import { useNotifications } from "../store/useNotifications";
import AppHeaderTitle from "../components/AppHeaderTitle";
import AdminPanelNavigator from "./AdminPanelNavigator";

const Stack = createStackNavigator();
const Tabs = createBottomTabNavigator();

function Bell({ onPress }: { onPress: () => void }) {
  const unread = useNotifications((s) => s.unreadCount);
  return (
    <View style={{ paddingRight: 6 }}>
      <Ionicons
        name="notifications-outline"
        size={24}
        color="#111827"
        onPress={onPress}
      />
      {unread > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -6,
            top: -4,
            backgroundColor: "#DC2626",
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Tabs config */
function useTabScreenOptions(headerBellPress: () => void) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = 56 + bottomPad;

  return ({ route }: any): BottomTabNavigationOptions => {
    const iconMap: any = {
      Keşfet: "compass-outline",
      Rezervasyonlar: "calendar-outline",
      Profil: "person-circle-outline",
    };

    return {
      headerTitle: () => <AppHeaderTitle />,
      headerTitleAlign: "center",
      headerStyle: { backgroundColor: "#fff" },
      headerLeftContainerStyle: { width: 44 },
      headerRightContainerStyle: { width: 44 },
      tabBarActiveTintColor: "#7B2C2C",
      tabBarInactiveTintColor: "#888",
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        height: barHeight,
        paddingBottom: bottomPad,
        paddingTop: 8,
        borderTopWidth: 0.5,
        backgroundColor: "#fff",
      },
      tabBarIcon: ({ color, size }) => (
        <Ionicons name={iconMap[route.name]} size={size} color={color} />
      ),
      headerRight: () => <Bell onPress={headerBellPress} />,
    };
  };
}

function AppTabs({ navigation }: any) {
  const opts = useTabScreenOptions(() => navigation.navigate("Bildirimler"));
  return (
    <Tabs.Navigator screenOptions={opts}>
      <Tabs.Screen name="Keşfet" component={HomeScreen} />
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function GuestTabs({ navigation }: any) {
  const opts = useTabScreenOptions(() => navigation.navigate("Giriş"));
  return (
    <Tabs.Navigator screenOptions={opts}>
      <Tabs.Screen name="Keşfet" component={HomeScreen} />
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen
        name="Profil"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const token = useAuth((s) => s.token);
  const fetchUnreadCount = useNotifications((s) => s.fetchUnreadCount);

  React.useEffect(() => {
    fetchUnreadCount().catch(() => {});
  }, [token]);

  /** ✅ Stack Header Config */
  const stackOptions: StackNavigationOptions = {
    headerShown: true,
    headerTitle: () => <AppHeaderTitle />,
    headerTitleAlign: "center",
    headerStyle: { backgroundColor: "#fff" },
    headerLeftContainerStyle: { width: 44 },
    headerRightContainerStyle: { width: 44 },
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={stackOptions}>
        {token ? (
          <>
            <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Bildirimler" component={NotificationsScreen} />
            <Stack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <Stack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <Stack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <Stack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <Stack.Screen name="Rezervasyon Detayı" component={ReservationDetailScreen} />
            <Stack.Screen name="RestaurantPanel" component={RestaurantPanelNavigator} options={{ headerShown: false }}/>
            <Stack.Screen name="AdminPanel" component={AdminPanelNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Help" component={HelpSupportScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Licenses" component={LicensesScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="TabsGuest" component={GuestTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <Stack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <Stack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <Stack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Help" component={HelpSupportScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Licenses" component={LicensesScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
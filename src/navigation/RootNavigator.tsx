// src/navigation/RootNavigator.tsx
import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from 'expo-notifications';
import { useTaxiStore } from '../store/useTaxiStore';
import { createStackNavigator, type StackNavigationOptions } from "@react-navigation/stack";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import Constants from "expo-constants";

// Lucide icons
import { Bell } from "lucide-react-native";

// Custom animated tab bar — Reanimated pill indicator + lucide icons
import { AnimatedTabBar } from "../components/navigation/AnimatedTabBar";

import RestaurantPanelNavigator from "../navigation/RestaurantPanelNavigator";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import HomeLandingScreen from "../screens/HomeLandingScreen";
import RestaurantMapScreen from "../screens/RestaurantMapScreen";
import RestaurantDetailScreen from "../screens/RestaurantDetailScreen";
import ReservationStep1Screen from "../screens/ReservationStep1Screen";
import ReservationStep2Screen from "../screens/ReservationStep2Screen";
import ReservationStep3Screen from "../screens/ReservationStep3Screen";
import ReservationDetailScreen from "../screens/ReservationDetailScreen";
import BookingsScreen from "../screens/BookingsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import TermsScreen from "../screens/TermsScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import ContactScreen from "../screens/ContactScreen";
import AboutScreen from "../screens/AboutScreen";
import LicensesScreen from "../screens/LicensesScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import AssistantScreen from "../screens/AssistantScreen";
import MyOrdersScreen from "../screens/MyOrdersScreen";

import QrMenuScreen from "../screens/QrMenuScreen";
import QrScanScreen from "../screens/QrScanScreen";

import DeliveryNavigator from "../navigation/DeliveryNavigator";
// AJAN-7 tamamlandığında: MarketNavigator buraya
import MarketNavigator from "../navigation/MarketNavigator";
// AJAN-8 tamamlandığında: TaxiNavigator buraya
import TaxiNavigator from "../navigation/TaxiNavigator";
import DriverNavigator from "../navigation/DriverNavigator";
import DriverRegistrationScreen from "../screens/driver/DriverRegistrationScreen";

import { useAuth } from "../store/useAuth";
import { useRegion } from "../store/useRegion";
import { useNotifications } from "../store/useNotifications";
import AppHeaderTitle from "../components/AppHeaderTitle";
import AdminPanelNavigator from "./AdminPanelNavigator";
import { useTheme } from "../theme";

const DEV_QR = {
  restaurantId: "695d73f6e98967aaba07c694",
  tableId: "69713f78bc4f2ca2a53deb20",
};

const RootStack = createStackNavigator();
const Tabs = createBottomTabNavigator();
const ExploreStack = createStackNavigator();

// ─── EmptyScreen for QR tab slot ──────────────────────────────────────────────
function EmptyScreen() {
  return null;
}

// ─── Explore nested stack ─────────────────────────────────────────────────────
function ExploreNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="KeşfetLanding" component={HomeLandingScreen} />
      <ExploreStack.Screen name="KeşfetListe" component={HomeScreen} />
    </ExploreStack.Navigator>
  );
}

// ─── Shared header right bell ─────────────────────────────────────────────────
function HeaderBell({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingRight: 6 }} hitSlop={6}>
      <Bell color={colors.textPrimary} size={22} strokeWidth={1.8} />
    </Pressable>
  );
}

// ─── Tab bar factory — binds the QR press handler ─────────────────────────────
function buildTabBar(onQrPress: () => void) {
  return (props: BottomTabBarProps) => (
    <AnimatedTabBar {...props} onQrPress={onQrPress} />
  );
}

// ─── Authenticated tabs ───────────────────────────────────────────────────────
function AppTabs({ navigation }: any) {
  const { colors } = useTheme();

  const headerOptions = {
    headerTitle: () => <AppHeaderTitle />,
    headerTitleAlign: "center" as const,
    headerStyle: { backgroundColor: colors.background },
    headerLeftContainerStyle: { width: 44 },
    headerRightContainerStyle: { width: 44 },
    headerRight: () => (
      <HeaderBell onPress={() => navigation.navigate("Bildirimler")} />
    ),
  };

  const onQrPress = () => {
    if (__DEV__ && !Constants.isDevice) {
      navigation.navigate("QR Menü", {
        restaurantId: DEV_QR.restaurantId,
        tableId: DEV_QR.tableId,
        sessionId: null,
        reservationId: null,
        _devBypass: true,
      });
      return;
    }
    navigation.navigate("QR Tara");
  };

  return (
    <Tabs.Navigator
      tabBar={buildTabBar(onQrPress)}
      screenOptions={headerOptions}
    >
      <Tabs.Screen name="Keşfet" component={ExploreNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="QR" component={EmptyScreen} />
      <Tabs.Screen name="Siparişlerim" component={MyOrdersScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

// ─── Guest tabs ───────────────────────────────────────────────────────────────
function GuestTabs({ navigation }: any) {
  const { colors } = useTheme();

  const headerOptions = {
    headerTitle: () => <AppHeaderTitle />,
    headerTitleAlign: "center" as const,
    headerStyle: { backgroundColor: colors.background },
    headerLeftContainerStyle: { width: 44 },
    headerRightContainerStyle: { width: 44 },
    headerRight: () => (
      <HeaderBell onPress={() => navigation.navigate("Giriş")} />
    ),
  };

  const onQrPress = () => {
    if (__DEV__ && !Constants.isDevice) {
      navigation.navigate("QR Menü", {
        restaurantId: DEV_QR.restaurantId,
        tableId: DEV_QR.tableId,
        sessionId: null,
        reservationId: null,
        _devBypass: true,
      });
      return;
    }
    navigation.navigate("QR Tara");
  };

  return (
    <Tabs.Navigator
      tabBar={buildTabBar(onQrPress)}
      screenOptions={headerOptions}
    >
      <Tabs.Screen name="Keşfet" component={ExploreNavigator} options={{ headerShown: false }} />
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="QR" component={EmptyScreen} />
      <Tabs.Screen
        name="Siparişlerim"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Tabs.Screen
        name="Profil"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Tabs.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────
export default function RootNavigator() {
  const token = useAuth((s) => s.token);
  const authHydrated = useAuth((s) => s.hydrated);
  const regionHydrated = useRegion((s) => s.hydrated);
  const regionResolved = useRegion((s) => s.resolved);
  const setIncomingRide = useTaxiStore((s) => s.setIncomingRide);

  const navKey = token ? "auth" : "guest";
  const navigationRef = useNavigationContainerRef();

  // ── Bildirim: uygulama kapalıyken gelen ride:new_request ──────────────────
  React.useEffect(() => {
    if (!token) return;

    // Soğuk başlatma: uygulama bildirimle açıldıysa
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification?.request?.content?.data as any;
      if (data?.type === 'ride:new_request' && data?.rideId) {
        setIncomingRide({
          rideId: data.rideId,
          pickup: data.pickup,
          dropoff: data.dropoff,
          vehicleType: data.vehicleType,
          fare: data.fare,
          distanceKm: data.distanceKm ?? 0,
          durationMin: data.durationMin ?? 0,
          requestedAt: new Date().toISOString(),
        });
        // Driver ekranına git
        setTimeout(() => {
          if (navigationRef.isReady()) {
            (navigationRef as any).navigate('Driver');
          }
        }, 500);
      }
    });

    // Arka plan: uygulama açıkken gelen bildirime tıklanırsa
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request' && data?.rideId) {
        setIncomingRide({
          rideId: data.rideId,
          pickup: data.pickup,
          dropoff: data.dropoff,
          vehicleType: data.vehicleType,
          fare: data.fare,
          distanceKm: data.distanceKm ?? 0,
          durationMin: data.durationMin ?? 0,
          requestedAt: new Date().toISOString(),
        });
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('Driver');
        }
      }
    });

    return () => sub.remove();
  }, [token, setIncomingRide, navigationRef]);

  const fetchUnreadCount = useNotifications((s) => s.fetchUnreadCount);

  React.useEffect(() => {
    if (!token) return;
    fetchUnreadCount().catch(() => {});
  }, [token, fetchUnreadCount]);

  const { colors } = useTheme();

  const stackOptions: StackNavigationOptions = {
    headerShown: true,
    headerTitle: () => <AppHeaderTitle />,
    headerTitleAlign: "center",
    headerStyle: { backgroundColor: colors.background },
    headerLeftContainerStyle: { width: 44 },
    headerRightContainerStyle: { width: 44 },
  };

  if (!authHydrated || !regionHydrated || !regionResolved) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            marginTop: 10,
            color: colors.textSecondary,
            fontWeight: "600",
          }}
        >
          Yükleniyor…
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={navKey} ref={navigationRef}>
      <RootStack.Navigator screenOptions={stackOptions}>
        {token ? (
          <>
            <RootStack.Screen
              name="Tabs"
              component={AppTabs}
              options={{ headerShown: false }}
            />
            <RootStack.Screen name="Bildirimler" component={NotificationsScreen} />
            <RootStack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <RootStack.Screen name="Harita" component={RestaurantMapScreen} />
            <RootStack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <RootStack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <RootStack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <RootStack.Screen name="Rezervasyon Detayı" component={ReservationDetailScreen} />
            <RootStack.Screen name="QR Menü" component={QrMenuScreen} />
            <RootStack.Screen name="QR Tara" component={QrScanScreen} />
            <RootStack.Screen
              name="RestaurantPanel"
              component={RestaurantPanelNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="AdminPanel"
              component={AdminPanelNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen name="Terms" component={TermsScreen} />
            <RootStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <RootStack.Screen name="Help" component={HelpSupportScreen} />
            <RootStack.Screen name="Contact" component={ContactScreen} />
            <RootStack.Screen name="About" component={AboutScreen} />
            <RootStack.Screen name="Licenses" component={LicensesScreen} />
            <RootStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <RootStack.Screen name="Asistan" component={AssistantScreen} />
            <RootStack.Screen
              name="Delivery"
              component={DeliveryNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Market"
              component={MarketNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Taxi"
              component={TaxiNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Driver"
              component={DriverNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="DriverRegistration"
              component={DriverRegistrationScreen}
              options={{ title: 'Sürücü Başvurusu', headerShown: true }}
            />
          </>
        ) : (
          <>
            <RootStack.Screen
              name="TabsGuest"
              component={GuestTabs}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Giriş"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <RootStack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <RootStack.Screen name="Harita" component={RestaurantMapScreen} />
            <RootStack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <RootStack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <RootStack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <RootStack.Screen name="QR Menü" component={QrMenuScreen} />
            <RootStack.Screen name="QR Tara" component={QrScanScreen} />
            <RootStack.Screen name="Terms" component={TermsScreen} />
            <RootStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <RootStack.Screen name="Help" component={HelpSupportScreen} />
            <RootStack.Screen name="Contact" component={ContactScreen} />
            <RootStack.Screen name="About" component={AboutScreen} />
            <RootStack.Screen name="Licenses" component={LicensesScreen} />
            <RootStack.Screen name="Asistan" component={AssistantScreen} />
            <RootStack.Screen
              name="Delivery"
              component={DeliveryNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Market"
              component={MarketNavigator}
              options={{ headerShown: false }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

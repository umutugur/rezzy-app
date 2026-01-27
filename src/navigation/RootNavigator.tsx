// src/navigation/RootNavigator.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator, type StackNavigationOptions } from "@react-navigation/stack";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";

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

import { useAuth } from "../store/useAuth";
import { useRegion } from "../store/useRegion";
import { useNotifications } from "../store/useNotifications";
import AppHeaderTitle from "../components/AppHeaderTitle";
import AdminPanelNavigator from "./AdminPanelNavigator";
import { useI18n } from "../i18n";

const DEV_QR = {
  restaurantId: "695d73f6e98967aaba07c694",
  tableId: "69713f78bc4f2ca2a53deb20",
};

const RootStack = createStackNavigator();
const Tabs = createBottomTabNavigator();
const ExploreStack = createStackNavigator();

/** Ortadaki floating QR buton */
function QrTabButton({
  onPress,
  accessibilityState,
}: {
  onPress: () => void;
  accessibilityState?: any;
}) {
  const focused = accessibilityState?.selected;
  return (
    <Pressable onPress={onPress} style={styles.qrBtnWrap} hitSlop={10}>
      <View style={[styles.qrBtn, focused && styles.qrBtnFocused]}>
        <Ionicons name="qr-code-outline" size={24} color="#fff" />
      </View>
      <Text style={styles.qrBtnLabel}>QR Menü</Text>
    </Pressable>
  );
}

function EmptyScreen() {
  return null;
}

/** Tabs config */
function useTabScreenOptions(headerBellPress: () => void) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = 58 + bottomPad;

  const { language } = useI18n();
  const lang: "tr" | "en" | "ru" | "el" =
    (["tr", "en", "ru", "el"].includes(language) ? language : "en") as any;

  const labels = {
    explore: { tr: "Keşfet", en: "Explore", ru: "Исследовать", el: "Εξερεύνηση" },
    reservations: { tr: "Rezervasyonlarım", en: "My Reservations", ru: "Бронирования", el: "Κρατήσεις" },
    orders: { tr: "Siparişlerim", en: "My Orders", ru: "Мои заказы", el: "Οι παραγγελίες μου" },
    profile: { tr: "Profil", en: "Profile", ru: "Профиль", el: "Προφίλ" },
    qr: { tr: "QR Menü", en: "QR Menu", ru: "QR Меню", el: "QR Μενού" },
  };

  return ({ route }: any): BottomTabNavigationOptions => {
    let iconName: any = "ellipse-outline";
    let label: string = route.name;

    if (route.name === "Keşfet") {
      iconName = "compass-outline";
      label = labels.explore[lang];
    } else if (route.name === "Rezervasyonlar") {
      iconName = "calendar-outline";
      label = labels.reservations[lang];
    } else if (route.name === "Siparişlerim") {
      iconName = "receipt-outline";
      label = labels.orders[lang];
    } else if (route.name === "Profil") {
      iconName = "person-circle-outline";
      label = labels.profile[lang];
    } else if (route.name === "QR") {
      label = labels.qr[lang];
    }

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

      tabBarLabel: label,
      tabBarIcon: ({ color, size }) =>
        route.name === "QR" ? null : <Ionicons name={iconName} size={size} color={color} />,

      headerRight: () => (
        <Pressable onPress={headerBellPress} style={{ paddingRight: 6 }}>
          <Ionicons name="notifications-outline" size={24} color="#111827" />
        </Pressable>
      ),
    };
  };
}

/**
 * ✅ Keşfet sekmesi için nested stack.
 * Tab bar kaybolmadan HomeLanding -> HomeScreen geçişi burada yapılacak.
 */
function ExploreNavigator() {
  return (
    <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
      <ExploreStack.Screen name="KeşfetLanding" component={HomeLandingScreen} />
      <ExploreStack.Screen name="KeşfetListe" component={HomeScreen} />
    </ExploreStack.Navigator>
  );
}

function AppTabs({ navigation }: any) {
  const opts = useTabScreenOptions(() => navigation.navigate("Bildirimler"));

  return (
    <Tabs.Navigator screenOptions={opts}>
      <Tabs.Screen name="Keşfet" component={ExploreNavigator} />

     <Tabs.Screen
  name="QR"
  component={EmptyScreen}
  options={{
    tabBarButton: (props) => (
      <QrTabButton
        {...props}
        onPress={() => {
          // DEV bypass sadece emulator/simulator'da çalışsın; fiziksel cihazda QR tarama açık kalsın
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
        }}
      />
    ),
  }}
/>
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="Siparişlerim" component={MyOrdersScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function GuestTabs({ navigation }: any) {
  const opts = useTabScreenOptions(() => navigation.navigate("Giriş"));

  return (
    <Tabs.Navigator screenOptions={opts}>
      <Tabs.Screen name="Keşfet" component={ExploreNavigator} />

     <Tabs.Screen
  name="QR"
  component={EmptyScreen}
  options={{
    tabBarButton: (props) => (
      <QrTabButton
        {...props}
        onPress={() => {
          // DEV bypass sadece emulator/simulator'da çalışsın; fiziksel cihazda QR tarama açık kalsın
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
        }}
      />
    ),
  }}
/>
      <Tabs.Screen name="Rezervasyonlar" component={BookingsScreen} />
      <Tabs.Screen name="Siparişlerim" component={LoginScreen} options={{ headerShown: false }} />
      <Tabs.Screen name="Profil" component={LoginScreen} options={{ headerShown: false }} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const token = useAuth((s) => s.token);
  const authHydrated = useAuth((s) => s.hydrated);

  const regionHydrated = useRegion((s) => s.hydrated);
  const regionResolved = useRegion((s) => s.resolved);

  const navKey = token ? "auth" : "guest";

  const fetchUnreadCount = useNotifications((s) => s.fetchUnreadCount);

  React.useEffect(() => {
    if (!token) return;
    fetchUnreadCount().catch(() => {});
  }, [token, fetchUnreadCount]);

  const stackOptions: StackNavigationOptions = {
    headerShown: true,
    headerTitle: () => <AppHeaderTitle />,
    headerTitleAlign: "center",
    headerStyle: { backgroundColor: "#fff" },
    headerLeftContainerStyle: { width: 44 },
    headerRightContainerStyle: { width: 44 },
  };

  if (!authHydrated || !regionHydrated || !regionResolved) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: "#6B7280", fontWeight: "600" }}>
          Yükleniyor…
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer key={navKey}>
      <RootStack.Navigator screenOptions={stackOptions}>
        {token ? (
          <>
            <RootStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
            {/* KeşfetListe artık ExploreNavigator içinde, burada tekrar tanımlama YOK */}
            <RootStack.Screen name="Bildirimler" component={NotificationsScreen} />
            <RootStack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <RootStack.Screen name="Harita" component={RestaurantMapScreen} />
            <RootStack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <RootStack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <RootStack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <RootStack.Screen name="Rezervasyon Detayı" component={ReservationDetailScreen} />

            <RootStack.Screen name="QR Menü" component={QrMenuScreen} />
            <RootStack.Screen name="QR Tara" component={QrScanScreen} />

            <RootStack.Screen name="RestaurantPanel" component={RestaurantPanelNavigator} options={{ headerShown: false }} />
            <RootStack.Screen name="AdminPanel" component={AdminPanelNavigator} options={{ headerShown: false }} />
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
          </>
        ) : (
          <>
            <RootStack.Screen name="TabsGuest" component={GuestTabs} options={{ headerShown: false }} />
            {/* KeşfetListe artık ExploreNavigator içinde, burada tekrar tanımlama YOK */}
            <RootStack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
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
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  qrBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    top: -18,
  },
  qrBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#7B2C2C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#fff",
  },
  qrBtnFocused: {
    backgroundColor: "#6B2525",
  },
  qrBtnLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "800",
    color: "#7B2C2C",
  },
});
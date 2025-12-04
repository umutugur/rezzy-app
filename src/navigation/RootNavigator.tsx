// src/navigation/RootNavigator.tsx
import React from "react";
import { Platform, View, Text, Pressable, StyleSheet } from "react-native";
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

import QrMenuScreen from "../screens/QrMenuScreen";
import QrScanScreen from "../screens/QrScanScreen";

import { useAuth } from "../store/useAuth";
import { useNotifications } from "../store/useNotifications";
import AppHeaderTitle from "../components/AppHeaderTitle";
import AdminPanelNavigator from "./AdminPanelNavigator";
import { useI18n } from "../i18n";

const Stack = createStackNavigator();
const Tabs = createBottomTabNavigator();

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

// Dummy component (render olmaz, sadece buton için)
function EmptyScreen() {
  return null;
}

/** Tabs config */
function useTabScreenOptions(headerBellPress: () => void) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const barHeight = 58 + bottomPad; // biraz daha yüksek bırakalım

  const { t, language } = useI18n();
  let lang: "tr" | "en" | "ru" | "el" =
    (["tr", "en", "ru", "el"].includes(language) ? language : "en") as any;

  const labels = {
    explore: { tr: "Keşfet", en: "Explore", ru: "Исследовать", el: "Εξερεύνηση" },
    reservations: {
      tr: "Rezervasyonlarım",
      en: "My Reservations",
      ru: "Бронирования",
      el: "Κρατήσεις",
    },
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
    } else if (route.name === "Profil") {
      iconName = "person-circle-outline";
      label = labels.profile[lang];
    } else if (route.name === "QR") {
      // QR tab label'ını custom buton çiziyor, burada gizliyoruz
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
        route.name === "QR" ? null : (
          <Ionicons name={iconName} size={size} color={color} />
        ),

      headerRight: () => (
        <Pressable onPress={headerBellPress} style={{ paddingRight: 6 }}>
          <Ionicons name="notifications-outline" size={24} color="#111827" />
        </Pressable>
      ),
    };
  };
}

function AppTabs({ navigation }: any) {
  const opts = useTabScreenOptions(() => navigation.navigate("Bildirimler"));

  return (
    <Tabs.Navigator screenOptions={opts}>
      <Tabs.Screen name="Keşfet" component={HomeScreen} />

      {/* ✅ ORTA FLOATING QR TAB */}
     <Tabs.Screen
  name="QR"
  component={EmptyScreen}
  options={{
    tabBarButton: (props) => (
      <QrTabButton
        {...props}
        onPress={() => {
          navigation.navigate("QR Tara");
        }}
      />
    ),
  }}
/>

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

      <Tabs.Screen
  name="QR"
  component={EmptyScreen}
  options={{
    tabBarButton: (props) => (
      <QrTabButton
        {...props}
        onPress={() => {
          navigation.navigate("QR Tara");
        }}
      />
    ),
  }}
/>

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
            <Stack.Screen name="Harita" component={RestaurantMapScreen} />
            <Stack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <Stack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <Stack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />
            <Stack.Screen name="Rezervasyon Detayı" component={ReservationDetailScreen} />

            {/* ✅ QR ekranları */}
            <Stack.Screen name="QR Menü" component={QrMenuScreen} />
            <Stack.Screen name="QR Tara" component={QrScanScreen} />

            <Stack.Screen name="RestaurantPanel" component={RestaurantPanelNavigator} options={{ headerShown: false }}/>
            <Stack.Screen name="AdminPanel" component={AdminPanelNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Help" component={HelpSupportScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Licenses" component={LicensesScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <Stack.Screen name="Asistan" component={AssistantScreen} />

          </>
        ) : (
          <>
            <Stack.Screen name="TabsGuest" component={GuestTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Giriş" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Restoran" component={RestaurantDetailScreen} />
            <Stack.Screen name="Harita" component={RestaurantMapScreen} />
            <Stack.Screen name="Rezervasyon - Tarih" component={ReservationStep1Screen} />
            <Stack.Screen name="Rezervasyon - Menü" component={ReservationStep2Screen} />
            <Stack.Screen name="Rezervasyon - Özet" component={ReservationStep3Screen} />

            {/* ✅ QR ekranları */}
            <Stack.Screen name="QR Menü" component={QrMenuScreen} />
            <Stack.Screen name="QR Tara" component={QrScanScreen} />

            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Help" component={HelpSupportScreen} />
            <Stack.Screen name="Contact" component={ContactScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Licenses" component={LicensesScreen} />
            <Stack.Screen name="Asistan" component={AssistantScreen} />

          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  qrBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    top: -18, // ✅ daha yukarı taşıyoruz (çakışma biter)
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
    borderColor: "#fff", // tab bardan “ayrı” gibi hissettiren beyaz halka
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
// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { View, ActivityIndicator, Text, TextInput, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useAuth } from "./src/store/useAuth";
import { useRegion } from "./src/store/useRegion";
import { registerPushToken, attachDeviceAfterLogin } from "./src/hooks/usePushToken";
import InAppToast from "./src/components/InAppToast";
import { StripeProvider } from "@stripe/stripe-react-native";
import Constants from "expo-constants";

// Global font scale
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.2;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.2;

// Bildirim davranışı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

// ✅ Publishable key'i config'den çek
const publishableKey =
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_STRIPE_PK ||
  (Constants.manifest?.extra as any)?.EXPO_PUBLIC_STRIPE_PK ||
  process.env.EXPO_PUBLIC_STRIPE_PK ||
  "";

export default function App() {
  const hydrateAuth = useAuth((s: any) => s.hydrate);
  const authHydrated = useAuth((s: any) => s.hydrated);
  const token = useAuth((s: any) => s.token);

  const hydrateRegion = useRegion((s) => s.hydrate);
  const regionInitialized = useRegion((s) => s.initialized);
  const hasUserChoice = useRegion((s) => s.hasUserChoice);
  const setFromCountryCode = useRegion((s) => s.setFromCountryCode);

  // Auth hydrate
  React.useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // Region hydrate
  React.useEffect(() => {
    hydrateRegion();
  }, [hydrateRegion]);

  // İlk açılışta push token
  React.useEffect(() => {
    (async () => {
      await ensureAndroidChannel();
      if (authHydrated) {
        await registerPushToken();
      }
    })();
  }, [authHydrated]);

  // Login / logout sonrası cihaz eşleştirme
  React.useEffect(() => {
    (async () => {
      if (!authHydrated) return;
      if (token) {
        await attachDeviceAfterLogin();
      } else {
        await registerPushToken();
      }
    })();
  }, [token, authHydrated]);

  // Bölgeyi ülkeye göre otomatik tahmin (kullanıcı seçim yapmadıysa)
  React.useEffect(() => {
    (async () => {
      if (!regionInitialized || hasUserChoice) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync(pos.coords);
        const code = geo?.[0]?.isoCountryCode || null;
        setFromCountryCode(code || undefined);
      } catch {
        // sessiz geç
      }
    })();
  }, [regionInitialized, hasUserChoice, setFromCountryCode]);

  // Hem auth hem region hazır değilse
  if (!authHydrated || !regionInitialized) {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StripeProvider
        publishableKey={publishableKey}
        merchantIdentifier="com.umutugur.rezzy" // Apple Pay için
        urlScheme="com.rezzy.app"              // expo scheme ile aynı
      >
        <StatusBar style="dark" />
        <RootNavigator />
        <InAppToast />
      </StripeProvider>
    </SafeAreaProvider>
  );
}
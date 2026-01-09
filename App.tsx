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
  const fetchMe = useAuth((s: any) => s.fetchMe);
  const token = useAuth((s: any) => s.token);
  const userPreferredRegion = useAuth((s: any) => s.user?.preferredRegion);
  const userPreferredLanguage = useAuth((s: any) => s.user?.preferredLanguage);
  // ✅ Region store self-hydrates inside useRegion.ts; avoid calling hydrate() again here.
  const regionHydrated = useRegion((s) => s.hydrated);
  const regionResolved = useRegion((s) => s.resolved);
  const hasUserChoice = useRegion((s) => s.hasUserChoice);
  const setFromCountryCode = useRegion((s) => s.setFromCountryCode);
  const setRegion = useRegion((s) => s.setRegion);
  const setLanguage = useRegion((s) => s.setLanguage);
  const markRegionResolved = useRegion((s) => s.markResolved);

  // Region auto-resolution completed? (prevents CY default render -> UK flip)
  // Removed local state in favor of store's resolved state

  // ✅ /auth/me gerçekten en az 1 kez çekildi mi? (persisted meLoaded'a güvenmiyoruz)
  const [meBootstrapped, setMeBootstrapped] = React.useState(false);

  // Helper: should we wait for /me before deciding region?
  const needsMeBeforeRegion = !!token;

  // ✅ Auth hydrate (boot gate)
  // Important: token/user can arrive async; we treat the app as not ready until hydrateAuth() completes.
  const [authBootstrapped, setAuthBootstrapped] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // hydrateAuth is expected to resolve after AsyncStorage read + store set
        await hydrateAuth?.();
      } catch {
        // no-op
      } finally {
        if (!cancelled) setAuthBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateAuth]);

  // ✅ Token varsa /auth/me'yi uygulama açılışında ZORLA çek.
  // Not: meLoaded persist edilmiş olabilir; buna güvenmeyip gerçek bir fetch ile bootstrap ediyoruz.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!authBootstrapped) return;

      // Login yoksa: me bootstrap tamam
      if (!token) {
        if (!cancelled) setMeBootstrapped(true);
        return;
      }

      // Token var: /me'yi en az 1 kez çekmeden UI açma
      if (typeof fetchMe !== "function") {
        if (!cancelled) setMeBootstrapped(true);
        return;
      }

      try {
        await fetchMe();
      } finally {
        if (!cancelled) setMeBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authBootstrapped, token, fetchMe]);

  // İlk açılışta push token
  React.useEffect(() => {
    (async () => {
      await ensureAndroidChannel();
      if (authBootstrapped) {
        await registerPushToken();
      }
    })();
  }, [authBootstrapped]);

  // Login / logout sonrası cihaz eşleştirme
  React.useEffect(() => {
    (async () => {
      if (!authBootstrapped) return;
      if (token) {
        await attachDeviceAfterLogin();
      } else {
        await registerPushToken();
      }
    })();
  }, [token, authBootstrapped]);

  // Bölgeyi ülkeye göre otomatik belirle (kullanıcı seçim yapmadıysa)
  // Kritik: Bu iş bitmeden UI açılırsa ilk render default (CY) ile request atıp sonra UK'ye flip edebiliyor.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Wait for auth + region hydration first.
      if (!authBootstrapped) return;
      if (!regionHydrated) return;

      // If logged in, ensure we fetched /me at least once before deciding region.
      if (needsMeBeforeRegion && !meBootstrapped) return;

      try {
        // If user explicitly chose a region/language, never override.
        if (hasUserChoice) {
          if (!cancelled) markRegionResolved();
          return;
        }

        // Logged-in: apply backend preferences if present.
        if (token) {
          if (!cancelled && userPreferredRegion) {
            setRegion(String(userPreferredRegion).toUpperCase());
          }
          if (!cancelled && userPreferredLanguage) {
            setLanguage(String(userPreferredLanguage));
          }

          // Even if no preference exists, we consider region resolution complete.
          if (!cancelled) markRegionResolved();
          return;
        }

        // Logged-out: attempt location-based auto-detect.
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== "granted") {
          if (!cancelled) markRegionResolved();
          return;
        }

        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;

        const geo = await Location.reverseGeocodeAsync(pos.coords);
        if (cancelled) return;

        const code = geo?.[0]?.isoCountryCode || null;
        if (code) {
          // NOTE: setFromCountryCode internally sets `resolved: true` when it can.
          // We do not call markRegionResolved here to avoid double-setting state.
          if (!cancelled) setFromCountryCode(code);
        } else {
          // No country code => stop retrying and allow UI to proceed with persisted/defaults.
          if (!cancelled) markRegionResolved();
        }
      } catch {
        if (!cancelled) markRegionResolved();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authBootstrapped,
    regionHydrated,
    hasUserChoice,
    token,
    needsMeBeforeRegion,
    meBootstrapped,
    userPreferredRegion,
    userPreferredLanguage,
    setFromCountryCode,
    setRegion,
    setLanguage,
    markRegionResolved,
  ]);

  // Hem auth hem region hazır değilse (ve region auto-detect bitmediyse)
  if (!authBootstrapped || !regionHydrated || !regionResolved || (token && !meBootstrapped)) {
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
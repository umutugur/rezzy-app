// App.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { View, ActivityIndicator, Text, TextInput, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "./src/store/useAuth";
import { registerPushToken, attachDeviceAfterLogin } from "./src/hooks/usePushToken";

// 🔧 Global font ölçek sınırı
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.2;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.2;

// 🔔 Bildirim davranışı
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // iOS 17+
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// (Tercihe bağlı) Android kanalını garanti altına almak için bir defa oluştur
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
  });
}

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);

  // Storage -> belleğe
  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Uygulama ilk açılışta push token al ve (misafir ise register, login ise attach) gönder
  React.useEffect(() => {
    (async () => {
      await ensureAndroidChannel();
      if (hydrated) {
        await registerPushToken();
      }
    })();
  }, [hydrated]);

  // Oturum durumu değişince (login/logout) cihazı ilişkilendir
  React.useEffect(() => {
    (async () => {
      if (!hydrated) return;
      if (token) {
        // Login olduysa kullanıcıya attach et (idempotent)
        await attachDeviceAfterLogin();
      } else {
        // Logout sonrası tekrar guest olarak kayıt (idempotent)
        await registerPushToken();
      }
    })();
  }, [token, hydrated]);

  // Bildirim tıklama dinleyicileri (opsiyonel – yönlendirme için RootNavigator içinden de ele alınabilir)
  React.useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener(() => {
      // app foreground’da iken geldi — UI içinde zaten handler alert gösteriyor
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((resp) => {
      // tıklama/aksiyon — navigasyon intent’ini burada ya da RootNavigator içinde handle edebilirsin
      // const data = resp.notification.request.content.data as any;
      // örn: if (data?.routeName) { /* navigationService.navigate(data.routeName, data.params) */ }
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  if (!hydrated) {
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
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
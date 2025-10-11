import React from "react";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { View, ActivityIndicator, Text, TextInput } from "react-native";
import { useAuth } from "./src/store/useAuth";
import * as Notifications from "expo-notifications";

/** 🔧 Global font ölçek sınırı (erişilebilirlik büyütmelerinde layout bozulmasın) */
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.2;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.2;

/** 🔔 iOS/Android foreground bildirim davranışı (banner/ses/rozet göster) */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true, // ✅ iOS 17+
    shouldShowList: true,   // ✅ iOS 17+
  }),
});

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrated = useAuth((s) => s.hydrated);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

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
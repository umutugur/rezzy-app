// src/hooks/usePushToken.ts (GEÇİCİ DEBUG)
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform, Alert } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../store/useAuth";

export async function registerPushToken() {
  try {
    if (!Device.isDevice) {
      Alert.alert("Push", "Emülatörde/cihaz dışı ortam");
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== "granted") {
      Alert.alert("Push", "İzin verilmedi");
      return null;
    }

    // EAS Project Id
    // @ts-ignore
    const projectId = Constants?.easConfig?.projectId
      // @ts-ignore
      || Constants?.expoConfig?.extra?.eas?.projectId;

    let token: string | null = null;
    try {
      const r = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      token = r?.data ?? null;
    } catch (e: any) {
      Alert.alert("Push getToken Hatası", e?.message || String(e));
      return null;
    }

    if (!token) {
      Alert.alert("Push", "Token null");
      return null;
    }

    const jwt = useAuth.getState().token;
    await api.post(
      "/notifications/register",
      { token },
      jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined
    );

    Alert.alert("Push", `OK\nprojectId=${projectId}\n${token.slice(0,20)}...`);
    return token;
  } catch (e: any) {
    Alert.alert("Push Genel Hata", e?.message || String(e));
    return null;
  }
}

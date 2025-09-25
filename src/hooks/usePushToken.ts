import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform, Alert } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../store/useAuth";

export async function registerPushToken() {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    const projectId =
      // EAS build’de bu her zaman dolu olur.
      // (run:android için olmaz – zaten onu kullanmıyoruz)
      // @ts-ignore
      Constants?.easConfig?.projectId ||
      // yedek
      // @ts-ignore
      Constants?.expoConfig?.extra?.eas?.projectId;

    const token = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : (await Notifications.getExpoPushTokenAsync()).data;

    if (!token) return null;

    const jwt = useAuth.getState().token;
    await api.post(
      "/notifications/register",
      { token },
      jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined
    );

    return token;
  } catch (e: any) {
    Alert.alert(
      "Push getToken Hatası",
      e?.message || "Push token alınamadı."
    );
    return null;
  }
}

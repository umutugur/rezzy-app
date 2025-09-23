// src/hooks/usePushToken.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../store/useAuth";

export async function registerPushToken() {
  if (!Device.isDevice) return null;

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
  if (finalStatus !== "granted") return null;

  const projectId =
    // @ts-ignore
    Constants?.expoConfig?.extra?.eas?.projectId ||
    // @ts-ignore
    Constants?.easConfig?.projectId;
  if (!projectId) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  const jwt = useAuth.getState().token;
  await api.post(
    "/notifications/register",
    { token },
    jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined
  );

  return token;
}

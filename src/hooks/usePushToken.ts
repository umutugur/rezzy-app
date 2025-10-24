// src/hooks/usePushToken.ts  (güncel tam kod)
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Platform, Alert } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../store/useAuth";

const DEVICE_KEY = "rezzy.device.id.v1";

/** HEX random id üret */
async function createDeviceId() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `dev_${Platform.OS}_${hex}`;
}

/** Saklı deviceId getir/yoksa oluştur */
async function getDeviceId(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(DEVICE_KEY);
    if (saved) return saved;
    const id = await createDeviceId();
    await SecureStore.setItemAsync(DEVICE_KEY, id);
    return id;
  } catch {
    // SecureStore yoksa bile çalışsın
    return await createDeviceId();
  }
}

/** App sürümü (mümkün olan en iyi kaynak) */
function getAppVersion(): string | null {
  // EAS build’lerde:
  // @ts-ignore
  const v1 = Constants?.expoConfig?.version ?? null;
  // manifest2 extra fallback
  // @ts-ignore
  const v2 = Constants?.manifest2?.extra?.version ?? null;
  return v1 || v2 || null;
}

/**
 * Push token kaydı / ilişkilendirme
 * - auth YOKSA: cihazı misafir olarak kaydeder (/notifications/devices/register)
 * - auth VARSA : cihazı kullanıcıya bağlar  (/notifications/devices/attach) + (opsiyonel /notifications/register)
 * Dönen: { expoToken, deviceId } | null
 */
export async function registerPushToken(): Promise<{ expoToken: string; deviceId: string } | null> {
  try {
    if (!Device.isDevice) return null;

    // Android kanal
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // İzin iste
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return null;

    // EAS projectId ile token
    // @ts-ignore
    const projectId =
      // @ts-ignore
      Constants?.easConfig?.projectId ||
      // @ts-ignore (expo run:* fallback)
      Constants?.expoConfig?.extra?.eas?.projectId;

    const expoToken = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : (await Notifications.getExpoPushTokenAsync()).data;

    if (!expoToken) return null;

    const deviceId = await getDeviceId();
    const appVersion = getAppVersion();
    const platform = Platform.OS;

    // Oturum var mı?
    const jwt = useAuth.getState().token;
    const authHeaders = jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : undefined;

    if (jwt) {
      // 1) Cihazı kullanıcıya bağla (yeni guest flow)
      await api.post(
        "/notifications/devices/attach",
        { deviceId, expoToken, platform, appVersion },
        authHeaders
      ).catch(() => {});

      // 2) Geriye dönük uyumluluk için kullanıcıya bağlı eski kayıt da açık kalsın:
      await api.post(
        "/notifications/register",
        { token: expoToken },
        authHeaders
      ).catch(() => {});
    } else {
      // Misafir cihaz kaydı (AUTH YOK)
      await api.post("/notifications/devices/register", {
        deviceId,
        expoToken,
        platform,
        appVersion,
      }).catch(() => {});
    }

    return { expoToken, deviceId };
  } catch (e: any) {
    Alert.alert("Push Kayıt Hatası", e?.message || "Bildirim kaydı yapılamadı.");
    return null;
  }
}

/**
 * Oturum açıldıktan sonra *sadece ilişkilendir* etmek istersen:
 * (Login sonrası çağırabilirsin; token zaten alınmışsa idempotent işler.)
 */
export async function attachDeviceAfterLogin() {
  try {
    const jwt = useAuth.getState().token;
    if (!jwt) return;

    const deviceId = await getDeviceId();

    // Elde var mı? Yoksa yeniden al (kullanıcıdan izin istemez)
    // Not: Expo SDK token zaten cache’ler; tekrar çağırmak güvenli
    // @ts-ignore
    const projectId =
      // @ts-ignore
      Constants?.easConfig?.projectId ||
      // @ts-ignore (expo run:* fallback)
      Constants?.expoConfig?.extra?.eas?.projectId;

    const expoToken = projectId
      ? (await Notifications.getExpoPushTokenAsync({ projectId })).data
      : (await Notifications.getExpoPushTokenAsync()).data;

    if (!expoToken) return;

    const authHeaders = { headers: { Authorization: `Bearer ${jwt}` } };
    await api.post(
      "/notifications/devices/attach",
      { deviceId, expoToken, platform: Platform.OS, appVersion: getAppVersion() },
      authHeaders
    ).catch(() => {});

    // Eski /register ucu:
    await api.post("/notifications/register", { token: expoToken }, authHeaders).catch(() => {});
  } catch {
    // sessiz geç
  }
}
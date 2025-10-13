// src/config/keys.ts
import Constants from "expo-constants";

function getExtra() {
  // EAS build / standalone
  // @ts-ignore
  const extra1 = Constants?.expoConfig?.extra;
  // Expo Go / dev
  // @ts-ignore
  const extra2 = Constants?.manifest?.extra;
  return { ...(extra1 || {}), ...(extra2 || {}) };
}

const extra = getExtra();

export const GOOGLE_ANDROID_CLIENT_ID =
  extra.googleClientIdAndroid || process.env.GOOGLE_CLIENT_ID_ANDROID;

export const GOOGLE_IOS_CLIENT_ID =
  extra.googleClientIdIos || process.env.GOOGLE_CLIENT_ID_IOS;

export const GOOGLE_WEB_CLIENT_ID =
  extra.googleClientIdWeb || process.env.GOOGLE_CLIENT_ID_WEB;
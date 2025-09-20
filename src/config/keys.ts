// src/config/keys.ts
import Constants from "expo-constants";

const extra = (Constants?.expoConfig as any)?.extra ?? {};

// Boş string fallback vererek tipleri net "string" yapıyoruz
export const GOOGLE_ANDROID_CLIENT_ID: string = extra.googleClientIdAndroid ?? "";
export const GOOGLE_IOS_CLIENT_ID: string     = extra.googleClientIdIos ?? "";
export const GOOGLE_WEB_CLIENT_ID: string     = extra.googleClientIdWeb ?? "";

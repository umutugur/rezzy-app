# UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header ekle, kullanıcı tema tercihi (AsyncStorage), dark mode hardcoded renk düzeltmeleri, delivery GPS fallback, harita commit.

**Architecture:** 4 bağımsız görev paralel subagent'lara dağıtılır. Her görev kendi commit'iyle kapanır. Tema sistemi: `useThemePreference` hook → `ThemeContext` provider'ı sarar → ProfileScreen'de UI. Delivery: backend `lat/lng` fallback + frontend GPS flow.

**Tech Stack:** React Native / Expo, TypeScript, AsyncStorage, Zustand, Express.js / Mongoose

---

## Dosya Haritası

| Dosya | İşlem | Görev |
|-------|-------|-------|
| `src/screens/HomeLandingScreen.tsx` | Modify | T1 |
| `src/components/AppHeaderTitle.tsx` | Modify | T1 |
| `src/hooks/useThemePreference.ts` | Create | T2 |
| `src/contexts/ThemeContext.tsx` | Modify | T2 |
| `src/screens/ProfileScreen.tsx` | Modify | T2 + T3 |
| `src/screens/DeliveryHomeScreen.tsx` | Modify | T4 |
| `rezzy-backend/src/controllers/deliveryController.js` | Modify | T4 |
| `CLAUDE.md` (repo root) | Modify | T5 |

---

## Task 1: HomeLandingScreen Header

**Files:**
- Modify: `src/screens/HomeLandingScreen.tsx`
- Modify: `src/components/AppHeaderTitle.tsx`

### Bağlam
`ExploreStack.Navigator`'da `headerShown: false` olduğundan `AppHeaderTitle` hiç render edilmiyor. Çözüm: bileşeni doğrudan `HomeLandingScreen` içine göm, navigator'a dokunma.

`AppHeaderTitle` şu anda `color: "#7B2C2C"` hardcoded — dark mode'da okunaksız.

- [ ] **Adım 1: AppHeaderTitle'da hardcoded rengi theme token'a çevir**

`src/components/AppHeaderTitle.tsx` dosyasının tamamını şu içerikle değiştir:

```tsx
import React from "react";
import { View, Image, Text, Platform } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function AppHeaderTitle() {
  const theme = useTheme();
  const logoSize = Platform.select({ ios: 40, android: 38, default: 38 });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <Image
        source={require("../assets/icon.png")}
        style={{ width: logoSize, height: logoSize, borderRadius: 8, marginRight: 10 }}
        resizeMode="contain"
      />
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: theme.colors.primary,
          letterSpacing: 0.5,
        }}
      >
        Rezvix
      </Text>
    </View>
  );
}
```

- [ ] **Adım 2: HomeLandingScreen'e AppHeaderTitle import'u ekle**

`src/screens/HomeLandingScreen.tsx` dosyasının import bloğuna ekle (mevcut importların altına):

```tsx
import AppHeaderTitle from "../components/AppHeaderTitle";
```

- [ ] **Adım 3: Header'ı return bloğuna ekle**

`HomeLandingScreen`'in return bloğunda `<SafeAreaView ...>` açıldıktan hemen sonra, `<ScrollView>` başlamadan önce şunu ekle:

```tsx
<SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["left", "right", "bottom"]}>
  {/* ─── App header ─────────────────────────────────────────── */}
  <View
    style={{
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderDefault,
      backgroundColor: theme.colors.background,
    }}
  >
    <AppHeaderTitle />
  </View>
  {/* ─── Mevcut ScrollView ──────────────────────────────────── */}
  <ScrollView ...>
```

> Not: Gerçek kodda mevcut `<ScrollView` satırını bul ve üstüne bu View bloğunu ekle. SafeAreaView etiketini değiştirme, sadece içine ekle.

- [ ] **Adım 4: Commit**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git add src/screens/HomeLandingScreen.tsx src/components/AppHeaderTitle.tsx
git commit -m "feat: HomeLandingScreen'e Rezvix header eklendi, AppHeaderTitle dark mode düzeltildi"
```

---

## Task 2: Tema Tercihi (useThemePreference + ThemeContext + ProfileScreen UI)

**Files:**
- Create: `src/hooks/useThemePreference.ts`
- Modify: `src/contexts/ThemeContext.tsx`
- Modify: `src/screens/ProfileScreen.tsx`

### Bağlam
`ThemeContext` şu anda `useColorScheme()` ile cihaz ayarını okuyor. Kullanıcı tercihini AsyncStorage'da saklayacağız. Varsayılan: `"light"` (sistem ayarından bağımsız).

AsyncStorage key: `"rezvix_theme_pref"` | Değerler: `"light" | "dark" | "system"`

- [ ] **Adım 1: useThemePreference hook'u oluştur**

`src/hooks/useThemePreference.ts` dosyasını oluştur:

```ts
import { useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rezvix_theme_pref';
const DEFAULT_PREF: ThemePref = 'light';

let _listeners: Array<(pref: ThemePref) => void> = [];
let _cached: ThemePref | null = null;

/** Global setter — ThemeContext dışından da çağrılabilir (ProfileScreen) */
export async function setThemePreference(pref: ThemePref): Promise<void> {
  _cached = pref;
  await AsyncStorage.setItem(STORAGE_KEY, pref);
  _listeners.forEach((fn) => fn(pref));
}

export function useThemePreference() {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePref>(_cached ?? DEFAULT_PREF);
  const [isHydrated, setIsHydrated] = useState(_cached !== null);

  // İlk yükleme: AsyncStorage'dan oku
  useEffect(() => {
    if (_cached !== null) return; // Zaten yüklendi
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      const pref = (val as ThemePref | null) ?? DEFAULT_PREF;
      _cached = pref;
      setPreference(pref);
      setIsHydrated(true);
    });
  }, []);

  // Global listener — başka yerden set edilince bu hook'lar güncellenir
  useEffect(() => {
    const fn = (pref: ThemePref) => setPreference(pref);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  }, []);

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system'
      ? (systemScheme ?? 'light')
      : preference;

  const set = useCallback(async (pref: ThemePref) => {
    await setThemePreference(pref);
  }, []);

  return { preference, setPreference: set, resolvedScheme, isHydrated };
}
```

- [ ] **Adım 2: ThemeContext'i useThemePreference'a bağla**

`src/contexts/ThemeContext.tsx` dosyasını şu şekilde güncelle:

```tsx
import React, {
  createContext,
  useContext,
  useMemo,
} from 'react';

import {
  lightColors,
  darkColors,
  brand,
  market,
  taxi,
  driver,
  semantic,
  type ColorTokens,
} from '../theme/colors';
import { typography, fontFamily, type TypographyScale } from '../theme/typography';
import { space, radius, lightElevation, darkElevation, getElevation } from '../theme/spacing';
import { duration, easing, spring } from '../theme/animation';
import { useThemePreference } from '../hooks/useThemePreference';

// ─── Theme shape ───────────────────────────────────────────────────────────────
export interface Theme {
  isDark: boolean;
  colors: ColorTokens;
  brand:    typeof brand;
  market:   typeof market;
  taxi:     typeof taxi;
  driver:   typeof driver;
  semantic: typeof semantic;
  typography: TypographyScale;
  fontFamily: typeof fontFamily;
  space:    typeof space;
  radius:   typeof radius;
  elevation: typeof lightElevation;
  getElevation: typeof getElevation;
  duration: typeof duration;
  easing:   typeof easing;
  spring:   typeof spring;
}

// ─── Context ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext<Theme | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedScheme } = useThemePreference();
  const isDark = resolvedScheme === 'dark';

  const theme = useMemo<Theme>(() => ({
    isDark,
    colors:      isDark ? darkColors  : lightColors,
    brand,
    market,
    taxi,
    driver,
    semantic,
    typography,
    fontFamily,
    space,
    radius,
    elevation:    isDark ? darkElevation : lightElevation,
    getElevation: (level, dark) => getElevation(level, dark ?? isDark),
    duration,
    easing,
    spring,
  }), [isDark]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
```

- [ ] **Adım 3: ProfileScreen'e tema import'larını ekle**

`src/screens/ProfileScreen.tsx` dosyasının import bloğuna ekle:

```tsx
import { useThemePreference, setThemePreference, type ThemePref } from "../hooks/useThemePreference";
```

- [ ] **Adım 4: ProfileScreen'de useThemePreference hook'unu çağır**

`ProfileScreen` ana fonksiyonunun en üstünde, diğer hook çağrılarının yanına ekle:

```tsx
const { preference: themePref } = useThemePreference();
```

- [ ] **Adım 5: ProfileScreen'de tema satırını ekle**

`ProfileScreen` içinde bölge ve dil satırlarının bulunduğu `AppPrefsRows` bileşenini bul. Mevcut bölge satırının **üstüne** tema satırını ekle:

```tsx
{/* Görünüm / Tema satırı */}
<View style={{
  backgroundColor: theme.colors.surface,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: theme.colors.borderDefault,
}}>
  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 13 }}>
    <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={themePref === 'dark' ? "moon-outline" : themePref === 'light' ? "sunny-outline" : "phone-portrait-outline"} size={18} color={theme.colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
        {t("profile.appPrefs.theme") || "GÖRÜNÜM"}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {(["light", "dark", "system"] as ThemePref[]).map((opt) => {
          const labels: Record<ThemePref, string> = { light: "☀️ Açık", dark: "🌙 Koyu", system: "📱 Sistem" };
          const active = themePref === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setThemePreference(opt)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: active ? theme.colors.primary : theme.colors.borderDefault,
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? theme.colors.textInverse : theme.colors.textSecondary }}>
                {labels[opt]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  </View>
</View>
```

> Not: `Pressable` zaten import edilmiş olmalı. Yoksa `TouchableOpacity` kullan.

- [ ] **Adım 6: Commit**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git add src/hooks/useThemePreference.ts src/contexts/ThemeContext.tsx src/screens/ProfileScreen.tsx
git commit -m "feat: kullanıcı tema tercihi — AsyncStorage, light/dark/system seçici"
```

---

## Task 3: Dark Mode Hardcoded Renk Düzeltmeleri

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

### Bağlam
ProfileScreen'de hardcoded light-only renkler dark modda okunaksız oluyor. Aşağıdaki değiştirmeleri yap.

- [ ] **Adım 1: ProfileScreen'de AppPrefsRows bileşeninin tamamını bul ve token'lara geç**

`AppPrefsRows` bileşeni içindeki tüm `Animated.View` bloklarında şu değiştirmeleri yap:

| Hardcoded | Değiştir |
|-----------|----------|
| `backgroundColor: "#FFFFFF"` (Animated outputRange) | `theme.colors.surface` |
| `backgroundColor: "#FFFBF9"` (Animated outputRange) | `theme.colors.surfaceAlt` |
| `backgroundColor: "#F0F0F0"` (borderBottomColor) | `theme.colors.borderDefault` |
| `backgroundColor: "#FFF0F0"` (bölge ikon bg) | `theme.colors.errorSoft` |
| `backgroundColor: "#EFF6FF"` (dil ikon bg) | `theme.colors.infoSoft` |
| `color: "#9CA3AF"` | `theme.colors.textSecondary` |
| `color: "#111827"` | `theme.colors.textPrimary` |
| `color: "#D1D5DB"` | `theme.colors.borderDefault` |

Mevcut Animated.View interpolasyon örneği:
```tsx
// ÖNCE:
backgroundColor: highlightAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ["#FFFFFF", "#FFFBF9"],
}) as any,
borderBottomColor: "#F0F0F0",

// SONRA:
backgroundColor: highlightAnim.interpolate({
  inputRange: [0, 1],
  outputRange: [theme.colors.surface, theme.colors.surfaceAlt],
}) as any,
borderBottomColor: theme.colors.borderDefault,
```

- [ ] **Adım 2: ProfileScreen ana wrapper ve selector modal renkleri düzelt**

Dosyada şu değiştirmeleri yap:

```tsx
// ÖNCE (satır ~734):
style={{ flex: 1, backgroundColor: "#F7F7F8" }}
// SONRA:
style={{ flex: 1, backgroundColor: theme.colors.background }}

// ÖNCE (satır ~973, ~1150 — selector modal):
backgroundColor: "#FFFFFF",
// SONRA:
backgroundColor: theme.colors.surface,

// ÖNCE (satır ~986 — drag handle):
backgroundColor: "#E5E7EB"
// SONRA:
backgroundColor: theme.colors.borderDefault

// ÖNCE (satır ~1002, ~1032):
color: "#111827"
// SONRA:
color: theme.colors.textPrimary

// ÖNCE (satır ~993):
backgroundColor: selectorOpen === "region" ? "#FFF0F0" : "#EFF6FF",
// SONRA:
backgroundColor: selectorOpen === "region" ? theme.colors.errorSoft : theme.colors.infoSoft,

// ÖNCE (satır ~1010):
backgroundColor: "#F7F7F8"
// SONRA:
backgroundColor: theme.colors.surfaceAlt

// ÖNCE (satır ~1028 — aktif seçim satırı):
backgroundColor: isActive ? "#FFF0F0" : "#FFFFFF"
// SONRA:
backgroundColor: isActive ? theme.colors.errorSoft : theme.colors.surface
```

- [ ] **Adım 3: Commit**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git add src/screens/ProfileScreen.tsx
git commit -m "fix: ProfileScreen dark mode — hardcoded renkler theme token'lara çevrildi"
```

---

## Task 4: Delivery GPS Fallback (Backend + Frontend)

**Files:**
- Modify: `rezzy-backend/src/controllers/deliveryController.js`
- Modify: `rezzy-app/src/screens/DeliveryHomeScreen.tsx`
- Modify: `rezzy-app/src/api/delivery.ts`

### Bağlam
`listDeliveryRestaurants` endpoint'i `addressId` zorunlu kılıyor. `selectedAddressId === null` olduğunda frontend erken çıkıyor → Android'de taze kurulumda restoranlar görünmüyor.

**Çözüm:** Backend `lat/lng` parametresini de kabul etsin. Frontend GPS varsa ve adres seçili değilse `lat/lng` ile çağır.

- [ ] **Adım 1: Backend — deliveryController.js'e lat/lng desteği ekle**

`/Users/umutugur/Dev/Rezvix/rezzy-backend/src/controllers/deliveryController.js` dosyasında `listDeliveryRestaurants` fonksiyonunu şu şekilde güncelle:

```js
export const listDeliveryRestaurants = async (req, res, next) => {
  try {
    assertAuth(req);

    const userId = req.user.id;
    const { addressId, lat, lng } = req.query;

    let userCoords;
    let addrMeta = null;

    if (addressId) {
      // Mevcut akış: kayıtlı adres
      const addr = await UserAddress.findOne({ _id: addressId, userId, isActive: true }).lean();
      if (!addr) throw { status: 404, message: "Address not found" };
      userCoords = addr?.location?.coordinates;
      if (!Array.isArray(userCoords) || userCoords.length !== 2) {
        throw { status: 400, message: "Address location is invalid" };
      }
      addrMeta = { id: String(addr._id), title: addr.title, coordinates: userCoords };
    } else if (lat && lng) {
      // GPS fallback: koordinat doğrudan verildi
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        throw { status: 400, message: "lat/lng geçersiz" };
      }
      userCoords = [lngNum, latNum]; // GeoJSON: [lng, lat]
      addrMeta = { id: null, title: "Mevcut Konum", coordinates: userCoords };
    } else {
      throw { status: 400, message: "addressId veya lat/lng gerekli" };
    }

    const maxRadius = Number(process.env.DELIVERY_MAX_RADIUS_METERS || DEFAULT_MAX_RADIUS_M);
    const maxRad = maxRadius / EARTH_RADIUS_M;

    const candidates = await Restaurant.find({
      isActive: true,
      status: "active",
      "delivery.enabled": true,
      location: { $geoWithin: { $centerSphere: [userCoords, maxRad] } },
    })
      .select("name city address phone email logoUrl photos rating priceRange businessType location delivery")
      .lean();

    const items = [];
    for (const r of candidates) {
      const center = r?.location?.coordinates;
      if (!Array.isArray(center) || center.length !== 2) continue;

      const out = await resolveZoneForRestaurant({
        restaurantId: String(r._id),
        customerLocation: userCoords,
      }).catch(() => null);

      if (!out?.ok) continue;

      items.push({
        ...r,
        deliveryFee: out.feeAmount,
        minOrderAmount: out.minOrderAmount,
        freeDeliveryThreshold: out.freeDeliveryThreshold,
        distanceM: Math.round(haversineMeters(userCoords, center)),
      });
    }

    items.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

    res.json({ items, address: addrMeta });
  } catch (e) {
    next(e);
  }
};
```

> Not: `DEFAULT_MAX_RADIUS_M`, `EARTH_RADIUS_M`, `haversineMeters`, `resolveZoneForRestaurant` dosyanın üstünde zaten tanımlı — dokunma.

- [ ] **Adım 2: Backend commit**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-backend
git add src/controllers/deliveryController.js
git commit -m "feat(delivery): lat/lng GPS fallback desteği — addressId opsiyonel"
```

- [ ] **Adım 3: Frontend — delivery.ts API fonksiyonunu güncelle**

`/Users/umutugur/Dev/Rezvix/rezzy-app/src/api/delivery.ts` dosyasında `listDeliveryRestaurants` fonksiyonunu güncelle:

```ts
export async function listDeliveryRestaurants(
  args: { addressId: string } | { lat: number; lng: number }
) {
  const params = "addressId" in args
    ? { addressId: args.addressId }
    : { lat: args.lat, lng: args.lng };
  const res = await api.get("/delivery/restaurants", { params });
  return res.data as { items: DeliveryRestaurant[]; address: any };
}
```

- [ ] **Adım 4: Frontend — DeliveryHomeScreen'e GPS fallback ekle**

`src/screens/DeliveryHomeScreen.tsx` dosyasında `load` callback'ini bul. `selectedAddressId` yokken GPS koordinatlarını kullan:

```ts
const load = React.useCallback(async (mode: "initial" | "update" = "update") => {
  if (!regionHydrated) return;

  // addressId veya GPS koordinatı gerekli
  const hasAddress = !!selectedAddressId;
  const hasGps = gpsCoords !== null;
  if (!hasAddress && !hasGps) return;

  const sig = JSON.stringify({ selectedAddressId, gpsCoords, mode });
  if (inflightRef.current && sig === lastSigRef.current) return;
  inflightRef.current = true;
  lastSigRef.current = sig;

  try {
    setError(null);
    if (mode === "initial") setInitialLoading(true); else setFetching(true);

    const args = hasAddress
      ? { addressId: selectedAddressId! }
      : { lat: gpsCoords!.lat, lng: gpsCoords!.lng };

    const resp = await listDeliveryRestaurants(args);
    const items = Array.isArray(resp?.items) ? resp.items : [];
    setData(items.filter((r) => r?.deliveryActive !== false));
  } catch (e: any) {
    setError(e?.response?.data?.message || e?.message || t("delivery.errorGeneric"));
    setData([]);
  } finally {
    inflightRef.current = false;
    if (mode === "initial") setInitialLoading(false);
    setFetching(false);
  }
}, [regionHydrated, selectedAddressId, gpsCoords]);
```

> Not: `gpsCoords` state değişkeni `DeliveryHomeScreen`'de zaten mevcut. Sadece `load` dependency array'ine ve arg'larına ekleniyor.

`useFocusEffect` ve useEffect trigger'larının da `gpsCoords`'u bağımlılık olarak içerdiğinden emin ol:

```ts
React.useEffect(() => {
  if (!regionHydrated || (!selectedAddressId && !gpsCoords)) return;
  load("initial");
}, [regionHydrated, selectedAddressId, gpsCoords]);
```

- [ ] **Adım 5: Frontend commit**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git add src/api/delivery.ts src/screens/DeliveryHomeScreen.tsx
git commit -m "fix(delivery): GPS fallback — adres seçilmeden restoran listesi yükleniyor"
```

---

## Task 5: Harita Değişikliği Commit + CLAUDE.md

**Files:**
- Harita değişiklikleri zaten yapıldı (T0 olarak kaydedildi)
- Modify: `/Users/umutugur/Dev/Rezvix/CLAUDE.md`

- [ ] **Adım 1: Harita commit durumunu kontrol et**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git status
git diff --name-only HEAD
```

Eğer `TaxiHomeScreen.tsx`, `TaxiMatchedScreen.tsx`, `TaxiDestinationScreen.tsx`, `app.json` uncommitted ise:

```bash
git add src/screens/taxi/TaxiHomeScreen.tsx \
        src/screens/taxi/TaxiMatchedScreen.tsx \
        src/screens/taxi/TaxiDestinationScreen.tsx \
        app.json
git commit -m "fix(map): PROVIDER_GOOGLE → OpenStreetMap UrlTile, Maps API key kaldırıldı"
```

- [ ] **Adım 2: CLAUDE.md'yi güncelle**

`/Users/umutugur/Dev/Rezvix/CLAUDE.md` dosyasında aşağıdaki güncellemeleri yap:

**"Tech Stack" tablosuna ekle:**
```markdown
| Harita | react-native-maps UrlTile (OpenStreetMap) — API key gerektirmez |
```

**"Platform Notları" bölümüne ekle:**
```markdown
- **Harita:** `PROVIDER_GOOGLE` kullanılmıyor. Tüm harita ekranlarında `UrlTile` + OpenStreetMap tile sunucusu (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) kullanılır. Google Maps API key gerekmez.
- **Tema Tercihi:** Kullanıcı tercihi `AsyncStorage` key'i `"rezvix_theme_pref"` içinde saklanır. `"light" | "dark" | "system"` — varsayılan `"light"`. `useThemePreference` hook'u ile erişilir, `ThemeContext` bu hook'u kullanır.
- **EAS Build:** `android/` ve `ios/` klasörleri `.gitignore`'da — EAS her build'de temiz `expo prebuild` çalıştırır.
```

**"Ekranlar" tablosuna ekle:**
```markdown
| `app/src/hooks/useThemePreference.ts` | Tema tercihi — AsyncStorage okuma/yazma + global listener |
```

**Android versionCode'u güncelle:**
```
versionCode: 28 (maps fix + prebuild temizliği)
```

- [ ] **Adım 3: CLAUDE.md commit**

```bash
cd /Users/umutugur/Dev/Rezvix
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — harita, tema, prebuild, versionCode güncellemeleri"
```

---

## Task 6: EAS Build

**Bağımlılık:** Task 1–5 tamamlanmış olmalı.

- [ ] **Adım 1: Son durumu kontrol et**

```bash
cd /Users/umutugur/Dev/Rezvix/rezzy-app
git log --oneline -6
git status
```

Her şey committed ve clean olmalı.

- [ ] **Adım 2: EAS preview build al**

```bash
eas build --platform android --profile preview --non-interactive
```

Build URL'ini kaydet. Tamamlandığında APK'yı indir ve şunları test et:
- HomeLandingScreen'de "Rezvix" yazısı görünüyor mu?
- Taksi ekranında harita yükleniyor mu?
- Profil ekranında tema seçici var mı?
- Paket servis ekranında adres olmadan GPS ile restoranlar yükleniyor mu?

---

## Spec Coverage Check

| Spec Maddesi | Task |
|-------------|------|
| HomeLandingScreen header | T1 |
| Tema seçimi (light/dark/system) | T2 |
| AsyncStorage tercih saklama | T2 |
| Varsayılan açık mod | T2 (`DEFAULT_PREF = 'light'`) |
| Dark mode hardcoded renkler | T3 |
| Delivery GPS fallback | T4 |
| Backend lat/lng desteği | T4 |
| Harita UrlTile | Zaten yapıldı → T5 commit |
| Prebuild fix | Zaten yapıldı → commit edildi |
| CLAUDE.md | T5 |
| EAS Build | T6 |

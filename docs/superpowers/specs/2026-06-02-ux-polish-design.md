# Rezvix UX Polish — Design Spec
**Tarih:** 2026-06-02  
**Kapsam:** Header, tema seçimi, dark mode düzeltmeleri, delivery fix, harita fix

---

## 1. HomeLandingScreen Header

**Sorun:** `ExploreStack.Navigator`'da `headerShown: false` olduğu için mevcut `AppHeaderTitle` bileşeni hiç render edilmiyor. Rezvix adı/logosu uygulama içinde görünmüyor.

**Çözüm:** `AppHeaderTitle`'ı navigator'a değil, doğrudan `HomeLandingScreen`'in en üstüne göm. Navigator'a dokunmaya gerek yok.

**Uygulama:**
- `HomeLandingScreen` return bloğunun en üstüne, SafeAreaView içinde, mevcut `_HomeHeader`'ın üstüne `<AppHeaderTitle />` ekle.
- `AppHeaderTitle` içindeki `color: "#7B2C2C"` → `theme.colors.primary` olarak güncelle (dark mode uyumu için).

---

## 2. Tema Seçimi (Kullanıcı Tercihi)

**Sorun:** `ThemeContext` sadece `useColorScheme()` okuyor — kullanıcı tercih belirleyemiyor. Varsayılan sistem ayarına göre açılıyor.

**İstekler:**
- Üç seçenek: Açık mod / Koyu mod / Sistem varsayılanı
- AsyncStorage'da sakla (`@react-native-async-storage/async-storage` zaten yüklü)
- Varsayılan: **Açık mod** (light) — sistem ayarından bağımsız

**Mimari:**

```
AsyncStorage key: "rezvix_theme_pref"
Değerler: "light" | "dark" | "system"
Varsayılan (key yoksa): "light"
```

**Değişiklikler:**

1. **`useThemePreference` hook** (yeni dosya: `src/hooks/useThemePreference.ts`)
   - AsyncStorage'dan tercihi oku/yaz
   - `{ preference, setPreference, resolvedScheme }` döner
   - `resolvedScheme`: "light" veya "dark" (system ise `useColorScheme()` kullan)

2. **`ThemeContext` güncelle**
   - `useColorScheme()` yerine `useThemePreference().resolvedScheme` kullan
   - AsyncStorage okuma async olduğu için `isHydrated` flag'i: false iken `<ActivityIndicator>` veya `null` döner (flash önlemek için)

3. **`ProfileScreen` — Tema satırı**
   - Mevcut ayarlar listesine "Görünüm" satırı ekle
   - 3 seçenekli bottom sheet veya inline toggle: ☀️ Açık / 🌙 Koyu / 📱 Sistem
   - Seçim anında theme değişsin

---

## 3. Dark Mode Düzeltmeleri

**Sorun:** Özellikle `ProfileScreen`'de hardcoded light-only renkler dark modda okunaksız oluyor.

**Tespit edilen sorunlu renkler:**
| Hardcoded | Doğru Token |
|-----------|-------------|
| `#111827` (çok koyu metin) | `theme.colors.textPrimary` |
| `#FFFFFF` (beyaz arka plan) | `theme.colors.surface` |
| `#F7F7F8` (açık gri bg) | `theme.colors.surfaceAlt` |
| `#EFF6FF` (mavi soft) | `theme.colors.infoSoft` |
| `#FFF0F0` (kırmızı soft) | `theme.colors.errorSoft` |
| `#9CA3AF` (gri text) | `theme.colors.textSecondary` |
| `#D1D5DB` (açık border) | `theme.colors.borderDefault` |
| `#6B7280` (ikincil metin) | `theme.colors.textTertiary` |

**Kapsam:** ProfileScreen tam tarama + DeliveryHomeScreen AddressSheet + HomeLandingScreen'de varsa.

**Yaklaşım:** `theme.colors.*` token'larına geç, brand gradient'lar (`#1A0610 → #8C244A`) korunur — bunlar kasıtlı brand rengi.

---

## 4. Delivery Restoranlar (Android Fix)

**Sorun:** `selectedAddressId === null` → `load()` erken çıkıyor → restoranlar listesi boş. Simulatörde önceki oturumdan persist edilmiş adres var, Android'de yok.

**Çözüm:**

Backend `/api/delivery/restaurants` endpoint'ini kontrol et — `addressId` yerine `lat/lng` de kabul edebiliyorsa GPS fallback ekle.

**Frontend akışı:**
```
DeliveryHomeScreen mount
  ├─ selectedAddressId var? → mevcut gibi API çağır
  └─ yoksa → GPS al
       ├─ GPS başarılı? → coords ile /delivery/restaurants?lat=&lng= çağır
       │   (backend destekliyorsa)
       └─ GPS yok? → "Konum seçin" prompt göster (mevcut davranış)
```

Backend `lat/lng` desteklemiyorsa: Koordinatlardan en yakın kayıtlı adresi bul ve onu `selectedAddressId` olarak set et (delivery store'a kaydet). Kullanıcı adres eklemeden listeyi görebilir.

**Not:** Backend route `delivery.js`'i kontrol et, `lat/lng` desteği yoksa ekle.

---

## 5. Harita (UrlTile — Zaten Yapıldı)

`PROVIDER_GOOGLE` → `UrlTile` (OpenStreetMap) değişikliği 3 taksi ekranında uygulandı:
- `TaxiHomeScreen.tsx` ✅
- `TaxiMatchedScreen.tsx` ✅  
- `TaxiDestinationScreen.tsx` ✅
- `app.json`'dan `googleMaps.apiKey` kaldırıldı, `versionCode` 28'e çıkarıldı ✅

---

## 6. Prebuild Notu

`android/` ve `ios/` klasörleri zaten mevcut. EAS cloud build kendi prebuild sürecini çalıştırır — local klasörler cloud build'i etkilemez. Ancak local geliştirme tutarlılığı için `npx expo prebuild --clean` önerilir (build sonrası, commit öncesi).

---

## 7. Subagent Dağılımı

Token limitini aşmamak için bağımsız görevler paralel çalıştırılır:

| Agent | Görev | Bağımlılık |
|-------|-------|------------|
| Agent 1 | Header fix + AppHeaderTitle dark mode uyumu | Bağımsız |
| Agent 2 | `useThemePreference` hook + ThemeContext güncelleme + ProfileScreen UI | Bağımsız |
| Agent 3 | Dark mode hardcoded renk taraması ve düzeltmesi (ProfileScreen + DeliveryHomeScreen) | Bağımsız |
| Agent 4 | Delivery GPS fallback (frontend + backend) | Bağımsız |
| Son adım | EAS build + CLAUDE.md güncelleme | 1-4 tamamlandıktan sonra |

---

## 8. CLAUDE.md Güncellemeleri

Tamamlandığında şunlar eklenecek:
- `ThemeContext` mimari değişikliği (useThemePreference hook)
- Tema tercihi AsyncStorage key'i
- Dark mode token kuralı
- UrlTile (OpenStreetMap) harita notu
- versionCode: 28

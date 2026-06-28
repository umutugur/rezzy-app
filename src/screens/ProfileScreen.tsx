// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Modal,
  Platform,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CalendarDays,
  Heart,
  ShoppingBag,
  Settings2,
  Car,
} from "lucide-react-native";
import dayjs from "dayjs";
import { useAuth } from "../store/useAuth";
import { getMyReservations } from "../api/reservations";
import { getMe, patchMe, uploadAvatarRN, changePassword } from "../api/user";
import { checkinByQR, checkinManual } from "../api/restaurantTools";
import { useNavigation } from "@react-navigation/native";
import { listFavorites, removeFavorite, type FavoriteRestaurant } from "../api/favorites";
import { getMyDriverApplication, type DriverApplication } from "../api/driverApplication.api";
import { useRegion } from "../store/useRegion";
import { useI18n } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetStarted } from "../store/useGetStarted";
import { useTheme } from '../contexts/ThemeContext';
import { useThemePreference, setThemePreference, type ThemePref } from "../hooks/useThemePreference";

type RegionCode = "CY" | "UK";
type LangCode = "tr" | "en" | "ru" | "el";

const REGION_OPTIONS: { code: RegionCode; label: string; flag?: string }[] = [
  { code: "CY", label: "Kuzey Kıbrıs", flag: "🇨🇾" },
  { code: "UK", label: "Birleşik Krallık", flag: "🇬🇧" },
];

const LANGUAGE_OPTIONS: { code: LangCode; label: string }[] = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "el", label: "Ελληνικά" },
];

/** para formatı */
const Money = ({ n }: { n?: number }) => {
  const theme = useTheme();
  return (
    <Text style={{ fontWeight: "800", color: theme.colors.textPrimary }}>
      {n == null ? "₺0" : `₺${Number(n).toLocaleString("tr-TR")}`}
    </Text>
  );
};


export default function ProfileScreen() {
  const theme = useTheme();
  const { preference: themePref } = useThemePreference();
  const navigation = useNavigation<any>();
  const { user, updateUser, clear } = useAuth();
  const insets = useSafeAreaInsets();
  const { region, language, setRegion, setLanguage } = useRegion();
  const { t, language: i18nLanguage, locale } = useI18n();
  const openGetStarted = useGetStarted((s) => s.open);

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [prefs, setPrefs] = useState({
    push: user?.notificationPrefs?.push ?? true,
    sms: user?.notificationPrefs?.sms ?? false,
    email: user?.notificationPrefs?.email ?? false,
  });
  const [providers, setProviders] = useState<string[]>(user?.providers || []);
  const [resv, setResv] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [favs, setFavs] = useState<FavoriteRestaurant[]>([]);
  const [favBusyId, setFavBusyId] = useState<string | null>(null);

  // Sürücü başvurusu durumu (rozet için)
  const [driverApp, setDriverApp] = useState<DriverApplication | null>(null);
  const [driverAppLoaded, setDriverAppLoaded] = useState(false);

  // şifre alanları
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // QR modal (kamera)
  const [qrOpen, setQrOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // QR sonrası arrived modalı
  const [qrArrivedOpen, setQrArrivedOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState<any>(null);
  const [qrArrivedInput, setQrArrivedInput] = useState("");

  // Manuel check-in modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualRid, setManualRid] = useState("");
  const [manualArrived, setManualArrived] = useState("");

  // Mesaj modalı
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgKind, setMsgKind] = useState<"info" | "error" | "warn">("info");
  const [msgOnRetry, setMsgOnRetry] = useState<null | (() => void)>(null);
  const [msgRetryLabel, setMsgRetryLabel] = useState<string>(t("profile.modal.retry"));

  const [prefRegion, setPrefRegion] = useState<RegionCode>(
    user?.preferredRegion === "UK" || user?.preferredRegion === "CY"
      ? (user.preferredRegion as RegionCode)
      : (region as RegionCode)
  );
  const [prefLang, setPrefLang] = useState<LangCode>(() => {
    const uLang = user?.preferredLanguage;
    if (uLang && ["tr", "en", "ru", "el"].includes(uLang as string)) {
      return uLang as LangCode;
    }
    return language as LangCode;
  });

  const highlightAnim = useState(new Animated.Value(0))[0];
  const [selectorOpen, setSelectorOpen] = useState<null | "region" | "language">(null);
  const sheetAnim = useState(new Animated.Value(0))[0];
  const inputStyle = useInputStyle();

  // Scroll refs for quick-action navigation
  const scrollRef = useRef<ScrollView>(null);
  const favsSectionY = useRef<number>(0);
  const settingsSectionY = useRef<number>(0);

  const showMsg = (title: string, body?: string) => {
    setMsgKind("info");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(null);
    setMsgOpen(true);
  };
  const showError = (title: string, body?: string, onRetry?: () => void, retryLabel?: string) => {
    setMsgKind("error");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(onRetry || null);
    setMsgRetryLabel(retryLabel || t("profile.modal.retry"));
    setMsgOpen(true);
  };
  const showWarn = (title: string, body?: string) => {
    setMsgKind("warn");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(null);
    setMsgOpen(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        updateUser(me);
        setName(me.name || "");
        setEmail(me.email || "");
        setPhone(me.phone || "");
        setAvatarUrl(me.avatarUrl || null);
        setPrefs({
          push: me.notificationPrefs?.push ?? true,
          sms: me.notificationPrefs?.sms ?? false,
          email: me.notificationPrefs?.email ?? true,
        });
        setProviders(me.providers || []);
        if (me.preferredRegion === "CY" || me.preferredRegion === "UK") {
          setPrefRegion(me.preferredRegion);
          setRegion(me.preferredRegion);
        }
        if (me.preferredLanguage && ["tr", "en", "ru", "el"].includes(me.preferredLanguage as string)) {
          setPrefLang(me.preferredLanguage as LangCode);
          setLanguage(me.preferredLanguage as LangCode);
        }
      } catch {}
      try {
        const list = await getMyReservations();
        setResv(list);
      } catch {}
      try {
        if (user?.role === "customer") {
          const fl = await listFavorites();
          setFavs(fl || []);
        }
      } catch {}
      try {
        const app = await getMyDriverApplication();
        setDriverApp(app);
      } catch {}
      finally {
        setDriverAppLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    try {
      setLoading(true);

      const payload: any = {
        name: name?.trim() || undefined,
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        notificationPrefs: prefs,
        preferredRegion: prefRegion,
        preferredLanguage: prefLang,
      };

      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;

      const me = await patchMe(payload);
      updateUser(me);

      if (me.preferredRegion === "CY" || me.preferredRegion === "UK") {
        setPrefRegion(me.preferredRegion);
        setRegion(me.preferredRegion);
      }
      if (me.preferredLanguage && ["tr", "en", "ru", "el"].includes(me.preferredLanguage as string)) {
        setPrefLang(me.preferredLanguage as LangCode);
        setLanguage(me.preferredLanguage as LangCode);
      }

      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();

      showMsg(
        t("profile.toast.saveSuccessTitle"),
        t("profile.toast.saveSuccessBody")
      );
    } catch (e: any) {
      showError(
        t("profile.toast.saveErrorTitle"),
        e?.response?.data?.message ||
          e?.message ||
          t("profile.toast.saveErrorBody")
      );
    } finally {
      setLoading(false);
    }
  }

  async function onChangePassword() {
    try {
      if (!curPw || !newPw || !newPw2) {
        showWarn(
          t("profile.password.error.missingTitle"),
          t("profile.password.error.missingBody")
        );
        return;
      }
      if (newPw.length < 8) {
        showWarn(
          t("profile.password.error.weakTitle"),
          t("profile.password.error.weakBody")
        );
        return;
      }
      if (newPw !== newPw2) {
        showWarn(
          t("profile.password.error.mismatchTitle"),
          t("profile.password.error.mismatchBody")
        );
        return;
      }
      setPwLoading(true);
      await changePassword(curPw, newPw);
      setCurPw("");
      setNewPw("");
      setNewPw2("");
      showMsg(
        t("profile.password.successTitle"),
        t("profile.password.successBody")
      );
    } catch (e: any) {
      showError(
        t("profile.password.errorTitle"),
        e?.response?.data?.message ||
          e?.message ||
          t("profile.password.errorBody")
      );
    } finally {
      setPwLoading(false);
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    try {
      const url = await uploadAvatarRN({
        uri: a.uri,
        name: (a as any).fileName || "avatar.jpg",
        type: (a as any).mimeType || "image/jpeg",
      });
      setAvatarUrl(url);
      updateUser({ avatarUrl: url });
      showMsg(
        t("profile.avatar.successTitle"),
        t("profile.avatar.successBody")
      );
    } catch (e: any) {
      showError(
        t("common.error"),
        e?.response?.data?.message ||
          e?.message ||
          t("profile.avatar.errorBody")
      );
    }
  }

  // Bildirim tercihleri
  async function togglePushPref() {
    try {
      if (!prefs.push) {
        const current = await Notifications.getPermissionsAsync();
        let granted = current.status === "granted";
        if (!granted) {
          const req = await Notifications.requestPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted) {
          showWarn(
            t("profile.toast.pushPermissionTitle"),
            t("profile.toast.pushPermissionBody")
          );
          return;
        }
        setPrefs((p) => ({ ...p, push: true }));
        try {
          await patchMe({ notificationPrefs: { ...prefs, push: true } });
        } catch {}
      } else {
        setPrefs((p) => ({ ...p, push: false }));
        try {
          await patchMe({ notificationPrefs: { ...prefs, push: false } });
        } catch {}
      }
    } catch {
      showError(
        t("profile.toast.pushPrefErrorTitle"),
        t("profile.toast.pushPrefErrorBody")
      );
    }
  }

  // QR kamera izni
  async function ensureCam() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        showWarn(
          t("profile.toast.cameraPermissionTitle"),
          t("profile.toast.cameraPermissionBody")
        );
      }
    }
  }

  function ReservationMini({ it }: { it: any }) {
    const m = statusMeta(it.status);
    return (
      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: theme.colors.borderDefault, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "800", color: theme.colors.textPrimary }}>
            {t("profile.reservations.itemTitle", {
              date: dayjs(it.dateTimeUTC).format("DD MMM YYYY HH:mm"),
              count: it.partySize,
            })}
          </Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: m.bg }}>
            <Text style={{ color: m.fg, fontWeight: "800", fontSize: 12 }}>{m.label}</Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.textSecondary }}>
          {String(it?.restaurantId?.name || t("profile.reservations.fallbackRestaurant"))}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.colors.textSecondary }}>
            {t("profile.reservations.totalLabel")}
          </Text>
          <Money n={it.totalPrice} />
        </View>
      </View>
    );
  }

  function FavoriteRow({ it }: { it: FavoriteRestaurant }) {
    const thumb = it.photos?.[0];
    const busy = favBusyId === it._id;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderColor: theme.colors.borderDefault,
        }}
      >
        <Image
          source={thumb ? { uri: thumb } : require("../assets/restaurant-placeholder.png")}
          style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: theme.colors.surfaceAlt }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "800" }}>{it.name}</Text>
          <Text style={{ color: theme.colors.textSecondary }}>
            {[it.city, it.priceRange].filter(Boolean).join(" • ")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton
            title={busy ? "…" : t("profile.favorites.remove")}
            onPress={async () => {
              if (busy) return;
              try {
                setFavBusyId(it._id);
                setFavs((prev) => prev.filter((f) => f._id !== it._id));
                await removeFavorite(it._id);
              } catch (e: any) {
                setFavs((prev) =>
                  prev.some((f) => f._id === it._id) ? prev : [it, ...prev]
                );
                showError(
                  t("profile.toast.favoriteErrorTitle"),
                  e?.response?.data?.message ||
                    e?.message ||
                    t("profile.toast.favoriteErrorBody")
                );
              } finally {
                setFavBusyId(null);
              }
            }}
          />
          <PrimaryButton
            title={t("profile.favorites.go")}
            onPress={() => navigation.navigate("Restoran", { id: it._id })}
          />
        </View>
      </View>
    );
  }

  // ✅ Legacy role (user.role) artık her zaman "restaurant" olmayabilir.
  // Multi-organization yapıda restoran erişimini restaurantMemberships üzerinden de tanıyoruz.
  const restaurantMemberships = ((user as any)?.restaurantMemberships || []) as any[];
  const hasRestaurantMembership = Array.isArray(restaurantMemberships) && restaurantMemberships.length > 0;

  // Active restaurantId: legacy field -> membership.id -> membership.restaurantId fallback
  const activeRestaurantId: string | null =
    (user as any)?.restaurantId ||
    (restaurantMemberships?.[0]?.id ?? null) ||
    (restaurantMemberships?.[0]?.restaurantId ?? null);

  const isRestaurant = user?.role === "restaurant" || hasRestaurantMembership;
  const isAdmin = user?.role === "admin";
  const isDriver = !!(user as any)?.isDriver || (user as any)?.role === "driver";

  /** durum → {label,color} */
  const statusMeta = (s: string) => {
    switch (String(s)) {
      case "pending":
        return { label: t("profile.reservations.status.pending"), bg: theme.colors.warningSoft, fg: theme.colors.warning };
      case "confirmed":
        return { label: t("profile.reservations.status.confirmed"), bg: theme.colors.successSoft, fg: theme.colors.success };
      case "arrived":
        return { label: t("profile.reservations.status.arrived"), bg: theme.colors.infoSoft, fg: theme.colors.info };
      case "no_show":
        return { label: t("profile.reservations.status.noShow"), bg: theme.colors.errorSoft, fg: theme.colors.error };
      case "cancelled":
        return { label: t("profile.reservations.status.cancelled"), bg: theme.colors.surfaceAlt, fg: theme.colors.textSecondary };
      default:
        return { label: s, bg: theme.colors.surfaceAlt, fg: theme.colors.textPrimary };
    }
  };

  const counts = useMemo(() => {
    const c = { upcoming: 0, confirmed: 0, cancelled: 0, total: resv.length, spending: 0 };
    resv.forEach((r) => {
      if (r.status === "confirmed" || r.status === "pending") c.upcoming++;
      if (r.status === "confirmed") c.confirmed++;
      if (r.status === "cancelled") c.cancelled++;
      c.spending += Number(r.totalPrice || 0);
    });
    return c;
  }, [resv]);

  function logout() {
    Alert.alert(
      t("profile.logout"),
      t("profile.logoutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.ok"),
          style: "destructive",
          onPress: async () => {
            await clear();
            navigation.reset({ index: 0, routes: [{ name: "TabsGuest" }] });
          },
        },
      ]
    );
  }

  const currentRegionMeta =
    REGION_OPTIONS.find((r) => r.code === prefRegion) || REGION_OPTIONS[0];
  const currentLangMeta =
    LANGUAGE_OPTIONS.find((l) => l.code === prefLang) || LANGUAGE_OPTIONS[0];

  const openSelector = (kind: "region" | "language") => {
    setSelectorOpen(kind);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const closeSelector = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => setSelectorOpen(null));
  };

  const handleRegionSelect = (code: RegionCode) => {
    setPrefRegion(code);
    setRegion(code);
    // basit kural: ülkeye göre default dil
    if (code === "CY" && prefLang !== "tr") {
      setPrefLang("tr");
      setLanguage("tr");
    }
    if (code === "UK" && prefLang !== "en") {
      setPrefLang("en");
      setLanguage("en");
    }
  };

  const handleLangSelect = async (code: LangCode) => {
    const prev = prefLang;
    setPrefLang(code);
    setLanguage(code);
    try {
      await patchMe({ preferredLanguage: code });
      try {
        updateUser({ ...(user || {}), preferredLanguage: code } as any);
      } catch {}
    } catch (e: any) {
      setPrefLang(prev);
      setLanguage(prev);
      showError(
        t("common.error"),
        e?.response?.data?.message || e?.message || "Dil tercihi güncellenemedi."
      );
    }
  };

  const goTerms = () => navigation.navigate("Terms");
  const goPrivacy = () => navigation.navigate("Privacy");
  const goSupport = () => navigation.navigate("Help");
  const goContact = () => navigation.navigate("Contact");
  const goLicenses = () => navigation.navigate("Licenses");
  const goAbout = () => navigation.navigate("About");
  const goDelete = () => navigation.navigate("DeleteAccount");

  function AppPrefs() {
    return (
      <>
        {/* Görünüm / Tema satırı */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderDefault,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 13 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: theme.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
              <Ionicons
                name={themePref === 'dark' ? "moon-outline" : themePref === 'light' ? "sunny-outline" : "phone-portrait-outline"}
                size={18}
                color={theme.colors.primary}
              />
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
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: active ? theme.colors.primary : theme.colors.borderDefault,
                        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "700", color: active ? theme.colors.textInverse : theme.colors.textPrimary }}>
                        {labels[opt]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Bölge satırı */}
        <Animated.View style={{
          backgroundColor: highlightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.surface, theme.colors.surfaceAlt],
          }) as any,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderDefault,
        }}>
          <TouchableOpacity
            onPress={() => openSelector("region")}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 13 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: theme.colors.errorSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="earth-outline" size={18} color="#8B1A1A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
                {t("profile.appPrefs.region")}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.textPrimary }}>
                {currentRegionMeta.flag ? currentRegionMeta.flag + " " : ""}{currentRegionMeta.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.borderDefault} />
          </TouchableOpacity>
        </Animated.View>

        {/* Dil satırı */}
        <Animated.View style={{
          backgroundColor: highlightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.surface, theme.colors.surfaceAlt],
          }) as any,
        }}>
          <TouchableOpacity
            onPress={() => openSelector("language")}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 13 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: theme.colors.infoSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="language-outline" size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 }}>
                {t("profile.appPrefs.language")}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.colors.textPrimary }}>
                {currentLangMeta.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.borderDefault} />
          </TouchableOpacity>
        </Animated.View>
      </>
    );
  }

  // ─── Brand colour constant ───────────────────────────────────────────────────
  const BRAND = "#8B1A1A";

  // ─── Premium FavCard (horizontal scroll) ────────────────────────────────────
  function FavCard({ it }: { it: FavoriteRestaurant }) {
    const thumb = it.photos?.[0];
    const busy = favBusyId === it._id;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate("Restoran", { id: it._id })}
        style={ps.favCard}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={["#1A0610", "#8C244A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Remove button */}
        <TouchableOpacity
          style={ps.favCardRemove}
          activeOpacity={0.8}
          onPress={async () => {
            if (busy) return;
            try {
              setFavBusyId(it._id);
              setFavs((prev) => prev.filter((f) => f._id !== it._id));
              await removeFavorite(it._id);
            } catch (e: any) {
              setFavs((prev) =>
                prev.some((f) => f._id === it._id) ? prev : [it, ...prev]
              );
              showError(
                t("profile.toast.favoriteErrorTitle"),
                e?.response?.data?.message || e?.message || t("profile.toast.favoriteErrorBody")
              );
            } finally {
              setFavBusyId(null);
            }
          }}
        >
          <Heart size={14} color={busy ? "#aaa" : "white"} strokeWidth={2.5} fill={busy ? "transparent" : "white"} />
        </TouchableOpacity>
        {/* Info */}
        <View style={ps.favCardInfo}>
          <Text style={ps.favCardName} numberOfLines={1}>{it.name}</Text>
          {!!it.city && <Text style={ps.favCardCity} numberOfLines={1}>{it.city}</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingBottom: 40 }}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#1A0610", "#3D0A20", "#8C244A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[ps.header, { paddingTop: insets.top + 14 }]}
      >
        {/* Decorative orbs */}
        <View style={ps.orbTopRight} />
        <View style={ps.orbBottomLeft} />

        {/* Top bar */}
        <View style={ps.headerTopBar}>
          <Text style={ps.headerTitle}>{t("profile.title")}</Text>
          <TouchableOpacity onPress={logout} style={ps.logoutBtn} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
        </View>

        {/* Avatar + info */}
        <View style={ps.avatarRow}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={ps.avatarWrap}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require("../assets/avatar-placeholder.png")}
              style={ps.avatarImg}
            />
            <View style={ps.cameraBadge}>
              <Ionicons name="camera" size={11} color="#1A0610" />
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ps.avatarName}>{name || t("profile.unnamed")}</Text>
            <Text style={ps.avatarEmail}>{user?.email || user?.phone || "—"}</Text>
            <View style={ps.roleBadge}>
              <Text style={ps.roleBadgeText}>
                ★{"  "}
                {user?.role === "customer"
                  ? t("profile.role.customer")
                  : user?.role === "restaurant"
                  ? t("profile.role.restaurant")
                  : t("profile.role.admin")}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats row — customer only */}
        {user?.role === "customer" && (
          <View style={ps.statsRow}>
            <View style={ps.statCell}>
              <Text style={ps.statValue}>{counts.upcoming}</Text>
              <Text style={ps.statLabel}>{t("profile.stats.upcoming")}</Text>
            </View>
            <View style={ps.statCell}>
              <Text style={ps.statValue}>{counts.confirmed}</Text>
              <Text style={ps.statLabel}>{t("profile.stats.confirmed")}</Text>
            </View>
            <View style={ps.statCell}>
              <Text style={ps.statValue}>{counts.cancelled}</Text>
              <Text style={ps.statLabel}>{t("profile.stats.cancelled")}</Text>
            </View>
            <View style={[ps.statCell, ps.statCellLast]}>
              <Text style={[ps.statValue, ps.statValueGold]}>
                ₺{counts.spending > 0 ? Number(counts.spending).toLocaleString("tr-TR") : "0"}
              </Text>
              <Text style={ps.statLabel}>{t("profile.stats.spending")}</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── QUICK ACTIONS ────────────────────────────────────────────── */}
      {user?.role === "customer" && (
        <View style={ps.quickActionsCard}>
          {([
            { Icon: CalendarDays, labelKey: "profile.quickAction.reservations", onPress: () => navigation.navigate("Rezervasyonlar") },
            { Icon: Heart,         labelKey: "profile.quickAction.favorites",    onPress: () => scrollRef.current?.scrollTo({ y: favsSectionY.current, animated: true }) },
            { Icon: ShoppingBag,   labelKey: "profile.quickAction.orders",       onPress: () => navigation.navigate("Siparişlerim") },
            { Icon: Settings2,     labelKey: "profile.quickAction.settings",     onPress: () => scrollRef.current?.scrollTo({ y: settingsSectionY.current, animated: true }) },
          ] as const).map(({ Icon, labelKey, onPress }) => (
            <TouchableOpacity key={labelKey} style={ps.quickTile} onPress={onPress} activeOpacity={0.7}>
              <Icon size={22} color={BRAND} strokeWidth={2} />
              <Text style={[ps.quickLabel, { color: theme.colors.textPrimary }]}>{t(labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── SPENDING CARD ────────────────────────────────────────────── */}
      {user?.role === "customer" && (
        <LinearGradient
          colors={["#1A0610", "#5C1530"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={ps.spendingCard}
        >
          <Text style={ps.spendingLabel}>{t("profile.spending.title")}</Text>
          <Text style={ps.spendingAmount}>
            ₺{counts.spending > 0 ? Number(counts.spending).toLocaleString("tr-TR") : "0"}
          </Text>
          <Text style={ps.spendingSub}>
            {t("profile.spending.sub", { count: resv.length })}
          </Text>
        </LinearGradient>
      )}

      {/* ── SON REZERVASYONLAR (preview) ─────────────────────────────── */}
      {user?.role === "customer" && resv.length > 0 && (
        <View style={[ps.recentSection, { backgroundColor: theme.colors.surface }]}>
          <View style={ps.recentHeader}>
            <Text style={[ps.recentTitle, { color: theme.colors.textPrimary }]}>{t("profile.section.recentReservations")}</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Rezervasyonlar")} activeOpacity={0.7}>
              <Text style={ps.recentSeeAll}>{t("profile.reservations.seeAll")}</Text>
            </TouchableOpacity>
          </View>
          {resv.slice(0, 2).map((it) => {
            const m = statusMeta(it.status);
            return (
              <View key={String(it._id)} style={ps.recentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[ps.recentRowName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                    {String(it?.restaurantId?.name || t("profile.reservations.fallbackRestaurant"))}
                  </Text>
                  <Text style={ps.recentRowSub}>
                    {t("profile.reservations.itemTitle", {
                      date: dayjs(it.dateTimeUTC).format("DD MMM YYYY HH:mm"),
                      count: it.partySize,
                    })}
                  </Text>
                </View>
                <View style={[ps.statusBadge, { backgroundColor: m.bg }]}>
                  <Text style={[ps.statusBadgeText, { color: m.fg }]}>{m.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── FAVORİLERİM (premium yatay scroll) ───────────────────────── */}
      {user?.role === "customer" && (
        <View
          style={ps.favSection}
          onLayout={(e) => { favsSectionY.current = e.nativeEvent.layout.y; }}
        >
          <View style={[ps.recentHeader, { paddingHorizontal: 16 }]}>
            <Text style={[ps.recentTitle, { color: theme.colors.textPrimary }]}>{t("profile.section.favorites")}</Text>
            {favs.length > 0 && (
              <Text style={ps.recentSub}>{favs.length}</Text>
            )}
          </View>
          {favs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 2 }}
            >
              {favs.map((it) => <FavCard key={it._id} it={it} />)}
            </ScrollView>
          ) : (
            <Text style={[ps.emptyText, { color: theme.colors.textSecondary }]}>{t("profile.favorites.empty")}</Text>
          )}
        </View>
      )}

      {/* ── PROFİL BİLGİLERİ ──────────────────────────────────────────── */}
      {user?.role === "customer" && (
        <View onLayout={(e) => { settingsSectionY.current = e.nativeEvent.layout.y; }}>

          <PremiumSection title={t("profile.section.profileInfo")}>
            <FieldRow label={t("profile.field.name")} value={name} onChangeText={setName} autoCapitalize="words" />
            <FieldRow label={t("profile.field.email")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <FieldRow label={t("profile.field.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" isLast />
          </PremiumSection>

          <PremiumSection title={t("profile.section.notificationPrefs")}>
            <PremiumToggleRow
              iconBg="#FFF0F0" iconColor="#8B1A1A"
              iconName="bell-outline"
              label={t("profile.notify.push")}
              value={!!prefs.push} onChange={togglePushPref}
            />
            <PremiumToggleRow
              iconBg="#F3F4F6" iconColor="#9CA3AF"
              iconName="message-outline"
              label={t("profile.notify.sms")}
              value={!!prefs.sms} onChange={() => {}} disabled
            />
            <PremiumToggleRow
              iconBg="#F3F4F6" iconColor="#9CA3AF"
              iconName="email-outline"
              label={t("profile.notify.email")}
              value={!!prefs.email} onChange={() => {}} disabled isLast
            />
          </PremiumSection>

          <PremiumSection title={t("profile.section.appPrefs")}>
            <AppPrefs />
          </PremiumSection>

          <View style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 4 }}>
            <GradientSaveButton
              loading={loading}
              title={loading ? t("common.saving") : t("common.save")}
              onPress={onSave}
            />
          </View>
        </View>
      )}
      {(isAdmin || isRestaurant) && (
        <PremiumSection title={t("profile.section.appPrefs")}>
          <AppPrefs />
        </PremiumSection>
      )}
     {/* Bölge / Dil seçim bottom sheet */}
      {selectorOpen && (
        <Modal
          visible={!!selectorOpen}
          transparent
          animationType="none"
          onRequestClose={closeSelector}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeSelector}
            style={{
              flex: 1,
              backgroundColor: theme.colors.overlay,
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                paddingBottom: (insets?.bottom || 0) + 16,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: theme.colors.surface,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -4 },
                elevation: 20,
                transform: [{
                  translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
                }],
              }}
            >
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderDefault }} />
              </View>

              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: selectorOpen === "region" ? theme.colors.errorSoft : theme.colors.infoSoft,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons
                    name={selectorOpen === "region" ? "earth-outline" : "language-outline"}
                    size={19}
                    color={selectorOpen === "region" ? "#8B1A1A" : "#1D4ED8"}
                  />
                </View>
                <Text style={{ fontSize: 17, fontWeight: "800", color: theme.colors.textPrimary }}>
                  {selectorOpen === "region"
                    ? t("profile.appPrefs.selectRegion")
                    : t("profile.appPrefs.selectLanguage")}
                </Text>
              </View>

              {/* Options */}
              <View style={{ marginHorizontal: 16, borderRadius: 16, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}>
                {(selectorOpen === "region" ? REGION_OPTIONS : LANGUAGE_OPTIONS).map((opt: any, idx: number, arr: any[]) => {
                  const code = opt.code as string;
                  const isActive = selectorOpen === "region" ? prefRegion === code : prefLang === code;
                  const label = selectorOpen === "region"
                    ? `${opt.flag ? opt.flag + "  " : ""}${opt.label}`
                    : opt.label;
                  const isLast = idx === arr.length - 1;
                  return (
                    <TouchableOpacity
                      key={code}
                      onPress={() => {
                        if (selectorOpen === "region") handleRegionSelect(code as RegionCode);
                        else handleLangSelect(code as LangCode);
                        closeSelector();
                      }}
                      activeOpacity={0.7}
                      style={[
                        { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: isActive ? theme.colors.errorSoft : theme.colors.surface },
                        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderDefault },
                      ]}
                    >
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: isActive ? "700" : "500", color: isActive ? "#8B1A1A" : theme.colors.textPrimary }}>
                        {label}
                      </Text>
                      {isActive && (
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#8B1A1A", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 16 }} />
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Şifre Değiştirme */}
      {providers?.includes("password") && (
        <>
          <PremiumSection title={t("profile.section.password")}>
            <FieldRow
              label={t("profile.password.current")}
              value={curPw} onChangeText={setCurPw}
              secureTextEntry={!showCur}
              showToggle onToggleShow={() => setShowCur((s) => !s)}
            />
            <FieldRow
              label={t("profile.password.new")}
              value={newPw} onChangeText={setNewPw}
              secureTextEntry={!showNew}
              showToggle onToggleShow={() => setShowNew((s) => !s)}
            />
            <FieldRow
              label={t("profile.password.newConfirm")}
              value={newPw2} onChangeText={setNewPw2}
              secureTextEntry={!showNew2}
              showToggle onToggleShow={() => setShowNew2((s) => !s)}
              isLast
            />
          </PremiumSection>
          <View style={{ paddingHorizontal: 16, marginTop: 4, marginBottom: 4 }}>
            <GradientSaveButton
              loading={pwLoading}
              title={pwLoading ? t("common.saving") : t("profile.password.update")}
              onPress={onChangePassword}
            />
          </View>
        </>
      )}


      {/* Yönetim Kısayolları */}
      {(isRestaurant || isAdmin) && (
        <PremiumSection title={t("profile.section.adminShortcuts")}>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {isRestaurant && (
              <PrimaryButton
                title={t("profile.shortcuts.restaurantPanel")}
                onPress={() => {
                  if (!activeRestaurantId) {
                    showError(
                      t("common.error"),
                      t("profile.toast.noRestaurantMembership") ||
                        "Bu kullanıcı için restoran erişimi bulunamadı. (restaurantId / restaurantMemberships boş)"
                    );
                    return;
                  }
                  navigation.navigate("RestaurantPanel", {
                    screen: "RestaurantHub",
                    params: { restaurantId: activeRestaurantId },
                  });
                }}
              />
            )}
            {isAdmin && (
              <PrimaryButton
                title={t("profile.shortcuts.adminPanel")}
                onPress={() => navigation.navigate("AdminPanel")}
              />
            )}

            {isRestaurant && (
              <>
                <PrimaryButton
                  title={t("profile.shortcuts.scanQR")}
                  onPress={async () => {
                    await ensureCam();
                    setQrOpen(true);
                  }}
                />
                <SecondaryButton
                  title={t("profile.shortcuts.manualCheckin")}
                  onPress={() => {
                    setManualRid("");
                    setManualArrived("");
                    setManualOpen(true);
                  }}
                />
              </>
            )}
          </View>
        </PremiumSection>
      )}

      {/* ── SÜRÜCÜ HESABI — sadece sürücü rolüne sahip kullanıcılara göster ── */}
      {isDriver && (
        <PremiumSection title={t("profile.section.driverAccount") || "Sürücü Hesabı"}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Driver")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: theme.taxi.light,
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Car size={20} color={theme.taxi.main} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: theme.taxi.main }}>
                {t("profile.driver.switchAccount") || "Sürücü Hesabına Geç"}
              </Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                {t("profile.driver.switchAccountSub") || "Taksi sürücüsü ekranlarına geç"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.taxi.main} />
          </TouchableOpacity>
        </PremiumSection>
      )}

      {/* Kuponlarım */}
      {user?.role === "customer" && (
        <PremiumSection title={t("promotions.title")}>
          <ListRow
            icon="ticket-percent-outline"
            label={t("promotions.myCoupons")}
            onPress={() => navigation.navigate("Market", { screen: "MarketMyCoupons" })}
            isLast
          />
        </PremiumSection>
      )}

      {/* Yasal & Destek */}
      <PremiumSection title={t("profile.section.legalSupport")}>
        <ListRow icon="file-document-outline"  label={t("profile.legal.terms")}         onPress={goTerms} />
        <ListRow icon="shield-lock-outline"    label={t("profile.legal.privacy")}       onPress={goPrivacy} />
        <ListRow icon="book-open-variant"      label={t("profile.legal.howToUse")}      onPress={openGetStarted} />
        <ListRow icon="lifebuoy"               label={t("profile.legal.help")}          onPress={goSupport} />
        <ListRow icon="email-outline"          label={t("profile.legal.contact")}       onPress={goContact} />
        <ListRow icon="certificate-outline"    label={t("profile.legal.licenses")}      onPress={goLicenses} />
        <ListRow icon="information-outline"    label={t("profile.legal.about")}         onPress={goAbout} />
        <ListRow icon="trash-can-outline"      label={t("profile.legal.deleteAccount")} onPress={goDelete} destructive isLast />
      </PremiumSection>

      {/* ── İŞ ORTAĞI OL (yasal & destek sonrası, parlatılmış CTA) ─────────── */}
      <PremiumSection title={t("partner.profileSection") || "İş Ortağı"}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("PartnerHub")}
          style={{
            marginHorizontal: 12,
            marginTop: 2,
            marginBottom: 6,
            borderRadius: 16,
            overflow: "hidden",
            backgroundColor: theme.colors.errorSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: theme.colors.primary,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }}
          >
            <Ionicons name="briefcase" size={22} color={theme.colors.textInverse} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15.5, fontWeight: "800", color: theme.colors.textPrimary, letterSpacing: 0.2 }}>
              {t("partner.profileRow") || "İş Ortağı Ol"}
            </Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 }}>
              {t("partner.profileRowSub") || "Sürücü, market veya restoran olarak Rezvix'te kazan"}
            </Text>
          </View>
          {(() => {
            const Arrow = (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: theme.colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textInverse} />
              </View>
            );
            if (!driverAppLoaded) return Arrow;
            const status = driverApp?.status ?? null;
            if (!status) return Arrow;
            const meta: Record<string, { bg: string; fg: string; key: string }> = {
              draft: { bg: theme.colors.surfaceAlt, fg: theme.colors.textSecondary, key: "partner.badge.draft" },
              pending: { bg: theme.colors.warningSoft, fg: theme.colors.warning, key: "partner.badge.pending" },
              approved: { bg: theme.colors.successSoft, fg: theme.colors.success, key: "partner.badge.approved" },
              rejected: { bg: theme.colors.errorSoft, fg: theme.colors.error, key: "partner.badge.rejected" },
            };
            const m = meta[status];
            if (!m) return Arrow;
            return (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: m.bg }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: m.fg }}>{t(m.key)}</Text>
              </View>
            );
          })()}
        </TouchableOpacity>
      </PremiumSection>

      {/* QR Kamera Modalı */}
      <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={async (ev: any) => {
              try {
                const data = ev?.data || "";
                setQrOpen(false);
                setQrPayload(data);
                setQrArrivedInput("");
                setQrArrivedOpen(true);
              } catch (e: any) {
                setQrOpen(false);
                showError(
                  t("profile.toast.invalidQRTitle"),
                  e?.response?.data?.message ||
                    e?.message ||
                    t("profile.toast.invalidQRBody"),
                  () => {
                    // tekrar tarama
                    setQrOpen(true);
                  },
                  t("profile.toast.qrRetryLabel")
                );
              }
            }}
          />
          <View style={{ position: "absolute", top: 40, left: 20 }}>
            <SecondaryButton
              title={t("profile.modal.close")}
              onPress={() => setQrOpen(false)}
            />
          </View>
        </View>
      </Modal>

      {/* QR sonrası Gelen Kişi Sayısı Modalı */}
      <Modal
        visible={qrArrivedOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrArrivedOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.borderDefault,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: theme.colors.textPrimary,
                marginBottom: 10,
              }}
            >
              {t("profile.qr.arrivedCountTitle")}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>
              {t("profile.qr.arrivedCountDescription")}
            </Text>
            <TextInput
              value={qrArrivedInput}
              onChangeText={setQrArrivedInput}
              placeholder={t("profile.qr.arrivedCountPlaceholder")}
              keyboardType={Platform.select({ ios: "number-pad", android: "numeric" }) as any}
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <SecondaryButton
                title={t("common.cancel")}
                onPress={() => setQrArrivedOpen(false)}
              />
              <PrimaryButton
                title={t("profile.modal.confirm")}
                onPress={async () => {
                  const n = Number(qrArrivedInput.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    showWarn(
                      t("profile.toast.invalidNumberTitle"),
                      t("profile.toast.invalidNumberBody")
                    );
                    return;
                  }
                  try {
                    await checkinByQR(qrPayload, n);
                    setQrArrivedOpen(false);
                    setQrPayload(null);
                    setQrArrivedInput("");
                    showMsg(
                      t("profile.toast.checkinSuccessTitle"),
                      t("profile.toast.checkinSuccessBody")
                    );
                  } catch (e: any) {
                    showError(
                      t("profile.toast.checkinFailedTitle"),
                      e?.response?.data?.message ||
                        e?.message ||
                        t("profile.toast.checkinFailedBody")
                    );
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Manuel Check-in Modal (arrived zorunlu) */}
      <Modal
        visible={manualOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManualOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: theme.colors.borderDefault,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: theme.colors.textPrimary,
                marginBottom: 10,
              }}
            >
              {t("profile.checkin.manualTitle")}
            </Text>
            <Text style={{ color: "#6B7280", marginBottom: 6, fontWeight: "600" }}>{t("profile.checkin.ridLabel")}</Text>
            <TextInput
              value={manualRid}
              onChangeText={setManualRid}
              placeholder={t("profile.checkin.ridPlaceholder")}
              autoCapitalize="none"
              style={inputStyle}
            />
            <Text style={{ color: "#6B7280", marginBottom: 6, fontWeight: "600", marginTop: 8 }}>{t("profile.checkin.arrivedLabel")}</Text>
            <TextInput
              value={manualArrived}
              onChangeText={setManualArrived}
              placeholder={t("profile.checkin.arrivedPlaceholder")}
              keyboardType={Platform.select({ ios: "number-pad", android: "numeric" }) as any}
              style={inputStyle}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <SecondaryButton
                title={t("common.cancel")}
                onPress={() => setManualOpen(false)}
              />
              <PrimaryButton
                title={t("profile.checkin.submit")}
                onPress={async () => {
                  if (!manualRid.trim()) {
                    showWarn(
                      t("profile.toast.ridRequiredTitle"),
                      t("profile.toast.ridRequiredBody")
                    );
                    return;
                  }
                  const n = Number(manualArrived.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    showWarn(
                      t("profile.toast.invalidNumberTitle"),
                      t("profile.toast.invalidNumberBody")
                    );
                    return;
                  }
                  try {
                    await checkinManual(String(manualRid.trim()), n);
                    setManualOpen(false);
                    showMsg(
                      t("profile.toast.checkinSuccessTitle"),
                      t("profile.toast.checkinSuccessBody")
                    );
                  } catch (e: any) {
                    showError(
                      t("profile.toast.checkinManualFailedTitle"),
                      e?.response?.data?.message ||
                        e?.message ||
                        t("profile.toast.checkinManualFailedBody")
                    );
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Mesaj Modalı */}
      <Modal
        visible={msgOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMsgOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor:
                msgKind === "error"
                  ? theme.colors.errorSoft
                  : msgKind === "warn"
                  ? theme.colors.warningSoft
                  : theme.colors.borderDefault,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color:
                  msgKind === "error"
                    ? theme.colors.error
                    : msgKind === "warn"
                    ? theme.colors.warning
                    : theme.colors.textPrimary,
                marginBottom: 8,
              }}
            >
              {msgTitle ||
                (msgKind === "error"
                  ? t("common.error")
                  : msgKind === "warn"
                  ? t("common.warning")
                  : t("common.info"))}
            </Text>
            {!!msgBody && (
              <Text
                style={{
                  color: theme.colors.textSecondary,
                  marginBottom: 12,
                }}
              >
                {msgBody}
              </Text>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <SecondaryButton
                title={t("profile.modal.close")}
                onPress={() => setMsgOpen(false)}
              />
              {msgOnRetry ? (
                <PrimaryButton
                  title={msgRetryLabel || t("profile.modal.retry")}
                  onPress={() => {
                    const cb = msgOnRetry;
                    setMsgOpen(false);
                    setMsgOnRetry(null);
                    if (cb) cb();
                  }}
                />
              ) : (
                <PrimaryButton
                  title={t("profile.modal.confirm")}
                  onPress={() => setMsgOpen(false)}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/** ------ Premium profile styles ------ */
const ps = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    position: "relative",
    overflow: "hidden",
  },
  orbTopRight: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,193,7,0.07)",
  },
  orbBottomLeft: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(140,36,74,0.3)",
  },
  headerTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  // Avatar
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 3,
    borderColor: "rgba(255,193,7,0.45)",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFC107",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1A0610",
  },
  avatarName: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  avatarEmail: { color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,193,7,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,193,7,0.35)",
  },
  roleBadgeText: { color: "#FFC107", fontSize: 11, fontWeight: "700" },
  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  statCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  statCellLast: {
    borderColor: "rgba(255,193,7,0.25)",
    backgroundColor: "rgba(255,193,7,0.08)",
  },
  statValue: { color: "white", fontSize: 20, fontWeight: "900" },
  statValueGold: { color: "#FFC107" },
  statLabel: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  // Quick actions
  quickActionsCard: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  quickTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(139,26,26,0.28)",
    gap: 7,
    backgroundColor: "white",
  },
  quickLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  // Spending card
  spendingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
  },
  spendingLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  spendingAmount: {
    color: "#FFC107",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  spendingSub: { color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 6 },
  // Recent reservations
  recentSection: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recentTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  recentSeeAll: { fontSize: 12, fontWeight: "600", color: "#8B1A1A" },
  recentSub: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#F3F4F6",
    gap: 10,
  },
  recentRowName: { fontSize: 13, fontWeight: "800", color: "#111827" },
  recentRowSub: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  // Favorites section
  favSection: {
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  favSectionHeader: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyText: { color: "#9CA3AF", paddingHorizontal: 16 },
  // FavCard
  favCard: {
    width: 140,
    height: 110,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  favCardRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  favCardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
  },
  favCardName: { color: "white", fontSize: 12, fontWeight: "800" },
  favCardCity: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 2 },
});

/** ------ Premium UI bileşenleri ------ */

// ─── Section wrapper ──────────────────────────────────────────────────────────
function PremiumSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: 22, marginHorizontal: 16 }}>
      {/* Label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <View style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: "#8B1A1A" }} />
        <Text style={{
          fontSize: 11, fontWeight: "700", color: "#8B1A1A",
          letterSpacing: 0.7, textTransform: "uppercase",
        }}>
          {title}
        </Text>
      </View>
      {/* Card */}
      <View style={{
        backgroundColor: theme.colors.surface, borderRadius: 16, overflow: "hidden",
        shadowColor: "#8B1A1A", shadowOpacity: 0.08, shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 }, elevation: 3,
      }}>
        {children}
      </View>
    </View>
  );
}

// ─── Editable field row (replaces Label + TextInput) ─────────────────────────
function FieldRow({
  label, value, onChangeText,
  keyboardType, autoCapitalize,
  secureTextEntry, showToggle, onToggleShow,
  isLast,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: any; autoCapitalize?: any;
  secureTextEntry?: boolean; showToggle?: boolean; onToggleShow?: () => void;
  isLast?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[
      { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 10 },
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderDefault },
      focused && { backgroundColor: theme.colors.surfaceAlt },
    ]}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: focused ? "#8B1A1A" : theme.colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={{ flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.textPrimary, padding: 0, margin: 0 }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || "none"}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={theme.colors.textTertiary}
        />
        {showToggle && (
          <TouchableOpacity onPress={onToggleShow} style={{ padding: 4 }}>
            <Ionicons name={secureTextEntry ? "eye-off-outline" : "eye-outline"} size={19} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      {focused && (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#8B1A1A", borderRadius: 2 }} />
      )}
    </View>
  );
}

// ─── Toggle row with icon (Bildirimler section) ───────────────────────────────
function PremiumToggleRow({
  iconName, iconBg, iconColor, label, value, onChange, disabled, isLast,
}: {
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  iconBg: string; iconColor: string;
  label: string; value: boolean; onChange: () => void;
  disabled?: boolean; isLast?: boolean;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onChange}
      activeOpacity={disabled ? 1 : 0.7}
      style={[
        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderDefault },
        disabled && { opacity: 0.4 },
      ]}
    >
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={iconName} size={17} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.textPrimary }}>{label}</Text>
      <View style={{
        width: 46, height: 27, borderRadius: 14,
        backgroundColor: value ? "#8B1A1A" : theme.colors.borderStrong,
        padding: 3, alignItems: value ? "flex-end" : "flex-start", justifyContent: "center",
      }}>
        <View style={{ width: 21, height: 21, borderRadius: 11, backgroundColor: theme.colors.surface,
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Full-width gradient save button ─────────────────────────────────────────
function GradientSaveButton({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={loading}>
      <LinearGradient
        colors={["#6E1515", "#8B1A1A"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ borderRadius: 14, paddingVertical: 14, alignItems: "center",
          shadowColor: "#8B1A1A", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 }}>
          {title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Legacy buttons (modals, shortcuts) ──────────────────────────────────────
function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{
      backgroundColor: theme.colors.primary, paddingVertical: 12,
      paddingHorizontal: 16, borderRadius: 12, alignItems: "center",
    }}>
      <Text style={{ color: theme.colors.textInverse, fontWeight: "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{
      backgroundColor: theme.colors.surfaceAlt, paddingVertical: 12,
      paddingHorizontal: 16, borderRadius: 12, alignItems: "center",
    }}>
      <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onChange}
      activeOpacity={disabled ? 1 : 0.7}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
    >
      <Text style={{ color: theme.colors.textPrimary }}>{label}</Text>
      <View
        style={{
          width: 52,
          height: 30,
          borderRadius: 999,
          backgroundColor: value ? theme.colors.success : theme.colors.borderDefault,
          padding: 4,
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.textInverse,
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.borderDefault,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          color: theme.colors.textSecondary,
          fontWeight: "600",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: 20,
          fontWeight: "800",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function useInputStyle() {
  const theme = useTheme();
  return {
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  };
}

// Icon accent palette for Yasal & Destek rows
const ROW_ACCENT: Record<string, { bg: string; color: string }> = {
  "file-document-outline": { bg: "#FFF7ED", color: "#C2410C" },
  "shield-lock-outline":   { bg: "#EFF6FF", color: "#1D4ED8" },
  "book-open-variant":     { bg: "#F0FDF4", color: "#15803D" },
  "lifebuoy":              { bg: "#FFF0F0", color: "#8B1A1A" },
  "email-outline":         { bg: "#FFF0F0", color: "#8B1A1A" },
  "certificate-outline":   { bg: "#FFFBEB", color: "#B45309" },
  "information-outline":   { bg: "#F5F3FF", color: "#6D28D9" },
  "ticket-percent-outline":{ bg: "#F0FDF4", color: "#15803D" },
  "trash-can-outline":     { bg: "#FEF2F2", color: "#DC2626" },
};

function ListRow({
  icon, label, destructive, onPress, isLast,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string; destructive?: boolean; onPress: () => void; isLast?: boolean;
}) {
  const theme = useTheme();
  const accent = ROW_ACCENT[icon as string] ?? { bg: theme.colors.surfaceAlt, color: theme.colors.textTertiary };
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 13, backgroundColor: theme.colors.surface },
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderDefault },
      ]}
    >
      <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: destructive ? "#FEF2F2" : accent.bg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon} size={18} color={destructive ? "#DC2626" : accent.color} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: destructive ? "#DC2626" : theme.colors.textPrimary }}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={destructive ? "#FCA5A5" : theme.colors.borderStrong} />
    </TouchableOpacity>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: active ? 0 : 1,
        borderColor: active ? "transparent" : theme.colors.borderDefault,
        backgroundColor: active ? theme.colors.primary : theme.colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text
        style={{
          color: active ? theme.colors.textInverse : theme.colors.textPrimary,
          fontWeight: active ? "700" : "500",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

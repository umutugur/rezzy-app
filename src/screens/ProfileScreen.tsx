// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
  Platform,
  Animated,
  Easing,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { lightTheme as T } from "../theme/theme";
import { useAuth } from "../store/useAuth";
import { getMyReservations } from "../api/reservations";
import { getMe, patchMe, uploadAvatarRN, changePassword } from "../api/user";
import { checkinByQR, checkinManual } from "../api/restaurantTools";
import { useNavigation } from "@react-navigation/native";
import { listFavorites, removeFavorite, type FavoriteRestaurant } from "../api/favorites";
import { useRegion } from "../store/useRegion";
import { useI18n } from "../i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetStarted } from "../store/useGetStarted";

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
const Money = ({ n }: { n?: number }) => (
  <Text style={{ fontWeight: "800", color: T.colors.text }}>
    {n == null ? "₺0" : `₺${Number(n).toLocaleString("tr-TR")}`}
  </Text>
);


export default function ProfileScreen() {
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
      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: T.colors.border, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "800", color: T.colors.text }}>
            {t("profile.reservations.itemTitle", {
              date: dayjs(it.dateTimeUTC).format("DD MMM YYYY HH:mm"),
              count: it.partySize,
            })}
          </Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: m.bg }}>
            <Text style={{ color: m.fg, fontWeight: "800", fontSize: 12 }}>{m.label}</Text>
          </View>
        </View>
        <Text style={{ color: T.colors.textSecondary }}>
          {String(it?.restaurantId?.name || t("profile.reservations.fallbackRestaurant"))}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: T.colors.textSecondary }}>
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
          borderColor: T.colors.border,
        }}
      >
        <Image
          source={thumb ? { uri: thumb } : require("../assets/restaurant-placeholder.png")}
          style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: T.colors.muted }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.colors.text, fontWeight: "800" }}>{it.name}</Text>
          <Text style={{ color: T.colors.textSecondary }}>
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

  /** durum → {label,color} */
  const statusMeta = (s: string) => {
    switch (String(s)) {
      case "pending":
        return { label: t("profile.reservations.status.pending"), bg: "#FEF3C7", fg: "#92400E" };
      case "confirmed":
        return { label: t("profile.reservations.status.confirmed"), bg: "#DCFCE7", fg: "#166534" };
      case "arrived":
        return { label: t("profile.reservations.status.arrived"), bg: "#DBEAFE", fg: "#1E40AF" };
      case "no_show":
        return { label: t("profile.reservations.status.noShow"), bg: "#FEE2E2", fg: "#991B1B" };
      case "cancelled":
        return { label: t("profile.reservations.status.cancelled"), bg: "#F3F4F6", fg: "#374151" };
      default:
        return { label: s, bg: "#EEE", fg: "#111" };
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
      <Animated.View
        style={{
          marginTop: 4,
          marginBottom: 10,
          padding: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: highlightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [T.colors.border, T.colors.primary],
          }),
          backgroundColor: highlightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ["#F9FAFB", "#FEF3F2"],
          }) as any,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        {/* Başlık */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(123,44,44,0.08)",
              marginRight: 8,
            }}
          >
            <Ionicons name="earth-outline" size={18} color={T.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: T.colors.text }}>
              {t("profile.appPrefs.title")}
            </Text>
            <Text style={{ fontSize: 12, color: T.colors.textSecondary }}>
              {t("profile.appPrefs.current")}: {currentRegionMeta.flag ? currentRegionMeta.flag + " " : ""}
              {currentRegionMeta.label} • {currentLangMeta.label}
            </Text>
          </View>
        </View>

        {/* Bölge satırı */}
        <TouchableOpacity
          onPress={() => openSelector("region")}
          activeOpacity={0.8}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: "column" }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: T.colors.textSecondary,
                marginBottom: 2,
              }}
            >
              {t("profile.appPrefs.region")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: T.colors.text,
              }}
            >
              {currentRegionMeta.flag ? currentRegionMeta.flag + " " : ""}
              {currentRegionMeta.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 11,
                color: T.colors.primary,
                fontWeight: "500",
              }}
            >
              {t("profile.appPrefs.seeAllRegions")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={T.colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Dil satırı */}
        <TouchableOpacity
          onPress={() => openSelector("language")}
          activeOpacity={0.8}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "column" }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: T.colors.textSecondary,
                marginBottom: 2,
              }}
            >
              {t("profile.appPrefs.language")}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: T.colors.text,
              }}
            >
              {currentLangMeta.label}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text
              style={{
                fontSize: 11,
                color: T.colors.primary,
                fontWeight: "500",
              }}
            >
              {t("profile.appPrefs.seeAllLanguages")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={T.colors.primary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 28 }}
      style={{ flex: 1, backgroundColor: T.colors.background }}
    >
      {/* Kapak */}
      <View
        style={{
          backgroundColor: T.colors.primary,
          paddingHorizontal: 16,
          paddingTop: 28,
          paddingBottom: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{t("profile.title")}</Text>
          <TouchableOpacity
            onPress={logout}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{t("profile.logout")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require("../assets/avatar-placeholder.png")}
              style={{
                width: 78,
                height: 78,
                borderRadius: 999,
                backgroundColor: "#ffffff22",
                borderWidth: 2,
                borderColor: "#ffffff55",
              }}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
              {name || "(İsimsiz)"}
            </Text>
            <Text style={{ color: "#fff", opacity: 0.9 }}>
              {user?.email || user?.phone || "-"}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {user?.role === "customer"
                  ? t("profile.role.customer")
                  : user?.role === "restaurant"
                  ? t("profile.role.restaurant")
                  : t("profile.role.admin")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stat kartları */}
      {user?.role === "customer" && (
        <View style={{ paddingHorizontal: 16, marginTop: 14, flexDirection: "row", gap: 10 }}>
          <StatCard title={t("profile.stats.upcoming")} value={String(counts.upcoming)} />
          <StatCard title={t("profile.stats.confirmed")} value={String(counts.confirmed)} />
          <StatCard title={t("profile.stats.cancelled")} value={String(counts.cancelled)} />
        </View>
      )}

      {/* Profil Bilgileri + Bildirim */}
      {user?.role === "customer" && (
        <Section title={t("profile.section.profileInfo")}>
          <Label>{t("profile.field.name")}</Label>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

          <Label>{t("profile.field.email")}</Label>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={inputStyle}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Label>{t("profile.field.phone")}</Label>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={inputStyle}
            keyboardType="phone-pad"
          />

          <Text
            style={{
              fontWeight: "800",
              fontSize: 16,
              marginTop: 12,
              color: T.colors.text,
            }}
          >
            {t("profile.section.notificationPrefs")}
          </Text>
          <Toggle
            label={t("profile.notify.push")}
            value={!!prefs.push}
            onChange={togglePushPref}
          />
          <Toggle
            label={t("profile.notify.sms")}
            value={!!prefs.sms}
            onChange={() => {}}
            disabled
          />
          <Toggle
            label={t("profile.notify.email")}
            value={!!prefs.email}
            onChange={() => {}}
            disabled
          />

          {/* Bölge & Dil Tercihi */}
          <Text
            style={{
              fontWeight: "800",
              fontSize: 16,
              marginTop: 16,
              marginBottom: 6,
              color: T.colors.text,
            }}
          >
            {t("profile.section.appPrefs")}
          </Text>
          <AppPrefs />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <PrimaryButton
              title={loading ? t("common.saving") : t("common.save")}
              onPress={onSave}
            />
          </View>
        </Section>
      )}
      {(isAdmin || isRestaurant) && (
        <Section title={t("profile.section.appPrefs")}>
          <AppPrefs />
        </Section>
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
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                paddingBottom: 24 + (insets?.bottom || 0),
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                backgroundColor: "#fff",
                transform: [
                  {
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  marginBottom: 10,
                  color: T.colors.text,
                }}
              >
                {selectorOpen === "region"
                  ? t("profile.appPrefs.selectRegion")
                  : t("profile.appPrefs.selectLanguage")}
              </Text>
              {(selectorOpen === "region"
                ? REGION_OPTIONS
                : LANGUAGE_OPTIONS
              ).map((opt: any) => {
                const code = opt.code as string;
                const isActive =
                  selectorOpen === "region"
                    ? prefRegion === code
                    : prefLang === code;
                const label =
                  selectorOpen === "region"
                    ? `${opt.flag ? opt.flag + " " : ""}${opt.label}`
                    : opt.label;
                return (
                  <TouchableOpacity
                    key={code}
                    onPress={() => {
                      if (selectorOpen === "region") {
                        handleRegionSelect(code as RegionCode);
                      } else {
                        handleLangSelect(code as LangCode);
                      }
                      closeSelector();
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      backgroundColor: isActive
                        ? "rgba(123,44,44,0.06)"
                        : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: T.colors.text,
                        fontWeight: isActive ? "700" : "500",
                      }}
                    >
                      {label}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={T.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Şifre Değiştirme */}
      {providers?.includes("password") && (
        <Section title={t("profile.section.password")}>
          {/* mevcut */}
          <Label>{t("profile.password.current")}</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              style={inputStyle}
              secureTextEntry={!showCur}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowCur((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons
                name={showCur ? "eye-off" : "eye"}
                size={20}
                color={T.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* yeni */}
          <Label>{t("profile.password.new")}</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              style={inputStyle}
              secureTextEntry={!showNew}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNew((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons
                name={showNew ? "eye-off" : "eye"}
                size={20}
                color={T.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* tekrar */}
          <Label>{t("profile.password.newConfirm")}</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={newPw2}
              onChangeText={setNewPw2}
              style={inputStyle}
              secureTextEntry={!showNew2}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNew2((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons
                name={showNew2 ? "eye-off" : "eye"}
                size={20}
                color={T.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton
              title={pwLoading ? t("common.saving") : t("profile.password.update")}
              onPress={onChangePassword}
            />
          </View>
        </Section>
      )}

      {/* Favorilerim */}
      {user?.role === "customer" && (
        <Section title={t("profile.section.favorites")}>
          {favs?.length ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text style={{ color: T.colors.textSecondary }}>{t("profile.favorites.total")}</Text>
                <Text
                  style={{ fontWeight: "700", color: T.colors.text }}
                >
                  {favs.length}
                </Text>
              </View>
              {favs.map((it) => (
                <FavoriteRow key={it._id} it={it} />
              ))}
            </>
          ) : (
            <Text style={{ color: T.colors.textSecondary }}>
              {t("profile.favorites.empty")}
            </Text>
          )}
        </Section>
      )}

      {/* Rezervasyonlarım */}
      {user?.role === "customer" && (
        <Section title={t("profile.section.reservations")}>
          {resv?.length ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: T.colors.textSecondary }}>{t("profile.reservations.total")}</Text>
                <Text
                  style={{ fontWeight: "700", color: T.colors.text }}
                >
                  {resv.length}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: T.colors.textSecondary }}>
                  {t("profile.reservations.totalSpent")}
                </Text>
                <Money n={counts.spending} />
              </View>
              {resv.map((it) => (
                <ReservationMini it={it} key={String(it._id)} />
              ))}
            </>
          ) : (
            <Text style={{ color: T.colors.textSecondary }}>
              {t("profile.reservations.empty")}
            </Text>
          )}
        </Section>
      )}

      {/* Yönetim Kısayolları */}
      {(isRestaurant || isAdmin) && (
        <Section title={t("profile.section.adminShortcuts")}>
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
        </Section>
      )}

      {/* Yasal & Destek */}
      <Section title={t("profile.section.legalSupport")}>
        <ListCard>
          <ListRow
            icon="file-document-outline"
            label={t("profile.legal.terms")}
            onPress={goTerms}
          />
          <Divider />
          <ListRow
            icon="shield-lock-outline"
            label={t("profile.legal.privacy")}
            onPress={goPrivacy}
          />
          <Divider />
          <ListRow
            icon="book-open-variant"
            label={t("profile.legal.howToUse")}
            onPress={openGetStarted}
          />
          <Divider />
          <ListRow
            icon="lifebuoy"
            label={t("profile.legal.help")}
            onPress={goSupport}
          />
          <Divider />
          <ListRow
            icon="email-outline"
            label={t("profile.legal.contact")}
            onPress={goContact}
          />
          <Divider />
          <ListRow
            icon="certificate-outline"
            label={t("profile.legal.licenses")}
            onPress={goLicenses}
          />
          <Divider />
          <ListRow
            icon="information-outline"
            label={t("profile.legal.about")}
            onPress={goAbout}
          />
          <Divider />
          <ListRow
            icon="trash-can-outline"
            label={t("profile.legal.deleteAccount")}
            destructive
            onPress={goDelete}
          />
        </ListCard>
      </Section>

      {/* Alt Çıkış */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 20 }}>
        <SecondaryButton title={t("profile.logout")} onPress={logout} />
      </View>


      {/* QR Kamera Modalı */}
      <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
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
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: T.colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: T.colors.text,
                marginBottom: 10,
              }}
            >
              {t("profile.qr.arrivedCountTitle")}
            </Text>
            <Text style={{ color: T.colors.textSecondary, marginBottom: 6 }}>
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
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: T.colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: T.colors.text,
                marginBottom: 10,
              }}
            >
              {t("profile.checkin.manualTitle")}
            </Text>
            <Label>{t("profile.checkin.ridLabel")}</Label>
            <TextInput
              value={manualRid}
              onChangeText={setManualRid}
              placeholder={t("profile.checkin.ridPlaceholder")}
              autoCapitalize="none"
              style={inputStyle}
            />
            <Label>{t("profile.checkin.arrivedLabel")}</Label>
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
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor:
                msgKind === "error"
                  ? "#FCA5A5"
                  : msgKind === "warn"
                  ? "#FDE68A"
                  : T.colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color:
                  msgKind === "error"
                    ? "#B91C1C"
                    : msgKind === "warn"
                    ? "#92400E"
                    : T.colors.text,
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
                  color: T.colors.textSecondary,
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

/** ------ küçük UI yardımcıları ------ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: T.colors.surface,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.colors.border,
        marginHorizontal: 16,
      }}
    >
      <Text
        style={{
          fontWeight: "800",
          fontSize: 18,
          marginBottom: 10,
          color: T.colors.text,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: T.colors.textSecondary,
        marginBottom: 6,
        fontWeight: "600",
      }}
    >
      {children}
    </Text>
  );
}

function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: T.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: T.colors.muted,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: T.colors.primary, fontWeight: "800" }}>
        {title}
      </Text>
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
      <Text style={{ color: T.colors.text }}>{label}</Text>
      <View
        style={{
          width: 52,
          height: 30,
          borderRadius: 999,
          backgroundColor: value ? T.colors.success : T.colors.border,
          padding: 4,
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#fff",
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: T.colors.border,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          color: T.colors.textSecondary,
          fontWeight: "600",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: T.colors.text,
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

const inputStyle = {
  borderWidth: 1,
  borderColor: T.colors.border,
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 10,
  backgroundColor: "#fff",
  color: T.colors.text,
} as const;

function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.colors.border,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: "#EFEFEF" }} />;
}

function ListRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: "#fff",
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={destructive ? "#C0392B" : "#6B7280"}
          style={{ width: 24 }}
        />
        <Text
          style={{
            flex: 1,
            color: destructive ? "#C0392B" : T.colors.text,
            fontWeight: destructive ? "800" : "600",
          }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
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
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: active ? 0 : 1,
        borderColor: active ? "transparent" : "#E5E7EB",
        backgroundColor: active ? T.colors.primary : "#fff",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : T.colors.text,
          fontWeight: active ? "700" : "500",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

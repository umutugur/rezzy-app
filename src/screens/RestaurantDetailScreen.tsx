// src/screens/RestaurantDetailScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Pressable,
  Animated,
  Modal,
  Linking,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { isPast } from "../utils/format";
import { useNotifications } from "../store/useNotifications";
import {
  getRestaurant,
  getAvailability,
  type Restaurant as ApiRestaurant,
  type AvailabilitySlot,
} from "../api/restaurants";
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  isFavorited,
  type FavoriteRestaurant,
} from "../api/favorites";
import { useReservation } from "../store/useReservation";
import { useAuth } from "../store/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "../i18n";
import { type MenuCategory, type MenuItem as ALaCarteItem } from "../api/menu";
import { rpGetPublicResolvedMenu } from "../api/menuResolved";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PADDING = 16;
const PHOTO_W = SCREEN_W;
const PHOTO_H = Math.round((SCREEN_W * 9) / 16);

type FixMenu = {
  _id?: string;
  title: string;
  description?: string;
  pricePerPerson: number;
  isActive?: boolean;
};

type Restaurant = ApiRestaurant & {
  menus?: FixMenu[]; // mevcut fix menüler
  // ileride normal menü gelince burada a-la-carte yapıyı da taşıyacağız
  // aLaCarteMenus?: ...
};

type ALaCarteCategory = MenuCategory;
type ALaCarteItemsByCat = Record<string, ALaCarteItem[]>;

export default function RestaurantDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const restaurantId: string = route.params?.id ?? route.params?.restaurantId ?? "";

  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const setIntended = useAuth((s) => s.setIntended);
  const { t, language, locale: hookLocale } = useI18n();
  const locale = language ?? hookLocale ?? "tr";

  // i18n key yoksa fallback verelim
  const tt = React.useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key);
        return v === key ? fallback : v;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const setRestaurant = useReservation?.((s: any) => s.setRestaurant) ?? (() => {});
  const setDateTime = useReservation?.((s: any) => s.setDateTime) ?? (() => {});
  const setParty = useReservation?.((s: any) => s.setParty) ?? (() => {});

  const [loading, setLoading] = useState(true);
  const [r, setR] = useState<Restaurant | null>(null);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  // Tabs artık sadece HAKKINDA / MENÜ
  const [activeTab, setActiveTab] = useState<"ABOUT" | "MENU">("ABOUT");
  // --- A-la-carte menü (kategori + ürün) ---
  const [menuCats, setMenuCats] = useState<ALaCarteCategory[]>([]);
  const [menuItemsByCat, setMenuItemsByCat] = useState<ALaCarteItemsByCat>({});
  const [menuLoading, setMenuLoading] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandAllMenuCats, setExpandAllMenuCats] = useState(false);
  const [previewItem, setPreviewItem] = useState<ALaCarteItem | null>(null);

  const [activePhoto, setActivePhoto] = useState(0);
  const photosListRef = useRef<FlatList<string>>(null);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const dayLabel = dayjs(date).format("DD MMM");

  const [favLoading, setFavLoading] = useState<boolean>(false);
  const [favs, setFavs] = useState<FavoriteRestaurant[]>([]);

  // --- Photos, Menus ---
  const photos = useMemo(() => (r?.photos || []).filter(Boolean), [r]);
  const menus = useMemo(
    () => (r?.menus || []).filter((m) => m && (m.isActive ?? true)),
    [r]
  );

  const loadALaCarteMenu = React.useCallback(async () => {
    if (!restaurantId) return;
    setMenuLoading(true);

    try {
      const resolved = await rpGetPublicResolvedMenu(restaurantId);

      const catsRaw = Array.isArray((resolved as any)?.categories)
        ? (resolved as any).categories
        : [];

      const byCat: ALaCarteItemsByCat = {};
      const cats: ALaCarteCategory[] = [];

      const pickCatId = (c: any) => String(c?._id || c?.id || c?.orgCategoryId || "");
      const pickItemId = (it: any) => String(it?._id || it?.id || it?.orgItemId || "");

      for (const c of catsRaw) {
        const catId = pickCatId(c);
        const itemsRaw = Array.isArray(c?.items) ? c.items : [];
        const activeItems = itemsRaw.filter((x: any) => (x?.isActive ?? true));

        // Mevcut UI davranışını koru: boş kategori gösterme
        if (!catId || !(c?.isActive ?? true) || activeItems.length === 0) continue;

        // MenuItem shape'ine map
        byCat[catId] = activeItems.map((it: any) => ({
          _id: pickItemId(it),
          title: it.title,
          description: it.description ?? undefined,
          price: Number(it.price) || 0,
          photoUrl: it.photoUrl ?? undefined,
          tags: Array.isArray(it.tags) ? it.tags : [],
          order: it.order ?? 0,
          isActive: it.isActive ?? true,
          isAvailable: it.isAvailable ?? true,
        })) as any;

        cats.push({
          _id: catId,
          title: c.title,
          description: c.description ?? undefined,
          order: c.order ?? 0,
          isActive: c.isActive ?? true,
        } as any);
      }

      // Varsa order'a göre sırala (yoksa mevcut sıralama zaten korunur)
      cats.sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));

      setMenuCats(cats);
      setMenuItemsByCat(byCat);
      setExpandedCatId(cats[0]?._id ?? null);
      setExpandAllMenuCats(false);
    } catch (e: any) {
      setMenuCats([]);
      setMenuItemsByCat({});
    } finally {
      setMenuLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (activeTab === "MENU") {
      loadALaCarteMenu();
    }
  }, [activeTab, loadALaCarteMenu]);

  // Region -> currency symbol
  const currencySymbol = useMemo(() => {
    const region = (r as any)?.region;
    if (region === "UK") return "£";
    return "₺"; // TR / CY default
  }, [r]);

  const minMenuPrice = useMemo(
    () => (menus.length ? Math.min(...menus.map((m) => m.pricePerPerson)) : undefined),
    [menus]
  );

  const formatPrice = React.useCallback(
    (n: number) =>
      `${currencySymbol}${Number(n).toLocaleString(
        locale === "tr" ? "tr-TR" : "en-GB"
      )}`,
    [currencySymbol, locale]
  );

  // --- In-app toast helper ---
  const fireToast = React.useCallback((title: string, body?: string) => {
    try {
      const api: any = (useNotifications as any)?.getState?.();
      if (api?.addFromPush) {
        api.addFromPush({ id: String(Date.now()), title, body });
        return;
      }
    } catch {}
    Alert.alert(title, body);
  }, []);

  const callPhone = React.useCallback((phone?: string) => {
    const raw = String(phone ?? "").trim();
    if (!raw) return;

    // Keep digits and leading + only
    const cleaned = raw.replace(/(?!^\+)[^\d]/g, "");
    const url = `tel:${cleaned}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) return Linking.openURL(url);
        Alert.alert("Hata", "Telefon araması başlatılamadı.");
      })
      .catch(() => {
        Alert.alert("Hata", "Telefon araması başlatılamadı.");
      });
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto rotate photos
  useEffect(() => {
    if (autoTimer.current) {
      clearInterval(autoTimer.current);
      autoTimer.current = null;
    }
    if (fullScreenOpen || photos.length <= 1) return;

    autoTimer.current = setInterval(() => {
      setActivePhoto((prev) => {
        const total = photos.length;
        if (!total) return 0;
        const next = (prev + 1) % total;
        try {
          photosListRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {}
        return next;
      });
    }, 3000);

    return () => {
      if (autoTimer.current) clearInterval(autoTimer.current);
      autoTimer.current = null;
    };
  }, [photos.length, fullScreenOpen]);

  useEffect(() => {
    if (!loading && r) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, r, fadeAnim, scaleAnim]);

  useEffect(() => {
    dayjs.locale(locale === "tr" ? "tr" : "en");
  }, [locale]);

  // Restaurant fetch (loop fix)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = (await getRestaurant(restaurantId)) as Restaurant;
        if (alive) setR(data);
      } catch (e: any) {
        Alert.alert(
          t("common.error"),
          e?.response?.data?.message || e?.message || t("restaurantDetail.loadError")
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Favorites
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (token && user?.role === "customer") {
          const list = await listFavorites();
          if (mounted) setFavs(list || []);
        } else {
          if (mounted) setFavs([]);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [token, user?.role]);

  // Slots
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) return;
      try {
        setFetchingSlots(true);
        setSelectedSlot(null);
        const res = await getAvailability({ id: restaurantId, date, partySize });
        if (alive) setSlots(res?.slots || []);
      } catch {
        if (alive) setSlots([]);
      } finally {
        if (alive) setFetchingSlots(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId, date, partySize]);

  const fav = useMemo(() => isFavorited(favs, restaurantId), [favs, restaurantId]);

  const onSelectSlot = (s: AvailabilitySlot) => {
    if (!s.isAvailable) return;
    const [h, m] = s.label.split(":");
    const iso = dayjs(date).hour(Number(h)).minute(Number(m)).second(0).toISOString();
    if (isPast(iso)) {
      fireToast(
        tt("restaurantDetail.pastTimeTitle", "Geçmiş saat seçilemez"),
        tt("restaurantDetail.pastTimeBody", "Lütfen ileri bir saat seçin.")
      );
      return;
    }
    setSelectedSlot(s);
  };

const onContinue = async () => {
    if (!selectedSlot || !r) return;

    const [h, m] = selectedSlot.label.split(":");
    const localDateTime = dayjs(date)
      .hour(Number(h))
      .minute(Number(m))
      .second(0)
      .toISOString();

    if (isPast(localDateTime)) {
      fireToast(
        tt("restaurantDetail.pastDateTimeTitle", "Geçmiş tarih/saat seçilemez"),
        tt("restaurantDetail.pastDateTimeBody", "Lütfen ileri bir tarih/saat seçin.")
      );
      return;
    }

    if (!token) {
      Alert.alert(
        t("restaurantDetail.loginRequiredTitle"),
        t("restaurantDetail.loginRequiredBodyReservation")
      );
      await setIntended({ name: "Restoran", params: { id: restaurantId } });
      nav.navigate("Giriş");
      return;
    }

    setRestaurant(r._id);
    setDateTime(localDateTime);
    setParty(partySize);
    if (menus.length > 0) {
      nav.navigate("Rezervasyon - Menü");
    } else {
      nav.navigate("Rezervasyon - Özet");
    }
  };

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PHOTO_W);
    setActivePhoto(Math.max(0, Math.min(idx, photos.length - 1)));
  };

  const toggleFavorite = async () => {
    if (!restaurantId || favLoading) return;
    if (!token || user?.role !== "customer") {
      Alert.alert(
        t("restaurantDetail.loginRequiredTitle"),
        t("restaurantDetail.loginRequiredBodyFavorite")
      );
      await setIntended({ name: "Restoran", params: { id: restaurantId } });
      nav.navigate("Giriş");
      return;
    }

    setFavLoading(true);
    try {
      if (fav) {
        await removeFavorite(restaurantId);
        setFavs((prev) => prev.filter((f) => f._id !== restaurantId));
      } else {
        await addFavorite(restaurantId);
        setFavs((prev) =>
          prev.some((f) => f._id === restaurantId)
            ? prev
            : [
                ...prev,
                {
                  _id: restaurantId,
                  name: r?.name || "",
                  city: r?.city,
                  address: r?.address,
                  photos: r?.photos,
                  priceRange: r?.priceRange,
                  rating: (r as any)?.rating ?? null,
                },
              ]
        );
      }
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.message || e?.message || t("restaurantDetail.favoriteError")
      );
    } finally {
      setFavLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7B2C2C" />
        <Text style={styles.loadingText}>{t("restaurantDetail.loading")}</Text>
      </View>
    );
  }

  if (!r) {
    return (
      <View style={styles.center}>
        <Ionicons name="restaurant-outline" size={64} color="#666666" />
        <Text style={styles.emptyTitle}>{t("restaurantDetail.notFoundTitle")}</Text>
        <Text style={styles.emptyText}>{t("restaurantDetail.notFoundText")}</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backButtonText}>{t("restaurantDetail.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scrollPadBottom = insets.bottom + 100;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          {/* Galeri */}
          <View style={styles.galleryWrap}>
            {photos.length > 0 ? (
              <>
                <FlatList
                  ref={photosListRef}
                  data={photos}
                  horizontal
                  pagingEnabled
                  onScroll={onPhotoScroll}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u, i) => `${u}-${i}`}
                  renderItem={({ item, index }) => (
                    <Pressable
                      onPress={() => {
                        setFullScreenIndex(index);
                        setFullScreenOpen(true);
                      }}
                      style={{ width: PHOTO_W, height: PHOTO_H }}
                    >
                      <Image source={{ uri: item }} style={styles.photoFull} resizeMode="cover" />
                    </Pressable>
                  )}
                />

                <Pressable onPress={toggleFavorite} style={styles.favoriteOverlay}>
                  <LinearGradient
                    colors={fav ? ["#E53935", "#C62828"] : ["#ffffff", "#ffffff"]}
                    style={styles.favoriteButton}
                  >
                    <Ionicons
                      name={fav ? "heart" : "heart-outline"}
                      size={22}
                      color={fav ? "#fff" : "#7B2C2C"}
                    />
                  </LinearGradient>
                </Pressable>

                <LinearGradient
                  colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.4)"]}
                  style={styles.gradBottom}
                />

                <View style={styles.dots}>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#999999" />
                <Text style={styles.photoPlaceholderText}>{t("restaurantDetail.noPhoto")}</Text>
              </View>
            )}
          </View>

          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.name}</Text>
                {!!r.address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location" size={16} color="#666666" />
                    <Text style={styles.addressText}>{r.address}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={toggleFavorite} style={styles.favoriteButtonCard}>
                <Ionicons
                  name={fav ? "heart" : "heart-outline"}
                  size={24}
                  color={fav ? "#E53935" : "#666666"}
                />
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              {!!r.city && (
                <View style={styles.metaChip}>
                  <Ionicons name="location-outline" size={14} color="#666666" />
                  <Text style={styles.metaChipText}>{r.city}</Text>
                </View>
              )}
              {!!r.priceRange && (
                <View style={styles.metaChip}>
                  <Ionicons name="wallet-outline" size={14} color="#666666" />
                  <Text style={styles.metaChipText}>{r.priceRange}</Text>
                </View>
              )}
              {typeof minMenuPrice === "number" && (
                <View style={styles.metaChipPrimary}>
                  <Ionicons name="pricetag" size={14} color="#fff" />
                  <Text style={styles.metaChipTextPrimary}>
                    {formatPrice(minMenuPrice)}+
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ✅ Fix Menüler (HER ZAMAN SABİT) */}
          {menus.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="restaurant" size={22} color="#7B2C2C" />
                <Text style={styles.sectionTitle}>
                  {t("restaurantDetail.fixedMenus")}
                </Text>
              </View>
              <View style={{ gap: 12 }}>
                {menus.map((m, idx) => (
                  <View key={`${m._id || m.title}-${idx}`} style={styles.menuCard}>
                    <View style={styles.menuIconCircle}>
                      <Ionicons name="restaurant" size={24} color="#7B2C2C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuTitle}>{m.title}</Text>
                      {!!m.description && (
                        <Text style={styles.menuDesc}>{m.description}</Text>
                      )}
                    </View>
                    <View style={styles.menuPricePill}>
                      <Text style={styles.menuPriceText}>
                        {formatPrice(m.pricePerPerson)}
                      </Text>
                      <Text style={styles.menuPriceSub}>
                        {t("restaurantDetail.perPerson")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
             {/* Uygun Saat Bul */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={22} color="#7B2C2C" />
              <Text style={styles.sectionTitle}>{tt("restaurantDetail.findSlot", "Uygun Saat Bul")}</Text>
            </View>

            <View style={styles.controlsContainer}>
              <View style={styles.controlCard}>
                <Text style={styles.controlLabel}>{tt("restaurantDetail.date", "Tarih")}</Text>
                <View style={styles.dateControls}>
                  <Pressable
                    onPress={() => setDate(dayjs(date).subtract(1, "day").format("YYYY-MM-DD"))}
                    disabled={dayjs(date).isSame(dayjs(), "day")}
                    style={[styles.controlButton, dayjs(date).isSame(dayjs(), "day") && styles.disabled]}
                  >
                    <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
                  </Pressable>

                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateText}>{dayjs(date).format("DD MMM")}</Text>
                    <Text style={styles.dayText}>{dayjs(date).format("dddd")}</Text>
                  </View>

                  <Pressable
                    onPress={() => setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"))}
                    style={styles.controlButton}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#1A1A1A" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.controlCard}>
                <Text style={styles.controlLabel}>{tt("restaurantDetail.partySize", "Kişi Sayısı")}</Text>
                <View style={styles.partyControls}>
                  <Pressable
                    onPress={() => setPartySize((p) => Math.max(1, p - 1))}
                    style={[styles.controlButton, partySize <= 1 && styles.disabled]}
                  >
                    <Ionicons name="remove" size={18} color="#1A1A1A" />
                  </Pressable>

                  <View style={styles.partyDisplay}>
                    <Ionicons name="people" size={20} color="#7B2C2C" />
                    <Text style={styles.partyText}>{partySize}</Text>
                  </View>

                  <Pressable onPress={() => setPartySize((p) => p + 1)} style={styles.controlButton}>
                    <Ionicons name="add" size={18} color="#1A1A1A" />
                  </Pressable>
                </View>
              </View>
            </View>

            {fetchingSlots ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator color="#7B2C2C" />
                <Text style={styles.slotsLoadingText}>{tt("restaurantDetail.slotsSearching", "Uygun saatler aranıyor…")}</Text>
              </View>
            ) : (
              <FlatList
                data={slots}
                horizontal
                keyExtractor={(s) => s.timeISO}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotsList}
                renderItem={({ item }) => {
                  const isSelected = selectedSlot?.timeISO === item.timeISO;
                  const disabled = !item.isAvailable;
                  return (
                    <Pressable
                      onPress={() => onSelectSlot(item)}
                      disabled={disabled}
                      style={[styles.slot, disabled && styles.slotDisabled, isSelected && styles.slotSelected]}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "time-outline"}
                        size={18}
                        color={isSelected ? "#fff" : disabled ? "#999999" : "#7B2C2C"}
                      />
                      <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{item.label}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="calendar-outline" size={32} color="#999999" />
                    <Text style={styles.muted}>{tt("restaurantDetail.noSlots", "Uygun saat bulunamadı.")}</Text>
                  </View>
                }
              />
            )}
          </View>
          

          {/* ✅ Tabs (Hakkında / Menü) */}
          <View style={styles.tabsWrap}>
            <Pressable
              onPress={() => setActiveTab("ABOUT")}
              style={[styles.tabBtn, activeTab === "ABOUT" && styles.tabBtnActive]}
            >
              <Ionicons
                name="information-circle"
                size={16}
                color={activeTab === "ABOUT" ? "#fff" : "#7B2C2C"}
              />
              <Text
                style={[styles.tabText, activeTab === "ABOUT" && styles.tabTextActive]}
              >
                {tt("restaurantDetail.aboutTab", "Hakkında")}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("MENU")}
              style={[styles.tabBtn, activeTab === "MENU" && styles.tabBtnActive]}
            >
              <Ionicons
                name="book"
                size={16}
                color={activeTab === "MENU" ? "#fff" : "#7B2C2C"}
              />
              <Text
                style={[styles.tabText, activeTab === "MENU" && styles.tabTextActive]}
              >
                {tt("restaurantDetail.menuTab", "Menü")}
              </Text>
            </Pressable>
          </View>

          {/* ABOUT TAB */}
          {activeTab === "ABOUT" && (
            !!r.description ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="information-circle" size={22} color="#7B2C2C" />
                  <Text style={styles.sectionTitle}>
                    {t("restaurantDetail.about")}
                  </Text>
                </View>
                <Text style={styles.description}>{r.description}</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="information-circle-outline" size={32} color="#999999" />
                  <Text style={styles.muted}>
                    {tt("restaurantDetail.noAbout", "Bu mekan için açıklama yok.")}
                  </Text>
                </View>
              </View>
            )
          )}

          {/* MENU TAB (A-la-carte kategori + ürün listesi) */}
          {activeTab === "MENU" && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                

                {menuCats.length > 0 && (
                  <Pressable
                    onPress={() => setExpandAllMenuCats((p) => !p)}
                    style={styles.menuExpandAllBtn}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={expandAllMenuCats ? "chevron-up-circle" : "chevron-down-circle"}
                      size={16}
                      color="#7B2C2C"
                    />
                    <Text style={styles.menuExpandAllText}>
                      {expandAllMenuCats
                        ? tt("restaurantDetail.collapseAll", "Hepsini Kapat")
                        : tt("restaurantDetail.expandAll", "Hepsini Aç")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {menuLoading ? (
                <View style={styles.emptyStateSmall}>
                  <ActivityIndicator color="#7B2C2C" />
                  <Text style={styles.muted}>
                    {tt("restaurantDetail.menuLoading", "Menü yükleniyor...")}
                  </Text>
                </View>
              ) : menuCats.length === 0 ? (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="list-outline" size={32} color="#999999" />
                  <Text style={styles.muted}>
                    {tt("restaurantDetail.menuComingSoon", "Bu mekan henüz menüsünü paylaşmadı.")}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {menuCats.map((c) => {
                    const isOpen = expandAllMenuCats || expandedCatId === c._id;
                    const catItems = menuItemsByCat[c._id] || [];

                    return (
                      <View key={c._id} style={styles.menuCatCard}>
                        <Pressable
                          onPress={() => {
                            if (expandAllMenuCats) return;
                            setExpandedCatId(isOpen ? null : c._id);
                          }}
                          style={styles.menuCatHeader}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.menuCatTitle}>{c.title}</Text>
                            {!!c.description && (
                              <Text style={styles.menuCatDesc} numberOfLines={2}>
                                {c.description}
                              </Text>
                            )}
                          </View>
                          <View style={styles.menuCatBadge}>
                            <Text style={styles.menuCatBadgeText}>{catItems.length}</Text>
                            <Ionicons
                              name={isOpen ? "chevron-up" : "chevron-down"}
                              size={16}
                              color="#7B2C2C"
                            />
                          </View>
                        </Pressable>

                        {isOpen && (
                          <View style={{ paddingTop: 10, gap: 10 }}>
                            {catItems.map((it) => (
                              <Pressable
                                key={it._id}
                                onPress={() => setPreviewItem(it)}
                                style={({ pressed }) => [
                                  styles.menuItemRow,
                                  pressed && styles.menuItemRowPressed,
                                ]}
                              >
                                {it.photoUrl ? (
                                  <Image
                                    source={{ uri: it.photoUrl }}
                                    style={styles.menuItemPhoto}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={styles.menuItemPhotoPlaceholder}>
                                    <View style={styles.menuItemPhotoPlaceholderInner}>
                                      <Ionicons name="fast-food-outline" size={20} color="#7B2C2C" />
                                    </View>
                                    <Text style={styles.menuItemPhotoPlaceholderText}>
                                      {tt("restaurantDetail.noPhotoShort", "Foto yok")}
                                    </Text>
                                  </View>
                                )}

                                <View style={styles.menuItemInfo}>
                                  <Text style={styles.menuItemTitle}>{it.title}</Text>
                                  {!!it.description && (
                                    <Text style={styles.menuItemDesc} numberOfLines={2}>
                                      {it.description}
                                    </Text>
                                  )}

                                  {!!it.tags?.length && (
                                    <View style={styles.menuItemTagsRow}>
                                      {it.tags.slice(0, 4).map((tg, i) => (
                                        <View key={`${it._id}-tg-${i}`} style={styles.menuItemTagPill}>
                                          <Text style={styles.menuItemTagText}>#{tg}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>

                                <View style={styles.menuItemPriceCol}>
                                  <View style={styles.menuItemPricePill}>
                                    <Text style={styles.menuItemPrice}>{formatPrice(it.price)}</Text>
                                  </View>
                                  {!it.isAvailable && (
                                    <Text style={styles.menuItemUnavailable}>
                                      {tt("restaurantDetail.notAvailable", "Stok yok")}
                                    </Text>
                                  )}
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}


          {/* İletişim */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="call" size={22} color="#7B2C2C" />
              <Text style={styles.sectionTitle}>{t("restaurantDetail.contact")}</Text>
            </View>
            <Pressable
              style={styles.contactItem}
              onPress={() => callPhone((r as any)?.phone)}
              disabled={!((r as any)?.phone)}
            >
              <Ionicons name="call-outline" size={18} color="#666666" />
              <Text style={styles.contactText}>
                {(r as any)?.phone || t("restaurantDetail.noPhone")}
              </Text>
            </Pressable>
            <View style={styles.contactItem}>
              <Ionicons name="location-outline" size={18} color="#666666" />
              <Text style={styles.contactText}>
                {r.address || t("restaurantDetail.noAddress")}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Fullscreen photo viewer */}
      <Modal
        visible={fullScreenOpen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullScreenOpen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            keyExtractor={(u, i) => `${u}-full-${i}`}
            initialScrollIndex={fullScreenIndex}
            getItemLayout={(_, index) => ({
              length: PHOTO_W,
              offset: PHOTO_W * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / PHOTO_W);
              if (!Number.isNaN(idx) && photos.length) {
                setActivePhoto(Math.max(0, Math.min(idx, photos.length - 1)));
              }
            }}
          />

          <View style={styles.fullscreenDots}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.fullscreenDot,
                  i === activePhoto && styles.fullscreenDotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullScreenOpen(false)}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Menu item preview modal */}
      <Modal
        visible={!!previewItem}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setPreviewItem(null)}
        >
          <Pressable style={styles.previewCard} onPress={() => {}}>
            {previewItem?.photoUrl ? (
              <Image
                source={{ uri: previewItem.photoUrl }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewImagePlaceholder}>
                <Ionicons name="fast-food-outline" size={42} color="#7B2C2C" />
                <Text style={styles.previewImagePlaceholderText}>
                  {tt("restaurantDetail.noPhoto", "Fotoğraf yok")}
                </Text>
              </View>
            )}

            <View style={styles.previewBody}>
              <Text style={styles.previewTitle}>{previewItem?.title}</Text>
              {!!previewItem?.description && (
                <Text style={styles.previewDesc}>{previewItem.description}</Text>
              )}

              <View style={styles.previewPriceRow}>
                <Text style={styles.previewPrice}>{formatPrice(previewItem?.price || 0)}</Text>
                {!previewItem?.isAvailable && (
                  <Text style={styles.previewUnavailable}>
                    {tt("restaurantDetail.notAvailable", "Stok yok")}
                  </Text>
                )}
              </View>

              {!!previewItem?.tags?.length && (
                <Text style={styles.previewTags} numberOfLines={2}>
                  #{previewItem.tags.join(" #")}
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => setPreviewItem(null)}
              style={styles.previewClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* CTA Bar */}
      <LinearGradient
        colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,1)"]}
        style={[styles.ctaBar, { paddingBottom: 12 + insets.bottom }]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.ctaTitleRow}>
            <Ionicons name="calendar" size={18} color="#7B2C2C" />
            <Text style={styles.ctaTitle}>
              {selectedSlot
                ? `${dayLabel}, ${selectedSlot.label}`
                : t("restaurantDetail.ctaSelectDateTime")}
            </Text>
          </View>
          <View style={styles.ctaSubRow}>
            <Ionicons name="people" size={14} color="#666666" />
            <Text style={styles.ctaSub}>
              {t("restaurantDetail.ctaPeople", { count: partySize })}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onContinue}
          disabled={!selectedSlot}
          style={[styles.ctaBtn, !selectedSlot && styles.ctaBtnDisabled]}
        >
          <Text style={styles.ctaBtnText}>
            {t("restaurantDetail.ctaContinue")}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FAFAFA", flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
    padding: 32,
    gap: 12,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: "#666666" },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A1A", marginTop: 16 },
  emptyText: { color: "#666666", textAlign: "center", marginBottom: 24 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  backButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  galleryWrap: { position: "relative", backgroundColor: "#fff" },
  photoFull: { width: PHOTO_W, height: PHOTO_H, backgroundColor: "#E6E6E6" },
  favoriteOverlay: { position: "absolute", right: 16, top: 16 },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  dots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 24 },
  photoPlaceholder: {
    height: PHOTO_H,
    backgroundColor: "#E6E6E6",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  photoPlaceholderText: { color: "#999999", fontSize: 14 },

  headerCard: {
    marginTop: -24,
    marginHorizontal: H_PADDING,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { flex: 1, color: "#666666", lineHeight: 20, fontSize: 14 },
  favoriteButtonCard: { padding: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    gap: 6,
  },
  metaChipText: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  metaChipPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#7B2C2C",
    gap: 6,
  },
  metaChipTextPrimary: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Tabs
  tabsWrap: {
    marginTop: 14,
    marginHorizontal: H_PADDING,
    flexDirection: "row",
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: "#7B2C2C",
    borderColor: "#7B2C2C",
  },
  tabText: { fontWeight: "800", color: "#7B2C2C", fontSize: 14 },
  tabTextActive: { color: "#fff" },

  card: {
    marginTop: 16,
    marginHorizontal: H_PADDING,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  description: { color: "#666666", lineHeight: 24, fontSize: 15 },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  menuIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  menuDesc: { color: "#666666", lineHeight: 20, fontSize: 13 },
  menuPricePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7B2C2C",
    minWidth: 80,
  },
  menuPriceText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  menuPriceSub: { color: "#fff", opacity: 0.9, fontSize: 12 },

  // A-la-carte kategori + ürün listesi
  menuCatCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  menuCatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuCatTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  menuCatDesc: { marginTop: 4, color: "#666666", fontSize: 12, lineHeight: 18 },
  menuCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  menuCatBadgeText: { fontWeight: "800", color: "#7B2C2C", fontSize: 12 },

  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  menuItemPhoto: { width: 64, height: 64, borderRadius: 10, backgroundColor: "#E6E6E6" },
  menuItemPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3DADA",
    gap: 2,
    paddingHorizontal: 4,
  },
  menuItemPhotoPlaceholderInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  menuItemPhotoPlaceholderText: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: "#7B2C2C",
    opacity: 0.9,
  },
  menuItemRowPressed: {
    transform: [{ scale: 1.02 }],
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  menuItemInfo: { flex: 1 },
  menuItemTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  menuItemDesc: { marginTop: 4, color: "#666666", fontSize: 12, lineHeight: 18 },
  menuItemTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  menuItemTagPill: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  menuItemTagText: { fontSize: 11, fontWeight: "700", color: "#7B2C2C" },
  menuItemPriceCol: { alignItems: "flex-end" },
  menuItemPrice: { fontSize: 16, fontWeight: "900", color: "#7B2C2C" },
  menuItemUnavailable: { marginTop: 4, fontSize: 11, color: "#999999", fontWeight: "700" },

  controlsContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  controlCard: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  controlLabel: { fontSize: 12, fontWeight: "600", color: "#666666", marginBottom: 8 },
  dateControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  partyControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  disabled: { opacity: 0.4 },
  dateDisplay: { alignItems: "center" },
  dateText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  dayText: { fontSize: 11, color: "#666666", marginTop: 2 },
  partyDisplay: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },

  slotsLoading: { alignItems: "center", paddingVertical: 20, gap: 8 },
  slotsLoadingText: { color: "#666666", fontSize: 13 },
  slotsList: { paddingVertical: 8 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E6E6E6",
    gap: 6,
  },
  slotDisabled: { opacity: 0.4 },
  slotSelected: { backgroundColor: "#7B2C2C", borderColor: "#7B2C2C" },
  slotText: { fontWeight: "700", color: "#1A1A1A", fontSize: 14 },
  slotTextSelected: { color: "#fff" },

  emptyStateSmall: { alignItems: "center", gap: 8, paddingVertical: 16 },
  muted: { color: "#888888", fontSize: 13 },

  contactItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contactText: { color: "#1A1A1A", fontSize: 14 },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ctaTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  ctaTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  ctaSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctaSub: { fontSize: 13, color: "#666666" },

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: PHOTO_W,
    height: "100%",
  },
  fullscreenClose: {
    position: "absolute",
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenDots: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    zIndex: 20,
  },
  fullscreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  fullscreenDotActive: {
    width: 24,
    backgroundColor: "#fff",
  },
  menuItemPricePill: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  menuExpandAllBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  menuExpandAllText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7B2C2C",
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#E6E6E6",
  },
  previewImagePlaceholder: {
    width: "100%",
    height: 240,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewImagePlaceholderText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7B2C2C",
    opacity: 0.9,
  },
  previewBody: {
    padding: 14,
    gap: 6,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1A1A1A",
  },
  previewDesc: {
    fontSize: 13,
    color: "#666666",
    lineHeight: 19,
  },
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  previewPrice: {
    fontSize: 18,
    fontWeight: "900",
    color: "#7B2C2C",
  },
  previewUnavailable: {
    fontSize: 12,
    fontWeight: "800",
    color: "#999999",
  },
  previewTags: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#7B2C2C",
    opacity: 0.9,
  },
  previewClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
    }
  })
  

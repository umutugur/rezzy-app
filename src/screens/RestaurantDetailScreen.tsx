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
  Platform,
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
import { useTheme } from "../contexts/ThemeContext";
import { ReviewSection } from "../components/ui";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PADDING = 16;
const PHOTO_W = SCREEN_W;
const PHOTO_H = Math.round(SCREEN_W * 0.72);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type CoverImageProps = {
  uri: string;
  width: number;
  height: number;
  focusX?: number; // 0..1
  focusY?: number; // 0..1
};

const CoverImage = React.memo(({ uri, width, height, focusX = 0.5, focusY = 0.5 }: CoverImageProps) => {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (!mounted) return;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          setSize(null);
        } else {
          setSize({ w, h });
        }
      },
      () => {
        if (mounted) setSize(null);
      }
    );
    return () => {
      mounted = false;
    };
  }, [uri]);

  if (!size) {
    return <Image source={{ uri }} style={{ width, height }} resizeMode="cover" />;
  }

  const scale = Math.max(width / size.w, height / size.h);
  const scaledW = size.w * scale;
  const scaledH = size.h * scale;

  const fx = clamp01(focusX);
  const fy = clamp01(focusY);

  const targetX = width / 2 - fx * scaledW;
  const targetY = height / 2 - fy * scaledH;

  const minX = width - scaledW;
  const minY = height - scaledH;

  const offsetX = Math.max(minX, Math.min(0, targetX));
  const offsetY = Math.max(minY, Math.min(0, targetY));

  return (
    <View style={{ width, height, overflow: "hidden", backgroundColor: "#E6E6E6" }}>
      <Image
        source={{ uri }}
        style={{
          width: scaledW,
          height: scaledH,
          transform: [{ translateX: offsetX }, { translateY: offsetY }],
        }}
      />
    </View>
  );
});

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
  const theme = useTheme();
  const styles = makeStyles(theme);
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
  const [activeTab, setActiveTab] = useState<"ABOUT" | "MENU" | "REVIEWS">("ABOUT");
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
  const photoMetaMap = useMemo(() => {
    const out: Record<string, { focusX: number; focusY: number }> = {};
    const list = Array.isArray((r as any)?.photoMeta) ? (r as any).photoMeta : [];
    for (const m of list) {
      const url = String(m?.url || "");
      if (!url) continue;
      out[url] = {
        focusX: clamp01(Number(m?.focusX ?? 0.5)),
        focusY: clamp01(Number(m?.focusY ?? 0.5)),
      };
    }
    return out;
  }, [r]);
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
    if (activeTab === "MENU") loadALaCarteMenu();
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
    if (!cleaned) return;

    // Some Android ROMs / devices return false for canOpenURL(tel:...), even though openURL works.
    // Prefer a direct openURL with a safe fallback.
    const urlPrimary = Platform.OS === "ios" ? `telprompt:${cleaned}` : `tel:${cleaned}`;
    const urlFallback = `tel:${cleaned}`;

    (async () => {
      try {
        await Linking.openURL(urlPrimary);
      } catch {
        try {
          await Linking.openURL(urlFallback);
        } catch {
          Alert.alert(tt("common.error", "Hata"), tt("restaurantDetail.callError", "Telefon araması başlatılamadı."));
        }
      }
    })();
  }, []);

  type Coords = { lat: number; lng: number };

  const openInMaps = React.useCallback(
    async (opts: { googleMapsUrl?: string | null; coords?: Coords | null; label?: string }) => {
      const googleMapsUrl = String(opts.googleMapsUrl ?? "").trim();
      if (googleMapsUrl) {
        try {
          const can = await Linking.canOpenURL(googleMapsUrl);
          if (can) {
            await Linking.openURL(googleMapsUrl);
            return;
          }
        } catch {
          // fall through
        }
      }

      const c = opts.coords;
      if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) {
        Alert.alert("Konum bulunamadı", "Bu restoran için harita bilgisi yok.");
        return;
      }

      const label = encodeURIComponent(opts.label || "Restaurant");
      const url =
        Platform.OS === "ios"
          ? `http://maps.apple.com/?ll=${c.lat},${c.lng}&q=${label}`
          : `geo:${c.lat},${c.lng}?q=${c.lat},${c.lng}(${label})`;

      try {
        const can = await Linking.canOpenURL(url);
        if (!can) {
          Alert.alert("Açılamadı", "Harita uygulaması açılamadı.");
          return;
        }
        await Linking.openURL(url);
      } catch {
        Alert.alert("Açılamadı", "Harita uygulaması açılamadı.");
      }
    },
    []
  );

  const restaurantCoords: Coords | null = useMemo(() => {
    const rr: any = r;

    // Preferred: direct coordinates object (already {lat,lng} on some responses)
    const direct = rr?.coordinates;
    if (direct && Number.isFinite(direct.lat) && Number.isFinite(direct.lng)) {
      return { lat: Number(direct.lat), lng: Number(direct.lng) };
    }

    // Fallback: GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
    const geo = rr?.location?.coordinates;
    if (Array.isArray(geo) && geo.length >= 2) {
      const lng = Number(geo[0]);
      const lat = Number(geo[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    return null;
  }, [r]);

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

  // Native header'ı gizle — fotoğrafın üzerinde özel butonlar kullanıyoruz
  React.useLayoutEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

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
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t("restaurantDetail.loading")}</Text>
      </View>
    );
  }

  if (!r) {
    return (
      <View style={styles.center}>
        <Ionicons name="restaurant-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.emptyTitle}>{t("restaurantDetail.notFoundTitle")}</Text>
        <Text style={styles.emptyText}>{t("restaurantDetail.notFoundText")}</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={theme.colors.textInverse} />
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
                      <CoverImage
                        uri={item}
                        width={PHOTO_W}
                        height={PHOTO_H}
                        focusX={photoMetaMap[item]?.focusX ?? 0.5}
                        focusY={photoMetaMap[item]?.focusY ?? 0.5}
                      />
                    </Pressable>
                  )}
                />

                {/* Üst karartma — buton okunabilirliği için */}
                <LinearGradient
                  colors={["rgba(0,0,0,0.45)", "transparent"]}
                  style={styles.gradTop}
                  pointerEvents="none"
                />

                {/* Alt karartma + nokta göstergesi */}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.55)"]}
                  style={styles.gradBottom}
                  pointerEvents="none"
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

            {/* Overlay: geri + favori butonları */}
            <View style={[styles.galleryTopBar, { paddingTop: insets.top + 6 }]}>
              <Pressable onPress={() => nav.goBack()} style={styles.galleryIconBtn}>
                <Ionicons name="chevron-back" size={22} color="#111827" />
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable onPress={toggleFavorite} style={styles.galleryIconBtn} disabled={favLoading}>
                <Ionicons
                  name={fav ? "heart" : "heart-outline"}
                  size={20}
                  color={fav ? "#DC2626" : "#111827"}
                />
              </Pressable>
            </View>
          </View>

          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.name}</Text>
                {/* Rating row */}
                {(r as any)?.rating != null && (
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= Math.round((r as any).rating) ? "star" : "star-outline"}
                        size={15}
                        color="#FBBF24"
                      />
                    ))}
                    <Text style={styles.ratingInline}>
                      {Number((r as any).rating).toFixed(1)}
                    </Text>
                    {(r as any)?.ratingCount != null && (
                      <Text style={styles.ratingCountInline}>
                        · {(r as any).ratingCount} yorum
                      </Text>
                    )}
                  </View>
                )}
                {!!r.address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.addressText}>{r.address}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.metaRow}>
              {!!r.city && (
                <View style={styles.metaChip}>
                  <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.metaChipText}>{r.city}</Text>
                </View>
              )}
              {!!r.priceRange && (
                <View style={styles.metaChip}>
                  <Ionicons name="wallet-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.metaChipText}>{r.priceRange}</Text>
                </View>
              )}
              {typeof minMenuPrice === "number" && (
                <View style={styles.metaChipPrimary}>
                  <Ionicons name="pricetag" size={14} color={theme.colors.textInverse} />
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
                <Ionicons name="restaurant" size={22} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>
                  {t("restaurantDetail.fixedMenus")}
                </Text>
              </View>
              <View style={{ gap: 12 }}>
                {menus.map((m, idx) => (
                  <View key={`${m._id || m.title}-${idx}`} style={styles.menuCard}>
                    <View style={styles.menuIconCircle}>
                      <Ionicons name="restaurant" size={24} color={theme.colors.primary} />
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
              <Ionicons name="time" size={22} color={theme.colors.primary} />
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
                    <Ionicons name="chevron-back" size={18} color={theme.colors.textPrimary} />
                  </Pressable>

                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateText}>{dayjs(date).format("DD MMM")}</Text>
                    <Text style={styles.dayText}>{dayjs(date).format("dddd")}</Text>
                  </View>

                  <Pressable
                    onPress={() => setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"))}
                    style={styles.controlButton}
                  >
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textPrimary} />
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
                    <Ionicons name="remove" size={18} color={theme.colors.textPrimary} />
                  </Pressable>

                  <View style={styles.partyDisplay}>
                    <Ionicons name="people" size={20} color={theme.colors.primary} />
                    <Text style={styles.partyText}>{partySize}</Text>
                  </View>

                  <Pressable onPress={() => setPartySize((p) => p + 1)} style={styles.controlButton}>
                    <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>

            {fetchingSlots ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator color={theme.colors.primary} />
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
                        color={isSelected ? theme.colors.textInverse : disabled ? theme.colors.textTertiary : theme.colors.primary}
                      />
                      <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{item.label}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="calendar-outline" size={32} color={theme.colors.textTertiary} />
                    <Text style={styles.muted}>{tt("restaurantDetail.noSlots", "Uygun saat bulunamadı.")}</Text>
                  </View>
                }
              />
            )}
          </View>
          

          {/* ── Tabs ─────────────────────────────────────────────── */}
          <View style={styles.tabsWrap}>
            {(
              [
                { key: "ABOUT", label: tt("restaurantDetail.aboutTab", "Hakkında"), icon: "information-circle-outline" },
                { key: "MENU", label: tt("restaurantDetail.menuTab", "Menü"), icon: "book-outline" },
                { key: "REVIEWS", label: tt("restaurantDetail.reviewsTab", "Yorumlar"), icon: "star-outline" },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? theme.colors.textInverse : theme.colors.primary}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ABOUT TAB */}
          {activeTab === "ABOUT" && (
            !!r.description ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="information-circle" size={22} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>
                    {t("restaurantDetail.about")}
                  </Text>
                </View>
                <Text style={styles.description}>{r.description}</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="information-circle-outline" size={32} color={theme.colors.textTertiary} />
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
                      color={theme.colors.primary}
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
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={styles.muted}>
                    {tt("restaurantDetail.menuLoading", "Menü yükleniyor...")}
                  </Text>
                </View>
              ) : menuCats.length === 0 ? (
                <View style={styles.emptyStateSmall}>
                  <Ionicons name="list-outline" size={32} color={theme.colors.textTertiary} />
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
                              color={theme.colors.primary}
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
                                      <Ionicons name="fast-food-outline" size={20} color={theme.colors.primary} />
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


          {/* REVIEWS TAB */}
          {activeTab === "REVIEWS" && (
            restaurantId ? (
              <ReviewSection
                entityType="restaurant"
                entityId={restaurantId}
                style={{ paddingHorizontal: 16, paddingVertical: 12 }}
              />
            ) : null
          )}

          {/* İletişim */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="call" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>{t("restaurantDetail.contact")}</Text>
            </View>
            <Pressable
              style={styles.contactItem}
              onPress={() => callPhone((r as any)?.phone)}
              disabled={!((r as any)?.phone)}
            >
              <Ionicons name="call-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={styles.contactText}>
                {(r as any)?.phone || t("restaurantDetail.noPhone")}
              </Text>
            </Pressable>
            <Pressable
              style={styles.contactItem}
              onPress={() =>
                openInMaps({
                  googleMapsUrl: (r as any)?.googleMapsUrl,
                  coords: restaurantCoords,
                  label: r?.name,
                })
              }
              disabled={!(restaurantCoords || (r as any)?.googleMapsUrl)}
            >
              <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
              <Text style={styles.contactText}>
                {r.address || t("restaurantDetail.noAddress")}
              </Text>
            </Pressable>
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
            <Ionicons name="close" size={26} color={theme.colors.textInverse} />
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
                <Ionicons name="fast-food-outline" size={42} color={theme.colors.primary} />
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
              <Ionicons name="close" size={18} color={theme.colors.textInverse} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* CTA Bar */}
      <View style={[styles.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
        {/* Sol bilgi */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.ctaTitleRow}>
            <Ionicons name="calendar" size={16} color={theme.colors.primary} />
            <Text style={styles.ctaTitle} numberOfLines={1}>
              {selectedSlot
                ? `${dayLabel}, ${selectedSlot.label}`
                : t("restaurantDetail.ctaSelectDateTime")}
            </Text>
          </View>
          <View style={styles.ctaSubRow}>
            <Ionicons name="people" size={13} color={theme.colors.textSecondary} />
            <Text style={styles.ctaSub}>
              {t("restaurantDetail.ctaPeople", { count: partySize })}
            </Text>
          </View>
        </View>

        {/* Devam Et butonu */}
        <TouchableOpacity
          onPress={onContinue}
          disabled={!selectedSlot}
          style={[styles.ctaBtn, !selectedSlot && styles.ctaBtnDisabled]}
        >
          <Text style={[styles.ctaBtnText, !selectedSlot && styles.ctaBtnTextDisabled]}>
            {t("restaurantDetail.ctaContinue")}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={17}
            color={selectedSlot ? theme.colors.textInverse : theme.colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  screen: { backgroundColor: theme.colors.background, flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: 32,
    gap: 12,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: theme.colors.textSecondary },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.textPrimary, marginTop: 16 },
  emptyText: { color: theme.colors.textSecondary, textAlign: "center", marginBottom: 24 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  backButtonText: { color: theme.colors.textInverse, fontWeight: "700", fontSize: 15 },

  galleryWrap: { position: "relative", backgroundColor: theme.colors.surface },
  photoFull: { width: PHOTO_W, height: PHOTO_H, backgroundColor: theme.colors.surfaceAlt },
  // Artık kullanılmıyor — galleryTopBar/galleryIconBtn aldı
  favoriteOverlay: { position: "absolute", right: 16, top: 16 },
  favoriteButton: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    ...theme.elevation[3],
  },
  gradTop: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  gradBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 130 },
  galleryTopBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    zIndex: 10,
  },
  galleryIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.93)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
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
  dotActive: { backgroundColor: theme.colors.textInverse, width: 24 },
  photoPlaceholder: {
    height: PHOTO_H,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  photoPlaceholderText: { color: theme.colors.textTertiary, fontSize: 14 },

  headerCard: {
    marginTop: -28,
    marginHorizontal: H_PADDING,
    padding: 20,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: "#8C244A",
    shadowColor: "#1A0610",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  title: { fontSize: 24, fontWeight: "900", color: theme.colors.textPrimary, marginBottom: 4, letterSpacing: -0.6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { flex: 1, color: theme.colors.textSecondary, lineHeight: 20, fontSize: 14 },
  favoriteButtonCard: { padding: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    gap: 6,
  },
  metaChipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textPrimary },
  metaChipPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    gap: 6,
  },
  metaChipTextPrimary: { fontSize: 13, fontWeight: "700", color: theme.colors.textInverse },

  // Tabs
  tabsWrap: {
    marginTop: 16,
    marginHorizontal: H_PADDING,
    flexDirection: "row",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: { fontWeight: "800", color: theme.colors.primary, fontSize: 14 },
  tabTextActive: { color: theme.colors.textInverse },

  card: {
    marginTop: 16,
    marginHorizontal: H_PADDING,
    padding: 18,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.textPrimary },
  description: { color: theme.colors.textSecondary, lineHeight: 24, fontSize: 15 },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  menuIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.textPrimary, marginBottom: 4 },
  menuDesc: { color: theme.colors.textSecondary, lineHeight: 20, fontSize: 13 },
  menuPricePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    minWidth: 80,
  },
  menuPriceText: { color: theme.colors.textInverse, fontWeight: "800", fontSize: 15 },
  menuPriceSub: { color: theme.colors.textInverse, opacity: 0.9, fontSize: 12 },

  // A-la-carte kategori + ürün listesi
  menuCatCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  menuCatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuCatTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.textPrimary },
  menuCatDesc: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  menuCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  menuCatBadgeText: { fontWeight: "800", color: theme.colors.primary, fontSize: 12 },

  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  menuItemPhoto: { width: 64, height: 64, borderRadius: 10, backgroundColor: theme.colors.surfaceAlt },
  menuItemPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    gap: 2,
    paddingHorizontal: 4,
  },
  menuItemPhotoPlaceholderInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  menuItemPhotoPlaceholderText: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.primary,
    opacity: 0.9,
  },
  menuItemRowPressed: {
    transform: [{ scale: 1.02 }],
    ...theme.elevation[2],
  },
  menuItemInfo: { flex: 1 },
  menuItemTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.textPrimary },
  menuItemDesc: { marginTop: 4, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  menuItemTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  menuItemTagPill: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  menuItemTagText: { fontSize: 11, fontWeight: "700", color: theme.colors.primary },
  menuItemPriceCol: { alignItems: "flex-end" },
  menuItemPrice: { fontSize: 16, fontWeight: "900", color: theme.colors.primary },
  menuItemUnavailable: { marginTop: 4, fontSize: 11, color: theme.colors.textTertiary, fontWeight: "700" },

  controlsContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  controlCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  controlLabel: { fontSize: 12, fontWeight: "600", color: theme.colors.textSecondary, marginBottom: 8 },
  dateControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  partyControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  disabled: { opacity: 0.4 },
  dateDisplay: { alignItems: "center" },
  dateText: { fontSize: 15, fontWeight: "700", color: theme.colors.textPrimary },
  dayText: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  partyDisplay: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyText: { fontSize: 16, fontWeight: "700", color: theme.colors.textPrimary },

  slotsLoading: { alignItems: "center", paddingVertical: 20, gap: 8 },
  slotsLoadingText: { color: theme.colors.textSecondary, fontSize: 13 },
  slotsList: { paddingVertical: 8 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    gap: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  slotDisabled: { opacity: 0.35 },
  slotSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  slotText: { fontWeight: "700", color: theme.colors.textPrimary, fontSize: 14 },
  slotTextSelected: { color: theme.colors.textInverse },

  emptyStateSmall: { alignItems: "center", gap: 8, paddingVertical: 16 },
  muted: { color: theme.colors.textTertiary, fontSize: 13 },

  contactItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contactText: { color: theme.colors.textPrimary, fontSize: 14 },

  ctaBar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: H_PADDING,
    paddingTop: 14,
    backgroundColor: theme.colors.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    // Üst tarafa doğru yumuşak gölge
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderDefault,
  },
  ctaTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctaTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.textPrimary, flexShrink: 1 },
  ctaSubRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ctaSub: { fontSize: 12, color: theme.colors.textSecondary },

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 130,
  },
  ctaBtnDisabled: {
    backgroundColor: theme.colors.surfaceAlt,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
  },
  ctaBtnText: { color: theme.colors.textInverse, fontWeight: "900", fontSize: 15 },
  ctaBtnTextDisabled: { color: theme.colors.textTertiary },

  fullscreenContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.textInverse,
  },
  menuItemPricePill: {
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  menuExpandAllBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  menuExpandAllText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },

  previewBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 240,
    backgroundColor: theme.colors.surfaceAlt,
  },
  previewImagePlaceholder: {
    width: "100%",
    height: 240,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewImagePlaceholderText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
    opacity: 0.9,
  },
  previewBody: {
    padding: 14,
    gap: 6,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: theme.colors.textPrimary,
  },
  previewDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
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
    color: theme.colors.primary,
  },
  previewUnavailable: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textTertiary,
  },
  previewTags: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary,
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
  },

  // Rating row in header card
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
    marginBottom: 4,
  },
  ratingInline: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginLeft: 4,
  },
  ratingCountInline: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },

  // Rating hero (summary)
  ratingHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderDefault,
    marginBottom: 16,
  },
  ratingBigBox: {
    alignItems: "center",
    minWidth: 80,
  },
  ratingBigNumber: {
    fontSize: 44,
    fontWeight: "900",
    color: theme.colors.textPrimary,
    letterSpacing: -2,
  },
  starsRowBig: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },
  ratingTotalLabel: {
    marginTop: 4,
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  ratingBars: {
    flex: 1,
    gap: 5,
  },
  ratingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingBarStarLabel: {
    width: 10,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    textAlign: "right",
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderDefault,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  ratingBarCount: {
    width: 22,
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    textAlign: "right",
  },

  // Write review
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "center",
    marginBottom: 16,
  },
  writeReviewBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textInverse,
  },
  writeReviewForm: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  writeReviewFormTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  starPicker: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 8,
  },
  commentInputWrap: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  commentInput: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    minHeight: 72,
    flex: 1,
  },
  writeReviewActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  writeReviewCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.surface,
  },
  writeReviewCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  writeReviewSubmit: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  writeReviewSubmitText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textInverse,
  },

  // Reviews empty state
  reviewsEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  reviewsEmptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewsEmptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.textPrimary,
  },
  reviewsEmptySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Individual review cards
  reviewCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    gap: 10,
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.textInverse,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textPrimary,
  },
  reviewDate: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  reviewStarsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  })
}
  

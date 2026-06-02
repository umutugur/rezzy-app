import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { listActiveBanners, type BannerItem } from "../api/banners";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";
import { useRegion } from "../store/useRegion";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../i18n";
import { useTheme } from "../contexts/ThemeContext";
import { useDeliveryAddress } from "../store/useDeliveryAddress";
import { listMyAddresses } from "../api/addresses";
import AppHeaderTitle from "../components/AppHeaderTitle";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Servis kartı görselleri (local assets — offline çalışır) ────────────────
const SERVICE_IMGS = {
  rezervasyon: require("../../assets/services/reservation.png"),
  paketServis: require("../../assets/services/delivery.png"),
  market:      require("../../assets/services/market.png"),
  // qr: Ionicons kullanılıyor, asset gereksiz
  taksi:       require("../../assets/services/taxi.png"),
};

type Preset = {
  businessType?: string | null;
  deliveryOnly?: boolean;
  mustServeSelectedAddress?: boolean;
};

const BUSINESS_TYPE_MAP: Record<
  "bar" | "cafe" | "meyhane" | "restaurant" | "coffee" | "more",
  string | null
> = {
  bar: "bar",
  cafe: "cafe",
  meyhane: "meyhane",
  restaurant: "restaurant",
  coffee: "coffee_shop",
  more: null,
};

// ─── Press-scale animasyonlu kart sarmalayıcı ────────────────────────────────
function AnimCard({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {/* style buraya taşındı — position:absolute ikonlar buna göre konumlanır */}
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Ekran ────────────────────────────────────────────────────────────────────
export default function HomeLandingScreen() {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  const theme = useTheme();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { setSelectedAddress } = useDeliveryAddress();

  // Paket Servis'e basınca GPS ile en yakın adresi otomatik seç
  const handleDeliveryPress = React.useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        const addrs = await listMyAddresses();
        if (addrs.length > 0) {
          let nearest = addrs[0];
          let minDist = Infinity;
          for (const addr of addrs) {
            const coords = addr.location?.coordinates;
            if (!coords) continue;
            const dist = haversineKm(latitude, longitude, coords[1], coords[0]);
            if (dist < minDist) { minDist = dist; nearest = addr; }
          }
          if (minDist < 100) setSelectedAddress(nearest);
          else {
            const def = addrs.find((a) => a.isDefault) ?? addrs[0];
            setSelectedAddress(def);
          }
        }
      }
    } catch { /* izin yok veya hata — mevcut seçim kalır */ }
    nav.navigate("Delivery");
  }, [nav, setSelectedAddress]);

  // Stagger entrance animasyonu (5 kart için)
  const cardAnims = React.useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    Animated.stagger(
      70,
      cardAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        })
      )
    ).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = (i: number) => ({
    opacity: cardAnims[i],
    transform: [
      {
        translateY: cardAnims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [24, 0],
        }),
      },
    ],
  });
  const bannerW = Math.max(280, screenW - 32);

  const bannerSep = 12;
  const bannerStride = bannerW + bannerSep;

  const [banners, setBanners] = React.useState<BannerItem[]>([]);
const [bannerLoading, setBannerLoading] = React.useState(false);

const bannerListRef = React.useRef<FlatList<BannerItem> | null>(null);
const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);
const activeBannerIndexRef = React.useRef(0);

const scrollToBanner = React.useCallback((index: number, animated = true) => {
  const count = banners.length;
  if (!count) return;
  const clamped = ((index % count) + count) % count;
  try {
    bannerListRef.current?.scrollToIndex({ index: clamped, animated });
  } catch {}
}, [banners.length]);
  const resetBannerAutoscrollTimerRef = React.useRef<(() => void) | null>(null);

  // Backend bazen relative path döndürebilir. RN Image için tam URL üret.
  const resolveBannerImageUri = (raw?: string | null) => {
    const v = String(raw ?? "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.startsWith("//")) return `https:${v}`;

    // NOTE: API base: https://rezzy-backend.onrender.com/api
    // Asset base: https://rezzy-backend.onrender.com
    const ASSET_BASE = "https://rezzy-backend.onrender.com";
    if (v.startsWith("/")) return `${ASSET_BASE}${v}`;
    return `${ASSET_BASE}/${v}`;
  };

  const { region, regionHydrated } = useRegion(
    useShallow((s: any) => ({
      region: s.region,
      regionHydrated: s.hydrated === true,
    }))
  );

  const [featured, setFeatured] = React.useState<Restaurant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openExplore = (preset?: Preset) => {
  const p = preset || {};
  nav.navigate({
    name: "KeşfetListe",
    params: {
      preset: p,
      presetKey: `${p.businessType ?? "all"}:${Date.now()}`,
    },
    merge: true,
  } as any);
};
  React.useEffect(() => {
    if (!regionHydrated) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await listRestaurants({ region, limit: 10 });
        if (!alive) return;
        setFeatured(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!alive) return;
        const raw = e?.response?.data;
        const msg = raw?.message || e?.message || "Bir hata oluştu";
        setError(msg);
        setFeatured([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [regionHydrated, region]);

  React.useEffect(() => {
    if (!regionHydrated) return;
    let alive = true;
    (async () => {
      try {
        setBannerLoading(true);
        const items = await listActiveBanners({ placement: "home_top", region });
        if (!alive) return;
        setBanners(Array.isArray(items) ? items : []);
        activeBannerIndexRef.current = 0;
        setActiveBannerIndex(0);
      } catch {
        if (!alive) return;
        setBanners([]);
      } finally {
        if (alive) setBannerLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [regionHydrated, region]);

  React.useEffect(() => {
    // Auto-scroll banner carousel (loop). Disable if 0/1 banners.
    if (bannerLoading) return;
    if (!banners || banners.length <= 1) {
      setActiveBannerIndex(0);
      activeBannerIndexRef.current = 0;
      return;
    }

    let timer: any = null;

    const start = () => {
      stop();
      timer = setInterval(() => {
        const next = (activeBannerIndexRef.current + 1) % banners.length;
        activeBannerIndexRef.current = next;
        setActiveBannerIndex(next);
        scrollToBanner(next, true);
      }, 5000);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    resetBannerAutoscrollTimerRef.current = () => {
      start();
    };

    start();
    return () => {
      stop();
      resetBannerAutoscrollTimerRef.current = null;
    };
  }, [bannerLoading, banners, scrollToBanner]);

  const onPressBanner = (b: BannerItem) => {
    const rid = String((b as any)?.restaurantId || "").trim();
    if (!rid) return;

    if ((b as any)?.targetType === "delivery") {
      nav.navigate("Delivery", {
        screen: DeliveryRoutes.DeliveryRestaurant,
        params: { restaurantId: rid, id: rid },
      });
      return;
    }

    nav.navigate("Restoran", { id: rid });
  };

  const renderFeatured = ({ item, index }: { item: Restaurant; index: number }) => {
    const isRight = index % 2 === 1;
    const photoUri = item.photos?.[0];
    const rating = (item as any)?.rating as number | undefined;
    const subtitle = [item.city, item.priceRange || "₺₺"].filter(Boolean).join(" • ");

    return (
      <View style={[styles.featuredItem, isRight && styles.featuredItemRight]}>
        <AnimCard
          style={styles.featuredCard}
          onPress={() => nav.navigate("Restoran", { id: item._id })}
        >
          {/* Photo */}
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={["#5C1530", "#8C244A"]}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.78)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Rating badge — top right */}
          {rating != null && (
            <View style={styles.featuredRatingBadge}>
              <Ionicons name="star" size={10} color="#FFC107" />
              <Text style={styles.featuredRatingText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          {/* Name + subtitle — bottom */}
          <View style={styles.featuredInfo}>
            <Text style={styles.featuredName} numberOfLines={2}>{item.name}</Text>
            {!!subtitle && (
              <Text style={styles.featuredSub} numberOfLines={1}>{subtitle}</Text>
            )}
          </View>
        </AnimCard>
      </View>
    );
  };

  return (
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
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 + insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {bannerLoading ? (
          <View style={{ paddingHorizontal: theme.space[4], marginTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : banners.length > 0 ? (
          <>
            <FlatList
              ref={(r) => {
                bannerListRef.current = r;
              }}
              data={banners}
              keyExtractor={(i) => String((i as any)._id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: theme.space[4], paddingTop: 10 }}
              ItemSeparatorComponent={() => <View style={{ width: bannerSep }} />}
              decelerationRate="fast"
              snapToInterval={bannerStride}
              snapToAlignment="start"
              getItemLayout={(_, index) => ({ length: bannerStride, offset: bannerStride * index, index })}
              onMomentumScrollEnd={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / bannerStride);
                const clamped = Math.max(0, Math.min(idx, banners.length - 1));
                activeBannerIndexRef.current = clamped;
                setActiveBannerIndex(clamped);
                resetBannerAutoscrollTimerRef.current?.();
              }}
              renderItem={({ item }) => {
                const uri = resolveBannerImageUri((item as any).imageUrl);
                return (
                  <Pressable
                    style={[styles.bannerCard, { width: bannerW, backgroundColor: theme.colors.surfaceAlt }]}
                    onPress={() => onPressBanner(item)}
                  >
                    <Image
                      source={uri ? { uri } : require("../assets/firsat-carki.png")}
                      style={styles.bannerImg}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              }}
            />

            {banners.length > 1 && (
              <View style={styles.bannerDotsRow}>
                {banners.map((_, i) => {
                  const active = i === activeBannerIndex;
                  return (
                    <Pressable
                      key={`dot-${i}`}
                      onPress={() => {
                        activeBannerIndexRef.current = i;
                        setActiveBannerIndex(i);
                        scrollToBanner(i, true);
                        resetBannerAutoscrollTimerRef.current?.();
                      }}
                      hitSlop={10}
                      style={[
                        { width: 7, height: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.borderStrong },
                        active && { width: 18, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary },
                      ]}
                    />
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.bannerCard, { width: bannerW, marginHorizontal: theme.space[4], marginTop: 10, backgroundColor: theme.colors.surfaceAlt }]}>
            <Image
              source={require("../assets/firsat-carki.png")}
              style={styles.bannerImg}
              resizeMode="cover"
            />
          </View>
        )}

        {/* ── Servisler Grid ──────────────────────────────────────── */}
        <View style={{ marginHorizontal: theme.space[4], marginTop: 16 }}>

          {/* Satır 1 */}
          <View style={styles.serviceRow}>
            {/* Rezervasyon */}
            <Animated.View style={[{ flex: 1 }, cardStyle(0)]}>
              <AnimCard
                style={[styles.serviceCard, styles.cardShadow, { backgroundColor: "#FFFBF5", borderColor: theme.colors.borderDefault }]}
                onPress={() => openExplore({})}
              >
                <View style={[styles.cardAccent, { backgroundColor: theme.colors.primary }]} />
                <View style={styles.serviceCardTextArea}>
                  <Text style={[styles.serviceCardTitle, { color: theme.colors.primary }]}>{t("homeLanding.serviceReservation")}</Text>
                  <Text style={[styles.serviceCardSub, { color: theme.colors.textSecondary }]}>{t("homeLanding.serviceReservationSub")}</Text>
                </View>
                <View style={styles.serviceCardImgArea}>
                  <Image source={SERVICE_IMGS.rezervasyon} style={styles.serviceCardImg} resizeMode="contain" />
                </View>
              </AnimCard>
            </Animated.View>

            {/* Paket Servis */}
            <Animated.View style={[{ flex: 1 }, cardStyle(1)]}>
              <AnimCard
                style={[styles.serviceCard, styles.cardShadow, { backgroundColor: "#FFF8F5", borderColor: theme.colors.borderDefault }]}
                onPress={handleDeliveryPress}
              >
                <View style={[styles.cardAccent, { backgroundColor: "#C2410C" }]} />
                <View style={styles.serviceCardTextArea}>
                  <Text style={[styles.serviceCardTitle, { color: "#C2410C" }]}>{t("homeLanding.serviceDelivery")}</Text>
                  <Text style={[styles.serviceCardSub, { color: theme.colors.textSecondary }]}>{t("homeLanding.serviceDeliverySub")}</Text>
                </View>
                <View style={styles.serviceCardImgArea}>
                  <Image source={SERVICE_IMGS.paketServis} style={styles.serviceCardImg} resizeMode="contain" />
                </View>
              </AnimCard>
            </Animated.View>
          </View>

          {/* Satır 2 */}
          <View style={[styles.serviceRow, { marginTop: 10 }]}>
            {/* Market */}
            <Animated.View style={[{ flex: 1 }, cardStyle(2)]}>
              <AnimCard
                style={[styles.serviceCard, styles.cardShadow, { backgroundColor: "#F5FFF8", borderColor: theme.colors.borderDefault }]}
                onPress={() => nav.navigate("Market")}
              >
                <View style={[styles.cardAccent, { backgroundColor: "#15803D" }]} />
                <View style={styles.serviceCardTextArea}>
                  <Text style={[styles.serviceCardTitle, { color: "#15803D" }]}>{t("homeLanding.serviceMarket")}</Text>
                  <Text style={[styles.serviceCardSub, { color: theme.colors.textSecondary }]}>{t("homeLanding.serviceMarketSub")}</Text>
                </View>
                <View style={styles.serviceCardImgArea}>
                  <Image source={SERVICE_IMGS.market} style={styles.serviceCardImg} resizeMode="contain" />
                </View>
              </AnimCard>
            </Animated.View>

            {/* QR Menü */}
            <Animated.View style={[{ flex: 1 }, cardStyle(3)]}>
              <AnimCard
                style={[styles.serviceCard, styles.cardShadow, { backgroundColor: "#F8F5FF", borderColor: theme.colors.borderDefault }]}
                onPress={() => nav.navigate("QR Tara")}
              >
                <View style={[styles.cardAccent, { backgroundColor: "#6D28D9" }]} />
                <View style={styles.serviceCardTextArea}>
                  <Text style={[styles.serviceCardTitle, { color: "#6D28D9" }]}>{t("homeLanding.serviceQR")}</Text>
                  <Text style={[styles.serviceCardSub, { color: theme.colors.textSecondary }]}>{t("homeLanding.serviceQRSub")}</Text>
                </View>
                <View style={styles.serviceCardImgArea}>
                  <View style={styles.qrTile}>
                    <Ionicons name="qr-code" size={54} color="white" />
                  </View>
                </View>
              </AnimCard>
            </Animated.View>
          </View>

          {/* Satır 3 — tam genişlik Taksi */}
          <Animated.View style={[cardStyle(4), { marginTop: 10 }]}>
            {/* Wrapper: üste 28px boşluk bırak — araba oraya taşsın */}
            <View style={{ position: "relative", marginTop: 28, marginBottom: 0 }}>
              <AnimCard
                style={[styles.serviceCardWide, styles.cardShadow, { backgroundColor: "#FFFCF0", borderColor: theme.colors.borderDefault }]}
                onPress={() => nav.navigate("Taxi")}
              >
                <View style={[styles.cardAccentLeft, { backgroundColor: "#D97706" }]} />
                <View style={styles.serviceCardWideText}>
                  <Text style={[styles.serviceCardTitle, { color: "#D97706" }]}>{t("homeLanding.serviceTaxi")}</Text>
                  <Text style={[styles.serviceCardSub, { color: theme.colors.textSecondary }]}>{t("homeLanding.serviceTaxiSub")}</Text>
                </View>
                {/* Sağ taraf için boş alan rezerve et */}
                <View style={{ width: 200 }} />
              </AnimCard>

              {/* Araba — sadece üstten taşar, alta dokunmaz */}
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <Image
                  source={SERVICE_IMGS.taksi}
                  style={styles.taxiOverflowImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── Mekan Keşfet ──────────────────────────────────────── */}
        <Pressable
          style={[
            styles.exploreBtn,
            {
              marginHorizontal: theme.space[4],
              marginTop: 18,
              borderColor: theme.colors.borderDefault,
              backgroundColor: theme.colors.surface,
              ...theme.elevation[2],
            },
          ]}
          onPress={() => openExplore({})}
        >
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.colors.textPrimary }}>{t("homeLanding.exploreTitle")}</Text>
            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{t("homeLanding.exploreSub")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
        </Pressable>

        {loading ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: 10 }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: 10 }}>
            <Text style={{ color: theme.colors.error, fontWeight: "700" }}>{error}</Text>
          </View>
        ) : featured.length > 0 ? (
          <>
            <View style={{
              marginHorizontal: theme.space[4],
              marginTop: 24, marginBottom: 0,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{t("homeLanding.featuredTitle")}</Text>
              <Pressable onPress={() => openExplore({})}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>{t("homeLanding.seeAll")}</Text>
              </Pressable>
            </View>
            <FlatList
              data={featured}
              keyExtractor={(i) => String(i._id)}
              renderItem={renderFeatured}
              numColumns={2}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space[4],
                paddingTop: 12,
                paddingBottom: 10,
                gap: 12,
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Banner ───────────────────────────────────────────────
  bannerCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  bannerImg: { width: "100%", height: 210 },
  bannerDotsRow: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  // ── Servis kartları (Getir tarzı) ────────────────────────
  serviceRow: {
    flexDirection: "row",
    gap: 10,
  },

  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },

  serviceCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    height: 172,
    overflow: "hidden",
    flexDirection: "column",
  },
  serviceCardWide: {
    borderRadius: 18,
    borderWidth: 1,
    height: 112,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
  },
  // Renkli üst accent şeridi (dikey kartlar)
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  // Renkli sol accent şeridi (yatay Taksi kartı)
  cardAccentLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  // Metin alanı — kartın üst kısmı
  serviceCardTextArea: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
  },
  serviceCardTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  serviceCardSub: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  // Görsel alanı — kartın alt kısmı, kalan yüksekliği doldurur
  serviceCardImgArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  // PNG görsel — container'ı doldurur
  serviceCardImg: {
    width: "100%",
    height: "100%",
  },
  // Taksi kartı — metin sol taraf
  serviceCardWideText: {
    flex: 1,
    paddingLeft: 22,
    justifyContent: "center",
  },
  // QR kartı — mor kare üstünde beyaz QR ikonu
  qrTile: {
    width: 82,
    height: 82,
    backgroundColor: "#6D28D9",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  // Taksi arabası — sadece üstten taşar (top: -28px kart üzerine, bottom: kart altıyla hizalı)
  taxiOverflowImg: {
    position: "absolute",
    right: -8,
    top: -28,
    height: 140,   // kart yüksekliği (112) + 28 üst taşma
    width: 270,
  },

  // ── Bölüm başlığı ────────────────────────────────────────
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  // ── Keşfet butonu ────────────────────────────────────────
  exploreBtn: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // ── Öne çıkan mekanlar ───────────────────────────────────
  featuredItem: {
    flex: 1,
  },
  featuredItemRight: {
    marginLeft: 10,
  },

  // Premium full-bleed card
  featuredCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 200,
    backgroundColor: "#1A0610",
    shadowColor: "#1A0610",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },

  featuredRatingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 99,
  },
  featuredRatingText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  featuredInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
  featuredName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  featuredSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
});

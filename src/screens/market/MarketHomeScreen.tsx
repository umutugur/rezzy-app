// src/screens/market/MarketHomeScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { formatCurrency } from "../../utils/format";
import { useRegion } from "../../store/useRegion";
import { EmptyState, Skeleton } from "../../components/ui";
import {
  getStores,
  getMarketCollections,
  type MarketStore,
  type MarketStoreCategory,
  type MarketProduct,
  type MarketCollectionPreview,
} from "../../api/market.api";
import { effectivePrice, discountPercent } from "../../utils/marketPrice";
import { useMarketCart } from "../../store/useMarketStore";
import { useDeliveryAddress } from "../../store/useDeliveryAddress";
import { listMyAddresses, type UserAddress } from "../../api/addresses";
import { listActiveBanners, type BannerItem } from "../../api/banners";
import { MarketRoutes } from "../../navigation/marketRoutes";

// ─── Kategori veri ────────────────────────────────────────────────────────────

type UICategoryKey = MarketStoreCategory | "all" | "water" | "tup";

type CategoryItem = {
  key: UICategoryKey;
  label: string;
  fallback: string;
  imageUrl: string;
  apiKey?: MarketStoreCategory;
};

// Pexels CDN yardımcısı (verified IDs)
const MPEX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=200&h=200`;

const CATEGORIES: CategoryItem[] = [
  { key: "all",         label: "Tümü",         fallback: "🛒", imageUrl: MPEX(264636)  },
  { key: "supermarket", label: "Süpermarket",   fallback: "🏪", imageUrl: MPEX(7420502),  apiKey: "supermarket" },
  { key: "greengrocer", label: "Manav",         fallback: "🥦", imageUrl: MPEX(12974968), apiKey: "greengrocer" },
  { key: "bakery",      label: "Fırın",         fallback: "🥖", imageUrl: MPEX(3341067),  apiKey: "bakery" },
  { key: "organic",     label: "Organik",       fallback: "🌿", imageUrl: MPEX(7879960),  apiKey: "organic" },
  { key: "water",       label: "Su & Damacana", fallback: "💧", imageUrl: MPEX(327090)  },
  { key: "tup",         label: "Tüp",           fallback: "🔥", imageUrl: MPEX(16271901) },
  { key: "pharmacy",    label: "Eczane",        fallback: "💊", imageUrl: MPEX(3873150),  apiKey: "pharmacy" },
];

// ─── Yardımcı: Haversine mesafesi (km) ───────────────────────────────────────

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

// ─── Adres Seçici Modal ───────────────────────────────────────────────────────

interface AddressPickerProps {
  visible: boolean;
  onClose: () => void;
  addresses: UserAddress[];
  selectedId: string | null;
  gpsLabel: string | null;
  gpsActive: boolean;
  onSelectAddress: (addr: UserAddress) => void;
  onSelectGps: () => void;
  onAddNew: () => void;
}

function AddressPicker({
  visible,
  onClose,
  addresses,
  selectedId,
  gpsLabel,
  gpsActive,
  onSelectAddress,
  onSelectGps,
  onAddNew,
}: AddressPickerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Overlay */}
      <Pressable style={pm.overlay} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[
          pm.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle */}
        <View style={pm.handle} />
        <Text style={pm.sheetTitle}>{t("delivery.addressSheetTitle")}</Text>

        {/* Mevcut konum seçeneği */}
        <TouchableOpacity
          style={[pm.row, gpsActive && pm.rowActive]}
          onPress={() => { onSelectGps(); onClose(); }}
          activeOpacity={0.75}
        >
          <View style={[pm.iconBox, gpsActive && pm.iconBoxActive]}>
            <Ionicons
              name="locate"
              size={20}
              color={gpsActive ? "#fff" : "#15803D"}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pm.rowTitle}>{t("delivery.currentLocation")}</Text>
            <Text style={pm.rowSub} numberOfLines={1}>
              {gpsLabel ?? t("delivery.gettingLocation")}
            </Text>
          </View>
          {gpsActive && (
            <Ionicons name="checkmark-circle" size={22} color="#15803D" />
          )}
        </TouchableOpacity>

        {/* Kayıtlı adresler */}
        {addresses.length > 0 && (
          <>
            <Text style={pm.sectionLabel}>{t("delivery.savedAddresses")}</Text>
            {addresses.map((addr) => {
              const active = !gpsActive && selectedId === String(addr._id);
              return (
                <TouchableOpacity
                  key={addr._id}
                  style={[pm.row, active && pm.rowActive]}
                  onPress={() => { onSelectAddress(addr); onClose(); }}
                  activeOpacity={0.75}
                >
                  <View style={[pm.iconBox, active && pm.iconBoxActive]}>
                    <Ionicons
                      name={addr.isDefault ? "home" : "location"}
                      size={18}
                      color={active ? "#fff" : "#15803D"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={pm.rowTitle} numberOfLines={1}>
                      {addr.title ?? t("delivery.addressLabel")}
                    </Text>
                    <Text style={pm.rowSub} numberOfLines={1}>
                      {addr.fullAddress}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={22} color="#15803D" />
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Yeni adres ekle */}
        <TouchableOpacity
          style={pm.addBtn}
          onPress={() => { onClose(); onAddNew(); }}
          activeOpacity={0.8}
        >
          <View style={pm.addIconBox}>
            <Ionicons name="add" size={20} color="#15803D" />
          </View>
          <Text style={pm.addText}>{t("delivery.addNewAddress")}</Text>
          <Ionicons name="chevron-forward" size={18} color="#15803D" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Gel-Al Konum Seçici Modal ─────────────────────────────────────────────────

interface PickupLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  search: string;
  onChangeSearch: (text: string) => void;
  onSearch: () => void;
  searching: boolean;
  onUseCurrentLocation: () => void;
  currentLabel: string | null;
}

function PickupLocationPicker({
  visible,
  onClose,
  search,
  onChangeSearch,
  onSearch,
  searching,
  onUseCurrentLocation,
  currentLabel,
}: PickupLocationPickerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={pm.overlay} onPress={onClose} />
      <Animated.View
        style={[
          pm.sheet,
          { paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={pm.handle} />
        <Text style={pm.sheetTitle}>{t("market.pickup.locationLabel")}</Text>

        {/* Mevcut konum */}
        <TouchableOpacity
          style={pm.row}
          onPress={() => { onUseCurrentLocation(); onClose(); }}
          activeOpacity={0.75}
        >
          <View style={pm.iconBox}>
            <Ionicons name="locate" size={20} color="#15803D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pm.rowTitle}>{t("market.pickup.currentLocation")}</Text>
            {currentLabel ? (
              <Text style={pm.rowSub} numberOfLines={1}>{currentLabel}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Bölge ara */}
        <Text style={pm.sectionLabel}>{t("market.pickup.pickFromMap")}</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#F3F4F6",
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
          }}
        >
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={search}
            onChangeText={onChangeSearch}
            placeholder={t("market.pickup.searchArea")}
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontSize: 14, color: "#111827" }}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
          {searching ? (
            <Ionicons name="hourglass-outline" size={16} color="#9CA3AF" />
          ) : (
            <Pressable onPress={onSearch} hitSlop={8}>
              <Ionicons name="arrow-forward-circle" size={22} color="#15803D" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Kategori Resmi (CDN fotoğraf, görsel fallback) ──────────────────────────
function CatImage({ uri, fallback }: { uri: string; fallback: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <LinearGradient
        colors={["#DCFCE7", "#BBF7D0"]}
        style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: 30 }}>{fallback}</Text>
      </LinearGradient>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StoreCardSkeleton() {
  return (
    <View style={sk.card}>
      <Skeleton width={60} height={60} borderRadius={30} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={15} />
        <Skeleton width="80%" height={12} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

// ─── Mağaza Kartı ─────────────────────────────────────────────────────────────

function StoreCard({
  store,
  onPress,
  distanceKm,
}: {
  store: MarketStore;
  onPress: () => void;
  distanceKm?: number | null;
}) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const logoUri = store.photos[0] ?? null;
  const letter = store.name.trim()[0]?.toUpperCase() ?? "M";
  const isFree = store.deliveryFee === 0;
  const hasFreeThreshold =
    store.freeDeliveryThreshold != null && store.freeDeliveryThreshold > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sc.card,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.9 : 1 },
        theme.getElevation(1),
      ]}
    >
      <View style={sc.row}>
        <View style={sc.logoWrap}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={sc.logoImg} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#15803D", "#22C55E"]} style={sc.logoGrad}>
              <Text style={sc.logoLetter}>{letter}</Text>
            </LinearGradient>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={sc.nameRow}>
            <Text style={[sc.name, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {store.name}
            </Text>
            <View style={sc.ratingBadge}>
              <Ionicons name="star" size={11} color="white" />
              <Text style={sc.ratingText}>{store.rating.toFixed(1)}</Text>
            </View>
          </View>
          <Text style={[sc.details, { color: theme.colors.textSecondary }]}>
            {store.workingHours
              ? `${store.workingHours.open} - ${store.workingHours.close}  ·  `
              : ""}
            Min. {formatCurrency(store.minOrderAmount, region, language, 0)}
          </Text>
          <View style={sc.badgeRow}>
            {isFree ? (
              <View style={[sc.badge, sc.badgeFree]}>
                <Ionicons name="bicycle-outline" size={12} color="#15803D" />
                <Text style={[sc.badgeText, { color: "#15803D" }]}>{t("market.freeDelivery")}</Text>
              </View>
            ) : (
              <View style={[sc.badge, { borderColor: "#E5E7EB" }]}>
                <Text style={[sc.badgeText, { color: theme.colors.textSecondary }]}>
                  {formatCurrency(store.deliveryFee, region, language, 0)} {t("delivery.deliveryChip")}
                </Text>
              </View>
            )}
            {hasFreeThreshold && !isFree && (
              <View style={[sc.badge, sc.badgeFree]}>
                <Text style={[sc.badgeText, { color: "#15803D" }]}>
                  {t("market.freeThreshold", { amount: formatCurrency(store.freeDeliveryThreshold!, region, language, 0) })}
                </Text>
              </View>
            )}
            <View style={[sc.badge, { borderColor: "#E5E7EB" }]}>
              <Ionicons name="bag-handle-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={[sc.badgeText, { color: theme.colors.textSecondary }]}>{t("market.pickupAvailable")}</Text>
            </View>
            {distanceKm != null && (
              <View style={[sc.badge, { borderColor: "#E5E7EB" }]}>
                <Ionicons name="navigate-outline" size={12} color={theme.colors.textSecondary} />
                <Text style={[sc.badgeText, { color: theme.colors.textSecondary }]}>
                  {t("market.pickup.distanceKm", { km: distanceKm.toFixed(1) })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={[sc.catStrip, { backgroundColor: "#F0FDF4" }]}>
        <Text style={sc.catText}>{t(`market.cat.${store.category}`, { defaultValue: store.category })}</Text>
      </View>
    </Pressable>
  );
}

// ─── Koleksiyon ürün kartı ────────────────────────────────────────────────────

function CollectionProductCard({
  product,
  onPress,
}: {
  product: MarketProduct;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { language } = useI18n();
  const region = useRegion((s) => s.region);
  const eff = effectivePrice(product);
  const pct = discountPercent(product);

  return (
    <Pressable
      onPress={onPress}
      style={[cpc.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderDefault }]}
    >
      <View style={cpc.thumb}>
        {product.photos?.[0] ? (
          <Image
            source={{ uri: product.photos[0] }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        ) : null}
      </View>
      <Text numberOfLines={2} style={[cpc.title, { color: theme.colors.textPrimary }]}>
        {product.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
        {pct > 0 ? (
          <>
            <View style={[cpc.badge, { backgroundColor: theme.colors.error }]}>
              <Text style={cpc.badgeText}>%{pct}</Text>
            </View>
            <Text style={[cpc.priceDisc, { color: theme.colors.error }]}>
              {formatCurrency(eff, region, language)}
            </Text>
          </>
        ) : (
          <Text style={[cpc.price, { color: theme.colors.textPrimary }]}>
            {formatCurrency(product.price, region, language)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Koleksiyon Bölümü ────────────────────────────────────────────────────────

function CollectionSection({
  collection,
  onSeeAll,
  onPressProduct,
}: {
  collection: MarketCollectionPreview;
  onSeeAll: () => void;
  onPressProduct: (product: MarketProduct) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  if (!collection.products || collection.products.length === 0) return null;

  return (
    <View style={{ marginTop: theme.space[5] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          paddingHorizontal: theme.space[4],
        }}
      >
        <Text style={[ls.sectionTitle, { color: theme.colors.textPrimary, marginBottom: 0 }]}>
          {collection.title}
        </Text>
        <Pressable onPress={onSeeAll}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.primary }}>
            {t("market.collections.seeAll")}
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={collection.products}
        keyExtractor={(p) => p._id}
        renderItem={({ item }) => (
          <CollectionProductCard product={item} onPress={() => onPressProduct(item)} />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.space[4] }}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      />
    </View>
  );
}

// ─── Banner Carousel ────────────────────────────────────────────────────────────

function MarketBannerCarousel({
  banners,
  onPressBanner,
}: {
  banners: BannerItem[];
  onPressBanner: (b: BannerItem) => void;
}) {
  const theme = useTheme();
  const bannerListRef = useRef<FlatList<BannerItem> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const resetTimerRef = useRef<(() => void) | null>(null);

  const { width: screenW } = useWindowDimensions();
  const bannerSep = 12;
  const pad = 16;
  const bannerW = screenW - pad * 2;
  const bannerStride = bannerW + bannerSep;

  const scrollToBanner = useCallback((index: number, animated = true) => {
    const count = banners.length;
    if (!count) return;
    const clamped = ((index % count) + count) % count;
    try {
      bannerListRef.current?.scrollToIndex({ index: clamped, animated });
    } catch {}
  }, [banners.length]);

  useEffect(() => {
    if (!banners || banners.length <= 1) {
      setActiveIndex(0);
      activeIndexRef.current = 0;
      return;
    }
    let timer: any = null;
    const start = () => {
      stop();
      timer = setInterval(() => {
        const next = (activeIndexRef.current + 1) % banners.length;
        activeIndexRef.current = next;
        setActiveIndex(next);
        scrollToBanner(next, true);
      }, 5000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    resetTimerRef.current = () => start();
    start();
    return () => {
      stop();
      resetTimerRef.current = null;
    };
  }, [banners, scrollToBanner]);

  if (!banners || banners.length === 0) return null;

  return (
    <View style={{ marginTop: theme.space[3] }}>
      <FlatList
        ref={(r) => {
          bannerListRef.current = r;
        }}
        data={banners}
        keyExtractor={(i) => String(i._id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: pad }}
        ItemSeparatorComponent={() => <View style={{ width: bannerSep }} />}
        decelerationRate="fast"
        snapToInterval={bannerStride}
        snapToAlignment="start"
        getItemLayout={(_, index) => ({ length: bannerW, offset: bannerStride * index, index })}
        onMomentumScrollEnd={(e) => {
          const x = e.nativeEvent.contentOffset.x;
          const idx = Math.round(x / bannerStride);
          const clamped = Math.max(0, Math.min(idx, banners.length - 1));
          activeIndexRef.current = clamped;
          setActiveIndex(clamped);
          resetTimerRef.current?.();
        }}
        renderItem={({ item }) => (
          <Pressable
            style={[bc.card, { width: bannerW, backgroundColor: theme.colors.surfaceAlt }]}
            onPress={() => onPressBanner(item)}
          >
            <Image source={{ uri: item.imageUrl }} style={bc.img} resizeMode="cover" />
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View style={bc.dotsRow}>
          {banners.map((_, i) => {
            const active = i === activeIndex;
            return (
              <Pressable
                key={`dot-${i}`}
                onPress={() => {
                  activeIndexRef.current = i;
                  setActiveIndex(i);
                  scrollToBanner(i, true);
                  resetTimerRef.current?.();
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
    </View>
  );
}

// ─── Ekran ───────────────────────────────────────────────────────────────────

export default function MarketHomeScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Mağazalar
  const [stores, setStores] = useState<MarketStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<UICategoryKey>("all");
  const [searchText, setSearchText] = useState("");

  // Banner + koleksiyonlar
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [collections, setCollections] = useState<MarketCollectionPreview[]>([]);

  // Adres
  const { selectedAddressId, selectedAddress, setSelectedAddress } = useDeliveryAddress();
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Hizmet modu: Teslimat / Gel-Al
  const [serviceMode, setServiceMode] = useState<"delivery" | "pickup">("delivery");
  const [pickupLocation, setPickupLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [pickupSearch, setPickupSearch] = useState("");
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [pickupSearching, setPickupSearching] = useState(false);

  // Sepet
  const cartItems = useMarketCart((s) => s.items);
  const cartTotal = useMarketCart((s) =>
    s.items.reduce((acc, i) => acc + i.product.price * i.qty, 0)
  );

  // ── Adres yükleme ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // 1. Kayıtlı adresleri çek
      let addrs: UserAddress[] = [];
      try {
        addrs = await listMyAddresses();
        setSavedAddresses(addrs);
      } catch { /* sessizce geç */ }

      // 2. GPS konumu al
      let gpsCoordsForMatch: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude, longitude } = loc.coords;
          gpsCoordsForMatch = { lat: latitude, lng: longitude };
          setGpsCoords(gpsCoordsForMatch);

          // Reverse geocode → GPS etiket
          const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
          const g = geo[0];
          const label = [g?.district ?? g?.subregion, g?.city]
            .filter(Boolean)
            .join(", ");
          setGpsLabel(label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
      } catch { /* izin yok veya hata */ }

      // 3. Seçili adres zaten varsa → güncelle + bitir
      if (selectedAddressId) {
        const found = addrs.find((a) => String(a._id) === String(selectedAddressId));
        if (found) {
          setSelectedAddress(found);
          setGpsActive(false);
          return;
        }
      }

      // 4. GPS varsa → en yakın adresi bul
      if (gpsCoordsForMatch && addrs.length > 0) {
        let nearest = addrs[0];
        let minDist = Infinity;
        for (const addr of addrs) {
          const coords = addr.location?.coordinates; // [lng, lat]
          if (!coords) continue;
          const dist = haversineKm(
            gpsCoordsForMatch.lat,
            gpsCoordsForMatch.lng,
            coords[1],
            coords[0]
          );
          if (dist < minDist) { minDist = dist; nearest = addr; }
        }
        if (minDist < 50) { // 50km içindeyse seç
          setSelectedAddress(nearest);
          setGpsActive(false);
          return;
        }
      }

      // 5. Default adres varsa seç
      const def = addrs.find((a) => a.isDefault);
      if (def) {
        setSelectedAddress(def);
        setGpsActive(false);
        return;
      }

      // 6. GPS konumunu göster (kayıtlı adres yok)
      if (gpsLabel) setGpsActive(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gel-Al konumu çözümleme ──────────────────────────────────────────────────
  const resolvePickupFromGps = useCallback(async () => {
    if (gpsCoords) {
      setPickupLocation({
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        label: t("market.pickup.currentLocation"),
      });
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setGpsCoords({ lat: latitude, lng: longitude });
      setPickupLocation({
        lat: latitude,
        lng: longitude,
        label: t("market.pickup.currentLocation"),
      });
    } catch { /* izin yok veya hata */ }
  }, [gpsCoords, t]);

  useEffect(() => {
    if (serviceMode === "pickup" && !pickupLocation) {
      resolvePickupFromGps();
    }
  }, [serviceMode, pickupLocation, resolvePickupFromGps]);

  const handlePickupAreaSearch = useCallback(async () => {
    const query = pickupSearch.trim();
    if (!query) return;
    setPickupSearching(true);
    try {
      const results = await Location.geocodeAsync(query);
      const first = results?.[0];
      if (first) {
        setPickupLocation({ lat: first.latitude, lng: first.longitude, label: query });
        setShowPickupPicker(false);
      } else {
        Alert.alert(t("market.pickup.areaNotFound"));
      }
    } catch {
      Alert.alert(t("market.pickup.areaNotFound"));
    } finally {
      setPickupSearching(false);
    }
  }, [pickupSearch, t]);

  // Gösterilen adres etiketi
  const displayTitle = gpsActive
    ? t("market.currentLocation")
    : selectedAddress?.title ?? t("market.selectAddress");
  const displaySub = gpsActive
    ? (gpsLabel ?? t("market.gettingLocation"))
    : (selectedAddress?.fullAddress ?? t("market.selectDeliveryAddress"));

  // ── Mağaza yükleme ──────────────────────────────────────────────────────────
  const fetchStores = useCallback(async (catKey: UICategoryKey) => {
    // Gel-Al modunda konum çözülmeden sorgu yapma
    if (serviceMode === "pickup" && !pickupLocation) return;

    setLoading(true);
    setError(null);
    try {
      const cat = CATEGORIES.find((c) => c.key === catKey);
      const apiCat = cat?.apiKey ?? undefined;
      let result;
      if (serviceMode === "pickup" && pickupLocation) {
        result = await getStores(pickupLocation.lat, pickupLocation.lng, undefined, apiCat ?? null, true);
      } else {
        // GPS koordinatı varsa yakındaki marketleri mesafeye göre sırala
        const lat = gpsCoords?.lat ?? undefined;
        const lng = gpsCoords?.lng ?? undefined;
        result = await getStores(lat, lng, undefined, apiCat ?? null);
      }
      setStores(result.items);
    } catch {
      setError(t("market.loadError"));
    } finally {
      setLoading(false);
    }
  }, [gpsCoords, serviceMode, pickupLocation]);

  useEffect(() => {
    fetchStores(selectedCategory);
  }, [selectedCategory, fetchStores]);

  // ── Banner + koleksiyon yükleme ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await listActiveBanners({ placement: "market_home_top", region });
        if (!alive) return;
        setBanners(Array.isArray(items) ? items : []);
      } catch {
        if (alive) setBanners([]);
      }
    })();
    return () => { alive = false; };
  }, [region]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getMarketCollections(region);
        if (!alive) return;
        setCollections(Array.isArray(res?.items) ? res.items : []);
      } catch {
        if (alive) setCollections([]);
      }
    })();
    return () => { alive = false; };
  }, [region]);

  const onPressMarketBanner = useCallback((b: BannerItem) => {
    if (b.marketStoreId) {
      navigation.navigate(MarketRoutes.StoreDetail, { storeId: String(b.marketStoreId) });
      return;
    }
    if (b.marketProductId) {
      navigation.navigate(MarketRoutes.ProductDetail, { productId: String(b.marketProductId) });
      return;
    }
    if (b.marketCollectionId) {
      navigation.navigate(MarketRoutes.Collection, {
        collectionId: String(b.marketCollectionId),
        title: b.title ?? undefined,
      });
      return;
    }
    if (b.linkUrl) {
      Linking.openURL(b.linkUrl).catch(() => {});
    }
  }, [navigation]);

  const filtered = stores.filter((s) =>
    searchText.trim() ? s.name.toLowerCase().includes(searchText.toLowerCase()) : true
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketStore>) => {
      let distanceKm: number | null = null;
      if (serviceMode === "pickup" && pickupLocation && item.location?.coordinates) {
        const [lng, lat] = item.location.coordinates;
        distanceKm = haversineKm(pickupLocation.lat, pickupLocation.lng, lat, lng);
      }
      return (
        <StoreCard
          store={item}
          distanceKm={distanceKm}
          onPress={() =>
            navigation.navigate(MarketRoutes.StoreDetail, {
              storeId: item._id,
              storeName: item.name,
              initialServiceMode: serviceMode,
            })
          }
        />
      );
    },
    [navigation, serviceMode, pickupLocation]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* ── Gradient Header ──────────────────────────────────────── */}
      <LinearGradient
        colors={["#0D6E35", "#16A34A", "#22C55E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[hdr.gradient, { paddingTop: insets.top + 6 }]}
      >
        {/* ── Hizmet Modu Seçici ── */}
        <View style={hdr.modeRow}>
          {(["delivery", "pickup"] as const).map((mode) => {
            const active = serviceMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setServiceMode(mode)}
                style={[hdr.modeChip, active && hdr.modeChipActive]}
              >
                <Ionicons
                  name={mode === "delivery" ? "bicycle-outline" : "bag-handle-outline"}
                  size={14}
                  color={active ? "#15803D" : "white"}
                />
                <Text style={[hdr.modeChipText, active && hdr.modeChipTextActive]}>
                  {t(`market.mode.${mode}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Adres Çubuğu ── */}
        {serviceMode === "delivery" ? (
          <Pressable
            style={hdr.addressBar}
            onPress={() => setShowPicker(true)}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
          >
            <View style={hdr.addressIconWrap}>
              <Ionicons name="location" size={16} color="#15803D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hdr.addressLabel}>{t("market.deliveryAddress")}</Text>
              <Text style={hdr.addressValue} numberOfLines={1}>
                {displaySub.length > 36 ? displaySub.slice(0, 36) + "…" : displaySub}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.85)" />
          </Pressable>
        ) : (
          <Pressable
            style={hdr.addressBar}
            onPress={() => setShowPickupPicker(true)}
            android_ripple={{ color: "rgba(255,255,255,0.15)" }}
          >
            <View style={hdr.addressIconWrap}>
              <Ionicons name="bag-handle" size={16} color="#15803D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hdr.addressLabel}>{t("market.pickup.locationLabel")}</Text>
              <Text style={hdr.addressValue} numberOfLines={1}>
                {pickupLocation?.label ?? t("market.gettingLocation")}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.85)" />
          </Pressable>
        )}

        {/* ── Üst bar ── */}
        <View style={hdr.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={hdr.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#15803D" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={hdr.title}>{t("market.title")}</Text>
            <Text style={hdr.subtitle}>{t("market.subtitle")}</Text>
          </View>
          {cartItems.length > 0 && (
            <Pressable
              onPress={() => navigation.navigate(MarketRoutes.Cart)}
              style={hdr.cartBtn}
            >
              <Ionicons name="cart-outline" size={22} color="#15803D" />
              <View style={hdr.cartDot}>
                <Text style={hdr.cartDotText}>{cartItems.length}</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* ── Arama ── */}
        <View style={hdr.searchBar}>
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t("market.searchPlaceholder")}
            placeholderTextColor="#9CA3AF"
            style={hdr.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchText.trim().length >= 2) {
                navigation.navigate(MarketRoutes.Search, {
                  initialQuery: searchText.trim(),
                  lat: gpsCoords?.lat,
                  lng: gpsCoords?.lng,
                });
              }
            }}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* ── Kategori Kartları ────────────────────────────────────── */}
      <View style={cat.wrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={cat.scroll}
        >
          {CATEGORIES.map((item) => {
            const active = selectedCategory === item.key;
            return (
              <Pressable key={item.key} style={cat.card} onPress={() => setSelectedCategory(item.key)}>
                <View style={[cat.iconBox, active && cat.iconBoxActive]}>
                  <CatImage uri={item.imageUrl} fallback={item.fallback} />
                </View>
                <Text style={[cat.label, active && cat.labelActive]} numberOfLines={2}>
                  {t(`market.cat.${item.key}`, { defaultValue: item.label })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Liste ────────────────────────────────────────────────── */}
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListHeaderComponent={
          loading
            ? () => (
                <View>
                  <MarketBannerCarousel banners={banners} onPressBanner={onPressMarketBanner} />
                  {collections.map((c) => (
                    <CollectionSection
                      key={c._id}
                      collection={c}
                      onSeeAll={() =>
                        navigation.navigate(MarketRoutes.Collection, {
                          collectionId: c._id,
                          title: c.title,
                        })
                      }
                      onPressProduct={(p) =>
                        navigation.navigate(MarketRoutes.ProductDetail, { productId: p._id })
                      }
                    />
                  ))}
                  <View style={{ paddingTop: theme.space[3] }}>
                    {[1, 2, 3].map((n) => <StoreCardSkeleton key={n} />)}
                  </View>
                </View>
              )
            : () => (
                <View>
                  <MarketBannerCarousel banners={banners} onPressBanner={onPressMarketBanner} />
                  {collections.map((c) => (
                    <CollectionSection
                      key={c._id}
                      collection={c}
                      onSeeAll={() =>
                        navigation.navigate(MarketRoutes.Collection, {
                          collectionId: c._id,
                          title: c.title,
                        })
                      }
                      onPressProduct={(p) =>
                        navigation.navigate(MarketRoutes.ProductDetail, { productId: p._id })
                      }
                    />
                  ))}
                  <View style={{ paddingTop: theme.space[3] }}>
                    <Text style={[ls.sectionTitle, { color: theme.colors.textPrimary }]}>
                      {t("market.stores")}
                      {filtered.length > 0 && (
                        <Text style={{ color: theme.colors.textSecondary }}>
                          {" "}({filtered.length})
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>
              )
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              illustration="market"
              title={error ? t("market.connectionError") : searchText ? t("market.noResultsTitle") : t("market.noStoreTitle")}
              subtitle={
                error
                  ? t("market.connectionErrorSub")
                  : searchText
                  ? t("market.noResultsQuery", { query: searchText })
                  : t("market.noStoreSub")
              }
              action={
                error
                  ? { label: t("market.retry"), onPress: () => fetchStores(selectedCategory) }
                  : undefined
              }
            />
          ) : null
        }
        contentContainerStyle={{
          paddingHorizontal: theme.space[4],
          paddingBottom: insets.bottom + theme.space[10] + (cartItems.length > 0 ? 72 : 0),
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Sepet çubuğu ─────────────────────────────────────────── */}
      {cartItems.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate(MarketRoutes.Cart)}
          style={[
            fl.bar,
            {
              bottom: insets.bottom + theme.space[4],
              marginHorizontal: theme.space[4],
              borderRadius: theme.radius.lg,
              ...theme.getElevation(3),
            },
          ]}
        >
          <LinearGradient
            colors={["#15803D", "#22C55E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={fl.gradient}
          >
            <View style={fl.countBox}>
              <Text style={fl.countText}>{t("market.cartItems", { count: cartItems.length })}</Text>
            </View>
            <Text style={fl.label}>{t("market.goToCart")}</Text>
            <Text style={fl.total}>{formatCurrency(cartTotal, region, language)}</Text>
          </LinearGradient>
        </Pressable>
      )}

      {/* ── Adres Seçici Modal ───────────────────────────────────── */}
      <AddressPicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        addresses={savedAddresses}
        selectedId={selectedAddressId}
        gpsLabel={gpsLabel}
        gpsActive={gpsActive}
        onSelectAddress={(addr) => { setSelectedAddress(addr); setGpsActive(false); }}
        onSelectGps={() => setGpsActive(true)}
        onAddNew={() => navigation.navigate("Delivery", {
          screen: "CreateAddress",
          params: { backTo: "DeliveryHome" },
        })}
      />

      {/* ── Gel-Al Konum Seçici Modal ─────────────────────────────── */}
      <PickupLocationPicker
        visible={showPickupPicker}
        onClose={() => setShowPickupPicker(false)}
        search={pickupSearch}
        onChangeSearch={setPickupSearch}
        onSearch={handlePickupAreaSearch}
        searching={pickupSearching}
        onUseCurrentLocation={resolvePickupFromGps}
        currentLabel={gpsLabel}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const hdr = StyleSheet.create({
  gradient: { paddingHorizontal: 16, paddingBottom: 20 },

  // Hizmet modu seçici
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
  },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  modeChipActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
  modeChipTextActive: {
    color: "#15803D",
  },

  // Adres çubuğu
  addressBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  addressIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  addressValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "white",
    marginTop: 1,
  },

  // Üst bar
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "500", marginTop: 1 },
  cartBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  cartDot: {
    position: "absolute", top: 5, right: 5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center", justifyContent: "center",
  },
  cartDotText: { fontSize: 9, fontWeight: "900", color: "white" },

  // Arama
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "white", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", fontWeight: "500" },
});

const cat = StyleSheet.create({
  wrapper: {
    backgroundColor: "white",
    paddingTop: 14, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  scroll: { paddingHorizontal: 16, gap: 14 },
  card: { width: 72, alignItems: "center" },
  iconBox: {
    width: 68, height: 68, borderRadius: 34,
    overflow: "hidden",
    borderWidth: 2.5, borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  iconBoxActive: {
    borderColor: "#15803D",
    shadowColor: "#15803D", shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  label: {
    fontSize: 11, fontWeight: "600", color: "#6B7280",
    marginTop: 7, textAlign: "center", lineHeight: 14,
  },
  labelActive: {
    color: "#15803D", fontWeight: "800",
  },
});

const sc = StyleSheet.create({
  card: {
    borderRadius: 16, marginBottom: 12, overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  logoWrap: { width: 62, height: 62, borderRadius: 31, overflow: "hidden", backgroundColor: "#F0FDF4" },
  logoImg: { width: "100%", height: "100%" },
  logoGrad: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  logoLetter: { fontSize: 24, fontWeight: "900", color: "white" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#16A34A", borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  ratingText: { fontSize: 11, fontWeight: "800", color: "white" },
  details: { fontSize: 12, fontWeight: "500", marginBottom: 8 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB",
  },
  badgeFree: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  badgeText: { fontSize: 11, fontWeight: "600" },
  catStrip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
  },
  catText: { fontSize: 11, fontWeight: "600", color: "#6B7280" },
});

const ls = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginBottom: 12 },
});

const cpc = StyleSheet.create({
  card: {
    width: 130,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  thumb: {
    width: "100%",
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 6,
  },
  title: { fontSize: 12, fontWeight: "600" },
  price: { fontSize: 13, fontWeight: "800" },
  priceDisc: { fontSize: 13, fontWeight: "800" },
  badge: {
    backgroundColor: "#DC2626",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
});

const bc = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
  },
  img: { width: "100%", aspectRatio: 2 },
  dotsRow: {
    marginTop: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});

const sk = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 12,
  },
});

const fl = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  gradient: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 8,
  },
  countBox: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  countText: { fontSize: 12, fontWeight: "700", color: "white" },
  label: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: "white" },
  total: { fontSize: 15, fontWeight: "900", color: "white" },
});

// Modal
const pm = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "white",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center", marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: "900", color: "#111827",
    letterSpacing: -0.3, marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: "700", color: "#9CA3AF",
    letterSpacing: 0.4, textTransform: "uppercase",
    marginTop: 16, marginBottom: 8,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 12, borderRadius: 14,
    paddingHorizontal: 10, marginBottom: 4,
  },
  rowActive: { backgroundColor: "#F0FDF4" },
  iconBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#DCFCE7",
    alignItems: "center", justifyContent: "center",
  },
  iconBoxActive: { backgroundColor: "#15803D" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, paddingHorizontal: 10, marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
  },
  addIconBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center",
  },
  addText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#15803D" },
});

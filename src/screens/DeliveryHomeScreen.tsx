// src/screens/DeliveryHomeScreen.tsx
import React from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  ScrollView,
  TextInput,
  Keyboard,
  Platform,
  Image,
  Animated,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Themed";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { useRegion } from "../store/useRegion";
import { useShallow } from "zustand/react/shallow";
import { listDeliveryRestaurants } from "../api/delivery";
import type { DeliveryRestaurant } from "../delivery/deliveryTypes";
import { DeliverySpacing } from "../delivery/deliveryTheme";
import {
  currencySymbolFromRegion,
  formatMoney,
  pickDeliveryMeta,
} from "../delivery/deliveryUtils";
import { useCart } from "../store/useCart";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";
import { useDeliveryAddress } from "../store/useDeliveryAddress";
import { listMyAddresses, type UserAddress } from "../api/addresses";
import { useTheme } from "../contexts/ThemeContext";

// ─── Haversine ────────────────────────────────────────────────────────────────
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

// ─── Adres Seçici Bottom Sheet ───────────────────────────────────────────────
interface AddressSheetProps {
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

function AddressSheet({
  visible, onClose, addresses, selectedId, gpsLabel, gpsActive,
  onSelectAddress, onSelectGps, onAddNew,
}: AddressSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const slide = React.useRef(new Animated.Value(500)).current;

  React.useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={sh.overlay} onPress={onClose} />
      <Animated.View style={[sh.sheet, { paddingBottom: insets.bottom + 16 }, { transform: [{ translateY: slide }] }]}>
        <View style={sh.handle} />
        <Text style={sh.title}>{t("delivery.addressSheetTitle")}</Text>

        {/* GPS */}
        <TouchableOpacity style={[sh.row, gpsActive && sh.rowActive]} onPress={() => { onSelectGps(); onClose(); }} activeOpacity={0.75}>
          <View style={[sh.iconBox, gpsActive && sh.iconBoxActive]}>
            <Ionicons name="locate" size={20} color={gpsActive ? "#fff" : "#C2410C"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sh.rowTitle}>{t("delivery.currentLocation")}</Text>
            <Text style={sh.rowSub} numberOfLines={1}>{gpsLabel ?? t("delivery.gettingLocation")}</Text>
          </View>
          {gpsActive && <Ionicons name="checkmark-circle" size={22} color="#C2410C" />}
        </TouchableOpacity>

        {/* Kayıtlı adresler */}
        {addresses.length > 0 && (
          <Text style={sh.sectionLabel}>{t("delivery.savedAddresses")}</Text>
        )}
        {addresses.map((addr) => {
          const active = !gpsActive && selectedId === String(addr._id);
          return (
            <TouchableOpacity
              key={addr._id}
              style={[sh.row, active && sh.rowActive]}
              onPress={() => { onSelectAddress(addr); onClose(); }}
              activeOpacity={0.75}
            >
              <View style={[sh.iconBox, active && sh.iconBoxActive]}>
                <Ionicons name={addr.isDefault ? "home" : "location"} size={18} color={active ? "#fff" : "#C2410C"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sh.rowTitle} numberOfLines={1}>{addr.title ?? t("delivery.addressLabel")}</Text>
                <Text style={sh.rowSub} numberOfLines={1}>{addr.fullAddress}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color="#C2410C" />}
            </TouchableOpacity>
          );
        })}

        {/* Yeni adres ekle */}
        <TouchableOpacity style={sh.addBtn} onPress={() => { onClose(); onAddNew(); }} activeOpacity={0.8}>
          <View style={sh.addIconBox}>
            <Ionicons name="add" size={20} color="#C2410C" />
          </View>
          <Text style={sh.addText}>{t("delivery.addNewAddress")}</Text>
          <Ionicons name="chevron-forward" size={18} color="#C2410C" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─── Kategori veri (Getir / Trendyol / Yemek Sepeti referans) ────────────────
type DeliveryCategory = {
  key: string;
  label: string;
  imageUrl: string;
  fallback: string; // emoji shown if image fails to load
  keywords: string[];
};

// Unsplash: verified popular food photo IDs
const UNS = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=200&h=200&fit=crop&q=80&auto=format`;
// Pexels: reliable numeric IDs (cropped via their CDN)
const PEX = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=200&h=200`;

const DELIVERY_CATS: DeliveryCategory[] = [
  { key: "all",      label: "Tümü",            fallback: "🍽️", imageUrl: UNS("1546069901-ba9599a7e63c"), keywords: [] },
  { key: "burger",   label: "Hamburger",        fallback: "🍔", imageUrl: UNS("1568901346375-23c9450c58cd"), keywords: ["burger", "hamburger", "smash"] },
  { key: "doner",    label: "Döner",            fallback: "🌯", imageUrl: UNS("1529006557810-274b9b2fc783"), keywords: ["döner", "dürüm", "wrap", "kokoreç"] },
  { key: "pizza",    label: "Pizza",            fallback: "🍕", imageUrl: UNS("1565299624946-b28f40a0ae38"), keywords: ["pizza", "pizzacı"] },
  { key: "cigkofte", label: "Çiğ Köfte",        fallback: "🫔", imageUrl: PEX(10027451),                    keywords: ["çiğ köfte", "cigkofte", "çiğköfte"] },
  { key: "tavuk",    label: "Tavuk",            fallback: "🍗", imageUrl: PEX(9872916),                     keywords: ["tavuk", "chicken", "kanat", "piliç"] },
  { key: "kofte",    label: "Köfte",            fallback: "🥩", imageUrl: PEX(18824002),                    keywords: ["köfte", "kofteci", "izgara"] },
  { key: "kebap",    label: "Kebap",            fallback: "🍢", imageUrl: UNS("1529692236671-f1f6cf9683ba"), keywords: ["kebap", "adana", "urfa", "şiş", "cağ"] },
  { key: "pide",     label: "Pide & Lahmacun",  fallback: "🥙", imageUrl: UNS("1593560708920-61dd98c46a4e"), keywords: ["pide", "lahmacun", "fırın"] },
  { key: "sandvic",  label: "Tost & Sandviç",   fallback: "🥪", imageUrl: UNS("1528735602780-2552fd46c7af"), keywords: ["sandviç", "sandwich", "tost", "toast"] },
  { key: "tantuni",  label: "Tantuni",          fallback: "🌮", imageUrl: PEX(34106235),                    keywords: ["tantuni"] },
  { key: "manti",    label: "Mantı & Makarna",  fallback: "🥟", imageUrl: UNS("1555949258-eb67b1ef0ceb"),   keywords: ["mantı", "makarna", "pasta", "risotto"] },
  { key: "ev",       label: "Ev Yemekleri",     fallback: "🍲", imageUrl: UNS("1547592180-85f173990554"),   keywords: ["ev yemeği", "ev yemek", "ana yemek", "geleneksel"] },
  { key: "pastane",  label: "Pastane & Fırın",  fallback: "🥐", imageUrl: PEX(3341067),                     keywords: ["pastane", "fırın", "börek", "hamur", "simit", "poğaça", "gözleme"] },
  { key: "corba",    label: "Çorba",            fallback: "🍜", imageUrl: UNS("1547592166-23ac45744acd"),   keywords: ["çorba", "soup"] },
  { key: "salata",   label: "Salata & Sağlık",  fallback: "🥗", imageUrl: UNS("1512621776951-a57141f2eefd"), keywords: ["salata", "salad", "bowl", "vegan", "vejetaryen", "organik", "sağlıklı"] },
  { key: "tatli",    label: "Tatlı",            fallback: "🍰", imageUrl: UNS("1551024601-bec78aea704b"),   keywords: ["tatlı", "pasta", "kek", "baklava", "dondurma", "dessert", "waffle"] },
  { key: "kahve",    label: "Kahve & İçecek",   fallback: "☕", imageUrl: UNS("1509042239860-f550ce710b93"), keywords: ["cafe", "kafe", "kahve", "coffee", "espresso", "içecek", "drink", "juice", "smoothie"] },
  { key: "sushi",    label: "Uzak Doğu",        fallback: "🍣", imageUrl: UNS("1579871494447-9811cf80d66c"), keywords: ["sushi", "japon", "ramen", "bento", "çin", "asya", "wok", "noodle", "tayland"] },
  { key: "dunya",    label: "Dünya Mutfağı",    fallback: "🌍", imageUrl: UNS("1414235077428-338989a2e8c0"), keywords: ["italyan", "meksika", "taco", "burrito", "dünya", "world"] },
  { key: "balik",    label: "Balık & Deniz",    fallback: "🐟", imageUrl: UNS("1519708227418-c8fd9a32b7a2"), keywords: ["balık", "deniz", "seafood", "levrek", "çipura"] },
  { key: "sokak",    label: "Sokak Lezzetleri", fallback: "🍡", imageUrl: PEX(29714906),                    keywords: ["sokak", "street", "simit", "midye", "balık ekmek", "fast food", "fastfood"] },
];

function matchCategory(r: import("../delivery/deliveryTypes").DeliveryRestaurant, cat: DeliveryCategory): boolean {
  if (cat.key === "all") return true;
  const bt = String(r.businessType ?? "").toLowerCase();
  const name = r.name.toLowerCase();
  const searchStr = `${bt} ${name}`;
  return cat.keywords.some((kw) => searchStr.includes(kw));
}

// ─── Kategori resmi (CDN fotoğraf, görsel fallback) ─────────────────────────
function CatImage({ uri, fallback }: { uri: string; fallback: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return (
      <LinearGradient
        colors={["#FFEDD5", "#FED7AA"]}
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

// ─── Ana Ekran ────────────────────────────────────────────────────────────────
function clampStr(v: any): string { return String(v ?? "").trim(); }

export default function DeliveryHomeScreen() {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tRef = React.useRef(t);
  React.useEffect(() => { tRef.current = t; }, [t]);

  const { region, regionHydrated } = useRegion(
    useShallow((s: any) => ({ region: s.region, regionHydrated: s.hydrated === true }))
  );

  const { selectedAddressId, selectedAddress, setSelectedAddress } = useDeliveryAddress();
  const cartCount = useCart((s) => s.count());
  const cartSubtotal = useCart((s) => s.subtotal());
  const cartCurrency = useCart((s) => s.currencySymbol);

  const [data, setData] = React.useState<DeliveryRestaurant[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [fetching, setFetching] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [selectedCat, setSelectedCat] = React.useState("all");

  // Adres state
  const [savedAddresses, setSavedAddresses] = React.useState<UserAddress[]>([]);
  const [gpsLabel, setGpsLabel] = React.useState<string | null>(null);
  const [gpsActive, setGpsActive] = React.useState(false);
  const [gpsCoords, setGpsCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [showSheet, setShowSheet] = React.useState(false);

  React.useEffect(() => {
    const tmr = setTimeout(() => setQDebounced(query.trim()), 250);
    return () => clearTimeout(tmr);
  }, [query]);

  // Adres + GPS init
  React.useEffect(() => {
    (async () => {
      let addrs: UserAddress[] = [];
      try {
        addrs = await listMyAddresses();
        setSavedAddresses(addrs);
      } catch { }

      let localGpsCoords: { lat: number; lng: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          localGpsCoords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setGpsCoords(localGpsCoords);
          const geo = await Location.reverseGeocodeAsync(loc.coords);
          const g = geo[0];
          setGpsLabel([g?.district ?? g?.subregion, g?.city].filter(Boolean).join(", ") ||
            `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
        }
      } catch { }

      // Zaten seçili adres varsa güncelle
      if (selectedAddressId) {
        const found = addrs.find((a) => String(a._id) === String(selectedAddressId));
        if (found) { setSelectedAddress(found); setGpsActive(false); return; }
      }

      // GPS ile en yakın adresi bul
      if (localGpsCoords && addrs.length > 0) {
        let nearest = addrs[0]; let minDist = Infinity;
        for (const addr of addrs) {
          const coords = addr.location?.coordinates;
          if (!coords) continue;
          const dist = haversineKm(localGpsCoords.lat, localGpsCoords.lng, coords[1], coords[0]);
          if (dist < minDist) { minDist = dist; nearest = addr; }
        }
        if (minDist < 50) { setSelectedAddress(nearest); setGpsActive(false); return; }
      }

      // Default adres
      const def = addrs.find((a) => a.isDefault);
      if (def) { setSelectedAddress(def); setGpsActive(false); return; }

      if (gpsLabel) setGpsActive(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gösterilen adres
  const displaySub = gpsActive
    ? (gpsLabel ?? t("delivery.gettingLocation"))
    : (selectedAddress?.fullAddress ?? t("delivery.selectAddress"));

  const inflightRef = React.useRef(false);
  const lastSigRef = React.useRef("");
  const didInitialRef = React.useRef(false);

  const load = React.useCallback(async (mode: "initial" | "update" = "update") => {
    if (!regionHydrated) return;
    if (!selectedAddressId && !gpsCoords) return;  // need address OR gps

    const sig = JSON.stringify({ selectedAddressId, gpsCoords, mode });
    if (inflightRef.current && sig === lastSigRef.current) return;
    inflightRef.current = true;
    lastSigRef.current = sig;
    try {
      setError(null);
      if (mode === "initial") setInitialLoading(true); else setFetching(true);

      const args = selectedAddressId
        ? { addressId: selectedAddressId }
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

  useFocusEffect(React.useCallback(() => {
    if (!regionHydrated || (!selectedAddressId && !gpsCoords)) return;
    const mode: "initial" | "update" = didInitialRef.current ? "update" : "initial";
    didInitialRef.current = true;
    load(mode);
  }, [regionHydrated, selectedAddressId, gpsCoords, load]));

  const onRefresh = React.useCallback(async () => {
    try { setRefreshing(true); await load("update"); } finally { setRefreshing(false); }
  }, [load]);

  const currencySymbol = React.useMemo(() => currencySymbolFromRegion(region), [region]);

  const goRestaurant = React.useCallback((r: DeliveryRestaurant) => {
    const id = String(r._id || "");
    if (!id) return;
    nav.navigate(DeliveryRoutes.DeliveryRestaurant, { restaurantId: id, restaurantPreview: r });
  }, [nav]);

  const filteredData = React.useMemo(() => {
    const q = clampStr(qDebounced).toLowerCase();
    const cat = DELIVERY_CATS.find((c) => c.key === selectedCat) ?? DELIVERY_CATS[0];
    return (data || []).filter((r) => {
      if (q) {
        const hay = `${r?.name || ""} ${r?.address || ""} ${r?.city || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return matchCategory(r, cat);
    });
  }, [data, qDebounced, selectedCat]);

  const renderCard = React.useCallback(({ item, index }: { item: DeliveryRestaurant; index: number }) => {
    const logo = item?.logoUrl || item?.photos?.[0] || null;
    const meta = pickDeliveryMeta(item);
    const minOrder = typeof meta?.minOrder === "number" ? meta.minOrder : null;
    const etaText = clampStr(meta?.etaText) || null;
    const distanceText = clampStr(meta?.distanceText) || null;
    const rating = typeof item.rating === "number" ? item.rating : null;
    const isFreeDelivery = item.deliveryFee === 0;

    return (
      <AnimCard index={index}>
        <Pressable
          onPress={() => goRestaurant(item)}
          style={({ pressed }) => [
            rc.card,
            { backgroundColor: theme.colors.surface, opacity: pressed ? 0.93 : 1 },
            theme.getElevation(1),
          ]}
        >
          <View style={rc.row}>
            {/* Logo */}
            <View style={rc.logoBox}>
              {logo ? (
                <Image source={{ uri: logo }} style={rc.logo} resizeMode="contain" />
              ) : (
                <LinearGradient colors={["#9A3412", "#EA580C"]} style={rc.logoFallback}>
                  <Ionicons name="restaurant-outline" size={26} color="rgba(255,255,255,0.85)" />
                </LinearGradient>
              )}
            </View>

            {/* Bilgi */}
            <View style={{ flex: 1, gap: 4 }}>
              {/* İsim + puan */}
              <View style={rc.nameRow}>
                <Text style={[rc.name, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {rating != null && (
                  <View style={rc.ratingBadge}>
                    <Ionicons name="star" size={11} color="white" />
                    <Text style={rc.ratingText}>{rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>

              {/* Süre + Min tutar */}
              <View style={rc.detailRow}>
                {etaText ? (
                  <Text style={[rc.detailText, { color: theme.colors.textSecondary }]}>{etaText}</Text>
                ) : null}
                {etaText && minOrder != null ? (
                  <Text style={[rc.detailText, { color: theme.colors.textTertiary }]}>·</Text>
                ) : null}
                {minOrder != null ? (
                  <View style={rc.minOrderBadge}>
                    <Text style={rc.minOrderText}>Min. ₺{minOrder}</Text>
                  </View>
                ) : null}
              </View>

              {/* Chip'ler */}
              <View style={rc.chipRow}>
                {distanceText ? (
                  <View style={[rc.chip, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                    <Ionicons name="navigate-outline" size={11} color="#C2410C" />
                    <Text style={[rc.chipText, { color: "#C2410C" }]}>{distanceText}</Text>
                  </View>
                ) : null}
                {isFreeDelivery ? (
                  <View style={[rc.chip, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                    <Ionicons name="bicycle-outline" size={11} color="#15803D" />
                    <Text style={[rc.chipText, { color: "#15803D" }]}>{t("delivery.freeDelivery")}</Text>
                  </View>
                ) : item.deliveryActive ? (
                  <View style={[rc.chip, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                    <Ionicons name="bicycle-outline" size={11} color="#15803D" />
                    <Text style={[rc.chipText, { color: "#15803D" }]}>{t("delivery.deliveryChip")}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Pressable>
      </AnimCard>
    );
  }, [goRestaurant, region, theme]);

  const isLoading = !regionHydrated || initialLoading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>

      {/* ── Gradient Header ─────────────────────────────────────── */}
      <LinearGradient
        colors={["#9A3412", "#C2410C", "#EA580C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[hdr.gradient, { paddingTop: insets.top + 6 }]}
      >
        {/* Adres çubuğu */}
        <Pressable style={hdr.addressBar} onPress={() => setShowSheet(true)}>
          <View style={hdr.addressIconWrap}>
            <Ionicons name="location" size={16} color="#C2410C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hdr.addressLabel}>{t("delivery.deliveryAddress")}</Text>
            <Text style={hdr.addressValue} numberOfLines={1}>
              {displaySub.length > 36 ? displaySub.slice(0, 36) + "…" : displaySub}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>

        {/* Üst bar */}
        <View style={hdr.topBar}>
          <Pressable onPress={() => nav.goBack()} hitSlop={12} style={hdr.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#C2410C" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={hdr.title}>{t("delivery.title")}</Text>
            <Text style={hdr.subtitle}>{t("delivery.subtitle")}</Text>
          </View>
          {cartCount > 0 && (
            <Pressable onPress={() => nav.navigate(DeliveryRoutes.Cart)} style={hdr.cartBtn}>
              <Ionicons name="cart-outline" size={22} color="#C2410C" />
              <View style={hdr.cartDot}>
                <Text style={hdr.cartDotText}>{cartCount}</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Arama */}
        <View style={hdr.searchBar}>
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("delivery.searchPlaceholder")}
            placeholderTextColor="#9CA3AF"
            style={hdr.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {!!query && (
            <Pressable onPress={() => { setQuery(""); Keyboard.dismiss(); }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* ── Kategori Şeridi ─────────────────────────────────────── */}
      <View style={catS.wrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={catS.scroll}>
          {DELIVERY_CATS.map((cat) => {
            const active = selectedCat === cat.key;
            return (
              <Pressable key={cat.key} style={catS.card} onPress={() => setSelectedCat(cat.key)}>
                <View style={[catS.iconBox, active && catS.iconBoxActive]}>
                  <CatImage uri={cat.imageUrl} fallback={cat.fallback} />
                </View>
                <Text style={[catS.label, active && catS.labelActive]} numberOfLines={2}>
                  {t(`delivery.cat.${cat.key}`, { defaultValue: cat.label })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Liste ───────────────────────────────────────────────── */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#C2410C" />
          <Text style={{ color: theme.colors.textSecondary, marginTop: 12, fontWeight: "600" }}>
            {t("delivery.loadingRestaurants")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(i) => String(i._id)}
          renderItem={renderCard}
          contentContainerStyle={{
            paddingHorizontal: DeliverySpacing.screenX,
            paddingTop: 16,
            paddingBottom: (cartCount > 0 ? 100 : 24) + (Platform.OS === "ios" ? 10 : 0),
            flexGrow: 1,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={() => (
            <View style={{ paddingBottom: 10 }}>
              <Text style={[ls.title, { color: theme.colors.textPrimary }]}>
                {t("delivery.restaurants")}
                {filteredData.length > 0 && (
                  <Text style={{ color: theme.colors.textSecondary }}> ({filteredData.length})</Text>
                )}
              </Text>
              {fetching && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <ActivityIndicator size="small" color="#C2410C" />
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{t("delivery.updating")}</Text>
                </View>
              )}
              {!!error && (
                <View style={ls.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                  <Text style={{ color: theme.colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
                </View>
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C2410C" colors={["#C2410C"]} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", gap: 16, paddingVertical: 48 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="storefront-outline" size={40} color="#C2410C" />
              </View>
              <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 18 }}>
                {query ? t("delivery.noResults") : t("delivery.noRestaurant")}
              </Text>
              <Text style={{ textAlign: "center", color: theme.colors.textSecondary, lineHeight: 20, paddingHorizontal: 32 }}>
                {query
                  ? t("delivery.noResultsQuery", { query })
                  : t("delivery.noRestaurantSub")}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Sepet Çubuğu ────────────────────────────────────────── */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => nav.navigate(DeliveryRoutes.Cart)}
          style={[cb.bar, { bottom: insets.bottom + 16, marginHorizontal: 16, borderRadius: 16, ...theme.getElevation(3) }]}
        >
          <LinearGradient
            colors={["#C2410C", "#EA580C"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={cb.gradient}
          >
            <View style={cb.countBox}>
              <Text style={cb.countText}>{t("delivery.cartItems", { count: cartCount })}</Text>
            </View>
            <Text style={cb.label}>{t("delivery.goToCart")}</Text>
            <Text style={cb.total}>{formatMoney(cartSubtotal, cartCurrency || currencySymbol)}</Text>
          </LinearGradient>
        </Pressable>
      )}

      {/* ── Adres Seçici ─────────────────────────────────────────── */}
      <AddressSheet
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        addresses={savedAddresses}
        selectedId={selectedAddressId}
        gpsLabel={gpsLabel}
        gpsActive={gpsActive}
        onSelectAddress={(addr) => { setSelectedAddress(addr); setGpsActive(false); }}
        onSelectGps={() => setGpsActive(true)}
        onAddNew={() => nav.navigate(DeliveryRoutes.CreateAddress, { backTo: DeliveryRoutes.DeliveryHome })}
      />
    </View>
  );
}

// ─── AnimCard ─────────────────────────────────────────────────────────────────
function AnimCard({ children, index }: { children: React.ReactNode; index: number }) {
  const fade = React.useRef(new Animated.Value(0)).current;
  const slide = React.useRef(new Animated.Value(16)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, delay: index * 45, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 350, delay: index * 45, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const hdr = StyleSheet.create({
  gradient: { paddingHorizontal: 16, paddingBottom: 20 },
  addressBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12, gap: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  addressIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "white", alignItems: "center", justifyContent: "center",
  },
  addressLabel: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.75)", letterSpacing: 0.3, textTransform: "uppercase" },
  addressValue: { fontSize: 13, fontWeight: "700", color: "white", marginTop: 1 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "500", marginTop: 1 },
  cartBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center",
  },
  cartDot: {
    position: "absolute", top: 5, right: 5,
    width: 16, height: 16, borderRadius: 8, backgroundColor: "#DC2626",
    alignItems: "center", justifyContent: "center",
  },
  cartDotText: { fontSize: 9, fontWeight: "900", color: "white" },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "white", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", fontWeight: "500" },
});

const rc = StyleSheet.create({
  card: { borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  logoBox: {
    width: 76, height: 76, borderRadius: 16, overflow: "hidden",
    backgroundColor: "#FFF7ED",
    borderWidth: 1, borderColor: "#FED7AA",
  },
  logo: { width: "100%", height: "100%" },
  logoFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3, flex: 1 },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EA580C", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  ratingText: { fontSize: 11, fontWeight: "800", color: "white" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, fontWeight: "500" },
  minOrderBadge: {
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  minOrderText: { fontSize: 11, fontWeight: "800", color: "#C2410C" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "600" },
});

const catS = StyleSheet.create({
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
    borderColor: "#C2410C",
    shadowColor: "#C2410C", shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  label: {
    fontSize: 11, fontWeight: "600", color: "#6B7280",
    marginTop: 7, textAlign: "center", lineHeight: 14,
  },
  labelActive: {
    color: "#C2410C", fontWeight: "800",
  },
});

const ls = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, marginTop: 8,
  },
});

const cb = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  gradient: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  countBox: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: "700", color: "white" },
  label: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: "white" },
  total: { fontSize: 15, fontWeight: "900", color: "white" },
});

const sh = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 17, fontWeight: "900", color: "#111827", letterSpacing: -0.3, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderRadius: 14, paddingHorizontal: 10, marginBottom: 4 },
  rowActive: { backgroundColor: "#FFF7ED" },
  iconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFEDD5", alignItems: "center", justifyContent: "center" },
  iconBoxActive: { backgroundColor: "#C2410C" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  rowSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 14, paddingHorizontal: 10, marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB",
  },
  addIconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  addText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#C2410C" },
});

// src/screens/DeliveryHomeScreen.tsx - MODERN VERSION
import React from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TextInput,
  Keyboard,
  Platform,
  Image,
  Animated,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Text } from "../components/Themed";
import { useI18n } from "../i18n";
import { useRegion } from "../store/useRegion";
import { useShallow } from "zustand/react/shallow";
import { listDeliveryRestaurants } from "../api/delivery";
import type { DeliveryRestaurant } from "../delivery/deliveryTypes";
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
import {
  currencySymbolFromRegion,
  formatMoney,
  pickDeliveryMeta,
} from "../delivery/deliveryUtils";
import { useCart } from "../store/useCart";
import Ionicons from "@expo/vector-icons/Ionicons";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";
import { useDeliveryAddress } from "../store/useDeliveryAddress";

function clampStr(v: any): string {
  return String(v ?? "").trim();
}

export default function DeliveryHomeScreen() {
  const nav = useNavigation<any>();
  const { t } = useI18n();
  const tRef = React.useRef(t);
  
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  const { region, regionHydrated } = useRegion(
    useShallow((s: any) => ({
      region: s.region,
      regionHydrated: s.hydrated === true,
    }))
  );

  const selectedAddressId = useDeliveryAddress((s) => s.selectedAddressId);
  const selectedAddress = useDeliveryAddress((s) => s.selectedAddress);

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
  
  React.useEffect(() => {
    const tmr = setTimeout(() => setQDebounced(query.trim()), 250);
    return () => clearTimeout(tmr);
  }, [query]);

  const didRedirectRef = React.useRef(false);
  
  React.useEffect(() => {
    if (!regionHydrated) return;

    if (!selectedAddressId) {
      if (didRedirectRef.current) return;
      didRedirectRef.current = true;

      const id = setTimeout(() => {
        nav.navigate(DeliveryRoutes.AddressPicker, {
          returnTo: DeliveryRoutes.DeliveryHome,
          currentAddressId: selectedAddressId || undefined,
        });
      }, 0);

      return () => clearTimeout(id);
    }

    didRedirectRef.current = false;
  }, [regionHydrated, selectedAddressId, nav]);

  const inflightRef = React.useRef(false);
  const lastSigRef = React.useRef("");
  const didInitialRef = React.useRef(false);

  const load = React.useCallback(
    async (mode: "initial" | "update" = "update") => {
      if (!regionHydrated) return;
      if (!selectedAddressId) return;

      const sig = JSON.stringify({
        addressId: selectedAddressId,
        mode,
      });
      if (inflightRef.current && sig === lastSigRef.current) return;

      inflightRef.current = true;
      lastSigRef.current = sig;

      try {
        setError(null);
        if (mode === "initial") setInitialLoading(true);
        else setFetching(true);

        const resp = await listDeliveryRestaurants({ addressId: selectedAddressId });
        const items = Array.isArray(resp?.items) ? resp.items : [];
        const filtered = items.filter((r) => r?.deliveryActive !== false);

        setData(filtered);
      } catch (e: any) {
        const raw = e?.response?.data;
        const msg =
          raw?.message ||
          e?.message ||
          tRef.current?.("common.error") ||
          "Bir hata oluştu";
        setError(msg);
        setData([]);
      } finally {
        inflightRef.current = false;
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
      }
    },
    [regionHydrated, selectedAddressId]
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!regionHydrated) return;
      if (!selectedAddressId) return;

      const mode: "initial" | "update" = didInitialRef.current ? "update" : "initial";
      didInitialRef.current = true;

      load(mode);
    }, [regionHydrated, selectedAddressId, load])
  );

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await load("update");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const currencySymbol = React.useMemo(() => currencySymbolFromRegion(region), [region]);

 const goRestaurant = React.useCallback(
  (r: DeliveryRestaurant) => {
    const id = String(r._id || "");
    if (!id) return;
    nav.navigate(DeliveryRoutes.DeliveryRestaurant, {
      restaurantId: id,
      restaurantPreview: r, // ✅ liste ekranındaki dolu data
    });
  },
  [nav]
);
  const filteredData = React.useMemo(() => {
    const q = clampStr(qDebounced).toLowerCase();
    if (!q) return data || [];

    return (data || []).filter((r) => {
      const hay = `${r?.name || ""} ${r?.address || ""} ${r?.city || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, qDebounced]);

  const renderCard = React.useCallback(
    ({ item, index }: { item: DeliveryRestaurant; index: number }) => {
      const photo = item?.photos?.[0] || null;
      const meta = pickDeliveryMeta(item);
      const symbol = currencySymbolFromRegion(item?.region || region);

      const minOrderText =
        typeof meta?.minOrder === "number"
          ? `${tRef.current?.("delivery.minBasket", { defaultValue: "Min" }) ?? "Min"} ${formatMoney(meta.minOrder, symbol)}`
          : `${tRef.current?.("delivery.minBasket", { defaultValue: "Min" }) ?? "Min"} —`;

      const etaText = clampStr(meta?.etaText) || "—";
      const distanceText = clampStr(meta?.distanceText) || "—";
      const rating = typeof item.rating === "number" ? item.rating : null;
      const ratingText = rating ? rating.toFixed(1) : null;

      return (
        <AnimatedCard index={index}>
          <Pressable
            onPress={() => goRestaurant(item)}
            style={({ pressed }) => [
              {
                backgroundColor: "#fff",
                borderRadius: 20,
                overflow: "hidden",
                borderWidth: 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
              },
              pressed && { 
                transform: [{ scale: 0.98 }],
                shadowOpacity: 0.12,
              },
            ]}
          >
            {/* Image with gradient overlay */}
            <View style={{ height: 160, backgroundColor: "#F9FAFB", position: 'relative' }}>
              {photo ? (
                <>
                  <Image
                    source={{ uri: photo }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  {/* Gradient overlay for better text readability */}
                  <View 
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 80,
                      backgroundColor: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
                    }}
                  />
                </>
              ) : (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="restaurant-outline" size={42} color="#D1D5DB" />
                </View>
              )}

              {/* Floating rating badge */}
              {ratingText && (
                <View
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 12,
                    backgroundColor: "rgba(255,255,255,0.95)",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <Ionicons name="star" size={16} color="#FCD34D" />
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 14 }}>
                    {ratingText}
                  </Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827", letterSpacing: -0.3 }}>
                  {item.name}
                </Text>
                {!!item.address && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      lineHeight: 18,
                    }}
                    numberOfLines={1}
                  >
                    <Ionicons name="location-outline" size={13} color="#9CA3AF" /> {item.address}
                  </Text>
                )}
              </View>

              {/* Modern info chips */}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <ModernChip icon="time-outline" text={etaText} color="#10B981" />
                <ModernChip icon="wallet-outline" text={minOrderText} color="#F59E0B" />
                <ModernChip icon="navigate-outline" text={distanceText} color="#3B82F6" />
              </View>
            </View>
          </Pressable>
        </AnimatedCard>
      );
    },
    [goRestaurant, region]
  );

  if (!regionHydrated) {
    return <LoadingScreen text={tRef.current?.("home.loading") ?? "Yükleniyor…"} />;
  }

  if (!selectedAddressId) {
    return <LoadingScreen text={tRef.current?.("delivery.loading", { defaultValue: "Adres seçiliyor…" }) ?? "Adres seçiliyor…"} />;
  }

  if (initialLoading) {
    return <LoadingScreen text={tRef.current?.("delivery.loading", { defaultValue: "Paket servis restoranları yükleniyor…" }) ?? "Paket servis restoranları yükleniyor…"} />;
  }

  const bottomBarVisible = cartCount > 0;

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Modern Header with gradient */}
      <View
        style={{
          paddingHorizontal: DeliverySpacing.screenX,
          paddingTop: 16,
          paddingBottom: 16,
          gap: 12,
          backgroundColor: '#fff',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        {/* Address selector with modern design */}
        <Pressable
          onPress={() => nav.navigate(DeliveryRoutes.AddressPicker)}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
            },
            pressed && { transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: DeliveryColors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Ionicons name="location" size={18} color="#fff" />
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", color: "#111827", fontSize: 14 }}>
              {selectedAddress?.title || (tRef.current?.("delivery.address", { defaultValue: "Teslimat adresi" }) ?? "Teslimat adresi")}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 2, color: "#6B7280" }}>
              {selectedAddress?.fullAddress || "—"}
            </Text>
          </View>
          
          <Ionicons name="chevron-forward" size={20} color={DeliveryColors.primary} />
        </Pressable>

        {/* Modern search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1.5,
            borderColor: query ? DeliveryColors.primary : "#E5E7EB",
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: Platform.select({ ios: 12, android: 10 }),
            backgroundColor: "#fff",
          }}
        >
          <Ionicons name="search" size={20} color={query ? DeliveryColors.primary : "#9CA3AF"} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tRef.current?.("delivery.searchPlaceholder", { defaultValue: "Restoran ara" }) ?? "Restoran ara"}
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontSize: 15, color: "#111827", fontWeight: "600" }}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {!!query && (
            <Pressable
              onPress={() => {
                setQuery("");
                Keyboard.dismiss();
              }}
              hitSlop={10}
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={16} color="#6B7280" />
            </Pressable>
          )}
        </View>

        {fetching && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <ActivityIndicator size="small" color={DeliveryColors.primary} />
            <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>
              {tRef.current?.("delivery.updating", { defaultValue: "Güncelleniyor…" }) ?? "Güncelleniyor…"}
            </Text>
          </View>
        )}

        {!!error && (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FCA5A5",
              padding: 12,
              borderRadius: 14,
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Ionicons name="alert-circle" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: "#DC2626", fontSize: 13 }}>
                {tRef.current?.("common.error") ?? "Hata"}
              </Text>
              <Text style={{ color: "#991B1B", marginTop: 2, fontSize: 12 }}>
                {error}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Restaurant list */}
      <FlatList
        data={filteredData}
        keyExtractor={(i) => String(i._id)}
        renderItem={renderCard}
        contentContainerStyle={{
          paddingHorizontal: DeliverySpacing.screenX,
          paddingTop: 16,
          paddingBottom: (bottomBarVisible ? 100 : 24) + (Platform.OS === "ios" ? 10 : 0),
          gap: 16,
        }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={DeliveryColors.primary}
            colors={[DeliveryColors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center", gap: 12 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#FEF2F2",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons name="storefront-outline" size={40} color={DeliveryColors.primary} />
            </View>
            <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>
              {tRef.current?.("delivery.noResultsTitle", { defaultValue: "Restoran bulunamadı" }) ?? "Restoran bulunamadı"}
            </Text>
            <Text style={{ textAlign: "center", color: "#6B7280", lineHeight: 20 }}>
              {tRef.current?.("delivery.noResultsBody", { defaultValue: "Filtreleri değiştirip tekrar deneyin." }) ??
                "Filtreleri değiştirip tekrar deneyin."}
            </Text>
          </View>
        }
      />

      {/* Modern floating cart button */}
      {bottomBarVisible && (
        <ModernCartButton
          count={cartCount}
          subtotal={cartSubtotal}
          currency={cartCurrency || currencySymbol}
          onPress={() => nav.navigate(DeliveryRoutes.Cart)}
          t={tRef.current}
        />
      )}
    </View>
  );
}

// Modern animated card wrapper
function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Modern chip component
function ModernChip({ icon, text, color }: { icon: any; text: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: `${color}10`,
      }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontSize: 12, fontWeight: "800", color: color }}>
        {text}
      </Text>
    </View>
  );
}

// Modern loading screen
function LoadingScreen({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <View style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#FEF2F2",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <ActivityIndicator size="large" color={DeliveryColors.primary} />
      </View>
      <Text style={{ color: "#6B7280", fontWeight: "600" }}>
        {text}
      </Text>
    </View>
  );
}

// Modern cart button
function ModernCartButton({ count, subtotal, currency, onPress, t }: any) {
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [count]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: DeliverySpacing.screenX,
        right: DeliverySpacing.screenX,
        bottom: 16,
        transform: [{ scale: scaleAnim }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          {
            backgroundColor: DeliveryColors.primary,
            borderRadius: 20,
            paddingHorizontal: 20,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: DeliveryColors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 8,
          },
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              minWidth: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.25)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>{count}</Text>
          </View>

          <View>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
              {t?.("delivery.subtotal", { defaultValue: "Ara Toplam" }) ?? "Ara Toplam"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.95)", fontWeight: "800", marginTop: 2, fontSize: 16 }}>
              {formatMoney(subtotal, currency)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
            {t?.("delivery.viewCart", { defaultValue: "Sepet" }) ?? "Sepet"}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
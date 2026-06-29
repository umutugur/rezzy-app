// src/screens/market/MarketStoreScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { effectivePrice, discountPercent } from "../../utils/marketPrice";
import { Badge, EmptyState, PriceTag, ReviewSection, Skeleton, StarRating } from "../../components/ui";
import { getProducts, getStoreCategories, getStoreDetail, type MarketProduct, type MarketStore, type StoreCategory } from "../../api/market.api";
import { listActiveBanners, type BannerItem } from "../../api/banners";
import {
  computeSubtotal,
  useMarketCart,
} from "../../store/useMarketStore";
import type { MarketStackParams } from "../../navigation/marketRoutes";
import { MarketRoutes } from "../../navigation/marketRoutes";

type RouteT = RouteProp<MarketStackParams, typeof MarketRoutes.StoreDetail>;

// ─── Ürün satırı ───────────────────────────────────────────────────────────────

function ProductRow({
  product,
  qty,
  onAdd,
  onRemove,
  onPress,
  region,
  language,
}: {
  product: MarketProduct;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onPress: () => void;
  region: string;
  language: string;
}) {
  const theme = useTheme();
  // For org (chain-catalog) items use isAvailable; for local items fall back to stock count.
  const photoUri = (product.source === "org" ? product.imageUrl : product.photos[0]) ?? product.photos[0] ?? null;
  const outOfStock =
    product.source === "org"
      ? product.isAvailable === false
      : product.stock === 0;
  const pct = discountPercent(product);
  const eff = effectivePrice(product);

  return (
    <View
      style={[
        styles.productRow,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderDefault,
          opacity: outOfStock ? 0.55 : 1,
        },
      ]}
    >
      {/* Tappable: photo + info */}
      <Pressable
        onPress={onPress}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: theme.space[3] }}
      >
        {/* Fotoğraf */}
        <View style={[styles.productPhoto, { backgroundColor: theme.market.light }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={26} color={theme.market.main} />
          )}
          {pct > 0 && !outOfStock && (
            <View style={[styles.discountTag, { backgroundColor: theme.colors.error }]}>
              <Text style={styles.discountTagText}>%{pct}</Text>
            </View>
          )}
          {outOfStock && (
            <View style={styles.oosOverlay}>
              <Text style={styles.oosText}>Tükendi</Text>
            </View>
          )}
        </View>

        {/* Bilgi */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }}
            numberOfLines={2}
          >
            {product.title}
          </Text>
          {product.description ? (
            <Text
              style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}
              numberOfLines={1}
            >
              {product.description}
            </Text>
          ) : null}
          {pct > 0 ? (
            <View style={styles.priceRow}>
              <Text style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }}>
                {formatCurrency(eff, region, language)}
              </Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, textDecorationLine: "line-through" }}>
                {formatCurrency(product.price, region, language)}
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 1 }}>
              <PriceTag amount={product.price} size="sm" />
            </View>
          )}
        </View>
      </Pressable>

      {/* Adet seçici */}
      {qty > 0 ? (
        <View style={[styles.stepper, { backgroundColor: theme.market.light, borderColor: theme.market.main }]}>
          <Pressable onPress={onRemove} hitSlop={6} style={styles.stepBtn}>
            <Ionicons name="remove" size={18} color={theme.market.main} />
          </Pressable>
          <Text style={{ ...theme.typography.labelLg, color: theme.market.main, minWidth: 18, textAlign: "center" }}>
            {qty}
          </Text>
          <Pressable onPress={onAdd} hitSlop={6} style={styles.stepBtn}>
            <Ionicons name="add" size={18} color={theme.market.main} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={[
            styles.addBtn,
            {
              backgroundColor: outOfStock ? theme.colors.surfaceAlt : theme.market.main,
              borderColor: outOfStock ? theme.colors.borderDefault : theme.market.main,
            },
            !outOfStock && theme.getElevation(1),
          ]}
        >
          <Ionicons name="add" size={20} color={outOfStock ? theme.colors.textTertiary : theme.colors.textInverse} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ProductRowSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.productRow,
        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderDefault, gap: theme.space[3] },
      ]}
    >
      <Skeleton width={60} height={60} borderRadius={theme.radius.lg} />
      <View style={{ flex: 1, gap: theme.space[2] }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={34} height={34} borderRadius={theme.radius.full} />
    </View>
  );
}

// ─── Ekran ─────────────────────────────────────────────────────────────────────

export default function MarketStoreScreen() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteT>();
  const { storeId, initialServiceMode } = route.params;

  const [store, setStore] = useState<MarketStore | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [storeBanner, setStoreBanner] = useState<BannerItem | null>(null);

  const PAGE_SIZE = 40;

  const cartItems = useMarketCart((s) => s.items);
  const cartStoreId = useMarketCart((s) => s.storeId);
  const addItem = useMarketCart((s) => s.addItem);
  const removeItem = useMarketCart((s) => s.removeItem);
  const updateQty = useMarketCart((s) => s.updateQty);
  const setDeliveryType = useMarketCart((s) => s.setDeliveryType);
  const setPickupOnly = useMarketCart((s) => s.setPickupOnly);

  // Sepet bu market için kuruluyorsa (boş ya da zaten bu mağaza), keşif moduna göre
  // teslimat tipini ve gel-al kilidini ayarla. Dolu/başka mağaza sepetini bozma.
  useEffect(() => {
    if (cartStoreId && cartStoreId !== storeId) return;
    if (cartItems.length > 0 && cartStoreId !== storeId) return;
    if (initialServiceMode === "pickup") {
      setPickupOnly(true);
      if (cartItems.length === 0) setDeliveryType("pickup");
    } else if (initialServiceMode === "delivery") {
      setPickupOnly(false);
    }
  }, [initialServiceMode, storeId, cartStoreId, cartItems.length, setPickupOnly, setDeliveryType]);

  const cartSubtotal = useMemo(() => computeSubtotal(cartItems), [cartItems]);
  const cartCount = cartItems.reduce((acc, i) => acc + i.qty, 0);

  // Mevcut mağazadaki sepet öğeleri
  const storeCartItems = useMemo(
    () => cartItems.filter((i) => String(i.product.store) === storeId),
    [cartItems, storeId],
  );

  const qtyForProduct = useCallback(
    (productId: string) => {
      return storeCartItems.find((i) => i.product._id === productId)?.qty ?? 0;
    },
    [storeCartItems],
  );

  // Kategori tab'ları — sunucudan gelen tam kategori listesi (i18n)
  const categoryTabs = useMemo(
    () =>
      categories.map((c) => ({
        id: c._id,
        label:
          (c.i18n as any)?.[language]?.title ??
          c.i18n?.tr?.title ??
          c.i18n?.en?.title ??
          c.key,
      })),
    [categories, language],
  );

  // Mağaza detayı + tam kategori listesi (storeId başına bir kez)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storeData, cats] = await Promise.all([
          getStoreDetail(storeId),
          getStoreCategories(storeId),
        ]);
        if (cancelled) return;
        setStore(storeData);
        setCategories(cats);
      } catch {
        /* sessiz; ürün effecti ana yükleme hatasını yönetir */
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  // Arama debounce (300ms)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(searchQ), 300);
    return () => clearTimeout(id);
  }, [searchQ]);

  // Ürünler — ilk sayfa; storeId / kategori / arama değişince sıfırla & yeniden çek
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getProducts(storeId, selectedCategory, debouncedQ, 1, PAGE_SIZE);
        if (cancelled) return;
        setProducts(res.items);
        setTotal(res.total);
        setPage(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, selectedCategory, debouncedQ]);

  // Sonsuz kaydırma — sonraki sayfa
  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (products.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getProducts(storeId, selectedCategory, debouncedQ, next, PAGE_SIZE);
      setProducts((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, products.length, total, page, storeId, selectedCategory, debouncedQ]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await listActiveBanners({ placement: "market_store_top", region });
        if (!alive) return;
        const match = items.find((b) => String(b.marketStoreId) === String(storeId));
        setStoreBanner(match ?? null);
      } catch {
        if (alive) setStoreBanner(null);
      }
    })();
    return () => { alive = false; };
  }, [storeId, region]);

  const onPressStoreBanner = useCallback(() => {
    if (!storeBanner) return;
    if (storeBanner.marketProductId) {
      navigation.navigate(MarketRoutes.ProductDetail, { productId: String(storeBanner.marketProductId) });
      return;
    }
    if (storeBanner.marketCollectionId) {
      navigation.navigate(MarketRoutes.Collection, {
        collectionId: String(storeBanner.marketCollectionId),
        title: storeBanner.title ?? undefined,
      });
      return;
    }
    if (storeBanner.linkUrl) {
      Linking.openURL(storeBanner.linkUrl).catch(() => {});
    }
  }, [storeBanner, navigation]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketProduct>) => {
      const qty = qtyForProduct(item._id);
      return (
        <ProductRow
          product={item}
          qty={qty}
          onAdd={() => addItem(item)}
          onRemove={() => {
            if (qty === 1) removeItem(item._id);
            else updateQty(item._id, qty - 1);
          }}
          onPress={() => navigation.navigate(MarketRoutes.ProductDetail, { productId: item._id, storeId })}
          region={region}
          language={language}
        />
      );
    },
    [qtyForProduct, addItem, removeItem, updateQty, navigation, region, language],
  );

  const logoUri = store?.logo ?? store?.photos?.[1] ?? null;
  const storeLetter = store?.name?.trim()[0]?.toUpperCase() ?? "M";

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surfaceAlt }]}>
      {/* Store header */}
      {store && (
        <View style={[styles.storeHeader, { backgroundColor: theme.colors.surface }]}>
          {/* Cover hero */}
          <View style={[styles.coverWrap, { backgroundColor: theme.market.light }]}>
            {store.photos[0] ? (
              <Image source={{ uri: store.photos[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <Ionicons name="storefront-outline" size={52} color={theme.market.main} />
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.35)"]}
              style={styles.coverScrim}
              pointerEvents="none"
            />
          </View>

          {/* Bilgi kartı — hero'nun üzerine biner */}
          <View
            style={[
              styles.infoCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderDefault },
              theme.getElevation(2),
            ]}
          >
            <View style={styles.infoTopRow}>
              <View style={[styles.logoWrap, { backgroundColor: theme.market.light, borderColor: theme.colors.surface }]}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                ) : (
                  <Text style={{ ...theme.typography.headingMd, color: theme.market.main }}>{storeLetter}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary }} numberOfLines={2}>
                  {store.name}
                </Text>
                <View style={[styles.row, { gap: theme.space[2] }]}>
                  <View style={[styles.ratingChip, { backgroundColor: theme.market.light }]}>
                    <StarRating value={store.rating} size="sm" showValue />
                  </View>
                  <Badge variant="market" size="sm" label={`${store.totalOrders} ${t('market.orders')}`} dot />
                </View>
              </View>
            </View>

            {store.description ? (
              <Text
                style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary, marginTop: theme.space[3] }}
                numberOfLines={2}
              >
                {store.description}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <View style={[styles.metaChip, { backgroundColor: theme.colors.surfaceAlt }]}>
                <Ionicons name="bicycle-outline" size={14} color={theme.market.main} />
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                  {store.deliveryFee === 0 ? t('market.free') : formatCurrency(store.deliveryFee, region, language, 0)}
                </Text>
              </View>
              {store.minOrderAmount > 0 && (
                <View style={[styles.metaChip, { backgroundColor: theme.colors.surfaceAlt }]}>
                  <Ionicons name="receipt-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                    Min {formatCurrency(store.minOrderAmount, region, language, 0)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Market içi banner şeridi */}
          {storeBanner ? (
            <Pressable
              onPress={onPressStoreBanner}
              style={{
                marginHorizontal: theme.space[4],
                marginTop: theme.space[3],
                borderRadius: theme.radius.lg,
                overflow: "hidden",
                backgroundColor: theme.colors.surfaceAlt,
              }}
            >
              <Image source={{ uri: storeBanner.imageUrl }} style={{ width: "100%", height: 92 }} resizeMode="cover" />
            </Pressable>
          ) : null}

          {/* Mağaza-içi ürün arama */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginHorizontal: theme.space[4],
              marginTop: theme.space[3],
              marginBottom: theme.space[3],
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.lg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.borderDefault,
              paddingHorizontal: 12,
              height: 44,
            }}
          >
            <Ionicons name="search-outline" size={18} color={theme.colors.textTertiary} />
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder={t("market.search.inStorePlaceholder")}
              placeholderTextColor={theme.colors.textTertiary}
              style={{ flex: 1, ...theme.typography.bodyMd, color: theme.colors.textPrimary }}
              returnKeyType="search"
            />
            {searchQ.length > 0 && (
              <Pressable onPress={() => setSearchQ("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Kategori tab'ları */}
          {categoryTabs.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space[4],
                paddingBottom: theme.space[3],
                gap: theme.space[2],
              }}
            >
              <CategoryChip
                label="Tümü"
                active={selectedCategory === null}
                onPress={() => setSelectedCategory(null)}
              />
              {categoryTabs.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  label={cat.label}
                  active={selectedCategory === cat.id}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Ürün listesi */}
      <FlatList
        data={loading ? [] : products}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        style={{ backgroundColor: theme.colors.surface }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (storeCartItems.length > 0 ? 100 : theme.space[6]),
          flexGrow: 1,
        }}
        ListHeaderComponent={
          loading ? (
            <View>
              {[1, 2, 3, 4, 5].map((n) => (
                <ProductRowSkeleton key={n} />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              illustration="market"
              title="Ürün bulunamadı"
              subtitle="Bu kategoride henüz ürün yok."
            />
          ) : null
        }
        ListFooterComponent={
          <>
            {loadingMore ? (
              <ActivityIndicator
                color={theme.market.main}
                style={{ paddingVertical: theme.space[4] }}
              />
            ) : null}
            {storeId ? (
              <ReviewSection
                entityType="market"
                entityId={storeId}
                style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
              />
            ) : null}
          </>
        }
      />

      {/* Floating sepet çubuğu */}
      {storeCartItems.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate(MarketRoutes.Cart)}
          style={({ pressed }) => [
            styles.floatingBar,
            {
              backgroundColor: theme.market.main,
              bottom: insets.bottom + theme.space[4],
              marginHorizontal: theme.space[4],
              borderRadius: theme.radius.xl,
              opacity: pressed ? 0.92 : 1,
              ...theme.getElevation(3),
            },
          ]}
        >
          <View style={[styles.cartCountBadge, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
            <Ionicons name="basket-outline" size={16} color="#fff" />
            <Text style={{ ...theme.typography.labelSm, color: "#fff" }}>{cartCount}</Text>
          </View>
          <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse, flex: 1, textAlign: "center" }}>
            Sepete Git
          </Text>
          <Text style={{ ...theme.typography.headingSm, color: theme.colors.textInverse }}>
            {formatCurrency(cartSubtotal, region, language)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Kategori çipi ───────────────────────────────────────────────────────────────

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.categoryTab,
        {
          borderRadius: theme.radius.full,
          backgroundColor: active ? theme.market.main : theme.colors.surfaceAlt,
          borderColor: active ? theme.market.main : theme.colors.borderDefault,
        },
      ]}
    >
      <Text
        style={{
          ...theme.typography.labelMd,
          color: active ? theme.colors.textInverse : theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  storeHeader: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 4,
  },
  coverWrap: { width: "100%", height: 148, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: -26,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  infoTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center" },
  ratingChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  productPhoto: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discountTag: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 8,
  },
  discountTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  oosText: { color: "#fff", fontSize: 10, fontWeight: "700", textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 4,
    height: 36,
  },
  stepBtn: { width: 30, height: 34, alignItems: "center", justifyContent: "center" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTab: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  floatingBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  cartCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
});

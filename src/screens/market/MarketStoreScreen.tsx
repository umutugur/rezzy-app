// src/screens/market/MarketStoreScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
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
import { EmptyState, PriceTag, ReviewSection, Skeleton } from "../../components/ui";
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
        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderDefault, opacity: outOfStock ? 0.5 : 1 },
      ]}
    >
      <Pressable onPress={onPress} style={styles.productTap}>
        {/* Fotoğraf */}
        <View style={[styles.productPhoto, { backgroundColor: theme.market.light }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <Ionicons name="leaf-outline" size={24} color={theme.market.main} />
          )}
          {outOfStock && (
            <View style={styles.oosOverlay}>
              <Text style={styles.oosText}>TÜKENDİ</Text>
            </View>
          )}
        </View>

        {/* Bilgi */}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }} numberOfLines={2}>
            {product.title}
          </Text>
          {product.description ? (
            <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
              {product.description}
            </Text>
          ) : null}

          {/* Fiyat */}
          <View style={styles.priceRow}>
            {pct > 0 ? (
              <>
                <Text style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary, fontFamily: theme.fontFamily.extraBold }}>
                  {formatCurrency(eff, region, language)}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, textDecorationLine: "line-through" }}>
                  {formatCurrency(product.price, region, language)}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.market.main, fontFamily: theme.fontFamily.extraBold, letterSpacing: 0.3 }}>
                  −%{pct}
                </Text>
              </>
            ) : (
              <PriceTag amount={product.price} size="sm" />
            )}
          </View>
        </View>
      </Pressable>

      {/* Adet seçici — kare, keskin */}
      {qty > 0 ? (
        <View style={[styles.stepper, { borderColor: theme.market.main }]}>
          <Pressable onPress={onRemove} hitSlop={6} style={styles.stepBtn}>
            <Ionicons name="remove" size={18} color={theme.market.main} />
          </Pressable>
          <Text style={{ ...theme.typography.labelLg, color: theme.market.main, fontFamily: theme.fontFamily.extraBold, minWidth: 16, textAlign: "center" }}>
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
            { backgroundColor: outOfStock ? theme.colors.surfaceAlt : theme.market.main },
            !outOfStock && theme.getElevation(1),
          ]}
        >
          <Ionicons name="add" size={22} color={outOfStock ? theme.colors.textTertiary : "#fff"} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ProductRowSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.productRow, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderDefault }]}>
      <Skeleton width={60} height={60} borderRadius={12} />
      <View style={{ flex: 1, gap: theme.space[2], marginLeft: 14 }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={36} height={36} borderRadius={10} />
    </View>
  );
}

// ─── Kategori indeksi (dergi tarzı, alt-çizgili) ────────────────────────────────

function CategoryTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.catTab}>
      <Text
        style={{
          ...theme.typography.labelMd,
          letterSpacing: 0.8,
          color: active ? theme.market.main : theme.colors.textTertiary,
          fontFamily: active ? theme.fontFamily.extraBold : theme.fontFamily.semiBold,
        }}
      >
        {label.toLocaleUpperCase()}
      </Text>
      <View style={[styles.catUnderline, { backgroundColor: active ? theme.market.main : "transparent" }]} />
    </Pressable>
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
  const [reviewsOpen, setReviewsOpen] = useState(false);

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

  const deliveryLabel = store
    ? (store.deliveryFee === 0 ? t('market.free') : formatCurrency(store.deliveryFee, region, language, 0))
    : "";

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
      {/* Store header */}
      {store && (
        <View style={[styles.storeHeader, { backgroundColor: theme.colors.surface }]}>
          {/* ── Masthead hero ── */}
          <View style={[styles.hero, { backgroundColor: theme.market.main }]}>
            {store.photos[0] ? (
              <Image source={{ uri: store.photos[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : null}
            <LinearGradient
              colors={
                store.photos[0]
                  ? ["rgba(0,0,0,0.05)", "rgba(0,0,0,0.30)", "rgba(0,0,0,0.82)"]
                  : ["rgba(0,0,0,0)", "rgba(0,0,0,0.10)", "rgba(0,0,0,0.42)"]
              }
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            <View style={styles.heroContent}>
              <Text style={styles.heroName} numberOfLines={2}>{store.name}</Text>
              <View style={[styles.heroRule, { backgroundColor: "rgba(255,255,255,0.85)" }]} />
              <View style={styles.heroMeta}>
                <Pressable onPress={() => setReviewsOpen(true)} hitSlop={8} style={styles.heroRating}>
                  <Ionicons name="star" size={13} color="#FACC15" />
                  <Text style={styles.heroMetaStrong}>{store.rating.toFixed(1)}</Text>
                  <Ionicons name="chevron-forward" size={11} color="rgba(255,255,255,0.75)" />
                </Pressable>
                <Text style={styles.heroMetaDot}>·</Text>
                <Text style={styles.heroMetaText}>{store.totalOrders} {t('market.orders').toLocaleUpperCase()}</Text>
                <Text style={styles.heroMetaDot}>·</Text>
                <Ionicons name="bicycle" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.heroMetaText}>{deliveryLabel.toLocaleUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Açıklama + min */}
          {(store.description || store.minOrderAmount > 0) && (
            <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
              {store.description ? (
                <Text style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary, lineHeight: 19 }} numberOfLines={2}>
                  {store.description}
                </Text>
              ) : null}
              {store.minOrderAmount > 0 && (
                <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, fontFamily: theme.fontFamily.bold, letterSpacing: 1, marginTop: store.description ? 8 : 0 }}>
                  {`MİN. SEPET ${formatCurrency(store.minOrderAmount, region, language, 0)}`}
                </Text>
              )}
            </View>
          )}

          {/* Market içi banner şeridi */}
          {storeBanner ? (
            <Pressable
              onPress={onPressStoreBanner}
              style={{ marginHorizontal: 18, marginTop: 14, borderRadius: 12, overflow: "hidden", backgroundColor: theme.colors.surfaceAlt }}
            >
              <Image source={{ uri: storeBanner.imageUrl }} style={{ width: "100%", height: 92 }} resizeMode="cover" />
            </Pressable>
          ) : null}

          {/* Arama — alt çizgili, sade */}
          <View style={[styles.searchRow, { borderBottomColor: theme.colors.borderDefault }]}>
            <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
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

          {/* Kategori indeksi */}
          {categoryTabs.length > 0 && (
            <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderDefault }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 18, gap: 22 }}
              >
                <CategoryTab label={t('market.cat.all', { defaultValue: 'Tümü' })} active={selectedCategory === null} onPress={() => setSelectedCategory(null)} />
                {categoryTabs.map((cat) => (
                  <CategoryTab
                    key={cat.id}
                    label={cat.label}
                    active={selectedCategory === cat.id}
                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  />
                ))}
              </ScrollView>
            </View>
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
          paddingBottom: insets.bottom + (storeCartItems.length > 0 ? 104 : theme.space[6]),
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
              <ActivityIndicator color={theme.market.main} style={{ paddingVertical: theme.space[4] }} />
            ) : null}
            {!loading && products.length > 0 ? (
              <Pressable
                onPress={() => setReviewsOpen(true)}
                style={({ pressed }) => [
                  styles.reviewsCta,
                  { borderColor: theme.colors.borderDefault, backgroundColor: pressed ? theme.colors.surfaceAlt : theme.colors.surface },
                ]}
              >
                <Ionicons name="star-outline" size={18} color={theme.market.main} />
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary, flex: 1 }}>
                  Değerlendirmeler
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
          </>
        }
      />

      {/* Değerlendirmeler modalı — ürün listesinden bağımsız */}
      <Modal
        visible={reviewsOpen}
        animationType="slide"
        onRequestClose={() => setReviewsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: insets.top + 8, borderBottomColor: theme.colors.borderDefault, backgroundColor: theme.colors.surface },
            ]}
          >
            <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary, flex: 1 }}>
              Değerlendirmeler
            </Text>
            <Pressable onPress={() => setReviewsOpen(false)} hitSlop={10} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {storeId ? <ReviewSection entityType="market" entityId={storeId} /> : null}
          </ScrollView>
        </View>
      </Modal>

      {/* Floating sepet slab'ı */}
      {storeCartItems.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate(MarketRoutes.Cart)}
          style={({ pressed }) => [
            styles.cartSlab,
            {
              backgroundColor: theme.market.main,
              bottom: insets.bottom + 12,
              opacity: pressed ? 0.92 : 1,
              ...theme.getElevation(3),
            },
          ]}
        >
          <Ionicons name="basket" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.cartSlabTitle}>SEPETE GİT</Text>
            <Text style={styles.cartSlabSub}>{cartCount} ürün</Text>
          </View>
          <Text style={styles.cartSlabTotal}>{formatCurrency(cartSubtotal, region, language)}</Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  storeHeader: {},

  // Masthead hero
  hero: { width: "100%", height: 184, justifyContent: "flex-end", overflow: "hidden" },
  heroContent: { padding: 18, paddingBottom: 16 },
  heroName: { color: "#fff", fontSize: 27, lineHeight: 31, letterSpacing: -0.6, fontFamily: "PlusJakartaSans_800ExtraBold" },
  heroRule: { width: 34, height: 3, borderRadius: 2, marginTop: 11, marginBottom: 10 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  heroMetaStrong: { color: "#fff", fontSize: 13, fontWeight: "800" },
  heroMetaText: { color: "rgba(255,255,255,0.9)", fontSize: 11.5, letterSpacing: 0.6, fontWeight: "600" },
  heroMetaDot: { color: "rgba(255,255,255,0.55)", fontSize: 13, marginHorizontal: 1 },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 18,
    marginTop: 16,
    paddingBottom: 9,
    borderBottomWidth: 1.5,
  },

  // Category index
  catTab: { paddingTop: 14, alignItems: "center" },
  catUnderline: { height: 2.5, width: "100%", marginTop: 11, borderTopLeftRadius: 2, borderTopRightRadius: 2 },

  // Product row
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  productTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  productPhoto: { width: 60, height: 60, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  oosOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  oosText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 7 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    height: 36,
  },
  stepBtn: { width: 24, height: 34, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginLeft: 12 },

  // Reviews CTA (list footer) + modal
  reviewsCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },

  // Cart slab
  cartSlab: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },
  cartSlabTitle: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  cartSlabSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 1 },
  cartSlabTotal: { color: "#fff", fontSize: 18, fontWeight: "800" },
});

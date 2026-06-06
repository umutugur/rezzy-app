// src/screens/market/MarketStoreScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { Badge, EmptyState, PriceTag, ReviewSection, Skeleton, StarRating } from "../../components/ui";
import { getProducts, getStoreDetail, type MarketProduct, type MarketStore } from "../../api/market.api";
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
}: {
  product: MarketProduct;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const photoUri = product.photos[0] ?? null;
  const outOfStock = product.stock === 0;

  return (
    <View
      style={[
        styles.productRow,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderDefault,
          paddingVertical: theme.space[3],
          paddingHorizontal: theme.space[4],
          gap: theme.space[3],
          opacity: outOfStock ? 0.5 : 1,
        },
      ]}
    >
      {/* Fotoğraf */}
      <View
        style={[
          styles.productPhoto,
          {
            borderRadius: theme.radius.md,
            backgroundColor: theme.market.light,
          },
        ]}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={24} color={theme.market.main} />
        )}
        {outOfStock && (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: theme.radius.md,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' }}>
              Tükendi
            </Text>
          </View>
        )}
      </View>

      {/* Bilgi */}
      <View style={{ flex: 1, gap: theme.space[1] }}>
        <Text
          style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }}
          numberOfLines={2}
        >
          {product.title}
        </Text>
        {product.description ? (
          <Text
            style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary }}
            numberOfLines={1}
          >
            {product.description}
          </Text>
        ) : null}
        <PriceTag amount={product.price} size="sm" />
      </View>

      {/* Adet seçici */}
      <View style={[styles.qtyRow, { gap: theme.space[2] }]}>
        {qty > 0 ? (
          <>
            <Pressable
              onPress={onRemove}
              style={[
                styles.qtyBtn,
                {
                  backgroundColor: theme.market.light,
                  borderRadius: theme.radius.sm,
                  borderColor: theme.market.main,
                },
              ]}
            >
              <Ionicons name="remove" size={16} color={theme.market.main} />
            </Pressable>
            <Text
              style={{
                ...theme.typography.headingSm,
                color: theme.market.main,
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {qty}
            </Text>
          </>
        ) : null}
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={[
            styles.qtyBtn,
            {
              backgroundColor: outOfStock ? theme.colors.surfaceAlt : theme.market.main,
              borderRadius: theme.radius.sm,
              borderColor: outOfStock ? theme.colors.borderDefault : theme.market.main,
            },
          ]}
        >
          <Ionicons name="add" size={16} color={outOfStock ? theme.colors.textTertiary : theme.colors.textInverse} />
        </Pressable>
      </View>
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
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderDefault,
          paddingVertical: theme.space[3],
          paddingHorizontal: theme.space[4],
          gap: theme.space[3],
        },
      ]}
    >
      <Skeleton width={56} height={56} borderRadius={theme.radius.md} />
      <View style={{ flex: 1, gap: theme.space[2] }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={32} height={32} borderRadius={theme.radius.sm} />
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
  const { storeId } = route.params;

  const [store, setStore] = useState<MarketStore | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const cartItems = useMarketCart((s) => s.items);
  const addItem = useMarketCart((s) => s.addItem);
  const removeItem = useMarketCart((s) => s.removeItem);
  const updateQty = useMarketCart((s) => s.updateQty);

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

  // Kategori listesi — ürünlerin category alanından türetilir
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    products.forEach((p) => {
      if (p.category?._id) {
        const label =
          p.category.i18n?.tr?.title ?? p.category.i18n?.en?.title ?? p.category.key;
        seen.set(p.category._id, label);
      }
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [products]);

  // Filtreli ürünler
  const filtered = useMemo(
    () =>
      selectedCategory
        ? products.filter((p) => p.category?._id === selectedCategory)
        : products,
    [products, selectedCategory],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [storeData, productsData] = await Promise.all([
          getStoreDetail(storeId),
          getProducts(storeId),
        ]);
        if (!cancelled) {
          setStore(storeData);
          setProducts(productsData.items);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

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
        />
      );
    },
    [qtyForProduct, addItem, removeItem, updateQty],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Store header */}
      {store && (
        <View
          style={[
            styles.storeHeader,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.borderDefault,
            },
          ]}
        >
          {/* Cover */}
          <View
            style={[
              styles.coverWrap,
              { backgroundColor: theme.market.light },
            ]}
          >
            {store.photos[0] ? (
              <Image
                source={{ uri: store.photos[0] }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="storefront-outline" size={48} color={theme.market.main} />
            )}
          </View>

          {/* Info */}
          <View style={{ paddingHorizontal: theme.space[4], paddingVertical: theme.space[3] }}>
            <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary }}>
              {store.name}
            </Text>
            <View style={[styles.row, { marginTop: theme.space[1], gap: theme.space[3] }]}>
              <StarRating value={store.rating} size="sm" showValue />
              <Badge variant="market" size="sm" label={`${store.totalOrders} ${t('market.orders')}`} dot />
            </View>
            {store.description ? (
              <Text
                style={{
                  ...theme.typography.bodyMd,
                  color: theme.colors.textSecondary,
                  marginTop: theme.space[1],
                }}
              >
                {store.description}
              </Text>
            ) : null}
            <View style={[styles.row, { marginTop: theme.space[2], gap: theme.space[3] }]}>
              <View style={styles.row}>
                <Ionicons name="bicycle-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary, marginLeft: 4 }}>
                  {store.deliveryFee === 0 ? t('market.free') : formatCurrency(store.deliveryFee, region, language, 0)}
                </Text>
              </View>
              {store.minOrderAmount > 0 && (
                <View style={styles.row}>
                  <Ionicons name="receipt-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary, marginLeft: 4 }}>
                    Min {formatCurrency(store.minOrderAmount, region, language, 0)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Kategori tab'ları */}
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space[4],
                paddingBottom: theme.space[3],
                gap: theme.space[2],
              }}
            >
              <Pressable
                onPress={() => setSelectedCategory(null)}
                style={[
                  styles.categoryTab,
                  {
                    borderRadius: theme.radius.full,
                    paddingHorizontal: theme.space[3],
                    paddingVertical: theme.space[1],
                    backgroundColor: selectedCategory === null ? theme.market.main : theme.colors.surfaceAlt,
                    borderColor: selectedCategory === null ? theme.market.main : theme.colors.borderDefault,
                  },
                ]}
              >
                <Text
                  style={{
                    ...theme.typography.labelMd,
                    color: selectedCategory === null ? theme.colors.textInverse : theme.colors.textSecondary,
                  }}
                >
                  Tümü
                </Text>
              </Pressable>
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() =>
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  }
                  style={[
                    styles.categoryTab,
                    {
                      borderRadius: theme.radius.full,
                      paddingHorizontal: theme.space[3],
                      paddingVertical: theme.space[1],
                      backgroundColor:
                        selectedCategory === cat.id ? theme.market.main : theme.colors.surfaceAlt,
                      borderColor:
                        selectedCategory === cat.id ? theme.market.main : theme.colors.borderDefault,
                    },
                  ]}
                >
                  <Text
                    style={{
                      ...theme.typography.labelMd,
                      color:
                        selectedCategory === cat.id
                          ? theme.colors.textInverse
                          : theme.colors.textSecondary,
                    }}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Ürün listesi */}
      <FlatList
        data={loading ? [] : filtered}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
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
          storeId ? (
            <ReviewSection
              entityType="market"
              entityId={storeId}
              style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
            />
          ) : null
        }
      />

      {/* Floating sepet çubuğu */}
      {storeCartItems.length > 0 && (
        <Pressable
          onPress={() => navigation.navigate(MarketRoutes.Cart)}
          style={[
            styles.floatingBar,
            {
              backgroundColor: theme.market.main,
              bottom: insets.bottom + theme.space[4],
              marginHorizontal: theme.space[4],
              borderRadius: theme.radius.lg,
              ...theme.getElevation(3),
            },
          ]}
        >
          <View
            style={[
              styles.cartCountBadge,
              { backgroundColor: theme.market.light, borderRadius: theme.radius.sm },
            ]}
          >
            <Text style={{ ...theme.typography.labelSm, color: theme.market.main }}>
              {cartCount} ürün
            </Text>
          </View>
          <Text
            style={{
              ...theme.typography.labelLg,
              color: theme.colors.textInverse,
              flex: 1,
              textAlign: "center",
            }}
          >
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  storeHeader: { borderBottomWidth: StyleSheet.hairlineWidth },
  coverWrap: { width: "100%", height: 140, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  productPhoto: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qtyRow: { flexDirection: "row", alignItems: "center" },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  categoryTab: { borderWidth: StyleSheet.hairlineWidth },
  floatingBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  cartCountBadge: { paddingHorizontal: 8, paddingVertical: 4 },
});

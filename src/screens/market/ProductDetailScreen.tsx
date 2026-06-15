import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Minus } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { getProduct, type MarketProduct } from "../../api/market.api";
import { effectivePrice, discountPercent } from "../../utils/marketPrice";
import { useMarketCart } from "../../store/useMarketStore";
import { MarketRoutes, type MarketStackParams } from "../../navigation/marketRoutes";

export default function ProductDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MarketStackParams, typeof MarketRoutes.ProductDetail>>();
  const { productId } = route.params;
  const { width } = useWindowDimensions();

  const [product, setProduct] = useState<MarketProduct | null>(null);
  const [related, setRelated] = useState<MarketProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const items = useMarketCart((s) => s.items);
  const addItem = useMarketCart((s) => s.addItem);
  const updateQty = useMarketCart((s) => s.updateQty);
  const qty = items.find((i) => i.product._id === productId)?.qty ?? 0;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    getProduct(productId)
      .then((res) => {
        if (alive) {
          setProduct(res.product);
          setRelated(res.related);
        }
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <View
        style={[
          s.root,
          { backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={[s.root, { backgroundColor: theme.colors.background }]}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.backBtn}>
            <ChevronLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ color: theme.colors.textSecondary }}>{t("market.loadError")}</Text>
        </View>
      </View>
    );
  }

  const outOfStock = product.stock === 0;
  const photo = product.photos?.[0] ?? null;
  const up = product.unitPrice;

  return (
    <View style={[s.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero image */}
        <View
          style={{
            width,
            height: width * 0.8,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={{ width: "80%", height: "80%" }}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={[s.backFloating, { top: insets.top + 8 }]}
          >
            <ChevronLeft size={22} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {product.brand ? (
            <Text
              style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 2 }}
            >
              {product.brand}
            </Text>
          ) : null}
          <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary }}>
            {product.title}
          </Text>
          {(() => {
            const eff = effectivePrice(product);
            const pct = discountPercent(product);
            return pct > 0 ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <View style={{ backgroundColor: theme.colors.error, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ ...theme.typography.labelSm, color: "#fff" }}>%{pct}</Text>
                  </View>
                  <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textDecorationLine: "line-through" }}>
                    {formatCurrency(product.price, region, language)}
                  </Text>
                </View>
                <Text style={{ ...theme.typography.headingLg, color: theme.colors.error, marginTop: 4 }}>
                  {formatCurrency(eff, region, language)}
                </Text>
                {typeof product.lowest30 === "number" ? (
                  <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 }}>
                    {t("market.discount.lowest30")}: {formatCurrency(product.lowest30, region, language)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary, marginTop: 10 }}>
                {formatCurrency(product.price, region, language)}
              </Text>
            );
          })()}
          {up ? (
            <Text
              style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary, marginTop: 2 }}
            >
              {formatCurrency(up.unitPrice, region, language)} / {t(`market.unit.${up.unitPriceUnit}`)}
            </Text>
          ) : null}
          {product.description ? (
            <Text
              style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginTop: 12 }}
            >
              {product.description}
            </Text>
          ) : null}
        </View>

        {/* Attributes */}
        {product.attributes && product.attributes.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
            <Text
              style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary, marginBottom: 10 }}
            >
              {t("market.productDetail.properties")}
            </Text>
            <View
              style={{
                backgroundColor: theme.colors.surfaceAlt,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {product.attributes.map((a, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.borderDefault,
                  }}
                >
                  <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
                    {a.label}
                  </Text>
                  <Text
                    style={{
                      ...theme.typography.bodyMd,
                      color: theme.colors.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {a.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Related products */}
        {related.length > 0 ? (
          <View style={{ marginTop: 26 }}>
            <Text
              style={{
                ...theme.typography.labelLg,
                color: theme.colors.textPrimary,
                marginBottom: 12,
                paddingHorizontal: 16,
              }}
            >
              {t("market.productDetail.related")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            >
              {related.map((r) => (
                <Pressable
                  key={r._id}
                  onPress={() =>
                    navigation.push(MarketRoutes.ProductDetail, { productId: r._id })
                  }
                  style={{
                    width: 130,
                    backgroundColor: theme.colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.borderDefault,
                    padding: 10,
                  }}
                >
                  <View style={{ height: 90, alignItems: "center", justifyContent: "center" }}>
                    {r.photos?.[0] ? (
                      <Image
                        source={{ uri: r.photos[0] }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      ...theme.typography.bodySm,
                      color: theme.colors.textPrimary,
                      marginTop: 6,
                      minHeight: 32,
                    }}
                  >
                    {r.title}
                  </Text>
                  {discountPercent(r) > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <View style={{ backgroundColor: theme.colors.error, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ ...theme.typography.caption, color: "#fff" }}>%{discountPercent(r)}</Text>
                      </View>
                      <Text style={{ ...theme.typography.labelMd, color: theme.colors.error }}>
                        {formatCurrency(effectivePrice(r), region, language)}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary, marginTop: 4 }}
                    >
                      {formatCurrency(r.price, region, language)}
                    </Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Footer — Add to cart / qty */}
      <View
        style={[
          s.footer,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.borderDefault,
          },
        ]}
      >
        {qty > 0 ? (
          <View style={s.qtyRow}>
            <TouchableOpacity
              onPress={() => updateQty(productId, qty - 1)}
              style={[s.qtyBtn, { borderColor: theme.colors.primary }]}
            >
              <Minus size={18} color={theme.colors.primary} />
            </TouchableOpacity>
            <Text
              style={{
                ...theme.typography.labelLg,
                color: theme.colors.textPrimary,
                minWidth: 28,
                textAlign: "center",
              }}
            >
              {qty}
            </Text>
            <TouchableOpacity
              onPress={() => addItem(product)}
              disabled={outOfStock}
              style={[s.qtyBtn, { borderColor: theme.colors.primary }]}
            >
              <Plus size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => addItem(product)}
            disabled={outOfStock}
            style={[
              s.addBtn,
              { backgroundColor: outOfStock ? theme.colors.borderStrong : theme.colors.primary },
            ]}
          >
            <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
              {outOfStock
                ? t("market.productDetail.outOfStock")
                : t("market.productDetail.addToCart")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  backFloating: {
    position: "absolute",
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  addBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});

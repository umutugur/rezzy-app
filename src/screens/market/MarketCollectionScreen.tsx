// src/screens/market/MarketCollectionScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { effectivePrice, discountPercent } from "../../utils/marketPrice";
import { getMarketCollection, type MarketProduct } from "../../api/market.api";
import { MarketRoutes, type MarketStackParams } from "../../navigation/marketRoutes";

export default function MarketCollectionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MarketStackParams, typeof MarketRoutes.Collection>>();
  const { collectionId, title } = route.params ?? ({} as any);

  const [items, setItems] = useState<MarketProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (pg: number, append: boolean) => {
      if (!collectionId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await getMarketCollection(collectionId, pg);
        const list = Array.isArray(res.items) ? res.items : [];
        setItems((prev) => (append ? [...prev, ...list] : list));
        setTotal(typeof res.total === "number" ? res.total : list.length);
        setPage(pg);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionId],
  );

  useEffect(() => {
    load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  const onEndReached = () => {
    if (!loadingMore && items.length < total) load(page + 1, true);
  };

  const s = makeStyles(theme, insets);

  const renderProduct = ({ item }: { item: MarketProduct }) => {
    const eff = effectivePrice(item);
    const pct = discountPercent(item);
    return (
      <Pressable
        style={s.row}
        onPress={() => navigation.navigate(MarketRoutes.ProductDetail, { productId: item._id })}
      >
        <View style={s.thumb}>
          {item.photos?.[0] ? (
            <Image
              source={{ uri: item.photos[0] }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={s.title}>
            {item.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            {pct > 0 ? (
              <>
                <View style={s.badge}>
                  <Text style={s.badgeText}>%{pct}</Text>
                </View>
                <Text style={s.strike}>{formatCurrency(item.price, region, language)}</Text>
                <Text style={s.priceDisc}>{formatCurrency(eff, region, language)}</Text>
              </>
            ) : (
              <Text style={s.price}>{formatCurrency(item.price, region, language)}</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.back}>
          <ChevronLeft size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Text numberOfLines={1} style={s.headerTitle}>
          {title || t("market.collections.title")}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.muted}>{t("market.search.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it._id}
          renderItem={renderProduct}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingBottom: 10,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderDefault,
    },
    back: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    headerTitle: {
      flex: 1,
      ...theme.typography.headingMd,
      color: theme.colors.textPrimary,
    },
    row: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      padding: 10,
      marginBottom: 10,
    },
    thumb: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fff",
      borderRadius: 8,
    },
    title: { ...theme.typography.bodyMd, color: theme.colors.textPrimary },
    price: { ...theme.typography.labelMd, color: theme.colors.textPrimary },
    priceDisc: { ...theme.typography.labelMd, color: theme.colors.error },
    strike: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textDecorationLine: "line-through",
    },
    badge: {
      backgroundColor: theme.colors.error,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    badgeText: { ...theme.typography.caption, color: "#fff" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    muted: { ...theme.typography.bodyMd, color: theme.colors.textSecondary },
  });
}

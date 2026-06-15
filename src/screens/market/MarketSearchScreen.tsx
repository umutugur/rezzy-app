// src/screens/market/MarketSearchScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Search as SearchIcon, X } from "lucide-react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { effectivePrice, discountPercent } from "../../utils/marketPrice";
import {
  searchMarketProducts,
  getMarketCategories,
  type MarketSearchResult,
  type MarketProduct,
} from "../../api/market.api";
import { MarketRoutes, type MarketStackParams } from "../../navigation/marketRoutes";

type Sort = "relevance" | "price_asc" | "price_desc";

export default function MarketSearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MarketStackParams, typeof MarketRoutes.Search>>();
  const { initialQuery = "", lat, lng } = route.params ?? {};

  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<MarketSearchResult["items"]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [discounted, setDiscounted] = useState(false);
  const [sort, setSort] = useState<Sort>("relevance");
  const [categories, setCategories] = useState<{ _id: string; key: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getMarketCategories()
      .then((r) => setCategories((r.items as any) ?? []))
      .catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (pg: number, append: boolean) => {
      if (q.trim().length < 2) {
        setItems([]);
        setTotal(0);
        setBrands([]);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await searchMarketProducts({
          q: q.trim(),
          lat,
          lng,
          category,
          brand,
          discounted,
          sort,
          page: pg,
          limit: 20,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setTotal(res.total);
        if (!append) setBrands(res.brands);
        setPage(pg);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [q, lat, lng, category, brand, discounted, sort],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(1, false), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  useEffect(() => {
    runSearch(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, brand, discounted, sort]);

  const onEndReached = () => {
    if (!loadingMore && items.length < total) runSearch(page + 1, true);
  };

  const s = makeStyles(theme, insets);

  const renderProduct = ({
    item,
  }: {
    item: MarketProduct & { store?: { _id: string; name: string } };
  }) => {
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
          {item.store?.name ? <Text style={s.storeName}>{item.store.name}</Text> : null}
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

  const chip = (active: boolean, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={s.back}>
          <ChevronLeft size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={s.searchBar}>
          <SearchIcon size={18} color={theme.colors.textTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("market.search.placeholder")}
            placeholderTextColor={theme.colors.textTertiary}
            style={s.input}
            autoFocus
            returnKeyType="search"
          />
          {q.length > 0 ? (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <X size={16} color={theme.colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterRow}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "center" }}
      >
        {chip(discounted, t("market.search.discountedOnly"), () => setDiscounted((v) => !v))}
        {chip(sort === "price_asc", t("market.search.sortPriceAsc"), () =>
          setSort((v) => (v === "price_asc" ? "relevance" : "price_asc")),
        )}
        {chip(sort === "price_desc", t("market.search.sortPriceDesc"), () =>
          setSort((v) => (v === "price_desc" ? "relevance" : "price_desc")),
        )}
        {chip(category === null, t("market.search.all"), () => setCategory(null))}
        {categories.map((c) =>
          chip(category === c._id, c.key, () => setCategory(c._id)),
        )}
        {brands.map((b) =>
          chip(brand === b, b, () => setBrand((v) => (v === b ? null : b))),
        )}
      </ScrollView>

      {/* Result count */}
      {q.trim().length >= 2 && !loading ? (
        <Text style={s.count}>{t("market.search.resultsCount", { count: total })}</Text>
      ) : null}

      {/* Body */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : q.trim().length < 2 ? (
        <View style={s.center}>
          <Text style={s.muted}>{t("market.search.minChars")}</Text>
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
    searchBar: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
    },
    input: {
      flex: 1,
      ...theme.typography.bodyMd,
      color: theme.colors.textPrimary,
    },
    filterRow: {
      maxHeight: 50,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderDefault,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      backgroundColor: theme.colors.surface,
      marginVertical: 8,
    },
    chipActive: {
      backgroundColor: theme.market.main,
      borderColor: theme.market.main,
    },
    chipText: { ...theme.typography.caption, color: theme.colors.textSecondary },
    chipTextActive: { color: theme.colors.textInverse },
    count: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      paddingHorizontal: 14,
      paddingTop: 8,
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
    storeName: { ...theme.typography.caption, color: theme.colors.textTertiary },
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

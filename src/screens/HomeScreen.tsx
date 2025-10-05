import React from "react";
import {
  FlatList,
  View,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Screen, Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation } from "@react-navigation/native";
import HomeHeader from "./_HomeHeader"; // 👈 yeni, aşağıda

const CITIES = ["Hepsi", "Girne", "Lefkoşa", "Gazimağusa"];

export default function HomeScreen() {
  const nav = useNavigation<any>();

  const [city, setCity] = React.useState<string>("Hepsi");
  const [query, setQuery] = React.useState<string>("");

  const [data, setData] = React.useState<Restaurant[]>([]);
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true);
  const [fetching, setFetching] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  // input referansı (odak koruma için prop ile alt komponente geçiyoruz)
  const inputRef = React.useRef<any>(null);
  const keepFocus = React.useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }, []);

  // debounce
  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // veri çek
  const load = React.useCallback(
    async (selectedCity?: string, searched?: string, mode: "initial" | "update" = "update") => {
      try {
        setError(undefined);
        if (mode === "initial") setInitialLoading(true);
        else setFetching(true);

        const cityParam  = selectedCity && selectedCity !== "Hepsi" ? selectedCity : undefined;
        const queryParam = searched && searched.length ? searched : undefined;

        const list = await listRestaurants({ city: cityParam, query: queryParam });
        setData(list);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || "Bağlantı hatası";
        setError(msg);
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
        keepFocus(); // yükleme bitince de odak kalsın
      }
    },
    [keepFocus]
  );

  // ilk yükleme
  React.useEffect(() => {
    load(city, qDebounced, "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtre/debounce değişince
  React.useEffect(() => {
    if (!initialLoading) load(city, qDebounced, "update");
  }, [city, qDebounced, initialLoading, load]);

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await load(city, qDebounced, "update");
    } finally {
      setRefreshing(false);
    }
  }, [city, qDebounced, load]);

  return (
    <Screen topPadding="none">
      {/* 👇 Header artık ayrı, tip kimliği stabil → unmount olmaz → klavye kapanmaz */}
      <HomeHeader
        inputRef={inputRef}
        cities={CITIES}
        city={city}
        setCity={setCity}
        query={query}
        setQuery={setQuery}
        fetching={fetching}
        onSubmit={() => load(city, query.trim(), "update")}
        onClear={() => {
          setQuery("");
          keepFocus();
        }}
      />

      {initialLoading ? (
        <View style={{ alignItems: "center", marginTop: 12 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      ) : (
        <>
          {!!error && (
            <View style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontWeight: "700", marginBottom: 6 }}>Hata</Text>
              <Text secondary>{error}</Text>
            </View>
          )}

          <FlatList
            data={data}
            keyExtractor={(i) => i._id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
                <Card
                  photo={item.photos?.[0]}
                  title={item.name}
                  subtitle={`${item.city || ""} • ${item.priceRange || "₺₺"}`}
                  onPress={() => nav.navigate("Restoran", { id: item._id })}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
                <Text>Sonuç bulunamadı. Filtreleri temizleyip tekrar deneyin.</Text>
              </View>
            }
            keyboardDismissMode="none"
            keyboardShouldPersistTaps="always"
            removeClippedSubviews={false}
            contentContainerStyle={{ paddingBottom: Platform.select({ ios: 8, android: 12 }) }}
          />
        </>
      )}
    </Screen>
  );
}

/* ===========================
   Ayrı, memo’lu Header
   =========================== */

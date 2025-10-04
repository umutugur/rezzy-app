// src/screens/HomeScreen.tsx
import React from "react";
import {
  FlatList,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
} from "react-native";
import { Screen, Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation } from "@react-navigation/native";

const CITIES = ["Hepsi", "Girne", "Lefkoşa", "Gazimağusa"];

// Layout sabitleri
const HEADER_VSPACE = 10;
const SECTION_GAP = 4;
const CHIP_H = 36;

export default function HomeScreen() {
  const nav = useNavigation<any>();

  // filtreler
  const [city, setCity] = React.useState<string>("Hepsi");
  const [query, setQuery] = React.useState<string>("");

  // data state
  const [data, setData] = React.useState<Restaurant[]>([]);
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true);
  const [fetching, setFetching] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  // input ref (fokus koruma)
  const inputRef = React.useRef<TextInput>(null);

  // debounce
  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // veri çekici
  const load = React.useCallback(
    async (selectedCity?: string, searched?: string, mode: "initial" | "update" = "update") => {
      try {
        setError(undefined);
        if (mode === "initial") setInitialLoading(true);
        else setFetching(true);

        const cityParam =
          selectedCity && selectedCity !== "Hepsi" ? selectedCity : undefined;
        const queryParam = searched && searched.length ? searched : undefined;

        const list = await listRestaurants({ city: cityParam, query: queryParam });
        setData(list);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || "Bağlantı hatası";
        setError(msg);
        console.warn("listRestaurants error:", msg);
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
      }
    },
    []
  );

  // ilk yükleme
  React.useEffect(() => {
    load(city, qDebounced, "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtre/debounce değişince (ilk yükleme bittikten sonra) getir
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

  // ---- Header (Search + City chips) ----
  function Header() {
    return (
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: HEADER_VSPACE,
          paddingBottom: SECTION_GAP,
        }}
      >
        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#E6E6E6",
            borderRadius: 12,
            backgroundColor: "#fff",
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 8,
          }}
        >
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Mekan ara (isim)"
            placeholderTextColor="#9CA3AF"
            selectionColor="#7B2C2C"
            style={{ flex: 1, color: "#111" }}
            returnKeyType="search"
            onSubmitEditing={() => load(city, query.trim(), "update")}
            autoCorrect={false}
            blurOnSubmit={false}
          />

          {fetching && (
            <ActivityIndicator size="small" style={{ marginLeft: 6 }} />
          )}

          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery("");
                // temizle sonrası fokus kaybolmasın
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              style={{
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Text secondary>Temizle</Text>
            </Pressable>
          )}
        </View>

        {/* City chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 12 }}
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CITIES.map((c) => {
              const active = c === city;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCity(c)}
                  style={{
                    height: CHIP_H,
                    paddingHorizontal: 12,
                    borderRadius: CHIP_H / 2,
                    borderWidth: 1,
                    justifyContent: "center",
                    backgroundColor: active ? "#7B2C2C" : "#FFFFFF",
                    borderColor: active ? "#7B2C2C" : "#E6E6E6",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : "#1A1A1A",
                      fontWeight: "600",
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <Screen>
      <Header />

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
            contentContainerStyle={{
              paddingBottom: Platform.select({ ios: 8, android: 12 }),
            }}
          />
        </>
      )}
    </Screen>
  );
}

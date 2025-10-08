import React from "react";
import {
  FlatList,
  View,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Keyboard,
} from "react-native";
import { Screen, Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation } from "@react-navigation/native";
import HomeHeader from "./_HomeHeader";

const CITIES = [
  "Hepsi",
  "Girne",
  "Lefkoşa",
  "Gazimağusa",
  "Güzelyurt",
  "İskele",
  "Lefke",
];

export default function HomeScreen() {
  const nav = useNavigation<any>();

  const [city, setCity] = React.useState<string>("Hepsi");
  const [query, setQuery] = React.useState<string>("");

  const [data, setData] = React.useState<Restaurant[]>([]);
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true);
  const [fetching, setFetching] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  // input ref (sadece blur/dismiss için kullanıyoruz; auto-focus vermiyoruz)
  const inputRef = React.useRef<TextInput | null>(null);

  // debounce
  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = React.useCallback(
    async (
      selectedCity?: string,
      searched?: string,
      mode: "initial" | "update" = "update"
    ) => {
      try {
        setError(undefined);
        if (mode === "initial") setInitialLoading(true);
        else setFetching(true);

        const cityParam =
          selectedCity && selectedCity !== "Hepsi" ? selectedCity : undefined;
        const queryParam =
          searched && searched.length ? searched : undefined;

        const list = await listRestaurants({ city: cityParam, query: queryParam });
        setData(list);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message || e?.message || "Bağlantı hatası";
        setError(msg);
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
        // kesin: veri geldikten sonra klavyeyi açma!
      }
    },
    []
  );

  // ilk yükleme
  React.useEffect(() => {
    load(city, qDebounced, "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filtre/debounce değişince (ilk yük sonrası) veri getir
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
    <Screen>
      <HomeHeader
        inputRef={inputRef}
        cities={CITIES}
        city={city}
        setCity={(c) => {
          // güvene almak için burada da kapatıyoruz
          inputRef.current?.blur();
          Keyboard.dismiss();
          setCity(c);
        }}
        query={query}
        setQuery={setQuery}
        fetching={fetching}
        onSubmit={() => {
          Keyboard.dismiss();
          inputRef.current?.blur();
          load(city, query.trim(), "update");
        }}
        onClear={() => {
          setQuery("");
          inputRef.current?.blur();
          Keyboard.dismiss();
        }}
      />

      {initialLoading ? (
        <View style={{ alignItems: "center", marginTop: 12 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>
            Yükleniyor…
          </Text>
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
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
            // klavye davranışı
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

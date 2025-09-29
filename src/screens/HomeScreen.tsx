// src/screens/HomeScreen.tsx
import React from "react";
import {
  FlatList,
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Screen, Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation } from "@react-navigation/native";

const CITIES = ["Hepsi", "Girne", "Lefkoşa", "Gazimağusa"];

export default function HomeScreen() {
  const nav = useNavigation<any>();

  // filtreler
  const [city, setCity] = React.useState<string>("Hepsi");
  const [query, setQuery] = React.useState<string>("");

  // data state
  const [data, setData] = React.useState<Restaurant[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  // debounce için ara state
  const [qDebounced, setQDebounced] = React.useState<string>("");

  // query debounce (350ms)
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = React.useCallback(async (selectedCity?: string, searched?: string) => {
    try {
      setError(undefined);
      setLoading(true);

      const cityParam = selectedCity && selectedCity !== "Hepsi" ? selectedCity : undefined;
      const queryParam = searched && searched.length ? searched : undefined;

      const list = await listRestaurants({
        city: cityParam,
        query: queryParam, // ⬅️ arama
      });

      setData(list);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Bağlantı hatası";
      setError(msg);
      console.warn("listRestaurants error:", {
        url: e?.config?.url,
        baseURL: e?.config?.baseURL,
        params: e?.config?.params,
        code: e?.code,
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // şehir değiştiğinde veya debounce edilmiş query değiştiğinde yükle
  React.useEffect(() => { load(city, qDebounced); }, [city, qDebounced, load]);

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await load(city, qDebounced);
    } finally {
      setRefreshing(false);
    }
  }, [city, qDebounced, load]);

  // ---- City chips ----
  const CHIP_H = 36;
  const CityChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 12 }}
      contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 4 }}
    >
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
              marginRight: 8,
              alignSelf: "flex-start",
              justifyContent: "center",
              backgroundColor: active ? "#7B2C2C" : "#FFFFFF",
              borderColor: active ? "#7B2C2C" : "#E6E6E6",
            }}
          >
            <Text style={{ color: active ? "#fff" : "#1A1A1A", fontWeight: "600" }}>
              {c}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // ---- Search bar ----
  const SearchBar = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#E6E6E6",
        borderRadius: 12,
        backgroundColor: "#fff",
        paddingHorizontal: 12,
        marginHorizontal: 8,
        marginBottom: 10,
        height: 44,
      }}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Mekan ara (isim)"
        style={{ flex: 1, color: "#111" }}
        returnKeyType="search"
        onSubmitEditing={() => load(city, query.trim())}
        autoCorrect={false}
      />
      {query.length > 0 && (
        <Pressable
          onPress={() => setQuery("")}
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
  );

  return (
    <Screen>
      {SearchBar}
      {CityChips}

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      ) : error ? (
        <View>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Hata</Text>
          <Text secondary>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <Card
              photo={item.photos?.[0]}
              title={item.name}
              subtitle={`${item.city || ""} • ${item.priceRange || "₺₺"}`}
              onPress={() => nav.navigate("Restoran", { id: item._id })}
            />
          )}
          ListEmptyComponent={
            <View style={{ marginTop: 24, paddingHorizontal: 8 }}>
              <Text>Sonuç bulunamadı. Filtreleri temizleyip tekrar deneyin.</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}

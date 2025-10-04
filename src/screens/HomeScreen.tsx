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
const HEADER_VSPACE = 12;  // başlık bileşenleri arası dikey boşluk
const SECTION_GAP   = 10;  // header ile ilk kart arası boşluk (biraz azalttım)
const CHIP_H        = 36;

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

  // debounce
  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = React.useCallback(async (selectedCity?: string, searched?: string) => {
    try {
      setError(undefined);
      setLoading(true);
      const cityParam  = selectedCity && selectedCity !== "Hepsi" ? selectedCity : undefined;
      const queryParam = searched && searched.length ? searched : undefined;

      const list = await listRestaurants({ city: cityParam, query: queryParam });
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

  React.useEffect(() => { load(city, qDebounced); }, [city, qDebounced, load]);

  const onRefresh = React.useCallback(async () => {
    try { setRefreshing(true); await load(city, qDebounced); }
    finally { setRefreshing(false); }
  }, [city, qDebounced, load]);

  // ---- Header (Search + City chips) ----
  function Header() {
    return (
      <View style={{ paddingHorizontal: 12, paddingTop: HEADER_VSPACE, paddingBottom: SECTION_GAP }}>
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
            marginBottom: HEADER_VSPACE,
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
            blurOnSubmit={false}
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

        {/* City chips: yatay kaydırmalı */}
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
                  <Text style={{ color: active ? "#fff" : "#1A1A1A", fontWeight: "600" }}>
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
      {/* Header'ı FLATLIST DIŞINA aldık → TextInput fokus/klavye korunur */}
      <Header />

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 12 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Hata</Text>
          <Text secondary>{error}</Text>
        </View>
      ) : (
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
          // Klavye davranışları
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="handled"
          // Android’de overscroll payı
          contentContainerStyle={{
            paddingBottom: Platform.select({ ios: 8, android: 12 }),
          }}
        />
      )}
    </Screen>
  );
}

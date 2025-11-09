import React from "react";
import {
  FlatList,
  View,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Keyboard,
  Pressable,
} from "react-native";
import { Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import HomeHeader from "./_HomeHeader";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNotifications } from "../store/useNotifications";
import { useRegion, type Region } from "../store/useRegion";
import * as Location from "expo-location";

const CITIES_BY_REGION: Record<Region, string[]> = {
  CY: ["Hepsi", "Girne", "Lefkoşa", "Gazimağusa", "Güzelyurt", "İskele", "Lefke"],
  UK: ["All", "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Edinburgh"],
};

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { region } = useRegion();

  const cities = CITIES_BY_REGION[region] || CITIES_BY_REGION.CY;
  const initialCity = cities[0] || "Hepsi";

  const [city, setCity] = React.useState<string>(initialCity);
  const [query, setQuery] = React.useState<string>("");

  const [data, setData] = React.useState<Restaurant[]>([]);
  const [initialLoading, setInitialLoading] = React.useState<boolean>(true);
  const [fetching, setFetching] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  const [searchOpen, setSearchOpen] = React.useState(false);
  const inputRef = React.useRef<TextInput | null>(null);

  const { unreadCount, fetchUnreadCount } = useNotifications();

  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // 📍 Kullanıcı konumu
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (locationRequested) return;
      try {
        setLocationRequested(true);
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch (e) {
        if (__DEV__) console.log("[home] location error", e);
      }
    })();
  }, [locationRequested]);

  // Bölge değişince şehir filtresini resetle
  React.useEffect(() => {
    const first = (CITIES_BY_REGION[region] || CITIES_BY_REGION.CY)[0] || "Hepsi";
    setCity(first);
  }, [region]);

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
          selectedCity &&
          selectedCity !== "Hepsi" &&
          selectedCity !== "All"
            ? selectedCity
            : undefined;
        const queryParam = searched && searched.length ? searched : undefined;

        const list = await listRestaurants({
          region,
          city: cityParam,
          query: queryParam,
          lat: coords?.lat,
          lng: coords?.lng,
        });

        setData(list || []);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Bağlantı hatası";
        setError(msg);
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
      }
    },
    [region, coords?.lat, coords?.lng]
  );

  // ilk yükleme
  React.useEffect(() => {
    load(city, qDebounced, "initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // konum geldikten sonra yeniden yükle
  React.useEffect(() => {
    if (!initialLoading) {
      load(city, qDebounced, "update");
    }
  }, [coords?.lat, coords?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ekrana her dönüşte hafif tazele + bildirim sayacı
  useFocusEffect(
    React.useCallback(() => {
      if (!initialLoading) {
        load(city, qDebounced, "update");
      }
      fetchUnreadCount?.();
    }, [initialLoading, city, qDebounced, load, fetchUnreadCount])
  );

  // filtre/debounce değişince (ilk yük sonrası)
  React.useEffect(() => {
    if (!initialLoading) load(city, qDebounced, "update");
  }, [city, qDebounced, initialLoading, load]);

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await load(city, qDebounced, "update");
      await fetchUnreadCount?.();
    } finally {
      setRefreshing(false);
    }
  }, [city, qDebounced, load, fetchUnreadCount]);

  // header ikonları
  React.useLayoutEffect(() => {
    nav.setOptions({
      headerShadowVisible: false,
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginRight: 15 }}>
          <Pressable onPress={() => nav.navigate("Bildirimler")} style={{ position: "relative" }}>
            <Ionicons name="notifications-outline" size={22} color="#3a302c" />
            {unreadCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 4,
                  borderRadius: 8,
                  backgroundColor: "#DC2626",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>

          <Ionicons
            name={searchOpen ? "close" : "search"}
            size={22}
            color="#3a302c"
            onPress={() => {
              if (searchOpen) {
                inputRef.current?.blur();
                Keyboard.dismiss();
              }
              setSearchOpen((s) => !s);
            }}
          />
        </View>
      ),
    });
  }, [nav, searchOpen, unreadCount]);

  const keyExtractor = React.useCallback((i: Restaurant) => String(i._id), []);
  const renderItem = React.useCallback(
    ({ item }: { item: Restaurant }) => (
      <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
        <Card
          photo={item.photos?.[0]}
          title={item.name}
          subtitle={
            [item.city, item.priceRange || "₺₺"]
              .filter(Boolean)
              .join(" • ")
          }
          onPress={() => nav.navigate("Restoran", { id: item._id })}
        />
      </View>
    ),
    [nav]
  );

  const listHeader = (
    <HomeHeader
      searchOpen={searchOpen}
      inputRef={inputRef}
      cities={cities}
      city={city}
      setCity={(c) => {
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
        load(city, "", "update");
      }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {initialLoading ? (
        <View style={{ alignItems: "center", marginTop: 8 }}>
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
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
                <Text>Sonuç bulunamadı. Filtreleri temizleyip tekrar deneyin.</Text>
              </View>
            }
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            keyboardDismissMode="none"
            keyboardShouldPersistTaps="always"
            removeClippedSubviews={false}
            contentContainerStyle={{
              paddingBottom: Platform.select({ ios: 0, android: 0 }),
            }}
          />
        </>
      )}
    </View>
  );
}
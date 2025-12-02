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
  Modal,
  ScrollView,
} from "react-native";
import { Text } from "../components/Themed";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import HomeHeader from "./_HomeHeader";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNotifications } from "../store/useNotifications";
import { useRegion } from "../store/useRegion";
import * as Location from "expo-location";
import { useI18n } from "../i18n";

const CITIES_BY_REGION: Record<string, string[]> = {
  CY: ["Hepsi", "Lefkoşa", "Girne", "Gazimağusa", "Güzelyurt", "İskele", "Lefke"],
  UK: ["All", "London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Edinburgh"],
};

// 11:00–23:30 arası her 30 dakikada bir saat seçeneği
const TIME_OPTIONS: string[] = Array.from({ length: 25 }, (_, index) => {
  const hour = 11 + Math.floor(index / 2); // 11, 11, 12, 12, ...
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minutes}`;
});

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const { region } = useRegion();
  const { t } = useI18n();

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
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filterDate, setFilterDate] = React.useState<string | null>(null);
  const [filterTimeFrom, setFilterTimeFrom] = React.useState<string | null>(null);
  const [filterTimeTo, setFilterTimeTo] = React.useState<string | null>(null);
  const [filterPeople, setFilterPeople] = React.useState<number>(2);
  const [filterPrice, setFilterPrice] = React.useState<"low" | "medium" | "high" | null>(null);
  const [filterCities, setFilterCities] = React.useState<string[]>([]);
  const [actionsOpen, setActionsOpen] = React.useState(false);

  // dropdown açık/kapalı state’leri
  const [timeFromOpen, setTimeFromOpen] = React.useState(false);
  const [timeToOpen, setTimeToOpen] = React.useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = React.useState(false);

  const inputRef = React.useRef<TextInput | null>(null);

  const { unreadCount, fetchUnreadCount } = useNotifications();

  const [qDebounced, setQDebounced] = React.useState<string>("");
  React.useEffect(() => {
    const tmr = setTimeout(() => setQDebounced(query.trim()), 300);
    return () => clearTimeout(tmr);
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
        // Konum alınamazsa sessizce devam
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
        const raw = e?.response?.data;
        const isHtml = typeof raw === "string" && raw.startsWith("<!DOCTYPE html");
        const msg =
          (!isHtml && (raw?.message || e?.message)) ||
          t("home.error");
        setError(msg);
      } finally {
        if (mode === "initial") setInitialLoading(false);
        setFetching(false);
      }
    },
    [region, coords?.lat, coords?.lng, t]
  );

  // İlk yükleme: sadece 1 kez
  const didInitialLoad = React.useRef(false);
  React.useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    load(initialCity, qDebounced, "initial");
  }, [load, initialCity, qDebounced]);

  // Konum veya region değişince (ilk yük tamamlandıysa) güncelle
  React.useEffect(() => {
    if (!didInitialLoad.current || initialLoading) return;
    load(city, qDebounced, "update");
  }, [coords?.lat, coords?.lng, region]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ekrana her gelişte sadece bildirim sayacını yenile
  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount?.();
    }, [fetchUnreadCount])
  );

  // Filtre/debounce değişince (ilk yük sonrası)
  React.useEffect(() => {
    if (!didInitialLoad.current || initialLoading) return;
    load(city, qDebounced, "update");
  }, [city, qDebounced]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const keyExtractor = React.useCallback(
    (i: Restaurant) => String(i._id || i.id || Math.random()),
    []
  );

  const renderItem = React.useCallback(
    ({ item }: { item: Restaurant }) => (
      <View style={{ paddingHorizontal: 12, marginBottom: 12 }}>
        <Card
          photo={item.photos?.[0]}
          title={item.name}
          subtitle={[item.city, item.priceRange || "₺₺"].filter(Boolean).join(" • ")}
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

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>
            {t("home.loading")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {!!error && (
        <View style={{ paddingHorizontal: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            {t("common.error")}
          </Text>
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
            <Text>{t("home.noResults")}</Text>
          </View>
        }
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
        removeClippedSubviews={false}
        contentContainerStyle={{
          paddingBottom: Platform.select({ ios: 80, android: 80 }),
        }}
      />

      {/* Floating actions button (Map / Assistant / Filters) */}
      <View
        style={{
          position: "absolute",
          right: 16,
          bottom: 24,
          alignItems: "flex-end",
        }}
      >
        {actionsOpen && (
          <View
            style={{
              marginBottom: 8,
              gap: 8,
            }}
          >
            {/* Map action */}
            <Pressable
              onPress={() => {
                setActionsOpen(false);
                nav.navigate("Harita", {
                  city,
                  query: qDebounced,
                });
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
                gap: 6,
              }}
            >
              <Ionicons name="map-outline" size={18} color="#3a302c" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                {t("home.actionsMap")}
              </Text>
            </Pressable>

           {/* Assistant action */}
<Pressable
  onPress={() => {
    setActionsOpen(false);
    nav.navigate("Asistan");
  }}
  style={{
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    gap: 6,
  }}
>
  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#3a302c" />
  <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
    {t("home.actionsAssistant")}
  </Text>
</Pressable>

            {/* Filters action (opens modal) */}
            <Pressable
              onPress={() => {
                setActionsOpen(false);
                setFilterOpen(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
                gap: 6,
              }}
            >
              <Ionicons name="options-outline" size={18} color="#3a302c" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                {t("home.actionsFilters")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Main FAB */}
        <Pressable
          onPress={() => setActionsOpen((prev) => !prev)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: "#B91C1C", // marka kırmızısı
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.16,
            shadowRadius: 8,
            elevation: 4,
            gap: 8,
          }}
        >
          <Ionicons name={actionsOpen ? "close" : "sparkles-outline"} size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            {t("home.actionsMore")}
          </Text>
        </Pressable>
      </View>

      {/* Filter modal */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.25)",
            justifyContent: "flex-end",
          }}
        >
          {/* Dismiss area */}
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              setFilterOpen(false);
              setTimeFromOpen(false);
              setTimeToOpen(false);
              setCityDropdownOpen(false);
            }}
          />

          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: Platform.select({ ios: 32, android: 24 }),
              maxHeight: "80%",
            }}
          >
            {/* Handle */}
            <View
              style={{
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: "#e2d6cc",
                }}
              />
            </View>

            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#3a302c" }}>
                {t("filter.title")}
              </Text>
              <Pressable
                onPress={() => {
                  setFilterDate(null);
                  setFilterTimeFrom(null);
                  setFilterTimeTo(null);
                  setFilterPeople(2);
                  setFilterPrice(null);
                  setFilterCities([]);
                  setTimeFromOpen(false);
                  setTimeToOpen(false);
                  setCityDropdownOpen(false);
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#B91C1C" }}>
                  {t("filter.clearAll")}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Date */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                  {t("filter.date")}
                </Text>
                <Pressable
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#e2d6cc",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    justifyContent: "center",
                    backgroundColor: "#f7f4f1",
                  }}
                  onPress={() => {
                    // TODO: date picker
                    setTimeFromOpen(false);
                    setTimeToOpen(false);
                    setCityDropdownOpen(false);
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: filterDate ? "#3a302c" : "#9c8a7b",
                    }}
                  >
                    {filterDate || t("filter.datePlaceholder")}
                  </Text>
                </Pressable>
              </View>

              {/* Time range (dropdown) */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                  {t("filter.time")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  {/* From time */}
                  <View style={{ flex: 1, position: "relative" }}>
                    <Pressable
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#e2d6cc",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        justifyContent: "center",
                        backgroundColor: "#f7f4f1",
                      }}
                      onPress={() => {
                        setTimeFromOpen((prev) => !prev);
                        setTimeToOpen(false);
                        setCityDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: filterTimeFrom ? "#3a302c" : "#9c8a7b",
                        }}
                      >
                        {filterTimeFrom || t("filter.timePlaceholder")}
                      </Text>
                    </Pressable>
                    {timeFromOpen && (
                      <View
                        style={{
                          position: "absolute",
                          top: 48,
                          left: 0,
                          right: 0,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#e2d6cc",
                          backgroundColor: "#fff",
                          maxHeight: 220,
                          overflow: "hidden",
                          zIndex: 20,
                        }}
                      >
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <Pressable
                              key={opt}
                              onPress={() => {
                                setFilterTimeFrom(opt);
                                setTimeFromOpen(false);
                              }}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                              }}
                            >
                              <Text style={{ fontSize: 14, color: "#3a302c" }}>{opt}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <Text style={{ fontSize: 14, color: "#3a302c", marginTop: 12 }}>—</Text>

                  {/* To time */}
                  <View style={{ flex: 1, position: "relative" }}>
                    <Pressable
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#e2d6cc",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        justifyContent: "center",
                        backgroundColor: "#f7f4f1",
                      }}
                      onPress={() => {
                        setTimeToOpen((prev) => !prev);
                        setTimeFromOpen(false);
                        setCityDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: filterTimeTo ? "#3a302c" : "#9c8a7b",
                        }}
                      >
                        {filterTimeTo || t("filter.timePlaceholder")}
                      </Text>
                    </Pressable>
                    {timeToOpen && (
                      <View
                        style={{
                          position: "absolute",
                          top: 48,
                          left: 0,
                          right: 0,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#e2d6cc",
                          backgroundColor: "#fff",
                          maxHeight: 220,
                          overflow: "hidden",
                          zIndex: 20,
                        }}
                      >
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {TIME_OPTIONS.map((opt) => (
                            <Pressable
                              key={opt}
                              onPress={() => {
                                setFilterTimeTo(opt);
                                setTimeToOpen(false);
                              }}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                              }}
                            >
                              <Text style={{ fontSize: 14, color: "#3a302c" }}>{opt}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* People */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                  {t("filter.people")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setFilterPeople((p) => (p > 1 ? p - 1 : 1))
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "#e2d6cc",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#f7f4f1",
                    }}
                  >
                    <Ionicons name="remove" size={18} color="#3a302c" />
                  </Pressable>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#3a302c" }}>
                    {filterPeople}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setFilterPeople((p) => (p < 20 ? p + 1 : p))
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "#e2d6cc",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#f7f4f1",
                    }}
                  >
                    <Ionicons name="add" size={18} color="#3a302c" />
                  </Pressable>
                </View>
              </View>

              {/* City dropdown (multi-select) */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                  {t("filter.city")}
                </Text>
                <View style={{ position: "relative" }}>
                  <Pressable
                    style={{
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#e2d6cc",
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      justifyContent: "center",
                      backgroundColor: "#f7f4f1",
                    }}
                    onPress={() => {
                      setCityDropdownOpen((prev) => !prev);
                      setTimeFromOpen(false);
                      setTimeToOpen(false);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: filterCities.length ? "#3a302c" : "#9c8a7b",
                      }}
                    >
                      {filterCities.length ? filterCities.join(", ") : city}
                    </Text>
                  </Pressable>
                  {cityDropdownOpen && (
                    <View
                      style={{
                        position: "absolute",
                        top: -260, // yukarı açılması için
                        left: 0,
                        right: 0,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#e2d6cc",
                        backgroundColor: "#fff",
                        maxHeight: 260,
                        overflow: "hidden",
                        zIndex: 20,
                      }}
                    >
                      <ScrollView
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {cities.map((c) => {
                          const active = filterCities.includes(c);
                          return (
                            <Pressable
                              key={c}
                              onPress={() => {
                                setFilterCities((prev) =>
                                  prev.includes(c)
                                    ? prev.filter((x) => x !== c)
                                    : [...prev, c]
                                );
                              }}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: "#3a302c",
                                }}
                              >
                                {c}
                              </Text>
                              {active && (
                                <Ionicons name="checkmark" size={16} color="#3a302c" />
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: "#9c8a7b" }}>
                  {t("filter.cityHint")}
                </Text>
              </View>

              {/* Price range pills */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#3a302c" }}>
                  {t("filter.price")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      { key: "low", label: "₺" },
                      { key: "medium", label: "₺₺" },
                      { key: "high", label: "₺₺₺" },
                    ] as const
                  ).map((opt) => {
                    const active = filterPrice === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() =>
                          setFilterPrice((cur) =>
                            cur === opt.key ? null : opt.key
                          )
                        }
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: active ? 0 : 1,
                          borderColor: "#e2d6cc",
                          backgroundColor: active ? "#3a302c" : "#f7f4f1",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: active ? "#fff" : "#3a302c",
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Apply button */}
            <View
              style={{
                marginTop: 8,
              }}
            >
              <Pressable
                onPress={() => {
                  setFilterOpen(false);
                  setTimeFromOpen(false);
                  setTimeToOpen(false);
                  setCityDropdownOpen(false);
                }}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#B91C1C",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.16,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {t("filter.apply")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
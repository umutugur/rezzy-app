// src/screens/BookingsScreen.tsx
import React from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import StatusBadge from "../components/StatusBadge";
import FilterTabs from "../components/FilterTabs";
import TimeTabs from "../components/TimeTabs";
import SearchBar from "../components/SearchBar";
import { getMyReservations, ReservationLite } from "../api/reservations";
import { formatDateTime, isPast } from "../utils/format"; // veya utils/date.ts teki
import ReservationCard from "../components/ReservationCard";
import EmptyState from "../components/EmptyState";
const NAV_DETAIL = "Rezervasyon Detayı";
type StatusTab = "all" | "pending" | "confirmed" | "rejected" | "canceled";
type TimeTab = "upcoming" | "past" | "all";

export default function BookingsScreen() {
  const nav = useNavigation<any>();
  const [statusTab, setStatusTab] = React.useState<StatusTab>("all");
  const [timeTab, setTimeTab] = React.useState<TimeTab>("upcoming");
  const [query, setQuery] = React.useState("");

  const [data, setData] = React.useState<ReservationLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const statusParam = statusTab === "all" ? undefined : statusTab;
      const list = await getMyReservations(statusParam);
      setData(list);
    } catch (e: any) {
      setError(e?.message ?? "Yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusTab]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Ekran içi filtreleme (zaman & arama)
  const filtered = React.useMemo(() => {
    let arr = [...data];

    // Zaman filtresi
    if (timeTab !== "all") {
      arr = arr.filter((x) => (timeTab === "past" ? isPast(x.dateTimeUTC) : !isPast(x.dateTimeUTC)));
    }

    // Arama (restoran adına göre)
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter((x) => (x.restaurantId?.name || "").toLowerCase().includes(q));
    }

    // Sıralama: Yaklaşanlar artan, Geçmiş azalan; Tümü → yaklaşanlar önce
    if (timeTab === "past") {
      arr.sort((a, b) => new Date(b.dateTimeUTC).getTime() - new Date(a.dateTimeUTC).getTime());
    } else {
      arr.sort((a, b) => new Date(a.dateTimeUTC).getTime() - new Date(b.dateTimeUTC).getTime());
    }

    return arr;
  }, [data, timeTab, query]);

const renderItem = ({ item }: { item: ReservationLite }) => (
  <ReservationCard
    title={item.restaurantId?.name || "Restoran"}
    dateISO={item.dateTimeUTC}
    status={item.status}
    thumb={item.receiptUrl}
    onPress={() => nav.navigate(NAV_DETAIL, { id: item._id })}
  />
);


  return (
    <Screen>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: "700", fontSize: 18 }}>Rezervasyonlarım</Text>
      </View>

      {/* 1) Durum filtresi */}
      <FilterTabs value={statusTab} onChange={setStatusTab} />

      {/* 2) Zaman filtresi */}
      <TimeTabs value={timeTab} onChange={setTimeTab} />

      {/* 3) Arama */}
      <SearchBar value={query} onChange={setQuery} />

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      ) : (
        <>
          {error ? <Text secondary style={{ marginBottom: 8 }}>Hata: {error}</Text> : null}
          <FlatList
            data={filtered}
            keyExtractor={(it) => it._id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 40 }}>
                <Text secondary>Bu filtre için sonuç yok.</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </>
      )}
    </Screen>
  );
}

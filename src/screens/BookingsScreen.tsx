import React from "react";
import { View, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import FilterTabs from "../components/FilterTabs";
import TimeTabs from "../components/TimeTabs";
import SearchBar from "../components/SearchBar";
import { getMyReservations, type Reservation } from "../api/reservations";
import ReservationCard from "../components/ReservationCard";
import { useAuth } from "../store/useAuth";

// ---- Yardımcılar ----
type FilterKey = "all" | "active" | "past";
type TimeKey = "all" | "today" | "week" | "custom";

function normalizeStatus(s: string) {
  const x = (s || "").toLowerCase();
  if (x === "pending") return "pending";
  if (x === "confirmed") return "confirmed";
  if (x === "arrived") return "arrived";
  if (x === "no_show" || x === "noshow") return "no_show";
  if (x === "cancelled" || x === "canceled") return "cancelled";
  if (x === "rejected") return "rejected";
  return "unknown";
}
function isActiveStatus(s: string) {
  const n = normalizeStatus(s);
  return n === "pending" || n === "confirmed";
}
function isPastStatus(s: string) {
  const n = normalizeStatus(s);
  return n === "arrived" || n === "no_show" || n === "cancelled" || n === "rejected";
}
function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
}
function endOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
}
function startOfWeekLocal() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Pazartesi taban
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
  return monday.getTime();
}
function endOfWeekLocal() {
  const start = new Date(startOfWeekLocal());
  const sunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
  return sunday.getTime();
}
function inRange(dateISO: string, start?: number, end?: number) {
  const t = new Date(dateISO).getTime();
  if (!t) return false;
  if (start != null && t < start) return false;
  if (end != null && t > end) return false;
  return true;
}

export default function BookingsScreen() {
  const nav = useNavigation<any>();
  const token = useAuth((s) => s.token);
  const setIntended = useAuth((s) => s.setIntended);

  const [filterTab, setFilterTab] = React.useState<FilterKey>("all");
  const [timeTab, setTimeTab] = React.useState<TimeKey>("all");
  const [range, setRange] = React.useState<{ start?: string; end?: string }>({});
  const [query, setQuery] = React.useState("");

  const [data, setData] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const list = await getMyReservations();
      setData(list);
    } catch (e: any) {
      setError(e?.message ?? "Yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    let arr = [...data];
    if (filterTab === "active") arr = arr.filter((x) => isActiveStatus(x.status));
    else if (filterTab === "past") arr = arr.filter((x) => isPastStatus(x.status));

    if (timeTab === "today") {
      const s = startOfTodayLocal(), e = endOfTodayLocal();
      arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    } else if (timeTab === "week") {
      const s = startOfWeekLocal(), e = endOfWeekLocal();
      arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    } else if (timeTab === "custom") {
      const s = range.start ? new Date(range.start).getTime() : undefined;
      const e = range.end ? new Date(range.end).getTime() : undefined;
      if (s || e) arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    }

    const q = query.trim().toLowerCase();
    if (q) arr = arr.filter((x) => (x.restaurantId as any)?.name?.toLowerCase?.().includes(q));

    if (filterTab === "past" || timeTab === "today" || timeTab === "week" || timeTab === "custom") {
      arr.sort((a, b) => new Date(b.dateTimeUTC).getTime() - new Date(a.dateTimeUTC).getTime());
    } else {
      arr.sort((a, b) => new Date(a.dateTimeUTC).getTime() - new Date(b.dateTimeUTC).getTime());
    }

    return arr;
  }, [data, filterTab, timeTab, range.start, range.end, query]);

  const renderItem = React.useCallback(
    ({ item }: { item: Reservation }) => (
      <ReservationCard
        title={(item.restaurantId as any)?.name || "Restoran"}
        dateISO={item.dateTimeUTC}
        status={item.status}
        thumb={item.receiptUrl}
        onPress={() => nav.navigate("Rezervasyon Detayı", { id: item._id })}
      />
    ),
    [nav]
  );

  // ---- Misafir modu: CTA ----
  if (!token) {
    return (
      <Screen>
        <View style={{ alignItems: "center", marginTop: 28, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Rezervasyonlar</Text>
          <Text secondary style={{ textAlign: "center", marginBottom: 16 }}>
            Rezervasyonlarınızı görmek için giriş yapın.
          </Text>
          <TouchableOpacity
            onPress={async () => {
              await setIntended({ name: "Rezervasyonlar" });
              nav.navigate("Giriş");
            }}
            style={{
              backgroundColor: "#7B2C2C",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FilterTabs value={filterTab} onChange={setFilterTab} />
      <View style={{ marginTop: 10 }}>
        <TimeTabs
          value={timeTab}
          onChange={setTimeTab}
          onCustomChange={(startISO: string, endISO: string) => setRange({ start: startISO, end: endISO })}
        />
      </View>
      <View style={{ marginTop: 10 }}>
        <SearchBar value={query} onChange={setQuery} />
      </View>

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 20 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      ) : (
        <>
          {error ? <Text secondary style={{ marginVertical: 8 }}>Hata: {error}</Text> : null}
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
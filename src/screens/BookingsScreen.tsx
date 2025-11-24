// screens/BookingsScreen.tsx
import React from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import FilterTabs from "../components/FilterTabs";
import TimeTabs from "../components/TimeTabs";
import SearchBar from "../components/SearchBar";
import { getMyReservations, type Reservation } from "../api/reservations";
import { useAuth } from "../store/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "../i18n";

/** --- Renkler (Rezzy) --- */
const REZZY = {
  primary: "#7B2C2C",
  primaryDark: "#5E1F1F",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
  success: "#16A34A",
  warning: "#D97706",
  info: "#2563EB",
  danger: "#DC2626",
};

/** --- Yardımcılar --- */
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
  return (
    n === "arrived" ||
    n === "no_show" ||
    n === "cancelled" ||
    n === "rejected"
  );
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

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(
    locale?.toLowerCase().startsWith("tr") ? "tr-TR" : "en-GB",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(iso));

const STATUS_COLORS: Record<
  string,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { bg: "#FEF3C7", fg: "#92400E", icon: "time-outline" },
  confirmed: { bg: "#DCFCE7", fg: "#166534", icon: "checkmark-circle" },
  arrived: { bg: "#DBEAFE", fg: "#1E40AF", icon: "enter-outline" },
  no_show: { bg: "#FEE2E2", fg: "#991B1B", icon: "close-circle" },
  cancelled: { bg: "#F3F4F6", fg: "#374151", icon: "ban" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B", icon: "close-circle" },
  unknown: { bg: "#EFEFEF", fg: "#333333", icon: "information-circle" },
};

export default function BookingsScreen() {
  const nav = useNavigation<any>();
  const token = useAuth((s) => s.token);
  const setIntended = useAuth((s) => s.setIntended);

  const { t, language, locale: hookLocale } = useI18n();
// Önce hook'un döndürdüğü language, sonra locale, en sonda 'tr'
const locale = language ?? hookLocale ?? "tr";

  const [filterTab, setFilterTab] = React.useState<FilterKey>("all");
  const [timeTab, setTimeTab] = React.useState<TimeKey>("all");
  const [range, setRange] = React.useState<{ start?: string; end?: string }>({});
  const [query, setQuery] = React.useState("");

  const [data, setData] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const load = React.useCallback(async () => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      // her yüklemede fade'i resetle ki liste tekrar yumuşak giriş yapsın
      fadeAnim.setValue(0);
      setLoading(true);
      const list = await getMyReservations();
      setData(list);
    } catch (e: any) {
      const msg = e?.message || t("bookings.loadError");
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // language dependency: dil değişince bir kere daha fetch + re-render
  }, [token, language]);

  React.useEffect(() => {
    load();
    // Only rerun when token or language changes, not on every render
  }, [load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    let arr = [...data];
    if (filterTab === "active") arr = arr.filter((x) => isActiveStatus(x.status));
    else if (filterTab === "past") arr = arr.filter((x) => isPastStatus(x.status));

    if (timeTab === "today") {
      const s = startOfTodayLocal(),
        e = endOfTodayLocal();
      arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    } else if (timeTab === "week") {
      const s = startOfWeekLocal(),
        e = endOfWeekLocal();
      arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    } else if (timeTab === "custom") {
      const s = range.start ? new Date(range.start).getTime() : undefined;
      const e = range.end ? new Date(range.end).getTime() : undefined;
      if (s || e) arr = arr.filter((x) => inRange(x.dateTimeUTC, s, e));
    }

    const q = query.trim().toLowerCase();
    if (q)
      arr = arr.filter((x) =>
        (x.restaurantId as any)?.name?.toLowerCase?.().includes(q)
      );

    // sıralama
    if (filterTab === "past" || timeTab !== "all") {
      arr.sort(
        (a, b) =>
          new Date(b.dateTimeUTC).getTime() -
          new Date(a.dateTimeUTC).getTime()
      );
    } else {
      arr.sort(
        (a, b) =>
          new Date(a.dateTimeUTC).getTime() -
          new Date(b.dateTimeUTC).getTime()
      );
    }
    return arr;
  }, [data, filterTab, timeTab, range.start, range.end, query]);

  /** Satır */
  const renderItem = React.useCallback(
    ({ item }: { item: Reservation }) => {
      const restName =
        (item.restaurantId as any)?.name ||
        t("bookings.restaurantFallback");
      const st = normalizeStatus(item.status);
      const color = STATUS_COLORS[st] ?? STATUS_COLORS.unknown;

      return (
        <Pressable
          onPress={() =>
            nav.navigate("Rezervasyon Detayı", { id: item._id })
          }
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <View style={styles.thumb}>
              <Ionicons name="restaurant" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{restName}</Text>
              <View style={styles.dateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={REZZY.muted}
                />
                <Text style={styles.cardDate}>
                  {formatDate(item.dateTimeUTC, locale)}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusChip,
                { backgroundColor: color.bg },
              ]}
            >
              <Ionicons
                name={color.icon}
                size={14}
                color={color.fg}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: color.fg },
                ]}
              >
                {t(`status.${st}`)}
              </Text>
            </View>
          </View>
        </Pressable>
      );
    },
    [nav, t, locale]
  );

  /** Misafir modu */
  if (!token) {
    return (
      <Screen topPadding="flat">
        <View style={styles.guestContainer}>
          <LinearGradient
            colors={[REZZY.primary, REZZY.primaryDark]}
            style={styles.guestCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color="#fff"
              />
            </View>
            <Text style={styles.guestTitle}>
              {t("bookings.guest.title")}
            </Text>
            <Text style={styles.guestSubtitle}>
              {t("bookings.guest.subtitle")}
            </Text>
            <Pressable
              onPress={async () => {
                await setIntended({ name: "Rezervasyonlar" });
                nav.navigate("Giriş");
              }}
              style={styles.guestButton}
            >
              <Ionicons
                name="log-in-outline"
                size={20}
                color={REZZY.primary}
              />
              <Text style={styles.guestButtonText}>
                {t("bookings.guest.login")}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </Screen>
    );
  }

  return (
    <Screen topPadding="none">
      {/* Başlık */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTitleRow}>
          <Ionicons
            name="calendar"
            size={24}
            color={REZZY.primary}
          />
          <Text style={styles.headerTitle}>
            {t("bookings.title")}
          </Text>
        </View>
        {data.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filtered.length}
            </Text>
          </View>
        )}
      </View>

      {/* Filtreler */}
      <View style={styles.filtersContainer}>
        <FilterTabs
          value={filterTab}
          onChange={setFilterTab}
        />
        <TimeTabs
          value={timeTab}
          onChange={setTimeTab}
          onCustomChange={(startISO: string, endISO: string) =>
            setRange({ start: startISO, end: endISO })
          }
        />
        <SearchBar
          value={query}
          onChange={setQuery}
        />
      </View>

      {/* Liste */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={REZZY.primary}
          />
          <Text style={styles.loadingText}>
            {t("bookings.loading")}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={REZZY.danger}
          />
          <Text style={styles.errorText}>
            {t("bookings.errorPrefix")} {error}
          </Text>
          <Pressable
            onPress={load}
            style={styles.retryButton}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={REZZY.primary}
            />
            <Text style={styles.retryButtonText}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={filtered}
            keyExtractor={(it, index) =>
              it?._id ? String(it._id) : `idx-${index}`
            }
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={REZZY.primary}
                colors={[REZZY.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons
                    name="calendar-outline"
                    size={64}
                    color={REZZY.muted}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {t("bookings.emptyTitle")}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {t("bookings.emptySubtitle")}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustContentInsets={false}
          />
        </Animated.View>
      )}
    </Screen>
  );
}

/* styles aynı, sadece string yok */
const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: REZZY.surface,
    borderBottomWidth: 1,
    borderBottomColor: REZZY.border,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: REZZY.text },
  countBadge: {
    backgroundColor: REZZY.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 30,
    alignItems: "center",
  },
  countBadgeText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  filtersContainer: { paddingTop: 10, paddingHorizontal: 16, gap: 10 },
  listContent: {
    paddingTop: 6,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexGrow: 1,
  },

  card: {
    backgroundColor: REZZY.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: REZZY.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: REZZY.text },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  cardDate: { fontSize: 12, color: REZZY.muted, fontWeight: "600" },

  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: "800" },

  guestContainer: { flex: 1, paddingTop: 10 },
  guestCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  guestSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.95)",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: REZZY.primary,
  },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 14, color: REZZY.muted },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    color: REZZY.muted,
    marginTop: 10,
    marginBottom: 16,
    textAlign: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZZY.surfaceAlt,
    borderWidth: 1,
    borderColor: REZZY.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: REZZY.primary,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: REZZY.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: REZZY.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: REZZY.muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
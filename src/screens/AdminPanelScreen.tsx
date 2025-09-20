// screens/AdminPanelScreen.tsx  (GÜNCEL TAM DOSYA)
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { WebView } from "react-native-webview";
import { lightTheme as T } from "../theme/theme";
import {
  // KPI
  getAdminKpiGlobal,
  getAdminKpiRestaurant,
  adminKpiGlobal,
  adminKpiRestaurant,
  // Restaurants
  adminListRestaurants,
  adminGetRestaurant,
  adminListRestaurantReservations,
  adminUpdateRestaurantCommission,
  // Users
  adminListUsers,
  adminGetUser,
  adminBanUser,
  adminUnbanUser,
  adminUpdateUserRole,
  // Reservations
  adminListReservations,
  // Reviews & Complaints
  adminListReviews,
  adminHideReview,
  adminUnhideReview,
  adminDeleteReview,
  adminListComplaints,
  adminResolveComplaint,
  adminDismissComplaint,
  // Types
  type AdminListReservationsParams,
  type AdminListUsersParams,
  type AdminListReviewsParams,
  type AdminListComplaintsParams,
} from "../api/admin";

dayjs.locale("tr");

// ------------------------- Types & helpers -------------------------
type AdminRestaurantLite = { _id: string; name?: string; city?: string; commissionRate?: number };

const fmtMoney = (n?: number) =>
  n == null ? "-" : `₺${Number(n).toLocaleString("tr-TR")}`;

const fmtPercent = (r?: number) =>
  r == null ? "-" : `${(Number(r) * 100).toFixed(1)}%`;

const shortId = (v: any) => {
  const s = String((v as any)?._id || v || "");
  return s ? (s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s) : "-";
};

const statusMeta: Record<
  string,
  { label: string; bg: string; fg: string; border?: string }
> = {
  pending: { label: "Bekliyor", bg: "#FEF3C7", fg: "#92400E", border: "#F59E0B" },
  confirmed: { label: "Onaylı", bg: "#DCFCE7", fg: "#065F46", border: "#10B981" },
  arrived: { label: "Check-in", bg: "#E0E7FF", fg: "#3730A3", border: "#6366F1" },
  cancelled: { label: "İptal", bg: "#FEE2E2", fg: "#991B1B", border: "#EF4444" },
  no_show: { label: "No-show", bg: "#FFE4E6", fg: "#9F1239", border: "#FB7185" },
};

type Tone = "muted" | "primary" | "success" | "warn" | "error";

function Badge({ text, tone = "muted" }: { text: string; tone?: Tone }) {
  const map = {
    muted: { bg: T.colors.muted, fg: T.colors.textSecondary },
    primary: { bg: T.colors.primary, fg: "#fff" },
    success: { bg: T.colors.success, fg: "#fff" },
    warn: { bg: T.colors.warning, fg: "#fff" },
    error: { bg: T.colors.error, fg: "#fff" },
  } as const;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: map[tone].bg,
      }}
    >
      <Text style={{ color: map[tone].fg, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const m = statusMeta[status] || {
    label: status,
    bg: T.colors.muted,
    fg: T.colors.textSecondary,
  };
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: m.bg,
        borderWidth: m.border ? 1 : 0,
        borderColor: m.border || "transparent",
      }}
    >
      <Text style={{ color: m.fg, fontWeight: "700" }}>{m.label}</Text>
    </View>
  );
}

function KPI({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {subtitle ? <Text style={styles.kpiSub}>{subtitle}</Text> : null}
    </View>
  );
}

function Row({
  left,
  right,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 6,
      }}
    >
      <Text style={{ color: T.colors.textSecondary }}>{left}</Text>
      <Text style={{ color: T.colors.text, fontWeight: "600" }}>{right as any}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text
        style={[styles.tabButtonText, active && styles.tabButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Yardımcı: seri etiketini (day/week/month) okunur hale getir
function prettySeriesLabel(raw: string, gb: "day" | "week" | "month") {
  if (!raw) return "-";
  if (gb === "day") return dayjs(raw).isValid() ? dayjs(raw).format("DD MMM YYYY") : raw;
  if (gb === "month") return dayjs(raw + "-01").isValid() ? dayjs(raw + "-01").format("MMM YYYY") : raw;
  // week: "YYYY-Www"
  const m = raw.match(/^(\d{4})-W(\d{2})$/);
  if (gb === "week" && m) {
    const [, y, w] = m;
    return `${Number(w)}. hafta ${y}`;
  }
  return raw;
}

// ------------------------- Screen -------------------------
export default function AdminPanelScreen() {
  const [active, setActive] = useState<
    "genel" | "mekanlar" | "kullanicilar" | "rezervasyonlar" | "yorumlar"
  >("genel");

  // Common - restaurants
  const [restaurants, setRestaurants] = useState<AdminRestaurantLite[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | "ALL">("ALL");

  // Restaurant picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restaurantSearch, setRestaurantSearch] = useState("");

  // Commission edit modal
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionEditValue, setCommissionEditValue] = useState<string>("");
  const [commissionEditRestaurant, setCommissionEditRestaurant] = useState<AdminRestaurantLite | null>(null);

  const filteredRestaurants = useMemo<AdminRestaurantLite[]>(() => {
    const q = restaurantSearch.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        r?.name?.toLowerCase?.().includes(q) ||
        r?.city?.toLowerCase?.().includes(q)
    );
  }, [restaurants, restaurantSearch]);

  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  // KPI
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpi, setKpi] = useState<any>(null);

  // Reservations (global)
  const [resLoading, setResLoading] = useState(false);
  const [resList, setResList] = useState<any[]>([]);
  const [resCursor, setResCursor] = useState<string | undefined>(undefined);
  const [resHasMore, setResHasMore] = useState(false);
  const [resStatus, setResStatus] =
    useState<AdminListReservationsParams["status"]>("");

  // Users
  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState<AdminListUsersParams["role"]>("");
  const [userBanned, setUserBanned] =
    useState<AdminListUsersParams["banned"]>("");
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersCursor, setUsersCursor] = useState<string | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banUntil, setBanUntil] = useState("");

  // Role change modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleTargetUser, setRoleTargetUser] = useState<any>(null);
  const [roleValue, setRoleValue] = useState<"customer" | "restaurant" | "admin">("customer");

  // User KPI modal
  const [userKpiOpen, setUserKpiOpen] = useState(false);
  const [userKpiData, setUserKpiData] = useState<null | any>(null);

  // Reviews & Complaints
  const [rvwList, setRvwList] = useState<any[]>([]);
  const [rvwLoading, setRvwLoading] = useState(false);
  const [rvwCursor, setRvwCursor] = useState<string | undefined>(undefined);
  const [rvwStatus, setRvwStatus] =
    useState<AdminListReviewsParams["status"]>("");

  const [cmpList, setCmpList] = useState<any[]>([]);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpCursor, setCmpCursor] = useState<string | undefined>(undefined);
  const [cmpStatus, setCmpStatus] =
    useState<AdminListComplaintsParams["status"]>("");

  // Receipt preview
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "web">("web");
  function openReceipt(u0: string) {
    const u = String(u0 || "").trim();
    if (!u) return;
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(u)) setPreviewType("image");
    else if (u.toLowerCase().endsWith(".pdf")) setPreviewType("pdf");
    else setPreviewType("web");
    setPreviewUrl(u);
    setPreviewVisible(true);
  }

  // initial restaurants
  useEffect(() => {
    (async () => {
      try {
        const r = await adminListRestaurants();
        setRestaurants((r.items || []) as AdminRestaurantLite[]);
      } catch {}
    })();
  }, []);

  // --------- Loaders ----------
  async function loadKpi() {
    try {
      setKpiLoading(true);
      const params = { start: dateStart || undefined, end: dateEnd || undefined, groupBy };
      const data =
        selectedRestaurant !== "ALL"
          ? await getAdminKpiRestaurant(api, String(selectedRestaurant), params)
          : await getAdminKpiGlobal(api, params);
      setKpi(data);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "KPI yüklenemedi");
    } finally {
      setKpiLoading(false);
    }
  }

  async function loadReservations(reset = false) {
    try {
      if (reset) {
        setResCursor(undefined);
        setResList([]);
      }
      setResLoading(true);
      const { items, nextCursor } = await adminListReservations({
        status: resStatus || undefined,
        restaurantId:
          selectedRestaurant !== "ALL" ? String(selectedRestaurant) : undefined,
        start: dateStart || undefined,
        end: dateEnd || undefined,
        limit: 30,
        cursor: reset ? undefined : resCursor,
      });
      setResList((prev) => (reset ? items : [...prev, ...items]));
      setResCursor(nextCursor);
      setResHasMore(Boolean(nextCursor));
    } catch (e: any) {
      Alert.alert(
        "Hata",
        e?.response?.data?.message || e?.message || "Rezervasyonlar yüklenemedi"
      );
    } finally {
      setResLoading(false);
    }
  }

  async function loadUsers(reset = false) {
    try {
      if (reset) {
        setUsers([]);
        setUsersCursor(undefined);
      }
      setUsersLoading(true);
      const { items, nextCursor } = await adminListUsers({
        query: userQuery || undefined,
        role: userRole || undefined,
        banned: userBanned || undefined,
        limit: 30,
        cursor: reset ? undefined : usersCursor,
      });
      setUsers((prev) => (reset ? items : [...prev, ...items]));
      setUsersCursor(nextCursor);
    } catch (e: any) {
      Alert.alert(
        "Hata",
        e?.response?.data?.message || e?.message || "Kullanıcılar yüklenemedi"
      );
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadReviews(reset = false) {
    try {
      if (reset) {
        setRvwList([]);
        setRvwCursor(undefined);
      }
      setRvwLoading(true);
      const { items, nextCursor } = await adminListReviews({
        restaurantId:
          selectedRestaurant !== "ALL" ? String(selectedRestaurant) : undefined,
        status: rvwStatus || undefined,
        limit: 30,
        cursor: reset ? undefined : rvwCursor,
      });
      setRvwList((prev) => (reset ? items : [...prev, ...items]));
      setRvwCursor(nextCursor);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Yorumlar yüklenemedi");
    } finally {
      setRvwLoading(false);
    }
  }

  async function loadComplaints(reset = false) {
    try {
      if (reset) {
        setCmpList([]);
        setCmpCursor(undefined);
      }
      setCmpLoading(true);
      const { items, nextCursor } = await adminListComplaints({
        restaurantId:
          selectedRestaurant !== "ALL" ? String(selectedRestaurant) : undefined,
        status: cmpStatus || undefined,
        limit: 30,
        cursor: reset ? undefined : cmpCursor,
      });
      setCmpList((prev) => (reset ? items : [...prev, ...items]));
      setCmpCursor(nextCursor);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Şikayetler yüklenemedi");
    } finally {
      setCmpLoading(false);
    }
  }

  // ------------------------- List headers (filters) -------------------------
  const FiltersHeader = (
    <View style={{ gap: 12 }}>
      {/* Restaurant selector */}
      <View>
        <Text style={styles.label}>Restoran</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.chip,
              selectedRestaurant === "ALL" && styles.chipActive,
            ]}
            onPress={() => setSelectedRestaurant("ALL")}
          >
            <Text
              style={[
                styles.chipText,
                selectedRestaurant === "ALL" && styles.chipTextActive,
              ]}
            >
              Tümü
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setPickerOpen(true)}
          >
            <Text style={styles.secondaryBtnText}>
              {selectedRestaurant === "ALL"
                ? "Restoran Seç"
                : `Seçili: ${shortId(selectedRestaurant)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date & group */}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <View style={{ flexGrow: 1, minWidth: 140 }}>
          <Text style={styles.label}>Başlangıç</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={dateStart}
            onChangeText={setDateStart}
            style={styles.input}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: 140 }}>
          <Text style={styles.label}>Bitiş</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={dateEnd}
            onChangeText={setDateEnd}
            style={styles.input}
          />
        </View>
        <View>
          <Text style={styles.label}>Gruplama</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["day", "week", "month"] as const).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGroupBy(g)}
                style={[styles.chip, groupBy === g && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, groupBy === g && styles.chipTextActive]}
                >
                  {g === "day" ? "gün" : g === "week" ? "hafta" : "ay"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  // ------------------------- Tabs -------------------------
  // Genel (KPI)
  const GenelTab = (
    <FlatList
      data={kpi ? [1] : []}
      keyExtractor={() => "kpi"}
      contentContainerStyle={styles.tabContainer}
      ListHeaderComponent={
        <Section title="Filtreler">
          {FiltersHeader}
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 8 }]} onPress={loadKpi}>
            <Text style={styles.primaryBtnText}>KPI’ları Getir</Text>
          </TouchableOpacity>
          {kpiLoading && <ActivityIndicator style={{ marginTop: 10 }} />}
        </Section>
      }
      renderItem={() => (
        kpi ? (
          <View style={{ gap: 12 }}>
            <View style={styles.kpiRow}>
              <KPI title="Toplam Rez." value={String(kpi.totals.reservations.total)} />
              <KPI title="Onaylı" value={String(kpi.totals.reservations.confirmed)} />
              <KPI title="Check-in" value={String(kpi.totals.reservations.arrived)} />
            </View>
            <View style={styles.kpiRow}>
              <KPI title="İptal" value={String(kpi.totals.reservations.cancelled)} />
              <KPI title="Ciro" value={fmtMoney(kpi.totals.revenue)} />
              <KPI title="Kapora" value={fmtMoney(kpi.totals.deposits)} />
            </View>

            {/* --- KOMİSYONLAR (YENİ) --- */}
            <Section title="Komisyonlar">
              <View style={styles.kpiRow}>
                <KPI title="Toplam Komisyon" value={fmtMoney(kpi.commissions?.total || kpi.totals?.commission || 0)} />
                <KPI title="Toplam Ciro (baz)" value={fmtMoney(kpi?.commissions?.revenue || kpi?.totals?.revenue || 0)} />
                <KPI title="Rez. Adedi (baz)" value={String(kpi?.commissions?.count ?? kpi?.totals?.reservations?.total ?? 0)} />
              </View>

              <Text style={{ color: T.colors.textSecondary, marginTop: 8, marginBottom: 6, fontWeight: "700" }}>
                Restoran Bazında
              </Text>
              {Array.isArray(kpi?.commissions?.byRestaurant) && kpi.commissions.byRestaurant.length > 0 ? (
                <View style={styles.tsTableWrap}>
                  <View style={styles.tsHeaderRow}>
                    <Text style={[styles.tsHeaderCell, styles.tsCell, { minWidth: 180 }]}>Restoran</Text>
                    <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Komisyon</Text>
                    <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Ciro</Text>
                    <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Rez.</Text>
                  </View>
                  {kpi.commissions.byRestaurant.map((r: any) => (
                    <View key={String(r.restaurantId)} style={styles.tsRow}>
                      <Text style={[styles.tsCell, { minWidth: 180 }]}>{r.name || shortId(r.restaurantId)}</Text>
                      <Text style={styles.tsCellNum}>{fmtMoney(r.commission)}</Text>
                      <Text style={styles.tsCellNum}>{fmtMoney(r.revenue)}</Text>
                      <Text style={styles.tsCellNum}>{r.count}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: T.colors.textSecondary }}>Bu aralıkta komisyon verisi yok.</Text>
              )}
            </Section>
            {/* --- /KOMİSYONLAR --- */}

            {/* --- ZAMAN SERİSİ --- */}
            <Section title="Zaman Serisi">
              <Text style={{ color: T.colors.textSecondary, marginBottom: 8 }}>
                {(kpi.range?.start || "…")} — {(kpi.range?.end || "…")} • {kpi.range?.groupBy === "week" ? "hafta" : kpi.range?.groupBy === "month" ? "ay" : "gün"}
              </Text>

              {Array.isArray(kpi.series?.labels) && kpi.series.labels.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tsTableWrap}>
                    {/* Header */}
                    <View style={styles.tsHeaderRow}>
                      <Text style={[styles.tsHeaderCell, styles.tsCell, { minWidth: 160 }]}>Dönem</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Rez.</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Check-in</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsCellNum]}>Ciro</Text>
                      {/* Ort. Tutar sütunu KALDIRILDI */}
                    </View>
                    {/* Rows */}
                    {kpi.series.labels.map((raw: string, i: number) => {
                      const resv = Number(kpi.series.reservations?.[i] || 0);
                      const arrived = Number(kpi.series.arrived?.[i] || 0);
                      const revenue = Number(kpi.series.revenue?.[i] || 0);
                      const label = prettySeriesLabel(raw, (kpi.range?.groupBy || "day"));
                      return (
                        <View key={i} style={styles.tsRow}>
                          <Text style={[styles.tsCell, { minWidth: 160 }]}>{label}</Text>
                          <Text style={[styles.tsCellNum]}>{resv}</Text>
                          <Text style={[styles.tsCellNum]}>{arrived}</Text>
                          <Text style={[styles.tsCellNum]}>{fmtMoney(revenue)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <Text style={{ color: T.colors.textSecondary }}>Bu aralıkta veri yok.</Text>
              )}
            </Section>
            {/* --- /ZAMAN SERİSİ --- */}
          </View>
        ) : (
          <View />
        )
      )}
    />
  );

  // Mekanlar
  const MekanlarTab = (
    <FlatList<AdminRestaurantLite>
      data={restaurants}
      keyExtractor={(it) => it._id}
      contentContainerStyle={styles.tabContainer}
      ListHeaderComponent={
        <View style={[styles.card, { marginBottom: 10 }]}>
          <Text style={styles.cardTitle}>Restoranlar</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={styles.secondaryBtnText}>Restoran Ara / Seç</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <View style={styles.cardItem}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.itemTitle}>{item?.name ?? "-"}</Text>
            <Text style={{ color: T.colors.textSecondary }}>{item?.city ?? "-"}</Text>
          </View>
          <Row left="Komisyon Oranı" right={fmtPercent(item?.commissionRate ?? 0.05)} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={async () => {
                try {
                  const d = (await adminGetRestaurant(item._id)) as Partial<AdminRestaurantLite>;
                  Alert.alert("Restoran", `${d?.name ?? "-"}\n${d?.city ?? ""}`);
                } catch (e: any) {
                  Alert.alert("Hata", e?.message || "Detay alınamadı");
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>Detay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={async () => {
                try {
                  const { items } = await adminListRestaurantReservations(item._id, { limit: 10 });
                  const lines =
                    (items || [])
                      .map((x: any) =>
                        `${dayjs(x.dateTimeUTC).format("DD MMM HH:mm")} • ${statusMeta[x.status]?.label || x.status} • ${fmtMoney(x.totalPrice)}`
                      )
                      .join("\n") || "(kayıt yok)";
                  Alert.alert("Son Rezervasyonlar", lines);
                } catch (e: any) {
                  Alert.alert("Hata", e?.message || "Liste alınamadı");
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>Rezervasyonlar</Text>
            </TouchableOpacity>
            {/* Komisyon düzenle */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setCommissionEditRestaurant(item);
                setCommissionEditValue(
                  item?.commissionRate != null ? String((item.commissionRate * 100).toFixed(1)) : "5"
                );
                setCommissionModalOpen(true);
              }}
            >
              <Text style={styles.primaryBtnText}>Komisyonu Düzenle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );

  // Rezervasyonlar
  const RezervasyonlarTab = (
    <FlatList
      data={resList}
      keyExtractor={(it) => it._id}
      contentContainerStyle={styles.tabContainer}
      ListHeaderComponent={
        <Section title="Filtreler">
          {FiltersHeader}
          <View style={[styles.card, { marginTop: 10 }]}>
            <Text style={styles.cardTitle}>Durum</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {["", "pending", "confirmed", "arrived", "cancelled", "no_show"].map((s) => (
                <TouchableOpacity
                  key={s || "all"}
                  onPress={() =>
                    setResStatus(s as AdminListReservationsParams["status"])
                  }
                  style={[styles.chip, resStatus === s && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      resStatus === s && styles.chipTextActive,
                    ]}
                  >
                    {s ? statusMeta[s]?.label || s : "Tümü"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 8 }]}
              onPress={() => loadReservations(true)}
            >
              <Text style={styles.primaryBtnText}>Listeyi Getir</Text>
            </TouchableOpacity>
            {resLoading && <ActivityIndicator style={{ marginTop: 10 }} />}
          </View>
        </Section>
      }
      renderItem={({ item: rv }) => {
        const rest = rv?.restaurantId?.name ?? shortId(rv?.restaurantId);
        const user =
          rv?.userId?.name ?? rv?.userId?.email ?? shortId(rv?.userId);
        const rcv: string = String(rv?.receiptUrl || "");
        const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(rcv);
        const isPdf = rcv.toLowerCase().endsWith(".pdf");
        return (
          <View style={styles.cardItem}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.itemTitle}>
                {dayjs(rv.dateTimeUTC).format("DD MMM, HH:mm")} • {rv.partySize} kişi
              </Text>
              <StatusPill status={rv.status} />
            </View>
            <Row left="Restoran" right={rest} />
            <Row left="Kullanıcı" right={user} />
            <Row left="Tutar" right={fmtMoney(rv.totalPrice)} />
            <Row left="Kapora" right={fmtMoney(rv.depositAmount)} />

            {rcv ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {isImage ? (
                  <Image
                    source={{ uri: rcv }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: T.colors.muted,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: T.colors.muted,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ color: T.colors.textSecondary, fontWeight: "700" }}
                    >
                      {isPdf ? "PDF" : "WEB"}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => openReceipt(rcv)}
                >
                  <Text style={styles.secondaryBtnText}>Dekontu Görüntüle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.muted, { marginTop: 8 }]}>Dekont yok</Text>
            )}
          </View>
        );
      }}
      ListFooterComponent={
        resHasMore && !resLoading ? (
          <TouchableOpacity
            style={[styles.secondaryBtn, { alignSelf: "center", marginTop: 12 }]}
            onPress={() => loadReservations(false)}
          >
            <Text style={styles.secondaryBtnText}>Daha Fazla Yükle</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

  // Kullanıcılar (rol değişimi eklendi)
  const KullanicilarTab = (
    <FlatList
      data={users}
      keyExtractor={(it) => it._id}
      contentContainerStyle={styles.tabContainer}
      ListHeaderComponent={
        <Section title="Kullanıcı Filtreleri">
          <TextInput
            placeholder="Ara (isim/e-posta)"
            value={userQuery}
            onChangeText={setUserQuery}
            style={styles.input}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginTop: 6 }}
          >
            {["", "customer", "restaurant", "admin"].map((r) => (
              <TouchableOpacity
                key={r || "all"}
                onPress={() => setUserRole(r as AdminListUsersParams["role"])}
                style={[styles.chip, userRole === r && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, userRole === r && styles.chipTextActive]}
                >
                  {r || "Tümü"}
                </Text>
              </TouchableOpacity>
            ))}
            {["", "true", "false"].map((b) => (
              <TouchableOpacity
                key={b || "any"}
                onPress={() => setUserBanned(b as AdminListUsersParams["banned"]) }
                style={[styles.chip, userBanned === b && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    userBanned === b && styles.chipTextActive,
                  ]}
                >
                  {b === ""
                    ? "Ban (hepsi)"
                    : b === "true"
                    ? "Banlı"
                    : "Banlı değil"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 8 }]}
            onPress={() => loadUsers(true)}
          >
            <Text style={styles.primaryBtnText}>Kullanıcıları Getir</Text>
          </TouchableOpacity>
          {usersLoading && <ActivityIndicator style={{ marginTop: 10 }} />}
        </Section>
      }
      renderItem={({ item: u }) => (
        <View style={styles.cardItem}>
          <Text style={styles.itemTitle}>
            {u?.name || "(isim yok)"} • {u?.email}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              marginTop: 6,
              flexWrap: "nowrap",
            }}
          >
            <Badge text={`Rol: ${u.role}`} tone="muted" />
            <Badge text={u.banned ? "Banlı" : "Aktif"} tone={u.banned ? "warn" : "success"} />
          </View>
          {u.banned && <Row left="Ban sebebi" right={u.banReason || "-"} />}
          {u.bannedUntil && (
            <Row
              left="Ban bitiş"
              right={dayjs(u.bannedUntil).format("YYYY-MM-DD HH:mm")}
            />
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: 10 }}
          >
            {!u.banned ? (
              <TouchableOpacity
                style={styles.warningBtn}
                onPress={() => {
                  setSelectedUser(u);
                  setBanModalOpen(true);
                }}
              >
                <Text style={styles.warningBtnText}>Banla</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.successBtn}
                onPress={async () => {
                  try {
                    await adminUnbanUser(u._id);
                    Alert.alert("OK", "Ban kaldırıldı");
                    loadUsers(true);
                  } catch (e: any) {
                    Alert.alert("Hata", e?.message || "İşlem olmadı");
                  }
                }}
              >
                <Text style={styles.successBtnText}>Ban Kaldır</Text>
              </TouchableOpacity>
            )}

            {/* Rol değiştir */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setRoleTargetUser(u);
                setRoleValue(u.role);
                setRoleModalOpen(true);
              }}
            >
              <Text style={styles.secondaryBtnText}>Rol Değiştir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={async () => {
                try {
                  const d = await adminGetUser(u._id);
                  setUserKpiData(d);
                  setUserKpiOpen(true);
                } catch (e: any) {
                  Alert.alert("Hata", e?.message || "Detay alınamadı");
                }
              }}
            >
              <Text style={styles.secondaryBtnText}>Detay KPI</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
      ListFooterComponent={
        usersCursor && !usersLoading ? (
          <TouchableOpacity
            style={[styles.secondaryBtn, { alignSelf: "center", marginTop: 12 }]}
            onPress={() => loadUsers(false)}
          >
            <Text style={styles.secondaryBtnText}>Daha Fazla</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

  // Yorumlar & Şikayetler
  const YorumlarTab = (
    <FlatList
      data={[1]} // iki blok: Yorumlar ve Şikayetler; tek liste üzerinden render
      keyExtractor={() => "reviews-complaints"}
      contentContainerStyle={styles.tabContainer}
      renderItem={() => (
        <View style={{ gap: 16 }}>
          {/* Yorumlar */}
          <Section title="Yorumlar">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 6 }}
            >
              {["", "visible", "hidden", "removed"].map((s) => (
                <TouchableOpacity
                  key={s || "all"}
                  onPress={() =>
                    setRvwStatus(s as AdminListReviewsParams["status"])
                  }
                  style={[styles.chip, rvwStatus === s && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      rvwStatus === s && styles.chipTextActive,
                    ]}
                  >
                    {s || "Tümü"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => loadReviews(true)}
            >
              <Text style={styles.primaryBtnText}>Yorumları Getir</Text>
            </TouchableOpacity>
            {rvwLoading && <ActivityIndicator style={{ marginTop: 10 }} />}

            {(rvwList || []).map((r) => (
              <View key={r._id} style={[styles.cardItem, { marginTop: 12 }]}>
                <Text style={styles.itemTitle}>Puan {r.rating} / 5</Text>
                <Row left="Restoran" right={shortId(r.restaurantId)} />
                <Row left="Kullanıcı" right={shortId(r.userId)} />
                <Text style={{ marginTop: 6 }}>{r.comment || "-"}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: 10 }}
                >
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={async () => {
                      try {
                        await adminHideReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Gizle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={async () => {
                      try {
                        await adminUnhideReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Göster</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={async () => {
                      try {
                        await adminDeleteReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.deleteBtnText}>Sil</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ))}
          </Section>

          {/* Şikayetler */}
          <Section title="Şikayetler">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 6 }}
            >
              {["", "open", "resolved", "dismissed"].map((s) => (
                <TouchableOpacity
                  key={s || "all"}
                  onPress={() =>
                    setCmpStatus(s as AdminListComplaintsParams["status"])
                  }
                  style={[styles.chip, cmpStatus === s && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      cmpStatus === s && styles.chipTextActive,
                    ]}
                  >
                    {s || "Tümü"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => loadComplaints(true)}
            >
              <Text style={styles.primaryBtnText}>Şikayetleri Getir</Text>
            </TouchableOpacity>
            {cmpLoading && <ActivityIndicator style={{ marginTop: 10 }} />}

            {(cmpList || []).map((c) => (
              <View key={c._id} style={[styles.cardItem, { marginTop: 12 }]}>
                <Text style={styles.itemTitle}>{c.subject}</Text>
                <Text style={{ marginTop: 6 }}>{c.text}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, marginTop: 10 }}
                >
                  <TouchableOpacity
                    style={styles.successBtn}
                    onPress={async () => {
                      try {
                        await adminResolveComplaint(c._id);
                        loadComplaints(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.successBtnText}>Çözüldü</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={async () => {
                      try {
                        await adminDismissComplaint(c._id);
                        loadComplaints(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Reddet</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            ))}
          </Section>
        </View>
      )}
    />
  );

  // ------------------------- Render -------------------------
  return (
    <View style={styles.screen}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <Tab label="Genel" active={active === "genel"} onPress={() => setActive("genel")} />
        <Tab label="Mekanlar" active={active === "mekanlar"} onPress={() => setActive("mekanlar")} />
        <Tab label="Kullanıcılar" active={active === "kullanicilar"} onPress={() => setActive("kullanicilar")} />
        <Tab
          label="Rezervasyonlar"
          active={active === "rezervasyonlar"}
          onPress={() => setActive("rezervasyonlar")}
        />
        <Tab label="Yorumlar" active={active === "yorumlar"} onPress={() => setActive("yorumlar")} />
      </View>

      {active === "genel" && GenelTab}
      {active === "mekanlar" && MekanlarTab}
      {active === "kullanicilar" && KullanicilarTab}
      {active === "rezervasyonlar" && RezervasyonlarTab}
      {active === "yorumlar" && YorumlarTab}

      {/* Dekont önizleme (uygulama içi) */}
      {previewVisible && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewBackdrop}>
            <TouchableOpacity
              onPress={() => setPreviewVisible(false)}
              style={styles.previewClose}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Kapat</Text>
            </TouchableOpacity>
            {previewType === "image" && !!previewUrl ? (
              <View style={styles.previewBody}>
                <Image
                  source={{ uri: previewUrl }}
                  resizeMode="contain"
                  style={{ width: "100%", height: "90%" }}
                />
              </View>
            ) : !!previewUrl ? (
              <WebView
                style={styles.previewWeb}
                source={{ uri: previewUrl }}
                startInLoadingState
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                allowFileAccess
                originWhitelist={["*"]}
              />
            ) : null}
          </View>
        </Modal>
      )}

      {/* Restoran seçici modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>Restoran Seç</Text>
            <TextInput
              style={styles.input}
              placeholder="Ara: isim veya şehir"
              value={restaurantSearch}
              onChangeText={setRestaurantSearch}
            />
            <FlatList<AdminRestaurantLite>
              style={{ marginTop: 8 }}
              data={filteredRestaurants}
              keyExtractor={(it) => it._id}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cardItem, { marginBottom: 0 }]}
                  onPress={() => {
                    setSelectedRestaurant(item._id);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.itemTitle}>{item?.name ?? "-"}</Text>
                  <Text style={{ color: T.colors.textSecondary }}>
                    {item?.city ?? "-"}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 12 }}>
                  <Text>Sonuç yok.</Text>
                </View>
              }
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, { alignSelf: "flex-end", marginTop: 10 }]}
              onPress={() => setPickerOpen(false)}
            >
              <Text style={styles.secondaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Komisyon düzenleme modalı */}
      <Modal
        visible={commissionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommissionModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Komisyon Oranı ({commissionEditRestaurant?.name || "-"})
            </Text>
            <Text style={{ color: T.colors.textSecondary, marginBottom: 6 }}>
              Yüzde olarak gir (örn. 5) veya oran olarak gir (örn. 0.05)
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="5  veya  0.05"
              value={commissionEditValue}
              onChangeText={setCommissionEditValue}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setCommissionModalOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  try {
                    const raw = Number(commissionEditValue.replace(",", "."));
                    if (Number.isNaN(raw)) throw new Error("Geçersiz değer");
                    const rate = raw > 1 ? raw / 100 : raw;
                    if (rate < 0 || rate > 1) throw new Error("0–1 aralığında olmalı");
                    const rid = commissionEditRestaurant?._id!;
                    await adminUpdateRestaurantCommission(rid, rate);
                    Alert.alert("OK", "Komisyon güncellendi");
                    // listede var olan öğeyi güncelle
                    setRestaurants((prev) =>
                      prev.map((r) =>
                        r._id === rid ? { ...r, commissionRate: rate } : r
                      )
                    );
                    setCommissionModalOpen(false);
                  } catch (e: any) {
                    Alert.alert("Hata", e?.message || "Güncellenemedi");
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ban modal */}
      <Modal
        visible={banModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBanModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Kullanıcıyı Banla</Text>
            <TextInput
              style={styles.input}
              placeholder="Sebep"
              value={banReason}
              onChangeText={setBanReason}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Bitiş (opsiyonel, YYYY-MM-DD)"
              value={banUntil}
              onChangeText={setBanUntil}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setBanModalOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.warningBtn}
                onPress={async () => {
                  try {
                    if (!selectedUser?._id) return;
                    await adminBanUser(selectedUser._id, {
                      reason: banReason,
                      bannedUntil: banUntil || undefined,
                    });
                    setBanModalOpen(false);
                    setBanReason("");
                    setBanUntil("");
                    loadUsers(true);
                  } catch (e: any) {
                    Alert.alert("Hata", e?.message || "Ban başarısız");
                  }
                }}
              >
                <Text style={styles.warningBtnText}>Banla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rol değişim modalı */}
      <Modal
        visible={roleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rol Değiştir</Text>
            <Text style={{ color: T.colors.textSecondary, marginBottom: 8 }}>
              {roleTargetUser?.name} • {roleTargetUser?.email}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["customer", "restaurant", "admin"] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, roleValue === r && styles.chipActive]}
                  onPress={() => setRoleValue(r)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      roleValue === r && styles.chipTextActive,
                    ]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setRoleModalOpen(false)}
              >
                <Text style={styles.secondaryBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  try {
                    if (!roleTargetUser?._id) return;
                    await adminUpdateUserRole(roleTargetUser._id, roleValue);
                    Alert.alert("OK", "Rol güncellendi");
                    setRoleModalOpen(false);
                    // listeyi tazele
                    loadUsers(true);
                  } catch (e: any) {
                    Alert.alert("Hata", e?.message || "Rol güncellenemedi");
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* User KPI modal */}
      <Modal
        visible={userKpiOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUserKpiOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>Kullanıcı KPI</Text>
            {userKpiData ? (
              <View>
                <Row left="Toplam" right={String(userKpiData.kpi?.total ?? 0)} />
                <Row left="Onaylı" right={String(userKpiData.kpi?.confirmed ?? 0)} />
                <Row left="Check-in" right={String(userKpiData.kpi?.arrived ?? 0)} />
                <Row left="İptal" right={String(userKpiData.kpi?.cancelled ?? 0)} />
                <Row left="No-show" right={String(userKpiData.kpi?.no_show ?? 0)} />
                <Row left="Ciro" right={fmtMoney(userKpiData.kpi?.revenue ?? 0)} />
                <Row left="Kapora" right={fmtMoney(userKpiData.kpi?.deposits ?? 0)} />
              </View>
            ) : (
              <Text>—</Text>
            )}
            <TouchableOpacity
              style={[styles.secondaryBtn, { alignSelf: "flex-end", marginTop: 10 }]}
              onPress={() => setUserKpiOpen(false)}
            >
              <Text style={styles.secondaryBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ------------------------- Styles -------------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.colors.background },
  tabs: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: T.radius.sm,
    backgroundColor: T.colors.muted,
  },
  tabButtonActive: { backgroundColor: T.colors.primary },
  tabButtonText: { color: T.colors.text },
  tabButtonTextActive: { color: "#FFFFFF", fontWeight: "700" },

  tabContainer: { padding: 16 },

  card: {
    backgroundColor: T.colors.surface,
    padding: 16,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontWeight: "800",
    marginBottom: 10,
    color: T.colors.text,
    fontSize: 18,
  },

  cardItem: {
    backgroundColor: T.colors.surface,
    padding: 14,
    borderRadius: T.radius.md,
    borderWidth: 1,
    borderColor: T.colors.border,
    marginBottom: 12,
  },
  itemTitle: { fontWeight: "700", color: T.colors.text, fontSize: 16 },

  label: { color: T.colors.textSecondary, marginBottom: 4, fontWeight: "600" },

  input: {
    borderWidth: 1,
    borderColor: T.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: T.radius.md,
    color: T.colors.text,
    backgroundColor: "#fff",
  },

  primaryBtn: {
    backgroundColor: T.colors.primary,
    paddingVertical: 12,
    borderRadius: T.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: T.colors.muted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: T.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  secondaryBtnText: { color: T.colors.primary, fontWeight: "700" },
  successBtn: {
    backgroundColor: T.colors.success,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: T.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  successBtnText: { color: "#FFFFFF", fontWeight: "700" },
  warningBtn: {
    backgroundColor: T.colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: T.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  warningBtnText: { color: "#FFFFFF", fontWeight: "700" },
  deleteBtn: {
    backgroundColor: T.colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: T.radius.md,
    alignSelf: "flex-start",
  },
  deleteBtnText: { color: "#fff", fontWeight: "700" },

  muted: { color: T.colors.textSecondary },
  chip: {
    backgroundColor: T.colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: T.colors.primary },
  chipText: { color: T.colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  // KPI
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: T.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  kpiTitle: { color: T.colors.textSecondary, fontWeight: "600" },
  kpiValue: { color: T.colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  kpiSub: { color: T.colors.textSecondary, marginTop: 2 },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  modalTitle: { fontWeight: "800", fontSize: 18, marginBottom: 10, color: T.colors.text },

  // Receipt preview
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  previewClose: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  previewBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  previewWeb: {
    flex: 1,
    marginTop: 60,
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
  },

  // --- Zaman Serisi tablo stilleri ---
  tsTableWrap: {
    borderWidth: 1,
    borderColor: T.colors.border,
    borderRadius: T.radius.md,
    overflow: "hidden",
    marginTop: 2,
  },
  tsHeaderRow: {
    flexDirection: "row",
    backgroundColor: T.colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: T.colors.border,
  },
  tsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: T.colors.border,
    backgroundColor: "#fff",
  },
  tsCell: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 110,
    color: T.colors.text,
  },
  tsHeaderCell: {
    fontWeight: "800",
    color: T.colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 110,
  },
  tsCellNum: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 110,
    textAlign: "right",
    color: T.colors.text,
    fontVariant: ["tabular-nums"],
  },
});

// src/screens/Admin/AdminGeneralScreen.tsx
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Modal,
} from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { rp } from "../RestaurantPanel/rpStyles";
import {
  adminListRestaurants,
  adminKpiGlobal,
  adminKpiRestaurant,
} from "../../api/admin";
import DateTimePicker from "@react-native-community/datetimepicker";

// Opsiyonel marka rengi (panelTheme varsa ordan al)
let BRAND = "#7B2C2C";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { panel } = require("../../theme/panelTheme");
  if (panel?.colors?.brand) BRAND = panel.colors.brand;
} catch {}

dayjs.locale("tr");

type AdminRestaurantLite = { _id: string; name?: string; city?: string };

const fmtMoney = (n?: number) =>
  n == null ? "-" : `₺${Number(n).toLocaleString("tr-TR")}`;

const shortId = (v: any) => {
  const s = String((v as any)?._id || v || "");
  return s ? (s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s) : "-";
};

function prettySeriesLabel(raw: string, gb: "day" | "week" | "month") {
  if (!raw) return "-";
  if (gb === "day") return dayjs(raw).isValid() ? dayjs(raw).format("DD MMM YYYY") : raw;
  if (gb === "month")
    return dayjs(raw + "-01").isValid()
      ? dayjs(raw + "-01").format("MMM YYYY")
      : raw;
  const m = raw.match(/^(\d{4})-W(\d{2})$/);
  if (gb === "week" && m) {
    const [, y, w] = m;
    return `${Number(w)}. hafta ${y}`;
  }
  return raw;
}

/** ----- DateField ----- */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => {
    const d = new Date(value || "");
    return Number.isNaN(+d) ? new Date() : d;
  }, [value]);
  const [temp, setTemp] = React.useState<Date>(parsed);

  React.useEffect(() => {
    setTemp(parsed);
  }, [parsed]);

  const handleChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event?.type === "set" && selected) {
        onChange(dayjs(selected).format("YYYY-MM-DD"));
      }
    } else {
      if (selected) setTemp(selected);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "#6b7280", fontWeight: "600" }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={[styles.input, { minWidth: 130, justifyContent: "center" }]}
      >
        <Text style={{ color: value ? "#111" : "#9ca3af" }}>
          {value || "YYYY-MM-DD"}
        </Text>
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
            <View style={[styles.card, { paddingBottom: 10 }]}>
              <Text style={styles.cardTitle}>Tarih seç</Text>

              <DateTimePicker
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                value={temp}
                onChange={handleChange}
              />

              {Platform.OS === "ios" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={() => {
                      setOpen(false);
                      setTemp(parsed);
                    }}
                  >
                    <Text style={styles.btnMutedText}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={() => {
                      onChange(dayjs(temp).format("YYYY-MM-DD"));
                      setOpen(false);
                    }}
                  >
                    <Text style={styles.btnPrimaryText}>Seç</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

/** ----- MiniBars: değer etiketli ----- */
function MiniBars({
  labels,
  values,
  title,
}: {
  labels: string[];
  values: number[];
  title: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10, paddingVertical: 8 }}>
          {values.map((v, i) => {
            const h = Math.max(4, Math.round((v / max) * 100)); // 0..100 px
            return (
              <View key={i} style={{ alignItems: "center", minWidth: 28 }}>
                <Text style={{ fontSize: 10, color: "#374151", marginBottom: 4 }}>
                  {Number.isFinite(v) ? String(v) : "0"}
                </Text>
                <View
                  style={{
                    width: 18,
                    height: h,
                    borderRadius: 6,
                    backgroundColor: BRAND,
                  }}
                />
                <Text
                  style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}
                  numberOfLines={1}
                >
                  {labels[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function AdminGeneralScreen() {
  const [restaurants, setRestaurants] = React.useState<AdminRestaurantLite[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = React.useState<string | "ALL">("ALL");

  const [dateStart, setDateStart] = React.useState("");
  const [dateEnd, setDateEnd] = React.useState("");
  const [groupBy, setGroupBy] = React.useState<"day" | "week" | "month">("day");

  const [kpiLoading, setKpiLoading] = React.useState(false);
  const [kpi, setKpi] = React.useState<any>(null);

  // Komisyon tablosu sıralama
  const [sortBy, setSortBy] = React.useState<"commission" | "revenue" | "count">("commission");

  // Restoran listesi
  React.useEffect(() => {
    (async () => {
      try {
        const r = await adminListRestaurants();
        setRestaurants((r.items || []) as AdminRestaurantLite[]);
      } catch {}
    })();
  }, []);

  // KPI auto-load (debounced)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadKpi();
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurant, dateStart, dateEnd, groupBy]);

  async function loadKpi() {
    try {
      setKpiLoading(true);
      const params = { start: dateStart || undefined, end: dateEnd || undefined, groupBy };
      const data =
        selectedRestaurant !== "ALL"
          ? await adminKpiRestaurant(String(selectedRestaurant), params)
          : await adminKpiGlobal(params);
      setKpi(data);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "KPI yüklenemedi");
    } finally {
      setKpiLoading(false);
    }
  }

  // Komisyonları sıralı getir
  const sortedCommissions = React.useMemo(() => {
    const arr: any[] = kpi?.commissions?.byRestaurant || [];
    const key =
      sortBy === "commission" ? "commission" : sortBy === "revenue" ? "revenue" : "count";
    return [...arr].sort((a, b) => Number(b?.[key] || 0) - Number(a?.[key] || 0));
  }, [kpi, sortBy]);

  const FiltersHeader = (
    <View style={{ gap: 12 }}>
      <View style={[styles.card, { marginBottom: 0 }]}>
        <Text style={styles.cardTitle}>Filtreler</Text>

        {/* Restoran seçimleri */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <TouchableOpacity
            style={[styles.chip, selectedRestaurant === "ALL" && styles.chipActive]}
            onPress={() => setSelectedRestaurant("ALL")}
          >
            <Text style={[styles.chipText, selectedRestaurant === "ALL" && styles.chipTextActive]}>
              Tümü
            </Text>
          </TouchableOpacity>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {restaurants.slice(0, 12).map((r) => (
              <TouchableOpacity
                key={r._id}
                style={[styles.chip, selectedRestaurant === r._id && styles.chipActive]}
                onPress={() => setSelectedRestaurant(r._id)}
              >
                <Text
                  style={[styles.chipText, selectedRestaurant === r._id && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {r.name || shortId(r._id)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ flexBasis: "100%" }} />

          {/* Tarih & grupla */}
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <DateField label="Başlangıç" value={dateStart} onChange={setDateStart} />
            <DateField label="Bitiş" value={dateEnd} onChange={setDateEnd} />
            {(["day", "week", "month"] as const).map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGroupBy(g)}
                style={[styles.chip, groupBy === g && styles.chipActive]}
              >
                <Text style={[styles.chipText, groupBy === g && styles.chipTextActive]}>
                  {g === "day" ? "gün" : g === "week" ? "hafta" : "ay"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {kpiLoading && <ActivityIndicator style={{ marginTop: 6 }} />}
      </View>
    </View>
  );

  // Zaman serisi mini bar verileri
  const seriesLabels =
    (kpi?.series?.labels as string[])?.map((raw: string) =>
      prettySeriesLabel(raw, kpi?.range?.groupBy || "day")
    ) ?? [];
  const seriesRes = (kpi?.series?.reservations as number[])?.map(Number) ?? [];
  const seriesArrived = (kpi?.series?.arrived as number[])?.map(Number) ?? [];

  return (
    <FlatList
      data={kpi ? [1] : []}
      keyExtractor={() => "kpi"}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      ListHeaderComponent={FiltersHeader}
      renderItem={() =>
        kpi ? (
          <View style={{ gap: 12 }}>
            {/* KPI grid – 3x2, wrap’lı */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Toplam Rez.</Text>
                <Text style={styles.kpiValue}>{String(kpi?.totals?.reservations?.total ?? 0)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Onaylı</Text>
                <Text style={styles.kpiValue}>{String(kpi?.totals?.reservations?.confirmed ?? 0)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Check-in</Text>
                <Text style={styles.kpiValue}>{String(kpi?.totals?.reservations?.arrived ?? 0)}</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>İptal</Text>
                <Text style={styles.kpiValue}>{String(kpi?.totals?.reservations?.cancelled ?? 0)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Ciro</Text>
                <Text style={styles.kpiValue}>{fmtMoney(kpi?.totals?.revenue)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Kapora</Text>
                <Text style={styles.kpiValue}>{fmtMoney(kpi?.totals?.deposits)}</Text>
              </View>
            </View>

            {/* Mini barlar (değer etiketli) */}
            {seriesLabels.length > 0 && (
              <>
                <MiniBars labels={seriesLabels} values={seriesRes} title="Rezervasyonlar (mini grafik)" />
                <MiniBars labels={seriesLabels} values={seriesArrived} title="Check-in (mini grafik)" />
              </>
            )}

            {/* Komisyonlar */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Komisyonlar</Text>

              {selectedRestaurant === "ALL" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ minWidth: 520 }}>
                    {/* Sıralama chipleri */}
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      {([
                        ["commission", "Komisyona göre"],
                        ["revenue", "Ciroya göre"],
                        ["count", "Rez. adedine göre"],
                      ] as const).map(([key, label]) => (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setSortBy(key as any)}
                          style={[styles.chip, sortBy === key && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, sortBy === key && styles.chipTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {Array.isArray(sortedCommissions) && sortedCommissions.length > 0 ? (
                      <View style={styles.tsWrap}>
                        {/* Başlık satırı */}
                        <View style={styles.tsHeader}>
                          <View style={styles.nameCellHeader}>
                            <Text style={styles.tsHeaderText}>Restoran</Text>
                          </View>
                          <Text style={styles.headerNumCell}>Komisyon</Text>
                          <Text style={styles.headerNumCell}>Ciro</Text>
                          <Text style={styles.headerNumCell}>Rez.</Text>
                        </View>

                        {/* Satırlar */}
                        {sortedCommissions.map((r: any) => (
                          <View key={String(r.restaurantId)} style={styles.tsRow}>
                            <View style={styles.nameCell}>
                              <Text
                                style={styles.nameText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {r.name || shortId(r.restaurantId)}
                              </Text>
                            </View>
                            <Text style={styles.numCell}>{fmtMoney(r.commission)}</Text>
                            <Text style={styles.numCell}>{fmtMoney(r.revenue)}</Text>
                            <Text style={styles.numCell}>{r.count}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.muted}>Bu aralıkta komisyon verisi yok.</Text>
                    )}
                  </View>
                </ScrollView>
              ) : (
                // Seçili restoran için özet
                <View style={styles.kpiGridSmall}>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiTitle}>Toplam Komisyon</Text>
                    <Text style={styles.kpiValue}>
                      {fmtMoney(kpi?.commissions?.total ?? kpi?.totals?.commission ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiTitle}>Ciro (baz)</Text>
                    <Text style={styles.kpiValue}>
                      {fmtMoney(kpi?.commissions?.revenue ?? kpi?.totals?.revenue ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiTitle}>Rez. Adedi (baz)</Text>
                    <Text style={styles.kpiValue}>
                      {String(kpi?.commissions?.count ?? kpi?.totals?.reservations?.total ?? 0)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Zaman Serisi Tablosu */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Zaman Serisi</Text>
              <Text style={styles.subtle}>
                {(kpi?.range?.start || "…")} — {(kpi?.range?.end || "…")} •{" "}
                {kpi?.range?.groupBy === "week" ? "hafta" : kpi?.range?.groupBy === "month" ? "ay" : "gün"}
              </Text>

              {seriesLabels.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.tsWrap}>
                    <View style={styles.tsHeader}>
                      <Text style={[styles.tsHeaderCell, styles.tsCell, { minWidth: 110 }]}>Dönem</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsNum]}>Rez.</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsNum]}>Check-in</Text>
                      <Text style={[styles.tsHeaderCell, styles.tsNum]}>Ciro</Text>
                    </View>
                    {seriesLabels.map((label, i) => {
                      const resv = Number(seriesRes[i] || 0);
                      const arrived = Number(seriesArrived[i] || 0);
                      const revenue = Number(kpi?.series?.revenue?.[i] || 0);
                      return (
                        <View key={i} style={styles.tsRow}>
                          <Text style={[styles.tsCell, { minWidth: 110 }]} numberOfLines={1}>
                            {label}
                          </Text>
                          <Text style={styles.tsNum}>{resv}</Text>
                          <Text style={styles.tsNum}>{arrived}</Text>
                          <Text style={styles.tsNum}>{fmtMoney(revenue)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <Text style={styles.muted}>Bu aralıkta veri yok.</Text>
              )}
            </View>
          </View>
        ) : (
          <View />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  // Claude-vari kart
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#222", marginBottom: 10 },
  subtle: { color: "#6b7280", marginBottom: 8 },

  // Input / Buttons
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
  },
  btnPrimary: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
  btnMuted: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    alignSelf: "flex-start",
  },
  btnMutedText: { color: "#111", fontWeight: "600" },

  // Chips
  chip: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { color: "#333", fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  // KPI grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiGridSmall: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    flexGrow: 1,
    flexBasis: "31%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  kpiTitle: { color: "#6b7280", fontWeight: "600" },
  kpiValue: { color: "#111", fontSize: 20, fontWeight: "800", marginTop: 4 },

  // Tablo ortak
  tsWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  tsHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  tsCell: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 96,
    color: "#111",
  },
  tsHeaderCell: {
    fontWeight: "800",
    color: "#111",
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 96,
  },

  // Yeni: Esnek ad hücresi (başlık/satır) + sabit numara hücreleri
  tsHeaderText: {
    fontWeight: "800",
    color: "#111",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  nameCellHeader: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  nameCell: {
    flex: 1,
    minWidth: 0, // ← kritik
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  nameText: {
    color: "#111",
  },
  headerNumCell: {
    width: 110,
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: "right",
    color: "#111",
    fontWeight: "800",
  },
  numCell: {
    width: 110,
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: "right",
    color: "#111",
    fontVariant: ["tabular-nums"],
  },

  tsNum: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 80,
    textAlign: "right",
    color: "#111",
    fontVariant: ["tabular-nums"],
  },

  muted: { color: "#6b7280" },
});
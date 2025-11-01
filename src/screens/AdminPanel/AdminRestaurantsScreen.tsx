// src/screens/Admin/AdminRestaurantsScreen.tsx
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  adminListRestaurants,
  adminGetRestaurant,
  adminListRestaurantReservations,
  adminUpdateRestaurantCommission,
} from "../../api/admin";

dayjs.locale("tr");

type AdminRestaurantLite = {
  _id: string;
  name?: string;
  city?: string;
  commissionRate?: number; // 0..1
};

type ReservationLite = {
  _id: string;
  dateTimeUTC: string;
  status: string;
  totalPrice?: number;
};

// ---- Marka rengi (panelTheme varsa oradan) ----
let BRAND = "#7B2C2C";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { panel } = require("../../theme/panelTheme");
  if (panel?.colors?.brand) BRAND = panel.colors.brand;
} catch {}

/* ---------------- helpers ---------------- */
const fmtPercent = (r?: number) =>
  r == null ? "-" : `${(Number(r) * 100).toFixed(1)}%`;
const fmtMoney = (n?: number) =>
  n == null ? "-" : `₺${Number(n).toLocaleString("tr-TR")}`;

// Durum meta + ikon + renk (TR)
const statusMeta: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  all:       { label: "Tümü",      color: "#374151", bg: "#eef2ff", icon: "◎" },
  pending:   { label: "Beklemede", color: "#6b7280", bg: "#f3f4f6", icon: "⌛" },
  confirmed: { label: "Onaylı",    color: "#16a34a", bg: "#ecfdf5", icon: "✔︎" },
  arrived:   { label: "Geldi",     color: "#0e7490", bg: "#ecfeff", icon: "✅" },
  cancelled: { label: "İptal",     color: "#b91c1c", bg: "#fef2f2", icon: "❌" },
  no_show:   { label: "Gelmedi",   color: "#b45309", bg: "#fffbeb", icon: "🚫" },
};
const fmtStatus = (s?: string) => {
  if (!s) return statusMeta.pending;
  const k = s.toLowerCase().replace("-", "_");
  return statusMeta[k] || { label: s, color: "#6b7280", bg: "#e5e7eb", icon: "•" };
};

// Badge komponenti
function StatusBadge({ status }: { status: string }) {
  const s = fmtStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeIcon, { color: s.color }]}>{s.icon}</Text>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

/* ---------------- küçük tarih alanı ---------------- */
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

  React.useEffect(() => setTemp(parsed), [parsed]);

  const handleChange = (_: any, selected?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (selected) onChange(dayjs(selected).format("YYYY-MM-DD"));
    } else {
      if (selected) setTemp(selected);
    }
  };

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: "#6b7280", fontWeight: "600" }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={[styles.input, { minWidth: 120, justifyContent: "center" }]}
      >
        <Text style={{ color: value ? "#111" : "#9ca3af" }}>
          {value || "YYYY-MM-DD"}
        </Text>
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.modalBackdropCenter}>
            <View style={[styles.sheetCentered]}>
              <Text style={styles.sheetTitle}>Tarih seç</Text>
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
                    onPress={() => setOpen(false)}
                  >
                    <Text style={styles.btnMutedText}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnBrand}
                    onPress={() => {
                      onChange(dayjs(temp).format("YYYY-MM-DD"));
                      setOpen(false);
                    }}
                  >
                    <Text style={styles.btnBrandText}>Seç</Text>
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

/* ---------------- Detay Modal ---------------- */
function DetailModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: Partial<AdminRestaurantLite> | null;
}) {
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Restoran Detayı</Text>

          <View style={styles.rowBetween}>
            <Text style={styles.muted}>Ad</Text>
            <Text style={styles.bold} numberOfLines={1} ellipsizeMode="tail">
              {data?.name || "-"}
            </Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.muted}>Şehir</Text>
            <Text style={styles.bold}>{data?.city || "-"}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.muted}>Komisyon</Text>
            <Text style={styles.bold}>{fmtPercent(data?.commissionRate ?? 0)}</Text>
          </View>

          <View style={{ height: 10 }} />
          <TouchableOpacity style={styles.btnBrand} onPress={onClose}>
            <Text style={styles.btnBrandText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- Rezervasyonlar Modal + filtreler ---------------- */
function ReservationsModal({
  open,
  onClose,
  loading,
  items,
  title,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  items: ReservationLite[];
  title: string;
}) {
  const [status, setStatus] = React.useState<
    "all" | "pending" | "confirmed" | "arrived" | "cancelled" | "no_show"
  >("all");
  const [start, setStart] = React.useState("");
  const [end, setEnd] = React.useState("");

  const filtered = React.useMemo(() => {
  let out = items;

  if (status !== "all") {
    out = out.filter((x) => x.status?.toLowerCase().replace("-", "_") === status);
  }

  if (start) {
    const s = dayjs(start);
    out = out.filter((x) => {
      const d = dayjs(x.dateTimeUTC);
      // "aynı gün veya sonrası"  =>  d.isSame(s,'day') || d.isAfter(s,'day')
      // eklentisiz hali:
      return !d.isBefore(s, "day");
    });
  }

  if (end) {
    const e = dayjs(end);
    out = out.filter((x) => {
      const d = dayjs(x.dateTimeUTC);
      // "aynı gün veya öncesi"  =>  d.isSame(e,'day') || d.isBefore(e,'day')
      // eklentisiz hali:
      return !d.isAfter(e, "day");
    });
  }

  return out;
}, [items, status, start, end]);

  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { maxHeight: "78%" }]}>
          <Text style={styles.sheetTitle}>{title}</Text>

          {/* Filtreler */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            style={{ marginBottom: 10 }}
          >
            {(["all", "pending", "confirmed", "arrived", "cancelled", "no_show"] as const).map((k) => {
              const m = statusMeta[k];
              const active = status === k;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setStatus(k)}
                  style={[
                    styles.chip,
                    active && { backgroundColor: BRAND, borderColor: BRAND },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && { color: "#fff", fontWeight: "800" },
                    ]}
                  >
                    {m.icon} {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tarih aralığı */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
            <DateField label="Başlangıç" value={start} onChange={setStart} />
            <DateField label="Bitiş" value={end} onChange={setEnd} />
            {Boolean(start || end || status !== "all") && (
              <TouchableOpacity
                style={[styles.btnMuted, { alignSelf: "flex-end", height: 44, justifyContent: "center" }]}
                onPress={() => {
                  setStatus("all");
                  setStart("");
                  setEnd("");
                }}
              >
                <Text style={styles.btnMutedText}>Sıfırla</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Liste */}
          {loading ? (
            <ActivityIndicator />
          ) : filtered.length === 0 ? (
            <Text style={styles.muted}>Kayıt yok.</Text>
          ) : (
            <ScrollView>
              {filtered.map((x) => (
                <View key={x._id} style={styles.listRow}>
                  <Text style={styles.listDate}>
                    {dayjs(x.dateTimeUTC).format("DD MMM HH:mm")}
                  </Text>
                  <View style={{ width: 110, alignItems: "flex-end" }}>
                    <StatusBadge status={x.status} />
                  </View>
                  <Text style={styles.listMoney}>{fmtMoney(x.totalPrice)}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={{ height: 10 }} />
          <TouchableOpacity style={styles.btnBrand} onPress={onClose}>
            <Text style={styles.btnBrandText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- Komisyon Modal ---------------- */
function CommissionModal({
  open,
  onClose,
  target,
  value,
  setValue,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  target: AdminRestaurantLite | null;
  value: string;
  setValue: (s: string) => void;
  onSaved: (rate: number) => void;
}) {
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>
            Komisyon Oranı{" "}
            <Text style={{ color: "#6b7280", fontWeight: "700" }}>
              ({target?.name || "-"})
            </Text>
          </Text>
          <Text style={styles.muted}>Yüzde ya da 0–1 aralığında girebilirsin.</Text>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            keyboardType="decimal-pad"
            placeholder="5   veya   0.05"
            value={value}
            onChangeText={(t) => setValue(t)}
          />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <TouchableOpacity style={styles.btnMuted} onPress={onClose}>
              <Text style={styles.btnMutedText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnBrand}
              onPress={async () => {
                try {
                  const raw = Number((value || "").replace(",", "."));
                  if (Number.isNaN(raw)) throw new Error("Geçersiz değer");
                  const rate = raw > 1 ? raw / 100 : raw;
                  if (rate < 0 || rate > 1) throw new Error("0–1 aralığında olmalı");

                  await adminUpdateRestaurantCommission(target!._id, rate);
                  onSaved(rate);
                  onClose();
                } catch (e: any) {
                  // istersen toast ekleriz
                }
              }}
            >
              <Text style={styles.btnBrandText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- Ekran ---------------- */
export default function AdminRestaurantsScreen() {
  const [restaurants, setRestaurants] = React.useState<AdminRestaurantLite[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Detay modal
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailData, setDetailData] = React.useState<Partial<AdminRestaurantLite> | null>(null);

  // Rezervasyon modal
  const [resOpen, setResOpen] = React.useState(false);
  const [resLoading, setResLoading] = React.useState(false);
  const [resItems, setResItems] = React.useState<ReservationLite[]>([]);
  const [resTitle, setResTitle] = React.useState("Son Rezervasyonlar");

  // Komisyon modal
  const [commOpen, setCommOpen] = React.useState(false);
  const [commTarget, setCommTarget] = React.useState<AdminRestaurantLite | null>(null);
  const [commValue, setCommValue] = React.useState("5");

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await adminListRestaurants();
        setRestaurants((r.items || []) as AdminRestaurantLite[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <FlatList
        data={restaurants}
        keyExtractor={(it) => it._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshing={loading}
        onRefresh={async () => {
          setLoading(true);
          try {
            const r = await adminListRestaurants();
            setRestaurants((r.items || []) as AdminRestaurantLite[]);
          } finally {
            setLoading(false);
          }
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 16 }}>
              <Text style={styles.muted}>Liste boş.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Üst başlık */}
            <View style={styles.headerRow}>
              <Text
                style={styles.title}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item?.name ?? "-"}
              </Text>
              <Text style={styles.city}>{item?.city ?? "-"}</Text>
            </View>

            <Text style={styles.sub}>
              Komisyon Oranı:{" "}
              <Text style={styles.subStrong}>
                {fmtPercent(item?.commissionRate ?? 0.05)}
              </Text>
            </Text>

            {/* Aksiyonlar */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnMuted}
                onPress={async () => {
                  try {
                    const d = (await adminGetRestaurant(item._id)) as Partial<AdminRestaurantLite>;
                    setDetailData(d);
                    setDetailOpen(true);
                  } catch {
                    setDetailData({ name: item.name, city: item.city, commissionRate: item.commissionRate });
                    setDetailOpen(true);
                  }
                }}
              >
                <Text style={styles.btnMutedText}>Detay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnMuted}
                onPress={async () => {
                  setResOpen(true);
                  setResLoading(true);
                  setResTitle(`${item.name || "Restoran"} – Son Rezervasyonlar`);
                  try {
                    // daha rahat filtreleyebilmek için biraz yüksek limit
                    const { items } = await adminListRestaurantReservations(item._id, { limit: 200 });
                    setResItems((items || []) as ReservationLite[]);
                  } finally {
                    setResLoading(false);
                  }
                }}
              >
                <Text style={styles.btnMutedText}>Rezervasyonlar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnBrand}
                onPress={() => {
                  setCommTarget(item);
                  setCommValue(
                    item?.commissionRate != null
                      ? String((item.commissionRate * 100).toFixed(1))
                      : "5"
                  );
                  setCommOpen(true);
                }}
              >
                <Text style={styles.btnBrandText}>Komisyonu Düzenle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modals */}
      <DetailModal open={detailOpen} onClose={() => setDetailOpen(false)} data={detailData} />

      <ReservationsModal
        open={resOpen}
        onClose={() => setResOpen(false)}
        loading={resLoading}
        items={resItems}
        title={resTitle}
      />

      <CommissionModal
        open={commOpen}
        onClose={() => setCommOpen(false)}
        target={commTarget}
        value={commValue}
        setValue={setCommValue}
        onSaved={(rate) => {
          if (!commTarget) return;
          setRestaurants((prev) =>
            prev.map((r) => (r._id === commTarget._id ? { ...r, commissionRate: rate } : r))
          );
        }}
      />
    </>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  // Kart
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eaeaea",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: "#222", maxWidth: "70%" },
  city: { color: "#6b7280", fontWeight: "600" },
  sub: { color: "#374151", marginTop: 4 },
  subStrong: { fontWeight: "800" },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },

  // Inputs & chips
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
  },
  chip: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  chipText: { color: "#333", fontWeight: "600" },

  // Butonlar
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

  btnBrand: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnBrandText: { color: "#fff", fontWeight: "700" },

  // Modal/sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  sheetCentered: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    width: "100%",
  },
  sheetTitle: { fontWeight: "800", fontSize: 18, color: "#111", marginBottom: 10 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  muted: { color: "#6b7280" },
  bold: { fontWeight: "700", color: "#111" },

  // Liste (modal)
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  listDate: { flex: 1, color: "#111" },
  listMoney: { width: 100, textAlign: "right", color: "#111", fontWeight: "700" },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeIcon: { fontSize: 11 },
  badgeText: { fontSize: 12, fontWeight: "700" },
});
// src/screens/Admin/AdminReservationsScreen.tsx
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
  Platform,
  Linking,
  Alert,
} from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import DateTimePicker from "@react-native-community/datetimepicker";
import { adminListRestaurants, adminListReservations } from "../../api/admin";

dayjs.locale("tr");

// ---------- Tema / Marka ----------
let BRAND = "#7B2C2C";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { panel } = require("../../theme/panelTheme");
  if (panel?.colors?.brand) BRAND = panel.colors.brand;
} catch {}

// ---------- Tipler ----------
type AdminRestaurantLite = { _id: string; name?: string; city?: string };
type ReservationItem = {
  _id: string;
  dateTimeUTC: string;
  partySize?: number;
  status?: string;
  totalPrice?: number;

  restaurant?: { _id?: string; name?: string; title?: string };
  restaurantName?: string;
  restaurantTitle?: string;

  customer?: { name?: string; fullName?: string; surname?: string };
  user?: { name?: string; fullName?: string; surname?: string };
  customerName?: string;
  userName?: string;

  // olası görsel alanları
  receipt?: {
    thumbnailUrl?: string;
    thumbUrl?: string;
    imageUrl?: string;
    url?: string;
    file?: { thumbnailUrl?: string; url?: string };
  };
  receiptThumb?: string;
  receiptThumbnailUrl?: string;
  receiptImageUrl?: string;
  receiptUrl?: string;
  paymentProof?: { thumbUrl?: string; thumbnailUrl?: string; url?: string };
  payment?: { receiptThumbUrl?: string; receiptUrl?: string };
  images?: Array<{ thumbnailUrl?: string; thumbUrl?: string; url?: string }>;
  proofImages?: Array<{ thumbnailUrl?: string; url?: string }>;
};

const money = (n?: number) =>
  n == null ? "-" : `₺${Number(n).toLocaleString("tr-TR")}`;

const statusMeta: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#F3F4F6", fg: "#374151", label: "Beklemede" },
  confirmed: { bg: "#EEFDF3", fg: "#065F46", label: "Onaylı" },
  arrived: { bg: "#E6F3FF", fg: "#0B63C4", label: "Check-in" },
  no_show: { bg: "#FFF7ED", fg: "#9A3412", label: "Gelmedi" },
  cancelled: { bg: "#FEF2F2", fg: "#991B1B", label: "İptal" },
};
const fmtStatus = (s?: string) => {
  if (!s) return statusMeta.pending;
  const key = s.toLowerCase().replace("-", "_");
  return statusMeta[key] || { bg: "#F3F4F6", fg: "#374151", label: s };
};

function getRestaurantName(x: ReservationItem) {
  return (
    x.restaurant?.name ||
    x.restaurant?.title ||
    x.restaurantName ||
    x.restaurantTitle ||
    "—"
  );
}
function getCustomerName(x: ReservationItem) {
  const c = x.customer || x.user || {};
  return (
    (c as any).fullName ||
    (c as any).name ||
    [ (c as any).name, (c as any).surname ].filter(Boolean).join(" ") ||
    x.customerName ||
    x.userName ||
    "—"
  );
}

// URL yardımcıları
const isUrl = (s?: string) => !!s && /^(https?:)?\/\//i.test(s);
const pick = (...vals: (string | undefined)[]) => vals.find(Boolean) || "";

// Görsel thumb & tam URL bulucu – alan kapsamını genişlettik
// Sadece THUMBNAIL için: senin çalışan öncelik sıralaman
function getReceiptThumb(x: ReservationItem) {
  return (
    x.receipt?.thumbnailUrl ||
    x.receiptThumbnailUrl ||
    x.paymentProof?.thumbUrl ||
    x.images?.[0]?.thumbnailUrl ||
    x.receipt?.imageUrl ||
    x.receiptImageUrl ||
    x.paymentProof?.url ||
    x.receipt?.url ||
    x.receiptUrl ||
    x.images?.[0]?.url ||
    ""
  );
}
function getReceiptBestUrl(x: ReservationItem) {
  const url = pick(
    x.receipt?.imageUrl,
    x.receiptImageUrl,
    x.receipt?.file?.url,
    x.receipt?.url,
    x.receiptUrl,
    x.payment?.receiptUrl,
    x.paymentProof?.url,
    x.images?.[0]?.url,
    x.proofImages?.[0]?.url,
    getReceiptThumb(x)
  );
  return url;
}

// ---------- Tarih alanı (kompakt + ikonlu) ----------
function DateField({
  label,
  value,
  onChange,
  flex = 1,
}: {
  label: string;
  value?: string;
  onChange: (v?: string) => void;
  flex?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const parsed = React.useMemo(() => {
    const d = value ? new Date(value) : new Date();
    return Number.isNaN(+d) ? new Date() : d;
  }, [value]);
  const [temp, setTemp] = React.useState<Date>(parsed);
  React.useEffect(() => setTemp(parsed), [parsed]);

  return (
    <View style={{ gap: 6, flex }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={[styles.input, styles.inputCompact]}
      >
        <Text style={styles.inputIcon}>📅</Text>
        <Text style={{ color: value ? "#111" : "#9ca3af" }}>
          {value || "YYYY-MM-DD"}
        </Text>
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.sheet, { paddingBottom: 12 }]}>
              <Text style={styles.sheetTitle}>{label} seç</Text>
              <DateTimePicker
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                value={temp}
                onChange={(e, d) => {
                  if (Platform.OS === "android") {
                    if (e?.type === "set" && d) onChange(dayjs(d).format("YYYY-MM-DD"));
                    setOpen(false);
                  } else {
                    if (d) setTemp(d);
                  }
                }}
              />
              {Platform.OS === "ios" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={styles.btnMuted} onPress={() => setOpen(false)}>
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

// ---------- Görsel Modal ----------
function ReceiptViewer({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  if (!url) return null;

  // köşeden içeri aldık + büyük hitSlop
  const hit = { top: 12, bottom: 12, left: 12, right: 12 };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <TouchableOpacity
          style={styles.viewerClose}
          onPress={onClose}
          activeOpacity={0.85}
          hitSlop={hit}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Kapat</Text>
        </TouchableOpacity>

        <Image source={{ uri: url }} style={styles.viewerImage} resizeMode="contain" />

        <TouchableOpacity
          style={styles.viewerOpen}
          onPress={async () => {
            const target = isUrl(url) ? url : "";
            if (!target) return Alert.alert("Açılamıyor", "Bağlantı uygun değil.");
            const ok = await Linking.canOpenURL(target);
            if (ok) Linking.openURL(target);
            else Alert.alert("Açılamıyor", "Bağlantı açılamadı.");
          }}
          activeOpacity={0.85}
          hitSlop={hit}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Tarayıcıda Aç</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ---------- Ana Ekran ----------
export default function AdminReservationsScreen() {
  const [restaurants, setRestaurants] = React.useState<AdminRestaurantLite[]>([]);
  const [rid, setRid] = React.useState<string | "ALL">("ALL");

  const [start, setStart] = React.useState<string | undefined>(undefined);
  const [end, setEnd] = React.useState<string | undefined>(undefined);

  const STATUSES = [
    { key: "", label: "Hepsi" },
    { key: "pending", label: "Beklemede" },
    { key: "confirmed", label: "Onaylı" },
    { key: "arrived", label: "Check-in" },
    { key: "no_show", label: "Gelmedi" },
    { key: "cancelled", label: "İptal" },
  ] as const;
  const [status, setStatus] = React.useState<(typeof STATUSES)[number]["key"]>("");

  const [items, setItems] = React.useState<ReservationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);

  const [viewerUrl, setViewerUrl] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      try {
        const r = await adminListRestaurants();
        setRestaurants((r.items || []) as AdminRestaurantLite[]);
      } catch {}
    })();
  }, []);

  const debRef = React.useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      refresh();
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, start, end, status]);

  async function refresh() {
    setLoading(true);
    try {
      const params: any = {};
      if (status) params.status = status;
      if (rid !== "ALL") params.restaurantId = rid;
      if (start) params.start = start;
      if (end) params.end = end;

      const r = await adminListReservations(params);
      setItems((r.items || []) as ReservationItem[]);
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }
  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const params: any = { cursor };
      if (status) params.status = status;
      if (rid !== "ALL") params.restaurantId = rid;
      if (start) params.start = start;
      if (end) params.end = end;

      const r = await adminListReservations(params);
      setItems((prev) => [...prev, ...((r.items || []) as ReservationItem[])]);
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  const Filters = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Filtreler</Text>

      {/* Restoran chip’leri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
        <Chip label="Tümü" active={rid === "ALL"} onPress={() => setRid("ALL")} />
        {restaurants.map((r) => (
          <Chip
            key={r._id}
            label={r.name || r._id}
            active={rid === r._id}
            onPress={() => setRid(r._id)}
            maxW={180}
          />
        ))}
      </ScrollView>

      {/* Tarih alanları */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
        <DateField label="Başlangıç" value={start} onChange={setStart} flex={1} />
        <DateField label="Bitiş" value={end} onChange={setEnd} flex={1} />
      </View>

      {/* Durum chip’leri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        {STATUSES.map((s) => (
          <Chip
            key={s.key || "all"}
            label={s.label}
            active={status === s.key}
            onPress={() => setStatus(s.key)}
          />
        ))}
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => {
            setRid("ALL");
            setStart(undefined);
            setEnd(undefined);
            setStatus("");
          }}
        >
          <Text style={styles.btnGhostText}>Temizle</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={Filters}
        ListFooterComponent={
          <View style={{ paddingVertical: 16 }}>
            {loading ? (
              <ActivityIndicator />
            ) : cursor ? (
              <TouchableOpacity style={styles.btnBrand} onPress={loadMore}>
                <Text style={styles.btnBrandText}>Daha Fazla</Text>
              </TouchableOpacity>
            ) : items.length > 0 ? (
              <Text style={{ textAlign: "center", color: "#6b7280" }}>
                Hepsi bu kadar.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const st = fmtStatus(item.status);
          const thumb = getReceiptThumb(item);
          return (
            <View style={styles.resvCard}>
              {/* Status badge */}
              <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.bg }]}>
                <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Thumbnail */}
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={{ color: "#9ca3af", fontWeight: "800" }}>IMG</Text>
                    </View>
                  )}
                </View>

                {/* İçerik */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {dayjs(item.dateTimeUTC).format("DD MMM, HH:mm")} • {item.partySize || 0} kişi
                  </Text>
                  <Text style={styles.rowSub}>
                    Restoran: <Text style={styles.strongLink}>{getRestaurantName(item)}</Text>
                  </Text>
                  <Text style={styles.rowSub}>
                    Kullanıcı: <Text style={styles.strongLink}>{getCustomerName(item)}</Text>
                  </Text>

                  {/* Alt satır: sol buton, sağda Tutar */}
                  <View style={styles.bottomRow}>
                    <TouchableOpacity
                      style={styles.btnMuted}
                      onPress={() => {
                        const url = getReceiptBestUrl(item);
                        if (!url) {
                          Alert.alert("Görsel yok", "Bu kayıtta dekont görseli bulunamadı.");
                          return;
                        }
                        setViewerUrl(url);
                      }}
                    >
                      <Text style={styles.btnMutedText}>Dekontu Görüntüle</Text>
                    </TouchableOpacity>

                    <Text style={styles.totalRight}>{money(item.totalPrice)}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      <ReceiptViewer url={viewerUrl} onClose={() => setViewerUrl("")} />
    </>
  );
}

// ---------- Chip ----------
function Chip({
  label,
  active,
  onPress,
  maxW,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  maxW?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, maxW ? { maxWidth: maxW } : null]}
      activeOpacity={0.85}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------- Stil ----------
const styles = StyleSheet.create({
  // kart
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

  // input/label
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputCompact: {
    paddingLeft: 36, // ikon boşluğu
    minHeight: 40,
    justifyContent: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    top: 8,
    fontSize: 18,
    opacity: 0.85,
  },
  label: { color: "#6b7280", fontWeight: "600" },

  // chip
  chip: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    maxWidth: 220,
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { color: "#333", fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  // btn
  btnBrand: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "center",
  },
  btnBrandText: { color: "#fff", fontWeight: "700" },
  btnMuted: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    alignSelf: "flex-start",
  },
  btnMutedText: { color: "#111", fontWeight: "700" },
  btnGhost: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
    alignSelf: "flex-start",
  },
  btnGhostText: { color: "#111", fontWeight: "700" },

  // liste kartı
  resvCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 12,
    marginBottom: 12,
  },
  badge: {
    position: "absolute",
    right: 12,
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 2,
  },
  badgeText: { fontWeight: "800", fontSize: 12 },

  // thumbnail
  thumbWrap: { width: 72, height: 72, borderRadius: 12, overflow: "hidden" },
  thumb: { width: 72, height: 72, resizeMode: "cover" },
  thumbPlaceholder: {
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEE",
  },

  rowTitle: { fontWeight: "800", color: "#111", marginBottom: 4 },
  rowSub: { color: "#6b7280", marginTop: 2 },
  strongLink: { color: BRAND, fontWeight: "800", fontSize: 13.5 },

  // alt satır
  bottomRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalRight: { fontWeight: "900", fontSize: 16, color: "#111" },

  // modal ortak
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
  },
  sheetTitle: { fontWeight: "800", fontSize: 18, color: "#111", marginBottom: 10 },

  // viewer – butonlar köşeden içeri alındı
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  viewerImage: { width: "100%", height: "85%" },
  viewerClose: {
    position: "absolute",
    top: 38,      // <- içeri alındı
    right: 24,    // <- içeri alındı
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  viewerOpen: {
    position: "absolute",
    bottom: 38,   // <- içeri alındı
    right: 24,    // <- içeri alındı
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
// src/screens/Admin/AdminFeedbackScreen.tsx
import React from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import {
  adminListReviews,
  adminHideReview,
  adminUnhideReview,
  adminDeleteReview,
  adminListComplaints,
  adminResolveComplaint,
  adminDismissComplaint,
  type AdminListReviewsParams,
  type AdminListComplaintsParams,
} from "../../api/admin";

// ---- Marka rengi (panelTheme varsa oradan al) ----
let BRAND = "#7B2C2C";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { panel } = require("../../theme/panelTheme");
  if (panel?.colors?.brand) BRAND = panel.colors.brand;
} catch {}

// ---- Yardımcı UI ----
const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[styles.chip, active && styles.chipActive]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const Pill = ({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: "muted" | "success" | "danger" | "warn";
}) => {
  const map = {
    muted: { bg: "#F3F4F6", fg: "#111827" },
    success: { bg: "#E9F7EF", fg: "#065F46" },
    danger: { bg: "#FEF2F2", fg: "#991B1B" },
    warn: { bg: "#FFF7ED", fg: "#9A3412" },
  } as const;
  return (
    <View
      style={{
        backgroundColor: map[tone].bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: map[tone].fg, fontWeight: "700" }}>{text}</Text>
    </View>
  );
};

// ---- Durum çevirileri ----
const RVW_LABEL: Record<string, string> = {
  visible: "Görünür",
  hidden: "Gizli",
  removed: "Silinmiş",
};
const CMP_LABEL: Record<string, string> = {
  open: "Açık",
  resolved: "Çözüldü",
  dismissed: "Reddedildi",
};

export default function AdminFeedbackScreen() {
  // Reviews
  const [rvwList, setRvwList] = React.useState<any[]>([]);
  const [rvwLoading, setRvwLoading] = React.useState(false);
  const [rvwCursor, setRvwCursor] = React.useState<string | undefined>();
  const [rvwStatus, setRvwStatus] =
    React.useState<AdminListReviewsParams["status"]>("");

  // Complaints
  const [cmpList, setCmpList] = React.useState<any[]>([]);
  const [cmpLoading, setCmpLoading] = React.useState(false);
  const [cmpCursor, setCmpCursor] = React.useState<string | undefined>();
  const [cmpStatus, setCmpStatus] =
    React.useState<AdminListComplaintsParams["status"]>("");

  // --- Otomatik getir (debounce) ---
  const rvwDeb = React.useRef<NodeJS.Timeout | null>(null);
  const cmpDeb = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (rvwDeb.current) clearTimeout(rvwDeb.current);
    rvwDeb.current = setTimeout(() => loadReviews(true), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rvwStatus]);

  React.useEffect(() => {
    if (cmpDeb.current) clearTimeout(cmpDeb.current);
    cmpDeb.current = setTimeout(() => loadComplaints(true), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmpStatus]);

  // --- API çağrıları ---
  async function loadReviews(reset = false) {
    try {
      if (reset) {
        setRvwList([]);
        setRvwCursor(undefined);
      }
      setRvwLoading(true);
      const { items, nextCursor } = await adminListReviews({
        status: rvwStatus || undefined,
        limit: 30,
        cursor: reset ? undefined : rvwCursor,
      });
      setRvwList((p) => (reset ? items : [...p, ...items]));
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
        status: cmpStatus || undefined,
        limit: 30,
        cursor: reset ? undefined : cmpCursor,
      });
      setCmpList((p) => (reset ? items : [...p, ...items]));
      setCmpCursor(nextCursor);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Şikayetler yüklenemedi");
    } finally {
      setCmpLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
    >
      {/* Yorumlar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yorumlar</Text>

        {/* Filtre chip’leri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["", "Tümü"],
            ["visible", "Görünür"],
            ["hidden", "Gizli"],
            ["removed", "Silinmiş"],
          ].map(([k, label]) => (
            <Chip
              key={label}
              label={label}
              active={rvwStatus === (k as any)}
              onPress={() => setRvwStatus(k as any)}
            />
          ))}
        </ScrollView>

        {/* Liste */}
        <View style={{ marginTop: 12 }}>
          {rvwLoading && rvwList.length === 0 ? (
            <ActivityIndicator />
          ) : (
            rvwList.map((r) => (
              <View key={r._id} style={styles.itemCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.itemTitle}>Puan {r?.rating ?? "-"} / 5</Text>
                  <Pill
                    text={RVW_LABEL[r?.status] || (r?.status ?? "—")}
                    tone={
                      r?.status === "visible"
                        ? "success"
                        : r?.status === "removed"
                        ? "danger"
                        : "warn"
                    }
                  />
                </View>

                <Text style={styles.itemText}>{r?.comment || "—"}</Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={async () => {
                      try {
                        await adminHideReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.btnMutedText}>Gizle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={async () => {
                      try {
                        await adminUnhideReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.btnMutedText}>Göster</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnDanger}
                    onPress={async () => {
                      try {
                        await adminDeleteReview(r._id);
                        loadReviews(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.btnDangerText}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Sayfalama */}
          <View style={{ paddingTop: 10 }}>
            {rvwLoading && rvwList.length > 0 ? (
              <ActivityIndicator />
            ) : rvwCursor ? (
              <TouchableOpacity
                style={styles.btnBrand}
                onPress={() => loadReviews(false)}
              >
                <Text style={styles.btnBrandText}>Daha Fazla</Text>
              </TouchableOpacity>
            ) : rvwList.length > 0 ? (
              <Text style={styles.listEndText}>Hepsi bu kadar.</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Şikayetler */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Şikayetler</Text>

        {/* Filtre chip’leri */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {[
            ["", "Tümü"],
            ["open", "Açık"],
            ["resolved", "Çözüldü"],
            ["dismissed", "Reddedildi"],
          ].map(([k, label]) => (
            <Chip
              key={label}
              label={label}
              active={cmpStatus === (k as any)}
              onPress={() => setCmpStatus(k as any)}
            />
          ))}
        </ScrollView>

        {/* Liste */}
        <View style={{ marginTop: 12 }}>
          {cmpLoading && cmpList.length === 0 ? (
            <ActivityIndicator />
          ) : (
            cmpList.map((c) => (
              <View key={c._id} style={styles.itemCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={styles.itemTitle}>{c?.subject || "—"}</Text>
                  <Pill
                    text={CMP_LABEL[c?.status] || (c?.status ?? "—")}
                    tone={
                      c?.status === "open"
                        ? "warn"
                        : c?.status === "resolved"
                        ? "success"
                        : "danger"
                    }
                  />
                </View>

                <Text style={styles.itemText}>{c?.text || "—"}</Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.btnBrand}
                    onPress={async () => {
                      try {
                        await adminResolveComplaint(c._id);
                        loadComplaints(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.btnBrandText}>Çözüldü</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={async () => {
                      try {
                        await adminDismissComplaint(c._id);
                        loadComplaints(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Olmadı");
                      }
                    }}
                  >
                    <Text style={styles.btnMutedText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Sayfalama */}
          <View style={{ paddingTop: 10 }}>
            {cmpLoading && cmpList.length > 0 ? (
              <ActivityIndicator />
            ) : cmpCursor ? (
              <TouchableOpacity
                style={styles.btnBrand}
                onPress={() => loadComplaints(false)}
              >
                <Text style={styles.btnBrandText}>Daha Fazla</Text>
              </TouchableOpacity>
            ) : cmpList.length > 0 ? (
              <Text style={styles.listEndText}>Hepsi bu kadar.</Text>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ---- Stil (diğer admin ekranlarıyla aynı dil) ----
const styles = StyleSheet.create({
  // üst kartlar
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
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

  // chip
  chip: {
    backgroundColor: "#F2F2F2",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    maxWidth: 220,
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { color: "#333", fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  // liste kartı
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 14,
    marginBottom: 10,
  },
  itemTitle: { fontWeight: "900", fontSize: 15.5, color: "#111" },
  itemText: { color: "#374151", marginTop: 6, lineHeight: 20 },

  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },

  // butonlar
  btnBrand: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnBrandText: { color: "#fff", fontWeight: "700" },
  btnMuted: {
    backgroundColor: "#F2F2F2",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    alignSelf: "flex-start",
  },
  btnMutedText: { color: "#111", fontWeight: "700" },
  btnDanger: {
    backgroundColor: "#E1524C",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnDangerText: { color: "#fff", fontWeight: "800" },

  listEndText: { textAlign: "center", color: "#6b7280" },
});
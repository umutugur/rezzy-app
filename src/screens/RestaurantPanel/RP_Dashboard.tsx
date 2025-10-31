// src/screens/RestaurantPanel/RP_Dashboard.tsx
import React from "react";
import { ScrollView, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { rp } from "./rpStyles";
import { api } from "../../api/client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Dashboard">;

type Row = {
  _id: string;
  dateTimeUTC: string;
  partySize: number;
  status: "pending" | "confirmed" | "arrived" | "cancelled" | "no_show" | string;
  user?: { name?: string; email?: string };
  totalPrice?: number;        // ← geri eklendi
  depositAmount?: number;     // ← geri eklendi
};

function fmtDT(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const trStatus: Record<string, string> = {
  pending: "Bekleyen",
  confirmed: "Onaylı",
  arrived: "Geldi",
  no_show: "Gelmedi",
  cancelled: "İptal",
};

const statusColors: Record<string, string> = {
  Bekleyen: "#ca8a04",
  Onaylı: "#16a34a",
  Geldi: "#0e7490",
  Gelmedi: "#b91c1c",
  İptal: "#6b7280",
};

async function fetchAll(rid: string) {
  const items: Row[] = [];
  let cursor: string | undefined = undefined;
  for (let page = 0; page < 50; page++) {
    const params: any = { limit: 100 };
    if (cursor) params.cursor = cursor;
    const { data } = await api.get(`/restaurants/${rid}/reservations`, { params });
    const batch: Row[] = Array.isArray(data) ? data : data?.items ?? [];
    if (!batch.length) break;
    items.push(...batch);
    cursor = data?.nextCursor;
    if (!cursor) break;
  }
  return items;
}

async function fetchUpcoming(rid: string) {
  const { data } = await api.get(`/restaurants/${rid}/reservations`, {
    params: { from: new Date().toISOString().slice(0, 10), limit: 8 },
  });
  return Array.isArray(data) ? data : data?.items ?? [];
}

export default function RP_Dashboard({ route }: Props) {
  const { restaurantId } = route.params;
  const [loading, setLoading] = React.useState(false);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [upcoming, setUpcoming] = React.useState<Row[]>([]);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const all = await fetchAll(restaurantId);
        if (!ignore) setRows(all);
        const next = await fetchUpcoming(restaurantId);
        if (!ignore) setUpcoming(next);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  const counts = React.useMemo(() => {
    const c = { total: rows.length, pending: 0, confirmed: 0, arrived: 0, cancelled: 0, no_show: 0 } as any;
    let grossArrived = 0;
    let depositCN = 0;
    for (const r of rows) {
      if (c[r.status] != null) c[r.status] += 1;
      if (r.status === "arrived") grossArrived += Number(r.totalPrice || 0);
      if (r.status === "confirmed" || r.status === "no_show") depositCN += Number(r.depositAmount || 0);
    }
    return { c, grossArrived, depositCN };
  }, [rows]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* ÖZET: aynen korundu */}
      <View style={[rp.card, { marginTop: 4 }]}>
        <Text style={rp.cardTitle}>Restoran Özeti</Text>
        {loading ? <ActivityIndicator /> : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
          {[
            ["Toplam Rezervasyon", counts.c.total],
            ["Bekleyen", counts.c.pending],
            ["Onaylı", counts.c.confirmed],
            ["Gelen", counts.c.arrived],
            ["Gelmedi", counts.c.no_show],
            ["İptal", counts.c.cancelled],
          ].map(([label, val]) => (
            <View key={label as string} style={[rp.card, { width: "48%", padding: 14 }]}>
              <Text style={{ color: "#666", marginBottom: 4 }}>{label}</Text>
              <Text style={{ fontSize: 22, fontWeight: "800" }}>{String(val)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={[rp.card, { flex: 1 }]}>
            <Text style={{ color: "#666", marginBottom: 4 }}>Toplam Ciro (Gelen)</Text>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>
              {Number(counts.grossArrived || 0).toLocaleString("tr-TR")} ₺
            </Text>
          </View>
          <View style={[rp.card, { flex: 1 }]}>
            <Text style={{ color: "#666", marginBottom: 4 }}>Toplam Depozito (Onaylı + Gelmedi)</Text>
            <Text style={{ fontSize: 22, fontWeight: "800" }}>
              {Number(counts.depositCN || 0).toLocaleString("tr-TR")} ₺
            </Text>
          </View>
        </View>
      </View>

      {/* YAKLAŞAN: claude tarzı sadece stil güncellemesi */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Yaklaşan Rezervasyonlar</Text>

        {loading && <ActivityIndicator />}

        {!loading && upcoming.length === 0 ? (
          <Text style={styles.emptyText}>Yaklaşan rezervasyon yok.</Text>
        ) : (
          upcoming.map((r) => {
            const st = trStatus[r.status] ?? r.status;
            const color = statusColors[st] ?? "#1f2937";
            return (
              <View key={r._id} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateText}>{fmtDT(r.dateTimeUTC)}</Text>
                  <Text style={styles.userText}>
                    {r.user?.name || "Misafir"} {r.user?.email ? `(${r.user.email})` : ""}
                  </Text>
                  <Text style={styles.infoText}>{r.partySize} kişi</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + "22", borderColor: color }]}>
                  <Text style={[styles.statusText, { color }]}>{st}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  emptyText: {
    color: "#6b7280",
    paddingVertical: 8,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fafafa",
    padding: 14,
    borderRadius: 14,
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  userText: {
    marginTop: 2,
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    fontWeight: "700",
    fontSize: 12,
  },
});
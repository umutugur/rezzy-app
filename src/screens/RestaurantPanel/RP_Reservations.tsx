// src/screens/RestaurantPanel/RP_Reservations.tsx
import React from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";
import { rp } from "./rpStyles";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { api } from "../../api/client";
import { updateReservationStatus } from "../../api/reservations";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

dayjs.locale("tr");

type Props = NativeStackScreenProps<RestaurantPanelParams, "Reservations">;

type Reservation = {
  _id: string;
  dateTimeUTC: string;
  partySize: number;
  status: string;
  totalPrice?: number;
  depositAmount?: number;
  receiptUrl?: string;
  user?: { name?: string; email?: string };
};

const trStatus: Record<string, string> = {
  pending: "Bekleyen",
  confirmed: "Onaylı",
  arrived: "Geldi",
  no_show: "Gelmedi",
  cancelled: "İptal",
};

const statusColor: Record<string, string> = {
  Bekleyen: "#ca8a04",
  Onaylı: "#16a34a",
  Geldi: "#0e7490",
  Gelmedi: "#b91c1c",
  İptal: "#6b7280",
};

export default function RP_Reservations({ route }: Props) {
  const { restaurantId } = route.params;

  const [list, setList] = React.useState<Reservation[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanOpen, setScanOpen] = React.useState(false);
  const [qrPayload, setQrPayload] = React.useState<string | null>(null);
  const [arrivedOpen, setArrivedOpen] = React.useState(false);
  const [arrivedInput, setArrivedInput] = React.useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/restaurants/${restaurantId}/reservations`, {
        params: { _cb: Date.now() },
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      const items: Reservation[] = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
      setList(items);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Rezervasyonlar alınamadı");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Rezervasyonlar</Text>

        <TouchableOpacity
          style={[rp.btnPrimary, { marginBottom: 8 }]}
          onPress={async () => {
            if (!permission?.granted) {
              const { granted } = await requestPermission();
              if (!granted) {
                Alert.alert("İzin gerekli", "QR okumak için kamera izni gerekiyor.");
                return;
              }
            }
            setScanOpen(true);
          }}
        >
          <Text style={rp.btnPrimaryText}>QR Okut ve Check-in</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator />
        ) : list.length === 0 ? (
          <Text style={rp.muted}>Kayıt yok.</Text>
        ) : (
          list.map((rv) => {
            const st = trStatus[rv.status] ?? rv.status;
            const color = statusColor[st] ?? "#1f2937";

            const isImage = rv.receiptUrl && /\.(png|jpe?g|webp|gif)$/i.test(String(rv.receiptUrl));

            return (
              <View key={rv._id} style={styles.cardRow}>
                {/* Sol blok: metinler */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.dateText}>{dayjs(rv.dateTimeUTC).format("DD MMM, HH:mm")}</Text>
                    <View style={[styles.chip, { borderColor: color, backgroundColor: color + "22" }]}>
                      <Text style={[styles.chipText, { color }]}>{st}</Text>
                    </View>
                  </View>

                  <Text style={styles.userText}>
                    {rv.user?.name || "-"} {rv.user?.email ? `(${rv.user.email})` : ""}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{rv.partySize} kişi</Text>
                    {rv.totalPrice != null && (
                      <Text style={styles.metaText}>
                        Toplam: ₺{Number(rv.totalPrice).toLocaleString("tr-TR")}
                      </Text>
                    )}
                    {rv.depositAmount != null && (
                      <Text style={styles.metaText}>
                        Depozito: ₺{Number(rv.depositAmount).toLocaleString("tr-TR")}
                      </Text>
                    )}
                  </View>

                  {/* Aksiyonlar */}
                  {rv.status === "pending" && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={rp.btnPrimary}
                        onPress={async () => {
                          try {
                            await updateReservationStatus(rv._id, "confirmed");
                            setList((prev) =>
                              prev.map((x) => (x._id === rv._id ? { ...x, status: "confirmed" } : x))
                            );
                          } catch (e: any) {
                            Alert.alert("Hata", e?.message || "Onaylanamadı");
                          }
                        }}
                      >
                        <Text style={rp.btnPrimaryText}>Onayla</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={rp.btnDanger}
                        onPress={async () => {
                          try {
                            await updateReservationStatus(rv._id, "cancelled");
                            setList((prev) =>
                              prev.map((x) => (x._id === rv._id ? { ...x, status: "cancelled" } : x))
                            );
                          } catch (e: any) {
                            Alert.alert("Hata", e?.message || "Reddedilemedi");
                          }
                        }}
                      >
                        <Text style={rp.btnDangerText}>Reddet</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Sağ blok: dekont önizleme/link */}
                <View style={styles.rightCol}>
                  {rv.receiptUrl ? (
                    isImage ? (
                      <Image
                        source={{ uri: String(rv.receiptUrl) }}
                        style={styles.thumb}
                      />
                    ) : (
                      <Text style={styles.linkText}>Dekontu aç</Text>
                    )
                  ) : (
                    <Text style={styles.emptyReceipt}>Dekont yok</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* QR Scanner */}
      <Modal visible={scanOpen} transparent animationType="fade" onRequestClose={() => setScanOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" }}>
          {!permission ? (
            <ActivityIndicator color="#fff" />
          ) : !permission.granted ? (
            <TouchableOpacity onPress={requestPermission} style={[rp.btnPrimary, { backgroundColor: "#1f2937" }]}>
              <Text style={rp.btnPrimaryText}>Kamera izni ver</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: "90%", height: "70%" }}>
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  setScanOpen(false);
                  setQrPayload(String(data || ""));
                  setArrivedInput("");
                  setArrivedOpen(true);
                }}
              />
              <TouchableOpacity
                onPress={() => setScanOpen(false)}
                style={[rp.btnMuted, { position: "absolute", bottom: 16, alignSelf: "center" }]}
              >
                <Text style={rp.btnMutedText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Arrived modal */}
      <Modal visible={arrivedOpen} transparent animationType="fade" onRequestClose={() => setArrivedOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 }}>
          <View style={[rp.card, { borderColor: "#ddd" }]}>
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Gelen Kişi Sayısı</Text>
            <Text style={rp.muted}>QR okundu. Lütfen gelen sayısını girin.</Text>
            <TextInput
              value={arrivedInput}
              onChangeText={setArrivedInput}
              style={[rp.input, { marginTop: 8 }]}
              keyboardType="numeric"
              placeholder="Örn: 5"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={rp.btnMuted}
                onPress={() => {
                  setArrivedOpen(false);
                  setQrPayload(null);
                  setArrivedInput("");
                }}
              >
                <Text style={rp.btnMutedText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={rp.btnPrimary}
                onPress={async () => {
                  const n = Number(arrivedInput.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    Alert.alert("Uyarı", "Geçerli bir sayı girin (0 veya daha büyük).");
                    return;
                  }
                  try {
                    await api.post("/tools/checkin/by-qr", { payload: qrPayload, arrivedCount: n });
                    setArrivedOpen(false);
                    setQrPayload(null);
                    setArrivedInput("");
                    Alert.alert("Başarılı", "Check-in yapıldı.");
                    load();
                  } catch (e: any) {
                    Alert.alert("Hata", e?.response?.data?.message || e?.message || "Check-in başarısız");
                  }
                }}
              >
                <Text style={rp.btnPrimaryText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: "700",
    fontSize: 12,
  },
  userText: {
    marginTop: 2,
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: "#4b5563",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  rightCol: {
    width: 120,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  thumb: {
    width: 110,
    height: 80,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  linkText: {
    color: "#2563eb",
    fontWeight: "700",
  },
  emptyReceipt: {
    color: "#9ca3af",
  },
});
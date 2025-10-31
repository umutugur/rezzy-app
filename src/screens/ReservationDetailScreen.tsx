// screens/ReservationDetailScreen.tsx
import React from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  Image,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import ReceiptCard from "../components/ReceiptCard";
import { useReservationDetail } from "../hooks/useReservationDetail";
import {
  uploadReceipt,
  cancelReservation,
  getReservationQR,
  type Reservation,
} from "../api/reservations";
import { formatDateTime } from "../utils/format";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { buildMapsUrl, openInMaps } from "../utils/maps";

/* ---------- Renk Paleti (Rezzy) ---------- */
const REZZY = {
  primary: "#7B2C2C", // Bordo
  primaryDark: "#5E1F1F",
  primarySoft: "#FDF5F5",
  primaryMid: "#8F3B3B",
  text: "#1E293B",
  textMuted: "#64748B",
  border: "#E2E8F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FEE2E2",
};

/* ---------- Utils ---------- */

const formatTL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

const TR_STATUS_LABEL: Record<NonNullable<Reservation["status"]>, string> = {
  pending: "Beklemede",
  confirmed: "Onaylandı",
  arrived: "Giriş Yapıldı",
  "no_show": "Gelmedi",
  cancelled: "İptal Edildi",
};

const STATUS_HELPER_TEXT: Record<NonNullable<Reservation["status"]>, string> = {
  pending: "Rezervasyonunuz alınmıştır. Onaylandığında bilgilendirileceksiniz.",
  confirmed: "Rezervasyonunuz onaylandı. İyi eğlenceler!",
  arrived: "Mekâna giriş yapıldı. Keyifli bir zaman geçirin!",
  "no_show": "Rezervasyona gelinmedi.",
  cancelled: "Rezervasyon iptal edildi.",
};

type Selection = { person: number; menuId: string; price: number };
type MenuLite = { _id: string; name: string; pricePerPerson: number };

export default function ReservationDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params as { id: string };

  const { data: r, loading, error, refetch, setData } = useReservationDetail(id, 5000);

  const [uploading, setUploading] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrLoading, setQrLoading] = React.useState(false);
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loading && r) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, r]);

  // Derivations
  const restaurantObj: any =
    (r as any)?.restaurantId && typeof (r as any)?.restaurantId === "object"
      ? (r as any).restaurantId
      : (r as any)?.restaurant ?? (r as any)?.restaurantId ?? {};

  const restaurantName = restaurantObj?.name ?? "";
  const dateTimeUTC = (r as any)?.dateTimeUTC as string | undefined;
  const status = ((r as any)?.status as NonNullable<Reservation["status"]>) ?? "pending";

  const partySize = Number((r as any)?.partySize ?? 0) || 0;
  const selections = (((r as any)?.selections ?? []) as Selection[]) || [];
  const totalPrice = Number((r as any)?.totalPrice ?? 0) || 0;
  const depositAmount = Number((r as any)?.depositAmount ?? 0) || 0;

  const selectionMode = (((r as any)?.selectionMode ?? "count") as "index" | "count");
  const menus = (((r as any)?.menus ?? []) as MenuLite[]) || [];

  const menuMap = React.useMemo(() => {
    const m = new Map<string, MenuLite>();
    menus.forEach((x) => m.set(String(x._id), x));
    return m;
  }, [menus]);

  type Group = { name: string; unit: number; count: number; subtotal: number };
  const groups = React.useMemo(() => {
    const acc: Record<string, Group> = {};
    for (const s of selections) {
      const key = s.menuId || "_unknown";
      const info = menuMap.get(String(key));
      const unit = Number(s.price || info?.pricePerPerson || 0);
      const name = info?.name || "Menü";

      if (!acc[key]) acc[key] = { name, unit, count: 0, subtotal: 0 };
      const addCount = selectionMode === "index" ? 1 : Math.max(0, Number(s.person) || 0);
      acc[key].count += addCount;
      acc[key].subtotal = acc[key].unit * acc[key].count;
    }
    return acc;
  }, [selections, menuMap, selectionMode]);

  const canCancel = status === "pending";
  const canShowQR = status === "confirmed" || status === "arrived";

  /* ---------- Actions ---------- */

  const handleReplace = async (file: { uri: string; name: string; type: string }) => {
    try {
      setUploading(true);
      const res = await uploadReceipt(id, file);
      setData((prev: any) =>
        prev ? { ...prev, receiptUrl: res.receiptUrl, status: res.status as any } : prev
      );
      Alert.alert("Başarılı", "Dekont yüklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const onCancelPress = () => {
    if (!r) return;
    Alert.alert("Rezervasyonu iptal et", "İptal etmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Evet, iptal et",
        style: "destructive",
        onPress: async () => {
          try {
            setCanceling(true);
            const out = await cancelReservation(id);
            setData((prev: any) => (prev ? { ...prev, status: out.status as any } : prev));
            Alert.alert("İptal edildi", "Rezervasyonunuz iptal edildi.");
          } catch (e: any) {
            Alert.alert("Hata", e?.message ?? "İptal edilemedi.");
          } finally {
            setCanceling(false);
          }
        },
      },
    ]);
  };

  const onOpenQR = async () => {
    try {
      setQrLoading(true);
      const url = await getReservationQR(id);
      setQrUrl(url);
      setQrOpen(true);
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "QR alınamadı.");
    } finally {
      setQrLoading(false);
    }
  };

  /** 🧭 Her zaman Google Maps rota URL’i açar (app varsa app, yoksa web) */
    const onDirections = async () => {
  const rest = (r as any)?.restaurantId || (r as any)?.restaurant || {};
  const url = buildMapsUrl({
    googleMapsUrl: rest.googleMapsUrl,
    lat: rest?.coordinates?.lat,   // number | undefined
    lng: rest?.coordinates?.lng,   // number | undefined
  });

  if (!url) {
    Alert.alert("Konum bulunamadı", "Restoran konumu mevcut değil.");
    return;
  }
  await openInMaps(url);
};
  /* ---------- Render helpers ---------- */

  const StatusBadge = ({ status }: { status: NonNullable<Reservation["status"]> }) => {
    const configMap: Record<
      NonNullable<Reservation["status"]>,
      { icon: string; colors: [string, string]; textColor: string }
    > = {
      pending: { icon: "time-outline", colors: [REZZY.primaryMid, REZZY.primary], textColor: "#fff" },
      confirmed: { icon: "checkmark-circle", colors: ["#66BB6A", "#43A047"], textColor: "#fff" },
      arrived: { icon: "enter-outline", colors: [REZZY.primaryMid, REZZY.primary], textColor: "#fff" },
      "no_show": { icon: "close-circle", colors: ["#EF5350", "#E53935"], textColor: "#fff" },
      cancelled: { icon: "ban", colors: ["#78909C", "#546E7A"], textColor: "#fff" },
    };
    const config = configMap[status];

    return (
      <LinearGradient colors={config.colors} style={styles.statusBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Ionicons name={config.icon as any} size={18} color={config.textColor} />
        <Text style={[styles.statusText, { color: config.textColor }]}>{TR_STATUS_LABEL[status]}</Text>
      </LinearGradient>
    );
  };

  const InfoCard = ({ icon, text }: { icon: string; text: string }) => (
    <View style={styles.infoCard}>
      <Ionicons name={icon as any} size={20} color={REZZY.textMuted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );

  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={22} color={REZZY.text} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  /* ---------- Main ---------- */

  if (loading) {
    return (
      <Screen topPadding="none">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={REZZY.primary} />
          <Text style={styles.loadingText}>Yükleniyor…</Text>
        </View>
      </Screen>
    );
  }

  if (error || !r) {
    return (
      <Screen topPadding="none">
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={REZZY.danger} />
          <Text style={styles.errorTitle}>Bir Hata Oluştu</Text>
          <Text style={styles.errorText}>{error ?? "Rezervasyon bulunamadı"}</Text>
          <Button title="Tekrar Dene" onPress={refetch} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen topPadding="flat">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header Card */}
          <LinearGradient colors={[REZZY.primary, REZZY.primaryDark]} style={styles.headerCard}>
            <View style={styles.headerContent}>
              <Ionicons name="restaurant" size={32} color="#fff" />
              <View style={styles.headerTextContainer}>
                <Text style={styles.restaurantName}>{restaurantName}</Text>
                {dateTimeUTC && (
                  <View style={styles.dateTimeRow}>
                    <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.dateTimeText}>{formatDateTime(dateTimeUTC)}</Text>
                  </View>
                )}
              </View>
            </View>
            <StatusBadge status={status} />
          </LinearGradient>

          {/* Info Banner */}
          <InfoCard icon="information-circle-outline" text={STATUS_HELPER_TEXT[status]} />

          {/* Summary Card */}
          <View style={styles.card}>
            <SectionHeader icon="document-text-outline" title="Rezervasyon Özeti" />

            <View style={styles.partySizeRow}>
              <Ionicons name="people" size={20} color={REZZY.primary} />
              <Text style={styles.partySizeText}>{partySize} Kişi</Text>
            </View>

            {selections.length > 0 ? (
              <View style={styles.menuList}>
                {Object.entries(groups).map(([menuId, g], idx) => (
                  <View key={menuId}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.menuItem}>
                      <View style={styles.menuLeft}>
                        <View style={styles.menuBadge}>
                          <Text style={styles.menuCount}>×{g.count}</Text>
                        </View>
                        <View>
                          <Text style={styles.menuName}>{g.name}</Text>
                          <Text style={styles.menuUnit}>{formatTL(g.unit)} / kişi</Text>
                        </View>
                      </View>
                      <Text style={styles.menuPrice}>{formatTL(g.subtotal)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noMenuText}>Menü seçimleri bulunamadı.</Text>
            )}

            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Ara Toplam</Text>
                <Text style={styles.totalValue}>{formatTL(totalPrice)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Kapora</Text>
                <Text style={styles.totalValue}>{formatTL(depositAmount)}</Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Genel Toplam</Text>
                <Text style={styles.grandTotalValue}>{formatTL(totalPrice)}</Text>
              </View>
            </View>
          </View>

          {/* Receipt Card */}
          <View style={styles.card}>
            <SectionHeader icon="receipt-outline" title="Dekont" />
            <ReceiptCard
              url={(r as any)?.receiptUrl}
              onReplace={handleReplace}
              replacing={uploading}
              canReplace={status === "pending"}
            />
          </View>

          {/* Directions */}
          <View style={styles.card}>
            <SectionHeader icon="navigate-outline" title="Yol Tarifi" />
            <Pressable style={styles.directionsButton} onPress={onDirections}>
              <Ionicons name="map" size={24} color={REZZY.primary} />
              <Text style={styles.directionsText}>Yol Tarifi Al</Text>
              <Ionicons name="chevron-forward" size={20} color={REZZY.textMuted} />
            </Pressable>
          </View>

          {/* QR Code */}
          <View style={styles.card}>
            <SectionHeader icon="qr-code-outline" title="Giriş QR Kodu" />
            {canShowQR ? (
              <Pressable
                style={[styles.qrButton, qrLoading && styles.qrButtonDisabled]}
                onPress={onOpenQR}
                disabled={qrLoading}
              >
                {qrLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="qr-code" size={24} color="#fff" />
                    <Text style={styles.qrButtonText}>QR Kodumu Göster</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <InfoCard icon="lock-closed-outline" text="Onaylandığında giriş için QR kod burada görünecek." />
            )}
          </View>

          {/* Cancel Section */}
          {canCancel ? (
            <Pressable
              style={[styles.cancelButton, canceling && styles.cancelButtonDisabled]}
              onPress={onCancelPress}
              disabled={canceling}
            >
              {canceling ? (
                <ActivityIndicator color={REZZY.danger} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={22} color={REZZY.danger} />
                  <Text style={styles.cancelButtonText}>Rezervasyonu İptal Et</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                backgroundColor: REZZY.dangerSoft,
                borderWidth: 1,
                borderColor: REZZY.dangerBorder,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Ionicons name="lock-closed-outline" size={18} color={REZZY.danger} />
              <Text style={{ color: REZZY.danger, fontWeight: "600" }}>
                Bu rezervasyon iptal edilemez.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* QR Modal */}
      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setQrOpen(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Giriş QR Kodu</Text>
              <Pressable onPress={() => setQrOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={REZZY.textMuted} />
              </Pressable>
            </View>

            {!qrUrl ? (
              <View style={styles.qrLoadingContainer}>
                <ActivityIndicator size="large" color={REZZY.primary} />
              </View>
            ) : (
              <View style={styles.qrImageContainer}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.qrHelperText}>Bu kodu restoran girişinde gösterin</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: REZZY.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    color: REZZY.text,
  },
  errorText: {
    fontSize: 15,
    color: REZZY.textMuted,
    textAlign: "center",
    marginBottom: 24,
  },
  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateTimeText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginLeft: 6,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZZY.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: REZZY.textMuted,
    lineHeight: 18,
  },
  card: {
    backgroundColor: REZZY.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: REZZY.text,
  },
  partySizeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZZY.primarySoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  partySizeText: {
    fontSize: 15,
    fontWeight: "600",
    color: REZZY.primaryDark,
  },
  menuList: {
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  menuBadge: {
    backgroundColor: REZZY.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
  },
  menuCount: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  menuName: {
    fontSize: 15,
    fontWeight: "600",
    color: REZZY.text,
    marginBottom: 2,
  },
  menuUnit: {
    fontSize: 13,
    color: REZZY.textMuted,
  },
  menuPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: REZZY.text,
  },
  divider: {
    height: 1,
    backgroundColor: REZZY.border,
  },
  noMenuText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 12,
  },
  totalSection: {
    borderTopWidth: 2,
    borderTopColor: REZZY.border,
    paddingTop: 16,
    gap: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 14,
    color: REZZY.textMuted,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "600",
    color: REZZY.text,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: REZZY.surfaceAlt,
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: REZZY.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: REZZY.primary,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZZY.surfaceAlt,
    borderWidth: 1,
    borderColor: REZZY.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  directionsText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: REZZY.text,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: REZZY.primary,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  qrButtonDisabled: {
    opacity: 0.6,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: REZZY.dangerSoft,
    borderWidth: 1,
    borderColor: REZZY.dangerBorder,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: REZZY.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: REZZY.text,
  },
  closeButton: {
    padding: 4,
  },
  qrLoadingContainer: {
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  qrImageContainer: {
    alignItems: "center",
  },
  qrImage: {
    width: 280,
    height: 280,
    borderRadius: 16,
    backgroundColor: REZZY.surfaceAlt,
  },
  qrHelperText: {
    marginTop: 16,
    fontSize: 14,
    color: REZZY.textMuted,
    textAlign: "center",
  },
});
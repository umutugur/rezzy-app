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
  TouchableOpacity,
  Platform,
  Linking,
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
import { useI18n } from "../i18n";

/* ---------- Renk Paleti (Rezvix) ---------- */
const REZVIX = {
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

// Status helper metinleri için i18n key map'i
const STATUS_HELPER_KEY: Record<NonNullable<Reservation["status"]>, string> = {
  pending: "reservationDetail.helper.pending",
  confirmed: "reservationDetail.helper.confirmed",
  arrived: "reservationDetail.helper.arrived",
  "no_show": "reservationDetail.helper.no_show",
  cancelled: "reservationDetail.helper.cancelled",
};

type Selection = { person: number; menuId: string; price: number };
type MenuLite = { _id: string; name: string; pricePerPerson: number };

type InfoModalState = {
  visible: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  autoClose?: boolean; // başarıda otomatik kapanma
} | null;

export default function ReservationDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params as { id: string };

  const { t } = useI18n();

  const { data: r, loading, error, refetch, setData } = useReservationDetail(id, 5000);

  const [uploading, setUploading] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrLoading, setQrLoading] = React.useState(false);
  const [qrUrl, setQrUrl] = React.useState<string | null>(null);

  const [infoModal, setInfoModal] = React.useState<InfoModalState>(null);
  const modalScale = React.useRef(new Animated.Value(0.85)).current;
  const modalOpacity = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Info modal animasyon + otomatik kapanma
  React.useEffect(() => {
    if (infoModal?.visible) {
      modalScale.setValue(0.85);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(modalScale, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(modalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();

      if (infoModal.autoClose) {
        const tmr = setTimeout(() => setInfoModal(null), 1500);
        return () => clearTimeout(tmr);
      }
    }
  }, [infoModal?.visible, infoModal?.autoClose, modalOpacity, modalScale]);

  React.useEffect(() => {
    if (!loading && r) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, r, fadeAnim]);

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
      const name = info?.name || t("reservationDetail.menuFallback");

      if (!acc[key]) acc[key] = { name, unit, count: 0, subtotal: 0 };
      const addCount = selectionMode === "index" ? 1 : Math.max(0, Number(s.person) || 0);
      acc[key].count += addCount;
      acc[key].subtotal = acc[key].unit * acc[key].count;
    }
    return acc;
  }, [selections, menuMap, selectionMode, t]);

  const canCancel = status === "pending";
  const canShowQR = status === "confirmed" || status === "arrived";

  const showSuccess = (title: string, message: string, autoClose = true) =>
    setInfoModal({ visible: true, type: "success", title, message, autoClose });

  const showError = (title: string, message: string) =>
    setInfoModal({ visible: true, type: "error", title, message });

  /* ---------- Actions ---------- */

  const handleReplace = async (file: { uri: string; name: string; type: string }) => {
    try {
      setUploading(true);
      const res = await uploadReceipt(id, file);
      setData((prev: any) =>
        prev ? { ...prev, receiptUrl: res.receiptUrl, status: res.status as any } : prev
      );
      showSuccess(
        t("reservationDetail.uploadSuccessTitle"),
        t("reservationDetail.uploadSuccessBody"),
      );
    } catch (e: any) {
      showError(t("common.error"), e?.message ?? t("reservationDetail.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const onCancelPress = () => {
    if (!r) return;
    Alert.alert(
      t("reservationDetail.cancelConfirmTitle"),
      t("reservationDetail.cancelConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("reservationDetail.cancelConfirmOk"),
          style: "destructive",
          onPress: async () => {
            try {
              setCanceling(true);
              const out = await cancelReservation(id);
              setData((prev: any) => (prev ? { ...prev, status: out.status as any } : prev));
              showSuccess(
                t("reservationDetail.cancelSuccessTitle"),
                t("reservationDetail.cancelSuccessBody"),
              );
            } catch (e: any) {
              showError(t("common.error"), e?.message ?? t("reservationDetail.cancelError"));
            } finally {
              setCanceling(false);
            }
          },
        },
      ],
    );
  };

  const onOpenQR = async () => {
    try {
      setQrLoading(true);
      const url = await getReservationQR(id);
      setQrUrl(url);
      setQrOpen(true);
    } catch (e: any) {
      showError(t("common.error"), e?.message ?? t("reservationDetail.qrError"));
    } finally {
      setQrLoading(false);
    }
  };

  /** 🧭 Platform-safe directions opener (Android/iOS) */
  const onDirections = async () => {
    const rest = (r as any)?.restaurantId || (r as any)?.restaurant || {};
    const lat = typeof rest?.coordinates?.lat === "number" ? rest.coordinates.lat : undefined;
    const lng = typeof rest?.coordinates?.lng === "number" ? rest.coordinates.lng : undefined;
    const label = encodeURIComponent(rest?.name || "Hedef");
    const gmUrl = rest?.googleMapsUrl as string | undefined;

    try {
      // If we only have a Google Maps URL from backend, try it first
      if (!lat || !lng) {
        if (gmUrl) {
          const can = await Linking.canOpenURL(gmUrl);
          if (can) return Linking.openURL(gmUrl);
        }
        showError(
          t("reservationDetail.locationErrorTitle"),
          t("reservationDetail.locationErrorBody"),
        );
        return;
      }

      if (Platform.OS === "android") {
        // Prefer Google Maps navigation intent if available
        const googleMapsScheme = "google.navigation:q=" + `${lat},${lng}`;
        const canGoogleNav = await Linking.canOpenURL(googleMapsScheme);
        if (canGoogleNav) {
          await Linking.openURL(googleMapsScheme);
          return;
        }

        // Fallback to geo: URI
        const geoUri = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
        const canGeo = await Linking.canOpenURL(geoUri);
        if (canGeo) {
          await Linking.openURL(geoUri);
          return;
        }

        // Final fallback to HTTPS web directions
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        await Linking.openURL(webUrl);
        return;
      } else {
        // iOS: Prefer Google Maps app if installed
        const gmapsIOS = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
        const canGmaps = await Linking.canOpenURL(gmapsIOS);
        if (canGmaps) {
          await Linking.openURL(gmapsIOS);
          return;
        }

        // Apple Maps
        const appleMaps = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
        const canApple = await Linking.canOpenURL(appleMaps);
        if (canApple) {
          await Linking.openURL(appleMaps);
          return;
        }

        // Web fallback
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        await Linking.openURL(webUrl);
        return;
      }
    } catch (e) {
      showError(
        t("reservationDetail.directionsErrorTitle"),
        t("reservationDetail.directionsErrorBody"),
      );
    }
  };

  /* ---------- Render helpers ---------- */

  const StatusBadge = ({ status }: { status: NonNullable<Reservation["status"]> }) => {
    const configMap: Record<
      NonNullable<Reservation["status"]>,
      { icon: string; colors: [string, string]; textColor: string }
    > = {
      pending: { icon: "time-outline", colors: [REZVIX.primaryMid, REZVIX.primary], textColor: "#fff" },
      confirmed: { icon: "checkmark-circle", colors: ["#66BB6A", "#43A047"], textColor: "#fff" },
      arrived: { icon: "enter-outline", colors: [REZVIX.primaryMid, REZVIX.primary], textColor: "#fff" },
      "no_show": { icon: "close-circle", colors: ["#EF5350", "#E53935"], textColor: "#fff" },
      cancelled: { icon: "ban", colors: ["#78909C", "#546E7A"], textColor: "#fff" },
    };
    const config = configMap[status];

    return (
      <LinearGradient colors={config.colors} style={styles.statusBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <Ionicons name={config.icon as any} size={18} color={config.textColor} />
        <Text style={[styles.statusText, { color: config.textColor }]}>
          {t(`status.${status}`)}
        </Text>
      </LinearGradient>
    );
  };

  const InfoCard = ({ icon, text }: { icon: string; text: string }) => (
    <View style={styles.infoCard}>
      <Ionicons name={icon as any} size={20} color={REZVIX.textMuted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );

  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={22} color={REZVIX.text} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  /* ---------- Main ---------- */

  if (loading) {
    return (
      <Screen topPadding="none">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={REZVIX.primary} />
          <Text style={styles.loadingText}>{t("reservationDetail.loading")}</Text>
        </View>
      </Screen>
    );
  }

  if (error || !r) {
    return (
      <Screen topPadding="none">
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={REZVIX.danger} />
          <Text style={styles.errorTitle}>{t("reservationDetail.errorTitle")}</Text>
          <Text style={styles.errorText}>{error ?? t("reservationDetail.notFound")}</Text>
          <Button title={t("common.retry")} onPress={refetch} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen topPadding="flat">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header Card */}
          <LinearGradient colors={[REZVIX.primary, REZVIX.primaryDark]} style={styles.headerCard}>
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
          <InfoCard icon="information-circle-outline" text={t(STATUS_HELPER_KEY[status])} />

          {/* Summary Card */}
          <View style={styles.card}>
            <SectionHeader icon="document-text-outline" title={t("reservationDetail.summaryTitle")} />

            <View style={styles.partySizeRow}>
              <Ionicons name="people" size={20} color={REZVIX.primary} />
              <Text style={styles.partySizeText}>
                {partySize} {t("reservationDetail.personLabel")}
              </Text>
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
                          <Text style={styles.menuUnit}>
                            {formatTL(g.unit)} / {t("reservationDetail.personShort")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.menuPrice}>{formatTL(g.subtotal)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noMenuText}>{t("reservationDetail.noMenu")}</Text>
            )}

            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("reservationDetail.subtotal")}</Text>
                <Text style={styles.totalValue}>{formatTL(totalPrice)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("reservationDetail.deposit")}</Text>
                <Text style={styles.totalValue}>{formatTL(depositAmount)}</Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>{t("reservationDetail.grandTotal")}</Text>
                <Text style={styles.grandTotalValue}>{formatTL(totalPrice)}</Text>
              </View>
            </View>
          </View>

          {/* Receipt Card */}
          <View style={styles.card}>
            <SectionHeader icon="receipt-outline" title={t("reservationDetail.receiptSectionTitle")} />
            <ReceiptCard
              url={(r as any)?.receiptUrl}
              onReplace={handleReplace}
              replacing={uploading}
              canReplace={status === "pending"}
            />
          </View>

          {/* Directions */}
          <View style={styles.card}>
            <SectionHeader icon="navigate-outline" title={t("reservationDetail.directionsSectionTitle")} />
            <Pressable style={styles.directionsButton} onPress={onDirections}>
              <Ionicons name="map" size={24} color={REZVIX.primary} />
              <Text style={styles.directionsText}>{t("reservationDetail.directionsButton")}</Text>
              <Ionicons name="chevron-forward" size={20} color={REZVIX.textMuted} />
            </Pressable>
          </View>

          {/* QR Code */}
          <View style={styles.card}>
            <SectionHeader icon="qr-code-outline" title={t("reservationDetail.qrSectionTitle")} />
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
                    <Text style={styles.qrButtonText}>{t("reservationDetail.qrButton")}</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <InfoCard
                icon="lock-closed-outline"
                text={t("reservationDetail.qrLocked")}
              />
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
                <ActivityIndicator color={REZVIX.danger} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={22} color={REZVIX.danger} />
                  <Text style={styles.cancelButtonText}>
                    {t("reservationDetail.cancelButton")}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                backgroundColor: REZVIX.dangerSoft,
                borderWidth: 1,
                borderColor: REZVIX.dangerBorder,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Ionicons name="lock-closed-outline" size={18} color={REZVIX.danger} />
              <Text style={{ color: REZVIX.danger, fontWeight: "600" }}>
                {t("reservationDetail.cannotCancel")}
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
              <Text style={styles.modalTitle}>{t("reservationDetail.qrModalTitle")}</Text>
              <Pressable onPress={() => setQrOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={REZVIX.textMuted} />
              </Pressable>
            </View>

            {!qrUrl ? (
              <View style={styles.qrLoadingContainer}>
                <ActivityIndicator size="large" color={REZVIX.primary} />
              </View>
            ) : (
              <View style={styles.qrImageContainer}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                <Text style={styles.qrHelperText}>{t("reservationDetail.qrHelper")}</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Info Modal (success/error) */}
      <Modal
        visible={!!infoModal?.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setInfoModal(null)}>
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.modalContent,
              { transform: [{ scale: modalScale }], opacity: modalOpacity },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                infoModal?.type === "success" ? styles.iconBadgeSuccess : styles.iconBadgeError,
              ]}
            >
              <Ionicons
                name={infoModal?.type === "success" ? "checkmark-circle" : "alert-circle"}
                size={48}
                color="#fff"
              />
            </View>

            <Text
              style={[
                styles.modalTitle,
                infoModal?.type === "success" ? { color: "#166534" } : { color: "#991B1B" },
              ]}
            >
              {infoModal?.title ||
                (infoModal?.type === "error"
                  ? t("common.error")
                  : t("common.info"))}
            </Text>

            <Text style={{ color: REZVIX.textMuted, marginVertical: 10, textAlign: "center" }}>
              {infoModal?.message}
            </Text>

            {infoModal?.type === "error" && (
              <TouchableOpacity
                style={[styles.qrButton, { alignSelf: "center", backgroundColor: REZVIX.danger }]}
                onPress={() => setInfoModal(null)}
              >
                <Text style={styles.qrButtonText}>{t("common.ok")}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
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
    color: REZVIX.textMuted,
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
    color: REZVIX.text,
  },
  errorText: {
    fontSize: 15,
    color: REZVIX.textMuted,
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
    backgroundColor: REZVIX.surfaceAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: REZVIX.textMuted,
    lineHeight: 18,
  },
  card: {
    backgroundColor: REZVIX.surface,
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
    color: REZVIX.text,
  },
  partySizeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZVIX.primarySoft,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  partySizeText: {
    fontSize: 15,
    fontWeight: "600",
    color: REZVIX.primaryDark,
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
    backgroundColor: REZVIX.primary,
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
    color: REZVIX.text,
    marginBottom: 2,
  },
  menuUnit: {
    fontSize: 13,
    color: REZVIX.textMuted,
  },
  menuPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: REZVIX.text,
  },
  divider: {
    height: 1,
    backgroundColor: REZVIX.border,
  },
  noMenuText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 12,
  },
  totalSection: {
    borderTopWidth: 2,
    borderTopColor: REZVIX.border,
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
    color: REZVIX.textMuted,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "600",
    color: REZVIX.text,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: REZVIX.surfaceAlt,
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: REZVIX.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: REZVIX.primary,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: REZVIX.surfaceAlt,
    borderWidth: 1,
    borderColor: REZVIX.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  directionsText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: REZVIX.text,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: REZVIX.primary,
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
    backgroundColor: REZVIX.dangerSoft,
    borderWidth: 1,
    borderColor: REZVIX.dangerBorder,
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
    color: REZVIX.danger,
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
    color: REZVIX.text,
    textAlign: "center",
    alignSelf: "center",
    width: "100%",
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
    backgroundColor: REZVIX.surfaceAlt,
  },
  qrHelperText: {
    marginTop: 16,
    fontSize: 14,
    color: REZVIX.textMuted,
    textAlign: "center",
  },
  iconBadge: {
    alignSelf: "center",
    marginBottom: 12,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeSuccess: {
    backgroundColor: "#16A34A",
  },
  iconBadgeError: {
    backgroundColor: "#DC2626",
  },
});
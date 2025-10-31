import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import * as Clipboard from "expo-clipboard";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, Text } from "../components/Themed";
import ReceiptCard from "../components/ReceiptCard";
import { useReservation } from "../store/useReservation";
import { getRestaurant, type Restaurant as ApiRestaurant } from "../api/restaurants";
import {
  createReservation,
  uploadReceipt,
  type CreateReservationPayload,
} from "../api/reservations";
import { Ionicons } from "@expo/vector-icons";

dayjs.locale("tr");

/** Rezzy uyumlu renkler */
const C = {
  primary: "#7B2C2C",
  primaryDark: "#6B2525",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
};

const CTA_HEIGHT = 88;

type FixMenu = {
  _id?: string;
  name?: string;
  title?: string;
  description?: string;
  pricePerPerson?: number;
  isActive?: boolean;
};
type ExtendedRestaurant = ApiRestaurant & {
  iban?: string;
  ibanName?: string;
  bankName?: string;
  priceRange?: string;
  description?: string;
  menus?: FixMenu[];
  depositAmount?: number;
};

const formatTL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

export default function ReservationStep3Screen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const restaurantId = useReservation((s) => s.restaurantId);
  const dateTimeISO = useReservation((s) => s.dateTimeISO);
  const partySize = useReservation((s) => s.partySize);
  const selections = useReservation((s) => s.selections);

  const [restaurant, setRestaurant] = useState<ExtendedRestaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const [receiptFile, setReceiptFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; text: string }>({ visible: false, text: "" });
  const showToast = (text: string) => {
    setToast({ visible: true, text });
    setTimeout(() => setToast({ visible: false, text: "" }), 1200);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!restaurantId) {
          setLoading(false);
          return;
        }
        setLoading(true);
        const data = (await getRestaurant(restaurantId)) as ExtendedRestaurant;
        if (!alive) return;
        setRestaurant(data);
      } catch {
        if (!alive) return;
        setRestaurant(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const menuMap = useMemo(() => {
    const m = new Map<string, { name: string; price: number; desc?: string }>();
    for (const it of restaurant?.menus || []) {
      const id = String(it?._id ?? "");
      if (!id) continue;
      const name = String(it?.name ?? it?.title ?? "Menü");
      const price = Number(it?.pricePerPerson ?? 0) || 0;
      m.set(id, { name, price, desc: it?.description });
    }
    return m;
  }, [restaurant?.menus]);

  const groups = useMemo(() => {
    const acc: Record<string, { name: string; unit: number; count: number; subtotal: number }> = {};
    for (const s of selections as { person: number; menuId: string }[]) {
      const info = s.menuId ? menuMap.get(String(s.menuId)) : undefined;
      const name = info?.name ?? "Menü";
      const unit = Number(info?.price ?? 0) || 0;
      const key = String(s.menuId || "_unknown");
      if (!acc[key]) acc[key] = { name, unit, count: 0, subtotal: 0 };
      acc[key].count += 1;
      acc[key].subtotal = acc[key].unit * acc[key].count;
    }
    return acc;
  }, [selections, menuMap]);

  const subtotal = useMemo(
    () => Object.values(groups).reduce((sum, g) => sum + g.subtotal, 0),
    [groups]
  );
  const deposit = Number(restaurant?.depositAmount ?? 0) || 0;
  const grandTotal = subtotal; // kapora bilgilendirme amaçlı, toplamı değiştirmiyoruz
  const dateTimeLabel = dateTimeISO ? dayjs(dateTimeISO).format("DD MMM YYYY, HH:mm") : "";

  const onCopy = async (text?: string) => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      showToast("Kopyalandı");
    } catch {}
  };

  const handlePickReceipt = async (file: { uri: string; name: string; type: string }) => {
    setReceiptFile(file);
    showToast("Dekont seçildi");
  };

  const pickId = (obj: any): string => {
    if (!obj) return "";
    return String(
      obj._id ??
        obj.id ??
        obj.reservationId ??
        obj.reservation?._id ??
        obj.data?._id ??
        obj.data?.id ??
        ""
    );
  };

  const onCreateReservation = async () => {
    if (creating || !receiptFile) return;
    try {
      setCreating(true);
      if (!restaurantId || !dateTimeISO || !partySize || !(selections?.length > 0)) {
        showToast("Eksik bilgi");
        return;
      }

      const payload: CreateReservationPayload = {
        restaurantId,
        dateTimeISO,
        partySize,
        selections,
      };

      const created = await createReservation(payload);
      const id = pickId(created);
      if (!id) {
        console.log("createReservation response (id bulunamadı):", created);
        showToast("Rezervasyon ID alınamadı");
        return;
      }

      await uploadReceipt(id, receiptFile);

      nav.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Tabs" },
            { name: "Rezervasyon Detayı", params: { id } },
          ],
        })
      );
    } catch (e: any) {
      console.log("Create/Upload error:", e?.response?.data || e?.message || e);
      showToast(e?.response?.data?.message || "Oluşturma/Dekont hatası");
    } finally {
      setCreating(false);
    }
  };

  const bottomPad = CTA_HEIGHT + insets.bottom + 24;
  const ctaTitle = creating ? "Oluşturuluyor..." : receiptFile ? "Rezervasyonu Oluştur" : "Dekont Seçin";

  return (
    <Screen topPadding="flat" style={{ backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Başlık (Bookings/ReservationDetail ile aynı çizgide) */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Ionicons name="document-text" size={24} color={C.primary} />
            <Text style={styles.headerTitle}>Rezervasyon Özeti</Text>
          </View>
          {restaurant?.name ? (
            <Text secondary style={styles.headerSub}>{restaurant.name}</Text>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tarih & Kişi */}
          <View style={styles.card}>
            <View style={styles.rowLine}>
              <View style={styles.rowLeftWrap}>
                <Ionicons name="calendar" size={16} color={C.muted} />
                <Text secondary style={{ marginLeft: 6 }}>Tarih & Saat</Text>
              </View>
              <Text style={styles.bold}>{dateTimeLabel || "-"}</Text>
            </View>

            <View style={[styles.rowLine, { marginTop: 8 }]}>
              <View style={styles.rowLeftWrap}>
                <Ionicons name="people" size={16} color={C.muted} />
                <Text secondary style={{ marginLeft: 6 }}>Kişi</Text>
              </View>
              <Text style={styles.bold}>{partySize}</Text>
            </View>
          </View>

          {/* Seçilen Menüler & Toplam */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Seçilen Menüler</Text>
            {Object.keys(groups).length ? (
              <View style={{ gap: 8 }}>
                {Object.entries(groups).map(([key, g]) => (
                  <View key={key} style={styles.row}>
                    <Text style={styles.rowLeft}>{g.name} × {g.count}</Text>
                    <Text style={styles.rowRight}>{formatTL(g.subtotal)}</Text>
                  </View>
                ))}
                <View style={styles.hr} />
                <View style={styles.row}>
                  <Text secondary>Ara toplam</Text>
                  <Text>{formatTL(subtotal)}</Text>
                </View>
                <View style={styles.row}>
                  <Text secondary>Kapora</Text>
                  <Text>{formatTL(deposit)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.totalLeft}>Genel toplam</Text>
                  <Text style={styles.totalRight}>{formatTL(grandTotal)}</Text>
                </View>
              </View>
            ) : (
              <Text secondary>Menü seçimi bulunamadı.</Text>
            )}
          </View>

          {/* Ödeme Bilgileri */}
          {(restaurant?.iban || restaurant?.ibanName || restaurant?.bankName) && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ödeme Bilgileri</Text>

              {!!restaurant?.bankName && (
                <View style={styles.row}>
                  <Text secondary>Banka</Text>
                  <Text style={styles.bold}>{restaurant.bankName}</Text>
                </View>
              )}

              {!!restaurant?.ibanName && (
                <View style={styles.copyRow}>
                  <View style={{ flex: 1 }}>
                    <Text secondary>IBAN İsim</Text>
                    <Text style={styles.bold}>{restaurant.ibanName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => onCopy(restaurant?.ibanName)} style={styles.copyBtn}>
                    <Text style={styles.copyBtnText}>Kopyala</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!restaurant?.iban && (
                <View style={styles.copyRow}>
                  <View style={{ flex: 1 }}>
                    <Text secondary>IBAN</Text>
                    <Text style={[styles.bold, { letterSpacing: 0.4 }]}>{restaurant.iban}</Text>
                  </View>
                  <TouchableOpacity onPress={() => onCopy(restaurant?.iban)} style={styles.copyBtn}>
                    <Text style={styles.copyBtnText}>Kopyala</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text secondary style={{ marginTop: 8 }}>
                Lütfen kaporayı yatırdıktan sonra dekontu yükleyin.
              </Text>
            </View>
          )}

          {/* Dekont Yükleme */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dekont</Text>
            <ReceiptCard
              url={receiptFile?.uri}
              onReplace={handlePickReceipt}
              replacing={false}
              canReplace={!creating}
            />
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View
          pointerEvents="box-none"
          style={[styles.ctaBar, { paddingBottom: Math.max(16, 16 + insets.bottom) }]}
        >
          <TouchableOpacity
            onPress={onCreateReservation}
            disabled={!receiptFile || creating}
            activeOpacity={0.85}
            style={[styles.ctaBtn, (!receiptFile || creating) && styles.ctaBtnDisabled]}
          >
            <Text style={styles.ctaBtnText}>{ctaTitle}</Text>
          </TouchableOpacity>
        </View>

        {/* Mini Toast */}
        <Modal visible={toast.visible} transparent animationType="fade">
          <View style={styles.toastWrap}>
            <View style={styles.toastCard}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{toast.text}</Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  /** Header (aynı dil) */
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: C.card,
    borderBottomColor: C.border,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.text },
  headerSub: { marginTop: 6 },

  /** Kartlar */
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    ...cardShadow,
  },
  sectionTitle: { fontWeight: "800", marginBottom: 8, color: C.text },
  bold: { fontWeight: "700", color: C.text },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  rowLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeftWrap: { flexDirection: "row", alignItems: "center" },

  rowLeft: { fontWeight: "700", color: C.text },
  rowRight: { fontWeight: "700", color: C.text },

  totalLeft: { fontWeight: "800", color: C.text },
  totalRight: { fontWeight: "800", color: C.primary },

  hr: { height: 1, backgroundColor: C.border, marginVertical: 8 },

  copyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  copyBtnText: { color: "#fff", fontWeight: "700" },

  /** CTA */
  ctaBar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    height: CTA_HEIGHT,
    justifyContent: "center",
  },
  ctaBtn: {
    backgroundColor: C.primary,
    minHeight: 56,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDisabled: { opacity: 0.55 },
  ctaBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  /** Toast */
  toastWrap: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 24,
  },
  toastCard: { backgroundColor: "rgba(0,0,0,0.85)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
});
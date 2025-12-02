// src/screens/ReservationStep3Screen.tsx
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
  createStripePaymentIntent,
} from "../api/reservations";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";
import { useStripe } from "@stripe/stripe-react-native";

dayjs.locale("tr");

/** Rezvix uyumlu renkler */
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
  region?: string;
};

type StripeIntentResponse = {
  paymentIntentClientSecret: string;
  customerId: string;
  ephemeralKey: string;
  publishableKey?: string;
};

// Bölgeye göre para birimi (backend ile aynı mantık)
const currencyFromRegion = (region?: string | null) => {
  const r = String(region || "").toUpperCase();
  if (r === "UK" || r === "GB" || r === "UK-GB" || r === "EN") return "GBP";
  return "TRY";
};

const formatCurrency = (amount: number, currency: string, localeForIntl: string) => {
  try {
    return new Intl.NumberFormat(localeForIntl, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(isFinite(amount) ? amount : 0);
  } catch {
    const n = Math.round(isFinite(amount) ? amount : 0);
    return `${n} ${currency}`;
  }
};

// 24 hex ObjectId kontrolü (frontend safeguard)
const isOid = (v: any) => /^[0-9a-fA-F]{24}$/.test(String(v || ""));

export default function ReservationStep3Screen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t, language, locale: hookLocale } = useI18n();
  const locale = language ?? hookLocale ?? "tr";

  const restaurantId = useReservation((s) => s.restaurantId);
  const dateTimeISO = useReservation((s) => s.dateTimeISO);
  const partySize = useReservation((s) => s.partySize);
  const selections = useReservation((s) => s.selections);

  const [restaurant, setRestaurant] = useState<ExtendedRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoMethodSet, setAutoMethodSet] = useState(false);
  const [receiptFile, setReceiptFile] =
    useState<{ uri: string; name: string; type: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // Ödeme yöntemi default: card (depozito varsa otomatik card, yoksa bank)
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "card">("card");
  const [reservationIdForPayment, setReservationIdForPayment] = useState<string | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [toast, setToast] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: "",
  });
  const showToast = (text: string) => {
    setToast({ visible: true, text });
    setTimeout(() => setToast({ visible: false, text: "" }), 1500);
  };

  useEffect(() => {
    try {
      dayjs.locale(locale);
    } catch {}
  }, [locale]);

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

        if (!autoMethodSet) {
          const dep = Number(data?.depositAmount ?? 0) || 0;
          if (dep > 0.0001) setPaymentMethod("card");
          else setPaymentMethod("bank");
          setAutoMethodSet(true);
        }
      } catch {
        if (!alive) return;
        setRestaurant(null);
        if (!autoMethodSet) {
          setPaymentMethod("bank");
          setAutoMethodSet(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId, autoMethodSet]);

  /** ✅ selections içinden gerçek/valid menuId olanları ayıkla */
  const cleanedSelections = useMemo(() => {
    const arr = (selections || []) as any[];
    return arr
      .filter((s) => isOid(s?.menuId))
      .map((s) => ({
        person: Number(s?.person) || 0,
        menuId: String(s.menuId),
      }));
  }, [selections]);

  /** Fix menü seçildi mi? */
  const hasFixMenuSelection = cleanedSelections.length > 0;

  /** Backend için gönderilecek selections (dummy yok) */
  const effectiveSelections = cleanedSelections;

  const menuMap = useMemo(() => {
    const m = new Map<string, { name: string; price: number; desc?: string }>();
    for (const it of restaurant?.menus || []) {
      const id = String(it?._id ?? "");
      if (!id) continue;
      const name = String(
        it?.name ?? it?.title ?? t("reservationStep3.fallbackMenuName")
      );
      const price = Number(it?.pricePerPerson ?? 0) || 0;
      m.set(id, { name, price, desc: it?.description });
    }
    return m;
  }, [restaurant?.menus, t]);

  /** Sadece gerçek menuId’ler ile group oluştur */
  const groups = useMemo(() => {
    if (!hasFixMenuSelection) return {};
    const acc: Record<
      string,
      { name: string; unit: number; count: number; subtotal: number }
    > = {};
    for (const s of cleanedSelections) {
      const mid = String(s.menuId);
      const info = menuMap.get(mid);
      const name = info?.name ?? t("reservationStep3.fallbackMenuName");
      const unit = Number(info?.price ?? 0) || 0;
      if (!acc[mid]) acc[mid] = { name, unit, count: 0, subtotal: 0 };
      acc[mid].count += 1;
      acc[mid].subtotal = acc[mid].unit * acc[mid].count;
    }
    return acc;
  }, [cleanedSelections, menuMap, hasFixMenuSelection, t]);

  const subtotal = useMemo(
    () => Object.values(groups).reduce((sum, g) => sum + g.subtotal, 0),
    [groups]
  );

  const deposit = Number(restaurant?.depositAmount ?? 0) || 0;
  const hasDeposit = deposit > 0.0001;

  const grandTotal = hasFixMenuSelection ? subtotal : 0;
  const dateTimeLabel = dateTimeISO
    ? dayjs(dateTimeISO).format("DD MMM YYYY, HH:mm")
    : "";

  const currencyCode = useMemo(
    () => currencyFromRegion(restaurant?.region),
    [restaurant?.region]
  );

  const intlLocaleForMoney =
    locale === "tr" ? "tr-TR" : locale === "en" ? "en-GB" : locale;

  const formatMoney = (amount: number) =>
    formatCurrency(amount, currencyCode, intlLocaleForMoney);

  const depositLabelForCTA = useMemo(
    () => formatMoney(deposit),
    [deposit, currencyCode, intlLocaleForMoney]
  );

  const onCopy = async (text?: string) => {
    if (!text) return;
    try {
      await Clipboard.setStringAsync(String(text));
      showToast(t("reservationStep3.toastCopied"));
    } catch {}
  };

  const handlePickReceipt = async (file: {
    uri: string;
    name: string;
    type: string;
  }) => {
    setReceiptFile(file);
    showToast(t("reservationStep3.toastReceiptSelected"));
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

  const ensureReservationCreated = async (): Promise<string | null> => {
    console.log("[STEP3 payload]", {
      restaurantId,
      type: typeof restaurantId,
      dateTimeISO,
      partySize,
      selections: effectiveSelections,
    });

    if (reservationIdForPayment) return reservationIdForPayment;

    if (!restaurantId || !dateTimeISO || !partySize) {
      showToast(t("reservationStep3.toastMissing"));
      return null;
    }

    const payload: CreateReservationPayload = {
      restaurantId,
      dateTimeISO,
      partySize,
      selections: effectiveSelections, // ✅ boş olabilir []
    };

    const created = await createReservation(payload);
    const id = pickId(created);
    if (!id) {
      console.log("createReservation response (id bulunamadı):", created);
      showToast(t("reservationStep3.toastNoId"));
      return null;
    }
    setReservationIdForPayment(id);
    return id;
  };

  const onCreateReservationBank = async () => {
    if (creating || !receiptFile) return;
    try {
      setCreating(true);
      const id = await ensureReservationCreated();
      if (!id) return;

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
      showToast(
        e?.response?.data?.message || t("reservationStep3.toastCreateError")
      );
    } finally {
      setCreating(false);
    }
  };

  const onCreateReservationCard = async () => {
    if (creating || stripeBusy) return;
    if (!hasDeposit) {
      showToast(
        t("reservationStep3.toastNoDepositForCard") ||
          "Bu restoran için depozito bulunmuyor."
      );
      return;
    }
    try {
      setCreating(true);
      setStripeBusy(true);

      const id = await ensureReservationCreated();
      if (!id) return;

      const setup = (await createStripePaymentIntent(id, {
        saveCard: true,
      })) as StripeIntentResponse;

      if (
        !setup?.paymentIntentClientSecret ||
        !setup?.customerId ||
        !setup?.ephemeralKey
      ) {
        console.log("Stripe setup response:", setup);
        showToast(
          t("reservationStep3.toastStripeInitError") || "Ödeme başlatılamadı."
        );
        return;
      }

      const { paymentIntentClientSecret, customerId, ephemeralKey } = setup;

      const { error: initError } = await initPaymentSheet({
        customerId,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret,
        merchantDisplayName: "Rezvix",
        allowsDelayedPaymentMethods: false,
        style: "alwaysLight",
        appearance: {
          colors: {
            primary: C.primary,
            background: C.card,
            componentBackground: C.card,
            componentBorder: C.border,
            componentText: C.text,
            primaryText: "#FFFFFF",
            secondaryText: C.muted,
            placeholderText: "#9CA3AF",
            icon: C.primary,
          },
          shapes: {
            borderRadius: 12,
            borderWidth: 1,
          },
          primaryButton: {
            colors: {
              background: C.primary,
              text: "#FFFFFF",
              border: C.primary,
            },
            shapes: { borderRadius: 16 },
          },
        },
      });

      if (initError) {
        console.log("initPaymentSheet error:", initError);
        showToast(
          t("reservationStep3.toastStripeInitError") ||
            (initError.message ?? "Ödeme başlatılamadı.")
        );
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        console.log("presentPaymentSheet error:", presentError);
        if (presentError.code !== "Canceled") {
          showToast(
            t("reservationStep3.toastStripePaymentError") ||
              (presentError.message ?? "Ödeme tamamlanamadı.")
          );
        }
        return;
      }

      showToast(
        t("reservationStep3.toastStripeSuccess") || "Ödeme başarıyla alındı."
      );

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
      console.log("Stripe payment error:", e?.response?.data || e?.message || e);
      showToast(
        e?.response?.data?.message ||
          t("reservationStep3.toastStripePaymentError") ||
          "Ödeme sırasında bir hata oluştu."
      );
    } finally {
      setStripeBusy(false);
      setCreating(false);
    }
  };

  const bottomPad = CTA_HEIGHT + insets.bottom + 24;

  const isBank = paymentMethod === "bank";
  const isCard = paymentMethod === "card";

  const ctaTitle = (() => {
    if (isBank) {
      return creating
        ? t("reservationStep3.ctaCreating")
        : receiptFile
        ? t("reservationStep3.ctaCreate")
        : t("reservationStep3.ctaPickReceipt");
    }
    if (creating || stripeBusy) {
      return t("reservationStep3.ctaStripeProcessing") || "Ödeme işleniyor...";
    }
    return (
      t("reservationStep3.ctaStripePayWithAmount", { amount: depositLabelForCTA }) ||
      `${depositLabelForCTA} ${t("reservationStep3.paySuffix") || "öde"}`
    );
  })();

  const onPressCTA = () => {
    if (isBank) return onCreateReservationBank();
    return onCreateReservationCard();
  };

  const ctaDisabled = isBank
    ? !receiptFile || creating
    : creating || stripeBusy || !hasDeposit;

  if (loading) {
    return (
      <Screen topPadding="flat" style={{ backgroundColor: C.bg }}>
        <View style={{ padding: 24, alignItems: "center" }}>
          <Ionicons name="time" size={24} color={C.primary} />
          <Text style={{ marginTop: 8 }}>{t("reservationStep3.loading")}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen topPadding="flat" style={{ backgroundColor: C.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Ionicons name="document-text" size={24} color={C.primary} />
            <Text style={styles.headerTitle}>{t("reservationStep3.title")}</Text>
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
                <Text secondary style={{ marginLeft: 6 }}>
                  {t("reservationStep3.dateTimeLabel")}
                </Text>
              </View>
              <Text style={styles.bold}>{dateTimeLabel || "-"}</Text>
            </View>

            <View style={[styles.rowLine, { marginTop: 8 }]}>
              <View style={styles.rowLeftWrap}>
                <Ionicons name="people" size={16} color={C.muted} />
                <Text secondary style={{ marginLeft: 6 }}>
                  {t("reservationStep3.partySizeLabel")}
                </Text>
              </View>
              <Text style={styles.bold}>{partySize}</Text>
            </View>
          </View>

          {/* Seçilen Fix Menüler */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t("reservationStep3.selectedMenusTitle")}
            </Text>

            {!hasFixMenuSelection ? (
              <Text secondary style={{ marginTop: 4 }}>
                {t("reservationStep3.noFixedMenusSelected")}
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {Object.entries(groups).map(([key, g]) => (
                  <View key={key} style={styles.row}>
                    <Text style={styles.rowLeft}>
                      {g.name} × {g.count}
                    </Text>
                    <Text style={styles.rowRight}>
                      {formatMoney(g.subtotal)}
                    </Text>
                  </View>
                ))}
                <View style={styles.hr} />
                <View style={styles.row}>
                  <Text secondary>{t("reservationStep3.subtotalLabel")}</Text>
                  <Text>{formatMoney(subtotal)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Depozito / Total */}
          <View style={styles.card}>
            <View style={styles.row}>
              <Text secondary>{t("reservationStep3.depositLabel")}</Text>
              <Text>{formatMoney(deposit)}</Text>
            </View>

            {hasFixMenuSelection && (
              <View style={[styles.row, { marginTop: 6 }]}>
                <Text style={styles.totalLeft}>
                  {t("reservationStep3.totalLabel")}
                </Text>
                <Text style={styles.totalRight}>
                  {formatMoney(grandTotal)}
                </Text>
              </View>
            )}
          </View>

          {/* Ödeme Yöntemi */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {t("reservationStep3.paymentMethodTitle") || "Ödeme Yöntemi"}
            </Text>

            <View style={styles.payMethodRow}>
              {/* Kart */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => hasDeposit && setPaymentMethod("card")}
                disabled={!hasDeposit}
                style={[
                  styles.payMethodBtn,
                  isCard && styles.payMethodBtnActive,
                  !hasDeposit && { opacity: 0.4 },
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={isCard ? "#fff" : C.primary}
                />
                <Text
                  style={[
                    styles.payMethodText,
                    isCard && styles.payMethodTextActive,
                  ]}
                >
                  {t("reservationStep3.methodCardShort") ||
                    t("reservationStep3.methodCard") ||
                    "Kart ile Öde"}
                </Text>
              </TouchableOpacity>

              {/* Havale */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setPaymentMethod("bank")}
                style={[
                  styles.payMethodBtn,
                  isBank && styles.payMethodBtnActive,
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={isBank ? "#fff" : C.primary}
                />
                <Text
                  style={[
                    styles.payMethodText,
                    isBank && styles.payMethodTextActive,
                  ]}
                >
                  {t("reservationStep3.methodBankTransfer") || "Havale / IBAN"}
                </Text>
              </TouchableOpacity>
            </View>

            {!hasDeposit && (
              <Text secondary style={{ marginTop: 8 }}>
                {t("reservationStep3.toastNoDepositForCard") ||
                  "Bu restoranda kart ile ödeme yok, lütfen havale ile ödeme yapın."}
              </Text>
            )}
          </View>

          {/* Ödeme Bilgileri (Bank) */}
          {isBank &&
            (restaurant?.iban || restaurant?.ibanName || restaurant?.bankName) && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  {t("reservationStep3.paymentInfoTitle")}
                </Text>

                {!!restaurant?.bankName && (
                  <View style={styles.row}>
                    <Text secondary>{t("reservationStep3.bankLabel")}</Text>
                    <Text style={styles.bold}>{restaurant.bankName}</Text>
                  </View>
                )}

                {!!restaurant?.ibanName && (
                  <View style={styles.copyRow}>
                    <View style={{ flex: 1 }}>
                      <Text secondary>
                        {t("reservationStep3.ibanNameLabel")}
                      </Text>
                      <Text style={styles.bold}>{restaurant.ibanName}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onCopy(restaurant?.ibanName)}
                      style={styles.copyBtn}
                    >
                      <Text style={styles.copyBtnText}>
                        {t("reservationStep3.copy") || "Kopyala"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!!restaurant?.iban && (
                  <View style={styles.copyRow}>
                    <View style={{ flex: 1 }}>
                      <Text secondary>{t("reservationStep3.ibanLabel")}</Text>
                      <Text style={[styles.bold, { letterSpacing: 0.4 }]}>
                        {restaurant.iban}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onCopy(restaurant?.iban)}
                      style={styles.copyBtn}
                    >
                      <Text style={styles.copyBtnText}>
                        {t("reservationStep3.copy") || "Kopyala"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text secondary style={{ marginTop: 8 }}>
                  {t("reservationStep3.depositHint")}
                </Text>
              </View>
            )}

          {/* Dekont (Bank) */}
          {isBank && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                {t("reservationStep3.receiptTitle")}
              </Text>
              <ReceiptCard
                url={receiptFile?.uri}
                onReplace={handlePickReceipt}
                replacing={false}
                canReplace={!creating && isBank}
              />
            </View>
          )}
        </ScrollView>

        {/* Sticky CTA */}
        <View
          pointerEvents="box-none"
          style={[
            styles.ctaBar,
            { paddingBottom: Math.max(16, 16 + insets.bottom) },
          ]}
        >
          <TouchableOpacity
            onPress={onPressCTA}
            disabled={ctaDisabled}
            activeOpacity={0.85}
            style={[styles.ctaBtn, ctaDisabled && styles.ctaBtnDisabled]}
          >
            <View style={styles.ctaInner}>
              <Ionicons
                name={isCard ? "card-outline" : "document-text-outline"}
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.ctaBtnText}>{ctaTitle}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Mini Toast */}
        <Modal visible={toast.visible} transparent animationType="fade">
          <View style={styles.toastWrap}>
            <View style={styles.toastCard}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {toast.text}
              </Text>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
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

  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  copyBtnText: { color: "#fff", fontWeight: "700" },

  payMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  payMethodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: "#fff",
  },
  payMethodBtnActive: {
    backgroundColor: C.primary,
  },
  payMethodText: {
    fontWeight: "700",
    color: C.primary,
    fontSize: 13,
  },
  payMethodTextActive: {
    color: "#fff",
  },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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

  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },

  toastWrap: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 24,
  },
  toastCard: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
});
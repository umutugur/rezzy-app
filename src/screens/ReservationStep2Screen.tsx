// src/screens/ReservationStep2Screen.tsx
import React from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ToastAndroid,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import { getRestaurant } from "../api/restaurants";
import { useReservation } from "../store/useReservation";
import { Ionicons } from "@expo/vector-icons";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../i18n";

/** ---- Renk Paleti (Rezvix ile uyumlu) ---- */
const C = {
  primary: "#7B2C2C",
  primaryDark: "#6B2525",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
  soft: "#F9FAFB",
};

type MenuItem = { _id: string; name: string; price: number };
type Selection = { person: number; menuId: string };

function parsePrice(input: any): number {
  if (input == null) return 0;
  if (typeof input === "number" && isFinite(input)) return input;
  if (typeof input === "string") {
    const cleaned = input
      .trim()
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}(?:[^\d]|$))/g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return isFinite(n) ? n : 0;
  }
  if (typeof input === "object") {
    const candidates = [
      (input as any).value,
      (input as any).amount,
      (input as any).price,
      (input as any).tl,
      (input as any).try,
      (input as any).TRY,
    ];
    for (const c of candidates) {
      const n = parsePrice(c);
      if (n) return n;
    }
  }
  return 0;
}

export default function ReservationStep2Screen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { restaurantId, partySize, selections, setSelection, setParty } =
    useReservation(
      useShallow((s: any) => ({
        restaurantId: s.restaurantId,
        partySize: s.partySize,
        selections: s.selections,
        setSelection: s.setSelection,
        setParty: s.setParty,
      }))
    );

  const { t } = useI18n();

  const [menus, setMenus] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

  // ✅ Fix menü seçmeden devam et
  const [skipFixedMenus, setSkipFixedMenus] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    if (!restaurantId) return;
    (async () => {
      try {
        setLoading(true);
        const d = await getRestaurant(restaurantId);
        if (!alive) return;

        const normalized: MenuItem[] = (d?.menus || []).map((m: any, idx: number) => ({
          _id: String(m?._id ?? m?.id ?? m?.key ?? idx),
          name: String(m?.name ?? m?.title ?? m?.label ?? `Menü ${idx + 1}`),
          price: parsePrice(
            m?.pricePerPerson ??
              m?.price_per_person ??
              m?.price ??
              m?.amount ??
              m?.cost ??
              m?.pricing
          ),
        }));

        setMenus(normalized);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        console.log("[ReservationStep2] menu load error", e?.message);
        setError("load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  useFocusEffect(
    React.useCallback(() => {
      // Ekrana her odaklanıldığında reset
      setResetting(true);
      setTouched(false);
      setSkipFixedMenus(false);

      // Aynı partySize ile boş selections kur (store tarafında resetleniyorsa bile sorun değil)
      setParty(partySize);

      const id = setTimeout(() => setResetting(false), 0);
      return () => clearTimeout(id);
    }, [partySize, restaurantId, setParty])
  );

  const formatTL = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(isFinite(n) ? n : 0);

  const getSelectedFor = (personIndex: number) =>
    (selections as Selection[]).find((s: Selection) => s.person === personIndex)
      ?.menuId;

  const allSelected = React.useMemo(() => {
    const arr = (selections as Selection[]) || [];
    if (arr.length !== partySize) return false;
    return arr.every((s) => typeof s.menuId === "string" && s.menuId.length > 0);
  }, [selections, partySize]);

  const onSelect = (personIndex: number, menuId: string) => {
    if (skipFixedMenus) return;
    setSelection(personIndex, menuId);
    setTouched(true);
  };

  const scrollPadBottom = insets.bottom + 88;

  const handleContinue = React.useCallback(() => {
    if (!skipFixedMenus && !allSelected) {
      const msg = t("reservationStep2.toastAllRequired");
      if (Platform.OS === "android") {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert(t("reservationStep2.missingTitle"), msg);
      }
      return;
    }
    nav.navigate("Rezervasyon - Özet");
  }, [skipFixedMenus, allSelected, nav, t]);

  // ✅ selections temizleme helper
  const clearSelections = React.useCallback(() => {
    for (let i = 1; i <= partySize; i++) {
      setSelection(i, "");
    }
  }, [partySize, setSelection]);

  // ✅ FIX: functional updater içinde side-effect yok
  const toggleSkip = () => {
    const next = !skipFixedMenus;

    setSkipFixedMenus(next);   // sadece state değiştir
    clearSelections();         // side effectler dışarıda
    setTouched(next);          // skip açıldıysa devam edebilsin, kapandıysa tekrar seçim istesin
  };

  const canContinue =
    !resetting && (skipFixedMenus || (touched && allSelected));

  return (
    <Screen topPadding="flat" style={{ backgroundColor: C.bg }}>
      {/* Başlık Bloğu */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="restaurant" size={24} color={C.primary} />
          <Text style={styles.headerTitle}>{t("reservationStep2.title")}</Text>
        </View>
        <Text secondary style={styles.headerSub}>
          {t("reservationStep2.subtitle")}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text secondary style={{ marginTop: 8 }}>
            {t("reservationStep2.loading")}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
          <Text secondary style={{ marginTop: 8 }}>
            {t("reservationStep2.loadError")}
          </Text>
        </View>
      ) : menus.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="fast-food-outline" size={48} color={C.muted} />
          <Text secondary style={{ marginTop: 8 }}>
            {t("reservationStep2.emptyMenus")}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }}>
            {/* Fix menü istemiyorum seçeneği */}
            <Pressable onPress={toggleSkip} style={styles.skipCard}>
              <View style={styles.skipLeft}>
                <View
                  style={[
                    styles.checkbox,
                    skipFixedMenus && styles.checkboxActive,
                  ]}
                >
                  {skipFixedMenus && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skipTitle}>
                    {t("reservationStep2.skipFixedMenus")}
                  </Text>
                  <Text secondary style={styles.skipSub}>
                    {t("reservationStep2.skipFixedMenusHelp")}
                  </Text>
                </View>
              </View>

              <Ionicons
                name={skipFixedMenus ? "lock-open-outline" : "lock-closed-outline"}
                size={18}
                color={skipFixedMenus ? C.primary : C.muted}
              />
            </Pressable>

            {!skipFixedMenus &&
              Array.from({ length: partySize }).map((_, i) => {
                const personIndex = i + 1;
                const selected = getSelectedFor(personIndex);
                return (
                  <View key={personIndex} style={styles.personCard}>
                    <View style={styles.personHeader}>
                      <View style={styles.personBadge}>
                        <Ionicons name="person" size={14} color="#fff" />
                        <Text style={styles.personBadgeText}>
                          {personIndex}
                        </Text>
                      </View>
                      <Text style={styles.personTitle}>
                        {t("reservationStep2.personTitle", {
                          index: personIndex,
                        })}
                      </Text>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      {menus.map((m, idx) => {
                        const isSelected = selected === m._id;
                        return (
                          <TouchableOpacity
                            key={`${personIndex}-${m._id}`}
                            onPress={() => onSelect(personIndex, m._id)}
                            activeOpacity={0.9}
                            style={[
                              styles.menuRow,
                              idx > 0 && styles.menuRowDivider,
                              isSelected && styles.menuRowActive,
                            ]}
                          >
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text style={styles.menuName} numberOfLines={1}>
                                {m.name}
                              </Text>
                              <Text secondary style={styles.menuPrice}>
                                {formatTL(m.price)}
                              </Text>
                            </View>

                            <View
                              style={[styles.radio, isSelected && styles.radioActive]}
                            >
                              {isSelected && <View style={styles.radioDot} />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

            {skipFixedMenus && (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle-outline" size={18} color={C.muted} />
                <Text secondary style={{ flex: 1 }}>
                  {t("reservationStep2.skipInfo")}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* CTA Bar */}
          <View
            pointerEvents="box-none"
            style={[styles.ctaBar, { paddingBottom: 12 + insets.bottom }]}
          >
            <Button
              title={t("reservationStep2.ctaContinue")}
              onPress={handleContinue}
              disabled={!canContinue}
              accessibilityLabel={t("reservationStep2.ctaContinue")}
              testID="step2-continue-button"
            />
          </View>
        </>
      )}
    </Screen>
  );
}

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

  center: { alignItems: "center", marginTop: 24 },

  skipCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skipLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  skipTitle: { fontWeight: "800", color: C.text, fontSize: 15 },
  skipSub: { marginTop: 2, fontSize: 12 },

  personCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  personHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  personBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  personBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  personTitle: { fontWeight: "800", color: C.text, fontSize: 16 },

  menuRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuRowDivider: { borderTopWidth: 1, borderTopColor: C.border },
  menuRowActive: {
    backgroundColor: "#FFF8F8",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  menuName: { fontWeight: "700", color: C.text, fontSize: 15 },
  menuPrice: { marginTop: 2 },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: C.primary, backgroundColor: C.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },

  infoCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
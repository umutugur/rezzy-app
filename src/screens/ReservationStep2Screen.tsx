import React from "react";
import { View, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Platform, Alert, ToastAndroid } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import { getRestaurant } from "../api/restaurants";
import { useReservation } from "../store/useReservation";
import { Ionicons } from "@expo/vector-icons";
import { useShallow } from "zustand/react/shallow";

/** ---- Renk Paleti (Rezzy ile uyumlu) ---- */
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
  const { restaurantId, partySize, selections, setSelection, setParty } = useReservation(
    useShallow((s: any) => ({
      restaurantId: s.restaurantId,
      partySize: s.partySize,
      selections: s.selections,
      setSelection: s.setSelection,
      setParty: s.setParty,
    }))
  );

  const [menus, setMenus] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState(true);
  const [touched, setTouched] = React.useState(false);

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
        setError(e?.message ?? "Menüler yüklenemedi");
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
      // Ekrana her odaklanıldığında selections'ı sıfırla
      setResetting(true);
      setTouched(false);
      // Aynı partySize ile boş selections kur (menuId="")
      setParty(partySize);
      // Bir sonraki microtask'te butonu tekrar değerlendirelim
      setTimeout(() => setResetting(false), 0);
      return () => {};
    }, [partySize, restaurantId, setParty])
  );

  const formatTL = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(isFinite(n) ? n : 0);

  const getSelectedFor = (personIndex: number) =>
    (selections as Selection[]).find((s: Selection) => s.person === personIndex)?.menuId;

  const allSelected = React.useMemo(() => {
    const arr = (selections as Selection[]) || [];
    if (arr.length !== partySize) return false;
    return arr.every((s) => typeof s.menuId === "string" && s.menuId.length > 0);
  }, [selections, partySize]);

  const onSelect = (personIndex: number, menuId: string) => {
    setSelection(personIndex, menuId);
    setTouched(true);
  };

  const scrollPadBottom = insets.bottom + 88;

  const handleContinue = React.useCallback(() => {
    // Ek güvenlik: iOS/Android — disabled bypass’ını engelle
    if (!allSelected) {
      if (Platform.OS === "android") {
        ToastAndroid.show("Lütfen tüm kişiler için menü seçin.", ToastAndroid.SHORT);
      } else {
        Alert.alert("Eksik seçim", "Lütfen tüm kişiler için menü seçin.");
      }
      return;
    }
    nav.navigate("Rezervasyon - Özet");
  }, [allSelected, nav]);

  return (
    <Screen topPadding="flat" style={{ backgroundColor: C.bg }}>
      {/* Başlık Bloğu */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="restaurant" size={24} color={C.primary} />
          <Text style={styles.headerTitle}>Kişi & Menü Seçimi</Text>
        </View>
        <Text secondary style={styles.headerSub}>Her kişi için bir menü seçin.</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text secondary style={{ marginTop: 8 }}>Menüler yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#E53935" />
          <Text secondary style={{ marginTop: 8 }}>Hata: {error}</Text>
        </View>
      ) : menus.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="fast-food-outline" size={48} color={C.muted} />
          <Text secondary style={{ marginTop: 8 }}>Bu restoran için menü tanımlı değil.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }}>
            {Array.from({ length: partySize }).map((_, i) => {
              const personIndex = i + 1;
              const selected = getSelectedFor(personIndex);
              return (
                <View key={personIndex} style={styles.personCard}>
                  <View style={styles.personHeader}>
                    <View style={styles.personBadge}>
                      <Ionicons name="person" size={14} color="#fff" />
                      <Text style={styles.personBadgeText}>{personIndex}</Text>
                    </View>
                    <Text style={styles.personTitle}>Kişi {personIndex}</Text>
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
                            <Text style={styles.menuName} numberOfLines={1}>{m.name}</Text>
                            <Text secondary style={styles.menuPrice}>{formatTL(m.price)}</Text>
                          </View>

                          {/* Radio */}
                          <View style={[styles.radio, isSelected && styles.radioActive]}>
                            {isSelected && <View style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* CTA Bar */}
          <View
            pointerEvents="box-none"
            style={[
              styles.ctaBar,
              { paddingBottom: 12 + insets.bottom }
            ]}
          >
            <Button
              title="Devam"
              onPress={handleContinue}
              disabled={resetting || !touched || !allSelected}
              accessibilityLabel="Devam"
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
  },
  headerSub: {
    marginTop: 6,
  },

  center: { alignItems: "center", marginTop: 24 },

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
  menuRowDivider: {
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
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
    backgroundColor: "transparent",
  },
  radioActive: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },

  ctaBar: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
});
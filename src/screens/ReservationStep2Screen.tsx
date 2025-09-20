// src/screens/ReservationStep2Screen.tsx
import React from "react";
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import { getRestaurant } from "../api/restaurants";
import { useReservation } from "../store/useReservation";

type MenuItem = { _id: string; name: string; price: number };

// Farklı formatları sayıya çevir (₺500, 500,00, {value:500}, "1.200,50" vs.)
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
  const nav = useNavigation<any>();
  const { restaurantId, partySize, selections, setSelection } = useReservation();

  const [menus, setMenus] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  const formatTL = (n: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(isFinite(n) ? n : 0);

  const getSelectedFor = (personIndex: number) =>
    selections.find((s) => s.person === personIndex)?.menuId;

  const allSelected =
    selections.length === partySize && selections.every((s) => !!s.menuId);

  const onSelect = (personIndex: number, menuId: string) => {
    useReservation.getState().setSelection(personIndex, menuId);
  };

  return (
    <Screen>
      <View style={{ paddingBottom: 12 }}>
        <Text style={{ fontWeight: "800", fontSize: 18 }}>Kişi & Menü Seçimi</Text>
        <Text secondary style={{ marginTop: 4 }}>Her kişi için bir menü seçin.</Text>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <ActivityIndicator />
          <Text secondary style={{ marginTop: 8 }}>Menüler yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <Text secondary>Hata: {error}</Text>
        </View>
      ) : menus.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <Text secondary>Bu restoran için menü tanımlı değil.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
            {Array.from({ length: partySize }).map((_, i) => {
              const personIndex = i + 1;
              const selected = getSelectedFor(personIndex);
              return (
                <View
                  key={personIndex}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: "#F3F4F6",
                    shadowColor: "#000",
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                    Kişi {personIndex}
                  </Text>

                  {menus.map((m) => {
                    const isSelected = selected === m._id;
                    return (
                      <TouchableOpacity
                        key={`${personIndex}-${m._id}`}
                        onPress={() => onSelect(personIndex, m._id)}
                        activeOpacity={0.9}
                        style={{
                          paddingVertical: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontWeight: "700" }} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text secondary style={{ marginTop: 2 }}>
                            {formatTL(m.price)}
                          </Text>
                        </View>

                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 999,
                            borderWidth: 2,
                            borderColor: isSelected ? "#7C2D12" : "#D1D5DB",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isSelected ? "#7C2D12" : "transparent",
                          }}
                        >
                          {isSelected ? (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                backgroundColor: "#fff",
                              }}
                            />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: 12,
              backgroundColor: "rgba(255,255,255,0.92)",
              borderTopWidth: 1,
              borderTopColor: "#E5E7EB",
            }}
          >
            <Button
              title="Devam"
              onPress={() => nav.navigate("Rezervasyon - Özet")}
              disabled={!allSelected}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

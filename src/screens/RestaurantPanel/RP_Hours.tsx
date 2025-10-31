import React from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { rp } from "./rpStyles";
import { getRestaurant, updateOpeningHours, type OpeningHour } from "../../api/restaurants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
type Props = NativeStackScreenProps<RestaurantPanelParams, "Hours">;

export default function RP_Hours({ route }: Props) {
  const { restaurantId } = route.params;

  const [hours, setHours] = React.useState<OpeningHour[]>(
    Array.from({ length: 7 }, (_, i) => ({ day: i, open: "10:00", close: "23:00", isClosed: false }))
  );

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      const r = await getRestaurant(restaurantId);
      if (ignore) return;
      setHours(Array.isArray(r.openingHours) && r.openingHours.length === 7 ? r.openingHours : hours);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Çalışma Saatleri</Text>

        {hours.map((h, idx) => (
          <View key={idx} style={{ marginBottom: 10 }}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>{DAYS[h.day]}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[rp.input, { flex: 1 }]}
                value={h.open}
                onChangeText={(v) => {
                  const next = [...hours];
                  next[idx] = { ...next[idx], open: v };
                  setHours(next);
                }}
                placeholder="10:00"
              />
              <TextInput
                style={[rp.input, { flex: 1 }]}
                value={h.close}
                onChangeText={(v) => {
                  const next = [...hours];
                  next[idx] = { ...next[idx], close: v };
                  setHours(next);
                }}
                placeholder="23:00"
              />
              <TouchableOpacity
                style={rp.btnMuted}
                onPress={() => {
                  const next = [...hours];
                  next[idx] = { ...next[idx], isClosed: !h.isClosed };
                  setHours(next);
                }}
              >
                <Text style={rp.btnMutedText}>{h.isClosed ? "Açık Yap" : "Kapalı Gün"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 8 }]}
          onPress={async () => {
            try {
              await updateOpeningHours(restaurantId, hours);
              Alert.alert("Başarılı", "Saatler güncellendi.");
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "Saatler güncellenemedi.");
            }
          }}
        >
          <Text style={rp.btnPrimaryText}>Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
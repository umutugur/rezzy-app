import React from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { rp } from "./rpStyles";
import { getRestaurant, updateTables } from "../../api/restaurants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Tables">;
type TableItem = { name: string; capacity: number; isActive?: boolean };

export default function RP_Tables({ route }: Props) {
  const { restaurantId } = route.params;
  const [tables, setTables] = React.useState<TableItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (ignore) return;
        setTables(Array.isArray(r.tables) ? r.tables : []);
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [restaurantId]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Masalar</Text>

        {tables.length === 0 ? <Text style={rp.muted}>Kayıt yok.</Text> : null}

        {tables.map((t, idx) => (
          <View key={idx} style={[rp.card, { padding: 12 }]}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Ad</Text>
            <TextInput
              style={rp.input}
              value={t.name}
              onChangeText={(v) => {
                const next = [...tables];
                next[idx] = { ...next[idx], name: v };
                setTables(next);
              }}
            />
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Kapasite</Text>
            <TextInput
              style={rp.input}
              keyboardType="numeric"
              value={String(t.capacity)}
              onChangeText={(v) => {
                const next = [...tables];
                next[idx] = { ...next[idx], capacity: Math.max(1, parseInt(v || "1", 10)) };
                setTables(next);
              }}
            />
            <TouchableOpacity
              style={[rp.btnMuted, { marginTop: 6 }]}
              onPress={() => {
                const next = [...tables];
                next[idx] = { ...next[idx], isActive: !(t.isActive ?? true) };
                setTables(next);
              }}
            >
              <Text style={rp.btnMutedText}>{t.isActive === false ? "Aktifleştir" : "Pasifleştir"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[rp.btnDanger, { marginTop: 6 }]}
              onPress={() => setTables((prev) => prev.filter((_, i) => i !== idx))}
            >
              <Text style={rp.btnDangerText}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 8 }]}
          onPress={() => setTables((t) => [...t, { name: `Masa ${t.length + 1}`, capacity: 2, isActive: true }])}
        >
          <Text style={rp.btnPrimaryText}>+ Masa Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 10 }]}
          onPress={async () => {
            try {
              await updateTables(restaurantId, tables);
              Alert.alert("Başarılı", "Masalar güncellendi.");
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "Masalar güncellenemedi.");
            }
          }}
        >
          <Text style={rp.btnPrimaryText}>Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
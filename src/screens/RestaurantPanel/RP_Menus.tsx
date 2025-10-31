import React from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { rp } from "./rpStyles";
import { getRestaurant, updateMenus } from "../../api/restaurants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Menus">;

type MenuItem = { title: string; description?: string; pricePerPerson: number; isActive?: boolean };

export default function RP_Menus({ route }: Props) {
  const { restaurantId } = route.params;

  const [menus, setMenus] = React.useState<MenuItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (ignore) return;
        setMenus(
          Array.isArray(r.menus)
            ? r.menus.map((m: any) => ({
                title: m.title ?? m.name ?? "",
                description: m.description ?? "",
                pricePerPerson: Number(m.pricePerPerson ?? m.price ?? 0),
                isActive: m.isActive ?? true,
              }))
            : []
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [restaurantId]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Menüler</Text>

        {menus.length === 0 ? <Text style={rp.muted}>Kayıt yok.</Text> : null}

        {menus.map((m, idx) => (
          <View key={idx} style={[rp.card, { padding: 12 }]}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Menü Adı</Text>
            <TextInput
              style={rp.input}
              value={m.title}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], title: v };
                setMenus(next);
              }}
            />
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Açıklama</Text>
            <TextInput
              style={[rp.input, { height: 90 }]}
              multiline
              value={m.description ?? ""}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], description: v };
                setMenus(next);
              }}
            />
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Fiyat (kişi)</Text>
            <TextInput
              style={rp.input}
              value={String(m.pricePerPerson)}
              keyboardType="numeric"
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], pricePerPerson: Number(v || "0") };
                setMenus(next);
              }}
            />

            <TouchableOpacity
              style={[rp.btnMuted, { marginTop: 6 }]}
              onPress={() => setMenus((prev) => prev.filter((_, i) => i !== idx))}
            >
              <Text style={rp.btnMutedText}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 8 }]}
          onPress={() =>
            setMenus((m) => [...m, { title: "Yeni Menü", description: "", pricePerPerson: 0, isActive: true }])
          }
        >
          <Text style={rp.btnPrimaryText}>+ Menü Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 10 }]}
          onPress={async () => {
            try {
              await updateMenus(restaurantId, menus);
              Alert.alert("Başarılı", "Menüler güncellendi.");
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "Menüler güncellenemedi.");
            }
          }}
        >
          <Text style={rp.btnPrimaryText}>Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
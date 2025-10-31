import React from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { rp } from "./rpStyles";
import { getRestaurant, updatePolicies } from "../../api/restaurants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Policies">;

export default function RP_Policies({ route }: Props) {
  const { restaurantId } = route.params;

  const [form, setForm] = React.useState<any>({
    minPartySize: 1,
    maxPartySize: 8,
    slotMinutes: 90,
    depositRequired: false,
    depositAmount: 0,
    blackoutDates: [] as string[],
    checkinWindowBeforeMinutes: 15,
    checkinWindowAfterMinutes: 90,
  });
  const [newBlackout, setNewBlackout] = React.useState("");

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      const r = await getRestaurant(restaurantId);
      if (ignore) return;
      setForm({
        minPartySize: r.minPartySize ?? 1,
        maxPartySize: r.maxPartySize ?? 8,
        slotMinutes: r.slotMinutes ?? 90,
        depositRequired: !!r.depositRequired,
        depositAmount: r.depositAmount ?? 0,
        blackoutDates: Array.isArray(r.blackoutDates) ? r.blackoutDates : [],
        checkinWindowBeforeMinutes:
          typeof r.checkinWindowBeforeMinutes === "number" ? r.checkinWindowBeforeMinutes : 15,
        checkinWindowAfterMinutes:
          typeof r.checkinWindowAfterMinutes === "number" ? r.checkinWindowAfterMinutes : 90,
      });
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Rezervasyon Politikaları</Text>

        {[
          ["minPartySize", "Minimum kişi", "numeric"],
          ["maxPartySize", "Maksimum kişi", "numeric"],
          ["slotMinutes", "Slot süresi (dk)", "numeric"],
          ["checkinWindowBeforeMinutes", "Check-in penceresi (ÖNCE, dk)", "numeric"],
          ["checkinWindowAfterMinutes", "Check-in penceresi (SONRA, dk)", "numeric"],
        ].map(([k, label, type]) => (
          <View key={k as string}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>{label}</Text>
            <TextInput
              style={rp.input}
              keyboardType={type as any}
              value={String(form[k as string] ?? "")}
              onChangeText={(v) =>
                setForm((f: any) => ({
                  ...f,
                  [k as string]: Math.max(0, parseInt(v || "0", 10)),
                }))
              }
            />
          </View>
        ))}

        <TouchableOpacity
          style={rp.btnMuted}
          onPress={() => setForm((f: any) => ({ ...f, depositRequired: !f.depositRequired }))}
        >
          <Text style={rp.btnMutedText}>{form.depositRequired ? "Depozito: Açık" : "Depozito: Kapalı"}</Text>
        </TouchableOpacity>

        {form.depositRequired && (
          <>
            <Text style={{ color: "#6b7280", marginTop: 8, marginBottom: 6 }}>Depozito Tutarı (₺)</Text>
            <TextInput
              style={rp.input}
              keyboardType="numeric"
              value={String(form.depositAmount ?? 0)}
              onChangeText={(v) =>
                setForm((f: any) => ({ ...f, depositAmount: Math.max(0, parseFloat(v || "0")) }))
              }
            />
          </>
        )}

        <Text style={{ color: "#6b7280", marginTop: 10, marginBottom: 6 }}>Kara Günler (YYYY-MM-DD)</Text>
        {form.blackoutDates?.length ? (
          <FlatList
            data={form.blackoutDates}
            horizontal
            keyExtractor={(it, i) => `${it}-${i}`}
            renderItem={({ item, index }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#f2f2f2",
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  marginRight: 8,
                }}
              >
                <Text>{item}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setForm((f: any) => ({
                      ...f,
                      blackoutDates: f.blackoutDates.filter((_: any, i: number) => i !== index),
                    }))
                  }
                >
                  <Text style={{ marginLeft: 8, color: "#dc2626", fontWeight: "700" }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <Text style={rp.muted}>Liste boş.</Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
          <TextInput
            style={[rp.input, { flex: 1, marginBottom: 0 }]}
            placeholder="2025-12-31"
            value={newBlackout}
            onChangeText={setNewBlackout}
          />
        </View>

        <TouchableOpacity
          style={rp.btnMuted}
          onPress={() => {
            const v = newBlackout.trim();
            if (v && !form.blackoutDates.includes(v)) {
              setForm((f: any) => ({ ...f, blackoutDates: [...f.blackoutDates, v] }));
              setNewBlackout("");
            }
          }}
        >
          <Text style={rp.btnMutedText}>Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 10 }]}
          onPress={async () => {
            try {
              const payload = {
                minPartySize: Math.max(1, form.minPartySize),
                maxPartySize: Math.max(form.minPartySize, form.maxPartySize),
                slotMinutes: Math.max(30, form.slotMinutes),
                depositRequired: !!form.depositRequired,
                depositAmount: Math.max(0, form.depositAmount),
                blackoutDates: form.blackoutDates,
                checkinWindowBeforeMinutes: Math.max(0, form.checkinWindowBeforeMinutes),
                checkinWindowAfterMinutes: Math.max(0, form.checkinWindowAfterMinutes),
              };
              await updatePolicies(restaurantId, payload);
              Alert.alert("Başarılı", "Politikalar güncellendi.");
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "Politikalar güncellenemedi.");
            }
          }}
        >
          <Text style={rp.btnPrimaryText}>Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
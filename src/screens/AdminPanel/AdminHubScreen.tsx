import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AdminPanelParams } from "../../navigation/AdminPanelNavigator";

type Props = NativeStackScreenProps<AdminPanelParams, "AdminHub">;

export default function AdminHubScreen({ navigation }: Props) {
  const { bottom } = useSafeAreaInsets();

  const items: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: keyof AdminPanelParams;
  }> = [
    { label: "Genel KPI", icon: "analytics-outline", route: "AdminGeneral" },
    { label: "Restoranlar", icon: "business-outline", route: "AdminRestaurants" },
    { label: "Rezervasyonlar", icon: "calendar-outline", route: "AdminReservations" },
    { label: "Kullanıcılar", icon: "people-outline", route: "AdminUsers" },
    { label: "Yorum & Şikayet", icon: "chatbox-ellipses-outline", route: "AdminFeedback" },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottom + 16 }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.route)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate(item.route as any)}>
            <Ionicons name={item.icon} size={32} color={"#7B2C2C"} />
            <Text style={styles.cardText}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 28,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    elevation: 3,
  },
  cardText: { fontSize: 14, fontWeight: "600", color: "#222", textAlign: "center" },
});
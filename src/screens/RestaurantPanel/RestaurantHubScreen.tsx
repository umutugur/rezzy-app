// src/screens/RestaurantPanel/RestaurantHubScreen.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { panel } from "../../theme/panelTheme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "RestaurantHub">;

export default function RestaurantHubScreen({ navigation, route }: Props) {
  const { bottom } = useSafeAreaInsets();

  // Parametreyi güvenli şekilde al
  const restaurantId =
    route?.params?.restaurantId ?? (route?.params as any)?.id ?? "";

  // Parametre yoksa kullanıcıya mesaj göster (crash olmasın)
  if (!restaurantId) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center", padding: 16 },
        ]}
      >
        <Text style={{ color: "#6b7280", textAlign: "center" }}>
          Panel başlatma parametresi eksik. Lütfen RestaurantPanel'e geçişte
          {" { restaurantId } "} gönderin.
        </Text>
      </View>
    );
  }

  const items: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: keyof RestaurantPanelParams;
  }> = [
    { label: "Özet", icon: "analytics-outline", route: "Dashboard" },
    { label: "Rezervasyonlar", icon: "calendar-outline", route: "Reservations" },
    { label: "Genel Bilgiler", icon: "information-circle-outline", route: "General" },
    { label: "Fotoğraflar", icon: "images-outline", route: "Photos" },
    { label: "Menüler", icon: "restaurant-outline", route: "Menus" },
    { label: "Masalar", icon: "grid-outline", route: "Tables" },
    { label: "Çalışma Saatleri", icon: "time-outline", route: "Hours" },
    { label: "Politikalar", icon: "shield-checkmark-outline", route: "Policies" },
  ];

  return (
    <View style={[styles.container, { paddingBottom: bottom + 16 }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.route)}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(item.route as any, { restaurantId })}
          >
            <Ionicons name={item.icon} size={32} color={panel.colors.brand} />
            <Text style={styles.cardText}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: panel.colors.bg,
  },
  card: {
    width: "48%",
    backgroundColor: "#fff",
    paddingVertical: 28,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: panel.colors.border,
    elevation: 3,
  },
  cardText: {
    fontSize: 14,
    fontWeight: "600",
    color: panel.colors.text,
    textAlign: "center",
  },
});
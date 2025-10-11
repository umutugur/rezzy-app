import React from "react";
import { ScrollView, Text, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>İletişim</Text>
      <Text style={{ marginBottom: 8 }}>Destek ve öneriler için e-posta:</Text>
      <Text style={{ color: "#2563EB", marginBottom: 12 }} onPress={() => Linking.openURL("mailto:destek@rezzy.app")}>
        destek@rezzy.app
      </Text>
      <Text>Hafta içi 09:00–18:00 arasında yanıtlıyoruz.</Text>
    </ScrollView>
  );
}
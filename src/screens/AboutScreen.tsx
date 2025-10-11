import React from "react";
import { ScrollView, Text } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? "-";
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Hakkında</Text>
      <Text>Rezzy, restoran rezervasyon deneyimini kolaylaştırır.</Text>
      <Text style={{ marginTop: 8 }}>Sürüm: {version}</Text>
    </ScrollView>
  );
}
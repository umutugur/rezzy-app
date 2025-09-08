import React from "react";
import { View } from "react-native";
import { Text } from "./Themed";

export default function EmptyState({ text = "Bu filtre için sonuç yok." }) {
  return (
    <View style={{ alignItems: "center", marginTop: 40, opacity: 0.8 }}>
      <Text style={{ fontSize: 28 }}>🍽️</Text>
      <Text secondary style={{ marginTop: 8 }}>{text}</Text>
    </View>
  );
}

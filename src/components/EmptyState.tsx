import React from "react";
import { View } from "react-native";
import { Text } from "./Themed";
import { useI18n } from "../i18n";

export default function EmptyState({ text = "common.noResults" }) {
  const { t } = useI18n();

  return (
    <View style={{ alignItems: "center", marginTop: 40, opacity: 0.8 }}>
      <Text style={{ fontSize: 28 }}>🍽️</Text>
      <Text secondary style={{ marginTop: 8 }}>{t(text)}</Text>
    </View>
  );
}

import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "./Themed";

type Tab = "all" | "pending" | "confirmed" | "rejected" | "canceled";

export default function FilterTabs({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (v: Tab) => void;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "pending", label: "Bekleyen" },
    { key: "confirmed", label: "Onaylandı" },
    { key: "rejected", label: "Reddedildi" },
    { key: "canceled", label: "İptal" },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }} style={{ marginBottom: 10 }}>
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
  backgroundColor: active ? "#111827" : "#F3F4F6",
  borderWidth: active ? 0 : 1,
  borderColor: "#E5E7EB",
}}
          >
            <Text style={{ color: active ? "#fff" : "#111827", fontWeight: "700", fontSize: 13 }}>
  {t.label}
</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

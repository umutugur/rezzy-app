import React from "react";
import { TouchableOpacity, ScrollView } from "react-native";
import { Text } from "./Themed";

export type TimeTab = "upcoming" | "past" | "all";

export default function TimeTabs({
  value,
  onChange,
}: {
  value: TimeTab;
  onChange: (v: TimeTab) => void;
}) {
  const tabs: { key: TimeTab; label: string }[] = [
    { key: "upcoming", label: "Yaklaşan" },
    { key: "past", label: "Geçmiş" },
    { key: "all", label: "Tümü" },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }} style={{ marginBottom: 10 }}>
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            // her iki dosyada da buton stilini şöyle yap:
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

import React from "react";
import { View } from "react-native";
import { Text } from "./Themed";

type Props = { status: string; size?: "sm" | "md" };

const MAP: Record<
  string,
  { bg: string; fg: string; label: string; dot: string }
> = {
  pending:   { bg: "#FFF7ED", fg: "#9A3412", label: "Onay bekliyor", dot: "#FB923C" },
  confirmed: { bg: "#ECFDF5", fg: "#065F46", label: "Onaylandı",     dot: "#34D399" },
  rejected:  { bg: "#FEF2F2", fg: "#7F1D1D", label: "Reddedildi",    dot: "#FCA5A5" },
  canceled:  { bg: "#F3F4F6", fg: "#374151", label: "İptal",         dot: "#9CA3AF" },
};

export default function StatusBadge({ status, size="md" }: Props) {
  const s = MAP[status] || { bg: "#EEF2FF", fg: "#3730A3", label: status, dot: "#A5B4FC" };
  const padV = size === "sm" ? 4 : 6;
  const padH = size === "sm" ? 10 : 12;
  return (
    <View style={{ alignSelf:"flex-start", backgroundColor: s.bg, paddingHorizontal: padH, paddingVertical: padV, borderRadius: 999, flexDirection:"row", gap:8, alignItems:"center" }}>
      <View style={{ width:8, height:8, borderRadius:999, backgroundColor: s.dot }} />
      <Text style={{ color: s.fg, fontWeight:"700" }}>{s.label}</Text>
    </View>
  );
}

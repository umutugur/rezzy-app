import React from "react";
import { View } from "react-native";
import { Text } from "./Themed";
import { useI18n } from "../i18n";

type Props = { status: string; size?: "sm" | "md" };

// Sadece renk / stil haritası, metinler i18n'den gelecek
const MAP: Record<string, { bg: string; fg: string; dot: string }> = {
  pending:  { bg: "#FFF7ED", fg: "#9A3412", dot: "#FB923C" },
  confirmed:{ bg: "#ECFDF5", fg: "#065F46", dot: "#34D399" },
  rejected: { bg: "#FEF2F2", fg: "#7F1D1D", dot: "#FCA5A5" },
  cancelled:{ bg: "#F3F4F6", fg: "#374151", dot: "#9CA3AF" },
  // Güvenlik için "canceled" (tek L) de aynı görünsün
  canceled: { bg: "#F3F4F6", fg: "#374151", dot: "#9CA3AF" },
};

export default function StatusBadge({ status, size = "md" }: Props) {
  const { t } = useI18n();

  // Backend'den gelebilecek "canceled" → i18n anahtarımız "cancelled"
  const normalized = status === "canceled" ? "cancelled" : status;

  const meta = MAP[normalized] || {
    bg: "#EEF2FF",
    fg: "#3730A3",
    dot: "#A5B4FC",
  };

  const padV = size === "sm" ? 4 : 6;
  const padH = size === "sm" ? 10 : 12;

  // i18n'den status etiketi: status.pending, status.confirmed, vs.
  // Çeviri bulunamazsa, ham status değeri gösterilecek.
  const label =
    t(`status.${normalized}`, {
      defaultValue: normalized,
    }) || normalized;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: meta.bg,
        paddingHorizontal: padH,
        paddingVertical: padV,
        borderRadius: 999,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: meta.dot,
        }}
      />
      <Text style={{ color: meta.fg, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

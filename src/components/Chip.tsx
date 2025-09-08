import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Themed";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "solid" | "outline";
  disabled?: boolean;
};

const BRAND = "#7C2D12";

export default function Chip({ title, onPress, variant="outline", disabled }: Props) {
  const solid = variant === "solid";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: solid ? 0 : 1,
        borderColor: disabled ? "#E5E7EB" : BRAND,
        backgroundColor: disabled ? "#F3F4F6" : (solid ? BRAND : "#fff"),
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ fontWeight: "700", fontSize: 13, color: solid ? "#fff" : BRAND }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

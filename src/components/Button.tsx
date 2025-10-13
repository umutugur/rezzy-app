import React from "react";
import { Pressable, ActivityIndicator } from "react-native";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

type Variant = "primary" | "outline" | "ghost" | "danger";

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: Variant;
  disabled?: boolean;
};

export default function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  disabled,
}: Props) {
  const base = {
    paddingVertical: 14,
    borderRadius: lightTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
  } as const;

  // renk/border mantığı
  let backgroundColor = "transparent";
  let borderWidth = 0;
  let borderColor = "transparent";
  let textColor = lightTheme.colors.primary;

  if (variant === "primary") {
    backgroundColor = disabled ? "#A8A8A8" : lightTheme.colors.primary;
    textColor = "#fff";
  } else if (variant === "outline") {
    backgroundColor = "transparent";
    borderWidth = 1;
    borderColor = lightTheme.colors.primary;
    textColor = lightTheme.colors.primary;
  } else if (variant === "ghost") {
    backgroundColor = "transparent";
    textColor = lightTheme.colors.primary;
  } else if (variant === "danger") {
    backgroundColor = disabled ? "#F87171" : "#DC2626";
    textColor = "#fff";
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        base,
        {
          backgroundColor,
          borderWidth,
          borderColor,
          opacity: disabled || loading ? 0.6 : pressed ? 0.95 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontWeight: "600" }}>{title}</Text>
      )}
    </Pressable>
  );
}
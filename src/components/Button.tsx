import React from "react";
import { Pressable, ActivityIndicator, ViewStyle, TextStyle, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  testID?: string;
  haptic?: boolean;
  hitSlop?: number | { top: number; bottom: number; left: number; right: number };
};

export default function Button({
  title,
  onPress,
  loading = false,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
  haptic = false,
  hitSlop = 6,
}: Props) {
  const tokens = lightTheme;

  // 🔒 Hem disabled hem de loading durumunda kilitle
  const isDisabled = disabled || loading;

  const sz = (() => {
    switch (size) {
      case "sm": return { height: 40, padH: 12, text: 14, radius: tokens.radius.md };
      case "lg": return { height: 56, padH: 18, text: 16, radius: tokens.radius.lg };
      default:   return { height: 48, padH: 16, text: 15, radius: tokens.radius.lg };
    }
  })();

  const palette = (() => {
    const c = tokens.colors;
    const disabledBg = "#D1D5DB";
    const disabledText = "#9CA3AF";
    const common = { borderWidth: 0, borderColor: "transparent" as string };
    if (isDisabled) return { ...common, bg: disabledBg, text: disabledText, ripple: undefined as any };
    switch (variant) {
      case "primary":   return { ...common, bg: c.primary,     text: "#fff", ripple: "rgba(255,255,255,0.2)" };
      case "secondary": return { ...common, bg: c.primarySoft, text: c.primary, ripple: "rgba(123,44,44,0.15)" };
      case "outline":   return { borderWidth: 1, borderColor: c.primary, bg: "transparent", text: c.primary, ripple: "rgba(123,44,44,0.15)" };
      case "ghost":     return { ...common, bg: "transparent", text: c.primary, ripple: "rgba(123,44,44,0.12)" };
      case "danger":    return { ...common, bg: tokens.colors.error, text: "#fff", ripple: "rgba(255,255,255,0.2)" };
      default:          return { ...common, bg: c.primary,     text: "#fff", ripple: "rgba(255,255,255,0.2)" };
    }
  })();

  const handlePress = () => {
    if (isDisabled) return; // iOS + Android hard block
    if (haptic) Haptics.selectionAsync().catch(() => {});
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlop}
      disabled={isDisabled}
      android_ripple={
        Platform.OS === "android" && !isDisabled
          ? { color: palette.ripple as any, borderless: false }
          : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel || title}
      testID={testID}
      style={({ pressed }) => [
        {
          height: sz.height,
          paddingHorizontal: sz.padH,
          borderRadius: sz.radius,
          backgroundColor: palette.bg,
          borderWidth: palette.borderWidth,
          borderColor: palette.borderColor,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          ...(fullWidth ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }),
          transform:
            pressed && !isDisabled && (variant === "primary" || variant === "danger")
              ? [{ scale: 0.99 }]
              : [],
          opacity: isDisabled ? 0.6 : 1, // görünür şekilde kilitli
          ...(!isDisabled && (variant === "primary" || variant === "danger" || variant === "secondary")
            ? tokens.shadows.sm
            : undefined),
        } as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {leftIcon ? <View style={{ marginRight: 2 }}>{leftIcon}</View> : null}
          <Text
            style={[
              { color: palette.text, fontWeight: "800", fontSize: sz.text, letterSpacing: 0.2 },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {rightIcon ? <View style={{ marginLeft: 2 }}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}
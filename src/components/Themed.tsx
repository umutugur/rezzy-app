// components/Themed.tsx
import React from "react";
import { Text as RNText, View as RNView, TextProps, ViewProps } from "react-native";
import { lightTheme } from "../theme/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const Text = (p: TextProps & { secondary?: boolean }) => (
  <RNText
    {...p}
    style={[
      {
        color: p.secondary ? lightTheme.colors.textSecondary : lightTheme.colors.text,
        fontSize: lightTheme.typography.body,
      },
      p.style,
    ]}
  />
);

// topPadding:
//  - "base": base + safe-area (varsayılan)
//  - "none": sadece safe-area
//  - "flat": hiçbir üst padding yok (Stack header varken bunu kullan)
type ScreenProps = ViewProps & { topPadding?: "base" | "none" | "flat" };

export const Screen = ({ children, style, topPadding = "base", ...rest }: ScreenProps) => {
  const insets = useSafeAreaInsets();
  const base = 16;

  let paddingTop = 0;
  if (topPadding === "base") paddingTop = base + insets.top;
  else if (topPadding === "none") paddingTop = insets.top;
  else paddingTop = 0; // "flat"

  return (
    <RNView
      {...rest}
      style={[
        {
          flex: 1,
          backgroundColor: lightTheme.colors.background,
          paddingTop,
          paddingBottom: base + insets.bottom,
          paddingLeft: base + insets.left,
          paddingRight: base + insets.right,
        },
        style,
      ]}
    >
      {children}
    </RNView>
  );
};
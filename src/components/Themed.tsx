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

export const Screen = ({ children, style, ...rest }: ViewProps) => {
  const insets = useSafeAreaInsets();
  const base = 16;

  return (
    <RNView
      {...rest}
      style={[
        {
          flex: 1,
          backgroundColor: lightTheme.colors.background,
          paddingTop: base + insets.top,
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

import React from "react";
import { Text as RNText, View as RNView, TextProps, ViewProps } from "react-native";
import { lightTheme } from "../theme/theme";

export const Text = (p: TextProps & { secondary?: boolean }) => (
  <RNText
    {...p}
    style={[
      { color: p.secondary ? lightTheme.colors.textSecondary : lightTheme.colors.text, fontSize: lightTheme.typography.body },
      p.style
    ]}
  />
);

export const Screen = ({ children, style, ...rest }: ViewProps) => (
  <RNView {...rest} style={[{ flex: 1, backgroundColor: lightTheme.colors.background, padding: 16 }, style]}>
    {children}
  </RNView>
);

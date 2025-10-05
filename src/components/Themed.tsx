import * as React from "react";
import { View as RNView, Text as RNText, TextProps, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { lightTheme } from "../theme/theme";

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

/**
 * Screen:
 *  - Varsayılan olarak sadece safe-area kadar üst padding verir.
 *  - İstersen topPadding ile ekstra ekleyebilirsin: "none" | "sm" | "lg"
 *  - Sol/sağ/bottom padding'i buradan kaldırdık (sayfalar kendi içinde versin).
 */
export const Screen = ({
  children,
  style,
  topPadding = "none",
  ...rest
}: ViewProps & { topPadding?: "none" | "sm" | "lg" }) => {
  const insets = useSafeAreaInsets();
  const extraTop = topPadding === "lg" ? 16 : topPadding === "sm" ? 8 : 0;

  return (
    <RNView
      {...rest}
      style={[
        {
          flex: 1,
          backgroundColor: lightTheme.colors.background,
          paddingTop: insets.top + extraTop,
          // alt/sol/sağ padding yok
        },
        style,
      ]}
    >
      {children}
    </RNView>
  );
};

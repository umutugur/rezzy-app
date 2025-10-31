import React from "react";
import { View, ScrollView, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { panel } from "../theme/panelTheme";

type Props = {
  /** üstteki sekmeler/chip çubuğu */
  tabs?: React.ReactNode;
  /** içerik */
  children: React.ReactNode;
};

/**
 * PanelLayout:
 * - SafeArea düzgün (üstte/balta şişkinlik yok)
 * - Tek ScrollView (içeride başka scroll kullanma)
 * - Tutarlı padding ve kart boşlukları
 */
export default function PanelLayout({ tabs, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safe, { paddingTop: Math.max(insets.top, 4) }]}
    >
      <View style={styles.page}>
        {!!tabs && <View style={styles.tabsWrap}>{tabs}</View>}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          // iOS ScrollView üst boşluğu buglarını kapat
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          {children}
          {/* alt boşluk: tab bar ile çakışmasın */}
          <View style={{ height: Platform.select({ ios: 16, android: 12 }) }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: panel.colors.bg },
  page: { flex: 1, backgroundColor: panel.colors.bg },
  tabsWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: panel.colors.bg,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: panel.gap.md,
  },
});
import React from "react";
import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  // İsterseniz package.json’dan dinamik üretim yapılabilir.
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Açık Kaynak Lisansları</Text>
      <Text>Uygulamada kullanılan kütüphanelerin lisans bilgileri burada gösterilir.</Text>
    </ScrollView>
  );
}
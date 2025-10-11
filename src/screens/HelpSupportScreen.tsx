import React from "react";
import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Yardım & Destek</Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>Sık Sorulan Sorular</Text>
      <Text>- Rezervasyon nasıl yapılır?</Text>
      <Text>- Rezervasyonumu nasıl iptal ederim?</Text>
      <Text>- Bildirimler neden gelmiyor?</Text>

      <Text style={{ fontWeight: "700", marginTop: 12 }}>İpuçları</Text>
      <Text>- Bildirim iznini ve internet bağlantısını kontrol edin.</Text>
      <Text>- Uygulamayı güncel tutun.</Text>
    </ScrollView>
  );
}
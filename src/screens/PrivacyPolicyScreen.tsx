import React from "react";
import { ScrollView, Text, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Gizlilik Politikası</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>1. Toplanan Veriler</Text>
      <Text>- Kimlik: ad, e-posta, telefon (kullanıma bağlı).</Text>
      <Text>- Kullanım: rezervasyon geçmişi, favoriler, uygulama içi etkileşim.</Text>
      <Text>- Cihaz: bildirim belirteci (push token), cihaz modeli/OS (teknik).</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>2. Kişisel Verilerin Kullanımı</Text>
      <Text>- Rezervasyonların oluşturulması ve yönetimi</Text>
      <Text>- Bildirim gönderimi (durum güncellemeleri, hatırlatmalar)</Text>
      <Text>- Güvenlik, hata ayıklama ve performans analizi</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>3. Paylaşım</Text>
      <Text>- Hizmeti sağlamak için gerekli durumlarda restoranlarla sınırlı paylaşım</Text>
      <Text>- Yasal yükümlülükler kapsamında resmi makamlarla paylaşım</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>4. Saklama Süresi</Text>
      <Text>Veriler, amaç gerçekleşene kadar ve mevzuata uygun süre boyunca tutulur.</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>5. Haklarınız</Text>
      <Text>- Erişim, düzeltme, silme, itiraz ve veri taşınabilirliği talepleri</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>6. Çerezler ve Takip</Text>
      <Text>Uygulama içinde takip izni (IDFA) reklam/analitik amaçlı istenebilir.</Text>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>7. İletişim</Text>
      <Text onPress={() => Linking.openURL("mailto:kvkk@rezzy.app")} style={{ color: "#2563EB" }}>
        kvkk@rezzy.app
      </Text>

      <Text style={{ color: "#6B7280", marginTop: 12, fontSize: 12 }}>
        *Bu metin bilgilendirme amaçlıdır ve hukuki danışmanlık yerine geçmez.
      </Text>
    </ScrollView>
  );
}
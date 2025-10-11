import React from "react";
import { ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Kullanım Koşulları</Text>
      <Text style={{ marginBottom: 10 }}>
        Rezzy, restoranlar ve kullanıcılar arasında rezervasyon yapılmasını sağlayan bir platformdur.
        Uygulamayı kullanarak aşağıdaki koşulları kabul etmiş olursunuz.
      </Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>1. Hesap ve Güvenlik</Text>
      <Text>Hesabınızın güvenliğinden ve giriş bilgilerinizin gizli tutulmasından siz sorumlusunuz.</Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>2. Rezervasyon ve İptal</Text>
      <Text>Rezervasyon ve iptal kuralları restoran politikalarına göre değişebilir.</Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>3. Yasaklı Kullanım</Text>
      <Text>Hileli, yanıltıcı veya yasa dışı amaçlarla kullanım yasaktır.</Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>4. Sorumluluk Reddi</Text>
      <Text>Rezzy; restoran hizmetlerinin kalitesinden doğrudan sorumlu değildir.</Text>
      <Text style={{ fontWeight: "700", marginTop: 8 }}>5. Değişiklikler</Text>
      <Text>Koşullar gerektiğinde güncellenebilir. Değişiklikler yayınlandığı anda yürürlüğe girer.</Text>
      <Text style={{ color: "#6B7280", marginTop: 12, fontSize: 12 }}>
        *Bu metin bilgilendirme amaçlıdır ve hukuki danışmanlık yerine geçmez.
      </Text>
    </ScrollView>
  );
}
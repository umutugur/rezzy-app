import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "../components/Button";
import { useAuth } from "../store/useAuth";
import { deleteAccount } from "../api/user";

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { user, clear } = useAuth();
  const [loading, setLoading] = useState(false);

  const onDelete = async () => {
    try {
      setLoading(true);
      await deleteAccount();
      await clear();
      Alert.alert("Hesap Silindi", "Hesabınız kalıcı olarak silindi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || "Hesap silinemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Hesabı Sil</Text>
      <Text style={{ marginBottom: 16 }}>
        Hesabınızı sildiğinizde rezervasyon geçmişiniz ve kişisel verileriniz kalıcı olarak kaldırılır.
        Bu işlem geri alınamaz.
      </Text>
      <Button title={loading ? "Siliniyor..." : "Hesabımı Sil"} onPress={onDelete} variant="danger" />
    </View>
  );
}
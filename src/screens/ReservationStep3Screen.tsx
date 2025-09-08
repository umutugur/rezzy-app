import React from "react";
import { View, Alert } from "react-native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import UploadButton from "../components/UploadButton";
import { useReservation } from "../store/useReservation";
import { createReservation, uploadReceipt } from "../api/reservations";
import { getRestaurant } from "../api/restaurants";
import * as Clipboard from "expo-clipboard";
import { useNavigation } from "@react-navigation/native";

type Totals = { total: number; deposit: number };

export default function ReservationStep3Screen() {
  const nav = useNavigation<any>();
  const { restaurantId, dateTimeISO, selections, reset } = useReservation();

  const [reservationId, setReservationId] = React.useState<string | undefined>();
  const [totals, setTotals] = React.useState<Totals | undefined>();
  const [iban, setIban] = React.useState<string | undefined>();
  const [file, setFile] = React.useState<{ uri: string; name: string; type: string } | undefined>();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  // 1) Rezervasyonu oluştur
  
  const onCreate = async () => {
    
    if (!restaurantId || !dateTimeISO) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await createReservation({
        restaurantId: restaurantId!,
        dateTimeISO: dateTimeISO!,
        selections,
      });
      const id = res.reservationId;
      setReservationId(id);
      setTotals({ total: res.total, deposit: res.deposit });

      // 2) IBAN bilgisini getir (restoran detayından)
      try {
        const r = await getRestaurant(restaurantId!);
        setIban(r?.iban || r?.bank?.iban || r?.restaurant?.iban);
      } catch {
        // IBAN gelmezse de kullanıcı dekontu yükleyebilir
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Rezervasyon oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  // 3) Dekont yükle ve Detay’a geç
  const onUpload = async () => {

    if (!reservationId || !file) return;
    setLoading(true);
    setError(undefined);
    try {
      await uploadReceipt(reservationId, file);
      reset();
      // Detay sayfasına replace: geri dönünce tekrar oluşturma ekranına dönmesin
      nav.replace("Rezervasyon Detayı", { id: reservationId });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Dekont yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const copyIban = async () => {
    if (!iban) return;
    await Clipboard.setStringAsync(iban);
    Alert.alert("Kopyalandı", "IBAN panoya kopyalandı.");
  };

  return (
    <Screen>
      <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 8 }}>Özet & Dekont</Text>

      {/* 0. durum: daha oluşturulmadı */}
      {!reservationId ? (
        <>
          <Text secondary>
            Rezervasyon oluşturduktan sonra işletmenin IBAN’ına havale/EFT yapıp dekontu burada
            yükleyeceksin.
          </Text>
          <View style={{ height: 12 }} />
          <Button title="Rezervasyonu Oluştur" onPress={onCreate} loading={loading} />
          {error && <Text style={{ color: "red", marginTop: 8 }}>{error}</Text>}
        </>
      ) : (
        <>
          {/* 1. durum: oluşturuldu → tutar + IBAN + upload */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "#E6E6E6",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Tutar</Text>
            <Text>Toplam: ₺{totals?.total}</Text>
            <Text>Ön ödeme (%10): ₺{totals?.deposit}</Text>
          </View>

          <View
            style={{
              borderWidth: 1,
              borderColor: "#E6E6E6",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              backgroundColor: "#FAFAFA",
            }}
          >
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>IBAN</Text>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>{iban || "IBAN bilgisi yüklenemedi"}</Text>
            <Button title="IBAN'ı Kopyala" variant="outline" onPress={copyIban} disabled={!iban} />
          </View>

          <UploadButton onPicked={(f) => setFile(f)} />
          <View style={{ height: 12 }} />
          <Button
            title="Dekontu Gönder & Tamamla"
            onPress={onUpload}
            loading={loading}
            disabled={!file}
          />
          {error && <Text style={{ color: "red", marginTop: 8 }}>{error}</Text>}
        </>
      )}
    </Screen>
  );
}

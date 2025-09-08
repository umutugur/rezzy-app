// screens/ReservationDetailScreen.tsx
import React from "react";
import { View, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useRoute } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import ReceiptCard from "../components/ReceiptCard";
import { useReservationDetail } from "../hooks/useReservationDetail";
import { uploadReceipt, cancelReservation } from "../api/reservations";
import { formatDateTime } from "../utils/format";

/**
 * Bu ekran artık backend'in döndürdüğü partySize, selections, totalPrice, depositAmount
 * alanlarını doğrudan gösterir. Kendi kendine kişi/kapora hesaplamaz.
 */

type Group = { name: string; unit: number; count: number; persons: number[]; subtotal: number };

const formatTL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

export default function ReservationDetailScreen() {
  const route = useRoute<any>();
  const { id } = route.params as { id: string };

  const { data: r, loading, error, refetch, setData } = useReservationDetail(id, 5000);
  const [uploading, setUploading] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
        <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
      </Screen>
    );
  }
  if (error || !r) {
    return (
      <Screen>
        <Text style={{ fontWeight: "700" }}>Rezervasyon</Text>
        <Text secondary style={{ marginTop: 8 }}>Hata: {error ?? "Bulunamadı"}</Text>
        <View style={{ height: 8 }} />
        <Button title="Tekrar Dene" onPress={refetch} />
      </Screen>
    );
  }

  // Backend verileri
  const restaurantName = (r as any).restaurantId?.name ?? "";
  const dateTime = (r as any).dateTimeUTC;
  const status = (r as any).status as string;
  const partySize = Number((r as any).partySize) || 0;
  const selections = (r as any).selections as Array<{ person: number; menuId: string; price: number }> | undefined;
  const totalPrice = Number((r as any).totalPrice) || 0;
  const depositAmount = Number((r as any).depositAmount) || 0;

  // Menü kırılımı (backend’den gelen selection.price kişi başı fiyatını kullanır)
  const groups: Record<string, Group> = {};
  if (Array.isArray(selections)) {
    for (const s of selections) {
      const key = s.menuId || "_unknown";
      if (!groups[key]) {
        groups[key] = { name: key, unit: Number(s.price) || 0, count: 0, persons: [], subtotal: 0 };
      }
      groups[key].count += Number(s.person) || 0; // her kişi için adet
      groups[key].persons.push(Number(s.person) || 0);
      groups[key].subtotal = groups[key].unit * groups[key].count;
    }
  }

  const canCancel = status === "pending";

  const handleReplace = async (file: { uri: string; name: string; type: string }) => {
    try {
      setUploading(true);
      const res = await uploadReceipt(id, file);
      setData((prev: any) => (prev ? { ...prev, receiptUrl: res.receiptUrl, status: res.status as any } : prev));
      Alert.alert("Başarılı", "Dekont yüklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message ?? "Yükleme başarısız");
    } finally {
      setUploading(false);
    }
  };

  const onCancelPress = () => {
    if (!r) return;
    Alert.alert("Rezervasyonu iptal et", "İptal etmek istediğine emin misin?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Evet, iptal et",
        style: "destructive",
        onPress: async () => {
          try {
            setCanceling(true);
            const out = await cancelReservation(id);
            setData((prev: any) => (prev ? { ...prev, status: out.status as any } : prev));
            Alert.alert("İptal edildi", "Rezervasyonun iptal edildi.");
          } catch (e: any) {
            Alert.alert("Hata", e?.message ?? "İptal edilemedi.");
          } finally {
            setCanceling(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Başlık */}
        <Text style={{ fontWeight: "800", fontSize: 18, marginBottom: 6 }}>Rezervasyon</Text>
        <StatusBadge status={status} />
        <View style={{ height: 8 }} />
        <Text secondary>
          {restaurantName} • {formatDateTime(dateTime)}
        </Text>

        <View style={{ height: 20 }} />

        {/* Özet kartı */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#F3F4F6",
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
            gap: 8,
          }}
        >
          <Text style={{ fontWeight: "700" }}>Rezervasyon Özeti</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text secondary>Kişi sayısı</Text>
            <Text style={{ fontWeight: "700" }}>{partySize}</Text>
          </View>

          <View style={{ height: 8 }} />
          {Array.isArray(selections) && selections.length > 0 ? (
            <View style={{ gap: 8 }}>
              {Object.entries(groups).map(([menuId, g]) => (
                <View key={menuId} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700" }}>
                      Menü {menuId.slice(-4)} × {g.count}
                    </Text>
                    <Text style={{ fontWeight: "700" }}>{formatTL(g.subtotal)}</Text>
                  </View>
                  <Text secondary>Bir kişi fiyat: {formatTL(g.unit)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text secondary>Menü seçimleri bulunamadı.</Text>
          )}

          <View style={{ height: 8 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 8, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text secondary>Ara toplam</Text>
              <Text>{formatTL(totalPrice)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text secondary>Kapora</Text>
              <Text>{formatTL(depositAmount)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "800" }}>Genel toplam</Text>
              <Text style={{ fontWeight: "800" }}>{formatTL(totalPrice)}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />

        {/* Dekont */}
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Dekont</Text>
        <ReceiptCard
          url={(r as any).receiptUrl}
          onReplace={handleReplace}
          replacing={uploading}
          canReplace={status === "pending"}
        />

        <View style={{ height: 24 }} />

        {/* İptal */}
        {canCancel ? (
          <Button
            title={canceling ? "İptal ediliyor..." : "Rezervasyonu İptal Et"}
            onPress={onCancelPress}
            disabled={canceling}
          />
        ) : (
          <Text secondary>Bu rezervasyon iptal edilemez (durum: {status}).</Text>
        )}

        <View style={{ height: 24 }} />

        {/* QR Bilgi */}
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Giriş QR</Text>
        {status === "confirmed" ? (
          <Text secondary>Rezervasyonun onaylandı. QR üretildiğinde burada görünecek.</Text>
        ) : (
          <Text secondary>Onaylandıktan sonra QR burada görünecek.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

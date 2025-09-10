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

type Selection = { person: number; menuId: string; price: number };
type MenuLite = { _id: string; name: string; pricePerPerson: number };

const formatTL = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);

export default function ReservationDetailScreen() {
  // ----- HOOKS: her zaman, en başta ve aynı sırada -----
  const route = useRoute<any>();
  const { id } = route.params as { id: string };

  const { data: r, loading, error, refetch, setData } = useReservationDetail(id, 5000);

  const [uploading, setUploading] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);

  // Backend verilerini güvenli şekilde çıkar (undefined olsa da hook'lar koşulsuz çalışır)
  const restaurantName = (r as any)?.restaurantId?.name ?? "";
  const dateTimeUTC = (r as any)?.dateTimeUTC as string | undefined;
  const status = ((r as any)?.status as string) ?? "pending";

  const partySize = Number((r as any)?.partySize ?? 0) || 0;
  const selections = (((r as any)?.selections ?? []) as Selection[]) || [];
  const totalPrice = Number((r as any)?.totalPrice ?? 0) || 0;
  const depositAmount = Number((r as any)?.depositAmount ?? 0) || 0;

  const selectionMode = (((r as any)?.selectionMode ?? "count") as "index" | "count");
  const menus = (((r as any)?.menus ?? []) as MenuLite[]) || [];

  // Menü map ve gruplar: HOOK olarak her zaman çağrılıyor
  const menuMap = React.useMemo(() => {
    const m = new Map<string, MenuLite>();
    menus.forEach((x) => m.set(String(x._id), x));
    return m;
  }, [menus]);

  type Group = { name: string; unit: number; count: number; subtotal: number };
  const groups = React.useMemo(() => {
    const acc: Record<string, Group> = {};
    for (const s of selections) {
      const key = s.menuId || "_unknown";
      const info = menuMap.get(String(key));
      const unit = Number(s.price || info?.pricePerPerson || 0);
      const name = info?.name || "Menü";

      if (!acc[key]) acc[key] = { name, unit, count: 0, subtotal: 0 };
      const addCount = selectionMode === "index" ? 1 : Math.max(0, Number(s.person) || 0);
      acc[key].count += addCount;
      acc[key].subtotal = acc[key].unit * acc[key].count;
    }
    return acc;
  }, [selections, menuMap, selectionMode]);

  const canCancel = status === "pending";

  const handleReplace = async (file: { uri: string; name: string; type: string }) => {
    try {
      setUploading(true);
      const res = await uploadReceipt(id, file);
      setData((prev: any) =>
        prev ? { ...prev, receiptUrl: res.receiptUrl, status: res.status as any } : prev
      );
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

  // ----- RENDER: erken return yok; content değişkeniyle dallanıyoruz -----
  let content: React.ReactNode = null;

  if (loading) {
    content = (
      <>
        <ActivityIndicator />
        <Text secondary style={{ marginTop: 8 }}>Yükleniyor…</Text>
      </>
    );
  } else if (error || !r) {
    content = (
      <>
        <Text style={{ fontWeight: "700" }}>Rezervasyon</Text>
        <Text secondary style={{ marginTop: 8 }}>Hata: {error ?? "Bulunamadı"}</Text>
        <View style={{ height: 8 }} />
        <Button title="Tekrar Dene" onPress={refetch} />
      </>
    );
  } else {
    content = (
      <>
        {/* Başlık */}
        <Text style={{ fontWeight: "800", fontSize: 18, marginBottom: 6 }}>Rezervasyon</Text>
        <StatusBadge status={status} />
        <View style={{ height: 8 }} />
        <Text secondary>
          {restaurantName}{dateTimeUTC ? ` • ${formatDateTime(dateTimeUTC)}` : ""}
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
          {selections.length ? (
            <View style={{ gap: 8 }}>
              {Object.entries(groups).map(([menuId, g]) => (
                <View key={menuId} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700" }}>
                      {g.name} × {g.count}
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
          url={(r as any)?.receiptUrl}
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
      </>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {content}
      </ScrollView>
    </Screen>
  );
}

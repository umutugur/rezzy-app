import React from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { rp } from "./rpStyles";
import { getRestaurant, updateRestaurant } from "../../api/restaurants";
import { buildMapsUrl, openInMaps, tryExtractLatLngFromMapsUrl } from "../../utils/maps";

function toNumberMaybe(v: any) {
  if (v == null) return NaN;
  // virgül ile girilen değerleri de destekle
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

export default function RP_General({ route }: any) {
  const { restaurantId } = route.params as { restaurantId: string };

  const [form, setForm] = React.useState<any>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!restaurantId) return;
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (ignore) return;

        // location'dan lat/lng çıkar
        let lat: number | undefined;
        let lng: number | undefined;
        const loc = r.location;
        if (loc && typeof loc === "object") {
          if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
            lng = Number(loc.coordinates[0]);
            lat = Number(loc.coordinates[1]);
          } else if (Number.isFinite((loc as any).lat) && Number.isFinite((loc as any).lng)) {
            lat = Number((loc as any).lat);
            lng = Number((loc as any).lng);
          }
        }

        setForm({
          name: r.name || "",
          email: r.email || "",
          phone: r.phone || "",
          city: r.city || "",
          address: r.address || "",
          description: r.description || "",
          iban: r.iban || "",
          ibanName: r.ibanName || "",
          bankName: r.bankName || "",
          mapAddress: r.mapAddress || "",
          googleMapsUrl: r.googleMapsUrl || "",
          // UI alanları
          _existingLocation: r.location ?? null,
          _lat: lat != null ? String(lat) : "",
          _lng: lng != null ? String(lng) : "",
        });
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  const fillLatLngFromUrl = () => {
    const r = tryExtractLatLngFromMapsUrl(form.googleMapsUrl);
    if (!r) {
      Alert.alert("Uyarı", "URL’den koordinat çıkarılamadı. Lütfen Google Maps bağlantısını kontrol edin.");
      return;
    }
    setForm((f: any) => ({ ...f, _lat: String(r.lat), _lng: String(r.lng) }));
  };

  const preview = React.useMemo(() => {
    const lat = toNumberMaybe(form?._lat);
    const lng = toNumberMaybe(form?._lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const url = buildMapsUrl({
      googleMapsUrl: String(form?.googleMapsUrl || ""),
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
    });
    return { hasCoords, lat, lng, url };
  }, [form?._lat, form?._lng, form?.googleMapsUrl]);

  const openOnMaps = async () => {
    if (!preview.url) {
      Alert.alert("Uyarı", "Açılacak bir harita bağlantısı bulunamadı.");
      return;
    }
    await openInMaps(preview.url);
  };

  const onSave = async () => {
    // Backend "location.coordinates" zorunlu diyorsa burada doğrulayalım
    const lat = toNumberMaybe(form._lat);
    const lng = toNumberMaybe(form._lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert(
        "Konum Zorunlu",
        'Backend "location.coordinates" alanını istiyor. Lütfen enlem/boylam girin ya da "URL’den Koordinat Al" butonunu kullanın.'
      );
      return;
    }

    const payload: any = {
      // düz alanlar
      name: form.name,
      email: form.email,
      phone: form.phone,
      city: form.city,
      address: form.address,
      description: form.description,
      iban: form.iban,
      ibanName: form.ibanName,
      bankName: form.bankName,
      mapAddress: form.mapAddress,
      googleMapsUrl: String(form.googleMapsUrl || "").trim(),
      // ZORUNLU: GeoJSON Point (lng, lat) sırası önemli!
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };

    try {
      setLoading(true);
      await updateRestaurant(restaurantId, payload);
      Alert.alert("Başarılı", "Genel bilgiler güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Temel Bilgiler</Text>

        {[
          ["name", "Ad"],
          ["email", "E-posta"],
          ["phone", "Telefon"],
          ["city", "Şehir"],
          ["address", "Adres"],
        ].map(([k, label]) => (
          <View key={k}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>{label}</Text>
            <TextInput
              value={String(form[k] ?? "")}
              onChangeText={(v) => setForm((f: any) => ({ ...f, [k]: v }))}
              style={rp.input}
              placeholder={label as string}
              autoCapitalize={k === "email" ? "none" : "sentences"}
              keyboardType={k === "phone" ? "phone-pad" : "default"}
            />
          </View>
        ))}

        <Text style={{ color: "#6b7280", marginBottom: 6 }}>Açıklama</Text>
        <TextInput
          value={String(form.description ?? "")}
          onChangeText={(v) => setForm((f: any) => ({ ...f, description: v }))}
          style={[rp.input, { height: 100 }]}
          multiline
        />

        <Text style={{ color: "#6b7280", marginTop: 12, marginBottom: 6 }}>Ödeme Bilgileri</Text>
        {[
          ["iban", "IBAN"],
          ["ibanName", "IBAN Adı"],
          ["bankName", "Banka Adı"],
        ].map(([k, label]) => (
          <View key={k}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>{label}</Text>
            <TextInput
              value={String(form[k] ?? "")}
              onChangeText={(v) => setForm((f: any) => ({ ...f, [k]: v }))}
              style={rp.input}
              placeholder={label as string}
              autoCapitalize={k === "iban" ? "characters" : "words"}
            />
          </View>
        ))}

        {/* KONUM */}
        <Text style={{ color: "#6b7280", marginTop: 12, marginBottom: 6 }}>Konum</Text>

        <Text style={{ color: "#6b7280", marginBottom: 6 }}>Google Maps URL (opsiyonel)</Text>
        <TextInput
          value={String(form.googleMapsUrl ?? "")}
          onChangeText={(v) => setForm((f: any) => ({ ...f, googleMapsUrl: v }))}
          style={rp.input}
          placeholder="https://maps.google.com/…"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <TouchableOpacity style={rp.btnMuted} onPress={fillLatLngFromUrl}>
            <Text style={rp.btnMutedText}>URL’den Koordinat Al</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rp.btnMuted} onPress={openOnMaps}>
            <Text style={rp.btnMutedText}>Haritada Aç</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: "#6b7280", marginTop: 10, marginBottom: 6 }}>Adres (Harita için)</Text>
        <TextInput
          value={String(form.mapAddress ?? "")}
          onChangeText={(v) => setForm((f: any) => ({ ...f, mapAddress: v }))}
          style={rp.input}
          placeholder="Haritada görünen adres"
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Enlem (Lat)</Text>
            <TextInput
              value={String(form._lat ?? "")}
              onChangeText={(v) => setForm((f: any) => ({ ...f, _lat: v }))}
              style={rp.input}
              keyboardType="decimal-pad"
              placeholder="38.4189"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Boylam (Lng)</Text>
            <TextInput
              value={String(form._lng ?? "")}
              onChangeText={(v) => setForm((f: any) => ({ ...f, _lng: v }))}
              style={rp.input}
              keyboardType="decimal-pad"
              placeholder="27.1287"
            />
          </View>
        </View>

        {/* Küçük önizleme/kısa bilgi */}
        <View
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            backgroundColor: "#fafafa",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Ionicons name="location-outline" size={18} color="#374151" />
            <Text style={{ fontWeight: "700", color: "#374151" }}>Önizleme</Text>
          </View>

          <Text style={{ color: "#6b7280" }}>
            {form.mapAddress ? form.mapAddress : "Adres: (boş)"}
          </Text>
          <Text style={{ color: "#6b7280", marginTop: 2 }}>
            Koordinat: {Number.isFinite(preview.lat) && Number.isFinite(preview.lng) ? `${form._lat} , ${form._lng}` : "(yok)"}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={rp.btnMuted} onPress={openOnMaps}>
              <Text style={rp.btnMutedText}>Haritada Aç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={rp.btnMuted}
              onPress={() => {
                const r = tryExtractLatLngFromMapsUrl(form.googleMapsUrl);
                if (r) setForm((f: any) => ({ ...f, _lat: String(r.lat), _lng: String(r.lng) }));
              }}
            >
              <Text style={rp.btnMutedText}>Koordinatı Güncelle</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[rp.btnPrimary, { marginTop: 12 }]} disabled={loading} onPress={onSave}>
          <Text style={rp.btnPrimaryText}>{loading ? "Kaydediliyor…" : "Kaydet"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
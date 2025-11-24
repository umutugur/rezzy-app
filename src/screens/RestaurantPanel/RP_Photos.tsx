import React from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { rp } from "./rpStyles";
import ensureFileUri from "../../utils/ensureFileUri";
import { addPhotoMultipart, getRestaurant, removePhoto } from "../../api/restaurants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Photos">;

function guessExtFromMime(m?: string): string {
  const mime = (m || "").toLowerCase();
  if (mime.includes("heic")) return ".heic";
  if (mime.includes("heif")) return ".heif";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  return ".jpg";
}
function ensureName(name?: string, mime?: string) {
  const base = (name && name.trim()) || `photo-${Date.now()}`;
  const ext = /\.[a-z0-9]+$/i.test(base) ? "" : guessExtFromMime(mime);
  return `${base}${ext}`;
}
function ensureMime(mime?: string, nameMaybe?: string) {
  const n = (nameMaybe || "").toLowerCase();
  if (mime) return mime;
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".heic")) return "image/heic";
  if (n.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

export default function RP_Photos({ route }: Props) {
  const { restaurantId } = route.params;

  const [photos, setPhotos] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (ignore) return;
        setPhotos(r?.photos || []);
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Restoran bilgisi alınamadı.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [restaurantId]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
      base64: false,
    });
    if (res.canceled) return;

    const a: any = res.assets?.[0];
    const rawUri: string = a?.uri;
    const rawMime: string | undefined = a?.mimeType;
    const rawName: string | undefined = a?.fileName;

    if (!rawUri) {
      Alert.alert("Hata", "Geçersiz dosya yolu.");
      return;
    }

    try {
      setUploading(true);

      // iOS "ph://" → "file://"
      const safeUri = await ensureFileUri(rawUri);

      // isim/MIME sağlamlaştır
      const safeName = ensureName(rawName, rawMime);
      const safeMime = ensureMime(rawMime, safeName);

      const updated = await addPhotoMultipart(restaurantId, safeUri, safeName, safeMime);
      setPhotos((updated as any).photos || []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Fotoğraf yüklenemedi.";
      Alert.alert("Hata", msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={rp.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={rp.card}>
        <Text style={rp.cardTitle}>Fotoğraflar</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {photos?.length ? (
            photos.map((url) => (
              <View key={url} style={{ width: "48%" }}>
                <TouchableOpacity onPress={() => Linking.openURL(url)}>
                  <Image
                    source={{ uri: url }}
                    style={{ width: "100%", height: 140, borderRadius: 12, backgroundColor: "#f3f4f6" }}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={uploading}
                  style={[rp.btnDanger, { marginTop: 8, opacity: uploading ? 0.6 : 1 }]}
                  onPress={async () => {
                    try {
                      const updated = await removePhoto(restaurantId, url);
                      setPhotos((updated as any).photos || []);
                    } catch (e: any) {
                      Alert.alert("Hata", e?.message || "Silinemedi.");
                    }
                  }}
                >
                  <Text style={rp.btnDangerText}>Sil</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={rp.muted}>{loading ? "Yükleniyor..." : "Fotoğraf yok."}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[rp.btnPrimary, { marginTop: 12, opacity: uploading ? 0.6 : 1 }]}
          onPress={pick}
          disabled={uploading}
        >
          <Text style={rp.btnPrimaryText}>{uploading ? "Yükleniyor..." : "+ Fotoğraf Yükle"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
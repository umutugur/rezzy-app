import React from "react";
import { ScrollView, View, Text, Image, TouchableOpacity, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { rp } from "./rpStyles";
import { getRestaurant, addPhoto, removePhoto } from "../../api/restaurants";
import { Linking } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";

type Props = NativeStackScreenProps<RestaurantPanelParams, "Photos">;

export default function RP_Photos({ route }: Props) {
  const { restaurantId } = route.params;

  const [photos, setPhotos] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (ignore) return;
        setPhotos(r.photos || []);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [restaurantId]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled) {
      const a = res.assets[0] as any;
      try {
        const updated = await addPhoto(restaurantId, a.uri, a.fileName ?? "image.jpg", a.mimeType ?? "image/jpeg");
        setPhotos((updated as any).photos || []);
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Fotoğraf yüklenemedi.");
      }
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
                  style={[rp.btnDanger, { marginTop: 8 }]}
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
            <Text style={rp.muted}>Fotoğraf yok.</Text>
          )}
        </View>

        <TouchableOpacity style={[rp.btnPrimary, { marginTop: 12 }]} onPress={pick}>
          <Text style={rp.btnPrimaryText}>+ Fotoğraf Yükle</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
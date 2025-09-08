// src/components/UploadButton.tsx
import React from "react";
import { View, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Button from "./Button";
import { Text } from "./Themed";

type PickedFile = { uri: string; name: string; type: string };

export default function UploadButton({
  onPicked,
}: {
  onPicked: (file: PickedFile) => void;
}) {
  const [preview, setPreview] = React.useState<string | undefined>();

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("İzin gerekli", "Galeriye erişim izni verilmedi.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ sadece görseller
        quality: 0.9,
        selectionLimit: 1,
      });

      if (res.canceled || !res.assets?.[0]) return;

      const a = res.assets[0];
      const rawName = a.fileName || a.uri.split("/").pop() || "receipt.jpg";
      const ext = (rawName.split(".").pop() || "jpg").toLowerCase();

      // mimeType eksikse fallback yap
      const type =
        a.mimeType ||
        (ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : "image/jpeg");

      const name = /\./.test(rawName) ? rawName : `receipt.${ext}`;

      setPreview(a.uri);

      onPicked({ uri: a.uri, name, type });
    } catch (e: any) {
      console.log("ImagePicker error:", e?.message || e);
      Alert.alert("Hata", "Dosya seçilirken bir sorun oluştu.");
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Button title="Dekont Yükle" variant="outline" onPress={pick} />
      {preview ? (
        <Image
          source={{ uri: preview }}
          style={{ width: "100%", height: 140, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : (
        <Text secondary>Kabul edilen: JPG/PNG</Text>
      )}
    </View>
  );
}

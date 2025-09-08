import React from "react";
import Chip from "./Chip";
import * as ImagePicker from "expo-image-picker";

type FileParam = { uri: string; name: string; type: string };

export default function UploadChip({
  title = "Dekont Yükle",
  onPicked,
  disabled,
}: {
  title?: string;
  onPicked: (file: FileParam) => void | Promise<void>;
  disabled?: boolean;
}) {
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // yalnız görsel
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const ext = (a.fileName?.split(".").pop() || "jpg").toLowerCase();
      onPicked({
        uri: a.uri,
        name: a.fileName || `receipt.${ext}`,
        type: a.mimeType || (ext === "png" ? "image/png" : "image/jpeg"),
      });
    }
  };

  return <Chip title={title} onPress={pick} disabled={disabled} />;
}

// src/components/UploadChip.tsx
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
    // ——— İzin kontrolü (sessiz) ———
    try {
      const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) return;
      }
      console.log("[picker] permission", perm?.status);
    } catch {}

    // ——— Deprecation uyumlu mediaTypes ———
    const mediaTypes =
      // Yeni API mevcutsa onu kullan (SDK 54+)
      (ImagePicker as any).MediaType?.Images ??
      // Tipler eskiyse, geriye dönük fallback
      ImagePicker.MediaTypeOptions.Images;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.8,
      selectionLimit: 1,
    });

    console.log("[picker] canceled:", res.canceled);
    if (res.canceled || !res.assets?.[0]) return;

    const a = res.assets[0];

    // ——— Tanılama log’u ———
    console.log("[picker] asset", {
      uri: a.uri,
      fileName: (a as any).fileName,      // iOS’ta undefined olabilir
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      fileSize: (a as any).fileSize,
    });

    // ——— Güvenli isim ve MIME üretimi ———
    const nameFromUri = a.uri?.split(/[\\/]/).pop() || "receipt";
    const extFromMime = a.mimeType?.split("/")[1]?.toLowerCase();
    const extFromUri = nameFromUri.includes(".")
      ? nameFromUri.split(".").pop()?.toLowerCase()
      : undefined;

    // HEIC/HEIF desteği var; yoksa jpeg’e düşer
    const ext = (extFromMime || extFromUri || "jpg").toLowerCase();

    const safeName =
      (a as any).fileName ??
      (nameFromUri.includes(".") ? nameFromUri : `receipt.${ext}`);

    const safeType =
      a.mimeType ||
      (ext === "png"
        ? "image/png"
        : ext === "heic"
        ? "image/heic"
        : ext === "heif"
        ? "image/heif"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg");

    onPicked({
      uri: a.uri,
      name: safeName,
      type: safeType,
    });
  };

  return <Chip title={title} onPress={pick} disabled={disabled} />;
}
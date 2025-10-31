// src/utils/ensureFileUri.ts
import * as MediaLibrary from "expo-media-library";

/**
 * iOS'ta bazen ImagePicker "ph://..." döndürür.
 * RN fetch + FormData ise "file://..." ister.
 * Bulamazsak gelen URI’yı aynen geri döneriz (fail-safe).
 */
export default async function ensureFileUri(inputUri: string): Promise<string> {
  if (!inputUri) return inputUri;
  if (inputUri.startsWith("file://")) return inputUri;

  // iOS Photos (ph://...) için MediaLibrary ile gerçek dosya yolunu çözmeyi dene
  if (inputUri.startsWith("ph://")) {
    try {
      // ph://<ASSET_ID>
      const assetId = inputUri.replace("ph://", "");
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      if (info?.localUri?.startsWith("file://")) {
        return info.localUri;
      }
    } catch {
      // yut ve aşağıda orijinali döndür
    }
  }

  return inputUri;
}
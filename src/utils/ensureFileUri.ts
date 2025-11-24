import * as MediaLibrary from "expo-media-library";

/**
 * iOS'ta bazen ImagePicker "ph://..." döndürür.
 * RN fetch + FormData ise "file://..." ister.
 * Bulamazsak gelen URI’yı aynen geri döneriz (fail-safe).
 *
 * Not: Android genelde "file://" verir. "content://" DocumentPicker
 * senaryosunda görülür; burada ImagePicker kullandığımız için bırakıyoruz.
 */
export default async function ensureFileUri(inputUri: string): Promise<string> {
  if (!inputUri) return inputUri;
  if (inputUri.startsWith("file://")) return inputUri;

  // iOS Photos (ph://...) → gerçek dosya yolu
  if (inputUri.startsWith("ph://")) {
    try {
      const assetId = inputUri.slice(5); // "ph://" çıkar
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      if (info?.localUri?.startsWith("file://")) {
        return info.localUri;
      }
    } catch {
      // yut ve orijinali döndür
    }
  }

  return inputUri;
}
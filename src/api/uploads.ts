// src/api/uploads.ts
import * as FileSystem from "expo-file-system/legacy";
import { api } from "./client";

/**
 * Genel dosya yükleme (Cloudinary). Backend { url } veya { secure_url } döndürür.
 *
 * iOS'ta ImagePicker'dan dönen URI bazen iCloud/FileProvider placeholder'ı olur
 * ve `NSURLSession` bu dosyayı multipart olarak okuyamadan isteği ERR_NETWORK ile
 * anında düşürür. Bunu tamamen atlatmak için dosyayı base64'e okuyup JSON gövdede
 * gönderiyoruz; multipart dosya-streaming katmanı hiç devreye girmiyor.
 */
export async function uploadToCloud(file: { uri: string; name: string; type: string }): Promise<string> {
  const type = file.type || "image/jpeg";

  // 1) Tercih edilen yol: base64 (JSON) — iOS'ta güvenilir.
  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const dataUri = `data:${type};base64,${base64}`;
  const { data } = await api.post("/uploads", { file: dataUri });

  const url = data?.url || data?.secure_url || data?.Location || data?.data?.url;
  if (!url) throw new Error("Yükleme başarısız: URL alınamadı.");
  return String(url);
}

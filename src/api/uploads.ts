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

  // Render free-tier uykudan kalkarken İLK istek (sunucuyu uyandıran istek)
  // bağlantı kopmasıyla düşebilir; ikinci deneme artık sıcak sunucuya gider.
  // Bu yüzden ağ/abort hatalarında otomatik yeniden dene → kullanıcı görmez.
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await api.post("/uploads", { file: dataUri }, { timeout: 90000 });
      const url = data?.url || data?.secure_url || data?.Location || data?.data?.url;
      if (url) return String(url);
      throw new Error("Yükleme başarısız: URL alınamadı.");
    } catch (e: any) {
      lastErr = e;
      const code = e?.code;
      // Sadece sunucu yanıtı OLMAYAN hatalarda (ağ kopması/abort/timeout) tekrar dene.
      const retriable = !e?.response || code === "ECONNABORTED" || code === "ERR_NETWORK";
      if (!retriable || attempt === 2) throw e;
      await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)));
    }
  }
  throw lastErr;
}

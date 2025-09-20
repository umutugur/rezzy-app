// src/api/uploads.ts
import { api } from "./client";

// Genel dosya yükleme (Cloudinary). Backend { url } veya { secure_url } döndürmeli.
export async function uploadToCloud(file: { uri: string; name: string; type: string }): Promise<string> {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as any);

  const { data } = await api.post("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const url = data?.url || data?.secure_url || data?.Location || data?.data?.url;
  if (!url) throw new Error("Yükleme başarısız: URL alınamadı.");
  return String(url);
}

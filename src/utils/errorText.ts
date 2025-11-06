// utils/errorText.ts
export function friendlyAuthError(raw?: unknown) {
  const s = String(raw || "").toLowerCase();

  // Joi tipindeki "not allowed to be empty"
  if (s.includes("not allowed to be empty")) {
    const wantsEmail = s.includes("email");
    const wantsPassword = s.includes("password");
    if (wantsEmail && wantsPassword) {
      return { title: "Eksik Bilgi", message: "E-posta ve şifre alanları boş bırakılamaz." };
    }
    if (wantsEmail) return { title: "Eksik Bilgi", message: "E-posta alanı boş bırakılamaz." };
    if (wantsPassword) return { title: "Eksik Bilgi", message: "Şifre alanı boş bırakılamaz." };
  }

  // Joi tipindeki "must be a valid email"
  if (s.includes("must be a valid email")) {
    return { title: "Geçersiz E-posta", message: "Lütfen geçerli bir e-posta adresi girin (örn. ad@alan.com)." };
  }

  // Sık rastlanan backend cevapları
  if (s.includes("invalid") && (s.includes("credential") || s.includes("email") || s.includes("password"))) {
    return { title: "Giriş Başarısız", message: "E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin." };
  }
  if (s.includes("too many") || s.includes("rate limit")) {
    return { title: "Kısa Sürede Çok Deneme", message: "Geçici olarak engellendiniz. Birkaç dakika sonra tekrar deneyin." };
  }
  if (s.includes("banned") || s.includes("disabled") || s.includes("suspended")) {
    return { title: "Hesap Kısıtlandı", message: "Hesabınız geçici olarak kısıtlanmış görünüyor. Destek ekibiyle iletişime geçin." };
  }
  if (s.includes("network") || s.includes("timeout") || s.includes("failed to fetch")) {
    return { title: "Bağlantı Sorunu", message: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." };
  }

  // Varsayılan
  return { title: "Bir Hata Oluştu", message: "İşlem tamamlanamadı. Lütfen tekrar deneyin." };
}
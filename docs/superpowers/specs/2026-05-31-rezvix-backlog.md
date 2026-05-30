# Rezvix — Yapılacaklar Listesi (Backlog)
**Tarih:** 2026-05-31  
**Durum:** Aktif  

---

## Kritik / Eksik Altyapı 🔴

### #1 — Evrensel Yorum & Puanlama Modeli
- `Review.js` sadece `restaurantId` biliyor
- Market, delivery (paket servis) ve taksi için model, route, UI yok
- **Etkilenen:** tüm modüller

### #2 — Yorum Doğrulaması (Gerçek Müşteri Kontrolü)
- Şu an herkes yorum yapabiliyor, satın alma/kullanım doğrulaması yok
- Kontrol edilmesi gereken kayıtlar:
  - Restoran → `Order` veya `Reservation` (userId eşleşmeli)
  - Paket servis → `DeliveryOrder` (userId eşleşmeli)
  - Market → `MarketOrder` (userId eşleşmeli)
  - Taksi → `TaxiRide` (passenger eşleşmeli, status: completed)
- Her yorum türü için `entityType` + `entityId` + `verifiedPurchase: boolean` alanları gerekli

### #3 — Market Organizasyon (Zincir Mağaza Yönetimi)
- `Organization.js` modeli restoran için mevcut
- `MarketStore.js`'de `organization` alanı yok
- Zincir marketlerin tüm şubelerini tek panelden yönetmesi mümkün değil
- Yapılacaklar:
  - `MarketStore`'a `organization: ObjectId` alanı ekle
  - `market_org_owner` role veya mevcut `market_owner` role'e org izni
  - Org bazlı market listeleme endpoint'i
  - Org dashboard (toplu sipariş/stok görünümü)

### #4 — Taksi WebSocket — Uçtan Uca Test
- Socket servisi yazıldı (`taxiSocket.service.ts`)
- Sürücü ↔ Yolcu gerçek akışı hiç test edilmedi
- Test edilmesi gereken akışlar:
  1. Sürücü online olur → yolcu yeni taksi çağırır → sürücüye bildirim gider
  2. Sürücü kabul eder → yolcu TaxiMatched ekranında görür
  3. Sürücü konumu gerçek zamanlı güncellenir
  4. Yolculuk tamamlanır → her iki taraf bilgilendirilir
  5. 120 saniye dolunca sürücü bulunamazsa auto-cancel

---

## Önemli / Kullanıcıya Görünür 🟠

### #5 — Profil → Sürücü Paneline Geçiş Butonu
- `DriverHomeScreen` var ama `ProfileScreen`'de erişim butonu yok
- Sadece `role === 'driver'` veya `role === 'taxi_driver'` olanlar görmeli
- Geçiş butonu → `DriverNavigator`'a navigate

### #6 — Market Desktop Yönetim Paneli
- `rezzy-webpanel` restoran için var
- Market için `MarketOwnerDashboardScreen` sadece mobil ve eksik
- Yapılacaklar:
  - Web panel: sipariş yönetimi (bekleyen/hazırlanan/teslim)
  - Ürün ekleme / düzenleme / silme (fotoğraf ile)
  - Stok güncelleme
  - Çalışma saatleri
  - Şube yönetimi (org varsa)

### #7 — Taksi — Yolculuk Tamamlama Akışı
- `inProgress` → `completed` sonrası hiçbir şey yok
- Yapılacaklar:
  - Sürücü "Teslim Et" butonu → ride.status = completed
  - Yolcuya makbuz/özet sayfası (mesafe, süre, ücret, ödeme yöntemi)
  - Karşılıklı puanlama ekranı (yolcu → sürücüye, sürücü → yolcuya)
  - Stripe ödemesi varsa ödeme onayı

### #8 — Taksi — Sürücü Yolculuk Geçmişi
- `DriverHomeScreen`'de kazanç özeti var ama geçmiş yolculuk listesi yok
- Yapılacaklar:
  - `GET /api/taxi/driver/rides` endpoint (sayfalı)
  - Sürücü ekranında "Geçmiş" sekmesi
  - Her yolculuk: tarih, mesafe, ücret, yolcu puanı

### #9 — Market — Ürün Yönetimi (Mobil Panel)
- `MarketOwnerDashboardScreen` var ama içi boş/eksik
- Yapılacaklar:
  - Ürün listesi (kategori filtreli)
  - Ürün ekleme formu (başlık, fiyat, stok, kategori, fotoğraf)
  - Ürün düzenleme / silme
  - Stok hızlı güncelleme (sayı girişi)

### #10 — Market Sipariş Bildirimi (Push)
- Sipariş verilince market sahibine push notification gitmiyor
- Backend: `createOrder` controller'ında `notifyUser(ownerId, ...)` çağrısı eklenecek
- Frontend: market sahibi bildirimi tap'leyince sipariş detayına gitsin

---

## İyileştirme / Tamamlama 🟡

### #11 — Market Sipariş Detay Ekranı
- `MarketOrderDetailScreen.tsx` var — içeriği kontrol edilmeli
- Eksik olabilecekler: ürün listesi, teslimat adresi, durum takibi, iptal butonu

### #12 — MyOrdersScreen — Market Siparişleri
- Şu an restoran siparişleri gösteriyor
- Market siparişleri (`/api/market/orders`) ayrı tab veya birleşik liste olarak eklenmeli

### #13 — Taksi — Sürücü Kayıt Akışı
- `TaxiDriver` modeli var ama kullanıcının sürücü başvurusu yapacağı ekran/form yok
- Yapılacaklar:
  - Başvuru formu: ehliyet, araç bilgisi, plaka, fotoğraf
  - Admin onay akışı
  - Onay sonrası role güncelleme → driver paneli açılır

### #14 — Taksi — Aktif Yolculukta Gerçek Zamanlı Rota
- `inProgress` sırasında sürücü konumu güncelleniyor ama rota çizgisi yok
- Kalkış → mevcut konum → varış arası `Polyline` çizilmeli

### #15 — Market — Stok Tükenince Badge
- `MarketProduct.stock` alanı var
- `stock === 0` ise ürün kartında "Tükendi" overlay + sepete ekleme disable

### #16 — Taksi — Ödeme Makbuzu Ekranı
- Online ödeme Stripe ile alınıyor ama sonrasında makbuz/özet ekranı yok
- Yolculuk tamamlandıktan sonra: ücret, mesafe, süre, ödeme ref no

### #17 — Admin Paneli — Market & Taksi Modülleri
- Mevcut admin paneli: restoran, rezervasyon, kullanıcı, banner
- Eklenmesi gerekenler:
  - Market siparişleri listesi + durum yönetimi
  - Taksi yolculukları listesi + iptal yönetimi
  - Taksi sürücü başvuru onayları

---

## Küçük / Hızlı 🟢

| # | Görev |
|---|-------|
| #18 | Market ürün fotoğraf yükleme UI (Cloudinary zaten hazır) |
| #19 | `DriverHomeScreen`'de ortalama puan gösterme (`TaxiDriver.rating`) |
| #20 | `MarketStore.rating` otomatik güncelleme (yorum eklenince avg hesapla) |

---

## Alt Proje Grupları (Ajan Atama Planı)

| Öncelik | Alt Proje | İçerdiği görevler | Tahmini boyut |
|---------|-----------|-------------------|---------------|
| 1️⃣ | **Evrensel Yorum & Puanlama** | #1, #2, #20 | Orta |
| 2️⃣ | **Taksi WebSocket + Tamamlama** | #4, #5, #7, #8, #13, #14, #16, #19 | Büyük |
| 3️⃣ | **Market Desktop Panel + Org** | #3, #6, #9, #10, #15, #18 | Büyük |
| 4️⃣ | **Admin Panel Genişletme** | #17 | Küçük |
| 5️⃣ | **MyOrders + Bildirimler** | #10, #12 | Küçük |
| 6️⃣ | **Küçük İyileştirmeler** | #11, #15, #19 | Küçük |

---

## Bağımlılık Haritası

```
Yorum Sistemi (#1, #2)
    ├─ Taksi tamamlama akışı (#7) bağımlı  ← puan verebilmek için tamamlanmalı
    └─ MarketStore rating güncelleme (#20) bağımlı

Market Organizasyon (#3)
    └─ Market desktop panel (#6) bağımlı  ← org bazlı yönetim için gerekli

Taksi WebSocket testi (#4)
    ├─ Sürücü kayıt akışı (#13) bağımlı
    └─ Profil → driver butonu (#5) bağımlı
```

---

## Ajan Atama Notu

Her alt proje kendi başına çalışılabilir. Ajanlara atarken:
- **Küçük görevler** (#5, #18, #19, #20) → tek ajan, tek oturum
- **Orta görevler** (#1+#2, #12+#10) → tek ajan, odaklı oturum  
- **Büyük görevler** (#2️⃣ Taksi, #3️⃣ Market Panel) → alt görevlere böl, sırayla çalıştır
- Token limiti gözetilerek her ajan en fazla **2-3 dosya** değiştirecek şekilde bölünmeli

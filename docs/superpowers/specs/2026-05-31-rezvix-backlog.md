# Rezvix — Yapılacaklar Listesi (Backlog)
**Son güncelleme:** 2026-06-01  
**Durum:** Aktif — Oturum 1 tamamlandı

---

## ✅ Tamamlananlar

### ✅ #5 — Profil → Sürücü Paneline Geçiş Butonu
- `ProfileScreen.tsx` güncellendi
- `role === 'driver' || role === 'taxi_driver'` ise "Sürücü Paneli" butonu görünür
- `navigation.navigate('Driver')` ile yönlendirme
- **Commit:** `1b41c8a`

### ✅ #1 + #2 + #20 — Evrensel Yorum & Puanlama Sistemi
Tüm modüller için tek Review sistemi — gerçek müşteri doğrulamalı.

**Backend (`rezzy-backend`):**
- `Review.js` modeli: `entityType + entityId` polimorfizmi, `verifiedPurchase`, `orderId`, benzersiz index
- `review.controller.js`: `listReviews` (cursor pagination + summary) + `submitReview` (eligibility check + upsert)
- `review.routes.js`: `GET /api/reviews/:entityType/:entityId` (opsiyonel auth) + `POST` (zorunlu auth)
- `app.js`: review routes kayıtlı
- `MarketStore.js` + `TaxiDriver.js`: `ratingCount` alanı eklendi
- **Commits:** `7bc5496`, `9cc8ad2`, `3e67ff8`, `155e3b8`, `8770700`

**Frontend (`rezzy-app`):**
- `api/reviews.ts`: evrensel `ReviewEntityType`, `getReviews()`, `submitReview()` 3 parametre
- `components/ui/ReviewSection.tsx`: list + form + summary bar + NOT_ELIGIBLE handling
- `components/ui/index.ts`: `ReviewSection` export eklendi
- `RestaurantDetailScreen.tsx`: eski review kodu → `ReviewSection entityType="restaurant"`
- `MarketStoreScreen.tsx`: `ReviewSection entityType="market"` eklendi
- `TaxiMatchedScreen.tsx`: yolculuk tamamlanınca sürücü puanlama modal'ı
- **Commits:** `ab75aef`, `0724b73`, `8cab6cf`, `fdb1f72`, `04c7861`

---

## 🔴 Kritik / Eksik Altyapı

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
  1. Sürücü online → yolcu taksi çağırır → sürücüye bildirim
  2. Sürücü kabul eder → yolcu TaxiMatched ekranında görür
  3. Sürücü konumu gerçek zamanlı güncellenir
  4. Yolculuk tamamlanır → her iki taraf bilgilendirilir
  5. 120 saniye → auto-cancel

---

## 🟠 Önemli / Kullanıcıya Görünür

### #6 — Market Desktop Yönetim Paneli
- `rezzy-webpanel` restoran için var, market için yok
- Yapılacaklar:
  - Web panel: sipariş yönetimi
  - Ürün ekleme / düzenleme / silme (fotoğraf ile)
  - Stok güncelleme, çalışma saatleri
  - Şube yönetimi (org varsa)

### #7 — Taksi — Yolculuk Tamamlama Akışı
- `inProgress` → `completed` akışı eksik
- Sürücü tarafında "Teslim Et" butonu yok
- Yolcu tarafında makbuz/özet sayfası yok (`TaxiMatchedScreen` puanlama eklendi ✅)
- **Yapılacaklar:** Sürücü ekranına "Yolculuğu Tamamla" butonu + `PATCH /api/taxi/rides/:id/complete` endpoint

### #8 — Taksi — Sürücü Yolculuk Geçmişi
- `DriverHomeScreen`'de geçmiş yolculuk listesi yok
- Yapılacaklar:
  - `GET /api/taxi/driver/rides` endpoint (sayfalı)
  - Sürücü ekranında "Geçmiş" sekmesi

### #9 — Market — Ürün Yönetimi (Mobil Panel)
- `MarketOwnerDashboardScreen` var ama içi eksik
- Yapılacaklar: ürün listeleme, ekleme, düzenleme, silme, stok güncelleme

### #10 — Market Sipariş Bildirimi (Push)
- Sipariş gelince market sahibine push notification gitmiyor
- Backend: `createOrder` controller'a `notifyUser(ownerId, ...)` çağrısı

---

## 🟡 İyileştirme / Tamamlama

### #11 — Market Sipariş Detay Ekranı
- `MarketOrderDetailScreen.tsx` var — içeriği kontrol edilmeli
- Eksik olabilecekler: ürün listesi, durum takibi, iptal butonu

### #12 — MyOrdersScreen — Market Siparişleri
- Şu an restoran siparişleri gösteriyor, market siparişleri yok

### #13 — Taksi — Sürücü Kayıt Akışı
- `TaxiDriver` modeli var ama başvuru formu yok
- Yapılacaklar: ehliyet, araç bilgisi, fotoğraf → admin onay

### #14 — Taksi — Aktif Yolculukta Gerçek Zamanlı Rota
- `inProgress`'de sürücü konumu güncelleniyor ama Polyline yok

### #15 — Market — Stok Tükenince Badge
- `stock === 0` ise "Tükendi" overlay + sepete ekleme disable

### #16 — Taksi — Ödeme Makbuzu Ekranı
- Online ödeme sonrası makbuz/özet ekranı yok

### #17 — Admin Paneli — Market & Taksi Modülleri
- Market siparişleri, taksi yolculukları, sürücü başvuru onayları

---

## 🟢 Küçük / Hızlı

| # | Görev | Durum |
|---|-------|-------|
| #18 | Market ürün fotoğraf yükleme UI | ⏳ |
| #19 | DriverHomeScreen'de ortalama puan gösterme | ⏳ |
| #20 | MarketStore.rating otomatik güncelleme | ✅ (review controller'da updateEntityRating ile yapıldı) |

---

## Sıradaki Oturum Planı

### Oturum 2 — Taksi Tamamlama + Küçük Görevler
Token yenilenince şu sırayla:

**Adım 1 — Küçük task'lar (ısınma, 2 ajan):**
- **#19** — `DriverHomeScreen`: `TaxiDriver.ratingCount` varsa ortalama puan + toplam say göster
- **#11** — `MarketOrderDetailScreen` içeriği kontrol et, eksik bölümleri tamamla

**Adım 2 — Taksi Tamamlama (3-4 ajan):**
- **#7** — Backend: `PATCH /api/taxi/rides/:id/complete` endpoint + `DriverHomeScreen`'e "Yolculuğu Tamamla" butonu
- **#8** — Sürücü geçmiş yolculuklar: `GET /api/taxi/driver/rides` + `DriverHomeScreen` geçmiş sekmesi
- **#16** — Yolculuk tamamlama sonrası makbuz ekranı (yolcu tarafı)

**Adım 3 — Market Bildirimleri (1-2 ajan):**
- **#10** — Market siparişi push notification

### Oturum 3 — Market Desktop Panel + Organizasyon
- **#3** — MarketStore'a organization alanı
- **#6** — Market desktop yönetim paneli (web)
- **#9** — Mobil market ürün yönetimi

### Oturum 4 — Diğerleri
- **#12** MyOrders market siparişleri
- **#13** Sürücü kayıt akışı
- **#17** Admin panel market/taksi

---

## Ajan Atama Notları
- Her ajan **tek worktree** → izole çalışır, merge edilir
- Backend ve frontend **bağımsız task'lar** paralel çalışabilir
- Her task sonrası spec review + code quality review zorunlu
- **Token tasarrufu:** Subagent-driven yaklaşım kullanılıyor — bu session'a sadece özet ekleniyor

# Rezvix — Yapılacaklar Listesi (Backlog)
**Son güncelleme:** 2026-06-01  
**Durum:** Aktif — Oturum 3 kısmen tamamlandı

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

### ✅ #19 — DriverHomeScreen Puan Gösterimi
- Backend `getEarnings`: `rating` → `averageRating` yeniden adlandırıldı, `ratingCount` eklendi
- `DriverEarnings` type güncellendi (`ratingCount`, `todayRideCount`, `weekEarnings`)
- `DriverHomeScreen` earnings badge'ine `ratingCount` gösterimi: "Puan (42)"
- **Commits:** `1bbd526` (backend), `c10be57` (frontend)

### ✅ #11 — Market Sipariş Detay Ekranı
- `MarketOrderDetailScreen.tsx` eksiksiz: durum adımları, ürün listesi, ödeme özeti mevcut
- `pending` / `confirmed` siparişler için kırmızı "Siparişi İptal Et" butonu eklendi
- `cancelOrder` API + Alert onay dialog + optimistik UI güncelleme
- **Commit:** `c10be57`

### ✅ #7 — Taksi Yolculuk Tamamlama Akışı
- Backend `PATCH /api/taxi/rides/:id/start` (matched → inProgress) ve `PATCH .../complete` zaten mevcuttu
- `api/taxi.ts`: `startRide()` ve `completeRide()` fonksiyonları eklendi
- `DriverIncomingRideScreen`: `onAccepted(payload)` callback prop eklendi
- `DriverHomeScreen`: aktif yolculuk kartı overlay — eşleşme sonrası kart görünür
  - "Yolculuğu Başlat" butonu (`matched` durumu)
  - "Yolculuğu Tamamla" butonu (`inProgress` durumu)
  - socket `ride:status_change` ile otomatik durum güncellemesi
- **Commit:** `5c32125`

### ✅ #8 — Sürücü Geçmiş Yolculuklar
- Backend: `GET /api/taxi/driver/rides` endpoint — cursor tabanlı sayfalama (commit `e2ebe66`)
- `api/taxi.ts`: `getDriverRides(cursor?, limit?)` fonksiyonu eklendi
- `DriverHomeScreen`: "Ana Sayfa / Geçmiş" sekme yapısı eklendi
  - Geçmiş kartları: yolcu adı, ücret, mesafe, tarih, durum badge'i
  - Cursor tabanlı "Daha Fazla" yükleme
- **Commits:** `e2ebe66` (backend), `2736385` (frontend)

### ✅ #3 — Market Organizasyon (Zincir Mağaza Yönetimi)
- `MarketStore.js`: `organization: ObjectId → Organization` alanı eklendi (optional, indexed)
- Compound index: `{ organization: 1, isActive: 1 }` → `market_store_org_active`
- `marketPanel.controller.js`: `listOrgStores` export eklendi — aynı org'a ait aktif şubeler
- `marketPanel.routes.js`: `GET /api/market/panel/org/stores` route kayıtlı
- **Commit:** `7beedee`

### ✅ #9 — Market Ürün Yönetimi (Mobil Panel)
- `market.api.ts`: `PanelProduct` tipi + `getPanelProducts`, `createPanelProduct`, `updatePanelProduct`, `deletePanelProduct`
- `MarketOwnerDashboardScreen`: "Siparişler / Ürünler" üst sekme yapısı eklendi
  - Ürünler sekmesi: liste (ad, birim, stok, fiyat), düzenle + sil butonları
  - "Ürün Ekle" butonu → pageSheet modal (ad, fiyat, stok, birim)
  - Lazy-load: sekmeye ilk geçişte yükleme
- **Commit:** `863cc36`

### ✅ #10 — Market Sipariş Push Bildirimi
- `notification.i18n.js`: `market_new_order` key'i eklendi (TR/EN/RU/EL)
- `market.controller.js` `createOrder`: her iki ödeme path'inde (nakit + online) `notifyUser(store.owner)` çağrısı
- **Commit:** `90de014`

---

## 🔴 Kritik / Eksik Altyapı

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


---

## 🟡 İyileştirme / Tamamlama

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
| #19 | DriverHomeScreen'de ortalama puan gösterme | ✅ (Oturum 2'de tamamlandı) |
| #20 | MarketStore.rating otomatik güncelleme | ✅ (review controller'da updateEntityRating ile yapıldı) |

---

## Sıradaki Oturum Planı

### Oturum 3 — ✅ Kısmen Tamamlandı
- ~~**#3**~~ ✅ MarketStore organization alanı
- ~~**#9**~~ ✅ Mobil market ürün yönetimi
- **#6** — Market desktop yönetim paneli (web — `rezzy-webpanel`) → **Oturum 4'e taşındı** (büyük task)

### Oturum 4 — Market Web Panel + Diğerleri
- **#6** — Market desktop yönetim paneli (`rezzy-webpanel` — sipariş + ürün + stok)
- **#12** — MyOrdersScreen'e market siparişleri ekle
- **#15** — Market stok tükenince "Tükendi" badge
- **#16** — Yolcu makbuz ekranı (yolculuk sonrası özet)
- **#13** — Sürücü kayıt akışı (başvuru formu + admin onay)
- **#14** — Aktif yolculukta Polyline rota çizgisi
- **#17** — Admin panel market & taksi modülleri

---

## Ajan Atama Notları
- Her ajan **tek worktree** → izole çalışır, merge edilir
- Backend ve frontend **bağımsız task'lar** paralel çalışabilir
- Her task sonrası spec review + code quality review zorunlu
- **Token tasarrufu:** Subagent-driven yaklaşım kullanılıyor — bu session'a sadece özet ekleniyor

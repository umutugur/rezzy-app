# Universal Review & Rating System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single Review system that covers restaurant, market, paket servis (delivery) and taxi — with verified-purchase gating so only real customers can review.

**Architecture:** One universal `Review` document with `entityType + entityId` polymorphism. Eligibility is checked server-side at write time by querying the relevant order/ride collection. Entity average ratings are recalculated and written back after each new review.

**Tech Stack:** Node.js / Express / Mongoose (backend) — React Native / TypeScript (frontend)

---

## Mevcut Durum (Başlamadan Önce Oku)

| Durum | Detay |
|-------|-------|
| `Review.js` model | Var — ama sadece `restaurantId` biliyor |
| Public review endpoints | **YOK** — sadece admin moderation endpoints var |
| Frontend `reviews.ts` | Var ama `/restaurants/:id/reviews` 404 döndürüyor |
| `StarRating.tsx` | Var ve kullanıma hazır |
| `RestaurantDetailScreen` | Review UI var ama bağlantısız |

---

## File Structure

### Backend (`rezzy-backend/src/`)
| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `models/Review.js` | **Modify** | entityType/entityId/verifiedPurchase/orderId alanları eklenir |
| `controllers/review.controller.js` | **Create** | list + submit + eligibility check |
| `routes/review.routes.js` | **Create** | GET + POST /api/reviews/:entityType/:entityId |
| `app.js` | **Modify** | review routes register et |

### Frontend (`rezzy-app/src/`)
| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `api/reviews.ts` | **Modify** | Tüm entity türlerini destekle |
| `components/ui/ReviewSection.tsx` | **Create** | List + form — her ekranda tekrar kullanılır |
| `components/ui/index.ts` | **Modify** | ReviewSection export ekle |
| `screens/RestaurantDetailScreen.tsx` | **Modify** | Yeni ReviewSection ile değiştir |
| `screens/market/MarketStoreScreen.tsx` | **Modify** | ReviewSection ekle |
| `screens/market/MarketOrderDetailScreen.tsx` | **Modify** | Siparişi tamamlanan kullanıcıya puan formu |
| `screens/taxi/TaxiMatchedScreen.tsx` | **Modify** | Yolculuk bitti → sürücüye puan ver |

---

## Task 1 — Review Model Güncelle (Backend)

**Files:**
- Modify: `rezzy-backend/src/models/Review.js`

- [ ] **Step 1: Review.js'i oku ve yeni şemayı yaz**

```javascript
// rezzy-backend/src/models/Review.js
import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    // ─── Hangi varlık için? ─────────────────────────────────────────────
    entityType: {
      type: String,
      enum: ["restaurant", "market", "delivery", "taxi_driver"],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // ─── Yazan kullanıcı ─────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ─── Değerlendirme ───────────────────────────────────────────────────
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },

    // ─── Gerçek müşteri doğrulaması ──────────────────────────────────────
    verifiedPurchase: { type: Boolean, default: false },
    orderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    orderModel: {
      type: String,
      enum: ["Order", "DeliveryOrder", "MarketOrder", "TaxiRide", null],
      default: null,
    },

    // ─── Moderasyon ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["visible", "hidden", "removed"],
      default: "visible",
      index: true,
    },
  },
  { timestamps: true }
);

// Bir kullanıcı aynı entity için yalnızca 1 yorum yapabilir
ReviewSchema.index(
  { entityType: 1, entityId: 1, userId: 1 },
  { unique: true, name: "review_entity_user_unique" }
);

ReviewSchema.index(
  { entityType: 1, entityId: 1, status: 1, createdAt: -1 },
  { name: "review_entity_status_date" }
);

export default mongoose.model("Review", ReviewSchema);
```

- [ ] **Step 2: Commit**

```bash
cd rezzy-backend
git add src/models/Review.js
git commit -m "feat(reviews): Review modeli entityType/entityId/verifiedPurchase ile genişletildi"
```

---

## Task 2 — Review Controller (Backend)

**Files:**
- Create: `rezzy-backend/src/controllers/review.controller.js`

- [ ] **Step 1: Dosyayı oluştur**

```javascript
// rezzy-backend/src/controllers/review.controller.js
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Restaurant from "../models/Restaurant.js";
import MarketStore from "../models/MarketStore.js";
import TaxiDriver from "../models/TaxiDriver.js";
import Order from "../models/Order.js";
import DeliveryOrder from "../models/DeliveryOrder.js";
import MarketOrder from "../models/MarketOrder.js";
import TaxiRide from "../models/TaxiRide.js";

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
};

// ─── Entity ID doğrulama ─────────────────────────────────────────────────────

async function entityExists(entityType, entityId) {
  switch (entityType) {
    case "restaurant":
      return !!(await Restaurant.exists({ _id: entityId }));
    case "market":
      return !!(await MarketStore.exists({ _id: entityId }));
    case "delivery":
      return !!(await Restaurant.exists({ _id: entityId }));
    case "taxi_driver":
      return !!(await TaxiDriver.exists({ _id: entityId }));
    default:
      return false;
  }
}

// ─── Gerçek müşteri kontrolü ────────────────────────────────────────────────

async function checkEligibility(entityType, entityId, userId) {
  const uid = toObjectId(userId);
  const eid = toObjectId(entityId);

  switch (entityType) {
    case "restaurant": {
      // QR sipariş veya rezervasyon tamamlanmış olmalı
      const hasOrder = await Order.exists({
        restaurantId: eid,
        userId: uid,
        paymentStatus: "paid",
      });
      if (hasOrder) return { eligible: true, orderId: null, orderModel: "Order" };

      const { Reservation } = await import("../models/Reservation.js");
      const hasReservation = await Reservation.exists({
        restaurantId: eid,
        userId: uid,
        status: { $in: ["confirmed", "arrived", "completed"] },
      });
      if (hasReservation) return { eligible: true, orderId: null, orderModel: "Order" };

      return { eligible: false };
    }

    case "delivery": {
      const order = await DeliveryOrder.findOne({
        restaurantId: eid,
        userId: uid,
        status: "delivered",
      }).select("_id").lean();
      if (order) return { eligible: true, orderId: order._id, orderModel: "DeliveryOrder" };
      return { eligible: false };
    }

    case "market": {
      const order = await MarketOrder.findOne({
        store: eid,
        customer: uid,
        status: "delivered",
      }).select("_id").lean();
      if (order) return { eligible: true, orderId: order._id, orderModel: "MarketOrder" };
      return { eligible: false };
    }

    case "taxi_driver": {
      const ride = await TaxiRide.findOne({
        driver: eid,
        passenger: uid,
        status: "completed",
      }).select("_id").lean();
      if (ride) return { eligible: true, orderId: ride._id, orderModel: "TaxiRide" };
      return { eligible: false };
    }

    default:
      return { eligible: false };
  }
}

// ─── Entity rating güncelle ──────────────────────────────────────────────────

async function updateEntityRating(entityType, entityId) {
  const agg = await Review.aggregate([
    {
      $match: {
        entityType,
        entityId: toObjectId(entityId),
        status: "visible",
      },
    },
    {
      $group: {
        _id: null,
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const avg = agg[0]?.avg ?? 0;
  const count = agg[0]?.count ?? 0;
  const rounded = Math.round(avg * 10) / 10;

  switch (entityType) {
    case "restaurant":
    case "delivery":
      await Restaurant.updateOne(
        { _id: entityId },
        { $set: { rating: rounded, ratingCount: count } }
      );
      break;
    case "market":
      await MarketStore.updateOne(
        { _id: entityId },
        { $set: { rating: rounded, ratingCount: count } }
      );
      break;
    case "taxi_driver":
      await TaxiDriver.updateOne(
        { _id: entityId },
        { $set: { rating: rounded, ratingCount: count } }
      );
      break;
  }
}

// ─── GET /api/reviews/:entityType/:entityId ──────────────────────────────────

export async function listReviews(req, res, next) {
  try {
    const { entityType, entityId } = req.params;
    const validTypes = ["restaurant", "market", "delivery", "taxi_driver"];

    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ message: "Geçersiz entityType" });
    }
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ message: "Geçersiz entityId" });
    }

    const eid = toObjectId(entityId);
    const { limit = 20, cursor } = req.query;
    const lim = Math.min(Number(limit) || 20, 50);

    const query = {
      entityType,
      entityId: eid,
      status: "visible",
    };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: toObjectId(cursor) };
    }

    const reviews = await Review.find(query)
      .sort({ _id: -1 })
      .limit(lim + 1)
      .populate("userId", "name avatar")
      .lean();

    const hasMore = reviews.length > lim;
    const items = hasMore ? reviews.slice(0, lim) : reviews;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    // Özet istatistik
    const summaryAgg = await Review.aggregate([
      { $match: { entityType, entityId: eid, status: "visible" } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalCount: { $sum: 1 },
          dist1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          dist2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          dist3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          dist4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          dist5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        },
      },
    ]);

    const s = summaryAgg[0];
    const summary = s
      ? {
          averageRating: Math.round((s.averageRating ?? 0) * 10) / 10,
          totalCount: s.totalCount,
          distribution: [1, 2, 3, 4, 5].map((star) => ({
            star,
            count: s[`dist${star}`] ?? 0,
          })),
        }
      : { averageRating: 0, totalCount: 0, distribution: [] };

    // Giriş yapmış kullanıcının kendi yorumu var mı?
    let userReview = null;
    if (req.user) {
      userReview = await Review.findOne({
        entityType,
        entityId: eid,
        userId: toObjectId(req.user.id),
      }).lean();
    }

    return res.json({ reviews: items, summary, nextCursor, userReview });
  } catch (e) {
    next(e);
  }
}

// ─── POST /api/reviews/:entityType/:entityId ─────────────────────────────────

export async function submitReview(req, res, next) {
  try {
    const { entityType, entityId } = req.params;
    const { rating, comment = "" } = req.body;
    const userId = req.user?.id;

    const validTypes = ["restaurant", "market", "delivery", "taxi_driver"];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ message: "Geçersiz entityType" });
    }
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ message: "Geçersiz entityId" });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating 1-5 arasında olmalı" });
    }

    // Entity var mı?
    const exists = await entityExists(entityType, entityId);
    if (!exists) {
      return res.status(404).json({ message: "İlgili yer bulunamadı" });
    }

    // Müşteri doğrula
    const eligibility = await checkEligibility(entityType, entityId, userId);
    if (!eligibility.eligible) {
      return res.status(403).json({
        message: "Bu yeri değerlendirmek için önce sipariş vermiş veya ziyaret etmiş olmanız gerekiyor.",
        code: "NOT_ELIGIBLE",
      });
    }

    // Daha önce yorum yapmış mı?
    const existing = await Review.findOne({
      entityType,
      entityId: toObjectId(entityId),
      userId: toObjectId(userId),
    });

    let review;
    if (existing) {
      // Güncelle
      existing.rating = rating;
      existing.comment = String(comment).trim();
      existing.verifiedPurchase = true;
      review = await existing.save();
    } else {
      // Yeni oluştur
      review = await Review.create({
        entityType,
        entityId: toObjectId(entityId),
        userId: toObjectId(userId),
        rating,
        comment: String(comment).trim(),
        verifiedPurchase: true,
        orderId: eligibility.orderId,
        orderModel: eligibility.orderModel,
      });
    }

    // Entity rating'ini güncelle (async, yanıtı bloklamasın)
    updateEntityRating(entityType, entityId).catch((e) =>
      console.error("[review] updateEntityRating error", e)
    );

    return res.status(201).json(review);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Bu yer için zaten bir yorumunuz var." });
    }
    next(e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/controllers/review.controller.js
git commit -m "feat(reviews): review controller — list + submit + eligibility check"
```

---

## Task 3 — Review Routes + App.js (Backend)

**Files:**
- Create: `rezzy-backend/src/routes/review.routes.js`
- Modify: `rezzy-backend/src/app.js`

- [ ] **Step 1: Route dosyasını oluştur**

```javascript
// rezzy-backend/src/routes/review.routes.js
import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { listReviews, submitReview } from "../controllers/review.controller.js";

const r = Router();

// Herkes okuyabilir (opsiyonel auth — giriş yapmışsa userReview döner)
r.get("/reviews/:entityType/:entityId", auth(false), listReviews);

// Sadece giriş yapmış kullanıcılar yorum yapabilir
r.post("/reviews/:entityType/:entityId", auth(), submitReview);

export default r;
```

- [ ] **Step 2: app.js'e ekle**

`rezzy-backend/src/app.js` dosyasında diğer route import'larının yanına ekle:

```javascript
import reviewRoutes from "./routes/review.routes.js";
// ...
app.use("/api", reviewRoutes);
```

- [ ] **Step 3: Admin controller'daki listReviews'i güncelle (yeni entityType filtresi ekle)**

`rezzy-backend/src/controllers/admin.controller.js` içinde `listReviews` fonksiyonunu bul:

```javascript
// Mevcut:
// if (restaurantId) q.restaurantId = toObjectId(restaurantId);
// Yeni — entityType/entityId ile de filtrelenebilsin:
export const listReviews = async (req, res, next) => {
  try {
    const { entityType, entityId, restaurantId, userId, status } = req.query;
    const { limit, cursor } = pageParams(req.query);
    const q = {};
    if (entityType) q.entityType = entityType;
    if (entityId) q.entityId = toObjectId(entityId);
    if (restaurantId) {
      // geriye dönük uyumluluk
      q.entityType = "restaurant";
      q.entityId = toObjectId(restaurantId);
    }
    if (userId) q.userId = toObjectId(userId);
    if (status) q.status = status;
    if (cursor) q._id = { $lt: cursor };

    const rows = await Review.find(q)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    res.json({ items: cut(rows, limit), nextCursor: nextCursor(rows, limit) });
  } catch (e) {
    next(e);
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/review.routes.js src/app.js src/controllers/admin.controller.js
git commit -m "feat(reviews): review routes kayıt + admin listReviews entityType desteği"
```

- [ ] **Step 5: Deployment testi**

```bash
# Backend Render'a deploy olduktan sonra:
curl -s "https://rezzy-backend.onrender.com/api/reviews/restaurant/GECERLI_RESTAURANT_ID" | python3 -m json.tool
# Beklenen: { "reviews": [], "summary": {...}, "nextCursor": null, "userReview": null }
```

---

## Task 4 — Frontend reviews.ts API Güncelle

**Files:**
- Modify: `rezzy-app/src/api/reviews.ts`

- [ ] **Step 1: Tüm dosyayı yeni haliye yaz**

```typescript
// rezzy-app/src/api/reviews.ts
import api from "./client";

export type ReviewEntityType = "restaurant" | "market" | "delivery" | "taxi_driver";

export type Review = {
  _id: string;
  entityType: ReviewEntityType;
  entityId: string;
  userId: string | { _id: string; name: string; avatar?: string | null };
  rating: number;
  comment?: string | null;
  verifiedPurchase: boolean;
  status: "visible" | "hidden" | "removed";
  createdAt: string;
};

export type ReviewSummary = {
  averageRating: number;
  totalCount: number;
  distribution: { star: 1 | 2 | 3 | 4 | 5; count: number }[];
};

export type ReviewsResponse = {
  reviews: Review[];
  summary: ReviewSummary;
  nextCursor: string | null;
  userReview: Review | null;
};

export async function getReviews(
  entityType: ReviewEntityType,
  entityId: string,
  cursor?: string | null,
): Promise<ReviewsResponse> {
  const params: Record<string, any> = { limit: 20 };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get<ReviewsResponse>(
    `/reviews/${entityType}/${entityId}`,
    { params },
  );
  return data;
}

export async function submitReview(
  entityType: ReviewEntityType,
  entityId: string,
  payload: { rating: number; comment?: string },
): Promise<Review> {
  const { data } = await api.post<Review>(
    `/reviews/${entityType}/${entityId}`,
    payload,
  );
  return data;
}

// ─── Geriye dönük uyumluluk (RestaurantDetailScreen hâlâ eskisini kullanıyor olabilir)
export async function getRestaurantReviews(restaurantId: string): Promise<ReviewsResponse> {
  return getReviews("restaurant", restaurantId);
}
```

- [ ] **Step 2: TypeScript kontrol**

```bash
cd rezzy-app && npx tsc --noEmit
# Beklenen: sıfır hata
```

- [ ] **Step 3: Commit**

```bash
git add src/api/reviews.ts
git commit -m "feat(reviews): reviews.ts API evrensel entityType desteği"
```

---

## Task 5 — ReviewSection Bileşeni (Frontend)

**Files:**
- Create: `rezzy-app/src/components/ui/ReviewSection.tsx`
- Modify: `rezzy-app/src/components/ui/index.ts`

- [ ] **Step 1: Bileşeni oluştur**

```tsx
// rezzy-app/src/components/ui/ReviewSection.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { StarRating } from "./StarRating";
import {
  getReviews,
  submitReview,
  type ReviewEntityType,
  type Review,
  type ReviewSummary,
} from "../../api/reviews";
import { useAuth } from "../../store/useAuth";

interface ReviewSectionProps {
  entityType: ReviewEntityType;
  entityId: string;
  style?: ViewStyle;
}

function ReviewCard({ review }: { review: Review }) {
  const theme = useTheme();
  const userName =
    typeof review.userId === "object"
      ? review.userId.name
      : "Kullanıcı";
  const date = new Date(review.createdAt).toLocaleDateString("tr-TR");

  return (
    <View
      style={{
        padding: theme.space[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.borderDefault,
        gap: theme.space[1],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>
          {userName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space[2] }}>
          <StarRating rating={review.rating} size="sm" readonly />
          <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
            {date}
          </Text>
        </View>
      </View>
      {!!review.comment && (
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
          {review.comment}
        </Text>
      )}
      {review.verifiedPurchase && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.success }}>
          ✓ Doğrulanmış müşteri
        </Text>
      )}
    </View>
  );
}

function SummaryBar({ summary }: { summary: ReviewSummary }) {
  const theme = useTheme();
  if (summary.totalCount === 0) return null;

  return (
    <View
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.lg,
        marginBottom: theme.space[3],
        gap: theme.space[2],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.space[3] }}>
        <Text style={{ ...theme.typography.displayLg, color: theme.colors.textPrimary }}>
          {summary.averageRating.toFixed(1)}
        </Text>
        <View style={{ gap: theme.space[1] }}>
          <StarRating rating={summary.averageRating} size="sm" readonly />
          <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
            {summary.totalCount} değerlendirme
          </Text>
        </View>
      </View>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = summary.distribution.find((d) => d.star === star)?.count ?? 0;
        const pct = summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0;
        return (
          <View key={star} style={{ flexDirection: "row", alignItems: "center", gap: theme.space[2] }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, width: 10 }}>
              {star}
            </Text>
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.borderDefault,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: theme.colors.warning,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, width: 24 }}>
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReviewSection({ entityType, entityId, style }: ReviewSectionProps) {
  const theme = useTheme();
  const token = useAuth((s) => s.token);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [writeOpen, setWriteOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (cursor?: string | null) => {
      try {
        if (!cursor) setLoading(true);
        else setLoadingMore(true);
        const res = await getReviews(entityType, entityId, cursor);
        setReviews((prev) => (cursor ? [...prev, ...res.reviews] : res.reviews));
        setSummary(res.summary);
        setNextCursor(res.nextCursor);
        setUserReview(res.userReview);
      } catch {
        // sessiz
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityType, entityId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      Alert.alert("Giriş Gerekli", "Yorum yazmak için giriş yapmalısınız.");
      return;
    }
    setSubmitting(true);
    try {
      const review = await submitReview(entityType, entityId, {
        rating: newRating,
        comment: newComment.trim() || undefined,
      });
      setUserReview(review);
      setWriteOpen(false);
      setNewComment("");
      load(); // özeti yenile
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === "NOT_ELIGIBLE") {
        Alert.alert(
          "Yorum Yapılamıyor",
          "Bu yer için yorum yapabilmek için önce sipariş vermiş veya ziyaret etmiş olmanız gerekiyor.",
        );
      } else {
        Alert.alert("Hata", e?.response?.data?.message ?? "Yorum gönderilemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [token, entityType, entityId, newRating, newComment, load]);

  if (loading) {
    return (
      <View style={[{ padding: theme.space[4], alignItems: "center" }, style]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ gap: theme.space[3] }, style]}>
      <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary }}>
        Değerlendirmeler
      </Text>

      {summary && <SummaryBar summary={summary} />}

      {/* Yorum yaz butonu — zaten yorum varsa gösterme */}
      {token && !userReview && !writeOpen && (
        <TouchableOpacity
          onPress={() => setWriteOpen(true)}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.lg,
            paddingVertical: theme.space[3],
            alignItems: "center",
          }}
        >
          <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
            Yorum Yaz
          </Text>
        </TouchableOpacity>
      )}

      {/* Yorum formu */}
      {writeOpen && (
        <View
          style={{
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.lg,
            padding: theme.space[4],
            gap: theme.space[3],
            borderWidth: 1,
            borderColor: theme.colors.borderDefault,
          }}
        >
          <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
            Değerlendirmeniz
          </Text>
          <StarRating
            value={newRating}
            onChange={setNewRating}
            size="lg"
          />
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Yorumunuzu yazın (opsiyonel)"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            style={{
              borderWidth: 1,
              borderColor: theme.colors.borderDefault,
              borderRadius: theme.radius.md,
              padding: theme.space[3],
              color: theme.colors.textPrimary,
              minHeight: 80,
              ...theme.typography.bodyMd,
            }}
          />
          <View style={{ flexDirection: "row", gap: theme.space[2] }}>
            <TouchableOpacity
              onPress={() => setWriteOpen(false)}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                borderRadius: theme.radius.md,
                paddingVertical: theme.space[2],
                alignItems: "center",
              }}
            >
              <Text style={{ ...theme.typography.labelMd, color: theme.colors.textSecondary }}>
                İptal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.md,
                paddingVertical: theme.space[2],
                alignItems: "center",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.textInverse} size="small" />
              ) : (
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textInverse }}>
                  Gönder
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Kullanıcının kendi yorumu */}
      {userReview && (
        <View>
          <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: theme.space[1] }}>
            Yorumunuz
          </Text>
          <ReviewCard review={userReview} />
        </View>
      )}

      {/* Diğer yorumlar */}
      {reviews.filter((r) => r._id !== userReview?._id).map((review) => (
        <ReviewCard key={review._id} review={review} />
      ))}

      {summary?.totalCount === 0 && !userReview && (
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: "center" }}>
          Henüz yorum yok. İlk yorumu sen yaz!
        </Text>
      )}

      {/* Daha fazla yükle */}
      {nextCursor && (
        <TouchableOpacity
          onPress={() => load(nextCursor)}
          disabled={loadingMore}
          style={{ alignItems: "center", paddingVertical: theme.space[3] }}
        >
          {loadingMore ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Text style={{ ...theme.typography.labelMd, color: theme.colors.primary }}>
              Daha Fazla Göster
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
```

- [ ] **Step 2: index.ts'e ekle**

`rezzy-app/src/components/ui/index.ts` dosyasında mevcut export'ların sonuna ekle:

```typescript
export { ReviewSection } from "./ReviewSection";
```

- [ ] **Step 3: TypeScript kontrol**

```bash
cd rezzy-app && npx tsc --noEmit
# Beklenen: sıfır hata
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ReviewSection.tsx src/components/ui/index.ts
git commit -m "feat(reviews): ReviewSection evrensel bileşeni"
```

---

## Task 6 — RestaurantDetailScreen Entegrasyonu

**Files:**
- Modify: `rezzy-app/src/screens/RestaurantDetailScreen.tsx`

- [ ] **Step 1: Dosyayı oku, mevcut review import'larını bul**

Dosyanın başında şunu bul:
```typescript
import { getRestaurantReviews, submitReview, type Review, type ReviewSummary } from "../api/reviews";
```

- [ ] **Step 2: Import'u güncelle ve ReviewSection kullan**

```typescript
// Eski import'u kaldır:
// import { getRestaurantReviews, submitReview, type Review, type ReviewSummary } from "../api/reviews";

// Yeni import ekle (zaten ui/index.ts'den çıkıyor):
import { ReviewSection } from "../components/ui";
```

- [ ] **Step 3: State'leri temizle**

Şu state satırlarını kaldır (artık ReviewSection yönetiyor):
```typescript
// KALDIR:
// const [reviews, setReviews] = useState<Review[]>([]);
// const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
// const [reviewsLoading, setReviewsLoading] = useState(false);
// const [newRating, setNewRating] = useState(5);
// const [newComment, setNewComment] = useState("");
// const [submitingReview, setSubmitingReview] = useState(false);
// const [writeReviewOpen, setWriteReviewOpen] = useState(false);
// const loadReviews = ... (bütün fonksiyonu kaldır)
```

- [ ] **Step 4: Review bölümünü değiştir**

Şu anda JSX'te review render eden bölümü bul ve şununla değiştir:

```tsx
{/* Reviews */}
{restaurantId ? (
  <ReviewSection
    entityType="restaurant"
    entityId={restaurantId}
    style={{ paddingHorizontal: 16, paddingVertical: 12 }}
  />
) : null}
```

- [ ] **Step 5: TypeScript kontrol + commit**

```bash
cd rezzy-app && npx tsc --noEmit
git add src/screens/RestaurantDetailScreen.tsx
git commit -m "feat(reviews): RestaurantDetailScreen ReviewSection ile güncellendi"
```

---

## Task 7 — MarketStoreScreen Entegrasyonu

**Files:**
- Modify: `rezzy-app/src/screens/market/MarketStoreScreen.tsx`

- [ ] **Step 1: Import ekle**

```typescript
import { ReviewSection } from "../../components/ui";
```

- [ ] **Step 2: Store'un en altına (sepet butonunun üstüne) ReviewSection ekle**

`storeId` değişkeni zaten mevcut olmalı. `ScrollView` içinde ürün listesinin altına:

```tsx
{/* Yorumlar */}
{storeId ? (
  <ReviewSection
    entityType="market"
    entityId={storeId}
    style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
  />
) : null}
```

- [ ] **Step 3: TypeScript kontrol + commit**

```bash
cd rezzy-app && npx tsc --noEmit
git add src/screens/market/MarketStoreScreen.tsx
git commit -m "feat(reviews): MarketStoreScreen değerlendirme bölümü eklendi"
```

---

## Task 8 — TaxiMatchedScreen — Sürücü Puanlama

**Files:**
- Modify: `rezzy-app/src/screens/taxi/TaxiMatchedScreen.tsx`

- [ ] **Step 1: Import ekle**

```typescript
import { StarRating } from "../../components/ui/StarRating";
import { submitReview } from "../../api/reviews";
```

- [ ] **Step 2: State ekle (component içinde, tüm hook'lardan önce)**

```typescript
const [ratingOpen, setRatingOpen] = useState(false);
const [driverRating, setDriverRating] = useState(5);
const [ratingSubmitting, setRatingSubmitting] = useState(false);
const [ratingDone, setRatingDone] = useState(false);
```

- [ ] **Step 3: Yolculuk tamamlanınca puan formu aç**

`onStatusChange` socket handler içinde:
```typescript
} else if (payload.status === "completed") {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setRatingOpen(true); // puan formu aç
}
```

- [ ] **Step 4: Puan gönderme fonksiyonu**

```typescript
const handleRatingSubmit = useCallback(async () => {
  const driverId = ride?.driver?._id ?? ride?.driver?.user?._id ?? ride?.driver;
  if (!driverId) {
    navigation.goBack();
    return;
  }
  setRatingSubmitting(true);
  try {
    await submitReview("taxi_driver", String(driverId), { rating: driverRating });
    setRatingDone(true);
  } catch {
    // NOT_ELIGIBLE veya diğer hatalar sessiz geçsin
  } finally {
    setRatingSubmitting(false);
    setTimeout(() => navigation.goBack(), 1200);
  }
}, [ride, driverRating, navigation]);
```

- [ ] **Step 5: Puan modal'ı ekle (return içinde, `<View style={s.root}>` içine)**

```tsx
{/* Yolculuk tamamlandı → sürücü puanla */}
{ratingOpen && (
  <View
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.space[6],
    }}
  >
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius["2xl"],
        padding: theme.space[6],
        width: "100%",
        gap: theme.space[4],
        alignItems: "center",
      }}
    >
      {ratingDone ? (
        <Text style={{ ...theme.typography.headingMd, color: theme.colors.success }}>
          ✓ Teşekkürler!
        </Text>
      ) : (
        <>
          <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, textAlign: "center" }}>
            Yolculuğunuz tamamlandı
          </Text>
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: "center" }}>
            Sürücünüzü değerlendirin
          </Text>
          <StarRating value={driverRating} onChange={setDriverRating} size="lg" />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={ratingSubmitting}
            onPress={handleRatingSubmit}
            style={{ backgroundColor: theme.taxi.main }}
          >
            Puanı Gönder
          </Button>
          <TouchableOpacity onPress={() => { setRatingOpen(false); navigation.goBack(); }}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Atla
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
)}
```

- [ ] **Step 6: TypeScript kontrol + commit**

```bash
cd rezzy-app && npx tsc --noEmit
git add src/screens/taxi/TaxiMatchedScreen.tsx
git commit -m "feat(reviews): TaxiMatchedScreen yolculuk sonrası sürücü puanlama"
```

---

## Task 9 — MarketStore ratingCount Alanı (Backend)

**Files:**
- Modify: `rezzy-backend/src/models/MarketStore.js`
- Modify: `rezzy-backend/src/models/TaxiDriver.js`

- [ ] **Step 1: MarketStore'a ratingCount ekle**

`MarketStore.js` dosyasında `rating` alanının yanına:
```javascript
rating: { type: Number, default: 0, min: 0, max: 5 },
ratingCount: { type: Number, default: 0 },   // BU SATIRI EKLE
```

- [ ] **Step 2: TaxiDriver'a ratingCount ekle**

`TaxiDriver.js` dosyasında `rating` alanının yanına:
```javascript
rating: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
ratingCount: { type: Number, default: 0 },   // BU SATIRI EKLE
```

- [ ] **Step 3: Commit**

```bash
cd rezzy-backend
git add src/models/MarketStore.js src/models/TaxiDriver.js
git commit -m "feat(reviews): MarketStore ve TaxiDriver modeline ratingCount alanı eklendi"
```

---

## Task 10 — Son Push ve Deploy

- [ ] **Step 1: Backend push**

```bash
cd rezzy-backend && git push origin master
# Render otomatik deploy başlar
```

- [ ] **Step 2: Frontend push**

```bash
cd rezzy-app && git push origin master
```

- [ ] **Step 3: Smoke test**

```bash
# Render deploy olduktan sonra:
curl -s "https://rezzy-backend.onrender.com/api/reviews/market/MARKET_STORE_ID" | python3 -m json.tool
# { "reviews": [], "summary": { "averageRating": 0, "totalCount": 0, ... } }
```

---

## Self-Review Kontrol Listesi

| Spec Maddesi | Task | Durum |
|---|---|---|
| Evrensel Review modeli (restaurant/market/delivery/taxi_driver) | Task 1 | ✅ |
| Sadece gerçek müşteri yorum yapabilir | Task 2 (checkEligibility) | ✅ |
| Entity rating otomatik güncellenir | Task 2 (updateEntityRating) | ✅ |
| Liste endpoint'i (opsiyonel auth) | Task 3 | ✅ |
| Submit endpoint'i (zorunlu auth) | Task 3 | ✅ |
| Admin moderation geriye dönük uyumlu | Task 3 | ✅ |
| Frontend API tüm türleri destekler | Task 4 | ✅ |
| Yeniden kullanılabilir UI bileşeni | Task 5 | ✅ |
| Restoran entegrasyonu | Task 6 | ✅ |
| Market entegrasyonu | Task 7 | ✅ |
| Taksi sürücü puanlama | Task 8 | ✅ |
| ratingCount alanı | Task 9 | ✅ |
| MarketOrder status → delivered (puan için) | Task 2 (checkEligibility) | ✅ |

**Kapsam dışı (sonraki sprint):**
- Paket servis (delivery) ekranından puan verme UI — `DeliveryRestaurantScreen`'e ReviewSection eklenmedi (Task 7'nin benzeri, zaman kalırsa)
- MarketOrderDetailScreen'e "sipariş tamamlandı → puan ver" akışı

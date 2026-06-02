# Taxi UX — Keyboard Fix, Input Reset, History & Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix keyboard avoidance and input reset in TaxiDestinationScreen; add ride history button, list screen, detail screen with 5-star rating; add backend rate endpoint.

**Architecture:** Backend adds one `PATCH /api/taxi/rides/:id/rate` endpoint. Frontend adds two new screens (`TaxiHistoryScreen`, `TaxiRideDetailScreen`), registers them in `TaxiNavigator`, adds history button to `TaxiHomeScreen`, and fixes keyboard + input reset in `TaxiDestinationScreen`.

**Tech Stack:** React Native, Expo, TypeScript, react-navigation stack, lucide-react-native icons, Fastify/Express backend (JS), Mongoose.

---

## File Map

| Action | Path |
|--------|------|
| Modify | `rezzy-backend/src/controllers/taxi.controller.js` |
| Modify | `rezzy-backend/src/routes/taxi.routes.js` |
| Modify | `rezzy-app/src/api/taxi.ts` |
| Modify | `rezzy-app/src/navigation/TaxiNavigator.tsx` |
| Modify | `rezzy-app/src/screens/taxi/TaxiHomeScreen.tsx` |
| Modify | `rezzy-app/src/screens/taxi/TaxiDestinationScreen.tsx` |
| Create | `rezzy-app/src/screens/taxi/TaxiHistoryScreen.tsx` |
| Create | `rezzy-app/src/screens/taxi/TaxiRideDetailScreen.tsx` |

---

## Task 1: Backend — `rateRide` endpoint

**Files:**
- Modify: `rezzy-backend/src/controllers/taxi.controller.js` (add at end)
- Modify: `rezzy-backend/src/routes/taxi.routes.js`

- [ ] **Step 1: Add `rateRide` handler to taxi.controller.js**

Add at the end of the file, before the final export list:

```js
// ─── PATCH /api/taxi/rides/:id/rate ──────────────────────────────────────────
export async function rateRide(req, res, next) {
  try {
    const passengerId = req.user.id;
    const { id } = req.params;
    const { passengerRating } = req.body;

    if (!passengerRating || passengerRating < 1 || passengerRating > 5) {
      return res.status(400).json({ message: "Geçersiz puan. 1-5 arasında olmalı." });
    }

    const ride = await TaxiRide.findOne({ _id: id, passenger: passengerId });
    if (!ride) return res.status(404).json({ message: "Yolculuk bulunamadı." });
    if (ride.status !== "completed") {
      return res.status(400).json({ message: "Yalnızca tamamlanan yolculuklar puanlanabilir." });
    }
    if (ride.passengerRating !== null && ride.passengerRating !== undefined) {
      return res.status(409).json({ message: "Bu yolculuk zaten puanlandı." });
    }

    ride.passengerRating = passengerRating;
    await ride.save();

    // Driver average rating güncelle
    if (ride.driver) {
      const driver = await TaxiDriver.findById(ride.driver);
      if (driver) {
        const newCount = (driver.ratingCount || 0) + 1;
        const newRating = ((driver.rating || 5) * (driver.ratingCount || 0) + passengerRating) / newCount;
        driver.rating = Math.round(newRating * 10) / 10;
        driver.ratingCount = newCount;
        await driver.save();
      }
    }

    return res.json({ message: "Puanlama kaydedildi.", passengerRating });
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 2: Verify TaxiDriver is imported in controller**

At the top of `taxi.controller.js`, confirm this import exists:
```js
import TaxiDriver from "../models/TaxiDriver.js";
```
If missing, add it alongside the other model imports.

- [ ] **Step 3: Register route in taxi.routes.js**

In `rezzy-backend/src/routes/taxi.routes.js`, add `rateRide` to the import list and register the route:

```js
// In the import at the top — add rateRide:
import {
  // ... existing imports ...
  rateRide,
} from "../controllers/taxi.controller.js";

// After the existing ride routes, add:
router.patch("/taxi/rides/:id/rate", auth(), rateRide);
```

- [ ] **Step 4: Manual smoke test**

```bash
cd rezzy-backend && npm run start:dev
# In another terminal:
curl -X PATCH http://localhost:3000/api/taxi/rides/SOME_COMPLETED_RIDE_ID/rate \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"passengerRating": 4}'
# Expected: {"message":"Puanlama kaydedildi.","passengerRating":4}
```

- [ ] **Step 5: Commit backend**

```bash
cd rezzy-backend
git add src/controllers/taxi.controller.js src/routes/taxi.routes.js
git commit -m "feat(taxi): PATCH /taxi/rides/:id/rate endpoint + driver avg rating update"
```

---

## Task 2: Frontend API — `getMyRides` + `rateRide` + TaxiRide interface update

**Files:**
- Modify: `rezzy-app/src/api/taxi.ts`

- [ ] **Step 1: Update `TaxiRide` interface — add missing fields**

In `src/api/taxi.ts`, update the `TaxiRide` interface to include rating and populated driver:

```ts
export interface TaxiDriver {
  _id: string;
  vehiclePlate: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  rating: number;
  ratingCount: number;
  user?: { _id: string; name: string; phone?: string };
}

export interface TaxiRide {
  _id: string;
  passenger: string | { _id: string; name: string; phone?: string };
  driver?: TaxiDriver | null;
  pickup: RideLocation;
  dropoff: RideLocation;
  vehicleType: VehicleType;
  status: RideStatus;
  fare: number;
  distanceKm: number;
  durationMin: number;
  paymentMethod: string;
  requestedAt?: string;
  matchedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledBy?: 'passenger' | 'driver' | 'system';
  cancelReason?: string;
  passengerRating?: number | null;
  driverRating?: number | null;
}
```

- [ ] **Step 2: Add `getMyRides` function**

Add after the existing `cancelRide` function:

```ts
export async function getMyRides(page = 1, limit = 20): Promise<{
  rides: TaxiRide[];
  total: number;
  page: number;
  pages: number;
}> {
  const res = await api.get('/taxi/my-rides', { params: { page, limit } });
  return res.data;
}
```

- [ ] **Step 3: Add `rateRide` function**

Add right after `getMyRides`:

```ts
export async function rateRide(rideId: string, passengerRating: number): Promise<void> {
  await api.patch(`/taxi/rides/${rideId}/rate`, { passengerRating });
}
```

- [ ] **Step 4: Commit**

```bash
cd rezzy-app
git add src/api/taxi.ts
git commit -m "feat(taxi): getMyRides + rateRide API functions, TaxiRide interface update"
```

---

## Task 3: TaxiHomeScreen — geçmiş butonu

**Files:**
- Modify: `rezzy-app/src/screens/taxi/TaxiHomeScreen.tsx`

- [ ] **Step 1: Add `History` icon import**

In the imports at the top of the file, add `History` to the lucide import:

```ts
import { MapPin, Car, Users, Crown, PawPrint, ChevronLeft, History } from 'lucide-react-native';
```

- [ ] **Step 2: Add history button to the top bar JSX**

Find the `{/* Top bar */}` section. After the existing `<TouchableOpacity>` back button, add the history button on the right side. Replace the current topBar View content:

```tsx
{/* Top bar */}
<View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
  <TouchableOpacity
    onPress={() => navigation.goBack()}
    hitSlop={12}
    style={s.backBubble}
  >
    <ChevronLeft size={20} color="#111" strokeWidth={2.5} />
  </TouchableOpacity>
  <Text style={s.topTitle}>Rezvix Taksi</Text>
  <TouchableOpacity
    onPress={() => navigation.navigate('TaxiHistory')}
    hitSlop={12}
    style={s.historyBubble}
  >
    <History size={18} color={theme.taxi.main} strokeWidth={2} />
  </TouchableOpacity>
</View>
```

- [ ] **Step 3: Add `historyBubble` style**

In the `styles` function, add `historyBubble` after `backBubble`:

```ts
historyBubble: {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: 'rgba(255,255,255,0.92)',
  alignItems: 'center',
  justifyContent: 'center',
},
```

- [ ] **Step 4: Update topBar style to space-between**

Update `topBar` style to push back button left and history button right:

```ts
topBar: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  paddingHorizontal: theme.space[4],
  paddingBottom: theme.space[3],
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
```

Note: Remove `gap: 10` since we're using `justifyContent: 'space-between'`. The title will naturally center between the two buttons because both buttons are the same width (34px).

- [ ] **Step 5: Commit**

```bash
cd rezzy-app
git add src/screens/taxi/TaxiHomeScreen.tsx
git commit -m "feat(taxi): history button in top-right corner of TaxiHomeScreen"
```

---

## Task 4: TaxiDestinationScreen — keyboard fix + input reset

**Files:**
- Modify: `rezzy-app/src/screens/taxi/TaxiDestinationScreen.tsx`

- [ ] **Step 1: Fix KeyboardAvoidingView behavior**

Find this line:
```tsx
behavior={Platform.OS === 'ios' ? 'padding' : undefined}
```

Replace with:
```tsx
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
```

- [ ] **Step 2: Wrap panel content in ScrollView**

Add `ScrollView` to the React Native imports at the top:
```ts
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable,
  ActivityIndicator, Alert, Platform, Keyboard, KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
```

Then find `{/* Bottom form panel */}` and wrap its inner content (everything inside the `<View style={[s.panel, ...]}>`) in a `ScrollView`:

```tsx
{/* Bottom form panel */}
<View style={[s.panel, { paddingBottom: insets.bottom + 8 }]}>
  <ScrollView
    keyboardShouldPersistTaps="handled"
    showsVerticalScrollIndicator={false}
    contentContainerStyle={{ paddingBottom: 8 }}
  >
    {/* Address inputs */}
    <View style={s.inputRow}>
      {/* ... existing pickup input ... */}
    </View>
    {/* ... rest of existing panel content unchanged ... */}
  </ScrollView>
</View>
```

- [ ] **Step 3: Reset dropoff input on mount**

Add the Zustand store imports for `setDropoff` and `setFareEstimate` — they are already present. Add a mount-only `useEffect` right after the state declarations (after `const [error, setError] = useState...`):

```ts
// Reset dropoff every time this screen is opened
useEffect(() => {
  setDropoffQuery('');
  setDropoff('', null);
  setFareEstimate(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4: Commit**

```bash
cd rezzy-app
git add src/screens/taxi/TaxiDestinationScreen.tsx
git commit -m "fix(taxi): keyboard avoidance on Android + dropoff input reset on mount"
```

---

## Task 5: TaxiHistoryScreen

**Files:**
- Create: `rezzy-app/src/screens/taxi/TaxiHistoryScreen.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/screens/taxi/TaxiHistoryScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, History, Star } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getMyRides, type TaxiRide } from '../../api/taxi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status, theme }: { status: string; theme: ReturnType<typeof useTheme> }) {
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const bg = isCompleted ? theme.colors.success : isCancelled ? theme.colors.error : theme.colors.textTertiary;
  const label = isCompleted ? 'Tamamlandı' : isCancelled ? 'İptal' : status;
  return (
    <View style={{ backgroundColor: bg + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: bg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiHistoryScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [rides, setRides] = useState<TaxiRide[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRides = useCallback(async (p: number) => {
    try {
      const data = await getMyRides(p, 20);
      if (p === 1) {
        setRides(data.rides);
      } else {
        setRides((prev) => [...prev, ...data.rides]);
      }
      setPages(data.pages);
      setPage(p);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRides(1).finally(() => setLoading(false));
  }, [fetchRides]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    fetchRides(page + 1).finally(() => setLoadingMore(false));
  }, [loadingMore, page, pages, fetchRides]);

  const s = styles(theme, insets);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Geçmiş Yolculuklar</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={theme.taxi.main} />
        </View>
      ) : rides.length === 0 ? (
        <View style={s.centered}>
          <History size={48} color={theme.colors.textTertiary} />
          <Text style={s.emptyText}>Henüz yolculuğunuz yok</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item._id}
          contentContainerStyle={s.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.taxi.main} style={{ marginVertical: 16 }} /> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('TaxiRideDetail', { rideId: item._id })}
              activeOpacity={0.75}
            >
              {/* Addresses */}
              <View style={s.addressRow}>
                <View style={[s.dot, { backgroundColor: theme.colors.success }]} />
                <Text style={s.addressText} numberOfLines={1}>{item.pickup.address}</Text>
              </View>
              <View style={[s.addressRow, { marginTop: 4 }]}>
                <View style={[s.dot, { backgroundColor: theme.colors.error }]} />
                <Text style={s.addressText} numberOfLines={1}>{item.dropoff.address}</Text>
              </View>

              {/* Meta row */}
              <View style={s.metaRow}>
                <StatusBadge status={item.status} theme={theme} />
                <Text style={s.dateText}>{formatDate(item.completedAt ?? item.requestedAt)}</Text>
                <Text style={s.fareText}>₺{item.fare?.toFixed(2) ?? '—'}</Text>
                {item.status === 'completed' && (
                  item.passengerRating
                    ? <View style={s.ratingBadge}>
                        <Star size={11} color={theme.taxi.main} fill={theme.taxi.main} />
                        <Text style={[s.ratingBadgeText, { color: theme.taxi.main }]}>{item.passengerRating}</Text>
                      </View>
                    : <Text style={s.rateLink}>Değerlendir →</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[3],
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderDefault,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...theme.typography.headingMd,
      color: theme.colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textSecondary,
    },
    listContent: {
      padding: theme.space[4],
      gap: theme.space[3],
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      ...theme.getElevation(1),
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    addressText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[3],
      flexWrap: 'wrap',
    },
    dateText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    fareText: {
      ...theme.typography.labelMd,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingBadgeText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    rateLink: {
      ...theme.typography.caption,
      color: theme.taxi.main,
      fontWeight: '600',
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd rezzy-app
git add src/screens/taxi/TaxiHistoryScreen.tsx
git commit -m "feat(taxi): TaxiHistoryScreen — paginated ride list with status and rating indicator"
```

---

## Task 6: TaxiRideDetailScreen

**Files:**
- Create: `rezzy-app/src/screens/taxi/TaxiRideDetailScreen.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/screens/taxi/TaxiRideDetailScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Navigation, Car, User, Star } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getRide, rateRide, type TaxiRide } from '../../api/taxi';

// ─── Star Rating Component ─────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = 32,
  color,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !readonly && onChange?.(star)}
          disabled={readonly}
          hitSlop={8}
        >
          <Star
            size={size}
            color={color}
            fill={star <= value ? color : 'transparent'}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#8899AA', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiRideDetailScreen({ navigation, route }: any) {
  const { rideId } = route.params as { rideId: string };
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<TaxiRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRide(rideId)
      .then(setRide)
      .catch(() => Alert.alert('Hata', 'Yolculuk bilgileri alınamadı.'))
      .finally(() => setLoading(false));
  }, [rideId]);

  const handleSubmitRating = useCallback(async () => {
    if (!selectedStar || !ride) return;
    setSubmitting(true);
    try {
      await rateRide(ride._id, selectedStar);
      setRide((prev) => prev ? { ...prev, passengerRating: selectedStar } : prev);
    } catch (e: any) {
      Alert.alert('Hata', e?.response?.data?.message ?? 'Puanlama kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  }, [selectedStar, ride]);

  const s = styles(theme, insets);

  if (loading) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.taxi.main} />
      </View>
    );
  }

  if (!ride) return null;

  const driver = ride.driver as any;
  const hasDriver = Boolean(driver?._id);
  const isCompleted = ride.status === 'completed';
  const alreadyRated = Boolean(ride.passengerRating);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Yolculuk Detayı</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Route Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Güzergah</Text>
          <View style={s.routeRow}>
            <Navigation size={16} color={theme.colors.success} strokeWidth={2.5} />
            <Text style={s.routeText} numberOfLines={2}>{ride.pickup.address}</Text>
          </View>
          <View style={s.routeDivider} />
          <View style={s.routeRow}>
            <MapPin size={16} color={theme.colors.error} strokeWidth={2.5} />
            <Text style={s.routeText} numberOfLines={2}>{ride.dropoff.address}</Text>
          </View>
        </View>

        {/* Trip Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Yolculuk Bilgileri</Text>
          <InfoRow label="Tarih" value={formatDate(ride.completedAt ?? ride.requestedAt)} />
          <View style={s.divider} />
          <InfoRow label="Mesafe" value={ride.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : '—'} />
          <View style={s.divider} />
          <InfoRow label="Süre" value={ride.durationMin ? `${ride.durationMin} dk` : '—'} />
          <View style={s.divider} />
          <InfoRow label="Ücret" value={ride.fare ? `₺${ride.fare.toFixed(2)}` : '—'} />
          <View style={s.divider} />
          <InfoRow label="Ödeme" value={
            ride.paymentMethod === 'cash' ? 'Nakit' :
            ride.paymentMethod === 'card' ? 'Kart' : 'Online'
          } />
        </View>

        {/* Driver & Vehicle */}
        {hasDriver && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sürücü & Araç</Text>
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <User size={22} color={theme.taxi.main} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{driver?.user?.name ?? 'Sürücü'}</Text>
                {driver?.user?.phone && (
                  <Text style={s.driverPhone}>{driver.user.phone}</Text>
                )}
              </View>
              {driver?.rating && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={14} color={theme.taxi.main} fill={theme.taxi.main} />
                  <Text style={[s.driverPhone, { color: theme.taxi.main, fontWeight: '700' }]}>
                    {driver.rating.toFixed(1)}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.divider} />
            <View style={s.vehicleRow}>
              <Car size={18} color={theme.colors.textSecondary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={s.vehicleText}>
                  {driver?.vehicleBrand} {driver?.vehicleModel}
                </Text>
                <Text style={s.vehiclePlate}>{driver?.vehiclePlate}</Text>
              </View>
              {driver?.vehicleColor && (
                <View style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: driver.vehicleColor.toLowerCase(),
                  borderWidth: 1, borderColor: theme.colors.borderDefault,
                }} />
              )}
            </View>
          </View>
        )}

        {/* Rating Section */}
        {isCompleted && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Değerlendirme</Text>
            {alreadyRated ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                <StarRating value={ride.passengerRating!} readonly color={theme.taxi.main} />
                <Text style={s.ratedText}>Değerlendirdiniz</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Text style={s.ratePrompt}>Bu yolculuğu nasıl buldunuz?</Text>
                <StarRating value={selectedStar} onChange={setSelectedStar} color={theme.taxi.main} />
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    { opacity: selectedStar === 0 || submitting ? 0.4 : 1 },
                  ]}
                  disabled={selectedStar === 0 || submitting}
                  onPress={handleSubmitRating}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={s.submitBtnText}>Gönder</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[3],
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderDefault,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { ...theme.typography.headingMd, color: theme.colors.textPrimary },
    content: { padding: theme.space[4], gap: theme.space[3], paddingBottom: insets.bottom + 24 },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
    },
    sectionTitle: {
      ...theme.typography.labelMd,
      color: theme.colors.textSecondary,
      marginBottom: theme.space[3],
    },
    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] },
    routeText: { ...theme.typography.bodyMd, color: theme.colors.textPrimary, flex: 1 },
    routeDivider: {
      width: 1, height: 16, backgroundColor: theme.colors.borderDefault,
      marginLeft: 8, marginVertical: 4,
    },
    divider: { height: 1, backgroundColor: theme.colors.borderDefault, marginVertical: 2 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], marginBottom: theme.space[2] },
    driverAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: theme.taxi.light,
      alignItems: 'center', justifyContent: 'center',
    },
    driverName: { ...theme.typography.bodyMd, color: theme.colors.textPrimary, fontWeight: '600' },
    driverPhone: { ...theme.typography.caption, color: theme.colors.textSecondary },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], marginTop: theme.space[2] },
    vehicleText: { ...theme.typography.bodyMd, color: theme.colors.textPrimary },
    vehiclePlate: {
      ...theme.typography.caption, color: theme.colors.textSecondary,
      fontFamily: theme.fontFamily.mono ?? undefined,
      letterSpacing: 1,
    },
    ratedText: { ...theme.typography.bodyMd, color: theme.colors.textSecondary },
    ratePrompt: { ...theme.typography.bodyMd, color: theme.colors.textPrimary },
    submitBtn: {
      backgroundColor: theme.taxi.main,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[3],
      minWidth: 120,
      alignItems: 'center',
    },
    submitBtnText: { ...theme.typography.labelMd, color: '#000', fontWeight: '700' },
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd rezzy-app
git add src/screens/taxi/TaxiRideDetailScreen.tsx
git commit -m "feat(taxi): TaxiRideDetailScreen — driver info, trip details, 5-star rating"
```

---

## Task 7: TaxiNavigator — register new screens

**Files:**
- Modify: `rezzy-app/src/navigation/TaxiNavigator.tsx`

- [ ] **Step 1: Import new screens and update stack params**

```tsx
import TaxiHistoryScreen from '../screens/taxi/TaxiHistoryScreen';
import TaxiRideDetailScreen from '../screens/taxi/TaxiRideDetailScreen';

export type TaxiStackParams = {
  TaxiHome: undefined;
  TaxiDestination: undefined;
  TaxiMatched: { rideId: string };
  TaxiReceipt: {
    rideId: string;
    fare: number;
    distanceKm: number;
    durationMin: number;
    pickupAddress: string;
    dropoffAddress: string;
    paymentMethod: string;
    driverId: string;
  };
  TaxiHistory: undefined;
  TaxiRideDetail: { rideId: string };
};
```

- [ ] **Step 2: Add screens to Stack.Navigator**

Inside `<Stack.Navigator>`, add after the existing screens:

```tsx
<Stack.Screen
  name="TaxiHistory"
  component={TaxiHistoryScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="TaxiRideDetail"
  component={TaxiRideDetailScreen}
  options={{ headerShown: false }}
/>
```

- [ ] **Step 3: Commit**

```bash
cd rezzy-app
git add src/navigation/TaxiNavigator.tsx
git commit -m "feat(taxi): register TaxiHistory and TaxiRideDetail in TaxiNavigator"
```

---

## Task 8: Push backend + verify

- [ ] **Step 1: Push backend to GitHub (triggers Render deploy)**

```bash
cd rezzy-backend && git push origin master
```

- [ ] **Step 2: Verify Render deploy**

Check https://dashboard.render.com — wait for deploy to finish (~2 min).

Test rate endpoint on production:
```bash
curl -X PATCH https://parkmark.onrender.com/api/taxi/rides/RIDE_ID/rate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"passengerRating": 5}'
```

- [ ] **Step 3: Final commit — bump versionCode for new build**

In `rezzy-app/app.json`, set `versionCode` to 31:
```json
"versionCode": 31
```

```bash
cd rezzy-app
git add app.json
git commit -m "chore: versionCode 31 for taxi history + rating build"
```

# Taxi UX — Keyboard Fix, Input Reset, Ride History & Rating

**Date:** 2026-06-02  
**Status:** Approved

---

## Scope

1. Keyboard avoidance fix in `TaxiDestinationScreen`
2. Input field reset on each navigation to `TaxiDestinationScreen`
3. History button on `TaxiHomeScreen`
4. New `TaxiHistoryScreen` — ride list
5. New `TaxiRideDetailScreen` — ride detail + 5-star rating
6. Backend endpoint: `PATCH /api/taxi/rides/:id/rate`

---

## 1. Keyboard Avoidance Fix

**File:** `src/screens/taxi/TaxiDestinationScreen.tsx`

**Problem:** `KeyboardAvoidingView` has `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. On Android `undefined` means no behavior — the panel stays fixed and the keyboard covers the input.

**Fix:** Change `behavior` to `Platform.OS === 'ios' ? 'padding' : 'height'`. This makes the bottom panel shrink/scroll up when the keyboard appears on both platforms.

Additionally, wrap the bottom panel content in a `ScrollView` (with `keyboardShouldPersistTaps="handled"`) so if the panel content is taller than the available space after keyboard appears, the user can still scroll to reach the CTA button.

---

## 2. Input Reset

**File:** `src/screens/taxi/TaxiDestinationScreen.tsx`

**Problem:** Local state is initialized from the Zustand store (`useState(pickupAddress)`, `useState(dropoffAddress)`). Previous dropoff address persists between sessions.

**Fix:** On component mount (`useEffect([], [])`), reset only the dropoff:
- `setDropoffQuery('')`
- `setDropoff('', null)` — clears store coords and address

Pickup stays pre-filled from current GPS location (good UX). Dropoff always starts empty.

Also clear `fareEstimate` on mount so stale estimate doesn't flash.

---

## 3. History Button on TaxiHomeScreen

**File:** `src/screens/taxi/TaxiHomeScreen.tsx`

Add a circular icon button in the **top-right corner**, matching the existing `backBubble` style:
- Position: `absolute`, `top: insets.top + 8`, `right: theme.space[4]`
- Icon: `History` (lucide-react-native), size 20, color `theme.taxi.main`
- Background: `rgba(255,255,255,0.92)` — matches `backBubble`
- `onPress: () => navigation.navigate('TaxiHistory')`

---

## 4. TaxiHistoryScreen

**File:** `src/screens/taxi/TaxiHistoryScreen.tsx` *(new)*

**Data source:** `GET /api/taxi/my-rides?limit=20&page=N` — already exists, returns paginated rides with driver populated.

**Layout:**
- Header: back button + "Geçmiş Yolculuklar" title
- `FlatList` with `onEndReached` for pagination
- Empty state: icon + "Henüz yolculuğunuz yok"
- Loading skeleton on first load

**Each ride card shows:**
- From address (truncated, 1 line)
- To address (truncated, 1 line)
- Date (formatted: "2 Haz, 17:30")
- Fare (₺XX.XX)
- Status badge: `completed` → yeşil "Tamamlandı", `cancelled` → kırmızı "İptal"
- Rating: if `passengerRating` is set → `★★★★☆` (filled stars), else → `"Değerlendir →"` in yellow

**Tap:** navigates to `TaxiRideDetail` passing `rideId`.

**Filter tabs (optional — YAGNI, skip for now):** Only completed + cancelled rides shown (filter on `status`).

---

## 5. TaxiRideDetailScreen

**File:** `src/screens/taxi/TaxiRideDetailScreen.tsx` *(new)*

**Data:** Fetches `GET /api/taxi/rides/:id` on mount (already exists).

**Sections:**

### Route Section
- Kalkış / Varış addresses with colored pin icons (green/red)
- Tarih, mesafe (km), süre (dk), ücret

### Araç & Sürücü Section
- Driver name (from `ride.driver.user.name`)
- Vehicle: `vehicleBrand vehicleModel — vehiclePlate` (e.g. "Toyota Corolla — 34ABC123")
- Vehicle color as a colored dot badge

### Değerlendirme Section
**If `passengerRating` already set:**
- Shows 5 star icons, filled up to the rating value
- Text: "Değerlendirdiniz"
- Non-interactive

**If `passengerRating` is null AND `status === 'completed'`:**
- 5 tappable star icons (1–5)
- Selected star turns `theme.taxi.main` (yellow)
- "Gönder" button — disabled until a star is selected
- On submit: calls `PATCH /api/taxi/rides/:id/rate` with `{ passengerRating: N }`
- On success: updates local state to show the submitted rating (non-interactive)

**If cancelled:** No rating section.

---

## 6. Backend: Rate Endpoint

**File:** `rezzy-backend/src/controllers/taxi.controller.js`  
**Route:** `PATCH /api/taxi/rides/:id/rate` (JWT auth required)

**Request body:** `{ passengerRating: 1–5 }`

**Logic:**
1. Find ride by `_id` where `passenger === req.user.id`
2. Validate: `status === 'completed'` — only completed rides can be rated
3. Validate: `passengerRating` currently null — can only rate once
4. Save `passengerRating` on the ride
5. Update driver's `rating` and `ratingCount`:
   ```js
   const driver = await TaxiDriver.findById(ride.driver);
   const newCount = driver.ratingCount + 1;
   const newRating = ((driver.rating * driver.ratingCount) + passengerRating) / newCount;
   driver.rating = Math.round(newRating * 10) / 10; // 1 decimal
   driver.ratingCount = newCount;
   await driver.save();
   ```
6. Return updated ride

**Route registration:** Add to `taxi.routes.js`:
```js
router.patch("/taxi/rides/:id/rate", auth(), rateRide);
```

---

## Navigation

Add to `TaxiHistory` and `TaxiRideDetail` to the navigation stack (wherever taxi screens are registered — check `src/navigation` or `app/` for the stack).

---

## Out of Scope

- Driver rating of passenger (`driverRating` field exists but not exposed)
- Push notification on rating
- Edit/update a submitted rating

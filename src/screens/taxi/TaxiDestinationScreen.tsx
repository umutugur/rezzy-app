// src/screens/taxi/TaxiDestinationScreen.tsx
// Address search + route preview + fare estimate + "Call Taxi" CTA.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Navigation, ChevronLeft, Banknote, CreditCard, Smartphone } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import * as Linking from 'expo-linking';

import { useTheme } from '../../contexts/ThemeContext';
import { useTaxiStore, type TaxiPaymentMethod } from '../../store/useTaxiStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PriceTag } from '../../components/ui/PriceTag';
import {
  searchPlaces,
  estimateFare,
  createRide,
  type PlaceResult,
  type RideLocation,
} from '../../api/taxi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRideLocation(place: PlaceResult): RideLocation {
  return {
    address: place.address,
    coordinates: [place.lng, place.lat], // GeoJSON [lng, lat]
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiDestinationScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const selectedVehicleType = useTaxiStore((s) => s.selectedVehicleType);
  const selectedPaymentMethod = useTaxiStore((s) => s.selectedPaymentMethod);
  const setSelectedPaymentMethod = useTaxiStore((s) => s.setSelectedPaymentMethod);
  const fareEstimate = useTaxiStore((s) => s.fareEstimate);
  const setFareEstimate = useTaxiStore((s) => s.setFareEstimate);
  const setPickup = useTaxiStore((s) => s.setPickup);
  const setDropoff = useTaxiStore((s) => s.setDropoff);
  const setActiveRide = useTaxiStore((s) => s.setActiveRide);
  const setIsSearching = useTaxiStore((s) => s.setIsSearching);
  const pickupAddress = useTaxiStore((s) => s.pickupAddress);
  const dropoffAddress = useTaxiStore((s) => s.dropoffAddress);
  const pickupCoords = useTaxiStore((s) => s.pickupCoords);
  const dropoffCoords = useTaxiStore((s) => s.dropoffCoords);

  const [pickupQuery, setPickupQuery] = useState(pickupAddress);
  const [dropoffQuery, setDropoffQuery] = useState(dropoffAddress);
  const [pickupResults, setPickupResults] = useState<PlaceResult[]>([]);
  const [dropoffResults, setDropoffResults] = useState<PlaceResult[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRideModal, setActiveRideModal] = useState<{ rideId: string } | null>(null);

  const pickupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset dropoff every time this screen is opened
  useEffect(() => {
    setDropoffQuery('');
    setDropoff('', null);
    setFareEstimate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Address search (debounced 400ms) ─────────────────────────────────────

  const handlePickupChange = useCallback(
    (text: string) => {
      setPickupQuery(text);
      setPickup(text, null); // clear coords while typing
      setFareEstimate(null);
      if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
      if (text.length < 2) { setPickupResults([]); return; }
      pickupTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text, pickupCoords ?? undefined);
          setPickupResults(results);
        } catch { /* silent */ }
      }, 400);
    },
    [pickupCoords, setFareEstimate, setPickup],
  );

  const handleDropoffChange = useCallback(
    (text: string) => {
      setDropoffQuery(text);
      setDropoff(text, null);
      setFareEstimate(null);
      if (dropoffTimerRef.current) clearTimeout(dropoffTimerRef.current);
      if (text.length < 2) { setDropoffResults([]); return; }
      dropoffTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchPlaces(text, pickupCoords ?? undefined);
          setDropoffResults(results);
        } catch { /* silent */ }
      }, 400);
    },
    [pickupCoords, setDropoff, setFareEstimate],
  );

  const selectPickup = useCallback(
    (place: PlaceResult) => {
      setPickupQuery(place.address);
      setPickup(place.address, { lat: place.lat, lng: place.lng });
      setPickupResults([]);
      setActiveField(null);
      Keyboard.dismiss();
    },
    [setPickup],
  );

  const selectDropoff = useCallback(
    (place: PlaceResult) => {
      setDropoffQuery(place.address);
      setDropoff(place.address, { lat: place.lat, lng: place.lng });
      setDropoffResults([]);
      setActiveField(null);
      Keyboard.dismiss();
    },
    [setDropoff],
  );

  // ── Auto-estimate when both coords are set ────────────────────────────────

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return;
    let cancelled = false;
    setLoadingEstimate(true);
    setError(null);
    estimateFare(
      { address: pickupAddress, coordinates: [pickupCoords.lng, pickupCoords.lat] },
      { address: dropoffAddress, coordinates: [dropoffCoords.lng, dropoffCoords.lat] },
      selectedVehicleType,
    )
      .then((est) => { if (!cancelled) setFareEstimate(est); })
      .catch(() => { if (!cancelled) setError('Ücret tahmini alınamadı.'); })
      .finally(() => { if (!cancelled) setLoadingEstimate(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords, dropoffCoords, selectedVehicleType]);

  // ── Create ride ──────────────────────────────────────────────────────────

  const handleCallTaxi = useCallback(async () => {
    if (!pickupCoords || !dropoffCoords) return;
    setLoadingCreate(true);
    setError(null);
    try {
      const result = await createRide({
        pickup: { address: pickupAddress, coordinates: [pickupCoords.lng, pickupCoords.lat] },
        dropoff: { address: dropoffAddress, coordinates: [dropoffCoords.lng, dropoffCoords.lat] },
        vehicleType: selectedVehicleType,
        paymentMethod: selectedPaymentMethod,
      });

      const { ride, payment } = result;
      setActiveRide(ride);

      // ─── Online ödeme: Stripe PaymentSheet ──────────────────────────────
      if (selectedPaymentMethod === 'online' && payment?.clientSecret) {
        setLoadingCreate(false);
        setStripeBusy(true);

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: payment.clientSecret,
          merchantDisplayName: 'Rezvix Taksi',
          returnURL: Linking.createURL('stripe-redirect'),
          allowsDelayedPaymentMethods: false,
          style: 'alwaysLight',
        });

        if (initError) {
          setError(initError.message ?? 'Ödeme ekranı açılamadı.');
          setStripeBusy(false);
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        setStripeBusy(false);

        if (presentError) {
          if (presentError.code !== 'Canceled') {
            setError(presentError.message ?? 'Ödeme tamamlanamadı.');
          }
          return;
        }

        // Ödeme başarılı → sürücü aramaya başla
        setIsSearching(true);
        navigation.replace('TaxiMatched', { rideId: ride._id });
        return;
      }

      // ─── Nakit / Kart — direkt sürücü ara ───────────────────────────────
      setIsSearching(true);
      navigation.replace('TaxiMatched', { rideId: ride._id });
    } catch (e: any) {
      // 409 — zaten aktif bir yolculuk var → mevcut yolculuğa yönlendir
      if (e?.response?.status === 409 && e?.response?.data?.rideId) {
        const existingId = e.response.data.rideId;
        setActiveRideModal({ rideId: existingId });
        return;
      }
      setError(e?.response?.data?.message ?? 'Yolculuk oluşturulamadı.');
    } finally {
      setLoadingCreate(false);
      setStripeBusy(false);
    }
  }, [
    pickupCoords,
    dropoffCoords,
    pickupAddress,
    dropoffAddress,
    selectedVehicleType,
    selectedPaymentMethod,
    setActiveRide,
    setIsSearching,
    navigation,
    initPaymentSheet,
    presentPaymentSheet,
  ]);

  // ── Map region ───────────────────────────────────────────────────────────

  const mapRegion = pickupCoords
    ? {
        latitude: pickupCoords.lat,
        longitude: pickupCoords.lng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }
    : {
        latitude: 41.015137,
        longitude: 28.979530,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };

  const routeCoords =
    pickupCoords && dropoffCoords
      ? [
          { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
          { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng },
        ]
      : [];

  const hasRoute = routeCoords.length === 2;
  // Koordinatlar set edilince buton aktif — fareEstimate beklemeye gerek yok (estimate güzel ama zorunlu değil)
  const canCallTaxi = Boolean(pickupCoords && dropoffCoords) && !loadingEstimate && !loadingCreate && !stripeBusy;
  const isBusy = loadingCreate || stripeBusy;

  const s = styles(theme, insets);

  // Active suggestion list
  const suggestions =
    activeField === 'pickup' ? pickupResults : activeField === 'dropoff' ? dropoffResults : [];

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Map — top half */}
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={s.map}
        region={mapRegion}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
              <MapPin size={16} color="#fff" strokeWidth={2.5} />
            </View>
          </Marker>
        )}
        {dropoffCoords && (
          <Marker
            coordinate={{ latitude: dropoffCoords.lat, longitude: dropoffCoords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
              <MapPin size={16} color="#fff" strokeWidth={2.5} />
            </View>
          </Marker>
        )}
        {hasRoute && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={theme.taxi.main}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <ChevronLeft size={22} color={theme.colors.textPrimary} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Bottom form panel */}
      <View style={[s.panel, { paddingBottom: insets.bottom + 8 }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
        {/* Address inputs */}
        <View style={s.inputRow}>
          <Navigation size={16} color={theme.colors.success} strokeWidth={2.5} />
          <View style={s.inputWrap}>
            <Input
              placeholder="Nereden? (kalkış)"
              value={pickupQuery}
              onChangeText={handlePickupChange}
              onFocus={() => setActiveField('pickup')}
              variant="filled"
              style={s.input}
            />
          </View>
        </View>

        <View style={[s.inputRow, { marginTop: theme.space[2] }]}>
          <MapPin size={16} color={theme.colors.error} strokeWidth={2.5} />
          <View style={s.inputWrap}>
            <Input
              placeholder="Nereye? (varış)"
              value={dropoffQuery}
              onChangeText={handleDropoffChange}
              onFocus={() => setActiveField('dropoff')}
              variant="filled"
              style={s.input}
            />
          </View>
        </View>

        {/* Suggestions dropdown — FlatList kullanmıyoruz (ScrollView içinde yasak) */}
        {suggestions.length > 0 && (
          <View style={s.suggestions}>
            {suggestions.map((item, i) => (
              <React.Fragment key={item.placeId ?? String(i)}>
                <TouchableOpacity
                  style={s.suggestionRow}
                  onPress={() =>
                    activeField === 'pickup' ? selectPickup(item) : selectDropoff(item)
                  }
                >
                  <MapPin size={14} color={theme.colors.textSecondary} />
                  <Text style={s.suggestionText} numberOfLines={2}>
                    {item.address}
                  </Text>
                </TouchableOpacity>
                {i < suggestions.length - 1 && <View style={s.separator} />}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Fare estimate */}
        {loadingEstimate && (
          <View style={s.estimateRow}>
            <ActivityIndicator size="small" color={theme.taxi.main} />
            <Text style={s.estimateLoading}>Ücret hesaplanıyor…</Text>
          </View>
        )}
        {fareEstimate && !loadingEstimate && (
          <View style={s.estimateCard}>
            <View style={s.estimateMeta}>
              <Text style={s.estimateMetaLabel}>Mesafe</Text>
              <Text style={s.estimateMetaValue}>
                {fareEstimate.distanceKm.toFixed(1)} km
              </Text>
            </View>
            <View style={s.estimateMeta}>
              <Text style={s.estimateMetaLabel}>Tahmini süre</Text>
              <Text style={s.estimateMetaValue}>{fareEstimate.durationMin} dk</Text>
            </View>
            <PriceTag
              amount={fareEstimate.fare}
              currency="TRY"
              size="lg"
              style={{ color: theme.taxi.main } as any}
            />
          </View>
        )}

        {/* Ödeme yöntemi — koordinatlar hazır olunca göster */}
        {pickupCoords && dropoffCoords && (
          <View style={s.paymentSection}>
            <Text style={s.paymentLabel}>Ödeme Yöntemi</Text>
            <View style={s.paymentRow}>
              {(
                [
                  { method: 'cash' as TaxiPaymentMethod, label: 'Nakit', Icon: Banknote },
                  { method: 'card' as TaxiPaymentMethod, label: 'Kart', Icon: CreditCard },
                  { method: 'online' as TaxiPaymentMethod, label: 'Online', Icon: Smartphone },
                ] as const
              ).map(({ method, label, Icon }) => {
                const active = selectedPaymentMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setSelectedPaymentMethod(method)}
                    style={[
                      s.paymentPill,
                      {
                        backgroundColor: active ? theme.taxi.main : theme.colors.surfaceAlt,
                        borderColor: active ? theme.taxi.main : theme.colors.borderDefault,
                      },
                    ]}
                  >
                    <Icon
                      size={14}
                      color={active ? '#fff' : theme.colors.textSecondary}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        s.paymentPillText,
                        { color: active ? '#fff' : theme.colors.textPrimary },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Error */}
        {error && <Text style={s.errorText}>{error}</Text>}

        {/* CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canCallTaxi}
          loading={isBusy}
          onPress={handleCallTaxi}
          haptic="medium"
          style={{ backgroundColor: theme.taxi.main, marginTop: theme.space[3] }}
        >
          {selectedPaymentMethod === 'online' ? 'Öde ve Taksi Çağır' : 'Taksi Çağır'}
        </Button>
        </ScrollView>
      </View>
      <Modal
        transparent
        visible={activeRideModal !== null}
        animationType="fade"
        onRequestClose={() => setActiveRideModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setActiveRideModal(null)}
        >
          <Pressable
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.space[6], margin: theme.space[5], width: '85%' }}
            onPress={() => {}}
          >
            <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, marginBottom: theme.space[2] }}>
              Aktif Yolculuk
            </Text>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginBottom: theme.space[5] }}>
              Devam eden bir yolculuğunuz var.
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
              <TouchableOpacity
                onPress={() => setActiveRideModal(null)}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderDefault, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const id = activeRideModal!.rideId;
                  setActiveRideModal(null);
                  navigation.replace('TaxiMatched', { rideId: id });
                }}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, backgroundColor: theme.taxi.main, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: '#000', fontWeight: '700' }}>Takip Et</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    map: { flex: 1 },

    backBtn: {
      position: 'absolute',
      left: theme.space[4],
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.getElevation(2),
    },

    panel: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius['2xl'],
      borderTopRightRadius: theme.radius['2xl'],
      paddingTop: theme.space[4],
      paddingHorizontal: theme.space[4],
      ...theme.getElevation(4),
      maxHeight: '65%',
    },

    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    inputWrap: { flex: 1 },
    input: { marginBottom: 0 },

    suggestions: {
      backgroundColor: theme.colors.surfaceRaised,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      maxHeight: 200,
      marginTop: theme.space[2],
      overflow: 'hidden',
      ...theme.getElevation(2),
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
    },
    suggestionText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.borderDefault,
      marginHorizontal: theme.space[3],
    },

    estimateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[4],
    },
    estimateLoading: {
      ...theme.typography.bodyMd,
      color: theme.colors.textSecondary,
    },

    estimateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.space[4],
      padding: theme.space[3],
      backgroundColor: theme.taxi.light,
      borderRadius: theme.radius.lg,
    },
    estimateMeta: { alignItems: 'center' },
    estimateMetaLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    estimateMetaValue: {
      ...theme.typography.headingSm,
      color: theme.colors.textPrimary,
    },

    errorText: {
      ...theme.typography.bodySm,
      color: theme.colors.error,
      marginTop: theme.space[2],
      textAlign: 'center',
    },

    paymentSection: {
      marginTop: theme.space[3],
      gap: theme.space[2],
    },
    paymentLabel: {
      ...theme.typography.labelSm,
      color: theme.colors.textSecondary,
    },
    paymentRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    paymentPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[2],
      borderRadius: theme.radius.full,
      borderWidth: 1,
    },
    paymentPillText: {
      ...theme.typography.labelSm,
      fontWeight: '700' as const,
    },
  });
}

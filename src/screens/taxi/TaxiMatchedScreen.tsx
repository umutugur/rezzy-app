// src/screens/taxi/TaxiMatchedScreen.tsx
// Shows live driver location, driver card and 120-second free-cancel countdown.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Clock, CreditCard, AlertCircle, Navigation, MapPin } from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useTaxiStore } from '../../store/useTaxiStore';
import { taxiSocket } from '../../services/taxiSocket.service';
import { cancelRide, getRide, type TaxiRide } from '../../api/taxi';
import { submitReview } from '../../api/reviews';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

const FREE_CANCEL_SECONDS = 120;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiMatchedScreen({ route, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { rideId } = route.params as { rideId: string };

  const activeRide = useTaxiStore((s) => s.activeRide);
  const setActiveRide = useTaxiStore((s) => s.setActiveRide);
  const setIsSearching = useTaxiStore((s) => s.setIsSearching);
  const updateNearbyDriver = useTaxiStore((s) => s.updateNearbyDriver);

  const [ride, setRide] = useState<TaxiRide | null>(activeRide);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(FREE_CANCEL_SECONDS);
  const [cancelling, setCancelling] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const mapRef = useRef<MapView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown bar (0 → 1 over FREE_CANCEL_SECONDS)
  const progress = useSharedValue(1);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
    backgroundColor:
      progress.value > 0.4 ? theme.brand[400] : theme.colors.error,
  }));

  // Fetch ride details
  useEffect(() => {
    let cancelled = false;
    getRide(rideId)
      .then((r) => { if (!cancelled) { setRide(r); setActiveRide(r); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rideId, setActiveRide]);

  // Socket — join ride room, listen for driver location & status changes
  useEffect(() => {
    taxiSocket.emit('ride:join', { rideId });

    const onLocation = (payload: any) => {
      const { lat, lng } = payload;
      setDriverLoc({ lat, lng });
      updateNearbyDriver({ driverId: payload.driverId, lat, lng });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500,
      );
    };

    const onStatusChange = (payload: any) => {
      if (payload.status === 'cancelled') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Yolculuk İptal Edildi', 'Sürücü yolculuğu iptal etti.', [
          { text: 'Tamam', onPress: () => navigation.goBack() },
        ]);
      } else if (payload.status === 'inProgress') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (payload.status === 'completed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Navigate to receipt screen — pass ride data via params
        setRide((prev) => {
          const r = prev ?? ride;
          if (r) {
            const driverId = typeof r.driver === 'object' && r.driver !== null
              ? (r.driver as any).user?._id ?? (r.driver as any)._id ?? ''
              : String(r.driver ?? '');
            navigation.navigate('TaxiReceipt' as any, {
              rideId: r._id,
              fare: r.fare,
              distanceKm: r.distanceKm,
              durationMin: r.durationMin,
              pickupAddress: r.pickup?.address ?? '',
              dropoffAddress: r.dropoff?.address ?? '',
              paymentMethod: r.paymentMethod ?? 'cash',
              driverId,
            });
          }
          return prev;
        });
      }
      setRide((prev) => (prev ? { ...prev, status: payload.status } : prev));
    };

    taxiSocket.on('driver:location:update', onLocation);
    taxiSocket.on('ride:status_change', onStatusChange);

    return () => {
      taxiSocket.off('driver:location:update', onLocation);
      taxiSocket.off('ride:status_change', onStatusChange);
      taxiSocket.emit('ride:leave', { rideId });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // Countdown timer + auto-cancel when searching and time is up
  useEffect(() => {
    progress.value = withTiming(0, {
      duration: FREE_CANCEL_SECONDS * 1000,
      easing: Easing.linear,
    });

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => { clearInterval(timerRef.current!); };
  }, [progress]);

  // Süre dolunca sürücü bulunamadıysa otomatik iptal et
  useEffect(() => {
    if (secondsLeft !== 0) return;
    if (ride?.status !== 'searching') return; // matched/inProgress ise dokunma

    // Sürücü bulunamadı — otomatik iptal
    cancelRide(rideId, 'Sürücü bulunamadı (zaman aşımı)')
      .catch(() => {})
      .finally(() => {
        setActiveRide(null);
        setIsSearching(false);
        Alert.alert(
          'Sürücü Bulunamadı',
          '120 saniye içinde uygun sürücü bulunamadı. Lütfen tekrar deneyin.',
          [{ text: 'Tamam', onPress: () => navigation.replace('TaxiDestination') }],
        );
      });
  // secondsLeft 0'a düştüğünde bir kez çalışması yeterli
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await cancelRide(rideId, 'Yolcu tarafından iptal edildi');
      setActiveRide(null);
      setIsSearching(false);
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Yolculuk iptal edilemedi. Lütfen tekrar deneyin.');
    } finally {
      setCancelling(false);
    }
  }, [rideId, setActiveRide, setIsSearching, navigation]);

  const handleRatingSubmit = useCallback(async () => {
    const driverId =
      ride?.driver?._id ?? (ride?.driver as any)?.user?._id ?? ride?.driver;
    if (!driverId) {
      navigation.goBack();
      return;
    }
    setRatingSubmitting(true);
    try {
      await submitReview('taxi_driver', String(driverId), { rating: userRating });
      setRatingDone(true);
    } catch {
      // NOT_ELIGIBLE veya diğer hatalar sessiz
    } finally {
      setRatingSubmitting(false);
      setTimeout(() => navigation.goBack(), 1200);
    }
  }, [ride, userRating, navigation]);

  const driver = ride?.driver;
  const driverUser = driver?.user ?? driver;
  const driverName: string = driverUser?.name ?? 'Sürücü bekleniyor…';
  const driverRating: number = driver?.rating ?? 5.0;
  const driverPlate: string = driver?.vehiclePlate ?? '';
  const driverVehicle: string = driver?.vehicleModel ?? '';

  const pickupCoords = ride
    ? {
        latitude: ride.pickup.coordinates[1],
        longitude: ride.pickup.coordinates[0],
      }
    : null;

  const dropoffCoords = ride
    ? {
        latitude: ride.dropoff.coordinates[1],
        longitude: ride.dropoff.coordinates[0],
      }
    : null;

  const mapRegion =
    driverLoc
      ? { latitude: driverLoc.lat, longitude: driverLoc.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }
      : pickupCoords
      ? { ...pickupCoords, latitudeDelta: 0.03, longitudeDelta: 0.03 }
      : { latitude: 41.015137, longitude: 28.97953, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const canFreeCancel = secondsLeft > 0;

  const s = styles(theme, insets);

  return (
    <View style={s.root}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType="none"
        style={s.map}
        region={mapRegion}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
        />
        {driverLoc && (
          <Marker
            coordinate={{ latitude: driverLoc.lat, longitude: driverLoc.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.driver.main, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
              <Navigation size={18} color="#fff" strokeWidth={2} />
            </View>
          </Marker>
        )}
        {pickupCoords && (
          <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
              <MapPin size={16} color="#fff" strokeWidth={2.5} />
            </View>
          </Marker>
        )}

        {/* Varış noktası marker */}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={14} color="#fff" strokeWidth={2.5} />
            </View>
          </Marker>
        )}

        {/* Sürücü → Kalkış çizgisi (matched durumunda) */}
        {driverLoc && pickupCoords && ride?.status === 'matched' && (
          <Polyline
            coordinates={[
              { latitude: driverLoc.lat, longitude: driverLoc.lng },
              pickupCoords,
            ]}
            strokeColor={theme.driver.main}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Kalkış → Varış çizgisi (inProgress durumunda) */}
        {pickupCoords && dropoffCoords && ride?.status === 'inProgress' && (
          <Polyline
            coordinates={[pickupCoords, dropoffCoords]}
            strokeColor={theme.taxi.main}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Bottom card */}
      <View style={[s.card, { paddingBottom: insets.bottom + 16 }]}>
        {/* Driver info row */}
        <View style={s.driverRow}>
          <Avatar name={driverName} size="lg56" ring ringColor={theme.driver.main} />
          <View style={s.driverInfo}>
            <Text style={s.driverName}>{driverName}</Text>
            <StarRating rating={driverRating} size="sm" readonly />
            {driverVehicle ? (
              <Text style={s.vehicleText} numberOfLines={1}>
                {driverVehicle}
                {driverPlate ? `  •  ${driverPlate}` : ''}
              </Text>
            ) : null}
          </View>
          {driverLoc ? (
            <Badge variant="success" label="Yolda" />
          ) : (
            <Badge variant="warning" label="Aranıyor" />
          )}
        </View>

        {/* ETA */}
        {ride && (
          <View style={s.etaRow}>
            <Clock size={15} color={theme.colors.success} strokeWidth={2.5} />
            <Text style={s.etaText}>
              ~{ride.durationMin} dk  •  {ride.distanceKm.toFixed(1)} km
            </Text>
          </View>
        )}

        {/* Fare + payment */}
        {ride && (
          <View style={s.fareRow}>
            <View style={s.fareLeft}>
              <Text style={s.fareAmount}>
                ₺{ride.fare.toFixed(0)}
              </Text>
              <View style={s.paymentChip}>
                <CreditCard size={12} color={theme.colors.textSecondary} />
                <Text style={s.paymentText}>{ride.paymentMethod ?? 'nakit'}</Text>
              </View>
            </View>
            <View style={s.fareRight}>
              <Text style={s.fareLabel}>Kalkış</Text>
              <Text style={s.fareAddress} numberOfLines={1}>
                {ride.pickup.address}
              </Text>
            </View>
          </View>
        )}

        {/* Free-cancel countdown bar */}
        <View style={s.countdownWrap}>
          <View style={s.countdownTrack}>
            <Animated.View style={[s.countdownBar, barStyle]} />
          </View>
          <View style={s.countdownLabelRow}>
            <AlertCircle size={12} color={theme.colors.textSecondary} />
            <Text style={s.countdownLabel}>
              {canFreeCancel
                ? `Ücretsiz iptal: ${secondsLeft}s`
                : 'Ücretsiz iptal süresi doldu'}
            </Text>
          </View>
        </View>

        {/* Cancel button */}
        <Button
          variant="ghost"
          size="md"
          fullWidth
          loading={cancelling}
          onPress={handleCancel}
          haptic="medium"
          style={s.cancelBtn}
        >
          {canFreeCancel ? 'Iptal Et (Ucretsiz)' : 'Iptal Et'}
        </Button>
      </View>

      {false && ratingOpen && (
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: theme.space[6],
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius['2xl'],
              padding: theme.space[6],
              width: '100%',
              gap: theme.space[4],
              alignItems: 'center',
            }}
          >
            {ratingDone ? (
              <Text style={{ ...theme.typography.headingMd, color: theme.colors.success }}>
                ✓ Teşekkürler!
              </Text>
            ) : (
              <>
                <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, textAlign: 'center' }}>
                  Yolculuğunuz tamamlandı
                </Text>
                <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
                  Sürücünüzü değerlendirin
                </Text>
                <StarRating value={userRating} onChange={setUserRating} size="lg" />
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1 },
    map: { flex: 1 },

    card: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius['2xl'],
      borderTopRightRadius: theme.radius['2xl'],
      paddingTop: theme.space[4],
      paddingHorizontal: theme.space[4],
      gap: theme.space[3],
      ...theme.getElevation(4),
    },

    driverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    driverInfo: { flex: 1 },
    driverName: {
      ...theme.typography.headingSm,
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    vehicleText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },

    etaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.colors.successSoft,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      borderRadius: theme.radius.lg,
    },
    etaText: {
      ...theme.typography.labelMd,
      color: theme.colors.success,
    },

    fareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.lg,
      padding: theme.space[3],
    },
    fareLeft: { alignItems: 'flex-start', gap: 4 },
    fareAmount: {
      ...theme.typography.displayLg,
      color: theme.taxi.main,
    },
    paymentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.space[2],
      paddingVertical: 2,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
    },
    paymentText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textTransform: 'capitalize',
    },
    fareRight: { flex: 1, alignItems: 'flex-end' },
    fareLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    fareAddress: {
      ...theme.typography.bodySm,
      color: theme.colors.textPrimary,
      maxWidth: 160,
      textAlign: 'right',
    },

    countdownWrap: { gap: 4 },
    countdownTrack: {
      height: 5,
      backgroundColor: theme.colors.borderDefault,
      borderRadius: theme.radius.full,
      overflow: 'hidden',
    },
    countdownBar: {
      height: 5,
      borderRadius: theme.radius.full,
    },
    countdownLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    countdownLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },

    cancelBtn: {
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      borderRadius: theme.radius.xl,
    },
  });
}

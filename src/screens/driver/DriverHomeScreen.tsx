// src/screens/driver/DriverHomeScreen.tsx
// Driver home: online/offline toggle card + earnings summary + live map while online.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  Linking,
  AppState,
  TouchableOpacity,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Wifi, WifiOff, TrendingUp, Star, MapPin, Navigation, CheckCircle, Clock, CircleDollarSign, Ruler } from 'lucide-react-native';

import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';

import { useTheme } from '../../contexts/ThemeContext';
import { useTaxiStore } from '../../store/useTaxiStore';
import { taxiSocket } from '../../services/taxiSocket.service';
import { updateDriverStatus, updateDriverLocation, getDriverEarnings, startRide, completeRide, getDriverRides, getDriverProfile, getRide } from '../../api/taxi';
import { useDriverLocationPermission } from '../../hooks/useDriverLocationPermission';
import { startDriverLocationUpdates, stopDriverLocationUpdates } from '../../services/driverBackgroundLocation';
import type { TaxiRide } from '../../api/taxi';
import { useAuth } from '../../store/useAuth';
import { useI18n } from '../../i18n';
import { useRegion } from '../../store/useRegion';
import { formatCurrency, langToLocale } from '../../utils/format';
import type { NewRideRequestPayload } from '../../services/taxiSocket.service';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui';
import DriverIncomingRideScreen from './DriverIncomingRideScreen';

// Show notification banner even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function DriverHomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuth((s) => s.token);
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const intlLocale = langToLocale(language);

  const isDriverOnline = useTaxiStore((s) => s.isDriverOnline);
  const setDriverOnline = useTaxiStore((s) => s.setDriverOnline);
  const setDriverLocation = useTaxiStore((s) => s.setDriverLocation);
  const driverEarnings = useTaxiStore((s) => s.driverEarnings);
  const setDriverEarnings = useTaxiStore((s) => s.setDriverEarnings);
  const incomingRide = useTaxiStore((s) => s.incomingRide);
  const setIncomingRide = useTaxiStore((s) => s.setIncomingRide);

  const bgPerm = useDriverLocationPermission();

  const [toggling, setToggling] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rideActionError, setRideActionError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [driverActiveRide, setDriverActiveRide] = useState<NewRideRequestPayload | null>(null);
  const [activeRideStatus, setActiveRideStatus] = useState<'matched' | 'inProgress' | null>(null);
  const [rideActioning, setRideActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const [historyRides, setHistoryRides] = useState<TaxiRide[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 41.015137,
    longitude: 28.97953,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const mapRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const rideRequestListenerRef = useRef<((p: any) => void) | null>(null);
  const isDriverOnlineRef = useRef(isDriverOnline);
  // Son bilinen konum — socket bağlanır bağlanmaz anlık gönderim için
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Animated value: 0 = offline, 1 = online
  const onlineProgress = useSharedValue(isDriverOnline ? 1 : 0);
  // Pulse opacity for the "waiting" indicator
  const pulseOpacity = useSharedValue(0);

  // Card background interpolation: offline=surfaceAlt → online=driver.main
  const cardAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      onlineProgress.value,
      [0, 1],
      [theme.colors.surfaceAlt, theme.driver.main],
    ),
  }));

  // Pulse animation when online
  useEffect(() => {
    if (isDriverOnline) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isDriverOnline, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // isDriverOnlineRef'i her state değişiminde güncelle
  useEffect(() => {
    isDriverOnlineRef.current = isDriverOnline;
  }, [isDriverOnline]);

  // Sürücü moduna her girişte arka plan izni iste (kabul edilene kadar)
  useEffect(() => {
    bgPerm.check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load earnings on mount
  useEffect(() => {
    getDriverEarnings()
      .then(setDriverEarnings)
      .catch(() => {});
  }, [setDriverEarnings]);

  // Backend durumunu sync et + AppState ile reconnect
  useEffect(() => {
    if (!token) return;

    const connectSocket = () => {
      if (!taxiSocket.connected) {
        taxiSocket.connect(token, 'driver');
        const onConn = () => {
          taxiSocket.emit('driver:online');
          // Socket bağlanır bağlanmaz anlık konum gönder — yolcunun haritası beklemeden güncellenir
          if (lastLocationRef.current) {
            taxiSocket.emit('driver:location', lastLocationRef.current);
          }
          taxiSocket.off('connect', onConn);
        };
        taxiSocket.on('connect', onConn);
      } else {
        taxiSocket.emit('driver:online');
        if (lastLocationRef.current) {
          taxiSocket.emit('driver:location', lastLocationRef.current);
        }
      }
    };

    const attachRideListener = () => {
      if (rideRequestListenerRef.current) {
        taxiSocket.off('ride:new_request', rideRequestListenerRef.current);
      }
      rideRequestListenerRef.current = (payload: any) => {
        setIncomingRide(payload);
        playTaxiSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      };
      taxiSocket.on('ride:new_request', rideRequestListenerRef.current);
    };

    const syncStatus = async () => {
      try {
        const profile = await getDriverProfile();
        const online = profile?.isOnline ?? false;
        setDriverOnline(online);
        onlineProgress.value = withTiming(online ? 1 : 0, { duration: 300 });
        if (online) {
          // Taze konumu DB'ye yaz (socket:driver:online'dan önce — $near sorgusu için)
          await startLocationWatch();
          connectSocket();
          attachRideListener();

          // Aktif yolculuğu geri yükle (app kapanınca React state sıfırlanır)
          if (profile.activeRide) {
            try {
              const ride = await getRide(String(profile.activeRide));
              if (ride && (ride.status === 'matched' || ride.status === 'inProgress')) {
                setDriverActiveRide({
                  rideId: String(ride._id),
                  pickup: ride.pickup,
                  dropoff: ride.dropoff,
                  vehicleType: ride.vehicleType,
                  fare: ride.fare,
                  distanceKm: ride.distanceKm,
                  durationMin: ride.durationMin,
                  requestedAt: ride.requestedAt ?? new Date().toISOString(),
                });
                setActiveRideStatus(ride.status === 'inProgress' ? 'inProgress' : 'matched');
                // Ride odasına yeniden katıl (konum event'ları için)
                taxiSocket.emit('ride:join', { rideId: String(ride._id) });
              }
            } catch { /* sessiz */ }
          }
        }
      } catch { /* sessiz */ }
    };

    syncStatus();

    // Uygulama ön plana gelince reconnect
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isDriverOnlineRef.current && token) {
        connectSocket();
        syncStatus();
      }
    });

    return () => appStateSub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Location helpers ─────────────────────────────────────────────────────

  const startLocationWatch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationDenied(true);
      return false;
    }

    // Zaten aktif bir izleyici varsa yeniden başlatma — izleyici sızıntısını önler
    // (syncStatus + AppState 'active' + toggle aynı anda çağırabilir).
    if (locationWatcherRef.current) {
      if (lastLocationRef.current) {
        await updateDriverLocation(lastLocationRef.current.lat, lastLocationRef.current.lng).catch(() => {});
      }
      return true;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = current.coords;
    const region = { latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    setMapRegion(region);
    setDriverLocation({ lat: latitude, lng: longitude });
    lastLocationRef.current = { lat: latitude, lng: longitude };
    mapRef.current?.animateToRegion(region, 600);
    // İlk konumu hemen DB'ye yaz (createRide $near sorgusu için kritik)
    await updateDriverLocation(latitude, longitude).catch(() => {});

    locationWatcherRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5000 },
      (loc) => {
        const { latitude: lat, longitude: lng } = loc.coords;
        setDriverLocation({ lat, lng });
        lastLocationRef.current = { lat, lng };
        updateDriverLocation(lat, lng).catch(() => {});
        taxiSocket.emit('driver:location', { lat, lng });
      },
    );
    return true;
  }, [setDriverLocation]);

  const stopLocationWatch = useCallback(() => {
    locationWatcherRef.current?.remove();
    locationWatcherRef.current = null;
  }, []);

  // ── Active ride socket listener ──────────────────────────────────────────

  useEffect(() => {
    const handler = (payload: any) => {
      const { status } = payload ?? {};
      if (status === 'matched') {
        setActiveRideStatus('matched');
      } else if (status === 'inProgress') {
        setActiveRideStatus('inProgress');
      } else if (status === 'completed' || status === 'cancelled') {
        setDriverActiveRide(null);
        setActiveRideStatus(null);
      }
    };
    taxiSocket.on('ride:status_change', handler);
    return () => {
      taxiSocket.off('ride:status_change', handler);
    };
  }, []);

  // ── Active ride actions ───────────────────────────────────────────────────

  const handleStartRide = useCallback(async () => {
    if (!driverActiveRide || rideActioning) return;
    setRideActioning(true);
    try {
      await startRide(driverActiveRide.rideId);
      setActiveRideStatus('inProgress');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setRideActionError(e?.response?.data?.message ?? t('driver.startError'));
    } finally {
      setRideActioning(false);
    }
  }, [driverActiveRide, rideActioning]);

  const handleCompleteRide = useCallback(async () => {
    if (!driverActiveRide || rideActioning) return;
    setRideActioning(true);
    try {
      await completeRide(driverActiveRide.rideId);
      setDriverActiveRide(null);
      setActiveRideStatus(null);
      await getDriverEarnings().then(setDriverEarnings).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setRideActionError(e?.response?.data?.message ?? t('driver.completeError'));
    } finally {
      setRideActioning(false);
    }
  }, [driverActiveRide, rideActioning, setDriverEarnings]);

  const openNavigation = useCallback((lat: number, lng: number) => {
    const androidUrl = `google.navigation:q=${lat},${lng}`;
    const iosUrl = `maps://?daddr=${lat},${lng}`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    if (Platform.OS === 'android') {
      Linking.canOpenURL(androidUrl)
        .then((ok) => Linking.openURL(ok ? androidUrl : fallbackUrl))
        .catch(() => Linking.openURL(fallbackUrl));
    } else {
      Linking.canOpenURL(iosUrl)
        .then((ok) => Linking.openURL(ok ? iosUrl : fallbackUrl))
        .catch(() => Linking.openURL(fallbackUrl));
    }
  }, []);

  // ── Ride history ─────────────────────────────────────────────────────────

  const loadHistory = useCallback(async (reset = false) => {
    if (reset) {
      setHistoryLoading(true);
      setHistoryRides([]);
      setHistoryCursor(null);
    } else {
      setHistoryLoadingMore(true);
    }
    try {
      const cursor = reset ? undefined : (historyCursor ?? undefined);
      const { rides, nextCursor } = await getDriverRides(cursor);
      setHistoryRides((prev) => reset ? rides : [...prev, ...rides]);
      setHistoryCursor(nextCursor);
    } catch {
      // sessiz geç
    } finally {
      setHistoryLoading(false);
      setHistoryLoadingMore(false);
    }
  }, [historyCursor]);

  useEffect(() => {
    if (activeTab === 'history' && historyRides.length === 0) {
      loadHistory(true);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Taxi call sound ──────────────────────────────────────────────────────

  const playTaxiSound = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../../../assets/sounds/taxi_call.wav'),
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch {
      // ses çalınamazsa sessizce devam et
    }
  }, []);

  // ── Online / offline toggle ───────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);

    const goingOnline = !isDriverOnline;

    try {
      if (goingOnline) {
        await bgPerm.check(); // izin yoksa modal açılır; degrade modda yine devam
        const locationGranted = await startLocationWatch();
        if (!locationGranted) { setToggling(false); return; }

        await updateDriverStatus(true);
        if (token) {
          taxiSocket.connect(token, 'driver');

          // driver:online'ı socket bağlantısı kurulunca gönder
          const onConnect = () => {
            taxiSocket.emit('driver:online');
            taxiSocket.off('connect', onConnect);
          };
          taxiSocket.on('connect', onConnect);

          // Gelen çağrıları dinle — ref ile yönet
          if (rideRequestListenerRef.current) {
            taxiSocket.off('ride:new_request', rideRequestListenerRef.current);
          }
          rideRequestListenerRef.current = (payload: any) => {
            setIncomingRide(payload);
            playTaxiSound();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          };
          taxiSocket.on('ride:new_request', rideRequestListenerRef.current);
        }

        onlineProgress.value = withTiming(1, { duration: 300 });
        setDriverOnline(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        startDriverLocationUpdates().catch(() => {});
      } else {
        // Önce arka plan/ön plan konum takibini kesin durdur — emit sızıntısını ve
        // otomatik reconnect ile tekrar çevrimiçi olmayı önler
        stopLocationWatch();
        await stopDriverLocationUpdates().catch(() => {});

        // Socket'e açıkça çevrimdışı ol — backend isOnline/isAvailable=false yapar
        // ve passengers:map'e driver:went_offline yayınlar (müşteri haritasından kaldırır)
        if (taxiSocket.connected) {
          taxiSocket.emit('driver:offline');
        }

        await updateDriverStatus(false);

        if (rideRequestListenerRef.current) {
          taxiSocket.off('ride:new_request', rideRequestListenerRef.current);
          rideRequestListenerRef.current = null;
        }
        // Olası bekleyen connect dinleyicilerini temizle (reconnect'te driver:online yeniden yaymasın)
        taxiSocket.off('connect');
        taxiSocket.disconnect();
        onlineProgress.value = withTiming(0, { duration: 300 });
        setDriverOnline(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      setStatusError('Durum değiştirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setToggling(false);
    }
  }, [
    toggling,
    isDriverOnline,
    token,
    startLocationWatch,
    stopLocationWatch,
    onlineProgress,
    setDriverOnline,
    setIncomingRide,
    playTaxiSound,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationWatch();
    };
  }, [stopLocationWatch]);

  // Bildirime tıklanınca gelen ride request'i işle
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'ride:new_request' && data?.rideId) {
        setIncomingRide({
          rideId: data.rideId,
          pickup: data.pickup,
          dropoff: data.dropoff,
          vehicleType: data.vehicleType,
          fare: data.fare,
          distanceKm: data.distanceKm ?? 0,
          durationMin: data.durationMin ?? 0,
          requestedAt: new Date().toISOString(),
        });
      }
    });
    return () => sub.remove();
  }, [setIncomingRide]);

  const earnings = driverEarnings;
  const s = styles(theme, insets);

  return (
    <View style={s.root}>
      {/* ── Map (visible when online) ── */}
      {isDriverOnline && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          region={mapRegion}
          showsUserLocation
          showsMyLocationButton={false}
        />
      )}

      {/* ── Offline placeholder ── */}
      {!isDriverOnline && (
        <View style={s.offlineBg}>
          <MapPin size={48} color={theme.colors.borderDefault} strokeWidth={1.2} />
          <Text style={s.offlineBgText}>Çevrimiçi olunca harita görünür</Text>
        </View>
      )}

      {/* ── Tab switcher ── */}
      <View style={[s.tabBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.tabBarInner}>
          <View
            style={[s.tabIndicator, {
              left: activeTab === 'home' ? 4 : '50%' as any,
              right: activeTab === 'home' ? '50%' as any : 4,
            }]}
          />
          {(['home', 'history'] as const).map((tab) => (
            <View
              key={tab}
              style={s.tabItem}
            >
              <Text
                style={[s.tabText, activeTab === tab && s.tabTextActive]}
                onPress={() => setActiveTab(tab)}
              >
                {tab === 'home' ? 'Ana Sayfa' : 'Geçmiş'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Overlay content (home tab) ── */}
      {activeTab === 'history' ? (
        <View style={[s.historyContainer, { paddingTop: insets.top + 60 }]}>
          {historyLoading ? (
            <View style={s.historyCenter}>
              <Text style={s.historyEmpty}>Yükleniyor…</Text>
            </View>
          ) : historyRides.length === 0 ? (
            <View style={s.historyCenter}>
              <Clock size={40} color={theme.colors.textTertiary} strokeWidth={1.2} />
              <Text style={s.historyEmpty}>Henüz tamamlanan yolculuk yok</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
              {historyRides.map((ride) => {
                const passengerName = typeof ride.passenger === 'object' ? (ride.passenger as any).name : 'Yolcu';
                const date = ride.completedAt
                  ? new Date(ride.completedAt).toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '—';
                return (
                  <View key={ride._id} style={s.historyCard}>
                    <View style={s.historyCardHeader}>
                      <Text style={s.historyPassenger}>{passengerName}</Text>
                      <Badge
                        variant={ride.status === 'completed' ? 'success' : 'error'}
                        size="sm"
                        label={ride.status === 'completed' ? t('driver.completed') : t('driver.cancelled')}
                      />
                    </View>
                    <View style={s.historyMeta}>
                      <View style={s.historyMetaItem}>
                        <CircleDollarSign size={13} color={theme.driver.main} strokeWidth={2} />
                        <Text style={s.historyMetaText}>{ride.fare != null ? formatCurrency(ride.fare, region, language, 0) : '—'}</Text>
                      </View>
                      <View style={s.historyMetaItem}>
                        <Ruler size={13} color={theme.colors.textTertiary} strokeWidth={2} />
                        <Text style={s.historyMetaText}>{ride.distanceKm?.toFixed(1) ?? '—'} km</Text>
                      </View>
                      <View style={s.historyMetaItem}>
                        <Clock size={13} color={theme.colors.textTertiary} strokeWidth={2} />
                        <Text style={s.historyMetaText}>{date}</Text>
                      </View>
                    </View>
                    <Text style={s.historyDropoff} numberOfLines={1}>
                      → {ride.dropoff?.address ?? '—'}
                    </Text>
                  </View>
                );
              })}
              {historyCursor && (
                <View style={{ alignItems: 'center', marginTop: 8 }}>
                  <Text
                    style={{ ...theme.typography.labelMd, color: theme.driver.main }}
                    onPress={() => loadHistory(false)}
                  >
                    {historyLoadingMore ? 'Yükleniyor…' : 'Daha Fazla'}
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
      <View style={[s.overlay, { paddingTop: insets.top + 60 }]}>

        {/* ── Online/Offline toggle card ── */}
        <Animated.View style={[s.toggleCard, cardAnimStyle]}>
          <View style={s.toggleLeft}>
            {isDriverOnline
              ? <Wifi size={28} color={theme.colors.textInverse} strokeWidth={2} />
              : <WifiOff size={28} color={theme.colors.textSecondary} strokeWidth={2} />
            }
            <View>
              <Text style={[s.toggleStatus, isDriverOnline && s.toggleStatusOnline]}>
                {isDriverOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
              <Text style={[s.toggleSub, isDriverOnline && s.toggleSubOnline]}>
                {isDriverOnline ? 'Yolcu talepleri alınıyor' : 'Yolcu talebi almıyorsunuz'}
              </Text>
            </View>
          </View>

          <Button
            variant={isDriverOnline ? 'secondary' : 'primary'}
            size="md"
            loading={toggling}
            onPress={handleToggle}
            haptic="none"
            style={{
              ...s.toggleBtn,
              backgroundColor: isDriverOnline ? theme.colors.surface : theme.driver.main,
            }}
          >
            {isDriverOnline ? 'Kapat' : 'Aç'}
          </Button>
        </Animated.View>

        {locationDenied && (
          <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center', marginVertical: 4 }}>
            Konum izni olmadan online olamazsınız.
          </Text>
        )}
        {statusError && (
          <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center', marginVertical: 4 }}>
            {statusError}
          </Text>
        )}

        {/* ── Earnings card ── */}
        {earnings && (
          <View style={s.earningsCard}>
            <View style={s.earningsRow}>
              <TrendingUp size={18} color={theme.driver.main} strokeWidth={2} />
              <Text style={s.earningsLabel}>Günlük Kazanç</Text>
            </View>
            <Text style={s.earningsAmount}>
              {formatCurrency(earnings.todayEarnings ?? earnings.totalEarnings, region, language, 0)}
            </Text>
            <View style={s.earningsMeta}>
              <View style={s.earningsMetaItem}>
                <Text style={s.earningsMetaValue}>
                  {earnings.todayRideCount ?? earnings.todayRides ?? earnings.totalRides}
                </Text>
                <Text style={s.earningsMetaLabel}>{t('driver.todayRides')}</Text>
              </View>
              {earnings.averageRating != null && (
                <View style={s.earningsMetaItem}>
                  <View style={s.ratingRow}>
                    <Star size={13} color={theme.semantic.warning.main} fill={theme.semantic.warning.main} />
                    <Text style={s.earningsMetaValue}>{earnings.averageRating.toFixed(1)}</Text>
                  </View>
                  <Text style={s.earningsMetaLabel}>
                    {earnings.ratingCount ? `Puan (${earnings.ratingCount})` : 'Puan'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Waiting pulse indicator (only when no active ride) ── */}
        {isDriverOnline && !driverActiveRide && (
          <Animated.View style={[s.waitingBadge, pulseStyle]}>
            <View style={s.waitingDot} />
            <Text style={s.waitingText}>Yolcu bekleniyor…</Text>
          </Animated.View>
        )}

        {/* ── Active ride card ── */}
        {driverActiveRide && (
          <View style={s.activeRideCard}>
            {/* Status badge */}
            <View style={s.activeRideStatus}>
              <View style={[s.activeRideDot, {
                backgroundColor: activeRideStatus === 'inProgress' ? theme.driver.main : theme.semantic.warning.main,
              }]} />
              <Text style={s.activeRideStatusText}>
                {activeRideStatus === 'inProgress' ? t('driver.rideActive') : t('driver.rideMatched')}
              </Text>
            </View>

            {/* Addresses */}
            <View style={s.activeRideAddresses}>
              <View style={s.activeRideRow}>
                <View style={[s.activeRideAddrDot, { backgroundColor: theme.colors.success }]} />
                <Text style={s.activeRideAddrText} numberOfLines={1}>
                  {driverActiveRide.pickup.address}
                </Text>
              </View>
              <View style={s.activeRideDivider} />
              <View style={s.activeRideRow}>
                <View style={[s.activeRideAddrDot, { backgroundColor: theme.colors.error }]} />
                <Text style={s.activeRideAddrText} numberOfLines={1}>
                  {driverActiveRide.dropoff.address}
                </Text>
              </View>
            </View>

            {/* Navigation button — pickup when matched, dropoff when inProgress */}
            {(activeRideStatus === 'matched' || activeRideStatus === 'inProgress') && driverActiveRide && (
              <Button
                variant="outline"
                size="md"
                onPress={() => {
                  const coords = activeRideStatus === 'matched'
                    ? driverActiveRide.pickup.coordinates   // [lng, lat]
                    : driverActiveRide.dropoff.coordinates; // [lng, lat]
                  // GeoJSON format: [longitude, latitude]
                  openNavigation(coords[1], coords[0]);
                }}
                style={{ borderColor: theme.driver.main, marginBottom: theme.space[2] }}
              >
                <Navigation size={15} color={theme.driver.main} strokeWidth={2} />
                {'  '}{activeRideStatus === 'matched' ? 'Yolcuya Git' : 'Hedefe Git'}
              </Button>
            )}

            {/* Action button */}
            {activeRideStatus === 'matched' && (
              <Button
                variant="primary"
                size="md"
                loading={rideActioning}
                onPress={handleStartRide}
                style={{ backgroundColor: theme.driver.main, borderRadius: theme.radius.xl }}
              >
                Yolculuğu Başlat
              </Button>
            )}
            {activeRideStatus === 'inProgress' && (
              <Button
                variant="primary"
                size="md"
                loading={rideActioning}
                onPress={handleCompleteRide}
                style={{ backgroundColor: theme.colors.success, borderRadius: theme.radius.xl }}
              >
                Yolculuğu Tamamla
              </Button>
            )}
            {rideActionError && (
              <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                {rideActionError}
              </Text>
            )}
          </View>
        )}
      </View>
      )}

      {/* ── Incoming ride modal ── */}
      <Modal
        visible={incomingRide != null}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        {incomingRide && (
          <DriverIncomingRideScreen
            payload={incomingRide}
            onAccepted={(payload) => {
              setDriverActiveRide(payload);
              setActiveRideStatus('matched');
            }}
            onClose={() => setIncomingRide(null)}
          />
        )}
      </Modal>

      {/* ── Background location permission modal ── */}
      <Modal transparent visible={bgPerm.modalVisible} animationType="fade" onRequestClose={bgPerm.dismiss}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.space[6], margin: theme.space[5], width: '86%' }}>
            <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, marginBottom: theme.space[2] }}>
              {t('driver.bgPermTitle')}
            </Text>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginBottom: theme.space[5] }}>
              {bgPerm.canAskAgain ? t('driver.bgPermBody') : t('driver.bgPermBodySettings')}
            </Text>
            <TouchableOpacity
              onPress={() => bgPerm.request()}
              style={{ padding: theme.space[3], borderRadius: theme.radius.lg, backgroundColor: theme.driver.main, alignItems: 'center', marginBottom: theme.space[2] }}
            >
              <Text style={{ ...theme.typography.labelMd, color: '#000', fontWeight: '700' }}>
                {bgPerm.canAskAgain ? t('driver.bgPermAllow') : t('driver.bgPermOpenSettings')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={bgPerm.dismiss} style={{ padding: theme.space[2], alignItems: 'center' }}>
              <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>{t('driver.bgPermLater')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },

    // ── Tab bar ──
    tabBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingHorizontal: theme.space[4],
    },
    tabBarInner: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.92)',
      borderRadius: theme.radius.full,
      padding: 4,
      position: 'relative',
      ...theme.getElevation(2),
    },
    tabIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      backgroundColor: theme.driver.main,
      borderRadius: theme.radius.full,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    tabText: {
      ...theme.typography.labelMd,
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.textInverse,
    },

    // ── History ──
    historyContainer: {
      flex: 1,
      paddingHorizontal: theme.space[4],
    },
    historyCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
      paddingTop: 80,
    },
    historyEmpty: {
      ...theme.typography.bodyMd,
      color: theme.colors.textTertiary,
    },
    historyCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      gap: theme.space[2],
      ...theme.getElevation(1),
    },
    historyCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    historyPassenger: {
      ...theme.typography.labelMd,
      color: theme.colors.textPrimary,
    },
    historyMeta: {
      flexDirection: 'row',
      gap: theme.space[4],
      flexWrap: 'wrap',
    },
    historyMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    historyMetaText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    historyDropoff: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },

    offlineBg: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      gap: theme.space[3],
    },
    offlineBgText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textTertiary,
    },

    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: theme.space[4],
      gap: theme.space[3],
    },

    // Toggle card
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: theme.radius['2xl'],
      padding: theme.space[4],
      ...theme.getElevation(3),
    },
    toggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      flex: 1,
    },
    toggleStatus: {
      ...theme.typography.headingSm,
      color: theme.colors.textPrimary,
    },
    toggleStatusOnline: {
      color: theme.colors.textInverse,
    },
    toggleSub: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    toggleSubOnline: {
      color: theme.colors.textInverse,
      opacity: 0.8,
    },
    toggleBtn: {
      minWidth: 72,
      borderRadius: theme.radius.xl,
    },

    // Earnings card
    earningsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius['2xl'],
      padding: theme.space[4],
      gap: theme.space[2],
      ...theme.getElevation(2),
    },
    earningsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    earningsLabel: {
      ...theme.typography.labelMd,
      color: theme.colors.textSecondary,
    },
    earningsAmount: {
      ...theme.typography.displayLg,
      color: theme.driver.main,
    },
    earningsMeta: {
      flexDirection: 'row',
      gap: theme.space[6],
    },
    earningsMetaItem: { alignItems: 'flex-start' },
    earningsMetaValue: {
      ...theme.typography.headingSm,
      color: theme.colors.textPrimary,
    },
    earningsMetaLabel: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },

    // Active ride card
    activeRideCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius['2xl'],
      padding: theme.space[4],
      gap: theme.space[3],
      ...theme.getElevation(4),
      borderWidth: 1.5,
      borderColor: theme.driver.main,
    },
    activeRideStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    activeRideDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    activeRideStatusText: {
      ...theme.typography.labelMd,
      color: theme.colors.textPrimary,
    },
    activeRideAddresses: {
      gap: 0,
    },
    activeRideRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingVertical: 4,
    },
    activeRideAddrDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flexShrink: 0,
    },
    activeRideAddrText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    activeRideDivider: {
      width: 2,
      height: 12,
      backgroundColor: theme.colors.borderDefault,
      marginLeft: 4,
    },

    // Waiting pulse
    waitingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: theme.space[2],
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.full,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      ...theme.getElevation(2),
    },
    waitingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.driver.main,
    },
    waitingText: {
      ...theme.typography.labelMd,
      color: theme.driver.main,
    },
  });
}

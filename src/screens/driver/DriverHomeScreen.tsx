// src/screens/driver/DriverHomeScreen.tsx
// Driver home: online/offline toggle card + earnings summary + live map while online.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Modal,
  Alert,
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
import { Wifi, WifiOff, TrendingUp, Star, MapPin } from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useTaxiStore } from '../../store/useTaxiStore';
import { taxiSocket } from '../../services/taxiSocket.service';
import { updateDriverStatus, updateDriverLocation, getDriverEarnings } from '../../api/taxi';
import { useAuth } from '../../store/useAuth';
import { Button } from '../../components/ui/Button';
import DriverIncomingRideScreen from './DriverIncomingRideScreen';

// ─── Component ────────────────────────────────────────────────────────────────

export default function DriverHomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuth((s) => s.token);

  const isDriverOnline = useTaxiStore((s) => s.isDriverOnline);
  const setDriverOnline = useTaxiStore((s) => s.setDriverOnline);
  const setDriverLocation = useTaxiStore((s) => s.setDriverLocation);
  const driverEarnings = useTaxiStore((s) => s.driverEarnings);
  const setDriverEarnings = useTaxiStore((s) => s.setDriverEarnings);
  const incomingRide = useTaxiStore((s) => s.incomingRide);
  const setIncomingRide = useTaxiStore((s) => s.setIncomingRide);

  const [toggling, setToggling] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 41.015137,
    longitude: 28.97953,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const mapRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

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

  // Load earnings on mount
  useEffect(() => {
    getDriverEarnings()
      .then(setDriverEarnings)
      .catch(() => {});
  }, [setDriverEarnings]);

  // ── Location helpers ─────────────────────────────────────────────────────

  const startLocationWatch = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Konum İzni', 'Konum izni olmadan online olamazsınız.');
      return false;
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = current.coords;
    const region = { latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
    setMapRegion(region);
    setDriverLocation({ lat: latitude, lng: longitude });
    mapRef.current?.animateToRegion(region, 600);

    locationWatcherRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5000 },
      (loc) => {
        const { latitude: lat, longitude: lng } = loc.coords;
        setDriverLocation({ lat, lng });
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

  // ── Online / offline toggle ───────────────────────────────────────────────

  const handleToggle = useCallback(async () => {
    if (toggling) return;
    setToggling(true);

    const goingOnline = !isDriverOnline;

    try {
      if (goingOnline) {
        const locationGranted = await startLocationWatch();
        if (!locationGranted) { setToggling(false); return; }

        await updateDriverStatus(true);
        if (token) taxiSocket.connect(token, 'driver');

        // Listen for incoming ride requests
        taxiSocket.on('ride:new_request', (payload: any) => {
          setIncomingRide(payload);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        });

        onlineProgress.value = withTiming(1, { duration: 300 });
        setDriverOnline(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        stopLocationWatch();
        await updateDriverStatus(false);
        taxiSocket.off('ride:new_request', setIncomingRide as any);
        taxiSocket.disconnect();
        onlineProgress.value = withTiming(0, { duration: 300 });
        setDriverOnline(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      Alert.alert('Hata', 'Durum değiştirilemedi. Lütfen tekrar deneyin.');
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
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocationWatch();
    };
  }, [stopLocationWatch]);

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

      {/* ── Overlay content ── */}
      <View style={[s.overlay, { paddingTop: insets.top + 12 }]}>

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

        {/* ── Earnings card ── */}
        {earnings && (
          <View style={s.earningsCard}>
            <View style={s.earningsRow}>
              <TrendingUp size={18} color={theme.driver.main} strokeWidth={2} />
              <Text style={s.earningsLabel}>Günlük Kazanç</Text>
            </View>
            <Text style={s.earningsAmount}>
              ₺{(earnings.todayEarnings ?? earnings.totalEarnings).toFixed(0)}
            </Text>
            <View style={s.earningsMeta}>
              <View style={s.earningsMetaItem}>
                <Text style={s.earningsMetaValue}>
                  {earnings.todayRideCount ?? earnings.todayRides ?? earnings.totalRides}
                </Text>
                <Text style={s.earningsMetaLabel}>Yolculuk</Text>
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

        {/* ── Waiting pulse indicator ── */}
        {isDriverOnline && (
          <Animated.View style={[s.waitingBadge, pulseStyle]}>
            <View style={s.waitingDot} />
            <Text style={s.waitingText}>Yolcu bekleniyor…</Text>
          </Animated.View>
        )}
      </View>

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
            onClose={() => setIncomingRide(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },

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

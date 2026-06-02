// src/screens/taxi/TaxiHomeScreen.tsx
// Passenger home: full-screen map + vehicle type carousel + "Where to?" sheet.

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MapPin, Car, Users, Crown, PawPrint, ChevronLeft, History } from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useTaxiStore } from '../../store/useTaxiStore';
import { taxiSocket } from '../../services/taxiSocket.service';
import { useAuth } from '../../store/useAuth';
import { getActiveRide } from '../../api/taxi';
import type { VehicleType } from '../../api/taxi';

// ─── Vehicle type config ──────────────────────────────────────────────────────

interface VehicleOption {
  type: VehicleType;
  label: string;
  sublabel: string;
  Icon: React.FC<{ size: number; color: string; strokeWidth?: number }>;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  { type: 'ride', label: 'Ride', sublabel: '1-4 kişi', Icon: Car as any },
  { type: 'xl', label: 'XL', sublabel: '1-6 kişi', Icon: Users as any },
  { type: 'lux', label: 'Lüks', sublabel: 'Premium', Icon: Crown as any },
  { type: 'pet', label: 'Pet', sublabel: 'Evcil dost', Icon: PawPrint as any },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiHomeScreen({ navigation, route }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuth((s) => s.token);
  const mapRef = useRef<MapView>(null);

  const selectedVehicleType = useTaxiStore((s) => s.selectedVehicleType);
  const setSelectedVehicleType = useTaxiStore((s) => s.setSelectedVehicleType);
  const setActiveRide = useTaxiStore((s) => s.setActiveRide);
  const setIsSearching = useTaxiStore((s) => s.setIsSearching);
  const nearbyDrivers = useTaxiStore((s) => s.nearbyDrivers);
  const updateNearbyDriver = useTaxiStore((s) => s.updateNearbyDriver);
  const setPickup = useTaxiStore((s) => s.setPickup);

  const [userRegion, setUserRegion] = React.useState({
    latitude: 41.015137,
    longitude: 28.979530,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Aktif yolculuk kontrolü — varsa direkt TaxiMatched'e yönlendir
  useEffect(() => {
    if (!token) return;
    getActiveRide()
      .then((ride) => {
        if (ride) {
          setActiveRide(ride);
          setIsSearching(ride.status === 'searching');
          navigation.replace('TaxiMatched', { rideId: ride._id });
        }
      })
      .catch(() => {}); // aktif yolculuk yoksa sessiz geç
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Request location and connect socket
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      const region = { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
      setUserRegion(region);
      mapRef.current?.animateToRegion(region, 800);

      // Pickup konumunu store'a kaydet (TaxiDestination ekranında önceden dolu gelsin)
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        const g = geo[0];
        const address = [g?.street, g?.streetNumber, g?.district, g?.city]
          .filter(Boolean).join(', ') || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setPickup(address, { lat: latitude, lng: longitude });
      } catch {
        setPickup(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, { lat: latitude, lng: longitude });
      }
    })();

    // Connect socket to receive nearby driver location updates
    if (token) {
      taxiSocket.connect(token, 'passenger');
      taxiSocket.on('driver:location:update', (payload: any) => {
        updateNearbyDriver({
          driverId: payload.driverId,
          lat: payload.lat,
          lng: payload.lng,
        });
      });
    }

    return () => {
      taxiSocket.off('driver:location:update', updateNearbyDriver as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate('TaxiDestination');
  }, [navigation]);

  const s = styles(theme, insets);

  return (
    <View style={s.root}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={userRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
          tileSize={256}
        />
        {/* Nearby drivers — statik view kullanılıyor (Reanimated hooks StaticContainer içinde çalışmaz) */}
        {nearbyDrivers.map((d) => (
          <Marker
            key={d.driverId}
            coordinate={{ latitude: d.lat, longitude: d.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: theme.taxi.main,
              alignItems: "center", justifyContent: "center",
              shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 }, elevation: 4,
            }}>
              <Car size={18} color="#fff" strokeWidth={2} />
            </View>
          </Marker>
        ))}
      </MapView>

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

      {/* Bottom sheet — fixed 40% */}
      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        {/* "Where to?" input trigger */}
        <Pressable style={s.searchBar} onPress={handleSearchPress}>
          <MapPin size={18} color={theme.taxi.main} strokeWidth={2.5} />
          <Text style={s.searchPlaceholder}>Nereye?</Text>
        </Pressable>

        {/* Vehicle type — ekrana tam oturan 4 eşit kart */}
        <Text style={s.carouselLabel}>Araç tipi</Text>
        <View style={s.carouselRow}>
          {VEHICLE_OPTIONS.map((opt) => {
            const active = selectedVehicleType === opt.type;
            return (
              <TouchableOpacity
                key={opt.type}
                style={[s.vehicleCard, active && s.vehicleCardActive]}
                onPress={() => setSelectedVehicleType(opt.type)}
                activeOpacity={0.78}
              >
                <opt.Icon
                  size={22}
                  color={active ? theme.colors.textInverse : theme.taxi.main}
                  strokeWidth={2}
                />
                <Text style={[s.vehicleLabel, active && s.vehicleLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[s.vehicleSub, active && s.vehicleSubActive]}>
                  {opt.sublabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },

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
    backBubble: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    historyBubble: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topTitle: {
      ...theme.typography.headingMd,
      color: theme.colors.surface,
      textShadowColor: 'rgba(0,0,0,0.55)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },

    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius['2xl'],
      borderTopRightRadius: theme.radius['2xl'],
      paddingTop: theme.space[4],
      paddingHorizontal: theme.space[4],
      ...theme.getElevation(4),
    },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.xl,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      marginBottom: theme.space[4],
    },
    searchPlaceholder: {
      ...theme.typography.bodyLg,
      color: theme.colors.textTertiary,
      flex: 1,
    },

    carouselLabel: {
      ...theme.typography.labelMd,
      color: theme.colors.textSecondary,
      marginBottom: theme.space[2],
    },
    carouselRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },

    vehicleCard: {
      flex: 1,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[1],
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.taxi.main,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: theme.colors.surface,
    },
    vehicleCardActive: {
      backgroundColor: theme.taxi.main,
      borderColor: theme.taxi.main,
    },
    vehicleLabel: {
      ...theme.typography.labelMd,
      color: theme.taxi.main,
    },
    vehicleLabelActive: {
      color: theme.colors.textInverse,
    },
    vehicleSub: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
    },
    vehicleSubActive: {
      color: theme.colors.textInverse,
    },
  });
}

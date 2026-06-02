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
import { getRide, rateRide, type TaxiRide, type TaxiDriverInfo } from '../../api/taxi';

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

function InfoRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>{label}</Text>
      <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary, maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
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

  const driver = ride.driver as TaxiDriverInfo | null | undefined;
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
          <InfoRow label="Tarih" value={formatDate(ride.completedAt ?? ride.requestedAt)} theme={theme} />
          <View style={s.divider} />
          <InfoRow label="Mesafe" value={ride.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label="Süre" value={ride.durationMin ? `${ride.durationMin} dk` : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label="Ücret" value={ride.fare ? `₺${ride.fare.toFixed(2)}` : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label="Ödeme" value={
            ride.paymentMethod === 'cash' ? 'Nakit' :
            ride.paymentMethod === 'card' ? 'Kart' : 'Online'
          } theme={theme} />
        </View>

        {/* Driver & Vehicle */}
        {hasDriver && driver && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Sürücü & Araç</Text>
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <User size={22} color={theme.taxi.main} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{driver.user?.name ?? 'Sürücü'}</Text>
                {driver.user?.phone ? (
                  <Text style={s.driverPhone}>{driver.user.phone}</Text>
                ) : null}
              </View>
              {driver.rating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={14} color={theme.taxi.main} fill={theme.taxi.main} />
                  <Text style={[s.driverPhone, { color: theme.taxi.main, fontWeight: '700' }]}>
                    {driver.rating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={s.divider} />
            <View style={s.vehicleRow}>
              <Car size={18} color={theme.colors.textSecondary} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={s.vehicleText}>
                  {driver.vehicleBrand} {driver.vehicleModel}
                </Text>
                <Text style={s.vehiclePlate}>{driver.vehiclePlate}</Text>
              </View>
              {driver.vehicleColor ? (
                <View style={{
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: driver.vehicleColor.toLowerCase(),
                  borderWidth: 1, borderColor: theme.colors.borderDefault,
                }} />
              ) : null}
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

// src/screens/taxi/TaxiRideDetailScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Navigation, Car, User, Star } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n';
import { getRide, rateRide, type TaxiRide, type TaxiDriverInfo } from '../../api/taxi';
import { formatCurrency, langToLocale } from '../../utils/format';
import { useRegion } from '../../store/useRegion';

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

function formatDate(dateStr?: string, locale = 'tr-TR'): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(locale, {
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
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const intlLocale = langToLocale(language);

  const [ride, setRide] = useState<TaxiRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  useEffect(() => {
    getRide(rideId)
      .then(setRide)
      .catch(() => setFetchError(t('taxi.detail.fetchError')))
      .finally(() => setLoading(false));
  }, [rideId]);

  const handleSubmitRating = useCallback(async () => {
    if (!selectedStar || !ride) return;
    setSubmitting(true);
    setRatingError(null);
    try {
      await rateRide(ride._id, selectedStar);
      setRide((prev) => prev ? { ...prev, passengerRating: selectedStar } : prev);
    } catch (e: any) {
      setRatingError(e?.response?.data?.message ?? t('taxi.detail.ratingError'));
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

  if (fetchError || !ride) {
    return (
      <View style={s.root}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={20} color={theme.colors.textPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('taxi.detail.title')}</Text>
          <View style={{ width: 34 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center' }}>
            {fetchError ?? t('taxi.detail.fetchError')}
          </Text>
        </View>
      </View>
    );
  }

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
        <Text style={s.headerTitle}>{t('taxi.detail.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Route Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('taxi.detail.route')}</Text>
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
          <Text style={s.sectionTitle}>{t('taxi.detail.tripInfo')}</Text>
          <InfoRow label={t('taxi.detail.date')} value={formatDate(ride.completedAt ?? ride.requestedAt, intlLocale)} theme={theme} />
          <View style={s.divider} />
          <InfoRow label={t('taxi.detail.distance')} value={ride.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label={t('taxi.detail.duration')} value={ride.durationMin ? `${ride.durationMin} dk` : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label={t('taxi.detail.fare')} value={ride.fare != null ? formatCurrency(ride.fare, region, language) : '—'} theme={theme} />
          <View style={s.divider} />
          <InfoRow label={t('taxi.detail.payment')} value={
            ride.paymentMethod === 'cash' ? t('taxi.detail.cash') :
            ride.paymentMethod === 'card' ? t('taxi.detail.card') : t('taxi.detail.online')
          } theme={theme} />
        </View>

        {/* Driver & Vehicle */}
        {hasDriver && driver && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('taxi.detail.driverVehicle')}</Text>
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <User size={22} color={theme.taxi.main} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{driver.user?.name ?? t('taxi.detail.driver')}</Text>
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
            <Text style={s.sectionTitle}>{t('taxi.detail.rating')}</Text>
            {alreadyRated ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                <StarRating value={ride.passengerRating!} readonly color={theme.taxi.main} />
                <Text style={s.ratedText}>{t('taxi.detail.ratedText')}</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Text style={s.ratePrompt}>{t('taxi.detail.ratePrompt')}</Text>
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
                    : <Text style={s.submitBtnText}>{t('taxi.detail.submit')}</Text>
                  }
                </TouchableOpacity>
                {ratingError && (
                  <Text style={{ ...theme.typography.bodySm, color: theme.colors.error, textAlign: 'center', marginTop: 8 }}>
                    {ratingError}
                  </Text>
                )}
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

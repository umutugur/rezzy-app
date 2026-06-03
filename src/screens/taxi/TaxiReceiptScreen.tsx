// src/screens/taxi/TaxiReceiptScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { CheckCircle, Clock, Ruler, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../contexts/ThemeContext';
import { submitReview } from '../../api/reviews';

// StarRating component (inline — no separate import needed)
function StarRating({ value, onChange, size = 32 }: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={8}>
          <Text style={{ fontSize: size, opacity: star <= value ? 1 : 0.25 }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export type TaxiReceiptParams = {
  rideId: string;
  fare: number;
  distanceKm: number;
  durationMin: number;
  pickupAddress: string;
  dropoffAddress: string;
  paymentMethod: string;
  driverId: string;
};

export default function TaxiReceiptScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ TaxiReceipt: TaxiReceiptParams }, 'TaxiReceipt'>>();
  const { rideId, fare, distanceKm, durationMin, pickupAddress, dropoffAddress, paymentMethod, driverId } = route.params;

  const [rating, setRating] = useState(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const paymentLabel = paymentMethod === 'cash' ? 'Nakit' : paymentMethod === 'card' ? 'Kart' : 'Online';

  const handleSubmitRating = useCallback(async () => {
    setRatingError(null);
    setSubmitting(true);
    try {
      await submitReview('taxi_driver', driverId, { rating });
      setRatingSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setRatingError('Puanlama gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  }, [driverId, rating]);

  const handleDone = useCallback(() => {
    // Pop back to TaxiHome (replace so receipt doesn't stay in stack)
    navigation.reset({ index: 0, routes: [{ name: 'TaxiHome' }] });
  }, [navigation]);

  const s = makeStyles(theme, insets);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.checkCircle}>
            <CheckCircle size={48} color={theme.taxi.main} strokeWidth={1.5} />
          </View>
          <Text style={s.heroTitle}>Yolculuk Tamamlandı</Text>
          <Text style={s.heroFare}>₺{fare.toFixed(2)}</Text>
          <Text style={s.heroSub}>{paymentLabel} ile ödendi</Text>
        </View>

        {/* ── Trip info ── */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Ruler size={16} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={s.infoLabel}>Mesafe</Text>
            <Text style={s.infoValue}>{distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={[s.infoRow, s.infoRowBorder]}>
            <Clock size={16} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={s.infoLabel}>Süre</Text>
            <Text style={s.infoValue}>{durationMin} dk</Text>
          </View>
          <View style={[s.infoRow, s.infoRowBorder]}>
            <CreditCard size={16} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={s.infoLabel}>Ödeme</Text>
            <Text style={s.infoValue}>{paymentLabel}</Text>
          </View>
        </View>

        {/* ── Route ── */}
        <View style={s.card}>
          <View style={s.routeRow}>
            <View style={[s.routeDot, { backgroundColor: theme.colors.success }]} />
            <View style={s.routeTextWrap}>
              <Text style={s.routeLabel}>Kalkış</Text>
              <Text style={s.routeAddr} numberOfLines={2}>{pickupAddress}</Text>
            </View>
          </View>
          <View style={s.routeConnector} />
          <View style={s.routeRow}>
            <View style={[s.routeDot, { backgroundColor: theme.colors.error }]} />
            <View style={s.routeTextWrap}>
              <Text style={s.routeLabel}>Varış</Text>
              <Text style={s.routeAddr} numberOfLines={2}>{dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* ── Rating ── */}
        {!ratingSubmitted ? (
          <View style={s.ratingCard}>
            <Text style={s.ratingTitle}>Sürücüyü Değerlendir</Text>
            <Text style={s.ratingSubtitle}>Yolculuğunuz nasıldı?</Text>
            <StarRating value={rating} onChange={setRating} size={36} />
            <TouchableOpacity
              onPress={handleSubmitRating}
              disabled={submitting}
              style={[s.ratingBtn, { opacity: submitting ? 0.6 : 1 }]}
            >
              <Text style={s.ratingBtnText}>{submitting ? 'Gönderiliyor…' : 'Puanı Gönder'}</Text>
            </TouchableOpacity>
            {ratingError && (
              <Text style={{ color: theme.colors.error, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                {ratingError}
              </Text>
            )}
            <TouchableOpacity onPress={handleDone} style={s.skipBtn}>
              <Text style={s.skipBtnText}>Geç</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.ratingCard}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>⭐</Text>
            <Text style={[s.ratingTitle, { color: theme.colors.success }]}>Teşekkürler!</Text>
            <Text style={s.ratingSubtitle}>Puanınız gönderildi.</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Done button (only after rating submitted) ── */}
      {ratingSubmitted && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity onPress={handleDone} style={s.doneBtn}>
            <Text style={s.doneBtnText}>Ana Sayfaya Dön</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { paddingTop: insets.top + 16, paddingBottom: 32, gap: 12, paddingHorizontal: theme.space[4] },

    hero: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    checkCircle: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: theme.taxi.main + '18',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    },
    heroTitle: { ...theme.typography.headingLg, color: theme.colors.textPrimary },
    heroFare: { ...theme.typography.display2xl, color: theme.taxi.main },
    heroSub: { ...theme.typography.bodyMd, color: theme.colors.textSecondary },

    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius['2xl'],
      padding: theme.space[4],
      ...theme.getElevation(1),
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], paddingVertical: 8 },
    infoRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderDefault },
    infoLabel: { ...theme.typography.bodyMd, color: theme.colors.textSecondary, flex: 1 },
    infoValue: { ...theme.typography.labelMd, color: theme.colors.textPrimary },

    routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] },
    routeDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, flexShrink: 0 },
    routeTextWrap: { flex: 1 },
    routeLabel: { ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 2 },
    routeAddr: { ...theme.typography.bodyMd, color: theme.colors.textPrimary },
    routeConnector: { width: 2, height: 16, backgroundColor: theme.colors.borderDefault, marginLeft: 5, marginVertical: 4 },

    ratingCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius['2xl'],
      padding: theme.space[5],
      alignItems: 'center',
      gap: theme.space[3],
      ...theme.getElevation(1),
    },
    ratingTitle: { ...theme.typography.headingMd, color: theme.colors.textPrimary },
    ratingSubtitle: { ...theme.typography.bodyMd, color: theme.colors.textSecondary },
    ratingBtn: {
      backgroundColor: theme.taxi.main,
      borderRadius: theme.radius.xl,
      paddingVertical: 14,
      paddingHorizontal: 40,
      marginTop: 8,
    },
    ratingBtnText: { ...theme.typography.labelLg, color: theme.colors.textInverse },
    skipBtn: { paddingVertical: 8 },
    skipBtnText: { ...theme.typography.bodyMd, color: theme.colors.textTertiary },

    footer: { paddingHorizontal: theme.space[4], paddingTop: 12, backgroundColor: theme.colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderDefault },
    doneBtn: { backgroundColor: theme.taxi.main, borderRadius: theme.radius.xl, paddingVertical: 16, alignItems: 'center' },
    doneBtnText: { ...theme.typography.labelLg, color: theme.colors.textInverse },
  });
}

// src/screens/driver/DriverIncomingRideScreen.tsx
// Full-screen modal shown when ride:new_request socket event fires.
// BG: brand-900 (dark bordeaux). 30-second animated countdown.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  MapPin,
  Navigation,
  Clock,
  Ruler,
  CircleDollarSign,
  Check,
  X,
} from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { taxiSocket } from '../../services/taxiSocket.service';
import { respondToRide } from '../../api/taxi';
import type { NewRideRequestPayload } from '../../services/taxiSocket.service';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  payload: NewRideRequestPayload;
  onClose: () => void;
  onAccepted?: (payload: NewRideRequestPayload) => void;
}

const COUNTDOWN_SECONDS = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DriverIncomingRideScreen({ payload, onClose, onAccepted }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [responding, setResponding] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown bar: 1 → 0 over COUNTDOWN_SECONDS
  const progress = useSharedValue(1);

  // Bar color: brand[400] (#FF6B6B) → error red (#DC2626)
  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 0.4, 1],
      [theme.colors.error, theme.colors.error, theme.brand[400]],
    ),
  }));

  // Countdown digit color: white → error when low
  const digitStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 0.3, 1],
      [theme.colors.error, theme.colors.error, '#FFFFFF'],
    ),
  }));

  // Start countdown on mount
  useEffect(() => {
    progress.value = withTiming(0, {
      duration: COUNTDOWN_SECONDS * 1000,
      easing: Easing.linear,
    });

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onClose();
          return 0;
        }
        // Haptic warning at 10s remaining
        if (s === 11) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
        return s - 1;
      });
    }, 1000);

    return () => { clearInterval(timerRef.current!); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Accept / Reject ───────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    if (responding) return;
    clearInterval(timerRef.current!);
    setAcceptError(null);
    setResponding(true);
    try {
      await respondToRide(payload.rideId, 'accept');
      taxiSocket.emit('ride:join', { rideId: payload.rideId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAccepted?.(payload);
      onClose();
    } catch (e: any) {
      setAcceptError(e?.response?.data?.message ?? 'Kabul edilemedi.');
      setResponding(false);
    }
  }, [responding, payload.rideId, onClose]);

  const handleReject = useCallback(async () => {
    if (responding) return;
    clearInterval(timerRef.current!);
    setResponding(true);
    try {
      await respondToRide(payload.rideId, 'reject');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onClose();
    } catch {
      onClose(); // close regardless
    }
  }, [responding, payload.rideId, onClose]);

  const s = styles(theme, insets);

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.headerTitle}>Yeni Yolcu Talebi</Text>

        {/* Countdown bar track */}
        <View style={s.barTrack}>
          <Animated.View style={[s.bar, barStyle]} />
        </View>

        {/* Countdown digit */}
        <View style={s.countdownRow}>
          <Clock size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          <Animated.Text style={[s.countdownDigit, digitStyle]}>
            {secondsLeft}s
          </Animated.Text>
        </View>
      </View>

      {/* ── Ride details ── */}
      <View style={s.body}>

        {/* Fare — hero number */}
        <View style={s.fareBlock}>
          <CircleDollarSign size={22} color={theme.taxi.main} strokeWidth={2} />
          <Text style={s.fareAmount}>₺{payload.fare.toFixed(0)}</Text>
        </View>

        {/* Meta row */}
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Ruler size={14} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            <Text style={s.metaText}>{payload.distanceKm.toFixed(1)} km</Text>
          </View>
          <View style={s.metaSep} />
          <View style={s.metaItem}>
            <Clock size={14} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            <Text style={s.metaText}>{payload.durationMin} dk</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={s.addressCard}>
          <View style={s.addressRow}>
            <View style={[s.addressDot, { backgroundColor: theme.colors.success }]} />
            <View style={s.addressTextWrap}>
              <Text style={s.addressLabel}>Kalkış</Text>
              <Text style={s.addressValue} numberOfLines={2}>
                {payload.pickup.address}
              </Text>
            </View>
          </View>

          <View style={s.addressConnector} />

          <View style={s.addressRow}>
            <View style={[s.addressDot, { backgroundColor: theme.colors.error }]} />
            <View style={s.addressTextWrap}>
              <Text style={s.addressLabel}>Varış</Text>
              <Text style={s.addressValue} numberOfLines={2}>
                {payload.dropoff.address}
              </Text>
            </View>
          </View>
        </View>

      </View>

      {/* ── Action buttons ── */}
      <View style={[s.actions, { paddingBottom: insets.bottom + 24 }]}>
        {/* REJECT */}
        <Pressable
          style={({ pressed }) => [s.rejectBtn, pressed && { opacity: 0.8 }]}
          onPress={handleReject}
          disabled={responding}
          accessibilityRole="button"
          accessibilityLabel="Reddet"
        >
          <X size={24} color={theme.colors.error} strokeWidth={2.5} />
          <Text style={s.rejectText}>REDDET</Text>
        </Pressable>

        {/* ACCEPT */}
        <Pressable
          style={({ pressed }) => [s.acceptBtn, pressed && { opacity: 0.85 }]}
          onPress={handleAccept}
          disabled={responding}
          accessibilityRole="button"
          accessibilityLabel="Kabul Et"
        >
          <Check size={26} color="#FFFFFF" strokeWidth={3} />
          <Text style={s.acceptText}>KABUL ET</Text>
        </Pressable>
      </View>
      {acceptError && (
        <Text style={{ color: theme.colors.error, fontSize: 12, textAlign: 'center', marginTop: 6, paddingHorizontal: 20, paddingBottom: 8 }}>
          {acceptError}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function styles(theme: ReturnType<typeof useTheme>, insets: ReturnType<typeof useSafeAreaInsets>) {
  // brand[900] = #330A0A — dark bordeaux, attention-grabbing background
  const BG = theme.brand[900];

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: BG,
    },

    // ── Header ──
    header: {
      paddingHorizontal: theme.space[5],
      paddingBottom: theme.space[4],
      gap: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerTitle: {
      ...theme.typography.headingLg,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    barTrack: {
      height: 6,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: theme.radius.full,
      overflow: 'hidden',
    },
    bar: {
      height: 6,
      borderRadius: theme.radius.full,
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    countdownDigit: {
      ...theme.typography.headingXl,
      fontFamily: theme.fontFamily.extraBold,
    },

    // ── Body ──
    body: {
      flex: 1,
      paddingHorizontal: theme.space[5],
      paddingTop: theme.space[6],
      gap: theme.space[4],
    },

    fareBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[3],
    },
    fareAmount: {
      ...theme.typography.display2xl,
      color: theme.taxi.main,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[4],
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
    },
    metaText: {
      ...theme.typography.labelLg,
      color: 'rgba(255,255,255,0.75)',
    },
    metaSep: {
      width: 1,
      height: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },

    // Addresses
    addressCard: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: theme.radius['2xl'],
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      gap: 0,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[3],
    },
    addressDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginTop: 4,
      flexShrink: 0,
    },
    addressTextWrap: { flex: 1 },
    addressLabel: {
      ...theme.typography.caption,
      color: 'rgba(255,255,255,0.5)',
      marginBottom: 2,
    },
    addressValue: {
      ...theme.typography.bodyMd,
      color: '#FFFFFF',
    },
    addressConnector: {
      width: 2,
      height: 16,
      backgroundColor: 'rgba(255,255,255,0.15)',
      marginLeft: 5,
      marginVertical: theme.space[1],
    },

    // ── Actions ──
    actions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[5],
      gap: theme.space[3],
      paddingTop: theme.space[4],
    },

    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      height: 64,
      borderRadius: theme.radius['2xl'],
      borderWidth: 2,
      borderColor: theme.colors.error,
      backgroundColor: 'rgba(220,38,38,0.12)',
    },
    rejectText: {
      ...theme.typography.labelLg,
      color: theme.colors.error,
      fontFamily: theme.fontFamily.extraBold,
      letterSpacing: 0.5,
    },

    acceptBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
      height: 64,
      borderRadius: theme.radius['2xl'],
      backgroundColor: theme.colors.success,
      ...theme.getElevation(3),
    },
    acceptText: {
      ...theme.typography.labelLg,
      color: '#FFFFFF',
      fontFamily: theme.fontFamily.extraBold,
      letterSpacing: 1,
    },
  });
}

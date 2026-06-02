// src/screens/taxi/TaxiHistoryScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, History, Star } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n';
import { getMyRides, type TaxiRide } from '../../api/taxi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status, theme, t }: { status: string; theme: ReturnType<typeof useTheme>; t: (k: string) => string }) {
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const bg = isCompleted ? theme.colors.success : isCancelled ? theme.colors.error : theme.colors.textTertiary;
  const label = isCompleted ? t('taxi.status.completed') : isCancelled ? t('taxi.status.cancelled') : status;
  return (
    <View style={{ backgroundColor: bg + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: bg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaxiHistoryScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [rides, setRides] = useState<TaxiRide[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRides = useCallback(async (p: number) => {
    try {
      const data = await getMyRides(p, 20);
      if (p === 1) {
        setRides(data.rides);
      } else {
        setRides((prev) => [...prev, ...data.rides]);
      }
      setPages(data.pages);
      setPage(p);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRides(1).finally(() => setLoading(false));
  }, [fetchRides]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    fetchRides(page + 1).finally(() => setLoadingMore(false));
  }, [loadingMore, page, pages, fetchRides]);

  const s = styles(theme, insets);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={20} color={theme.colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('taxi.history.title')}</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={theme.taxi.main} />
        </View>
      ) : rides.length === 0 ? (
        <View style={s.centered}>
          <History size={48} color={theme.colors.textTertiary} />
          <Text style={s.emptyText}>{t('taxi.history.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item._id}
          contentContainerStyle={s.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.taxi.main} style={{ marginVertical: 16 }} /> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('TaxiRideDetail', { rideId: item._id })}
              activeOpacity={0.75}
            >
              {/* Addresses */}
              <View style={s.addressRow}>
                <View style={[s.dot, { backgroundColor: theme.colors.success }]} />
                <Text style={s.addressText} numberOfLines={1}>{item.pickup.address}</Text>
              </View>
              <View style={[s.addressRow, { marginTop: 4 }]}>
                <View style={[s.dot, { backgroundColor: theme.colors.error }]} />
                <Text style={s.addressText} numberOfLines={1}>{item.dropoff.address}</Text>
              </View>

              {/* Meta row */}
              <View style={s.metaRow}>
                <StatusBadge status={item.status} theme={theme} t={t} />
                <Text style={s.dateText}>{formatDate(item.completedAt ?? item.requestedAt)}</Text>
                <Text style={s.fareText}>₺{item.fare?.toFixed(2) ?? '—'}</Text>
                {item.status === 'completed' && (
                  item.passengerRating
                    ? <View style={s.ratingBadge}>
                        <Star size={11} color={theme.taxi.main} fill={theme.taxi.main} />
                        <Text style={[s.ratingBadgeText, { color: theme.taxi.main }]}>{item.passengerRating}</Text>
                      </View>
                    : <Text style={s.rateLink}>{t('taxi.history.rateLink')}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...theme.typography.headingMd,
      color: theme.colors.textPrimary,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textSecondary,
    },
    listContent: {
      padding: theme.space[4],
      gap: theme.space[3],
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.colors.borderDefault,
      ...theme.getElevation(1),
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    addressText: {
      ...theme.typography.bodyMd,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginTop: theme.space[3],
      flexWrap: 'wrap',
    },
    dateText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    fareText: {
      ...theme.typography.labelMd,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingBadgeText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    rateLink: {
      ...theme.typography.caption,
      color: theme.taxi.main,
      fontWeight: '600',
    },
  });
}

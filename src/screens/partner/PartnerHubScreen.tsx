// src/screens/partner/PartnerHubScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Car,
  Store,
  UtensilsCrossed,
  Lock,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n';
import {
  getMyPartnerApplication,
  type DriverApplication,
  type AppType,
} from '../../api/driverApplication.api';

type CardDef = { appType: AppType; Icon: LucideIcon; emoji: string };

const CARDS: CardDef[] = [
  { appType: 'driver', Icon: Car, emoji: '🚗' },
  { appType: 'market', Icon: Store, emoji: '🛒' },
  { appType: 'restaurant', Icon: UtensilsCrossed, emoji: '🍽️' },
];

type StatusKey = 'draft' | 'pending' | 'approved' | 'rejected';

export default function PartnerHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<DriverApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const app = await getMyPartnerApplication();
      setApplication(app);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('partner.error.load'));
    } finally {
      setLoading(false);
    }
    // `t` deliberately excluded: useI18n's t is a fresh ref each render and would
    // recreate load → re-fire in a loop (infinite re-fetch / stuck loading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Başvuru ekranından dönünce durumu tazele.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const accentFor = (appType: AppType) =>
    appType === 'driver' ? theme.driver.main : appType === 'market' ? theme.market.main : theme.colors.primary;
  const accentSoftFor = (appType: AppType) =>
    appType === 'driver' ? theme.driver.light : appType === 'market' ? theme.market.light : theme.colors.errorSoft;

  const statusMeta = (status: StatusKey) => {
    const map: Record<StatusKey, { bg: string; fg: string; key: string }> = {
      draft: { bg: theme.colors.surfaceAlt, fg: theme.colors.textSecondary, key: 'partner.badge.draft' },
      pending: { bg: theme.colors.warningSoft, fg: theme.colors.warning, key: 'partner.badge.pending' },
      approved: { bg: theme.colors.successSoft, fg: theme.colors.success, key: 'partner.badge.approved' },
      rejected: { bg: theme.colors.errorSoft, fg: theme.colors.error, key: 'partner.badge.rejected' },
    };
    return map[status];
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginTop: 12 }}>
          {t('partner.loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <AlertCircle size={40} color={theme.colors.error} strokeWidth={1.5} />
        <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 16 }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={load}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.xl, paddingHorizontal: 20, paddingVertical: 12 }}
        >
          <RefreshCw size={16} color={theme.colors.textInverse} strokeWidth={2} />
          <Text style={{ ...theme.typography.labelMd, color: theme.colors.textInverse }}>{t('partner.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ownedType = application?.appType ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ ...theme.typography.headingLg, color: theme.colors.textPrimary, marginBottom: 6 }}>
        {t('partner.hub.title')}
      </Text>
      <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginBottom: 24 }}>
        {t('partner.hub.subtitle')}
      </Text>

      {CARDS.map(({ appType, Icon, emoji }) => {
        const isOwned = ownedType === appType;
        const locked = !!ownedType && !isOwned;
        const accent = accentFor(appType);
        const accentSoft = accentSoftFor(appType);
        const meta = isOwned && application ? statusMeta(application.status as StatusKey) : null;

        return (
          <TouchableOpacity
            key={appType}
            activeOpacity={locked ? 1 : 0.85}
            disabled={locked}
            onPress={() => navigation.navigate('PartnerApplication', { appType })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: isOwned ? accent : theme.colors.borderDefault,
              padding: 16,
              marginBottom: 14,
              opacity: locked ? 0.55 : 1,
            }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: locked ? theme.colors.surfaceAlt : accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              {locked ? (
                <Lock size={22} color={theme.colors.textTertiary} strokeWidth={1.8} />
              ) : (
                <Icon size={24} color={accent} strokeWidth={1.8} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
                {emoji}  {t(`partner.hub.card.${appType}.title`)}
              </Text>
              <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 }}>
                {locked ? t('partner.hub.lockedHint') : t(`partner.hub.card.${appType}.sub`)}
              </Text>
            </View>

            {meta ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: meta.bg }}>
                <Text style={{ ...theme.typography.caption, color: meta.fg, fontWeight: '700' }}>{t(meta.key)}</Text>
              </View>
            ) : locked ? (
              <Lock size={16} color={theme.colors.textTertiary} strokeWidth={2} />
            ) : (
              <ChevronRight size={18} color={theme.colors.borderStrong} strokeWidth={2} />
            )}
          </TouchableOpacity>
        );
      })}

      {!!ownedType && (
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, padding: 14, marginTop: 4 }}>
          <AlertCircle size={16} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text style={{ flex: 1, ...theme.typography.caption, color: theme.colors.textSecondary }}>
            {t('partner.hub.exclusiveNote')}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

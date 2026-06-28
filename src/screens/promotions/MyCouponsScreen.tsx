// src/screens/promotions/MyCouponsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";

import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../../components/ui";
import {
  getWallet,
  collectCoupon,
  discountSummary,
  type WalletMineItem,
  type PromoCampaign,
} from "../../api/promotions.api";

// ─── Owned coupon card (Section A) ──────────────────────────────────────────────

function MyCouponCard({ item }: { item: WalletMineItem }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const { campaign, remaining } = item;

  const minSubtotal = campaign.conditions?.minSubtotal ?? 0;
  const showRemaining = !!campaign.usageLimit?.showRemaining && remaining != null;

  const daysLeft = campaign.validTo
    ? dayjs(campaign.validTo).startOf("day").diff(dayjs().startOf("day"), "day")
    : null;
  const expiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3;

  return (
    <View
      style={[
        cc.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderDefault,
          borderRadius: theme.radius.lg,
        },
        theme.getElevation(1),
      ]}
    >
      {/* Left ticket stub */}
      <View style={[cc.stub, { backgroundColor: theme.market.light }]}>
        {campaign.image ? (
          <Image source={{ uri: campaign.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Ionicons name="pricetag" size={24} color={theme.market.main} />
        )}
      </View>

      {/* Notch divider */}
      <View style={cc.notchCol}>
        <View style={[cc.notch, { backgroundColor: theme.colors.background }]} />
        <View style={[cc.dashedLine, { borderColor: theme.colors.borderDefault }]} />
        <View style={[cc.notch, { backgroundColor: theme.colors.background }]} />
      </View>

      {/* Body */}
      <View style={cc.body}>
        <View style={cc.titleRow}>
          <Text
            style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary, flex: 1 }}
            numberOfLines={2}
          >
            {campaign.title}
          </Text>
          {expiringSoon && (
            <View style={[cc.expBadge, { backgroundColor: theme.colors.errorSoft }]}>
              <Text style={{ ...theme.typography.caption, color: theme.colors.error, fontWeight: "700" }}>
                {t("promotions.expiringSoon", { count: Math.max(daysLeft as number, 0) })}
              </Text>
            </View>
          )}
        </View>

        <Text style={{ ...theme.typography.headingSm, color: theme.market.main, marginTop: theme.space[1] }}>
          {discountSummary(campaign.discount, t)}
        </Text>

        <View style={cc.metaRow}>
          {minSubtotal > 0 && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
              {t("promotions.minCart", { amount: formatCurrency(minSubtotal, region, language, 0) })}
            </Text>
          )}
          {campaign.validTo && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
              {t("promotions.expiry", { date: dayjs(campaign.validTo).format("DD MMM YYYY") })}
            </Text>
          )}
        </View>

        {showRemaining && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginTop: theme.space[1] }}>
            {t("promotions.remaining", { count: remaining as number })}
          </Text>
        )}

        {!!campaign.description && (
          <Text
            style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginTop: theme.space[1] }}
            numberOfLines={2}
          >
            {t("promotions.conditions")}: {campaign.description}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Collectible row (Section B) ────────────────────────────────────────────────

function CollectibleRow({
  campaign,
  collecting,
  onCollect,
}: {
  campaign: PromoCampaign;
  collecting: boolean;
  onCollect: () => void;
}) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const minSubtotal = campaign.conditions?.minSubtotal ?? 0;
  const limited = !!campaign.usageLimit?.showRemaining;

  return (
    <View
      style={[
        cr.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderDefault,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <View style={[cr.icon, { backgroundColor: theme.market.light }]}>
        <Ionicons name="ticket-outline" size={18} color={theme.market.main} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }} numberOfLines={1}>
          {campaign.title}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.market.main, marginTop: 1 }}>
          {discountSummary(campaign.discount, t)}
          {minSubtotal > 0
            ? ` · ${t("promotions.minCart", { amount: formatCurrency(minSubtotal, region, language, 0) })}`
            : ""}
        </Text>
        {limited && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary, marginTop: 1 }}>
            {t("promotions.limited")}
          </Text>
        )}
      </View>

      <Pressable
        onPress={onCollect}
        disabled={collecting}
        style={({ pressed }) => [
          cr.collectBtn,
          {
            backgroundColor: theme.market.main,
            borderRadius: theme.radius.sm,
            opacity: collecting ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {collecting ? (
          <ActivityIndicator size="small" color={theme.colors.textInverse} />
        ) : (
          <Text style={{ ...theme.typography.labelSm, color: theme.colors.textInverse, fontWeight: "700" }}>
            {t("promotions.collect")}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function MyCouponsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const region = useRegion((s) => s.region);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<WalletMineItem[]>([]);
  const [collectible, setCollectible] = useState<PromoCampaign[]>([]);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWallet("market", region);
      setMine(res.mine);
      setCollectible(res.collectible);
    } catch {
      setError(t("promotions.loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCollect = useCallback(
    async (campaignId: string) => {
      setCollectingId(campaignId);
      try {
        await collectCoupon(campaignId);
        await load();
      } catch {
        setError(t("promotions.collectError"));
      } finally {
        setCollectingId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={["#0D6E35", "#16A34A", "#22C55E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MarketHome"))}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color="white" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("promotions.title")}</Text>
        <Text style={styles.headerSub}>{t("promotions.subtitle")}</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.market.main} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: theme.space[4],
            paddingBottom: insets.bottom + theme.space[8],
          }}
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <Text style={{ color: theme.colors.error, ...theme.typography.bodySm, marginBottom: theme.space[3], textAlign: "center" }}>
              {error}
            </Text>
          )}

          {/* Section A — Kuponlarım */}
          <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary, marginBottom: theme.space[3] }}>
            {t("promotions.myCoupons")}
          </Text>
          {mine.length > 0 ? (
            mine.map((it) => <MyCouponCard key={it.userCouponId} item={it} />)
          ) : (
            <View style={{ paddingVertical: theme.space[6] }}>
              <EmptyState
                illustration="market"
                title={t("promotions.emptyMineTitle")}
                subtitle={t("promotions.emptyMineSub")}
              />
            </View>
          )}

          {/* Section B — Toplanabilir */}
          {collectible.length > 0 && (
            <>
              <Text
                style={{
                  ...theme.typography.headingSm,
                  color: theme.colors.textPrimary,
                  marginTop: theme.space[6],
                  marginBottom: theme.space[3],
                }}
              >
                {t("promotions.collectible")}
              </Text>
              <View style={{ gap: theme.space[2] }}>
                {collectible.map((c) => (
                  <CollectibleRow
                    key={c._id}
                    campaign={c}
                    collecting={collectingId === c._id}
                    onCollect={() => handleCollect(c._id)}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12, marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "500", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

const cc = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 12,
  },
  stub: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  notchCol: { width: 1, alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  notch: { width: 12, height: 12, borderRadius: 6, marginHorizontal: -6 },
  dashedLine: { flex: 1, borderLeftWidth: 1, borderStyle: "dashed" },
  body: { flex: 1, padding: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  expBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
});

const cr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  collectBtn: { paddingHorizontal: 16, paddingVertical: 8, minWidth: 56, alignItems: "center", justifyContent: "center" },
});

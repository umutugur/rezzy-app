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

import { useTheme, type Theme } from "../../contexts/ThemeContext";
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
  type PromoSurface,
} from "../../api/promotions.api";

// ─── Surface accent system ──────────────────────────────────────────────────────
// Her yüzeyin (market / restoran / taksi) kendi rengi ve simgesi olur; kuponun
// hangi servise ait olduğu tek bakışta anlaşılır.
type Accent = { main: string; light: string; icon: keyof typeof Ionicons.glyphMap };

function surfaceAccent(theme: Theme, surface?: PromoSurface): Accent {
  switch (surface) {
    case "taxi":
      return { main: theme.taxi.main, light: theme.taxi.light, icon: "car-sport" };
    case "restaurant":
      return { main: "#E11D48", light: theme.isDark ? "#3F0717" : "#FFE4E6", icon: "restaurant" };
    default:
      return { main: theme.market.main, light: theme.market.light, icon: "storefront" };
  }
}

// ─── Owned coupon card (Section A) ──────────────────────────────────────────────

function MyCouponCard({ item }: { item: WalletMineItem }) {
  const theme = useTheme();
  const { t, language } = useI18n();
  const region = useRegion((s) => s.region);
  const { campaign, remaining, status } = item;
  const accent = surfaceAccent(theme, campaign.surface);

  const minSubtotal = campaign.conditions?.minSubtotal ?? 0;
  const total = campaign.usageLimit?.total ?? null;
  const showRemaining = !!campaign.usageLimit?.showRemaining && remaining != null;
  const remainingPct =
    showRemaining && total ? Math.max(0.04, Math.min(1, (remaining as number) / total)) : 0;

  const daysLeft = campaign.validTo
    ? dayjs(campaign.validTo).startOf("day").diff(dayjs().startOf("day"), "day")
    : null;
  const expiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3;
  const inactive = status !== "active";

  return (
    <View
      style={[
        cc.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderDefault,
          borderRadius: theme.radius.xl,
          opacity: inactive ? 0.55 : 1,
        },
        theme.getElevation(2),
      ]}
    >
      {/* Left image panel */}
      <View style={cc.imageWrap}>
        {campaign.image ? (
          <Image source={{ uri: campaign.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={[accent.main, accent.light]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          >
            <View style={cc.glyphHolder}>
              <Ionicons name="pricetags" size={30} color="rgba(255,255,255,0.92)" />
            </View>
          </LinearGradient>
        )}
        {/* Surface badge (always visible, even over artwork) */}
        <View style={[cc.surfaceChip, { backgroundColor: accent.main }]}>
          <Ionicons name={accent.icon} size={13} color="#FFFFFF" />
        </View>
      </View>

      {/* Perforation */}
      <View style={cc.perfCol}>
        <View style={[cc.notch, cc.notchTop, { backgroundColor: theme.colors.background }]} />
        <View style={[cc.dash, { borderColor: accent.main }]} />
        <View style={[cc.notch, cc.notchBottom, { backgroundColor: theme.colors.background }]} />
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
          {expiringSoon && !inactive && (
            <View style={[cc.pill, { backgroundColor: theme.colors.errorSoft }]}>
              <Ionicons name="time" size={11} color={theme.colors.error} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.error, fontFamily: theme.fontFamily.bold }}>
                {t("promotions.expiringSoon", { count: Math.max(daysLeft as number, 0) })}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={{
            ...theme.typography.headingMd,
            fontFamily: theme.fontFamily.extraBold,
            color: accent.main,
            marginTop: theme.space[1],
          }}
          numberOfLines={1}
        >
          {discountSummary(campaign.discount, t)}
        </Text>

        <View style={cc.metaRow}>
          {minSubtotal > 0 && (
            <View style={[cc.metaChip, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name="basket-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary }}>
                {formatCurrency(minSubtotal, region, language, 0)}
              </Text>
            </View>
          )}
          {campaign.validTo && (
            <View
              style={[
                cc.metaChip,
                { backgroundColor: expiringSoon ? theme.colors.errorSoft : theme.colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={12}
                color={expiringSoon ? theme.colors.error : theme.colors.textSecondary}
              />
              <Text
                style={{
                  ...theme.typography.caption,
                  color: expiringSoon ? theme.colors.error : theme.colors.textSecondary,
                }}
              >
                {dayjs(campaign.validTo).format("DD MMM")}
              </Text>
            </View>
          )}
        </View>

        {showRemaining && (
          <View style={cc.remainRow}>
            <View style={[cc.track, { backgroundColor: theme.colors.surfaceAlt }]}>
              <View style={[cc.trackFill, { backgroundColor: accent.main, width: `${remainingPct * 100}%` }]} />
            </View>
            <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}>
              {t("promotions.remaining", { count: remaining as number })}
            </Text>
          </View>
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
  const accent = surfaceAccent(theme, campaign.surface);
  const minSubtotal = campaign.conditions?.minSubtotal ?? 0;
  const limited = !!campaign.usageLimit?.showRemaining;

  return (
    <View
      style={[
        cr.row,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderDefault,
          borderRadius: theme.radius.lg,
        },
        theme.getElevation(1),
      ]}
    >
      {/* surface rail */}
      <View style={[cr.rail, { backgroundColor: accent.main }]} />

      <View style={[cr.thumb, { backgroundColor: accent.light }]}>
        {campaign.image ? (
          <Image source={{ uri: campaign.image }} style={cr.thumbImg} resizeMode="cover" />
        ) : (
          <Ionicons name={accent.icon} size={20} color={accent.main} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }} numberOfLines={1}>
          {campaign.title}
        </Text>
        <Text
          style={{ ...theme.typography.caption, color: accent.main, fontFamily: theme.fontFamily.bold, marginTop: 1 }}
          numberOfLines={1}
        >
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
            backgroundColor: accent.main,
            borderRadius: theme.radius.full,
            opacity: collecting ? 0.6 : pressed ? 0.85 : 1,
          },
        ]}
      >
        {collecting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="add" size={15} color="#FFFFFF" />
            <Text style={{ ...theme.typography.labelSm, color: "#FFFFFF", fontFamily: theme.fontFamily.bold }}>
              {t("promotions.collect")}
            </Text>
          </>
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
      const res = await getWallet(undefined, region); // tüm yüzeyler (market + restoran + taksi)
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

  const activeCount = mine.filter((m) => m.status === "active").length;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={["#0B5B2E", "#15803D", "#22C55E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* decorative ticket motif */}
        <View style={styles.decoCircleA} pointerEvents="none" />
        <View style={styles.decoCircleB} pointerEvents="none" />

        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("MarketHome"))}
            hitSlop={10}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color="white" />
          </Pressable>
          {activeCount > 0 && (
            <View style={styles.countPill}>
              <Ionicons name="ticket" size={14} color="white" />
              <Text style={styles.countText}>{activeCount}</Text>
            </View>
          )}
        </View>

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
            <Text
              style={{
                color: theme.colors.error,
                ...theme.typography.bodySm,
                marginBottom: theme.space[3],
                textAlign: "center",
              }}
            >
              {error}
            </Text>
          )}

          {/* Section A — Kuponlarım */}
          <View style={styles.sectionHead}>
            <View style={[styles.sectionDot, { backgroundColor: theme.market.main }]} />
            <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
              {t("promotions.myCoupons")}
            </Text>
          </View>
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
              <View style={[styles.sectionHead, { marginTop: theme.space[6] }]}>
                <View style={[styles.sectionDot, { backgroundColor: theme.taxi.main }]} />
                <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
                  {t("promotions.collectible")}
                </Text>
              </View>
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: "hidden",
  },
  decoCircleA: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  decoCircleB: {
    position: "absolute",
    bottom: -50,
    right: 60,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  countText: { color: "white", fontSize: 13, fontWeight: "800" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "white", letterSpacing: -0.5 },
  headerSub: { fontSize: 12.5, color: "rgba(255,255,255,0.88)", fontWeight: "500", marginTop: 3 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
});

// Owned coupon ticket
const TICKET_H = 118;
const cc = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: 14,
    minHeight: TICKET_H,
  },
  imageWrap: { width: 104, height: TICKET_H, overflow: "hidden" },
  glyphHolder: { flex: 1, alignItems: "center", justifyContent: "center" },
  surfaceChip: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  perfCol: { width: 14, alignItems: "center", justifyContent: "center" },
  notch: { position: "absolute", width: 14, height: 14, borderRadius: 7 },
  notchTop: { top: -7 },
  notchBottom: { bottom: -7 },
  dash: {
    height: "78%",
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    opacity: 0.45,
  },
  body: { flex: 1, paddingVertical: 12, paddingRight: 14, paddingLeft: 4, justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  remainRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 2 },
});

// Collectible row
const cr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  rail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  thumb: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  collectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 64,
    justifyContent: "center",
  },
});

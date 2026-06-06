// src/screens/market/MarketOrderDetailScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n";
import { useRegion } from "../../store/useRegion";
import { formatCurrency, langToLocale } from "../../utils/format";
import { Badge, EmptyState, PriceTag } from "../../components/ui";
import {
  cancelOrder,
  getOrderDetail,
  type MarketOrder,
  type MarketOrderStatus,
} from "../../api/market.api";
import type { MarketStackParams } from "../../navigation/marketRoutes";
import { MarketRoutes } from "../../navigation/marketRoutes";

type RouteT = RouteProp<MarketStackParams, typeof MarketRoutes.OrderDetail>;

// ─── Status config ─────────────────────────────────────────────────────────────

type StatusConfig = {
  label: string;
  variant: "neutral" | "warning" | "info" | "market" | "success" | "error";
  icon: string;
  description: string;
};

const STATUS_CONFIG: Record<MarketOrderStatus, StatusConfig> = {
  pending: {
    label: "Beklemede",
    variant: "warning",
    icon: "time-outline",
    description: "Siparişiniz onay bekleniyor.",
  },
  confirmed: {
    label: "Onaylandı",
    variant: "info",
    icon: "checkmark-circle-outline",
    description: "Siparişiniz onaylandı, hazırlanıyor.",
  },
  preparing: {
    label: "Hazırlanıyor",
    variant: "info",
    icon: "construct-outline",
    description: "Ürünleriniz hazırlanıyor.",
  },
  ready: {
    label: "Hazır",
    variant: "market",
    icon: "bag-check-outline",
    description: "Siparişiniz teslim/teslim almaya hazır.",
  },
  delivered: {
    label: "Teslim Edildi",
    variant: "success",
    icon: "checkmark-done-circle-outline",
    description: "Siparişiniz teslim edildi.",
  },
  cancelled: {
    label: "İptal Edildi",
    variant: "error",
    icon: "close-circle-outline",
    description: "Siparişiniz iptal edildi.",
  },
};

// ─── Status progress bar ───────────────────────────────────────────────────────

const STATUS_STEPS: MarketOrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
];

function StatusStepper({ status }: { status: MarketOrderStatus }) {
  const theme = useTheme();
  if (status === "cancelled") return null;

  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: theme.space[4], marginTop: theme.space[4] }}>
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const isLast = idx === STATUS_STEPS.length - 1;
        const cfg = STATUS_CONFIG[step];

        return (
          <React.Fragment key={step}>
            <View style={{ alignItems: "center" }}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: done ? theme.market.main : theme.colors.surfaceAlt,
                    borderColor: done ? theme.market.main : theme.colors.borderDefault,
                    borderWidth: 2,
                  },
                ]}
              >
                {done && (
                  <Ionicons name="checkmark" size={10} color={theme.colors.textInverse} />
                )}
              </View>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: idx < currentIdx ? theme.market.main : theme.colors.borderDefault,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderDefault,
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[4],
          gap: theme.space[3],
        },
      ]}
    >
      <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// ─── Ekran ─────────────────────────────────────────────────────────────────────

export default function MarketOrderDetailScreen() {
  const theme = useTheme();
  const { language } = useI18n();
  const region = useRegion((s) => s.region);
  const intlLocale = langToLocale(language);
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteT>();
  const { orderId } = route.params;

  const [order, setOrder] = useState<MarketOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const data = await getOrderDetail(orderId);
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  // useCallback MUST be before conditional returns — hooks rules
  const handleCancel = useCallback(() => {
    setCancelError(null);
    setShowCancelModal(true);
  }, []);

  const confirmCancel = useCallback(async () => {
    setShowCancelModal(false);
    setCancelling(true);
    try {
      const updated = await cancelOrder(orderId);
      setOrder(updated);
    } catch {
      setCancelError('Sipariş iptal edilemedi. Lütfen tekrar deneyin.');
    } finally {
      setCancelling(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.market.main} size="large" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          illustration="market"
          title="Sipariş bulunamadı"
          subtitle="Bu sipariş artık mevcut değil veya bir hata oluştu."
        />
      </View>
    );
  }

  const cfg = STATUS_CONFIG[order.status];
  const storeName =
    typeof order.store === "object" ? order.store.name : "Market";
  const createdDate = new Date(order.createdAt).toLocaleDateString(intlLocale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.space[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero */}
        <View
          style={[
            styles.heroSection,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.borderDefault,
              paddingTop: theme.space[5],
              paddingBottom: theme.space[4],
            },
          ]}
        >
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor: theme.market.light,
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Ionicons name={cfg.icon as any} size={32} color={theme.market.main} />
          </View>

          <Badge
            variant={cfg.variant}
            size="md"
            label={cfg.label}
            style={{ marginTop: theme.space[3] }}
          />

          <Text
            style={{
              ...theme.typography.bodyMd,
              color: theme.colors.textSecondary,
              marginTop: theme.space[2],
              textAlign: "center",
              paddingHorizontal: theme.space[6],
            }}
          >
            {cfg.description}
          </Text>

          {/* Progress stepper */}
          <StatusStepper status={order.status} />
        </View>

        {/* Sipariş bilgisi */}
        <Section title="Sipariş Bilgisi">
          <View style={styles.infoRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Sipariş No
            </Text>
            <Text
              style={{
                ...theme.typography.labelMd,
                color: theme.colors.textPrimary,
                fontVariant: ["tabular-nums"],
              }}
            >
              #{order._id.slice(-8).toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Market
            </Text>
            <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>
              {storeName}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Tarih
            </Text>
            <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>
              {createdDate}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Teslimat tipi
            </Text>
            <Badge
              variant="neutral"
              size="sm"
              label={order.type === "pickup" ? "Gel-Al" : "Eve Teslimat"}
            />
          </View>
          {order.type === "delivery" && order.deliveryAddress && (
            <View style={styles.infoRow}>
              <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
                Adres
              </Text>
              <Text
                style={{
                  ...theme.typography.labelMd,
                  color: theme.colors.textPrimary,
                  flex: 1,
                  textAlign: "right",
                }}
                numberOfLines={2}
              >
                {order.deliveryAddress?.fullAddress ?? "-"}
              </Text>
            </View>
          )}
        </Section>

        {/* Ürün listesi */}
        <Section title={`Ürünler (${order.items.length})`}>
          {order.items.map((item, idx) => (
            <View
              key={`${item.productId}_${idx}`}
              style={[
                styles.itemRow,
                {
                  paddingBottom: idx < order.items.length - 1 ? theme.space[3] : 0,
                  borderBottomWidth: idx < order.items.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: theme.colors.borderDefault,
                },
              ]}
            >
              <View
                style={[
                  styles.itemDot,
                  { backgroundColor: theme.market.light, borderRadius: theme.radius.sm },
                ]}
              >
                <Text style={{ ...theme.typography.labelSm, color: theme.market.main }}>
                  {item.qty}x
                </Text>
              </View>
              <Text
                style={{
                  ...theme.typography.bodyMd,
                  color: theme.colors.textPrimary,
                  flex: 1,
                  marginLeft: theme.space[2],
                }}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <PriceTag amount={item.lineTotal} size="sm" />
            </View>
          ))}
        </Section>

        {/* Ödeme özeti */}
        <Section title="Ödeme Özeti">
          <View style={styles.infoRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Ara toplam
            </Text>
            <PriceTag amount={order.subtotal} size="sm" />
          </View>

          {order.deliveryFee > 0 && (
            <View style={styles.infoRow}>
              <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
                Teslimat ücreti
              </Text>
              <PriceTag amount={order.deliveryFee} size="sm" />
            </View>
          )}

          {order.discount > 0 && (
            <View style={styles.infoRow}>
              <Text style={{ ...theme.typography.bodyMd, color: theme.colors.success }}>
                İndirim
              </Text>
              <Text style={{ ...theme.typography.labelMd, color: theme.colors.success }}>
                -{formatCurrency(order.discount, region, language)}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.infoRow,
              {
                marginTop: theme.space[1],
                paddingTop: theme.space[2],
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.borderDefault,
              },
            ]}
          >
            <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
              Toplam
            </Text>
            <PriceTag amount={order.total} size="md" color={theme.market.main} />
          </View>
        </Section>

        {/* İptal butonu — sadece iptal edilebilir durumlarda */}
        {(order.status === 'pending' || order.status === 'confirmed') && (
          <View style={{ paddingHorizontal: theme.space[4], marginTop: theme.space[4] }}>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelling}
              style={{
                backgroundColor: theme.semantic.error.light,
                borderRadius: theme.radius.xl,
                paddingVertical: theme.space[4],
                alignItems: 'center',
                opacity: cancelling ? 0.6 : 1,
              }}
            >
              <Text style={{ ...theme.typography.labelLg, color: theme.semantic.error.main }}>
                {cancelling ? 'İptal ediliyor…' : 'Siparişi İptal Et'}
              </Text>
            </TouchableOpacity>
            {cancelError && (
              <Text style={{ color: theme.semantic.error.main, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                {cancelError}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* İptal onay modalı */}
      <Modal
        transparent
        visible={showCancelModal}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowCancelModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.xl,
              padding: theme.space[6],
              margin: theme.space[5],
              width: '85%',
            }}
            onPress={() => {}}
          >
            <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, marginBottom: theme.space[2] }}>
              Siparişi İptal Et
            </Text>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginBottom: theme.space[5] }}>
              Bu siparişi iptal etmek istediğinizden emin misiniz?
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
              <TouchableOpacity
                onPress={() => setShowCancelModal(false)}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderDefault, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancel}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, backgroundColor: theme.semantic.error.main, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: '#fff' }}>İptal Et</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroSection: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemDot: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

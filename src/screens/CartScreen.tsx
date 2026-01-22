// src/screens/CartScreen.tsx
import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "../components/Themed";
import { useI18n } from "../i18n";

import { useCart } from "../store/useCart";
import { getDeliveryRestaurant } from "../api/delivery";
import type { DeliveryRestaurant } from "../delivery/deliveryTypes";
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
import {
  formatMoney,
  currencySymbolFromRegion,
  pickDeliveryMeta,
} from "../delivery/deliveryUtils";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";

type CartLine = {
  lineId: string;
  itemId: string;
  title: string;
  price: number; // base price (fallback)
  unitPrice?: number; // line price incl. modifiers
  qty: number;
  photoUrl?: string | null;
  note?: string | null;
  modifierSelections?: { groupId: string; optionIds: string[] }[];
};

export default function CartScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const preview: DeliveryRestaurant | null = route?.params?.restaurantPreview ?? null;
  const { t } = useI18n();

  const restaurantId = useCart((s) => s.restaurantId);
  const items: CartLine[] = useCart((s: any) => s.items || []);
  const addItem = useCart((s) => s.addItem);
  const removeOne = useCart((s) => s.decItem);
  const clear = useCart((s: any) => s.clear || s.reset);
  const subtotal = useCart((s) => (typeof s.subtotal === "function" ? s.subtotal() : 0));
  const count = useCart((s) => (typeof s.count === "function" ? s.count() : 0));
  const cartCurrency = useCart((s) => s.currencySymbol);

  const [loading, setLoading] = React.useState(true);
  const [r, setR] = React.useState<DeliveryRestaurant | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      if (!restaurantId) {
        setLoading(false);
        setR(null);
        return;
      }
      try {
        setLoading(true);
        const rr = await getDeliveryRestaurant(String(restaurantId));
        if (alive) setR(rr);
      } catch {
        if (alive) setR(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const symbol = React.useMemo(() => {
    if (cartCurrency) return cartCurrency;
    return currencySymbolFromRegion(r?.region);
  }, [cartCurrency, r?.region]);

  // meta kaynağı: preview varsa preview, yoksa fetch edilen r
  const metaSrc = preview ?? r;
  const meta = React.useMemo(() => (metaSrc ? pickDeliveryMeta(metaSrc) : null), [metaSrc]);

  const deliveryFee = Number(meta?.deliveryFee || 0);
  const minOrder = typeof meta?.minOrder === "number" ? meta?.minOrder : null;

  const total = subtotal + deliveryFee;
  const canCheckout = count > 0 && (minOrder == null ? true : subtotal >= minOrder);

  const onCheckout = () => {
    if (!restaurantId) return;
    if (!count) return;

    if (minOrder != null && subtotal < minOrder) {
      Alert.alert(
        t("delivery.minOrderTitle", { defaultValue: "Minimum sepet tutarı" }),
        t("delivery.minOrderBody", {
          defaultValue: `Minimum sepet: ${formatMoney(minOrder, symbol)}. Sepetinizi tamamlayın.`,
        })
      );
      return;
    }

    nav.navigate(DeliveryRoutes.Checkout, {
      restaurantId: String(restaurantId),
      restaurantPreview: metaSrc,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text secondary style={styles.centerHint}>
          {t("delivery.loadingCart", { defaultValue: "Sepet yükleniyor…" })}
        </Text>
      </View>
    );
  }

  if (!restaurantId || count === 0) {
    return (
      <View style={[styles.center, { padding: 24, gap: 10 }]}>
        <Ionicons name="cart-outline" size={44} color={DeliveryColors.muted} />
        <Text style={styles.emptyTitle}>
          {t("delivery.cartEmpty", { defaultValue: "Sepetiniz boş" })}
        </Text>
        <Text secondary style={{ textAlign: "center" }}>
          {t("delivery.cartEmptyHint", { defaultValue: "Ürün eklemek için restorana dönün." })}
        </Text>

        <Pressable onPress={() => nav.goBack()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {t("common.back", { defaultValue: "Geri" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={DeliveryColors.text} />
        </Pressable>

        <View style={{ alignItems: "center", flex: 1 }}>
          <Text style={styles.headerTitle}>
            {t("delivery.cartTitle", { defaultValue: "Sepet" })}
          </Text>
          <Text secondary style={styles.headerSub}>
            {t("delivery.itemsCount", { defaultValue: "Ürün" })}:{" "}
            <Text style={{ fontWeight: "900", color: DeliveryColors.text }}>{count}</Text>
          </Text>
        </View>

        <Pressable
          onPress={() => {
            Alert.alert(
              t("delivery.clearCartTitle", { defaultValue: "Sepet temizlensin mi?" }),
              t("delivery.clearCartBody", { defaultValue: "Sepetteki tüm ürünler silinecek." }),
              [
                { text: t("common.cancel", { defaultValue: "Vazgeç" }), style: "cancel" },
                {
                  text: t("common.delete", { defaultValue: "Sil" }),
                  style: "destructive",
                  onPress: () => clear?.(),
                },
              ]
            );
          }}
          style={styles.pillBtn}
        >
          <Ionicons name="trash-outline" size={16} color={DeliveryColors.primary} />
          <Text style={styles.pillBtnText}>
            {t("delivery.clear", { defaultValue: "Temizle" })}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: DeliverySpacing.screenX,
          paddingBottom: 16 + (Platform.OS === "ios" ? 10 : 0) + 90,
        }}
      >
        {/* Restaurant info */}
        <Card>
          <Text style={styles.h2}>
            {r?.name || t("delivery.restaurant", { defaultValue: "Restoran" })}
          </Text>

          {!!r?.address && (
            <View style={styles.rowTop}>
              <Ionicons name="location-outline" size={16} color={DeliveryColors.muted} />
              <Text secondary style={styles.addressText}>
                {r.address}
              </Text>
            </View>
          )}

          <View style={styles.chipsRow}>
            <MetaChip icon="time-outline" text={meta?.etaText || "—"} />
            <MetaChip
              icon="cash-outline"
              text={
                minOrder != null
                  ? `${t("delivery.minBasket", { defaultValue: "Min" })} ${formatMoney(minOrder, symbol)}`
                  : `${t("delivery.minBasket", { defaultValue: "Min" })} —`
              }
            />
            <MetaChip icon="navigate-outline" text={meta?.distanceText || "—"} />
          </View>
        </Card>

        {/* Lines */}
        <View style={{ marginTop: 12, gap: 10 }}>
          {items.map((ln: any) => {
            const key = String(ln?.lineId || ln?.itemId || "");
            const unit = Number(ln?.unitPrice ?? ln?.price ?? 0);

            return (
              <View key={key} style={[styles.lineCard, DeliveryShadow.card]}>
                {/* Left: photo */}
                {ln.photoUrl ? (
                  <Image
                    source={{ uri: String(ln.photoUrl) }}
                    style={styles.linePhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.linePhotoFallback}>
                    <Ionicons name="fast-food-outline" size={22} color={DeliveryColors.primary} />
                  </View>
                )}

                {/* Center: title + price */}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.lineTitle} numberOfLines={2}>
                    {ln.title}
                  </Text>

                  {!!ln.note && (
                    <Text secondary style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                      {String(ln.note)}
                    </Text>
                  )}

                  <View style={styles.lineRow}>
                    <Text style={styles.linePrice}>{formatMoney(unit, symbol)}</Text>

                    <View style={styles.qtyRow}>
                      <Pressable
                        onPress={() => removeOne?.(String(ln?.lineId || ln?.itemId))}
                        style={styles.qtyBtn}
                      >
                        <Ionicons name="remove" size={18} color={DeliveryColors.text} />
                      </Pressable>

                      <View style={styles.qtyPill}>
                        <Text style={styles.qtyText}>{ln.qty}</Text>
                      </View>

                      <Pressable
                        onPress={() =>
                          addItem?.(
                            {
                              lineId: String(ln?.lineId || ""),
                              itemId: String(ln.itemId),
                              title: ln.title,
                              price: Number(ln?.price ?? 0),
                              unitPrice: unit,
                              photoUrl: ln.photoUrl,
                              note: ln?.note ?? null,
                              modifierSelections: ln?.modifierSelections ?? [],
                            } as any
                          )
                        }
                        style={[styles.qtyBtn, styles.qtyBtnPrimary]}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  </View>

                  <Text secondary style={styles.lineTotal}>
                    {t("delivery.lineTotal", { defaultValue: "Tutar" })}:{" "}
                    <Text style={{ fontWeight: "900", color: DeliveryColors.text }}>
                      {formatMoney(unit * Number(ln.qty || 0), symbol)}
                    </Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Summary */}
        <Card style={{ marginTop: 14 }}>
          <Row
            label={t("delivery.subtotal", { defaultValue: "Ara Toplam" })}
            value={formatMoney(subtotal, symbol)}
          />
          <Row
            label={t("delivery.deliveryFee", { defaultValue: "Teslimat" })}
            value={formatMoney(deliveryFee, symbol)}
          />
          <Divider />
          <Row
            label={t("delivery.total", { defaultValue: "Toplam" })}
            value={formatMoney(total, symbol)}
            strong
          />

          {minOrder != null && subtotal < minOrder && (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={18} color={DeliveryColors.primary} />
              <Text style={styles.warnText}>
                {t("delivery.minOrderWarn", {
                  defaultValue: "Minimum sepet tutarına ulaşmadan sipariş veremezsiniz.",
                })}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Bottom CTA */}
      <Pressable
        onPress={onCheckout}
        disabled={!canCheckout}
        style={[
          styles.bottomCta,
          DeliveryShadow.floating,
          !canCheckout ? { opacity: 0.55 } : null,
        ]}
      >
        <View style={styles.bottomLeft}>
          <View style={styles.countBubble}>
            <Text style={styles.countBubbleText}>{count}</Text>
          </View>
          <View>
            <Text style={styles.bottomTitle}>
              {t("delivery.goPayment", { defaultValue: "Ödemeye Geç" })}
            </Text>
            <Text style={styles.bottomValue}>{formatMoney(total, symbol)}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

function Card(props: { children: any; style?: any }) {
  return (
    <View style={[styles.card, DeliveryShadow.card, props.style]}>
      {props.children}
    </View>
  );
}

function MetaChip(props: { icon: any; text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={props.icon} size={14} color={DeliveryColors.primary} />
      <Text style={styles.chipText}>{props.text}</Text>
    </View>
  );
}

function Row(props: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text
        secondary
        style={{
          fontSize: 13,
          fontWeight: props.strong ? "900" : "700",
          color: props.strong ? DeliveryColors.text : DeliveryColors.muted,
        }}
      >
        {props.label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "900", color: DeliveryColors.text }}>
        {props.value}
      </Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DeliveryColors.bg },

  center: {
    flex: 1,
    backgroundColor: DeliveryColors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  centerHint: { marginTop: 8 },

  emptyTitle: { fontWeight: "900", color: DeliveryColors.text, fontSize: 16 },

  header: {
    paddingHorizontal: DeliverySpacing.screenX,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: { fontWeight: "900", color: DeliveryColors.text, fontSize: 16 },
  headerSub: { marginTop: 2, fontSize: 12, color: DeliveryColors.muted, fontWeight: "800" },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    alignItems: "center",
    justifyContent: "center",
  },

  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },
  pillBtnText: { fontWeight: "900", color: DeliveryColors.primary, fontSize: 12 },

  card: {
    backgroundColor: DeliveryColors.card,
    borderRadius: DeliveryRadii.xl,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    padding: 14,
    gap: 10,
  },

  h2: { fontWeight: "900", color: DeliveryColors.text, fontSize: 15 },

  rowTop: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  addressText: { flex: 1, fontSize: 12, lineHeight: 18 },

  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DeliveryColors.chip,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },
  chipText: { fontSize: 12, fontWeight: "900", color: DeliveryColors.chipText },

  lineCard: {
    backgroundColor: "#fff",
    borderRadius: DeliveryRadii.xl,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  linePhoto: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#E5E7EB" },
  linePhotoFallback: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    alignItems: "center",
    justifyContent: "center",
  },

  lineTitle: { fontWeight: "900", color: DeliveryColors.text },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  linePrice: { fontWeight: "900", color: DeliveryColors.primary },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },
  qtyBtnPrimary: { backgroundColor: DeliveryColors.primary, borderColor: DeliveryColors.primary },
  qtyPill: {
    minWidth: 34,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  qtyText: { fontWeight: "900", color: DeliveryColors.text },

  lineTotal: { fontSize: 12 },

  sumRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  divider: { height: 1, backgroundColor: DeliveryColors.line, opacity: 0.7 },

  warnBox: {
    marginTop: 6,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  warnText: { fontSize: 12, fontWeight: "900", color: DeliveryColors.text },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: DeliveryColors.primary,
    borderRadius: DeliveryRadii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  bottomCta: {
    position: "absolute",
    left: DeliverySpacing.screenX,
    right: DeliverySpacing.screenX,
    bottom: 14,
    backgroundColor: DeliveryColors.primary,
    borderRadius: DeliveryRadii.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  countBubble: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  countBubbleText: { color: "#fff", fontWeight: "900" },
  bottomTitle: { color: "#fff", fontWeight: "900" },
  bottomValue: { color: "rgba(255,255,255,0.9)", fontWeight: "900", marginTop: 2 },
});
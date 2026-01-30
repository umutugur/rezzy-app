import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  StyleSheet,
  Modal,
  LayoutChangeEvent,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useStripe } from "@stripe/stripe-react-native";
import * as Linking from "expo-linking";

import { Text } from "../components/Themed";
import { useI18n } from "../i18n";

import { useAuth } from "../store/useAuth";
import { useCart } from "../store/useCart";
import { getDeliveryRestaurant, createDeliveryOrder } from "../api/delivery";
import type { DeliveryRestaurant } from "../delivery/deliveryTypes";

import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
import { formatMoney, currencySymbolFromRegion, pickDeliveryMeta } from "../delivery/deliveryUtils";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";
import { useDeliveryAddress } from "../store/useDeliveryAddress";

type PaymentMethod = "cash" | "card" | "card_on_delivery";

export default function PaymentScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useI18n();

  const selectedAddress = useDeliveryAddress((s) => s.selectedAddress);
  const selectedAddressId = useDeliveryAddress((s) => s.selectedAddressId);

  // i18n guard: some keys may be objects (namespaces). React cannot render objects.
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  const safeT = React.useCallback(
    (key: string, opts?: any) => {
      try {
        const v = tRef.current?.(key, opts);
        if (typeof v === "string") return v;
        if (typeof v === "number") return String(v);
        return (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : key) as string;
      } catch {
        return (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : key) as string;
      }
    },
    []
  );

  const restaurantIdParam: string = String(route?.params?.restaurantId || "");

  const token = useAuth((s: any) => s.token);
  const user = useAuth((s: any) => s.user);

  const addressId: string = String(
    route?.params?.addressId ||
      selectedAddressId ||
      user?.activeAddressId ||
      user?.defaultAddressId ||
      user?.addressId ||
      ""
  );

  const hexId: string | undefined = route?.params?.hexId ? String(route.params.hexId) : undefined;

  const cartRestaurantId = useCart((s) => s.restaurantId);
  const items = useCart((s: any) => s.items || []);
  const subtotal = useCart((s) => (typeof s.subtotal === "function" ? s.subtotal() : 0));
  const count = useCart((s) => (typeof s.count === "function" ? s.count() : 0));
  const clear = useCart((s: any) => s.clear || s.reset);
  const cartCurrency = useCart((s) => s.currencySymbol);

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [r, setR] = React.useState<DeliveryRestaurant | null>(null);

  const [method, setMethod] = React.useState<PaymentMethod>("card");
  const [doorOpen, setDoorOpen] = React.useState(false);
  const [doorAnchor, setDoorAnchor] = React.useState<{ x: number; width: number } | null>(null);
  const [methodRowLayout, setMethodRowLayout] = React.useState<{ y: number; height: number } | null>(null);
  const [note, setNote] = React.useState("");
  const [stripeBusy, setStripeBusy] = React.useState(false);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [msgOpen, setMsgOpen] = React.useState(false);
  const [msgTitle, setMsgTitle] = React.useState("");
  const [msgBody, setMsgBody] = React.useState("");
  const [msgKind, setMsgKind] = React.useState<"info" | "warn" | "error">("info");
  const [msgAction, setMsgAction] = React.useState<null | { label: string; onPress: () => void }>(null);

  const showMsg = React.useCallback(
    (title: string, body?: string, kind: "info" | "warn" | "error" = "info", action?: { label: string; onPress: () => void }) => {
      setMsgTitle(title);
      setMsgBody(body || "");
      setMsgKind(kind);
      setMsgAction(action || null);
      setMsgOpen(true);
    },
    []
  );

  React.useEffect(() => {
    let alive = true;

    (async () => {
      const rid = restaurantIdParam || cartRestaurantId;
      if (!rid) {
        setLoading(false);
        setR(null);
        return;
      }

      try {
        setLoading(true);
        const rr = await getDeliveryRestaurant(String(rid));
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
  }, [restaurantIdParam, cartRestaurantId]);

  const symbol = React.useMemo(() => {
    if (cartCurrency) return cartCurrency;
    return currencySymbolFromRegion(r?.region);
  }, [cartCurrency, r?.region]);

const preview: DeliveryRestaurant | null = route?.params?.restaurantPreview ?? null;
const metaSrc = preview ?? r;
const meta = React.useMemo(() => (metaSrc ? pickDeliveryMeta(metaSrc) : null), [metaSrc]);
  const deliveryFee = Number(meta?.deliveryFee || 0);
  const minOrder = typeof meta?.minOrder === "number" ? meta?.minOrder : null;
  const total = subtotal + deliveryFee;

  function buildAddressText(a: any): string {
    if (!a) return "";
    const title = String(a.title || a.label || a.name || "").trim();
    const line = String(a.address || a.addressLine || a.fullAddress || "").trim();

    const district = String(a.district || a.town || a.neighborhood || "").trim();
    const street = String(a.street || a.streetName || "").trim();
    const buildingNo = String(a.buildingNo || a.building || a.no || "").trim();
    const doorNo = String(a.doorNo || a.door || a.apartment || "").trim();
    const city = String(a.city || a.province || a.state || "").trim();

    const parts: string[] = [];
    if (line) parts.push(line);
    else {
      const p: string[] = [];
      if (district) p.push(district);
      if (street) p.push(street);
      if (buildingNo) p.push(buildingNo);
      if (doorNo) p.push(doorNo);
      if (city) p.push(city);
      if (p.length) parts.push(p.join(", "));
    }

    let out = parts.join(" ");
    if (title) out = `${title}${out ? ": " : ""}${out}`;
    return out.trim();
  }

  const addressFromUserList =
    (Array.isArray((user as any)?.addresses) ? (user as any).addresses : []).find(
      (a: any) => String(a?._id || a?.id || "") === String(addressId)
    ) ||
    (Array.isArray((user as any)?.deliveryAddresses) ? (user as any).deliveryAddresses : []).find(
      (a: any) => String(a?._id || a?.id || "") === String(addressId)
    ) ||
    (Array.isArray((user as any)?.addressBook) ? (user as any).addressBook : []).find(
      (a: any) => String(a?._id || a?.id || "") === String(addressId)
    );

  const addressText =
    (route?.params?.addressText && String(route.params.addressText).trim()) ||
    buildAddressText(route?.params?.address) ||
    buildAddressText(selectedAddress) ||
    buildAddressText(addressFromUserList) ||
    (user?.address && String(user.address).trim()) ||
    (user?.deliveryAddress && String(user.deliveryAddress).trim()) ||
    "";

  const canSubmit =
    !!token &&
    !!r?._id &&
    count > 0 &&
    !!addressId &&
    (minOrder == null ? true : subtotal >= minOrder) &&
    !submitting &&
    !stripeBusy;

  const onSubmit = async () => {
    if (!token) {
      showMsg(
        safeT("delivery.loginRequiredTitle", { defaultValue: "Giriş gerekli" }),
        safeT("delivery.loginRequiredBody", { defaultValue: "Sipariş vermek için giriş yapmalısınız." }),
        "warn",
        {
          label: safeT("common.login", { defaultValue: "Giriş" }),
          onPress: () => nav.navigate("Giriş"),
        }
      );
      return;
    }

    if (!r?._id) return;

    if (!addressId) {
      showMsg(
        safeT("delivery.addressRequiredTitle", { defaultValue: "Adres gerekli" }),
        safeT("delivery.addressRequiredBody", {
          defaultValue: "Sipariş için teslimat adresi seçmeniz gerekiyor.",
        }),
        "warn"
      );
      return;
    }

    if (minOrder != null && subtotal < minOrder) {
      showMsg(
        safeT("delivery.minOrderTitle", { defaultValue: "Minimum sepet tutarı" }),
        safeT("delivery.minOrderBody", {
          defaultValue: `Minimum sepet: ${formatMoney(minOrder, symbol)}. Sepetinizi tamamlayın.`,
        }),
        "warn",
        { label: safeT("common.ok", { defaultValue: "Tamam" }), onPress: () => nav.goBack() }
      );
      return;
    }

    try {
      setSubmitting(true);

      const normalizedItems = (items || []).map((x: any) => {
        const raw = Array.isArray(x?.modifierSelections) ? x.modifierSelections : [];

        const modifierSelections = raw
          .map((s: any) => {
            const groupId = String(s?.groupId || "").trim();
            const optionIds = Array.isArray(s?.optionIds)
              ? s.optionIds
                  .map((id: any) => String(id || "").trim())
                  .filter(Boolean)
              : [];

            // drop invalid/empty selections
            if (!groupId || optionIds.length === 0) return null;

            // de-dupe + stable order
            const uniq = Array.from(new Set(optionIds)).sort();
            return { groupId, optionIds: uniq };
          })
          .filter((v: any) => v);

        const modifierMap = modifierSelections.reduce((acc: any, s: any) => {
  acc[String(s.groupId)] = Array.isArray(s.optionIds) ? s.optionIds : [];
  return acc;
}, {} as Record<string, string[]>);

return {
  itemId: String(x.itemId),
  qty: Math.max(1, Number(x.qty) || 1),
  note: String(x.note || "").trim() || undefined,
  lineId: x?.lineId ? String(x.lineId) : undefined,
  selectedModifiers: modifierSelections,

  // aynı veri, farklı olası backend şemaları için:
  modifierSelections,          // senin mevcut isim
  modifiers: modifierSelections, // çok yaygın beklenti
  modifierMap,                 // bazı backendler map ister: { [groupId]: optionIds[] }
};
      });

      const payload = {
        restaurantId: String(r._id),
        addressId: String(addressId),
        paymentMethod: method,
        hexId,

        // ✅ order-level note
        customerNote: note?.trim() || undefined,

        // ✅ line-item: modifiers + note
        // IMPORTANT: Cart artık aynı ürünü farklı opsiyonlarla birden fazla satır olarak tutabiliyor.
        // Backend min/max validation için modifierSelections'ı aynen göndermeliyiz.
        items: normalizedItems,
      };

     console.log(
  "[checkout] items->modifiers",
  normalizedItems.map((it: any) => ({
    itemId: it.itemId,
    lineId: it.lineId,
    selectedModifiers: it.selectedModifiers,
    modifierSelections: it.modifierSelections,
  }))
);

      const res: any = await createDeliveryOrder(payload as any);

      // ✅ ONLINE ödeme: Stripe PaymentSheet
      if (method === "card") {
        const clientSecret = res?.payment?.clientSecret;
        if (!clientSecret) {
          showMsg(
            safeT("delivery.paymentFailedTitle", { defaultValue: "Ödeme başlatılamadı" }),
            safeT("delivery.paymentFailedBody", { defaultValue: "Kart ödemesi başlatılamadı. Lütfen tekrar deneyin." }),
            "error"
          );
          return;
        }

        setStripeBusy(true);
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Rezvix",
          returnURL: Linking.createURL("stripe-redirect"),
          allowsDelayedPaymentMethods: false,
          style: "alwaysLight",
        });

        if (initError) {
          showMsg(
            safeT("delivery.paymentInitErrorTitle", { defaultValue: "Ödeme başlatılamadı" }),
            initError.message || safeT("delivery.paymentInitErrorBody", { defaultValue: "Ödeme ekranı açılamadı." }),
            "error"
          );
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== "Canceled") {
            showMsg(
              safeT("delivery.paymentFailedTitle", { defaultValue: "Ödeme başarısız" }),
              presentError.message || safeT("delivery.paymentFailedBody", { defaultValue: "Ödeme tamamlanamadı." }),
              "error"
            );
          }
          return;
        }

        showMsg(
          safeT("delivery.orderSuccessTitle", { defaultValue: "Ödeme alındı" }),
          safeT("delivery.orderSuccessBody", {
            defaultValue: "Ödemeniz alındı. Siparişiniz hazırlanıyor.",
          }),
          "info",
          {
            label: safeT("common.ok", { defaultValue: "Tamam" }),
            onPress: () => {
              clear?.();
              nav.popToTop?.();
            },
          }
        );
        return;
      }

      // ✅ KAPIDA: order yaratıldı -> sepet temizle
      showMsg(
        safeT("delivery.orderSuccessTitle", { defaultValue: "Sipariş alındı" }),
        safeT("delivery.orderSuccessBody", { defaultValue: "Siparişiniz başarıyla oluşturuldu." }),
        "info",
        {
          label: safeT("common.ok", { defaultValue: "Tamam" }),
          onPress: () => {
            clear?.();
            nav.popToTop?.();
          },
        }
      );
    } catch (e: any) {
      const apiCode = e?.response?.data?.code;
      const apiMsg = e?.response?.data?.message;
      const msg = (apiCode ? `[${String(apiCode)}] ` : "") + (apiMsg || e?.message || safeT("common.error"));
      showMsg(safeT("common.error"), msg, "error");
    } finally {
      setSubmitting(false);
      setStripeBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text secondary style={styles.centerHint}>
          {safeT("delivery.loadingPayment", { defaultValue: "Ödeme ekranı hazırlanıyor…" })}
        </Text>
      </View>
    );
  }

  if (!r || count === 0) {
    return (
      <View style={[styles.center, { padding: 24, gap: 10 }]}>
        <Ionicons name="alert-circle-outline" size={44} color={DeliveryColors.muted} />
        <Text style={styles.emptyTitle}>
          {safeT("delivery.paymentUnavailable", { defaultValue: "Ödeme ekranı açılamadı" })}
        </Text>
        <Text secondary style={{ textAlign: "center" }}>
          {safeT("delivery.paymentUnavailableHint", { defaultValue: "Sepet boş olabilir veya restoran bilgisi alınamadı." })}
        </Text>

        <Pressable onPress={() => nav.goBack()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {safeT("common.back", { defaultValue: "Geri" })}
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

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>
            {safeT("delivery.paymentTitle", { defaultValue: "Ödeme" })}
          </Text>
          <Text secondary style={styles.headerSub}>
            {safeT("delivery.summaryShort", { defaultValue: "Toplam" })}:{" "}
            <Text style={{ fontWeight: "900", color: DeliveryColors.text }}>
              {formatMoney(total, symbol)}
            </Text>
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: DeliverySpacing.screenX,
          paddingBottom: 16 + (Platform.OS === "ios" ? 10 : 0) + 92,
          gap: 12,
        }}
      >
        {/* Restaurant */}
        <Card>
          <View style={styles.cardTopRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.h2}>{r.name}</Text>
              <Text secondary style={styles.subline}>
                {safeT("delivery.itemsCount", { defaultValue: "Ürün" })}:{" "}
                <Text style={{ fontWeight: "900", color: DeliveryColors.text }}>{count}</Text>
              </Text>
            </View>

            <View style={styles.moneyPill}>
              <Ionicons name="cash-outline" size={14} color={DeliveryColors.primary} />
              <Text style={styles.moneyPillText}>{formatMoney(total, symbol)}</Text>
            </View>
          </View>

          <View style={styles.chipsRow}>
            <MetaChip icon="time-outline" text={meta?.etaText || "—"} />
            <MetaChip icon="navigate-outline" text={meta?.distanceText || "—"} />
          </View>
        </Card>

        {/* Address */}
        <Card>
          <View style={styles.cardHeadRow}>
            <Text style={styles.cardTitle}>
              {safeT("delivery.address", { defaultValue: "Adres" })}
            </Text>

            <Pressable
              onPress={() => {
                nav.navigate(DeliveryRoutes.AddressPicker, {
                  returnTo: DeliveryRoutes.Checkout,
                  currentAddressId: addressId,
                });
              }}
              style={styles.pillBtn}
            >
              <Ionicons name="create-outline" size={16} color={DeliveryColors.primary} />
              <Text style={styles.pillBtnText}>
                {safeT("delivery.edit", { defaultValue: "Düzenle" })}
              </Text>
            </Pressable>
          </View>

          <View style={styles.addrRow}>
            <View style={styles.addrIcon}>
              <Ionicons name="location-outline" size={16} color={DeliveryColors.primary} />
            </View>
            <Text secondary style={styles.addrText}>
              {addressText || safeT("delivery.addressMissing", { defaultValue: "Teslimat adresi seçilmedi. Lütfen bir adres seçin." })}
            </Text>
          </View>
        </Card>

        {/* Payment method */}
        <Card>
          <Text style={styles.cardTitle}>
            {safeT("delivery.paymentMethod", { defaultValue: "Ödeme Yöntemi" })}
          </Text>

          <View style={styles.methodSection}>
          <View
            style={styles.methodRow}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              setMethodRowLayout({ y: layout.y, height: layout.height });
            }}
          >
            <MethodPill
              active={method === "card"}
              icon="card-outline"
              label={safeT("delivery.payOnline", { defaultValue: "Online Ödeme" })}
              onPress={() => {
                setMethod("card");
                setDoorOpen(false);
              }}
            />
            <MethodPill
              active={method !== "card"}
              icon="home-outline"
              label={safeT("delivery.payAtDoor", { defaultValue: "Kapıda" })}
              onLayout={(e) => {
                const layout = e.nativeEvent.layout;
                setDoorAnchor({ x: layout.x, width: layout.width });
              }}
              onPress={() => {
                setDoorOpen((v) => !v);
                if (method === "card") setMethod("cash");
              }}
            />
          </View>

          {doorOpen && (
            <View
              style={[
                styles.doorOptions,
                styles.doorOptionsFloat,
                {
                  top: (methodRowLayout ? methodRowLayout.y + methodRowLayout.height : 0) + 8,
                  left: doorAnchor?.x ?? 0,
                  width: doorAnchor?.width ?? "100%",
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  setMethod("card_on_delivery");
                  setDoorOpen(true);
                }}
                style={[
                  styles.doorBtn,
                  method === "card_on_delivery" ? styles.doorBtnActive : styles.doorBtnInactive,
                ]}
              >
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={method === "card_on_delivery" ? "#fff" : DeliveryColors.primary}
                />
                <Text
                  style={[
                    styles.doorBtnText,
                    { color: method === "card_on_delivery" ? "#fff" : DeliveryColors.primary },
                  ]}
                >
                  {safeT("delivery.payDoorCard", { defaultValue: "Kapıda Kart" })}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMethod("cash");
                  setDoorOpen(true);
                }}
                style={[
                  styles.doorBtn,
                  method === "cash" ? styles.doorBtnActive : styles.doorBtnInactive,
                ]}
              >
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={method === "cash" ? "#fff" : DeliveryColors.primary}
                />
                <Text
                  style={[
                    styles.doorBtnText,
                    { color: method === "cash" ? "#fff" : DeliveryColors.primary },
                  ]}
                >
                  {safeT("delivery.payDoorCash", { defaultValue: "Kapıda Nakit" })}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Not */}
          <View style={{ gap: 6, marginTop: 6 }}>
            <Text secondary style={{ fontWeight: "800" }}>
              {safeT("delivery.note", { defaultValue: "Not (opsiyonel)" })}
            </Text>

            <View style={styles.noteBox}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={safeT("delivery.notePlaceholder", { defaultValue: "Örn: Zil çalışmıyor, arayın." })}
                placeholderTextColor={DeliveryColors.muted}
                style={styles.noteInput}
                multiline
              />
            </View>

            <Text secondary style={styles.noteHint}>
              {safeT("delivery.noteHint", { defaultValue: "Bu not siparişin tamamı için geçerlidir." })}
            </Text>
          </View>
          </View>
        </Card>

        {/* Summary */}
        <Card>
          <Row label={safeT("delivery.subtotal", { defaultValue: "Ara Toplam" })} value={formatMoney(subtotal, symbol)} />
          <Row label={safeT("delivery.deliveryFee", { defaultValue: "Teslimat" })} value={formatMoney(deliveryFee, symbol)} />
          <Divider />
          <Row strong label={safeT("delivery.total", { defaultValue: "Toplam" })} value={formatMoney(total, symbol)} />

          {minOrder != null && subtotal < minOrder && (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={18} color={DeliveryColors.primary} />
              <Text style={styles.warnText}>
                {safeT("delivery.minOrderWarn", { defaultValue: "Minimum sepet tutarına ulaşmadan sipariş veremezsiniz." })}
              </Text>
            </View>
          )}

          {!token && (
            <View style={[styles.warnBox, { backgroundColor: "#F3F4F6", borderColor: DeliveryColors.line }]}>
              <Ionicons name="log-in-outline" size={18} color={DeliveryColors.text} />
              <Text style={styles.warnText}>
                {safeT("delivery.loginToOrder", { defaultValue: "Sipariş vermek için giriş yapmalısınız." })}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Submit CTA */}
      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        style={[
          styles.bottomCta,
          DeliveryShadow.floating,
          !canSubmit ? { opacity: 0.55 } : null,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {submitting || stripeBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
          )}

          <View>
            <Text style={styles.bottomTitle}>
              {safeT("delivery.placeOrder", { defaultValue: "Siparişi Onayla" })}
            </Text>
            <Text style={styles.bottomValue}>{formatMoney(total, symbol)}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </Pressable>

      {/* Uyarı / Bilgi Modal */}
      <Modal visible={msgOpen} transparent animationType="fade" onRequestClose={() => setMsgOpen(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              msgKind === "error"
                ? { borderColor: "#FCA5A5" }
                : msgKind === "warn"
                ? { borderColor: "#FDE68A" }
                : { borderColor: DeliveryColors.line },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                msgKind === "error"
                  ? { color: "#B91C1C" }
                  : msgKind === "warn"
                  ? { color: "#92400E" }
                  : { color: DeliveryColors.text },
              ]}
            >
              {msgTitle || safeT("common.info", { defaultValue: "Bilgi" })}
            </Text>
            {!!msgBody && <Text secondary style={styles.modalBody}>{msgBody}</Text>}

            <View style={styles.modalActions}>
              <Pressable onPress={() => setMsgOpen(false)} style={styles.modalBtnMuted}>
                <Text style={styles.modalBtnMutedText}>
                  {safeT("common.close", { defaultValue: "Kapat" })}
                </Text>
              </Pressable>
              {msgAction && (
                <Pressable
                  onPress={() => {
                    const cb = msgAction?.onPress;
                    setMsgOpen(false);
                    if (cb) cb();
                  }}
                  style={styles.modalBtnPrimary}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {msgAction.label || safeT("common.ok", { defaultValue: "Tamam" })}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
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

function MethodPill(props: {
  active: boolean;
  icon: any;
  label: string;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      onLayout={props.onLayout}
      style={[
        styles.methodPill,
        props.active ? styles.methodPillActive : null,
      ]}
    >
      <Ionicons name={props.icon} size={18} color={props.active ? "#fff" : DeliveryColors.text} />
      <Text style={[styles.methodPillText, props.active ? { color: "#fff" } : null]}>
        {props.label}
      </Text>
    </Pressable>
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

  card: {
    backgroundColor: DeliveryColors.card,
    borderRadius: DeliveryRadii.xl,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    padding: 14,
    gap: 10,
  },

  h2: { fontWeight: "900", color: DeliveryColors.text, fontSize: 15 },
  subline: { fontSize: 12, fontWeight: "800", color: DeliveryColors.muted },

  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  moneyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
  },
  moneyPillText: { fontWeight: "900", color: DeliveryColors.primary },

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

  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontWeight: "900", color: DeliveryColors.text },

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

  addrRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  addrIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  addrText: { flex: 1, fontSize: 12, lineHeight: 18 },

  methodPill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  methodPillActive: {
    borderColor: DeliveryColors.primary,
    backgroundColor: DeliveryColors.primary,
  },
  methodPillText: { fontWeight: "900", color: DeliveryColors.text },
  methodSection: { position: "relative" },
  methodRow: { flexDirection: "row", gap: 10 },
  doorOptions: { gap: 8 },
  doorOptionsFloat: { position: "absolute", zIndex: 5, elevation: 5 },
  doorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  doorBtnActive: {
    backgroundColor: DeliveryColors.primary,
    borderColor: DeliveryColors.primary,
  },
  doorBtnInactive: {
    backgroundColor: "#fff",
    borderColor: DeliveryColors.primary,
  },
  doorBtnText: { fontWeight: "900", fontSize: 13 },

  noteBox: {
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    borderRadius: 14,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: { color: DeliveryColors.text, fontWeight: "700" },
  noteHint: { fontSize: 11, lineHeight: 16 },

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
  warnText: { fontSize: 12, fontWeight: "900", color: DeliveryColors.text, flex: 1 },

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
  bottomTitle: { color: "#fff", fontWeight: "900" },
  bottomValue: { color: "rgba(255,255,255,0.9)", fontWeight: "900", marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    width: "100%",
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", marginBottom: 6 },
  modalBody: { marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  modalBtnMuted: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    backgroundColor: "#fff",
  },
  modalBtnMutedText: { fontWeight: "900", color: DeliveryColors.text },
  modalBtnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: DeliveryColors.primary,
  },
  modalBtnPrimaryText: { fontWeight: "900", color: "#fff" },
});

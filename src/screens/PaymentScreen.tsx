import React from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal,
  LayoutChangeEvent,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useStripe } from "@stripe/stripe-react-native";
import * as Linking from "expo-linking";

import { Text } from "../components/Themed";
import { useI18n } from "../i18n";
import { useTheme } from "../contexts/ThemeContext";

import { useAuth } from "../store/useAuth";
import { useCart } from "../store/useCart";
import { getDeliveryRestaurant, createDeliveryOrder } from "../api/delivery";
import { getApplicable, discountSummary, type ApplicableItem } from "../api/promotions.api";
import type { DeliveryRestaurant } from "../delivery/deliveryTypes";

import {
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
  const theme = useTheme();

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

  // Kupon
  const [couponOpen, setCouponOpen] = React.useState(false);
  const [applicable, setApplicable] = React.useState<ApplicableItem[]>([]);
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [selectedCouponCampaignId, setSelectedCouponCampaignId] = React.useState<string | null>(null);

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
  const baseTotal = subtotal + deliveryFee;

  const selectedCoupon = applicable.find((a) => a.campaign._id === selectedCouponCampaignId) ?? null;
  const couponDiscount = selectedCoupon?.discount ?? 0;
  const total = Math.max(baseTotal - couponDiscount, 0);

  const openCouponSheet = React.useCallback(async () => {
    const rid = r?._id ? String(r._id) : restaurantIdParam || cartRestaurantId;
    if (!rid) return;
    setCouponOpen(true);
    setCouponLoading(true);
    try {
      const res = await getApplicable({
        surface: "restaurant",
        storeId: String(rid),
        subtotal,
        deliveryFee,
        paymentMethod: method,
      });
      setApplicable(res.items);
    } catch {
      setApplicable([]);
    } finally {
      setCouponLoading(false);
    }
  }, [r?._id, restaurantIdParam, cartRestaurantId, subtotal, deliveryFee, method]);

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
        couponCampaignId: selectedCouponCampaignId ?? undefined,

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
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text secondary style={{ marginTop: 8 }}>
          {safeT("delivery.loadingPayment", { defaultValue: "Ödeme ekranı hazırlanıyor…" })}
        </Text>
      </View>
    );
  }

  if (!r || count === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: theme.space[6], gap: 10 }}>
        <Ionicons name="alert-circle-outline" size={44} color={theme.colors.textSecondary} />
        <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 16 }}>
          {safeT("delivery.paymentUnavailable", { defaultValue: "Ödeme ekranı açılamadı" })}
        </Text>
        <Text secondary style={{ textAlign: "center" }}>
          {safeT("delivery.paymentUnavailableHint", { defaultValue: "Sepet boş olabilir veya restoran bilgisi alınamadı." })}
        </Text>

        <Pressable
          onPress={() => nav.goBack()}
          style={{
            marginTop: 10,
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.lg,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
            {safeT("common.back", { defaultValue: "Geri" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: DeliverySpacing.screenX,
          paddingTop: 12,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pressable
          onPress={() => nav.goBack()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.borderDefault,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.textPrimary} />
        </Pressable>

        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 16 }}>
            {safeT("delivery.paymentTitle", { defaultValue: "Ödeme" })}
          </Text>
          <Text secondary style={{ marginTop: 2, fontSize: 12, color: theme.colors.textSecondary, fontWeight: "800" }}>
            {safeT("delivery.summaryShort", { defaultValue: "Toplam" })}:{" "}
            <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>
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
        <Card theme={theme}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 15 }}>{r.name}</Text>
              <Text secondary style={{ fontSize: 12, fontWeight: "800", color: theme.colors.textSecondary }}>
                {safeT("delivery.itemsCount", { defaultValue: "Ürün" })}:{" "}
                <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>{count}</Text>
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
              }}
            >
              <Ionicons name="cash-outline" size={14} color={theme.colors.primary} />
              <Text style={{ fontWeight: "900", color: theme.colors.primary }}>{formatMoney(total, symbol)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <MetaChip theme={theme} icon="time-outline" text={meta?.etaText || "—"} />
            <MetaChip theme={theme} icon="navigate-outline" text={meta?.distanceText || "—"} />
          </View>
        </Card>

        {/* Address */}
        <Card theme={theme}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>
              {safeT("delivery.address", { defaultValue: "Adres" })}
            </Text>

            <Pressable
              onPress={() => {
                nav.navigate(DeliveryRoutes.AddressPicker, {
                  returnTo: DeliveryRoutes.Checkout,
                  currentAddressId: addressId,
                });
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
              }}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
              <Text style={{ fontWeight: "900", color: theme.colors.primary, fontSize: 12 }}>
                {safeT("delivery.edit", { defaultValue: "Düzenle" })}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Ionicons name="location-outline" size={16} color={theme.colors.primary} />
            </View>
            <Text secondary style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>
              {addressText || safeT("delivery.addressMissing", { defaultValue: "Teslimat adresi seçilmedi. Lütfen bir adres seçin." })}
            </Text>
          </View>
        </Card>

        {/* Payment method */}
        <Card theme={theme}>
          <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>
            {safeT("delivery.paymentMethod", { defaultValue: "Ödeme Yöntemi" })}
          </Text>

          <View style={{ position: "relative" }}>
          <View
            style={{ flexDirection: "row", gap: 10 }}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              setMethodRowLayout({ y: layout.y, height: layout.height });
            }}
          >
            <MethodPill
              theme={theme}
              active={method === "card"}
              icon="card-outline"
              label={safeT("delivery.payOnline", { defaultValue: "Online Ödeme" })}
              onPress={() => {
                setMethod("card");
                setDoorOpen(false);
              }}
            />
            <MethodPill
              theme={theme}
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
              style={{
                gap: 8,
                position: "absolute",
                zIndex: 5,
                elevation: 5,
                top: (methodRowLayout ? methodRowLayout.y + methodRowLayout.height : 0) + 8,
                left: doorAnchor?.x ?? 0,
                width: doorAnchor?.width ?? "100%",
              }}
            >
              <Pressable
                onPress={() => {
                  setMethod("card_on_delivery");
                  setDoorOpen(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  backgroundColor: method === "card_on_delivery" ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.primary,
                }}
              >
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={method === "card_on_delivery" ? theme.colors.textInverse : theme.colors.primary}
                />
                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 13,
                    color: method === "card_on_delivery" ? theme.colors.textInverse : theme.colors.primary,
                  }}
                >
                  {safeT("delivery.payDoorCard", { defaultValue: "Kapıda Kart" })}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setMethod("cash");
                  setDoorOpen(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  backgroundColor: method === "cash" ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.primary,
                }}
              >
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={method === "cash" ? theme.colors.textInverse : theme.colors.primary}
                />
                <Text
                  style={{
                    fontWeight: "900",
                    fontSize: 13,
                    color: method === "cash" ? theme.colors.textInverse : theme.colors.primary,
                  }}
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

            <View
              style={{
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                borderRadius: 14,
                backgroundColor: theme.colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={safeT("delivery.notePlaceholder", { defaultValue: "Örn: Zil çalışmıyor, arayın." })}
                placeholderTextColor={theme.colors.textSecondary}
                style={{ color: theme.colors.textPrimary, fontWeight: "700" }}
                multiline
              />
            </View>

            <Text secondary style={{ fontSize: 11, lineHeight: 16 }}>
              {safeT("delivery.noteHint", { defaultValue: "Bu not siparişin tamamı için geçerlidir." })}
            </Text>
          </View>
          </View>
        </Card>

        {/* Kupon uygula */}
        <Card theme={theme} style={{ padding: 0 }}>
          <Pressable
            onPress={selectedCoupon ? () => setSelectedCouponCampaignId(null) : openCouponSheet}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="pricetag-outline" size={16} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              {selectedCoupon ? (
                <>
                  <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 13 }} numberOfLines={1}>
                    {selectedCoupon.campaign.title}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: theme.colors.primary, marginTop: 1 }}>
                    {discountSummary(selectedCoupon.campaign.discount, safeT)}
                  </Text>
                </>
              ) : (
                <Text style={{ fontWeight: "900", color: theme.colors.textPrimary, fontSize: 13 }}>
                  {safeT("promotions.apply", { defaultValue: "Kupon uygula" })}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.primary }}>
              {selectedCoupon
                ? safeT("promotions.removeCoupon", { defaultValue: "Kaldır" })
                : safeT("common.select", { defaultValue: "Seç" })}
            </Text>
          </Pressable>
        </Card>

        {/* Summary */}
        <Card theme={theme}>
          <Row theme={theme} label={safeT("delivery.subtotal", { defaultValue: "Ara Toplam" })} value={formatMoney(subtotal, symbol)} />
          <Row theme={theme} label={safeT("delivery.deliveryFee", { defaultValue: "Teslimat" })} value={formatMoney(deliveryFee, symbol)} />
          {couponDiscount > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: theme.colors.primary }}>
                {safeT("promotions.discountLine", { defaultValue: "İndirim" })}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "900", color: theme.colors.primary }}>
                -{formatMoney(couponDiscount, symbol)}
              </Text>
            </View>
          )}
          <Divider theme={theme} />
          <Row theme={theme} strong label={safeT("delivery.total", { defaultValue: "Toplam" })} value={formatMoney(total, symbol)} />

          {minOrder != null && subtotal < minOrder && (
            <View
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 14,
                backgroundColor: theme.colors.primarySoft,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.textPrimary, flex: 1 }}>
                {safeT("delivery.minOrderWarn", { defaultValue: "Minimum sepet tutarına ulaşmadan sipariş veremezsiniz." })}
              </Text>
            </View>
          )}

          {!token && (
            <View
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 14,
                backgroundColor: theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Ionicons name="log-in-outline" size={18} color={theme.colors.textPrimary} />
              <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.textPrimary, flex: 1 }}>
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
          {
            position: "absolute",
            left: DeliverySpacing.screenX,
            right: DeliverySpacing.screenX,
            bottom: 14,
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.xl,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
          DeliveryShadow.floating,
          !canSubmit ? { opacity: 0.55 } : null,
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {submitting || stripeBusy ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textInverse} />
          )}

          <View>
            <Text style={{ color: theme.colors.textInverse, fontWeight: "900" }}>
              {safeT("delivery.placeOrder", { defaultValue: "Siparişi Onayla" })}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "900", marginTop: 2 }}>{formatMoney(total, symbol)}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.colors.textInverse} />
      </Pressable>

      {/* Kupon seçim sheet'i */}
      <Modal visible={couponOpen} transparent animationType="slide" onRequestClose={() => setCouponOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setCouponOpen(false)} />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingHorizontal: DeliverySpacing.screenX,
            paddingBottom: 24 + (Platform.OS === "ios" ? 10 : 0),
            maxHeight: "70%",
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.borderDefault, alignSelf: "center", marginBottom: 16 }} />
          <Text style={{ fontSize: 16, fontWeight: "900", color: theme.colors.textPrimary, marginBottom: 12 }}>
            {safeT("promotions.applyTitle", { defaultValue: "Kupon seç" })}
          </Text>

          {couponLoading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : applicable.length === 0 ? (
            <Text secondary style={{ textAlign: "center", paddingVertical: 24 }}>
              {safeT("promotions.noApplicable", { defaultValue: "Bu sepet için uygun kupon yok." })}
            </Text>
          ) : (
            <ScrollView style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
              {applicable.map((item) => {
                const active = item.campaign._id === selectedCouponCampaignId;
                return (
                  <Pressable
                    key={item.campaign._id}
                    onPress={() => {
                      setSelectedCouponCampaignId(item.campaign._id);
                      setCouponOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? theme.colors.primary : theme.colors.borderDefault,
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.surfaceAlt,
                    }}
                  >
                    <Ionicons name="pricetag" size={20} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }} numberOfLines={1}>
                        {item.campaign.title}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: theme.colors.primary, marginTop: 1 }}>
                        {discountSummary(item.campaign.discount, safeT)}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: "900", color: theme.colors.primary }}>
                      -{formatMoney(item.discount, symbol)}
                    </Text>
                  </Pressable>
                );
              })}
              {selectedCouponCampaignId && (
                <Pressable
                  onPress={() => {
                    setSelectedCouponCampaignId(null);
                    setCouponOpen(false);
                  }}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "900", color: theme.colors.error }}>
                    {safeT("promotions.removeCoupon", { defaultValue: "Kaldır" })}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Uyarı / Bilgi Modal */}
      <Modal visible={msgOpen} transparent animationType="fade" onRequestClose={() => setMsgOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.overlay,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: 14,
              width: "100%",
              padding: theme.space[4],
              borderWidth: 1,
              borderColor:
                msgKind === "error"
                  ? theme.colors.error
                  : msgKind === "warn"
                  ? theme.colors.warning
                  : theme.colors.borderDefault,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "900",
                marginBottom: 6,
                color:
                  msgKind === "error"
                    ? theme.colors.error
                    : msgKind === "warn"
                    ? theme.colors.warning
                    : theme.colors.textPrimary,
              }}
            >
              {msgTitle || safeT("common.info", { defaultValue: "Bilgi" })}
            </Text>
            {!!msgBody && (
              <Text secondary style={{ marginBottom: 12 }}>
                {msgBody}
              </Text>
            )}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <Pressable
                onPress={() => setMsgOpen(false)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.colors.borderDefault,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Text style={{ fontWeight: "900", color: theme.colors.textPrimary }}>
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
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: theme.colors.primary,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: theme.colors.textInverse }}>
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

function Card(props: { children: any; style?: any; theme: ReturnType<typeof useTheme> }) {
  const { theme } = props;
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: theme.colors.borderDefault,
          padding: 14,
          gap: 10,
        },
        DeliveryShadow.card,
        props.style,
      ]}
    >
      {props.children}
    </View>
  );
}

function MetaChip(props: { icon: any; text: string; theme: ReturnType<typeof useTheme> }) {
  const { theme } = props;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.borderDefault,
      }}
    >
      <Ionicons name={props.icon} size={14} color={theme.colors.primary} />
      <Text style={{ fontSize: 12, fontWeight: "900", color: theme.colors.textSecondary }}>{props.text}</Text>
    </View>
  );
}

function MethodPill(props: {
  active: boolean;
  icon: any;
  label: string;
  onPress: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const { theme } = props;
  return (
    <Pressable
      onPress={props.onPress}
      onLayout={props.onLayout}
      style={{
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: props.active ? theme.colors.primary : theme.colors.borderDefault,
        backgroundColor: props.active ? theme.colors.primary : theme.colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Ionicons
        name={props.icon}
        size={18}
        color={props.active ? theme.colors.textInverse : theme.colors.textPrimary}
      />
      <Text
        style={{
          fontWeight: "900",
          color: props.active ? theme.colors.textInverse : theme.colors.textPrimary,
        }}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

function Row(props: { label: string; value: string; strong?: boolean; theme: ReturnType<typeof useTheme> }) {
  const { theme } = props;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text
        secondary
        style={{
          fontSize: 13,
          fontWeight: props.strong ? "900" : "700",
          color: props.strong ? theme.colors.textPrimary : theme.colors.textSecondary,
        }}
      >
        {props.label}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: "900", color: theme.colors.textPrimary }}>
        {props.value}
      </Text>
    </View>
  );
}

function Divider(props: { theme: ReturnType<typeof useTheme> }) {
  return <View style={{ height: 1, backgroundColor: props.theme.colors.borderDefault, opacity: 0.7 }} />;
}

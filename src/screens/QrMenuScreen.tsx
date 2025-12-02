// src/screens/QrMenuScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { useRoute, useNavigation, CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";

import { getRestaurant, type Restaurant as ApiRestaurant } from "../api/restaurants";
import {
  rpListCategories,
  rpListItems,
  type MenuCategory,
  type MenuItem as ALaCarteItem,
} from "../api/menu";
import {
  openOrderSession,
  createOrder,
  createOrderStripeIntent,
  listSessionOrders, // ✅ adisyon için
  type StripeIntentResponse,
  type OrderDto, // ✅ yoksa any yapabilirsin
} from "../api/orders";
import { createTableServiceRequest } from "../api/tableService";
import { useQrCart, selectCount, selectTotal } from "../store/useQrCart";
import { useAuth } from "../store/useAuth";
import { useI18n } from "../i18n";

type Restaurant = ApiRestaurant;

type ALaCarteCategory = MenuCategory;
type ALaCarteItemsByCat = Record<string, ALaCarteItem[]>;

const C = {
  primary: "#7B2C2C",
  primaryDark: "#6B2525",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
  soft: "#FFF5F5",
};

const CTA_HEIGHT = 96;

const currencyFromRegion = (region?: string | null) => {
  const r = String(region || "").toUpperCase();
  if (r === "UK" || r === "GB") return "GBP";
  return "TRY";
};

const formatCurrency = (amount: number, currency: string, localeForIntl: string) => {
  try {
    return new Intl.NumberFormat(localeForIntl, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(isFinite(amount) ? amount : 0);
  } catch {
    const n = Math.round(isFinite(amount) ? amount : 0);
    return `${n} ${currency}`;
  }
};

export default function QrMenuScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { t, language, locale: hookLocale } = useI18n();
  const locale = language ?? hookLocale ?? "tr";

  const token = useAuth((s) => s.token);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const restaurantId: string = route.params?.restaurantId ?? "";
  const tableId: string | null = route.params?.tableId ?? null;
  const sessionIdFromQr: string | null = route.params?.sessionId ?? null;
  const reservationId: string | null = route.params?.reservationId ?? null;

  const setContext = useQrCart((s) => s.setContext);
  const items = useQrCart((s) => s.items);
  const addItem = useQrCart((s) => s.addItem);
  const inc = useQrCart((s) => s.inc);
  const dec = useQrCart((s) => s.dec);
  const clearCart = useQrCart((s) => s.clearItems);
  const notes = useQrCart((s) => s.notes);
  const setNotes = useQrCart((s) => s.setNotes);

  const total = useQrCart(selectTotal);
  const count = useQrCart(selectCount);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const [menuCats, setMenuCats] = useState<ALaCarteCategory[]>([]);
  const [menuItemsByCat, setMenuItemsByCat] = useState<ALaCarteItemsByCat>({});
  const [menuLoading, setMenuLoading] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [previewItem, setPreviewItem] = useState<ALaCarteItem | null>(null);

  const [payMethod, setPayMethod] = useState<"card" | "pay_at_venue">("card");
  const [sessionId, setSessionId] = useState<string | null>(sessionIdFromQr);

  const [creating, setCreating] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [methodSheet, setMethodSheet] = useState(false);

  // ✅ CTA ölçümü: popover butonları aynı genişlikte ve tam üstüne gelsin
  const [ctaLayout, setCtaLayout] = useState<{ x: number; width: number; height: number } | null>(
    null
  );

  // ✅ Adisyon / geçmiş siparişler modal state
  const [billModal, setBillModal] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billOrders, setBillOrders] = useState<OrderDto[]>([]);
  const [billTotals, setBillTotals] = useState<{
    onlinePaid: number;
    payAtVenue: number;
    grand: number;
  } | null>(null);

  const onConfirmOrder = async (methodOverride?: "card" | "pay_at_venue") => {
    const methodToUse = methodOverride ?? payMethod;

    if (!restaurantId) return;
    if (creating || sheetBusy) return;
    if (items.length === 0) {
      Alert.alert(t("qrMenu.cartEmptyTitle"), t("qrMenu.cartEmptyMessage"));
      return;
    }

    try {
      setCreating(true);

      // session yoksa backend'den açmaya çalış
      let sid = sessionId;

      if (!sid) {
        try {
          const s = await openOrderSession({
            restaurantId,
            tableId: tableId || undefined,
            reservationId: reservationId || undefined,
          });

          sid = (s as any)?.sessionId || (s as any)?._id || (s as any)?.id || null;
          if (sid) {
            setSessionId(String(sid));
            setContext({ sessionId: String(sid) });
          }
        } catch {
          sid = null;
        }
      }

      const order = await createOrder({
        restaurantId,
        tableId: tableId || undefined,
        sessionId: sid || undefined,
        reservationId: reservationId || undefined,
        items: items.map((x) => ({
          itemId: x.itemId,
          title: x.title,
          qty: x.qty,
          price: x.price,
        })),
        notes: notes?.trim() || undefined,
        paymentMethod: methodToUse,
      });

      const orderId =
        (order as any)?._id ||
        (order as any)?.id ||
        (order as any)?.orderId ||
        (order as any)?.order?._id;

      if (!orderId) {
        console.log("[QrMenu] createOrder response:", order);
        Alert.alert(t("common.error"), t("qrMenu.orderIdMissing"));
        return;
      }

      if (methodToUse === "card") {
        setSheetBusy(true);

        const setup: StripeIntentResponse = await createOrderStripeIntent(orderId, {
          saveCard: true,
        });

        if (!setup?.paymentIntentClientSecret || !setup?.customerId || !setup?.ephemeralKey) {
          Alert.alert(
            t("qrMenu.stripeMissingTitle"),
            t("qrMenu.stripeMissingMessage")
          );
          return;
        }

        const { paymentIntentClientSecret, customerId, ephemeralKey } = setup;

        const { error: initError } = await initPaymentSheet({
          customerId,
          customerEphemeralKeySecret: ephemeralKey,
          paymentIntentClientSecret,
          merchantDisplayName: "Rezvix",
          allowsDelayedPaymentMethods: false,
          style: "alwaysLight",
          appearance: {
            colors: {
              primary: C.primary,
              background: C.card,
              componentBackground: C.card,
              componentBorder: C.border,
              componentText: C.text,
              primaryText: "#FFFFFF",
              secondaryText: C.muted,
              placeholderText: "#9CA3AF",
              icon: C.primary,
            },
            shapes: { borderRadius: 12, borderWidth: 1 },
            primaryButton: {
              colors: { background: C.primary, text: "#FFFFFF", border: C.primary },
              shapes: { borderRadius: 16 },
            },
          },
        });

        if (initError) {
          Alert.alert(t("qrMenu.stripeInitErrorTitle"), initError.message);
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== "Canceled") {
            Alert.alert(t("qrMenu.stripeFailTitle"), presentError.message);
          }
          return;
        }
      }

      Alert.alert(
        t("qrMenu.orderSuccessTitle"),
        t("qrMenu.orderSuccessMessage")
      );
      clearCart();

      nav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: token ? "Tabs" : "TabsGuest" }],
        })
      );
    } catch (e: any) {
      Alert.alert(
        t("common.error"),
        e?.response?.data?.message || e?.message || t("qrMenu.orderErrorFallback")
      );
    } finally {
      setSheetBusy(false);
      setCreating(false);
    }
  };

  // context set
  useEffect(() => {
    // QR'dan session geldiyse onu al, yoksa mevcut session'ı ezme
    if (sessionIdFromQr && sessionIdFromQr !== sessionId) {
      setSessionId(sessionIdFromQr);
    }
    setContext({
      restaurantId,
      tableId,
      sessionId: sessionIdFromQr || sessionId,
      reservationId,
    });
  }, [restaurantId, tableId, sessionIdFromQr, reservationId, sessionId, setContext]);

  // load restaurant
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await getRestaurant(restaurantId);
        if (!alive) return;
        setRestaurant(r);
      } catch (e: any) {
        Alert.alert(
          t("common.error"),
          e?.response?.data?.message || e?.message || t("qrMenu.restaurantLoadError")
        );
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // load menu
  const loadMenu = React.useCallback(async () => {
    if (!restaurantId) return;
    setMenuLoading(true);
    try {
      const cats = await rpListCategories(restaurantId);
      const byCat: ALaCarteItemsByCat = {};
      await Promise.all(
        (cats || []).map(async (c) => {
          try {
            const its = await rpListItems(restaurantId, { categoryId: c._id });
            const activeIts = (its || []).filter((x) => x?.isActive ?? true);
            if (activeIts.length) byCat[c._id] = activeIts;
          } catch {
            // ignore item-level errors
          }
        })
      );

      const nonEmptyCats = (cats || []).filter(
        (c) => !!byCat[c._id]?.length && (c.isActive ?? true)
      );
      setMenuCats(nonEmptyCats);
      setMenuItemsByCat(byCat);
      setExpandedCatId(nonEmptyCats[0]?._id ?? null);
      setExpandAll(false);
    } catch {
      setMenuCats([]);
      setMenuItemsByCat({});
    } finally {
      setMenuLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const currencyCode = useMemo(
    () => currencyFromRegion(restaurant?.region),
    [restaurant?.region]
  );
  const intlLocaleForMoney =
    locale === "tr" ? "tr-TR" : locale === "en" ? "en-GB" : locale;

  const fmt = (n: number) => formatCurrency(n, currencyCode, intlLocaleForMoney);

  const bottomPad = CTA_HEIGHT + insets.bottom + 18;

  const cartMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.itemId, it.qty);
    return m;
  }, [items]);

  const onAdd = (it: ALaCarteItem, catId?: string) => {
    if (!(it?.isAvailable ?? true)) return;
    addItem({
      itemId: it._id,
      title: it.title,
      price: Number(it.price) || 0,
      photoUrl: it.photoUrl,
      categoryId: catId,
    });
  };
  // ✅ Garson çağır / Hesap iste quick action
  const handleQuickRequest = React.useCallback(
    async (kind: "waiter" | "bill") => {
      if (!restaurantId) return;

      try {
        // Session yoksa aç
        let sid = sessionId;
        if (!sid) {
          const s = await openOrderSession({
            restaurantId,
            tableId: tableId || undefined,
            reservationId: reservationId || undefined,
          });
          sid =
            (s as any)?.sessionId ||
            (s as any)?._id ||
            (s as any)?.id ||
            null;

          if (sid) {
            const sidi = String(sid);
            setSessionId(sidi);
            setContext({ sessionId: sidi });
          }
        }

        await createTableServiceRequest({
          restaurantId,
          tableId,
          sessionId: sid || undefined,
          type: kind,
        });

        if (kind === "waiter") {
          Alert.alert(
            t("qrMenu.waiterCallSuccessTitle"),
            t("qrMenu.waiterCallSuccessMessage")
          );
        } else {
          Alert.alert(
            t("qrMenu.billRequestSuccessTitle"),
            t("qrMenu.billRequestSuccessMessage")
          );
        }
      } catch (e: any) {
        Alert.alert(
          t("common.error"),
          e?.response?.data?.message ||
            e?.message ||
            t("qrMenu.quickRequestError")
        );
      }
    },
    [
      restaurantId,
      tableId,
      reservationId,
      sessionId,
      setContext,
      setSessionId,
      t,
    ]
  );
  // ✅ Adisyon modalını aç ve session siparişlerini çek
  const openBill = async () => {
    try {
      setBillLoading(true);

      let sid = sessionId;
      if (!sid) {
        const s = await openOrderSession({
          restaurantId,
          tableId: tableId || undefined,
          reservationId: reservationId || undefined,
        });
        sid = (s as any)?.sessionId || (s as any)?._id || (s as any)?.id || null;
        if (sid) {
          const sidi = String(sid);
          setSessionId(sidi);
          setContext({ sessionId: sidi });
        }
      }

      if (!sid) {
        setBillOrders([]);
        setBillTotals({ onlinePaid: 0, payAtVenue: 0, grand: 0 });
        setBillModal(true);
        return;
      }

      const list = await listSessionOrders(String(sid));
      const orders = Array.isArray(list) ? list : [];

      let onlinePaid = 0;
      let payAtVenue = 0;
      for (const o of orders as any[]) {
        const ot = Number(o?.total || 0);
        const pm = String(o?.paymentMethod || "");
        const ps = String(o?.paymentStatus || "");
        if (pm === "card") {
          if (ps === "succeeded" || ps === "paid" || ps === "success") onlinePaid += ot;
          else onlinePaid += ot; // fallback
        } else {
          payAtVenue += ot;
        }
      }
      const grand = onlinePaid + payAtVenue;

      setBillOrders(orders as any);
      setBillTotals({ onlinePaid, payAtVenue, grand });
      setBillModal(true);
    } catch {
      setBillOrders([]);
      setBillTotals(null);
      setBillModal(true);
    } finally {
      setBillLoading(false);
    }
  };

  const onCtaLayout = (e: LayoutChangeEvent) => {
    const { x, width, height } = e.nativeEvent.layout;
    setCtaLayout({ x, width, height });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ marginTop: 8 }}>{t("qrMenu.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 6) }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>
            {restaurant?.name || t("qrMenu.menuTitle")}
          </Text>
          {!!tableId && (
            <Text style={styles.topSub}>
              {t("qrMenu.tableLabel", { tableId })}
            </Text>
          )}
        </View>

        {/* ✅ Adisyon + Sepeti temizle */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={openBill} style={styles.topBtn}>
            <Ionicons name="receipt-outline" size={20} color={C.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (items.length === 0) return;
              Alert.alert(
                t("qrMenu.clearCartTitle"),
                t("qrMenu.clearCartMessage"),
                [
                  { text: t("qrMenu.clearCartCancel"), style: "cancel" },
                  {
                    text: t("qrMenu.clearCartConfirm"),
                    style: "destructive",
                    onPress: clearCart,
                  },
                ]
              );
            }}
            style={styles.topBtn}
          >
            <Ionicons name="trash-outline" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 0, paddingBottom: bottomPad }} // ✅ üst boşluk azaltıldı
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Notlar */}
        <View style={styles.menuWrapper}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("qrMenu.notesLabel")}</Text>
            <TextInput
              placeholder={t("qrMenu.notesPlaceholder")}
              placeholderTextColor="#9CA3AF"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notes}
            />
          </View>
          <View style={styles.quickRow}>
            <TouchableOpacity
  style={styles.quickBtn}
  activeOpacity={0.9}
  onPress={() => handleQuickRequest("waiter")}
>
  <Ionicons name="hand-left-outline" size={16} color={C.primary} />
  <Text style={styles.quickText}>{t("qrMenu.waiterCall")}</Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.quickBtn}
  activeOpacity={0.9}
  onPress={() => handleQuickRequest("bill")}
>
  <Ionicons name="receipt-outline" size={16} color={C.primary} />
  <Text style={styles.quickText}>{t("qrMenu.requestBill")}</Text>
</TouchableOpacity>
          </View>
        </View>

        {/* Menü */}
        <View style={styles.menuWrapper}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="book-outline" size={20} color={C.primary} />
              <Text style={styles.sectionTitle}>{t("qrMenu.menuTitle")}</Text>

              {menuCats.length > 0 && (
                <TouchableOpacity
                  onPress={() => setExpandAll((p) => !p)}
                  style={styles.expandAllBtn}
                >
                  <Ionicons
                    name={
                      expandAll ? "chevron-up-circle" : "chevron-down-circle"
                    }
                    size={16}
                    color={C.primary}
                  />
                  <Text style={styles.expandAllText}>
                    {expandAll
                      ? t("qrMenu.collapseAll")
                      : t("qrMenu.expandAll")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {menuLoading ? (
              <View style={styles.centerSmall}>
                <ActivityIndicator color={C.primary} />
                <Text style={styles.muted}>{t("qrMenu.menuLoading")}</Text>
              </View>
            ) : menuCats.length === 0 ? (
              <View style={styles.centerSmall}>
                <Ionicons name="list-outline" size={30} color="#999" />
                <Text style={styles.muted}>{t("qrMenu.menuEmpty")}</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {menuCats.map((c) => {
                  const isOpen = expandAll || expandedCatId === c._id;
                  const catItems = menuItemsByCat[c._id] || [];

                  return (
                    <View key={c._id} style={styles.catCard}>
                      <TouchableOpacity
                        onPress={() => {
                          if (expandAll) return;
                          setExpandedCatId(isOpen ? null : c._id);
                        }}
                        style={styles.catHeader}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catTitle}>{c.title}</Text>
                          {!!c.description && (
                            <Text style={styles.catDesc} numberOfLines={2}>
                              {c.description}
                            </Text>
                          )}
                        </View>
                        <View style={styles.catBadge}>
                          <Text style={styles.catBadgeText}>
                            {catItems.length}
                          </Text>
                          <Ionicons
                            name={isOpen ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={C.primary}
                          />
                        </View>
                      </TouchableOpacity>

                      {isOpen && (
                        <View style={{ paddingTop: 10, gap: 10 }}>
                          {catItems.map((it) => {
                            const qty = cartMap.get(it._id) || 0;
                            const disabled = !(it?.isAvailable ?? true);

                            return (
                              <View key={it._id} style={styles.itemRow}>
                                {it.photoUrl ? (
                                  <TouchableOpacity
                                    onPress={() => setPreviewItem(it)}
                                  >
                                    <Image
                                      source={{ uri: it.photoUrl }}
                                      style={styles.itemPhoto}
                                    />
                                  </TouchableOpacity>
                                ) : (
                                  <View style={styles.itemPhotoPh}>
                                    <Ionicons
                                      name="fast-food-outline"
                                      size={20}
                                      color={C.primary}
                                    />
                                  </View>
                                )}

                                <TouchableOpacity
                                  style={{ flex: 1 }}
                                  onPress={() => setPreviewItem(it)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.itemTitle}>{it.title}</Text>
                                  {!!it.description && (
                                    <Text
                                      style={styles.itemDesc}
                                      numberOfLines={2}
                                    >
                                      {it.description}
                                    </Text>
                                  )}
                                </TouchableOpacity>

                                <View
                                  style={{ alignItems: "flex-end", gap: 6 }}
                                >
                                  <Text style={styles.itemPrice}>
                                    {fmt(it.price)}
                                  </Text>

                                  {disabled ? (
                                    <Text style={styles.itemUnavailable}>
                                      {t("qrMenu.outOfStock")}
                                    </Text>
                                  ) : qty === 0 ? (
                                    <TouchableOpacity
                                      onPress={() => onAdd(it, c._id)}
                                      style={styles.addBtn}
                                      activeOpacity={0.85}
                                    >
                                      <Ionicons
                                        name="add"
                                        size={16}
                                        color="#fff"
                                      />
                                      <Text style={styles.addBtnText}>
                                        {t("qrMenu.add")}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <View style={styles.qtyRow}>
                                      <TouchableOpacity
                                        onPress={() => dec(it._id)}
                                        style={styles.qtyBtn}
                                      >
                                        <Ionicons
                                          name="remove"
                                          size={14}
                                          color={C.primary}
                                        />
                                      </TouchableOpacity>
                                      <Text style={styles.qtyText}>{qty}</Text>
                                      <TouchableOpacity
                                        onPress={() => inc(it._id)}
                                        style={styles.qtyBtn}
                                      >
                                        <Ionicons
                                          name="add"
                                          size={14}
                                          color={C.primary}
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Sepet CTA */}
      <View
        style={[
          styles.ctaBar,
          { paddingBottom: Math.max(12, 12 + insets.bottom) },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>
            {t("qrMenu.cartLabel", { count })}
          </Text>
          <Text style={styles.ctaTotal}>
            {t("qrMenu.cartTotal", { amount: fmt(total) })}
          </Text>
        </View>

        <TouchableOpacity
          onLayout={onCtaLayout} // ✅ ölçüm
          onPress={() => setMethodSheet(true)}
          disabled={creating || sheetBusy || items.length === 0}
          style={[
            styles.ctaBtn,
            (creating || sheetBusy || items.length === 0) &&
              styles.ctaBtnDisabled,
          ]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={payMethod === "card" ? "card-outline" : "cash-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.ctaBtnText}>
            {creating || sheetBusy
              ? t("qrMenu.processing")
              : t("qrMenu.confirmOrder")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Ödeme yöntem popover */}
      <Modal
        visible={methodSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setMethodSheet(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMethodSheet(false)}
          style={styles.methodSheetBackdrop}
        >
          <View
            style={[
              styles.methodPopover,
              {
                bottom: CTA_HEIGHT + insets.bottom + 10,
                left: ctaLayout?.x ?? undefined,
                width: ctaLayout?.width ?? undefined,
                right: ctaLayout ? undefined : 16, // fallback
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.methodPopoverBtn,
                ctaLayout && { width: "100%" },
              ]}
              activeOpacity={0.9}
              onPress={() => {
                setPayMethod("card");
                setMethodSheet(false);
                onConfirmOrder("card");
              }}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.methodPopoverBtnText}>
                {t("qrMenu.payWithCard")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.methodPopoverBtn,
                styles.methodPopoverBtnSecondary,
                ctaLayout && { width: "100%" },
              ]}
              activeOpacity={0.9}
              onPress={() => {
                setPayMethod("pay_at_venue");
                setMethodSheet(false);
                onConfirmOrder("pay_at_venue");
              }}
            >
              <Ionicons name="cash-outline" size={18} color={C.primary} />
              <Text
                style={[
                  styles.methodPopoverBtnText,
                  styles.methodPopoverBtnTextSecondary,
                ]}
              >
                {t("qrMenu.payAtVenue")}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ✅ Adisyon / Geçmiş Siparişler Modalı */}
      <Modal
        visible={billModal}
        transparent
        animationType="fade"
        onRequestClose={() => setBillModal(false)}
      >
        <View style={styles.billBackdrop}>
          {/* Dışarı tıklayınca kapansın, ama içeride scroll çalışsın */}
          <TouchableOpacity
            style={styles.billBackdropPress}
            activeOpacity={1}
            onPress={() => setBillModal(false)}
          />

          <View style={styles.billCard}>
            <View style={styles.billHeader}>
              <Text style={styles.billTitle}>{t("qrMenu.billTitle")}</Text>
              <TouchableOpacity
                onPress={() => setBillModal(false)}
                style={styles.billClose}
              >
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {billLoading ? (
              <View
                style={{ paddingVertical: 24, alignItems: "center" }}
              >
                <ActivityIndicator color={C.primary} />
                <Text style={{ marginTop: 8, color: C.muted }}>
                  {t("qrMenu.loading")}
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 420 }}
                contentContainerStyle={styles.billScrollContent}
              >
                <View style={styles.billSection}>
                  <Text style={styles.billMuted}>
                    {t("qrMenu.billTable")}
                  </Text>
                  <Text style={styles.billValue}>{tableId || "-"}</Text>
                </View>

                <View style={styles.billDivider} />

                <View style={styles.billSection}>
                  <Text style={styles.billMuted}>
                    {t("qrMenu.billOnlinePaid")}
                  </Text>
                  <Text style={styles.billValue}>
                    {fmt(billTotals?.onlinePaid || 0)}
                  </Text>
                </View>
                <View style={styles.billSection}>
                  <Text style={styles.billMuted}>
                    {t("qrMenu.billPayAtVenue")}
                  </Text>
                  <Text style={styles.billValue}>
                    {fmt(billTotals?.payAtVenue || 0)}
                  </Text>
                </View>
                <View style={styles.billSection}>
                  <Text style={[styles.billValue, { fontSize: 17 }]}>
                    {t("qrMenu.billGrandTotal")}
                  </Text>
                  <Text style={[styles.billValue, { fontSize: 17 }]}>
                    {fmt(billTotals?.grand || 0)}
                  </Text>
                </View>

                <View style={styles.billDivider} />

                {billOrders.length === 0 ? (
                  <View
                    style={{ paddingVertical: 18, alignItems: "center" }}
                  >
                    <Text style={styles.billMuted}>
                      {t("qrMenu.billEmpty")}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10, paddingBottom: 8 }}>
                    {(billOrders as any[]).map((o, idx) => (
                      <View
                        key={(o as any)?._id || idx}
                        style={styles.billOrderCard}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <Text style={styles.billOrderTitle}>
                            {t("qrMenu.billOrderTitle")}
                          </Text>
                          <Text style={styles.billOrderTotal}>
                            {fmt(Number((o as any)?.total || 0))}
                          </Text>
                        </View>
                        <Text style={styles.billOrderMeta}>
                          {(o as any)?.paymentMethod === "card"
                            ? t("qrMenu.billPaymentMethodCard")
                            : t("qrMenu.billPaymentMethodVenue")}
                          {" · "}
                          {new Date(
                            (o as any)?.createdAt || Date.now()
                          ).toLocaleString(intlLocaleForMoney)}
                        </Text>
                        <View style={{ marginTop: 6, gap: 4 }}>
                          {((o as any)?.items || []).map(
                            (it: any, i2: number) => (
                              <Text key={i2} style={styles.billItem}>
                                {it?.qty || 1}×{" "}
                                {it?.title ||
                                  t("qrMenu.billItemFallback")}
                              </Text>
                            )
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Preview modal */}
      <Modal
        visible={!!previewItem}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <TouchableOpacity
          style={styles.previewBackdrop}
          onPress={() => setPreviewItem(null)}
        >
          <View style={styles.previewCard}>
            {previewItem?.photoUrl ? (
              <Image
                source={{ uri: previewItem.photoUrl }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewImagePh}>
                <Ionicons
                  name="fast-food-outline"
                  size={40}
                  color={C.primary}
                />
                <Text
                  style={{ fontWeight: "800", color: C.primary }}
                >
                  {t("qrMenu.photoMissing")}
                </Text>
              </View>
            )}

            <View style={{ padding: 14, gap: 6 }}>
              <Text style={styles.previewTitle}>{previewItem?.title}</Text>
              {!!previewItem?.description && (
                <Text style={styles.previewDesc}>
                  {previewItem.description}
                </Text>
              )}
              <Text style={styles.previewPrice}>
                {fmt(previewItem?.price || 0)}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setPreviewItem(null)}
              style={styles.previewClose}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  centerSmall: { paddingVertical: 18, alignItems: "center", gap: 8 },
  muted: { color: C.muted, fontSize: 13 },

  topBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  topTitle: { fontSize: 17, fontWeight: "900", color: C.text },
  topSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    ...cardShadow,
  },
  menuWrapper: {
    paddingHorizontal: 16,
    paddingTop: 0, // ✅ üst boşluk azaltıldı
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: "900", color: C.text, fontSize: 16 },

  notes: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    color: C.text,
    backgroundColor: "#fff",
  },

  expandAllBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    gap: 6,
    backgroundColor: C.soft,
    borderWidth: 1,
    borderColor: "#F3DADA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  expandAllText: { fontSize: 12, fontWeight: "800", color: C.primary },

  catCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  catTitle: { fontSize: 15, fontWeight: "900", color: C.text },
  catDesc: { marginTop: 4, color: C.muted, fontSize: 12, lineHeight: 18 },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
  },
  catBadgeText: { fontWeight: "900", color: C.primary, fontSize: 12 },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  itemPhoto: { width: 62, height: 62, borderRadius: 10, backgroundColor: "#E6E6E6" },
  itemPhotoPh: {
    width: 62,
    height: 62,
    borderRadius: 10,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F3DADA",
  },
  itemTitle: { fontSize: 14, fontWeight: "800", color: C.text },
  itemDesc: { marginTop: 4, color: C.muted, fontSize: 12, lineHeight: 17 },
  itemPrice: { fontSize: 15, fontWeight: "900", color: C.primary },
  itemUnavailable: { fontSize: 11, fontWeight: "800", color: "#999" },

  addBtn: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { minWidth: 18, textAlign: "center", fontWeight: "900", color: C.text },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    height: CTA_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ctaTitle: { fontWeight: "900", color: C.text, fontSize: 14 },
  ctaTotal: { marginTop: 2, fontWeight: "900", color: C.primary, fontSize: 16 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 170,
  },
  ctaBtnDisabled: { opacity: 0.55 },
  ctaBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  previewCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  previewImage: { width: "100%", height: 240, backgroundColor: "#E6E6E6" },
  previewImagePh: {
    width: "100%",
    height: 240,
    backgroundColor: C.soft,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  previewTitle: { fontSize: 17, fontWeight: "900", color: C.text },
  previewDesc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  previewPrice: { fontSize: 18, fontWeight: "900", color: C.primary },
  previewClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  methodSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // ✅ Popover absolute, CTA'nın tam üstü
  methodPopover: {
    position: "absolute",
    gap: 8,
    alignItems: "stretch",
  },
  methodPopoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    paddingVertical: 12,
    borderRadius: 14,
    ...cardShadow,
  },
  methodPopoverBtnSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.primary,
  },
  methodPopoverBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  methodPopoverBtnTextSecondary: {
    color: C.primary,
  },

  // ✅ Adisyon modal styles
  billBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  billCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    ...cardShadow,
  },
  billHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  billTitle: { fontSize: 17, fontWeight: "900", color: C.text },
  billClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  billSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  billMuted: { color: C.muted, fontSize: 13, fontWeight: "700" },
  billValue: { color: C.text, fontSize: 14, fontWeight: "900" },
  billDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  billOrderCard: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
  },
  billOrderTitle: { fontWeight: "900", color: C.text, fontSize: 14 },
  billOrderTotal: { fontWeight: "900", color: C.primary, fontSize: 14 },
  billOrderMeta: { marginTop: 2, color: C.muted, fontSize: 11, fontWeight: "700" },
  billItem: { color: C.text, fontSize: 12, fontWeight: "700" },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -2,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    ...cardShadow,
  },
  quickText: {
    fontSize: 13,
    fontWeight: "900",
    color: C.primary,
  },
  billBackdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  billScrollContent: {
    paddingBottom: 8,
  },
});
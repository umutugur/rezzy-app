// src/screens/market/MarketCartScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "@stripe/stripe-react-native";
import * as Linking from "expo-linking";

import { useTheme } from "../../contexts/ThemeContext";
import { Badge, Button, EmptyState, PriceTag } from "../../components/ui";
import { createOrder, getStoreDetail, type MarketStore, type PaymentMethod } from "../../api/market.api";
import { listMyAddresses, type UserAddress } from "../../api/addresses";
import {
  computeDeliveryFee,
  computeSubtotal,
  computeTotal,
  useMarketCart,
  type MarketCartItem,
} from "../../store/useMarketStore";
import { MarketRoutes } from "../../navigation/marketRoutes";

// ─── Satır ─────────────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onIncrease,
  onDecrease,
}: {
  item: MarketCartItem;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const theme = useTheme();
  const photoUri = item.product.photos[0] ?? null;

  return (
    <View
      style={[
        styles.itemRow,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.borderDefault,
          paddingVertical: theme.space[3],
          paddingHorizontal: theme.space[4],
          gap: theme.space[3],
        },
      ]}
    >
      {/* Fotoğraf */}
      <View
        style={[
          styles.photo,
          { borderRadius: theme.radius.md, backgroundColor: theme.market.light },
        ]}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={20} color={theme.market.main} />
        )}
      </View>

      {/* Bilgi */}
      <View style={{ flex: 1 }}>
        <Text
          style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }}
          numberOfLines={2}
        >
          {item.product.title}
        </Text>
        <PriceTag
          amount={item.product.price * item.qty}
          size="sm"
          style={{ marginTop: theme.space[1] }}
        />
      </View>

      {/* Adet */}
      <View style={[styles.qtyRow, { gap: theme.space[2] }]}>
        <Pressable
          onPress={onDecrease}
          style={[
            styles.qtyBtn,
            {
              backgroundColor: item.qty === 1 ? theme.colors.errorSoft : theme.market.light,
              borderRadius: theme.radius.sm,
              borderColor: item.qty === 1 ? theme.colors.error : theme.market.main,
            },
          ]}
        >
          <Ionicons
            name={item.qty === 1 ? "trash-outline" : "remove"}
            size={16}
            color={item.qty === 1 ? theme.colors.error : theme.market.main}
          />
        </Pressable>
        <Text
          style={{
            ...theme.typography.headingSm,
            color: theme.market.main,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {item.qty}
        </Text>
        <Pressable
          onPress={onIncrease}
          style={[
            styles.qtyBtn,
            {
              backgroundColor: theme.market.main,
              borderRadius: theme.radius.sm,
              borderColor: theme.market.main,
            },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.colors.textInverse} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Teslimat tipi kartı ────────────────────────────────────────────────────────

function DeliveryTypeCard({
  selected,
  type,
  title,
  subtitle,
  icon,
  onPress,
}: {
  selected: boolean;
  type: "pickup" | "delivery";
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.deliveryCard,
        {
          backgroundColor: selected ? theme.market.light : theme.colors.surfaceAlt,
          borderColor: selected ? theme.market.main : theme.colors.borderDefault,
          borderRadius: theme.radius.md,
          padding: theme.space[4],
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          flex: 1,
        },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={28}
        color={selected ? theme.market.main : theme.colors.textSecondary}
      />
      <Text
        style={{
          ...theme.typography.headingSm,
          color: selected ? theme.market.main : theme.colors.textPrimary,
          marginTop: theme.space[2],
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          ...theme.typography.bodySm,
          color: selected ? theme.market.main : theme.colors.textSecondary,
          marginTop: theme.space[1],
        }}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

// ─── Ödeme Yöntemi Kartı ───────────────────────────────────────────────────────

function PaymentMethodCard({
  method,
  selected,
  title,
  subtitle,
  icon,
  onPress,
}: {
  method: PaymentMethod;
  selected: boolean;
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.deliveryCard,
        {
          backgroundColor: selected ? theme.market.light : theme.colors.surfaceAlt,
          borderColor: selected ? theme.market.main : theme.colors.borderDefault,
          borderRadius: theme.radius.md,
          padding: theme.space[3],
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          flex: 1,
          gap: theme.space[1],
        },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={24}
        color={selected ? theme.market.main : theme.colors.textSecondary}
      />
      <Text
        style={{
          ...theme.typography.labelSm,
          color: selected ? theme.market.main : theme.colors.textPrimary,
          marginTop: theme.space[1],
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={{
          ...theme.typography.caption,
          color: selected ? theme.market.main : theme.colors.textSecondary,
        }}
        numberOfLines={1}
      >
        {subtitle}
      </Text>
    </Pressable>
  );
}

// ─── Ekran ─────────────────────────────────────────────────────────────────────

export default function MarketCartScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const items = useMarketCart((s) => s.items);
  const storeId = useMarketCart((s) => s.storeId);
  const deliveryType = useMarketCart((s) => s.deliveryType);
  const selectedAddressId = useMarketCart((s) => s.selectedAddressId);
  const setDeliveryType = useMarketCart((s) => s.setDeliveryType);
  const setSelectedAddressId = useMarketCart((s) => s.setSelectedAddressId);
  const addItem = useMarketCart((s) => s.addItem);
  const removeItem = useMarketCart((s) => s.removeItem);
  const updateQty = useMarketCart((s) => s.updateQty);
  const clearCart = useMarketCart((s) => s.clearCart);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [store, setStore] = useState<MarketStore | null>(null);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const subtotal = computeSubtotal(items);
  const deliveryFee = computeDeliveryFee(
    deliveryType,
    subtotal,
    store?.deliveryFee ?? 0,
    store?.freeDeliveryThreshold ?? null,
  );
  const total = computeTotal(subtotal, deliveryFee);

  const belowMin =
    store != null &&
    store.minOrderAmount > 0 &&
    subtotal < store.minOrderAmount &&
    deliveryType === "delivery";

  useEffect(() => {
    if (storeId) {
      getStoreDetail(storeId)
        .then(setStore)
        .catch(() => {});
    }
    listMyAddresses()
      .then(setAddresses)
      .catch(() => {});
  }, [storeId]);

  const handleOrder = useCallback(async () => {
    if (!storeId) return;
    if (deliveryType === "delivery" && !selectedAddressId) {
      Alert.alert("Adres gerekli", "Lütfen bir teslimat adresi seçin.");
      return;
    }
    if (belowMin) {
      Alert.alert(
        "Minimum tutar",
        `Bu markette minimum sipariş tutarı ₺${store!.minOrderAmount}.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await createOrder({
        storeId,
        items: items.map((i) => ({ productId: i.product._id, qty: i.qty })),
        type: deliveryType,
        deliveryAddressId:
          deliveryType === "delivery" ? selectedAddressId : null,
        paymentMethod,
      });

      const { order, payment } = result;

      // ─── Online ödeme: Stripe PaymentSheet ──────────────────────────────
      if (paymentMethod === "online" && payment?.clientSecret) {
        setSubmitting(false);
        setStripeBusy(true);

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: payment.clientSecret,
          merchantDisplayName: "Rezvix Market",
          returnURL: Linking.createURL("stripe-redirect"),
          allowsDelayedPaymentMethods: false,
          style: "alwaysLight",
        });

        if (initError) {
          Alert.alert(
            "Ödeme başlatılamadı",
            initError.message ?? "Ödeme ekranı açılamadı. Tekrar deneyin.",
          );
          setStripeBusy(false);
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        setStripeBusy(false);

        if (presentError) {
          if (presentError.code !== "Canceled") {
            Alert.alert(
              "Ödeme başarısız",
              presentError.message ?? "Ödeme tamamlanamadı. Tekrar deneyin.",
            );
          }
          // Kullanıcı iptal etti veya hata aldı — siparişi silmiyoruz,
          // webhook veya sipariş detay ekranından tekrar deneyebilir
          return;
        }

        // Ödeme başarılı
        clearCart();
        Alert.alert(
          "Ödeme alındı",
          "Siparişiniz onaylandı. Market hazırlığa başlıyor.",
          [{ text: "Tamam", onPress: () => navigation.navigate(MarketRoutes.OrderDetail, { orderId: order._id }) }],
        );
        return;
      }

      // ─── Nakit / Kart (kapıda) ───────────────────────────────────────────
      clearCart();
      navigation.navigate(MarketRoutes.OrderDetail, { orderId: order._id });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Sipariş oluşturulamadı. Tekrar dene.";
      Alert.alert("Hata", msg);
    } finally {
      setSubmitting(false);
      setStripeBusy(false);
    }
  }, [
    storeId,
    items,
    deliveryType,
    selectedAddressId,
    belowMin,
    store,
    clearCart,
    navigation,
    paymentMethod,
    initPaymentSheet,
    presentPaymentSheet,
  ]);

  // ⚠️ renderItem MUST be before the early return — hooks cannot be called after a return
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketCartItem>) => (
      <CartItemRow
        item={item}
        onIncrease={() => addItem(item.product)}
        onDecrease={() => {
          if (item.qty === 1) removeItem(item.product._id);
          else updateQty(item.product._id, item.qty - 1);
        }}
      />
    ),
    [addItem, removeItem, updateQty],
  );

  if (items.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          illustration="market"
          title="Sepetiniz boş"
          subtitle="Alışverişe başlamak için market seçin."
          action={{
            label: "Marketlere Dön",
            onPress: () => navigation.navigate(MarketRoutes.Home),
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 160,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Ürünler */}
        <FlatList
          data={items}
          keyExtractor={(i) => i.product._id}
          renderItem={renderItem}
          scrollEnabled={false}
          style={{ backgroundColor: theme.colors.surface }}
        />

        {/* Teslimat tipi */}
        <View
          style={[
            styles.section,
            {
              paddingHorizontal: theme.space[4],
              paddingTop: theme.space[4],
              paddingBottom: theme.space[3],
              borderTopColor: theme.colors.borderDefault,
            },
          ]}
        >
          <Text
            style={{
              ...theme.typography.headingSm,
              color: theme.colors.textPrimary,
              marginBottom: theme.space[3],
            }}
          >
            Teslimat Tipi
          </Text>
          <View style={{ flexDirection: "row", gap: theme.space[3] }}>
            <DeliveryTypeCard
              type="pickup"
              selected={deliveryType === "pickup"}
              title="Gel-Al"
              subtitle="Mağazadan teslim"
              icon="bag-handle-outline"
              onPress={() => setDeliveryType("pickup")}
            />
            <DeliveryTypeCard
              type="delivery"
              selected={deliveryType === "delivery"}
              title="Eve Teslimat"
              subtitle={
                deliveryFee === 0 ? "Ücretsiz" : `+₺${store?.deliveryFee ?? 0}`
              }
              icon="bicycle-outline"
              onPress={() => setDeliveryType("delivery")}
            />
          </View>
        </View>

        {/* Adres seçimi */}
        {deliveryType === "delivery" && (
          <View
            style={[
              styles.section,
              {
                paddingHorizontal: theme.space[4],
                paddingBottom: theme.space[3],
                borderTopColor: theme.colors.borderDefault,
              },
            ]}
          >
            <Text
              style={{
                ...theme.typography.headingSm,
                color: theme.colors.textPrimary,
                marginBottom: theme.space[3],
              }}
            >
              Teslimat Adresi
            </Text>
            {addresses.map((addr) => (
              <Pressable
                key={addr._id}
                onPress={() => setSelectedAddressId(addr._id)}
                style={[
                  styles.addressRow,
                  {
                    borderRadius: theme.radius.md,
                    borderWidth: selectedAddressId === addr._id ? 2 : StyleSheet.hairlineWidth,
                    borderColor:
                      selectedAddressId === addr._id
                        ? theme.market.main
                        : theme.colors.borderDefault,
                    backgroundColor:
                      selectedAddressId === addr._id
                        ? theme.market.light
                        : theme.colors.surfaceAlt,
                    padding: theme.space[3],
                    marginBottom: theme.space[2],
                  },
                ]}
              >
                <Ionicons
                  name={selectedAddressId === addr._id ? "location" : "location-outline"}
                  size={20}
                  color={
                    selectedAddressId === addr._id
                      ? theme.market.main
                      : theme.colors.textSecondary
                  }
                />
                <View style={{ flex: 1, marginLeft: theme.space[2] }}>
                  {addr.title ? (
                    <Text
                      style={{
                        ...theme.typography.labelMd,
                        color:
                          selectedAddressId === addr._id
                            ? theme.market.main
                            : theme.colors.textPrimary,
                      }}
                    >
                      {addr.title}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      ...theme.typography.bodySm,
                      color: theme.colors.textSecondary,
                    }}
                    numberOfLines={2}
                  >
                    {addr.fullAddress}
                  </Text>
                </View>
              </Pressable>
            ))}
            {addresses.length === 0 && (
              <Text
                style={{
                  ...theme.typography.bodyMd,
                  color: theme.colors.textSecondary,
                }}
              >
                Kayıtlı adresiniz yok.
              </Text>
            )}
          </View>
        )}

        {/* Ödeme Yöntemi */}
        <View
          style={[
            styles.section,
            {
              paddingHorizontal: theme.space[4],
              paddingTop: theme.space[4],
              paddingBottom: theme.space[3],
              borderTopColor: theme.colors.borderDefault,
            },
          ]}
        >
          <Text
            style={{
              ...theme.typography.headingSm,
              color: theme.colors.textPrimary,
              marginBottom: theme.space[3],
            }}
          >
            Ödeme Yöntemi
          </Text>
          <View style={{ flexDirection: "row", gap: theme.space[2] }}>
            <PaymentMethodCard
              method="cash"
              selected={paymentMethod === "cash"}
              title="Nakit"
              subtitle="Kapıda öde"
              icon="cash-outline"
              onPress={() => setPaymentMethod("cash")}
            />
            <PaymentMethodCard
              method="card"
              selected={paymentMethod === "card"}
              title="Kredi Kartı"
              subtitle="Kapıda POS"
              icon="card-outline"
              onPress={() => setPaymentMethod("card")}
            />
            <PaymentMethodCard
              method="online"
              selected={paymentMethod === "online"}
              title="Online"
              subtitle="Şimdi öde"
              icon="phone-portrait-outline"
              onPress={() => setPaymentMethod("online")}
            />
          </View>
        </View>

        {/* Min sipariş uyarısı */}
        {belowMin && (
          <View
            style={{
              marginHorizontal: theme.space[4],
              marginBottom: theme.space[3],
            }}
          >
            <Badge
              variant="warning"
              label={`Min sipariş ₺${store!.minOrderAmount} — ₺${(store!.minOrderAmount - subtotal).toFixed(2)} daha ekleyin`}
              dot
            />
          </View>
        )}

        {/* Fiyat özeti */}
        <View
          style={[
            styles.section,
            {
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[4],
              borderTopColor: theme.colors.borderDefault,
              gap: theme.space[2],
            },
          ]}
        >
          <Text
            style={{
              ...theme.typography.headingSm,
              color: theme.colors.textPrimary,
              marginBottom: theme.space[1],
            }}
          >
            Sipariş Özeti
          </Text>

          <View style={styles.summaryRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Ara toplam
            </Text>
            <PriceTag amount={subtotal} size="sm" />
          </View>

          <View style={styles.summaryRow}>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}>
              Teslimat ücreti
            </Text>
            {deliveryFee === 0 ? (
              <Badge variant="market" size="sm" label="Ücretsiz" />
            ) : (
              <PriceTag amount={deliveryFee} size="sm" />
            )}
          </View>

          <View
            style={[
              styles.summaryRow,
              {
                paddingTop: theme.space[2],
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.borderDefault,
                marginTop: theme.space[1],
              },
            ]}
          >
            <Text style={{ ...theme.typography.headingSm, color: theme.colors.textPrimary }}>
              Toplam
            </Text>
            <PriceTag amount={total} size="md" color={theme.market.main} />
          </View>
        </View>
      </ScrollView>

      {/* Ödeme butonu */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.space[4],
            paddingBottom: insets.bottom + theme.space[4],
            paddingTop: theme.space[3],
            borderTopColor: theme.colors.borderDefault,
            ...theme.getElevation(2),
          },
        ]}
      >
        <Button
          fullWidth
          size="lg"
          disabled={belowMin || submitting || stripeBusy}
          onPress={handleOrder}
          style={{ backgroundColor: theme.market.main }}
        >
          {submitting || stripeBusy ? (
            <ActivityIndicator color={theme.colors.textInverse} />
          ) : (
            `${paymentMethod === "online" ? "Öde ve Siparişi Ver" : "Siparişi Ver"} · ₺${total.toFixed(2)}`
          )}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  photo: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qtyRow: { flexDirection: "row", alignItems: "center" },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  deliveryCard: { alignItems: "center" },
  section: { borderTopWidth: StyleSheet.hairlineWidth },
  addressRow: { flexDirection: "row", alignItems: "flex-start" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
});

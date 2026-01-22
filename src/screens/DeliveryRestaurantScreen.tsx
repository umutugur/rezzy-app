import React from "react";
import {
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "../components/Themed";
import { useI18n } from "../i18n";

import { getDeliveryRestaurant, getDeliveryMenu } from "../api/delivery";
import type { DeliveryRestaurant, MenuItem } from "../delivery/deliveryTypes";

import { useCart } from "../store/useCart";
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
import {
  currencySymbolFromRegion,
  formatMoney,
  pickDeliveryMeta,
} from "../delivery/deliveryUtils";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";
import ModifierPickerModal, {
  type ModifierGroup,
  type ModifierSelection,
} from "../components/ModifierPickerModal";

type ItemsByCat = Record<string, MenuItem[]>;

type MenuCategoryVM = {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isActive: boolean;
};

function normalizeModifierSelections(input: any): ModifierSelection[] {
  const arr: any[] = Array.isArray(input) ? input : [];
  return arr
    .map((x) => ({
      groupId: String(x?.groupId || "").trim(),
      optionIds: Array.isArray(x?.optionIds)
        ? x.optionIds
            .map((o: any) => String(o).trim())
            .filter(Boolean)
        : [],
    }))
    .filter((x) => x.groupId && x.optionIds.length > 0)
    .map((x) => ({
      groupId: x.groupId,
      optionIds: Array.from(new Set<string>(x.optionIds)).sort(),
    }));
}

export default function DeliveryRestaurantScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useI18n();

  // IMPORTANT: `t` fonksiyonunun identity'si render'larda değişebiliyor.
  // Bu da `load` callback'ini değiştirip effect'i tekrar tekrar çalıştırabiliyor.
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);

  const safeT = React.useCallback(
    (key: string, opts?: any) => {
      try {
        return (tRef.current as any)?.(key, opts) ?? (opts?.defaultValue ?? key);
      } catch {
        return opts?.defaultValue ?? key;
      }
    },
    []
  );

  const restaurantId: string = String(
    route?.params?.restaurantId || route?.params?.id || ""
  );

  const [loading, setLoading] = React.useState(true);
  const [r, setR] = React.useState<DeliveryRestaurant | null>(null);
  const [cats, setCats] = React.useState<MenuCategoryVM[]>([]);
  const [itemsByCat, setItemsByCat] = React.useState<ItemsByCat>({});
  const [expandedCatId, setExpandedCatId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // -----------------------------
  // Modifiers (picker modal)
  // -----------------------------
  const [modifierGroupsById, setModifierGroupsById] = React.useState<Record<string, ModifierGroup>>({});
  const [pickerVisible, setPickerVisible] = React.useState(false);
  const [pickerItem, setPickerItem] = React.useState<MenuItem | null>(null);
  const [pickerGroups, setPickerGroups] = React.useState<ModifierGroup[]>([]);

  const closePicker = React.useCallback(() => {
    setPickerVisible(false);
    setPickerItem(null);
    setPickerGroups([]);
  }, []);

  // ✅ Cart (senin gerçek store API)
  const cartRestaurantId = useCart((s) => s.restaurantId);
  const cartItems = useCart((s) => s.items);

  const setCartRestaurant = useCart((s) => s.setRestaurant);
  const addItem = useCart((s) => s.addItem);
  const decItem = useCart((s) => s.decItem);
  const clearCart = useCart((s) => s.clear);

  const cartCount = useCart((s) => s.count());
  const cartSubtotal = useCart((s) => s.subtotal());
  const cartCurrency = useCart((s) => s.currencySymbol);

  // ✅ itemsById derived (screen bunu istiyor)
  const itemsById = React.useMemo(() => {
    const map: Record<string, { qty: number }> = {};
    for (const it of (cartItems as any[] | undefined) || []) {
      const k = String((it as any)?.itemId || "");
      if (!k) continue;
      map[k] = { qty: (map[k]?.qty || 0) + Number((it as any)?.qty || 0) };
    }
    return map;
  }, [cartItems]);

  const currencySymbol = React.useMemo(() => {
    return currencySymbolFromRegion(r?.region) || cartCurrency || "₺";
  }, [r?.region, cartCurrency]);

  const ensureCartRestaurant = React.useCallback(
    async (targetRestaurantId: string, targetRestaurantName: string) => {
      // aynı restoransa sorun yok
      if (!cartRestaurantId || cartRestaurantId === targetRestaurantId) {
        setCartRestaurant?.({
          restaurantId: targetRestaurantId,
          restaurantName: targetRestaurantName,
          currencySymbol: currencySymbol,
        });
        return true;
      }

      // farklı restoran -> sepeti sıfırlamak zorunlu
      return await new Promise<boolean>((resolve) => {
        Alert.alert(
          safeT("delivery.cartDifferentRestaurantTitle", {
            defaultValue: "Sepetiniz dolu",
          }),
          safeT("delivery.cartDifferentRestaurantBody2", {
            defaultValue:
              "Sepet başka bir restorana ait. Devam ederseniz sepet sıfırlanacak.",
          }),
          [
            {
              text: safeT("common.cancel", { defaultValue: "Vazgeç" }),
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: safeT("common.continue", { defaultValue: "Devam" }),
              style: "destructive",
              onPress: () => {
                clearCart?.();
                setCartRestaurant?.({
                  restaurantId: targetRestaurantId,
                  restaurantName: targetRestaurantName,
                  currencySymbol: currencySymbol,
                });
                resolve(true);
              },
            },
          ]
        );
      });
    },
    [cartRestaurantId, setCartRestaurant, clearCart, currencySymbol, safeT]
  );

  const inflightRef = React.useRef(false);
  const lastSigRef = React.useRef<string>("");

  const load = React.useCallback(async () => {
    if (!restaurantId) return;

    const sig = String(restaurantId);
    if (inflightRef.current && lastSigRef.current === sig) return;

    inflightRef.current = true;
    lastSigRef.current = sig;

    setLoading(true);
    setError(null);

    try {
      const rr = await getDeliveryRestaurant(restaurantId);
      setR(rr);

      const menu = await getDeliveryMenu(restaurantId);

      // ---- modifiers (best-effort parse; backend farklı shape dönebilir)
      const mgById: Record<string, ModifierGroup> = {};

      const rawGroups1: any[] = Array.isArray((menu as any)?.modifierGroups)
        ? (menu as any).modifierGroups
        : [];

      const rawGroups2: any[] = Array.isArray((menu as any)?.modifiers?.groups)
        ? (menu as any).modifiers.groups
        : [];

      const rawGroups = rawGroups1.length ? rawGroups1 : rawGroups2;

      for (const g of rawGroups) {
        const gId = String(g?._id || g?.id || "");
        if (!gId) continue;

        mgById[gId] = {
          _id: gId,
          title: String(g?.title || ""),
          description: g?.description ?? null,
          minSelect: Number(g?.minSelect ?? 0) || 0,
          maxSelect: Number(g?.maxSelect ?? 1) || 1,
          order: Number(g?.order ?? 0) || 0,
          isActive: Boolean(g?.isActive ?? true),
          options: Array.isArray(g?.options)
            ? g.options.map((o: any) => ({
                _id: String(o?._id || o?.id || ""),
                title: String(o?.title || ""),
                price: Number(o?.price ?? 0) || 0,
                order: Number(o?.order ?? 0) || 0,
                isActive: Boolean(o?.isActive ?? true),
              }))
            : [],
        } as any;
      }

      setModifierGroupsById(mgById);

      // normalize
      const categories: any[] = Array.isArray((menu as any)?.categories)
        ? (menu as any).categories
        : [];

      const nextCats: MenuCategoryVM[] = categories
        .filter((c) => (c?.isActive ?? true) && String(c?._id || c?.id))
        .map((c) => ({
          _id: String(c._id || c.id),
          title: String(c.title || ""),
          description: c.description ?? undefined,
          order: Number(c.order ?? 0),
          isActive: Boolean(c.isActive ?? true),
        }))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

      const byCat: ItemsByCat = {};
      for (const c of nextCats) {
        const rawItems = Array.isArray((menu as any)?.itemsByCategory?.[c._id])
          ? (menu as any).itemsByCategory[c._id]
          : Array.isArray((menu as any)?.items)
          ? (menu as any).items.filter(
              (x: any) => String(x.categoryId) === c._id
            )
          : Array.isArray(
              (menu as any)?.categories?.find(
                (x: any) => String(x._id || x.id) === c._id
              )?.items
            )
          ? (menu as any).categories.find(
              (x: any) => String(x._id || x.id) === c._id
            ).items
          : [];

        const items = rawItems
          .filter(
            (it: any) => (it?.isActive ?? true) && String(it?._id || it?.id)
          )
          .map((it: any) => ({
            _id: String(it._id || it.id),
            title: String(it.title || ""),
            description: it.description ?? undefined,
            price: Number(it.price) || 0,
            photoUrl: it.photoUrl ?? it.photo ?? undefined,
            tags: Array.isArray(it.tags) ? it.tags : [],
            modifierGroupIds: Array.isArray(it.modifierGroupIds) ? it.modifierGroupIds : [],
            isAvailable: it.isAvailable ?? true,
            isActive: it.isActive ?? true,
            order: it.order ?? 0,
          }))
          .sort(
            (a: any, b: any) => Number(a.order || 0) - Number(b.order || 0)
          );

        byCat[c._id] = items;
      }

      setCats(nextCats);
      setItemsByCat(byCat);
      setExpandedCatId(nextCats[0]?._id ?? null);
    } catch (e: any) {
      const raw = e?.response?.data;
      setError(
        raw?.message ||
          e?.message ||
          safeT("common.error", { defaultValue: "Bir hata oluştu" })
      );
      setCats([]);
      setItemsByCat({});
      setExpandedCatId(null);
      setR(null);
    } finally {
      inflightRef.current = false;
      setLoading(false);
    }
  }, [restaurantId, safeT]);

  React.useEffect(() => {
    load();
  }, [load]);

  const preview: DeliveryRestaurant | null = route?.params?.restaurantPreview ?? null;
  const metaSrc = preview ?? r;

  const meta = React.useMemo(() => {
    return metaSrc ? pickDeliveryMeta(metaSrc) : null;
  }, [metaSrc]);

  const onAdd = React.useCallback(
    async (it: MenuItem) => {
      if (!r) return;

      const ok = await ensureCartRestaurant(String(r._id), String(r.name || ""));
      if (!ok) return;

      const mgIds: string[] = Array.isArray((it as any)?.modifierGroupIds)
        ? (it as any).modifierGroupIds.map((x: any) => String(x)).filter(Boolean)
        : [];

      const groups: ModifierGroup[] = mgIds
        .map((id) => modifierGroupsById[String(id)])
        .filter(Boolean);

      // Item modifiers var ama grup detayları menü payload'ında yoksa
      // opsiyonsuz sepete ekleyip checkout'ta "min not met" patlatmayalım.
      if (mgIds.length > 0 && groups.length === 0) {
        Alert.alert(
          safeT("common.error", { defaultValue: "Hata" }),
          safeT("delivery.modifiersMissing", {
            defaultValue:
              "Bu ürün için opsiyonlar yüklenemedi. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.",
          })
        );
        return;
      }

      if (groups.length > 0) {
        setPickerItem(it);
        setPickerGroups(groups);
        setPickerVisible(true);
        return;
      }

      addItem?.(
        {
          itemId: String((it as any)._id),
          title: (it as any).title,
          price: Number((it as any).price) || 0,
          photoUrl: (it as any).photoUrl,
        } as any,
        1
      );
    },
    [r, ensureCartRestaurant, addItem, modifierGroupsById]
  );

  const onRemove = React.useCallback(
    (it: MenuItem) => {
      decItem?.(String(it._id));
    },
    [decItem]
  );

  const onConfirmModifiers = React.useCallback(
    (payload: { selections: any; unitPrice: number; summary: string | null }) => {
      if (!pickerItem) {
        closePicker();
        return;
      }

      addItem?.(
        {
          itemId: String((pickerItem as any)._id),
          title: (pickerItem as any).title,
          price: Number((pickerItem as any).price) || 0,
          photoUrl: (pickerItem as any).photoUrl,
          modifierSelections: normalizeModifierSelections(payload.selections),
          unitPrice: payload.unitPrice,
          note: payload.summary,
        } as any,
        1
      );

      closePicker();
    },
    [pickerItem, addItem, closePicker]
  );

  const bottomBarVisible = cartCount > 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text secondary style={styles.centerHint}>
          {safeT("delivery.loadingRestaurant", {
            defaultValue: "Restoran yükleniyor…",
          })}
        </Text>
      </View>
    );
  }

  if (!r) {
    return (
      <View style={[styles.center, { padding: 24, gap: 10 }]}>
        <Ionicons name="storefront-outline" size={44} color={DeliveryColors.muted} />
        <Text style={styles.emptyTitle}>
          {safeT("delivery.restaurantNotFound", { defaultValue: "Restoran bulunamadı" })}
        </Text>
        {!!error && <Text secondary style={{ textAlign: "center" }}>{error}</Text>}
        <Pressable onPress={() => nav.goBack()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {safeT("common.back", { defaultValue: "Geri" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  const hero = r.photos?.[0] || null;
  const symbol = cartCurrency || currencySymbol;

  return (
    <View style={styles.root}>
      <ModifierPickerModal
        visible={pickerVisible}
        itemTitle={pickerItem ? String((pickerItem as any).title || "") : ""}
        basePrice={pickerItem ? Number((pickerItem as any).price) || 0 : 0}
        currencySymbol={currencySymbol}
        groups={pickerGroups}
        onClose={closePicker}
        onConfirm={onConfirmModifiers}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            (bottomBarVisible ? 98 : 20) + (Platform.OS === "ios" ? 10 : 0),
        }}
      >
        {/* Hero */}
        <View style={styles.heroWrap}>
          {hero ? (
            <Image source={{ uri: hero }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="image-outline" size={40} color={DeliveryColors.muted} />
            </View>
          )}

          <Pressable onPress={() => nav.goBack()} style={[styles.backBtn, DeliveryShadow.floating]}>
            <Ionicons name="arrow-back" size={20} color={DeliveryColors.text} />
          </Pressable>

          {/* subtle overlay */}
          <View pointerEvents="none" style={styles.heroOverlay} />
        </View>

        {/* Header Card */}
        <Card style={{ marginTop: -22 }}>
          <Text style={styles.h1}>{r.name}</Text>

          {!!r.address && (
            <View style={styles.rowTop}>
              <Ionicons name="location-outline" size={16} color={DeliveryColors.muted} />
              <Text style={styles.addressText}>{r.address}</Text>
            </View>
          )}

          <View style={styles.chipsRow}>
            <Chip icon="time-outline" text={meta?.etaText || "—"} />
            <Chip
              icon="cash-outline"
              text={
                typeof meta?.minOrder === "number"
                  ? `${safeT("delivery.minBasket", { defaultValue: "Min" })} ${formatMoney(
                      meta.minOrder,
                      currencySymbol
                    )}`
                  : `${safeT("delivery.minBasket", { defaultValue: "Min" })} —`
              }
            />
            <Chip icon="navigate-outline" text={meta?.distanceText || "—"} />

            {typeof meta?.deliveryFee === "number" && (
              <Chip
                icon="bicycle-outline"
                text={formatMoney(meta.deliveryFee, currencySymbol)}
              />
            )}
          </View>
        </Card>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {safeT("delivery.menuTitle", { defaultValue: "Menü" })}
          </Text>

          {cats.length === 0 ? (
            <Card style={{ alignItems: "center", gap: 8 }}>
              <Ionicons name="list-outline" size={34} color={DeliveryColors.muted} />
              <Text style={styles.emptyTitle}>
                {safeT("delivery.noMenu", { defaultValue: "Menü bulunamadı" })}
              </Text>
              {!!error && <Text secondary style={{ textAlign: "center" }}>{error}</Text>}
            </Card>
          ) : (
            <View style={{ gap: 12 }}>
              {cats.map((c) => {
                const open = expandedCatId === c._id;
                const items = itemsByCat[c._id] || [];
                return (
                  <View key={c._id} style={styles.catWrap}>
                    <Pressable
                      onPress={() => setExpandedCatId(open ? null : c._id)}
                      style={({ pressed }) => [
                        styles.catHeader,
                        pressed ? { opacity: 0.92 } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catTitle}>{c.title}</Text>
                        {!!c.description && (
                          <Text secondary style={styles.catDesc} numberOfLines={2}>
                            {c.description}
                          </Text>
                        )}
                      </View>

                      <View style={styles.catCountPill}>
                        <Text style={styles.catCountText}>{items.length}</Text>
                        <Ionicons
                          name={open ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={DeliveryColors.primary}
                        />
                      </View>
                    </Pressable>

                    {open && (
                      <View style={styles.catBody}>
                        {items.length === 0 ? (
                          <Text secondary>
                            {safeT("delivery.emptyCategory", { defaultValue: "Bu kategoride ürün yok." })}
                          </Text>
                        ) : (
                          items.map((it) => {
                            const qty = Number(itemsById?.[String(it._id)]?.qty || 0);
                            const disabled = it.isAvailable === false;

                            return (
                              <Pressable
                                key={it._id}
                                onPress={() => {
                                  if (disabled) return;
                                  onAdd(it);
                                }}
                                style={({ pressed }) => [
                                  styles.itemRow,
                                  pressed && !disabled ? { transform: [{ scale: 0.995 }] } : null,
                                  disabled ? { opacity: 0.55 } : null,
                                ]}
                              >
                                {/* Photo */}
                                {it.photoUrl ? (
                                  <Image
                                    source={{ uri: it.photoUrl }}
                                    style={styles.itemPhoto}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={styles.itemPhotoFallback}>
                                    <Ionicons
                                      name="fast-food-outline"
                                      size={22}
                                      color={DeliveryColors.primary}
                                    />
                                  </View>
                                )}

                                {/* Info */}
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={styles.itemTitle}>{it.title}</Text>

                                  {!!it.description && (
                                    <Text secondary numberOfLines={2} style={styles.itemDesc}>
                                      {it.description}
                                    </Text>
                                  )}

                                  {!!it.tags?.length && (
                                    <View style={styles.tagsRow}>
                                      {it.tags.slice(0, 3).map((tg, idx) => (
                                        <View key={`${it._id}-tg-${idx}`} style={styles.tagChip}>
                                          <Text style={styles.tagText}>#{tg}</Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>

                                {/* Price + qty controls */}
                                <View style={{ alignItems: "flex-end", gap: 8 }}>
                                  <Text style={styles.itemPrice}>
                                    {formatMoney(it.price, currencySymbol)}
                                  </Text>

                                  {disabled ? (
                                    <Text style={styles.stockText}>
                                      {safeT("delivery.notAvailable", { defaultValue: "Stok yok" })}
                                    </Text>
                                  ) : (
                                    <View style={styles.qtyRow}>
                                      <Pressable
                                        onPress={() => onRemove(it)}
                                        disabled={qty <= 0}
                                        style={[
                                          styles.qtyBtn,
                                          qty <= 0 ? { opacity: 0.45 } : null,
                                        ]}
                                      >
                                        <Ionicons name="remove" size={18} color={DeliveryColors.text} />
                                      </Pressable>

                                      <Text style={styles.qtyText}>{qty}</Text>

                                      <Pressable
                                        onPress={() => onAdd(it)}
                                        style={[styles.qtyBtn, styles.qtyBtnPrimary]}
                                      >
                                        <Ionicons name="add" size={18} color="#fff" />
                                      </Pressable>
                                    </View>
                                  )}
                                </View>
                              </Pressable>
                            );
                          })
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom subtotal bar */}
      {bottomBarVisible && (
        <Pressable
          onPress={() => nav.navigate(DeliveryRoutes.Cart, { restaurantPreview: metaSrc })}
          style={[styles.bottomBar, DeliveryShadow.floating]}
        >
          <View style={styles.bottomLeft}>
            <View style={styles.countBubble}>
              <Text style={styles.countBubbleText}>{cartCount}</Text>
            </View>

            <View>
              <Text style={styles.bottomTitle}>
                {safeT("delivery.subtotal", { defaultValue: "Ara Toplam" })}
              </Text>
              <Text style={styles.bottomValue}>{formatMoney(cartSubtotal, symbol)}</Text>
            </View>
          </View>

          <View style={styles.bottomRight}>
            <Text style={styles.bottomCta}>
              {safeT("delivery.goCart", { defaultValue: "Sepete Git" })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function Card(props: { children: any; style?: any }) {
  return (
    <View
      style={[
        {
          marginHorizontal: DeliverySpacing.screenX,
          backgroundColor: DeliveryColors.card,
          borderRadius: DeliveryRadii.xl,
          borderWidth: 1,
          borderColor: DeliveryColors.line,
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

function Chip(props: { icon: any; text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={props.icon} size={14} color={DeliveryColors.primary} />
      <Text style={styles.chipText}>{props.text}</Text>
    </View>
  );
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

  heroWrap: { height: 190, backgroundColor: "#F3F4F6" },
  heroImg: { width: "100%", height: "100%" },
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: "rgba(0,0,0,0.08)",
    opacity: 0.15,
  },

  backBtn: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },

  h1: { fontSize: 18, fontWeight: "900", color: DeliveryColors.text },

  rowTop: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  rowCenter: { flexDirection: "row", gap: 8, alignItems: "center" },

  addressText: { flex: 1, color: DeliveryColors.muted, lineHeight: 18, fontSize: 12 },

  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: DeliveryRadii.pill,
    backgroundColor: DeliveryColors.chip,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },
  chipText: { fontSize: 12, fontWeight: "900", color: DeliveryColors.chipText },

  badgeIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },
  badgeText: { fontSize: 12, fontWeight: "900", color: DeliveryColors.text },

  section: { marginTop: 14, paddingHorizontal: DeliverySpacing.screenX, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: DeliveryColors.text },

  catWrap: {
    backgroundColor: DeliveryColors.card,
    borderRadius: DeliveryRadii.xl,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    overflow: "hidden",
  },
  catHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
  },
  catTitle: { fontWeight: "900", color: DeliveryColors.text },
  catDesc: { marginTop: 3 },

  catCountPill: {
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  catCountText: { fontWeight: "900", color: DeliveryColors.primary, fontSize: 12 },

  catBody: { padding: 12, gap: 10 },

  itemRow: {
    flexDirection: "row",
    gap: 10,
    padding: 11,
    borderRadius: DeliveryRadii.lg,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  itemPhoto: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#E5E7EB" },
  itemPhotoFallback: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#F3DADA",
    alignItems: "center",
    justifyContent: "center",
  },

  itemTitle: { fontWeight: "900", color: DeliveryColors.text },
  itemDesc: { fontSize: 12, lineHeight: 16 },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tagChip: {
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: { fontSize: 11, fontWeight: "900", color: DeliveryColors.primary },

  itemPrice: { fontWeight: "900", color: DeliveryColors.primary, fontSize: 15 },
  stockText: { fontSize: 11, fontWeight: "900", color: DeliveryColors.muted },

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
  qtyText: { fontWeight: "900", color: DeliveryColors.text, minWidth: 18, textAlign: "center" },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: DeliveryColors.primary,
    borderRadius: DeliveryRadii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  bottomBar: {
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
  bottomTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  bottomValue: { color: "rgba(255,255,255,0.92)", fontWeight: "900", marginTop: 2 },
  bottomRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  bottomCta: { color: "#fff", fontWeight: "900" },
});
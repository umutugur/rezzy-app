import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  listMyDeliveryOrders,
  getMyDeliveryOrder,
  getDeliveryMenu,
  listDeliveryRestaurants,
  type MyDeliveryOrderDto,
} from "../api/delivery";
import { useCart } from "../store/useCart";
import { useDeliveryAddress } from "../store/useDeliveryAddress";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";

// ✅ TODO: kendi toast fonksiyonunla değiştir
const toast = (msg: string) => {
  // ör: showToast(msg)
  console.log("[toast]", msg);
};

const C = {
  primary: "#7B2C2C",
  bg: "#FAFAFA",
  card: "#FFFFFF",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
  soft: "#FFF5F5",
  green: "#065F46",
  greenBg: "#ECFDF5",
  blue: "#1D4ED8",
  blueBg: "#EFF6FF",
  gray: "#374151",
  grayBg: "#F3F4F6",
  red: "#991B1B",
  redBg: "#FEF2F2",
};

function isActiveStatus(s?: string) {
  return s === "new" || s === "accepted" || s === "on_the_way";
}

function statusLabelTr(s?: string) {
  if (s === "new" || s === "accepted") return "Hazırlanıyor";
  if (s === "on_the_way") return "Yola çıktı";
  if (s === "delivered") return "Teslim edildi";
  if (s === "cancelled") return "İptal edildi";
  return "Bilinmiyor";
}

function statusPillStyle(s?: string) {
  if (s === "on_the_way") return { color: C.blue, bg: C.blueBg, icon: "bicycle-outline" as const };
  if (s === "delivered") return { color: C.green, bg: C.greenBg, icon: "checkmark-circle-outline" as const };
  if (s === "cancelled") return { color: C.red, bg: C.redBg, icon: "close-circle-outline" as const };
  return { color: C.gray, bg: C.grayBg, icon: "time-outline" as const }; // new/accepted/default
}

function orderSummary(o: MyDeliveryOrderDto) {
  const its = Array.isArray(o.items) ? o.items : [];
  if (its.length === 0) return "İçerik bilgisi yok";

  // İlk 2 satırı özetle, kalan sayısını ekle
  const first = its.slice(0, 2).map((x) => {
    const mods =
      (x.selectedModifiers || [])
        .flatMap((g) => (g.options || []).map((op) => op.optionTitle))
        .filter(Boolean);

    const modText = mods.length ? ` (${mods.slice(0, 3).join(", ")}${mods.length > 3 ? "…" : ""})` : "";
    return `${x.qty}× ${x.itemTitle}${modText}`;
  });

  const more = its.length > 2 ? ` +${its.length - 2} ürün` : "";
  return first.join(" • ") + more;
}

function extractRestaurantId(o: MyDeliveryOrderDto) {
  const r: any = (o as any).restaurantId;
  if (r && typeof r === "object") return String(r._id || r.id || "");
  if (typeof r === "string") return String(r);
  return String((o as any).restaurantIdStr || "");
}

function extractRestaurantName(o: MyDeliveryOrderDto) {
  const r: any = (o as any).restaurantId;
  if (r && typeof r === "object") return String(r.name || "");
  return String((o as any).restaurantName || (o as any).restaurant?.name || "");
}

function extractRestaurantLogo(o: MyDeliveryOrderDto) {
  const r: any = (o as any).restaurantId;
  if (r && typeof r === "object") return (r.logoUrl || r.photos?.[0]) as string | undefined;

  // listMyDeliveryOrders (lightweight) response
  return (
    (o as any).restaurantPhoto ||
    (o as any).restaurantLogoUrl ||
    (o as any).restaurant?.logoUrl ||
    (o as any).restaurantPhotoUrl
  ) as string | undefined;
}

function buildMenuItemPhotoById(menu: any): Record<string, { photoUrl?: string; title?: string; price?: number }>
{
  const map: Record<string, { photoUrl?: string; title?: string; price?: number }> = {};

  const push = (it: any) => {
    const id = String(it?._id || it?.id || "").trim();
    if (!id) return;

    const photoUrl =
      (it?.photoUrl ?? it?.photo ?? it?.imageUrl ?? it?.image ?? it?.coverUrl ?? null) as any;

    const title = String(it?.title || "").trim() || undefined;
    const price = typeof it?.price === "number" ? it.price : Number(it?.price ?? NaN);

    map[id] = {
      photoUrl: photoUrl ? String(photoUrl) : map[id]?.photoUrl,
      title: title ?? map[id]?.title,
      price: Number.isFinite(price) ? price : map[id]?.price,
    };
  };

  // common shapes
  const items1: any[] = Array.isArray(menu?.items) ? menu.items : [];
  items1.forEach(push);

  const byCat = menu?.itemsByCategory;
  if (byCat && typeof byCat === "object") {
    Object.keys(byCat).forEach((k) => {
      const arr: any[] = Array.isArray(byCat[k]) ? byCat[k] : [];
      arr.forEach(push);
    });
  }

  const cats: any[] = Array.isArray(menu?.categories) ? menu.categories : [];
  cats.forEach((c) => {
    const arr: any[] = Array.isArray(c?.items) ? c.items : [];
    arr.forEach(push);
  });

  return map;
}

function extractOrderItemPhoto(it: any): string | null {
  const v =
    it?.photoUrl ??
    it?.itemPhotoUrl ??
    it?.itemPhoto ??
    it?.imageUrl ??
    it?.image ??
    it?.coverUrl ??
    null;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export default function MyOrdersScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const selectedAddressId = useDeliveryAddress((s: any) => s.selectedAddressId);

  const [restaurants, setRestaurants] = React.useState<any[]>([]);

  const loadRestaurants = React.useCallback(async () => {
    const aid = String(selectedAddressId || "");
    if (!aid) {
      setRestaurants([]);
      return;
    }

    try {
      const resp: any = await listDeliveryRestaurants({ addressId: aid });
      const list: any[] = Array.isArray(resp?.items) ? resp.items : [];
      setRestaurants(list);
    } catch {
      setRestaurants([]);
    }
  }, [selectedAddressId]);

  React.useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  const findRestaurantPreview = React.useCallback(
    (restaurantId: string) => {
      const rid = String(restaurantId || "");
      if (!rid) return null;
      return (
        (restaurants || []).find((x: any) => String(x?._id || x?.id || "") === rid) || null
      );
    },
    [restaurants]
  );

  const goRestaurant = React.useCallback(
    (rid: string) => {
      const id = String(rid || "");
      if (!id) return;

      const preview = findRestaurantPreview(id);

      nav.navigate("Delivery", {
        screen: DeliveryRoutes.DeliveryRestaurant,
        params: { restaurantId: id, restaurantPreview: preview || undefined },
      });
    },
    [nav, findRestaurantPreview]
  );

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [items, setItems] = React.useState<MyDeliveryOrderDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    setError(null);
    const list = await listMyDeliveryOrders();

    // ✅ Aktif siparişler üstte, sonra tarihe göre (backend zaten sort yapıyor olabilir ama UI garanti eder)
    const sorted = (list || []).slice().sort((a, b) => {
      const aa = isActiveStatus(a.status) ? 0 : 1;
      const bb = isActiveStatus(b.status) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setItems(sorted);
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await fetchList();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "Siparişler yüklenemedi");
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchList]);

  const onRefresh = React.useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchList(), loadRestaurants()]);
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || "Yenileme başarısız");
    } finally {
      setRefreshing(false);
    }
  }, [fetchList, loadRestaurants]);

  const repeatOrder = React.useCallback(
    async (o: MyDeliveryOrderDto) => {
      const rid = extractRestaurantId(o);
      const rname = extractRestaurantName(o);

      if (!rid) {
        toast("Restoran bilgisi eksik olduğu için sipariş tekrarlanamadı.");
        return;
      }

      // ✅ list endpoint lightweight döndüğü için (items yok). Detayı çek.
      let orderItems: any[] = [];
      try {
        const detail: any = await getMyDeliveryOrder(String(o._id));
        const full = detail?.order;
        orderItems = Array.isArray(full?.items) ? full.items : [];
      } catch (e: any) {
        toast(e?.response?.data?.message || e?.message || "Sipariş detayı alınamadı.");
        return;
      }

      if (orderItems.length === 0) {
        toast("Sipariş içeriği yok.");
        return;
      }

      // ✅ Restoran değişirse sepet reset
      cart.setRestaurant({
        restaurantId: rid,
        restaurantName: rname,
        currencySymbol: "₺",
        resetIfDifferent: true,
      });

      // ✅ Menüden foto/title/price lookup (sipariş detayı bazı alanları eksik dönebiliyor)
      let menuLookup: Record<string, { photoUrl?: string; title?: string; price?: number }> = {};
      try {
        const menu: any = await getDeliveryMenu(String(rid));
        menuLookup = buildMenuItemPhotoById(menu);
      } catch {
        menuLookup = {};
      }

      // ✅ Aynı sepeti oluştur
      for (const it of orderItems) {
        const itemId = String(it.itemId || "").trim();
        const fallback = itemId ? menuLookup[itemId] : undefined;

        const modifierSelections =
          (it.selectedModifiers || [])
            .map((g: any) => ({
              groupId: String(g.groupId),
              optionIds: (g.options || []).map((op: any) => String(op.optionId)),
            }))
            .filter((x: any) => x.groupId && x.optionIds.length > 0);

        const photoUrl = extractOrderItemPhoto(it) || (fallback?.photoUrl ? String(fallback.photoUrl) : null);
        const title = String(it.itemTitle || "").trim() || (fallback?.title ? String(fallback.title) : "");
        const price = Number(it.basePrice ?? fallback?.price ?? 0) || 0;

        cart.addItem(
          {
            itemId,
            title,
            price,
            photoUrl,
            note: it.note || "",
            modifierSelections,
            unitPrice: Number(it.unitTotal ?? it.basePrice ?? price ?? 0) || 0,
          } as any,
          Number(it.qty || 1)
        );
      }

      toast("Sipariş sepete eklendi.");

      // ✅ Kullanıcıyı Delivery akışına geri götür
      goRestaurant(rid);
    },
    [cart, nav, goRestaurant]
  );

  const renderItem = ({ item }: { item: MyDeliveryOrderDto }) => {
    const active = isActiveStatus(item.status);
    const pill = statusPillStyle(item.status);
    const rid = extractRestaurantId(item);
    const name = extractRestaurantName(item) || "Restoran";
    const logo = extractRestaurantLogo(item);
    const summary = String((item as any).itemsPreview || "").trim() || orderSummary(item);
    const total = Math.round(Number(item.total || 0));
    const dateText = new Date(item.createdAt).toLocaleString("tr-TR");

    return (
      <View style={[styles.card, active && styles.cardActive]}>
        <View style={styles.rowTop}>
          <View style={styles.logoWrap}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logo} />
            ) : (
              <View style={styles.logoPh}>
                <Ionicons name="storefront-outline" size={18} color={C.primary} />
              </View>
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Pressable
              onPress={() => {
                if (!rid) return;
                goRestaurant(rid);
              }}
              hitSlop={10}
              style={{ alignSelf: "flex-start" }}
            >
              <Text style={styles.title} numberOfLines={1}>{name}</Text>
            </Pressable>
            <Text style={styles.meta} numberOfLines={1}>{dateText}</Text>
          </View>

          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Ionicons name={pill.icon} size={14} color={pill.color} />
            <Text style={[styles.pillText, { color: pill.color }]}>{statusLabelTr(item.status)}</Text>
          </View>
        </View>

        <Text style={styles.summary} numberOfLines={3}>{summary}</Text>

        <View style={styles.bottomRow}>
          <Text style={styles.total}>{isFinite(total) ? `${total} ₺` : "-"}</Text>

          <Pressable style={styles.repeatBtn} onPress={() => repeatOrder(item)}>
            <Ionicons name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.repeatText}>Siparişi Tekrarla</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Siparişlerim</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
          <Text style={{ marginTop: 8, color: C.muted, fontWeight: "700" }}>Yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: C.red, fontWeight: "800", textAlign: "center" }}>{error}</Text>
          <Pressable style={[styles.repeatBtn, { marginTop: 12 }]} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.repeatText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bag-handle-outline" size={34} color={C.muted} />
          <Text style={{ marginTop: 10, color: C.muted, fontWeight: "800" }}>
            Henüz paket servis siparişin yok.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x._id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: C.text,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: "#E9B9B9",
    backgroundColor: C.soft,
  },

  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoWrap: { width: 46, height: 46, borderRadius: 12, overflow: "hidden", backgroundColor: "#F3F4F6" },
  logo: { width: "100%", height: "100%" },
  logoPh: { flex: 1, alignItems: "center", justifyContent: "center" },

  title: { fontSize: 15, fontWeight: "900", color: C.text },
  meta: { marginTop: 2, fontSize: 12, color: C.muted, fontWeight: "700" },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontWeight: "900" },

  summary: {
    marginTop: 10,
    color: C.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  bottomRow: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  total: { fontSize: 16, fontWeight: "900", color: C.primary },

  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  repeatText: { color: "#fff", fontWeight: "900", fontSize: 13 },
});
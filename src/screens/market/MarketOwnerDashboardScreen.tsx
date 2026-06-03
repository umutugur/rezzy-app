// src/screens/market/MarketOwnerDashboardScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../contexts/ThemeContext";
import { Badge, EmptyState, Skeleton } from "../../components/ui";
import {
  getPanelOrders,
  updateOrderStatus,
  getPanelProducts,
  createPanelProduct,
  updatePanelProduct,
  deletePanelProduct,
  type MarketOrder,
  type MarketOrderStatus,
  type PanelProduct,
} from "../../api/market.api";

// ─── Status config ─────────────────────────────────────────────────────────────

type BadgeVariant = "neutral" | "warning" | "info" | "market" | "success" | "error";

type StatusConfig = {
  label: string;
  variant: BadgeVariant;
};

const STATUS_CONFIG: Record<MarketOrderStatus, StatusConfig> = {
  pending:   { label: "Beklemede",     variant: "warning" },
  confirmed: { label: "Onaylandı",     variant: "info"    },
  preparing: { label: "Hazırlanıyor",  variant: "info"    },
  ready:     { label: "Hazır",         variant: "market"  },
  delivered: { label: "Teslim Edildi", variant: "success" },
  cancelled: { label: "İptal",         variant: "error"   },
};

// Next status transitions for the owner
const NEXT_STATUS: Partial<Record<MarketOrderStatus, MarketOrderStatus>> = {
  pending:   "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
};

const NEXT_STATUS_LABEL: Partial<Record<MarketOrderStatus, string>> = {
  pending:   "Onayla",
  confirmed: "Hazırlamaya Başla",
  preparing: "Hazır",
  ready:     "Teslim Edildi",
};

// ─── Filter tabs ───────────────────────────────────────────────────────────────

type FilterKey = "active" | "ready" | "delivered" | "cancelled";

const FILTERS: { key: FilterKey; label: string; statuses: MarketOrderStatus[] }[] = [
  { key: "active",    label: "Aktif",          statuses: ["pending", "confirmed", "preparing"] },
  { key: "ready",     label: "Hazır",          statuses: ["ready"] },
  { key: "delivered", label: "Teslim Edildi",  statuses: ["delivered"] },
  { key: "cancelled", label: "İptal",          statuses: ["cancelled"] },
];

// ─── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onStatusUpdate,
  onShowConfirm,
}: {
  order: MarketOrder;
  onStatusUpdate: (orderId: string, status: MarketOrderStatus) => Promise<void>;
  onShowConfirm: (modal: ConfirmModalState) => void;
}) {
  const theme = useTheme();
  const [updating, setUpdating] = useState(false);

  const cfg = STATUS_CONFIG[order.status];
  const nextStatus = NEXT_STATUS[order.status];
  const nextLabel = NEXT_STATUS_LABEL[order.status];

  const createdDate = new Date(order.createdAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const createdDay = new Date(order.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });

  const handleNext = async () => {
    if (!nextStatus) return;
    onShowConfirm({
      title: "Durum Güncelle",
      message: `Siparişi "${STATUS_CONFIG[nextStatus].label}" olarak işaretle?`,
      confirmLabel: nextLabel ?? "Güncelle",
      onConfirm: async () => {
        setUpdating(true);
        try {
          await onStatusUpdate(order._id, nextStatus);
        } finally {
          setUpdating(false);
        }
      },
    });
  };

  const handleCancel = () => {
    if (order.status === "delivered" || order.status === "cancelled") return;
    onShowConfirm({
      title: "İptal Et",
      message: "Bu siparişi iptal etmek istediğinizden emin misiniz?",
      confirmLabel: "İptal Et",
      destructive: true,
      onConfirm: async () => {
        setUpdating(true);
        try {
          await onStatusUpdate(order._id, "cancelled");
        } finally {
          setUpdating(false);
        }
      },
    });
  };

  return (
    <View
      style={[
        styles.orderCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.borderDefault,
          marginBottom: theme.space[3],
          ...theme.getElevation(1),
        },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.cardHeader,
          {
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[3],
            borderBottomColor: theme.colors.borderDefault,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }}>
            #{order._id.slice(-6).toUpperCase()}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 }}>
            {createdDay} {createdDate}
          </Text>
        </View>
        <Badge variant={cfg.variant} label={cfg.label} size="sm" />
      </View>

      {/* Ürün özeti */}
      <View
        style={{
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
          gap: theme.space[1],
        }}
      >
        {order.items.slice(0, 3).map((item, idx) => (
          <Text
            key={`${item.productId}_${idx}`}
            style={{ ...theme.typography.bodySm, color: theme.colors.textSecondary }}
            numberOfLines={1}
          >
            {item.qty}x {item.title}
          </Text>
        ))}
        {order.items.length > 3 && (
          <Text style={{ ...theme.typography.caption, color: theme.colors.textTertiary }}>
            +{order.items.length - 3} ürün daha
          </Text>
        )}
      </View>

      {/* Footer: toplam + actions */}
      <View
        style={[
          styles.cardFooter,
          {
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[3],
            borderTopColor: theme.colors.borderDefault,
            gap: theme.space[2],
          },
        ]}
      >
        <View style={styles.row}>
          <Badge
            variant="neutral"
            size="sm"
            label={order.type === "pickup" ? "Gel-Al" : "Teslimat"}
          />
          <Text
            style={{
              ...theme.typography.headingSm,
              color: theme.market.main,
              marginLeft: "auto",
            }}
          >
            ₺{order.total.toFixed(2)}
          </Text>
        </View>

        {/* Action buttons */}
        {updating ? (
          <ActivityIndicator color={theme.market.main} style={{ alignSelf: "center", marginTop: theme.space[1] }} />
        ) : (
          <View style={[styles.row, { gap: theme.space[2] }]}>
            {/* Cancel button — only shown for non-terminal orders */}
            {order.status !== "delivered" && order.status !== "cancelled" && (
              <Pressable
                onPress={handleCancel}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: theme.colors.error,
                    backgroundColor: theme.colors.errorSoft,
                    borderRadius: theme.radius.md,
                    flex: nextStatus ? 0 : 1,
                    paddingHorizontal: theme.space[3],
                    paddingVertical: theme.space[2],
                  },
                ]}
              >
                <Ionicons name="close" size={14} color={theme.colors.error} />
                <Text style={{ ...theme.typography.labelSm, color: theme.colors.error, marginLeft: 4 }}>
                  İptal
                </Text>
              </Pressable>
            )}

            {/* Next status button */}
            {nextStatus && (
              <Pressable
                onPress={handleNext}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: theme.market.main,
                    borderColor: theme.market.main,
                    borderRadius: theme.radius.md,
                    flex: 1,
                    paddingHorizontal: theme.space[3],
                    paddingVertical: theme.space[2],
                  },
                ]}
              >
                <Ionicons name="arrow-forward-circle-outline" size={14} color={theme.colors.textInverse} />
                <Text
                  style={{
                    ...theme.typography.labelSm,
                    color: theme.colors.textInverse,
                    marginLeft: 4,
                  }}
                >
                  {nextLabel}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function OrderCardSkeleton() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.orderCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderColor: theme.colors.borderDefault,
          marginBottom: theme.space[3],
          padding: theme.space[4],
          gap: theme.space[3],
          ...theme.getElevation(1),
        },
      ]}
    >
      <View style={styles.row}>
        <Skeleton width={80} height={14} />
        <Skeleton width={60} height={20} borderRadius={theme.radius.full} style={{ marginLeft: "auto" }} />
      </View>
      <Skeleton width="100%" height={12} />
      <Skeleton width="70%" height={12} />
      <Skeleton width="100%" height={36} borderRadius={theme.radius.md} />
    </View>
  );
}

// ─── Confirm modal state type ──────────────────────────────────────────────────

type ConfirmModalState = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

// ─── Ekran ─────────────────────────────────────────────────────────────────────

export default function MarketOwnerDashboardScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [mainTab, setMainTab] = useState<'orders' | 'products'>('orders');

  const [allOrders, setAllOrders] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("active");

  // Product state
  const [products, setProducts] = useState<PanelProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PanelProduct | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formUnit, setFormUnit] = useState('adet');
  const [formSaving, setFormSaving] = useState(false);

  // Confirm modal + inline error state
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getPanelOrders();
      setAllOrders(result.items);
    } catch {
      // silently fail — list stays as is
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { items } = await getPanelProducts();
      setProducts(items);
    } catch {
      // silently fail
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab === 'products' && products.length === 0) {
      loadProducts();
    }
  }, [mainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAddProduct = useCallback(() => {
    setEditingProduct(null);
    setFormTitle('');
    setFormPrice('');
    setFormStock('0');
    setFormUnit('adet');
    setFormError(null);
    setProductModalVisible(true);
  }, []);

  const openEditProduct = useCallback((product: PanelProduct) => {
    setEditingProduct(product);
    setFormTitle(product.title);
    setFormPrice(String(product.price));
    setFormStock(String(product.stock));
    setFormUnit(product.unit);
    setFormError(null);
    setProductModalVisible(true);
  }, []);

  const handleSaveProduct = useCallback(async () => {
    if (!formTitle.trim() || !formPrice) return;
    setFormError(null);
    setFormSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        price: Number(formPrice),
        stock: Number(formStock),
        unit: formUnit,
      };
      if (editingProduct) {
        const updated = await updatePanelProduct(editingProduct._id, payload);
        setProducts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      } else {
        const created = await createPanelProduct(payload);
        setProducts((prev) => [created, ...prev]);
      }
      setProductModalVisible(false);
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? 'Kaydedilemedi.');
    } finally {
      setFormSaving(false);
    }
  }, [editingProduct, formTitle, formPrice, formStock, formUnit]);

  const handleDeleteProduct = useCallback((product: PanelProduct) => {
    setConfirmModal({
      title: 'Ürünü Sil',
      message: `"${product.title}" silinecek. Emin misiniz?`,
      confirmLabel: 'Sil',
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePanelProduct(product._id);
          setProducts((prev) => prev.filter((p) => p._id !== product._id));
        } catch {
          setDeleteError('Ürün silinemedi.');
        }
      },
    });
  }, []);

  const handleStatusUpdate = useCallback(
    async (orderId: string, status: MarketOrderStatus) => {
      try {
        const updated = await updateOrderStatus(orderId, status);
        setAllOrders((prev) =>
          prev.map((o) => (o._id === orderId ? updated : o)),
        );
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? "Durum güncellenemedi.";
        setStatusError(msg);
      }
    },
    [],
  );

  const activeFilter = FILTERS.find((f) => f.key === selectedFilter)!;
  const filtered = allOrders.filter((o) =>
    activeFilter.statuses.includes(o.status),
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MarketOrder>) => (
      <OrderCard order={item} onStatusUpdate={handleStatusUpdate} onShowConfirm={setConfirmModal} />
    ),
    [handleStatusUpdate],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* ── Ana sekme: Siparişler / Ürünler ── */}
      <View style={[styles.mainTabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderDefault }]}>
        {(['orders', 'products'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.mainTab, mainTab === tab && { borderBottomColor: theme.market.main, borderBottomWidth: 2 }]}
            onPress={() => setMainTab(tab)}
          >
            <Text style={[{ ...theme.typography.labelMd }, { color: mainTab === tab ? theme.market.main : theme.colors.textSecondary }]}>
              {tab === 'orders' ? 'Siparişler' : 'Ürünler'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mainTab === 'orders' && (
        <>
          {/* Filter tabs */}
          <View
            style={[
              styles.filterBar,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.borderDefault,
                paddingTop: theme.space[3],
                paddingBottom: theme.space[3],
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space[4],
                gap: theme.space[2],
              }}
            >
              {FILTERS.map((f) => {
                const count = allOrders.filter((o) => f.statuses.includes(o.status)).length;
                const active = selectedFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setSelectedFilter(f.key)}
                    style={[
                      styles.filterTab,
                      {
                        backgroundColor: active ? theme.market.main : theme.colors.surfaceAlt,
                        borderColor: active ? theme.market.main : theme.colors.borderDefault,
                        borderRadius: theme.radius.full,
                        paddingHorizontal: theme.space[3],
                        paddingVertical: theme.space[2],
                      },
                    ]}
                  >
                    <Text
                      style={{
                        ...theme.typography.labelMd,
                        color: active ? theme.colors.textInverse : theme.colors.textSecondary,
                      }}
                    >
                      {f.label}
                      {count > 0 ? ` (${count})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Status error */}
          {statusError !== null && (
            <Pressable
              onPress={() => setStatusError(null)}
              style={{ backgroundColor: theme.colors.errorSoft, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text style={{ ...theme.typography.bodySm, color: theme.colors.error, flex: 1 }}>{statusError}</Text>
              <Ionicons name="close" size={14} color={theme.colors.error} />
            </Pressable>
          )}

          {/* Order list */}
          <FlatList
            data={loading ? [] : filtered}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: theme.space[4],
              paddingTop: theme.space[4],
              paddingBottom: insets.bottom + theme.space[6],
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchOrders(true)}
                tintColor={theme.market.main}
                colors={[theme.market.main]}
              />
            }
            ListHeaderComponent={
              loading ? (
                <View>
                  {[1, 2, 3].map((n) => (
                    <OrderCardSkeleton key={n} />
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  illustration="market"
                  title="Sipariş yok"
                  subtitle={
                    selectedFilter === "active"
                      ? "Şu an bekleyen sipariş yok."
                      : `Bu kategoride sipariş bulunamadı.`
                  }
                />
              ) : null
            }
          />
        </>
      )}

      {mainTab === 'products' && (
        <View style={{ flex: 1 }}>
          {/* Add button */}
          <View style={{ paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={openAddProduct}
              style={{ backgroundColor: theme.market.main, borderRadius: theme.radius.xl, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="add" size={18} color={theme.colors.textInverse} />
              <Text style={{ ...theme.typography.labelMd, color: theme.colors.textInverse }}>Ürün Ekle</Text>
            </TouchableOpacity>
          </View>

          {/* Delete error */}
          {deleteError !== null && (
            <Pressable
              onPress={() => setDeleteError(null)}
              style={{ backgroundColor: theme.colors.errorSoft, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text style={{ ...theme.typography.bodySm, color: theme.colors.error, flex: 1 }}>{deleteError}</Text>
              <Ionicons name="close" size={14} color={theme.colors.error} />
            </Pressable>
          )}

          <FlatList
            data={productsLoading ? [] : products}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ paddingHorizontal: theme.space[4], paddingBottom: insets.bottom + theme.space[6] }}
            ListHeaderComponent={productsLoading ? (
              <View>{[1, 2, 3].map((n) => <OrderCardSkeleton key={n} />)}</View>
            ) : null}
            ListEmptyComponent={!productsLoading ? (
              <EmptyState illustration="market" title="Ürün yok" subtitle="Henüz ürün eklenmemiş." />
            ) : null}
            renderItem={({ item }) => (
              <View style={[styles.orderCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.borderDefault, marginBottom: theme.space[3], ...theme.getElevation(1) }]}>
                <View style={[styles.cardHeader, { paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], borderBottomColor: theme.colors.borderDefault }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...theme.typography.labelLg, color: theme.colors.textPrimary }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, marginTop: 2 }}>
                      {item.unit} • Stok: {item.stock}
                    </Text>
                  </View>
                  <Text style={{ ...theme.typography.headingSm, color: theme.market.main }}>
                    ₺{item.price.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.cardFooter, { paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], borderTopColor: theme.colors.borderDefault }]}>
                  <View style={[styles.row, { gap: theme.space[2] }]}>
                    <Pressable
                      onPress={() => openEditProduct(item)}
                      style={[styles.actionBtn, { borderColor: theme.market.main, backgroundColor: theme.market.light, borderRadius: theme.radius.md, flex: 1, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2] }]}
                    >
                      <Ionicons name="pencil-outline" size={14} color={theme.market.main} />
                      <Text style={{ ...theme.typography.labelSm, color: theme.market.main, marginLeft: 4 }}>Düzenle</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteProduct(item)}
                      style={[styles.actionBtn, { borderColor: theme.colors.error, backgroundColor: theme.colors.errorSoft, borderRadius: theme.radius.md, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2] }]}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* ── Onay modal'ı ── */}
      <Modal
        transparent
        visible={confirmModal !== null}
        animationType="fade"
        onRequestClose={() => setConfirmModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setConfirmModal(null)}
        >
          <Pressable
            style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.space[6], margin: theme.space[5], width: '85%' }}
            onPress={() => {}}
          >
            <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary, marginBottom: theme.space[2] }}>
              {confirmModal?.title}
            </Text>
            <Text style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary, marginBottom: theme.space[5] }}>
              {confirmModal?.message}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
              <TouchableOpacity
                onPress={() => setConfirmModal(null)}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.borderDefault, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { const fn = confirmModal!.onConfirm; setConfirmModal(null); fn(); }}
                style={{ flex: 1, padding: theme.space[3], borderRadius: theme.radius.lg, backgroundColor: confirmModal?.destructive ? theme.colors.error : theme.market.main, alignItems: 'center' }}
              >
                <Text style={{ ...theme.typography.labelMd, color: '#fff', fontWeight: '700' }}>
                  {confirmModal?.confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ürün ekleme / düzenleme modal'ı ── */}
      <Modal
        visible={productModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProductModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.space[5], gap: theme.space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ ...theme.typography.headingMd, color: theme.colors.textPrimary }}>
              {editingProduct ? 'Ürünü Düzenle' : 'Yeni Ürün'}
            </Text>
            <TouchableOpacity onPress={() => setProductModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: theme.space[3] }}>
            <View>
              <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 4 }}>Ürün Adı *</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="ör. Elma"
                placeholderTextColor={theme.colors.textTertiary}
                style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], ...theme.typography.bodyMd, color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.borderDefault }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 4 }}>Fiyat (₺) *</Text>
                <TextInput
                  value={formPrice}
                  onChangeText={setFormPrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.colors.textTertiary}
                  style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], ...theme.typography.bodyMd, color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.borderDefault }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 4 }}>Stok</Text>
                <TextInput
                  value={formStock}
                  onChangeText={setFormStock}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={theme.colors.textTertiary}
                  style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], ...theme.typography.bodyMd, color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.borderDefault }}
                />
              </View>
            </View>

            <View>
              <Text style={{ ...theme.typography.labelSm, color: theme.colors.textSecondary, marginBottom: 4 }}>Birim</Text>
              <TextInput
                value={formUnit}
                onChangeText={setFormUnit}
                placeholder="adet, kg, litre..."
                placeholderTextColor={theme.colors.textTertiary}
                style={{ backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg, paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], ...theme.typography.bodyMd, color: theme.colors.textPrimary, borderWidth: 1, borderColor: theme.colors.borderDefault }}
              />
            </View>
          </View>

          {formError !== null && (
            <View style={{ backgroundColor: theme.colors.errorSoft, borderRadius: theme.radius.md, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text style={{ ...theme.typography.bodySm, color: theme.colors.error, flex: 1 }}>{formError}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSaveProduct}
            disabled={!formTitle.trim() || !formPrice || formSaving}
            style={{ backgroundColor: theme.market.main, borderRadius: theme.radius.xl, paddingVertical: theme.space[4], alignItems: 'center', opacity: (!formTitle.trim() || !formPrice || formSaving) ? 0.5 : 1, marginTop: 'auto' }}
          >
            <Text style={{ ...theme.typography.labelLg, color: theme.colors.textInverse }}>
              {formSaving ? 'Kaydediliyor…' : editingProduct ? 'Güncelle' : 'Ekle'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mainTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mainTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filterTab: { borderWidth: StyleSheet.hairlineWidth },
  orderCard: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});

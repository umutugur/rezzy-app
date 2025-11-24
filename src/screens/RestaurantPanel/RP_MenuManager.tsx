import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  LayoutAnimation,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import * as ImagePicker from "expo-image-picker";
import { rp } from "./rpStyles";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RestaurantPanelParams } from "../../navigation/RestaurantPanelNavigator";
import {
  rpListCategories,
  rpCreateCategory,
  rpUpdateCategory,
  rpDeleteCategory,
  rpListItems,
  rpCreateItem,
  rpUpdateItem,
  rpDeleteItem,
  type MenuCategory,
  type MenuItem,
} from "../../api/menu";

type Props = NativeStackScreenProps<RestaurantPanelParams, "MenuManager">;

export default function RP_MenuManager({ route }: Props) {
  const { restaurantId: rid } = route.params;

  const [tab, setTab] = React.useState<"categories" | "items">("categories");
  const [loading, setLoading] = React.useState(false);

  // categories
  const [cats, setCats] = React.useState<MenuCategory[]>([]);
  const [selectedCatId, setSelectedCatId] = React.useState<string | null>(null);

  // items
  const [items, setItems] = React.useState<MenuItem[]>([]);

  // new category form
  const [newCat, setNewCat] = React.useState({
    title: "",
    description: "",
    order: 0,
  });

  // edit category
  const [editingCatId, setEditingCatId] = React.useState<string | null>(null);
  const [editingCat, setEditingCat] = React.useState<Partial<MenuCategory>>({});

  // new item form
  const [newItem, setNewItem] = React.useState({
    title: "",
    description: "",
    price: 0,
    tagsText: "",
    order: 0,
    isAvailable: true,
    photo: null as null | { uri: string; name: string; type: string },
  });

  // edit item
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [editingItem, setEditingItem] = React.useState<any>({});
  const [editingItemPhoto, setEditingItemPhoto] =
    React.useState<null | { uri: string; name: string; type: string }>(null);

  // add modal
  const [addOpen, setAddOpen] = React.useState(false);

  // ---------- Load categories ----------
  const loadCategories = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await rpListCategories(rid);
      setCats(list);

      if (list.length === 0) {
        setSelectedCatId(null);
      } else if (!selectedCatId || !list.find((c) => c._id === selectedCatId)) {
        setSelectedCatId(list[0]._id);
      }
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Kategoriler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [rid, selectedCatId]);

  // ---------- Load items ----------
  const loadItems = React.useCallback(
    async (categoryId?: string | null) => {
      setLoading(true);
      try {
        const list = await rpListItems(rid, categoryId ? { categoryId } : {});
        setItems(list);
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Ürünler alınamadı.");
      } finally {
        setLoading(false);
      }
    },
    [rid]
  );

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  React.useEffect(() => {
    if (selectedCatId) loadItems(selectedCatId);
  }, [selectedCatId, loadItems]);

  // ---------- Photo pick helper ----------
  async function pickPhoto(): Promise<null | { uri: string; name: string; type: string }> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin gerekli", "Fotoğraf seçmek için galeri izni lazım.");
      return null;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (res.canceled) return null;
    const asset = res.assets[0];
    const uri = asset.uri;
    const fileName = uri.split("/").pop() || `menu_${Date.now()}.jpg`;
    const mimeType = asset.mimeType || "image/jpeg";

    return { uri, name: fileName, type: mimeType };
  }

  const selectedCat = cats.find((c) => c._id === selectedCatId) || null;

  // ---- drag&drop order helpers ----
  async function persistCategoryOrder(nextCats: MenuCategory[]) {
    try {
      const ordered = nextCats.map((c, i) => ({ ...c, order: i * 10 }));
      setCats(ordered);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await Promise.all(
        ordered.map((c) => rpUpdateCategory(rid, c._id, { order: c.order }))
      );
      await loadCategories();
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Kategori sırası kaydedilemedi.");
      await loadCategories();
    }
  }

  async function persistItemOrder(nextItems: MenuItem[]) {
    try {
      const ordered = nextItems.map((it, i) => ({ ...it, order: i * 10 }));
      setItems(ordered);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await Promise.all(
        ordered.map((it) => rpUpdateItem(rid, it._id, { order: it.order }))
      );
      await loadItems(selectedCatId);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Ürün sırası kaydedilemedi.");
      await loadItems(selectedCatId);
    }
  }

  // ---------- Add handlers ----------
  async function handleAddCategory() {
    try {
      if (!newCat.title.trim()) return;
      await rpCreateCategory(rid, newCat);
      setNewCat({ title: "", description: "", order: 0 });
      await loadCategories();
      setAddOpen(false);
      Alert.alert("OK", "Kategori eklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Kategori eklenemedi.");
    }
  }

  async function handleAddItem() {
    try {
      if (!selectedCatId) {
        Alert.alert("Uyarı", "Önce bir kategori seçmelisin.");
        return;
      }
      if (!newItem.title.trim()) return;

      await rpCreateItem(rid, {
        categoryId: selectedCatId,
        title: newItem.title,
        description: newItem.description,
        price: newItem.price,
        tags: String(newItem.tagsText || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        order: newItem.order,
        isAvailable: newItem.isAvailable,
        photoUri: newItem.photo?.uri ?? null,
        photoName: newItem.photo?.name ?? null,
        photoType: newItem.photo?.type ?? null,
      });

      setNewItem({
        title: "",
        description: "",
        price: 0,
        tagsText: "",
        order: 0,
        isAvailable: true,
        photo: null,
      });

      await loadItems(selectedCatId);
      setAddOpen(false);
      Alert.alert("OK", "Ürün eklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Ürün eklenemedi.");
    }
  }

  return (
    <View style={rp.screen}>
      {/* Tabs fixed header */}
      <View style={[rp.tabs, { paddingHorizontal: 16, paddingTop: 12 }]}>
        <TouchableOpacity
          style={[rp.tabBtn, tab === "categories" && rp.tabBtnActive]}
          onPress={() => setTab("categories")}
        >
          <Text style={[rp.tabText, tab === "categories" && rp.tabTextActive]}>
            Kategoriler
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[rp.tabBtn, tab === "items" && rp.tabBtnActive]}
          onPress={() => setTab("items")}
        >
          <Text style={[rp.tabText, tab === "items" && rp.tabTextActive]}>
            Ürünler
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator />
        </View>
      )}

      {/* ===================== CATEGORIES ===================== */}
      {tab === "categories" && (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 100 }}>
          <View style={rp.card}>
            <View style={styles.headerRow}>
              <Text style={rp.cardTitle}>Menü Kategorileri</Text>
              <TouchableOpacity
                style={styles.headerAddBtn}
                onPress={() => setAddOpen(true)}
              >
                <Text style={styles.headerAddBtnText}>+ Kategori</Text>
              </TouchableOpacity>
            </View>

            {cats.length === 0 && <Text style={rp.muted}>Kategori yok.</Text>}

            <DraggableFlatList
              data={cats}
              keyExtractor={(item) => item._id}
              onDragEnd={({ data }) => persistCategoryOrder(data)}
              activationDistance={10}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item: c, drag, isActive }: RenderItemParams<MenuCategory>) => {
                const isSelected = c._id === selectedCatId;
                const isEditing = c._id === editingCatId;

                return (
                  <View
                    style={[
                      rp.card,
                      {
                        padding: 12,
                        borderColor: isSelected ? "#111" : "#eee",
                        opacity: isActive ? 0.9 : 1,
                      },
                    ]}
                  >
                    {!isEditing ? (
                      <>
                        <TouchableOpacity
                          onPress={() => setSelectedCatId(c._id)}
                          onLongPress={drag}
                          delayLongPress={120}
                        >
                          <Text style={{ fontWeight: "700", fontSize: 15 }}>
                            {c.title}
                          </Text>
                          {!!c.description && (
                            <Text style={[rp.muted, { marginTop: 4 }]}>
                              {c.description}
                            </Text>
                          )}
                          <Text style={[rp.muted, { marginTop: 4, fontSize: 12 }]}>
                            Sıra: {c.order} • {c.isActive ? "Aktif" : "Pasif"} • (Sürükle)
                          </Text>
                        </TouchableOpacity>

                        <View style={[rp.row, { gap: 8, marginTop: 8 }]}>
                          <TouchableOpacity
                            style={rp.btnMuted}
                            onPress={() => {
                              setEditingCatId(c._id);
                              setEditingCat({
                                title: c.title,
                                description: c.description ?? "",
                                order: c.order,
                                isActive: c.isActive,
                              });
                            }}
                          >
                            <Text style={rp.btnMutedText}>Düzenle</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={rp.btnDanger}
                            onPress={() => {
                              Alert.alert(
                                "Kategori silinsin mi?",
                                `"${c.title}" kategorisini silmek istiyor musun?`,
                                [
                                  { text: "Vazgeç", style: "cancel" },
                                  {
                                    text: "Sil",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        await rpDeleteCategory(rid, c._id);
                                        await loadCategories();
                                        if (selectedCatId === c._id) setSelectedCatId(null);
                                      } catch (e: any) {
                                        Alert.alert("Hata", e?.message || "Silinemedi.");
                                      }
                                    },
                                  },
                                ]
                              );
                            }}
                          >
                            <Text style={rp.btnDangerText}>Sil</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View>
                        <Text style={{ color: "#6b7280", marginBottom: 6 }}>Başlık</Text>
                        <TextInput
                          style={rp.input}
                          value={editingCat.title ?? ""}
                          onChangeText={(v) => setEditingCat((p) => ({ ...p, title: v }))}
                        />

                        <Text style={{ color: "#6b7280", marginBottom: 6 }}>Açıklama</Text>
                        <TextInput
                          style={[rp.input, { height: 80 }]}
                          multiline
                          value={editingCat.description ?? ""}
                          onChangeText={(v) =>
                            setEditingCat((p) => ({ ...p, description: v }))
                          }
                        />

                        <Text style={{ color: "#6b7280", marginBottom: 6 }}>Sıra</Text>
                        <TextInput
                          style={rp.input}
                          keyboardType="numeric"
                          value={String(editingCat.order ?? 0)}
                          onChangeText={(v) =>
                            setEditingCat((p) => ({ ...p, order: Number(v || "0") }))
                          }
                        />

                        <View style={[rp.row, { gap: 8 }]}>
                          <TouchableOpacity
                            style={rp.btnPrimary}
                            onPress={async () => {
                              try {
                                await rpUpdateCategory(rid, c._id, editingCat);
                                setEditingCatId(null);
                                setEditingCat({});
                                await loadCategories();
                              } catch (e: any) {
                                Alert.alert("Hata", e?.message || "Kaydedilemedi.");
                              }
                            }}
                          >
                            <Text style={rp.btnPrimaryText}>Kaydet</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={rp.btnMuted}
                            onPress={() => {
                              setEditingCatId(null);
                              setEditingCat({});
                            }}
                          >
                            <Text style={rp.btnMutedText}>Vazgeç</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </View>
      )}

      {/* ===================== ITEMS ===================== */}
      {tab === "items" && (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 100 }}>
          <View style={rp.card}>
            <View style={styles.headerRow}>
              <Text style={rp.cardTitle}>
                Ürünler {selectedCat ? `— ${selectedCat.title}` : ""}
              </Text>
              <TouchableOpacity
                style={styles.headerAddBtn}
                onPress={() => setAddOpen(true)}
              >
                <Text style={styles.headerAddBtnText}>+ Ürün</Text>
              </TouchableOpacity>
            </View>

            {!selectedCat && (
              <Text style={rp.muted}>
                Önce bir kategori seç (Kategoriler sekmesi).
              </Text>
            )}

            {selectedCat && (
              <>
                {items.length === 0 && <Text style={rp.muted}>Bu kategoride ürün yok.</Text>}

                <DraggableFlatList
                  data={items}
                  keyExtractor={(item) => item._id}
                  onDragEnd={({ data }) => persistItemOrder(data)}
                  activationDistance={10}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  renderItem={({ item: it, drag, isActive }: RenderItemParams<MenuItem>) => {
                    const isEditing = it._id === editingItemId;

                    return (
                      <View style={[rp.card, { padding: 12, opacity: isActive ? 0.9 : 1 }]}>
                        {!isEditing ? (
                          <>
                            <TouchableOpacity onLongPress={drag} delayLongPress={120}>
                              <Text style={{ fontWeight: "700", fontSize: 15 }}>{it.title}</Text>
                              {!!it.description && (
                                <Text style={[rp.muted, { marginTop: 4 }]}>{it.description}</Text>
                              )}

                              <Text style={{ marginTop: 6 }}>
                                Fiyat: <Text style={{ fontWeight: "800" }}>{it.price} ₺</Text>
                              </Text>

                              {!!it.tags?.length && (
                                <Text style={[rp.muted, { marginTop: 4, fontSize: 12 }]}>
                                  #{it.tags.join(" #")}
                                </Text>
                              )}

                              {it.photoUrl ? (
                                <Image
                                  source={{ uri: it.photoUrl }}
                                  style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 8 }}
                                  resizeMode="cover"
                                />
                              ) : null}

                              <Text style={[rp.muted, { marginTop: 6, fontSize: 12 }]}>
                                sıra: {it.order} • {it.isActive ? "aktif" : "pasif"} •{" "}
                                {it.isAvailable ? "serviste" : "stok yok"} • (Sürükle)
                              </Text>
                            </TouchableOpacity>

                            <View style={[rp.row, { gap: 8, marginTop: 8 }]}>
                              <TouchableOpacity
                                style={rp.btnMuted}
                                onPress={() => {
                                  setEditingItemId(it._id);
                                  setEditingItem({
                                    title: it.title,
                                    description: it.description ?? "",
                                    price: it.price,
                                    tagsText: (it.tags ?? []).join(", "),
                                    order: it.order,
                                    isAvailable: it.isAvailable,
                                    isActive: it.isActive,
                                  });
                                  setEditingItemPhoto(null);
                                }}
                              >
                                <Text style={rp.btnMutedText}>Düzenle</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={rp.btnDanger}
                                onPress={() => {
                                  Alert.alert(
                                    "Ürün silinsin mi?",
                                    `"${it.title}" ürünü silmek istiyor musun?`,
                                    [
                                      { text: "Vazgeç", style: "cancel" },
                                      {
                                        text: "Sil",
                                        style: "destructive",
                                        onPress: async () => {
                                          try {
                                            await rpDeleteItem(rid, it._id);
                                            await loadItems(selectedCatId);
                                          } catch (e: any) {
                                            Alert.alert("Hata", e?.message || "Silinemedi.");
                                          }
                                        },
                                      },
                                    ]
                                  );
                                }}
                              >
                                <Text style={rp.btnDangerText}>Sil</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <View>
                            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Ürün adı</Text>
                            <TextInput
                              style={rp.input}
                              value={editingItem.title ?? ""}
                              onChangeText={(v) =>
                                setEditingItem((p: any) => ({ ...p, title: v }))
                              }
                            />

                            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Açıklama</Text>
                            <TextInput
                              style={[rp.input, { height: 80 }]}
                              multiline
                              value={editingItem.description ?? ""}
                              onChangeText={(v) =>
                                setEditingItem((p: any) => ({ ...p, description: v }))
                              }
                            />

                            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Fiyat (₺)</Text>
                            <TextInput
                              style={rp.input}
                              placeholder="Örn: 250"
                              keyboardType="numeric"
                              value={String(editingItem.price ?? 0)}
                              onChangeText={(v) =>
                                setEditingItem((p: any) => ({
                                  ...p,
                                  price: Number(v || "0"),
                                }))
                              }
                            />

                            <Text style={{ color: "#6b7280", marginBottom: 6 }}>
                              Etiketler (virgülle)
                            </Text>
                            <TextInput
                              style={rp.input}
                              value={editingItem.tagsText ?? ""}
                              onChangeText={(v) =>
                                setEditingItem((p: any) => ({ ...p, tagsText: v }))
                              }
                            />

                            <Text style={{ color: "#6b7280", marginBottom: 6 }}>Sıra</Text>
                            <TextInput
                              style={rp.input}
                              placeholder="Örn: 10"
                              keyboardType="numeric"
                              value={String(editingItem.order ?? 0)}
                              onChangeText={(v) =>
                                setEditingItem((p: any) => ({
                                  ...p,
                                  order: Number(v || "0"),
                                }))
                              }
                            />

                            <View style={[rp.row, { gap: 12, marginBottom: 10 }]}>
                              <TouchableOpacity
                                style={[
                                  rp.tabBtn,
                                  (editingItem.isAvailable ?? true) && rp.tabBtnActive,
                                ]}
                                onPress={() =>
                                  setEditingItem((p: any) => ({
                                    ...p,
                                    isAvailable: !(p.isAvailable ?? true),
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    rp.tabText,
                                    (editingItem.isAvailable ?? true) && rp.tabTextActive,
                                  ]}
                                >
                                  Serviste
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[
                                  rp.tabBtn,
                                  (editingItem.isActive ?? true) && rp.tabBtnActive,
                                ]}
                                onPress={() =>
                                  setEditingItem((p: any) => ({
                                    ...p,
                                    isActive: !(p.isActive ?? true),
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    rp.tabText,
                                    (editingItem.isActive ?? true) && rp.tabTextActive,
                                  ]}
                                >
                                  Aktif
                                </Text>
                              </TouchableOpacity>
                            </View>

                            <View style={{ marginBottom: 10 }}>
                              <TouchableOpacity
                                style={rp.btnMuted}
                                onPress={async () => {
                                  const p = await pickPhoto();
                                  if (p) setEditingItemPhoto(p);
                                }}
                              >
                                <Text style={rp.btnMutedText}>
                                  {editingItemPhoto ? "Fotoğraf değiştirildi ✅" : "Fotoğraf seç"}
                                </Text>
                              </TouchableOpacity>

                              {it.photoUrl && (
                                <TouchableOpacity
                                  style={[rp.btnMuted, { marginTop: 6 }]}
                                  onPress={() =>
                                    setEditingItem((p: any) => ({
                                      ...p,
                                      removePhoto: !(p.removePhoto ?? false),
                                    }))
                                  }
                                >
                                  <Text style={rp.btnMutedText}>
                                    {editingItem.removePhoto
                                      ? "Foto kaldırılacak ✅"
                                      : "Fotoğrafı kaldır"}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={[rp.row, { gap: 8 }]}>
                              <TouchableOpacity
                                style={rp.btnPrimary}
                                onPress={async () => {
                                  try {
                                    await rpUpdateItem(rid, it._id, {
                                      categoryId: it.categoryId,
                                      title: editingItem.title,
                                      description: editingItem.description,
                                      price: editingItem.price,
                                      tags: String(editingItem.tagsText || "")
                                        .split(",")
                                        .map((x: string) => x.trim())
                                        .filter(Boolean),
                                      order: editingItem.order,
                                      isAvailable: editingItem.isAvailable,
                                      isActive: editingItem.isActive,
                                      removePhoto: editingItem.removePhoto,
                                      photoUri: editingItemPhoto?.uri ?? null,
                                      photoName: editingItemPhoto?.name ?? null,
                                      photoType: editingItemPhoto?.type ?? null,
                                    });

                                    setEditingItemId(null);
                                    setEditingItem({});
                                    setEditingItemPhoto(null);
                                    await loadItems(selectedCatId);
                                  } catch (e: any) {
                                    Alert.alert("Hata", e?.message || "Kaydedilemedi.");
                                  }
                                }}
                              >
                                <Text style={rp.btnPrimaryText}>Kaydet</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={rp.btnMuted}
                                onPress={() => {
                                  setEditingItemId(null);
                                  setEditingItem({});
                                  setEditingItemPhoto(null);
                                }}
                              >
                                <Text style={rp.btnMutedText}>Vazgeç</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setAddOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAddOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={rp.card}>
            <Text style={rp.cardTitle}>
              {tab === "categories" ? "Yeni Kategori" : "Yeni Ürün"}
            </Text>

            {tab === "categories" ? (
              <>
                <TextInput
                  style={rp.input}
                  placeholder="Kategori adı"
                  value={newCat.title}
                  onChangeText={(v) => setNewCat((p) => ({ ...p, title: v }))}
                />
                <TextInput
                  style={[rp.input, { height: 80 }]}
                  placeholder="Açıklama"
                  multiline
                  value={newCat.description}
                  onChangeText={(v) =>
                    setNewCat((p) => ({ ...p, description: v }))
                  }
                />
                <TextInput
                  style={rp.input}
                  placeholder="Sıra (0,1,2...)"
                  keyboardType="numeric"
                  value={String(newCat.order)}
                  onChangeText={(v) =>
                    setNewCat((p) => ({ ...p, order: Number(v || "0") }))
                  }
                />

                <View style={[rp.row, { gap: 8 }]}>
                  <TouchableOpacity
                    style={rp.btnPrimary}
                    disabled={!newCat.title.trim()}
                    onPress={handleAddCategory}
                  >
                    <Text style={rp.btnPrimaryText}>Kaydet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={rp.btnMuted} onPress={() => setAddOpen(false)}>
                    <Text style={rp.btnMutedText}>Vazgeç</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TextInput
                  style={rp.input}
                  placeholder="Ürün adı"
                  value={newItem.title}
                  onChangeText={(v) => setNewItem((p) => ({ ...p, title: v }))}
                />
                <TextInput
                  style={[rp.input, { height: 70 }]}
                  placeholder="Açıklama"
                  multiline
                  value={newItem.description}
                  onChangeText={(v) =>
                    setNewItem((p) => ({ ...p, description: v }))
                  }
                />

                <Text style={{ color: "#6b7280", marginBottom: 6 }}>Fiyat (₺)</Text>
                <TextInput
                  style={rp.input}
                  placeholder="Örn: 250"
                  keyboardType="numeric"
                  value={newItem.price ? String(newItem.price) : ""}
                  onChangeText={(v) =>
                    setNewItem((p) => ({ ...p, price: Number(v || "0") }))
                  }
                />

                <TextInput
                  style={rp.input}
                  placeholder="Etiketler (virgülle)"
                  value={newItem.tagsText}
                  onChangeText={(v) =>
                    setNewItem((p) => ({ ...p, tagsText: v }))
                  }
                />

                <Text style={{ color: "#6b7280", marginBottom: 6 }}>Sıra</Text>
                <TextInput
                  style={rp.input}
                  placeholder="Örn: 10"
                  keyboardType="numeric"
                  value={newItem.order ? String(newItem.order) : ""}
                  onChangeText={(v) =>
                    setNewItem((p) => ({ ...p, order: Number(v || "0") }))
                  }
                />

                <TouchableOpacity
                  style={rp.btnMuted}
                  onPress={async () => {
                    const p = await pickPhoto();
                    if (p) setNewItem((s) => ({ ...s, photo: p }));
                  }}
                >
                  <Text style={rp.btnMutedText}>
                    {newItem.photo ? "Foto seçildi ✅" : "Fotoğraf seç (ops.)"}
                  </Text>
                </TouchableOpacity>

                <View style={[rp.row, { gap: 8, marginTop: 8 }]}>
                  <TouchableOpacity
                    style={rp.btnPrimary}
                    disabled={!newItem.title.trim()}
                    onPress={handleAddItem}
                  >
                    <Text style={rp.btnPrimaryText}>Kaydet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={rp.btnMuted} onPress={() => setAddOpen(false)}>
                    <Text style={rp.btnMutedText}>Vazgeç</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerAddBtn: {
    backgroundColor: "#121212",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  headerAddBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: -2 },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
  },
});
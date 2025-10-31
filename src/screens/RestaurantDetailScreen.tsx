// src/screens/RestaurantDetailScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Pressable,
  Animated,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import {
  getRestaurant,
  getAvailability,
  type Restaurant as ApiRestaurant,
  type AvailabilitySlot,
} from "../api/restaurants";
import {
  listFavorites,
  addFavorite,
  removeFavorite,
  isFavorited,
  type FavoriteRestaurant,
} from "../api/favorites";
import { useReservation } from "../store/useReservation";
import { useAuth } from "../store/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

dayjs.locale("tr");

const { width: SCREEN_W } = Dimensions.get("window");
const H_PADDING = 16;
const PHOTO_W = SCREEN_W;
const PHOTO_H = Math.round((SCREEN_W * 9) / 16);

type FixMenu = {
  _id?: string;
  title: string;
  description?: string;
  pricePerPerson: number;
  isActive?: boolean;
};
type Restaurant = ApiRestaurant & { menus?: FixMenu[] };

export default function RestaurantDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const restaurantId: string = route.params?.id ?? route.params?.restaurantId ?? "";

  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const setIntended = useAuth((s) => s.setIntended);

  const setRestaurant = useReservation?.((s: any) => s.setRestaurant) ?? (() => {});
  const setDateTime = useReservation?.((s: any) => s.setDateTime) ?? (() => {});
  const setParty = useReservation?.((s: any) => s.setParty) ?? (() => {});

  const [loading, setLoading] = useState(true);
  const [r, setR] = useState<Restaurant | null>(null);
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);

  const [activePhoto, setActivePhoto] = useState(0);
  const photosListRef = useRef<FlatList<string>>(null);
  const dayLabel = dayjs(date).format("DD MMM");

  const [favLoading, setFavLoading] = useState<boolean>(false);
  const [favs, setFavs] = useState<FavoriteRestaurant[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (!loading && r) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, r]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = (await getRestaurant(restaurantId)) as Restaurant;
        if (alive) setR(data);
      } catch (e: any) {
        Alert.alert("Hata", e?.response?.data?.message || e?.message || "Restoran yüklenemedi");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (token && user?.role === "customer") {
          const list = await listFavorites();
          if (mounted) setFavs(list || []);
        } else {
          if (mounted) setFavs([]);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [token, user?.role]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!restaurantId) return;
      try {
        setFetchingSlots(true);
        setSelectedSlot(null);
        const res = await getAvailability({ id: restaurantId, date, partySize });
        if (alive) setSlots(res?.slots || []);
      } catch {
        if (alive) setSlots([]);
      } finally {
        if (alive) setFetchingSlots(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId, date, partySize]);

  const photos = useMemo(() => (r?.photos || []).filter(Boolean), [r]);
  const menus = useMemo(() => (r?.menus || []).filter((m) => m && (m.isActive ?? true)), [r]);
  const minMenuPrice = useMemo(
    () => (menus.length ? Math.min(...menus.map((m) => m.pricePerPerson)) : undefined),
    [menus]
  );

  const fav = useMemo(() => isFavorited(favs, restaurantId), [favs, restaurantId]);

  const onSelectSlot = (s: AvailabilitySlot) => {
    if (!s.isAvailable) return;
    setSelectedSlot(s);
  };

  const onContinue = async () => {
    if (!selectedSlot || !r) return;

    const [h, m] = selectedSlot.label.split(":");
    const localDateTime = dayjs(date).hour(Number(h)).minute(Number(m)).second(0).toISOString();

    if (!token) {
      Alert.alert("Giriş gerekli", "Rezervasyon oluşturmak için giriş yapmalısın.");
      await setIntended({ name: "Restoran", params: { id: restaurantId } });
      nav.navigate("Giriş");
      return;
    }

    setRestaurant(r._id);
    setDateTime(localDateTime);
    setParty(partySize);
    nav.navigate("Rezervasyon - Menü");
  };

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PHOTO_W);
    setActivePhoto(Math.max(0, Math.min(idx, photos.length - 1)));
  };

  const toggleFavorite = async () => {
    if (!restaurantId || favLoading) return;
    if (!token || user?.role !== "customer") {
      Alert.alert("Giriş gerekli", "Favorilere eklemek için giriş yapmalısın.");
      await setIntended({ name: "Restoran", params: { id: restaurantId } });
      nav.navigate("Giriş");
      return;
    }

    setFavLoading(true);
    try {
      if (fav) {
        await removeFavorite(restaurantId);
        setFavs((prev) => prev.filter((f) => f._id !== restaurantId));
      } else {
        await addFavorite(restaurantId);
        setFavs((prev) =>
          prev.some((f) => f._id === restaurantId)
            ? prev
            : [
                ...prev,
                {
                  _id: restaurantId,
                  name: r?.name || "",
                  city: r?.city,
                  address: r?.address,
                  photos: r?.photos,
                  priceRange: r?.priceRange,
                  rating: (r as any)?.rating ?? null,
                },
              ]
        );
      }
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Favori işlemi başarısız");
    } finally {
      setFavLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7B2C2C" />
        <Text style={styles.loadingText}>Yükleniyor…</Text>
      </View>
    );
  }

  if (!r) {
    return (
      <View style={styles.center}>
        <Ionicons name="restaurant-outline" size={64} color="#666666" />
        <Text style={styles.emptyTitle}>Restoran Bulunamadı</Text>
        <Text style={styles.emptyText}>Bu restoran mevcut değil veya kaldırılmış.</Text>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scrollPadBottom = insets.bottom + 100;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          {/* Galeri */}
          <View style={styles.galleryWrap}>
            {photos.length > 0 ? (
              <>
                <FlatList
                  ref={photosListRef}
                  data={photos}
                  horizontal
                  pagingEnabled
                  onScroll={onPhotoScroll}
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u, i) => `${u}-${i}`}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={styles.photoFull} resizeMode="cover" />
                  )}
                />

                <Pressable onPress={toggleFavorite} style={styles.favoriteOverlay}>
                  <LinearGradient
                    colors={fav ? ["#E53935", "#C62828"] : ["#ffffff", "#ffffff"]}
                    style={styles.favoriteButton}
                  >
                    <Ionicons
                      name={fav ? "heart" : "heart-outline"}
                      size={22}
                      color={fav ? "#fff" : "#7B2C2C"}
                    />
                  </LinearGradient>
                </Pressable>

                <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.4)"]} style={styles.gradBottom} />

                <View style={styles.dots}>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#999999" />
                <Text style={styles.photoPlaceholderText}>Fotoğraf bulunamadı</Text>
              </View>
            )}
          </View>

          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{r.name}</Text>
                {!!r.address && (
                  <View style={styles.addressRow}>
                    <Ionicons name="location" size={16} color="#666666" />
                    <Text style={styles.addressText}>{r.address}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={toggleFavorite} style={styles.favoriteButtonCard}>
                <Ionicons
                  name={fav ? "heart" : "heart-outline"}
                  size={24}
                  color={fav ? "#E53935" : "#666666"}
                />
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              {!!r.city && (
                <View style={styles.metaChip}>
                  <Ionicons name="location-outline" size={14} color="#666666" />
                  <Text style={styles.metaChipText}>{r.city}</Text>
                </View>
              )}
              {!!r.priceRange && (
                <View style={styles.metaChip}>
                  <Ionicons name="wallet-outline" size={14} color="#666666" />
                  <Text style={styles.metaChipText}>{r.priceRange}</Text>
                </View>
              )}
              {typeof minMenuPrice === "number" && (
                <View style={styles.metaChipPrimary}>
                  <Ionicons name="pricetag" size={14} color="#fff" />
                  <Text style={styles.metaChipTextPrimary}>
                    ₺{minMenuPrice.toLocaleString("tr-TR")}+
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Fix Menüler */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="restaurant" size={22} color="#7B2C2C" />
              <Text style={styles.sectionTitle}>Fix Menüler</Text>
            </View>
            {menus.length === 0 ? (
              <View style={styles.emptyStateSmall}>
                <Ionicons name="fast-food-outline" size={32} color="#999999" />
                <Text style={styles.muted}>Bu restoran için menü bulunamadı.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {menus.map((m, idx) => (
                  <View key={`${m._id || m.title}-${idx}`} style={styles.menuCard}>
                    <View style={styles.menuIconCircle}>
                      <Ionicons name="nutrition" size={24} color="#7B2C2C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.menuTitle}>{m.title}</Text>
                      {!!m.description && <Text style={styles.menuDesc}>{m.description}</Text>}
                    </View>
                    <View style={styles.menuPricePill}>
                      <Text style={styles.menuPriceText}>
                        ₺{Number(m.pricePerPerson).toLocaleString("tr-TR")}
                      </Text>
                      <Text style={styles.menuPriceSub}>kişi başı</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Uygun Saat Bul */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={22} color="#7B2C2C" />
              <Text style={styles.sectionTitle}>Uygun Saat Bul</Text>
            </View>

            <View style={styles.controlsContainer}>
              <View style={styles.controlCard}>
                <Text style={styles.controlLabel}>Tarih</Text>
                <View style={styles.dateControls}>
                  <Pressable
                    onPress={() => setDate(dayjs(date).subtract(1, "day").format("YYYY-MM-DD"))}
                    disabled={dayjs(date).isSame(dayjs(), "day")}
                    style={[styles.controlButton, dayjs(date).isSame(dayjs(), "day") && styles.disabled]}
                  >
                    <Ionicons name="chevron-back" size={18} color="#1A1A1A" />
                  </Pressable>

                  <View style={styles.dateDisplay}>
                    <Text style={styles.dateText}>{dayjs(date).format("DD MMM")}</Text>
                    <Text style={styles.dayText}>{dayjs(date).format("dddd")}</Text>
                  </View>

                  <Pressable
                    onPress={() => setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"))}
                    style={styles.controlButton}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#1A1A1A" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.controlCard}>
                <Text style={styles.controlLabel}>Kişi Sayısı</Text>
                <View style={styles.partyControls}>
                  <Pressable
                    onPress={() => setPartySize((p) => Math.max(1, p - 1))}
                    style={[styles.controlButton, partySize <= 1 && styles.disabled]}
                  >
                    <Ionicons name="remove" size={18} color="#1A1A1A" />
                  </Pressable>

                  <View style={styles.partyDisplay}>
                    <Ionicons name="people" size={20} color="#7B2C2C" />
                    <Text style={styles.partyText}>{partySize}</Text>
                  </View>

                  <Pressable onPress={() => setPartySize((p) => p + 1)} style={styles.controlButton}>
                    <Ionicons name="add" size={18} color="#1A1A1A" />
                  </Pressable>
                </View>
              </View>
            </View>

            {fetchingSlots ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator color="#7B2C2C" />
                <Text style={styles.slotsLoadingText}>Uygun saatler aranıyor…</Text>
              </View>
            ) : (
              <FlatList
                data={slots}
                horizontal
                keyExtractor={(s) => s.timeISO}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.slotsList}
                renderItem={({ item }) => {
                  const isSelected = selectedSlot?.timeISO === item.timeISO;
                  const disabled = !item.isAvailable;
                  return (
                    <Pressable
                      onPress={() => onSelectSlot(item)}
                      disabled={disabled}
                      style={[styles.slot, disabled && styles.slotDisabled, isSelected && styles.slotSelected]}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "time-outline"}
                        size={18}
                        color={isSelected ? "#fff" : disabled ? "#999999" : "#7B2C2C"}
                      />
                      <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{item.label}</Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyStateSmall}>
                    <Ionicons name="calendar-outline" size={32} color="#999999" />
                    <Text style={styles.muted}>Uygun saat bulunamadı.</Text>
                  </View>
                }
              />
            )}
          </View>
           {/* Hakkında */}
          {!!r.description && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="information-circle" size={22} color="#7B2C2C" />
                <Text style={styles.sectionTitle}>Hakkında</Text>
              </View>
              <Text style={styles.description}>{r.description}</Text>
            </View>
          )}

          {/* İletişim */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="call" size={22} color="#7B2C2C" />
              <Text style={styles.sectionTitle}>İletişim</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={18} color="#666666" />
              <Text style={styles.contactText}>{r.phone || "Telefon bilgisi yok"}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="location-outline" size={18} color="#666666" />
              <Text style={styles.contactText}>{r.address || "Adres bilgisi yok"}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* CTA Bar */}
      <LinearGradient
        colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,1)"]}
        style={[styles.ctaBar, { paddingBottom: 12 + insets.bottom }]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.ctaTitleRow}>
            <Ionicons name="calendar" size={18} color="#7B2C2C" />
            <Text style={styles.ctaTitle}>
              {selectedSlot ? `${dayLabel}, ${selectedSlot.label}` : "Tarih & Saat Seçin"}
            </Text>
          </View>
          <View style={styles.ctaSubRow}>
            <Ionicons name="people" size={14} color="#666666" />
            <Text style={styles.ctaSub}>{partySize} Kişi</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onContinue}
          disabled={!selectedSlot}
          style={[styles.ctaBtn, !selectedSlot && styles.ctaBtnDisabled]}
        >
          <Text style={styles.ctaBtnText}>Devam Et</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#FAFAFA", flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
    padding: 32,
    gap: 12,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: "#666666" },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A1A", marginTop: 16 },
  emptyText: { color: "#666666", textAlign: "center", marginBottom: 24 },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  backButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  galleryWrap: { position: "relative", backgroundColor: "#fff" },
  photoFull: { width: PHOTO_W, height: PHOTO_H, backgroundColor: "#E6E6E6" },
  favoriteOverlay: { position: "absolute", right: 16, top: 16 },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  gradBottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  dots: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#fff", width: 24 },
  photoPlaceholder: {
    height: PHOTO_H,
    backgroundColor: "#E6E6E6",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  photoPlaceholderText: { color: "#999999", fontSize: 14 },

  headerCard: {
    marginTop: -24,
    marginHorizontal: H_PADDING,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#1A1A1A", marginBottom: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  addressText: { flex: 1, color: "#666666", lineHeight: 20, fontSize: 14 },
  favoriteButtonCard: { padding: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E6E6E6",
    gap: 6,
  },
  metaChipText: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  metaChipPrimary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#7B2C2C",
    gap: 6,
  },
  metaChipTextPrimary: { fontSize: 13, fontWeight: "700", color: "#fff" },

  card: {
    marginTop: 16,
    marginHorizontal: H_PADDING,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  description: { color: "#666666", lineHeight: 24, fontSize: 15 },

  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  menuIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginBottom: 4 },
  menuDesc: { color: "#666666", lineHeight: 20, fontSize: 13 },
  menuPricePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7B2C2C",
    minWidth: 80,
  },
  menuPriceText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  menuPriceSub: { color: "#fff", opacity: 0.9, fontSize: 12 },

  controlsContainer: { flexDirection: "row", gap: 12, marginBottom: 16 },
  controlCard: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  controlLabel: { fontSize: 12, fontWeight: "600", color: "#666666", marginBottom: 8 },
  dateControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  partyControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  disabled: { opacity: 0.4 },
  dateDisplay: { alignItems: "center" },
  dateText: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  dayText: { fontSize: 11, color: "#666666", marginTop: 2 },
  partyDisplay: { flexDirection: "row", alignItems: "center", gap: 6 },
  partyText: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },

  slotsLoading: { alignItems: "center", paddingVertical: 20, gap: 8 },
  slotsLoadingText: { color: "#666666", fontSize: 13 },
  slotsList: { paddingVertical: 8 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E6E6E6",
    gap: 6,
  },
  slotDisabled: { opacity: 0.4 },
  slotSelected: { backgroundColor: "#7B2C2C", borderColor: "#7B2C2C" },
  slotText: { fontWeight: "700", color: "#1A1A1A", fontSize: 14 },
  slotTextSelected: { color: "#fff" },

  emptyStateSmall: { alignItems: "center", gap: 8, paddingVertical: 16 },
  muted: { color: "#888888", fontSize: 13 },

  contactItem: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  contactText: { color: "#1A1A1A", fontSize: 14 },

  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ctaTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  ctaTitle: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  ctaSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctaSub: { fontSize: 13, color: "#666666" },

  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
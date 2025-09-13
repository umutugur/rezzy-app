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
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { lightTheme } from "../theme/theme";
import {
  getRestaurant,
  getAvailability,
  type Restaurant as ApiRestaurant,
  type AvailabilitySlot,
} from "../api/restaurants";
import { useReservation } from "../store/useReservation";

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
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const restaurantId: string = route.params?.id ?? route.params?.restaurantId ?? "";

  const setRestaurant = useReservation?.((s: any) => s.setRestaurant) ?? (() => {});
  const setDateTime = useReservation?.((s: any) => s.setDateTime) ?? (() => {});
  const setParty = useReservation?.((s: any) => s.setParty) ?? (() => {});
  const setMenu = useReservation?.((s: any) => s.setMenu) ?? (() => {});
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
    return () => { alive = false; };
  }, [restaurantId]);

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
    return () => { alive = false; };
  }, [restaurantId, date, partySize]);

  const photos = useMemo(() => (r?.photos || []).filter(Boolean), [r]);
  const menus = useMemo(() => (r?.menus || []).filter((m) => m && (m.isActive ?? true)), [r]);
  const minMenuPrice = useMemo(
    () => (menus.length ? Math.min(...menus.map((m) => m.pricePerPerson)) : undefined),
    [menus]
  );

  const onSelectSlot = (s: AvailabilitySlot) => {
    if (!s.isAvailable) return;
    setSelectedSlot(s);
  };

  const onContinue = () => {
  if (!selectedSlot || !r) return;

  // label içinden saat al (örn. "13:30")
  const [h, m] = selectedSlot.label.split(":");
  const localDateTime = dayjs(date)
    .hour(Number(h))
    .minute(Number(m))
    .second(0)
    .toISOString();

  setRestaurant(r._id);
  setDateTime(localDateTime); // artık UTC kayması yok
  setParty(partySize);
  nav.navigate("Rezervasyon - Menü");
};

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PHOTO_W);
    setActivePhoto(Math.max(0, Math.min(idx, photos.length - 1)));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lightTheme.colors.primary} />
      </View>
    );
  }
  if (!r) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Restoran bulunamadı.</Text>
        <View style={{ height: 10 }} />
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ÜSTTE: Başlık Kartı (adı + chip'ler + puan + adres) */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{r.name}</Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>
                {Number.isFinite(r.rating) ? Number(r.rating).toFixed(1) : "—"}
              </Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            {!!r.city && <Text style={styles.metaChip}>{r.city}</Text>}
            {!!r.priceRange && <Text style={styles.metaChip}>{r.priceRange}</Text>}
            {typeof minMenuPrice === "number" && (
              <Text style={[styles.metaChip, styles.metaChipPrimary]}>
                ₺{minMenuPrice.toLocaleString("tr-TR")}+
              </Text>
            )}
          </View>
          {!!r.address && <Text style={styles.addressText}>{r.address}</Text>}
        </View>

        {/* ALTTA: Galeri */}
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
                renderItem={({ item }) => <Image source={{ uri: item }} style={styles.photoFull} />}
              />
              {/* hafif alt gradient + dots (fotoğraf okunabilirliği, overlay yok) */}
              <View style={styles.gradBottom} />
              <View style={styles.dots}>
                {photos.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : (
            <View style={{ paddingHorizontal: H_PADDING, paddingTop: 8 }}>
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>Fotoğraf bulunamadı</Text>
              </View>
            </View>
          )}
        </View>

        {/* Açıklama */}
        {!!r.description && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hakkında</Text>
            <Text style={styles.description}>{r.description}</Text>
          </View>
        )}

        {/* Fix Menüler */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fix Menüler</Text>
          {menus.length === 0 ? (
            <Text style={styles.muted}>Bu restoran için menü bulunamadı.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {menus.map((m) => (
                <View key={`${m._id || m.title}`} style={styles.menuCard}>
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
          <Text style={styles.sectionTitle}>Uygun Saat Bul</Text>

          <View style={styles.controlsRow}>
  {/* Tarih kontrolleri (sol) */}
  <View style={styles.dateControls}>
    <TouchableOpacity
      onPress={() => setDate(dayjs(date).subtract(1, "day").format("YYYY-MM-DD"))}
      disabled={dayjs(date).isSame(dayjs(), "day")}
      style={[styles.iconBtn, dayjs(date).isSame(dayjs(), "day") && styles.disabled]}
    >
      <Text style={styles.iconText}>{"<"}</Text>
    </TouchableOpacity>

    <Text
      style={styles.dateText}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {dayjs(date).format("DD Eyl YYYY ddd")} {/* örnek; senin formatını koru */}
    </Text>

    <TouchableOpacity
      onPress={() => setDate(dayjs(date).add(1, "day").format("YYYY-MM-DD"))}
      style={styles.iconBtn}
    >
      <Text style={styles.iconText}>{">"}</Text>
    </TouchableOpacity>
  </View>

  {/* Kişi kontrolleri (sağ) */}
  <View style={styles.partyControls}>
    <TouchableOpacity
      onPress={() => setPartySize((p) => Math.max(1, p - 1))}
      style={[styles.iconBtn, partySize <= 1 && styles.disabled]}
    >
      <Text style={styles.iconText}>-</Text>
    </TouchableOpacity>

    <Text style={styles.partyText}>Kişi: {partySize}</Text>

    <TouchableOpacity onPress={() => setPartySize((p) => p + 1)} style={styles.iconBtn}>
      <Text style={styles.iconText}>+</Text>
    </TouchableOpacity>
  </View>
</View>


          {fetchingSlots ? (
            <ActivityIndicator color={lightTheme.colors.primary} />
          ) : (
            <FlatList
              data={slots}
              horizontal
              keyExtractor={(s) => s.timeISO}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => {
                const isSelected = selectedSlot?.timeISO === item.timeISO;
                const disabled = !item.isAvailable;
                return (
                  <TouchableOpacity
                    onPress={() => onSelectSlot(item)}
                    disabled={disabled}
                    style={[
                      styles.slot,
                      disabled && styles.slotDisabled,
                      isSelected && styles.slotSelected,
                    ]}
                  >
                    <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.muted}>Uygun saat bulunamadı.</Text>}
            />
          )}
        </View>

        {/* İletişim */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>İletişim</Text>
          <Text style={styles.contactText}>{r.phone ? `Tel: ${r.phone}` : "Telefon bilgisi yok"}</Text>
          <Text style={styles.contactText}>{r.address || "Adres bilgisi yok"}</Text>
        </View>
      </ScrollView>

      {/* Sticky CTA bar — geniş buton, solda sadece tarih&saat + kişi */}
      <View style={styles.ctaBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>
             {selectedSlot ? `${dayLabel}, ${selectedSlot.label}` : "Tarih & Saat seç"}
          </Text>
          <Text style={styles.ctaSub}>Kişi: {partySize}</Text>
        </View>

        <TouchableOpacity
          onPress={onContinue}
          disabled={!selectedSlot}
          style={[styles.ctaBtn, !selectedSlot && styles.ctaBtnDisabled]}
        >
          <Text style={styles.ctaBtnText}>Devam Et</Text>
        </TouchableOpacity>
      </View>
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
  screen: { backgroundColor: lightTheme.colors.background, flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightTheme.colors.background,
    padding: 16,
  },
  emptyText: { color: lightTheme.colors.textSecondary },

  // Üst başlık kartı
  headerCard: {
    marginTop: 12,
    marginHorizontal: H_PADDING,
    padding: 16,
    borderRadius: 16,
    backgroundColor: lightTheme.colors.surface,
    ...cardShadow,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: "800", color: lightTheme.colors.text },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    color: lightTheme.colors.text,
  },
  metaChipPrimary: {
    backgroundColor: lightTheme.colors.primary,
    color: "#fff",
    borderColor: lightTheme.colors.primary,
  },
  addressText: { marginTop: 8, color: lightTheme.colors.textSecondary, lineHeight: 20 },

  ratingBadge: {
    backgroundColor: lightTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingText: { color: "#fff", fontWeight: "800" },

  // Galeri
  galleryWrap: {
    position: "relative",
    backgroundColor: lightTheme.colors.surface,
    marginTop: 12,
  },
  photoFull: {
    width: PHOTO_W,
    height: PHOTO_H,
    backgroundColor: lightTheme.colors.muted,
  },
  gradBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    height: 5,
    width: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: { backgroundColor: "#fff", width: 26 },

  // Genel kart
  card: {
    marginTop: 12,
    marginHorizontal: H_PADDING,
    padding: 16,
    borderRadius: 16,
    backgroundColor: lightTheme.colors.surface,
    ...cardShadow,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
    color: lightTheme.colors.text,
  },
  description: { color: lightTheme.colors.textSecondary, lineHeight: 22 },

  // Menü kartları
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    ...cardShadow,
  },
  menuTitle: { fontSize: 15, fontWeight: "700", color: lightTheme.colors.text },
  menuDesc: { marginTop: 4, color: lightTheme.colors.textSecondary, lineHeight: 20 },
  menuPricePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: lightTheme.colors.primary,
    minWidth: 92,
  },
  menuPriceText: { color: "#fff", fontWeight: "800" },
  menuPriceSub: { color: "#fff", opacity: 0.9, fontSize: 12 },

  // Uygun saatler
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
    flexWrap: "wrap", // dar ekranlarda alt satıra iner
  },
  dateControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    flex: 1,
  },
  partyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  disabled: { opacity: 0.45 },
  iconText: { fontSize: 16, fontWeight: "800", color: lightTheme.colors.text },
  dateText: {
    fontWeight: "700",
    color: lightTheme.colors.text,
    paddingHorizontal: 6,
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
  },
  partyText: {
    color: lightTheme.colors.text,
    minWidth: 70,
    textAlign: "center",
    fontWeight: "600",
  },

  slot: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginRight: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  slotDisabled: { opacity: 0.35 },
  slotSelected: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderColor: lightTheme.colors.primary,
  },
  slotText: { fontWeight: "700", color: lightTheme.colors.text },
  slotTextSelected: { color: lightTheme.colors.primary },

  contactText: { marginBottom: 2, color: lightTheme.colors.textSecondary, lineHeight: 20 },
  muted: { color: lightTheme.colors.textSecondary, paddingHorizontal: 4 },

  // Sticky CTA bar
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: H_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...cardShadow,
  },
  ctaTitle: { fontWeight: "800", color: lightTheme.colors.text },
  ctaSub: { color: lightTheme.colors.textSecondary },

  // Geniş & dengeli CTA butonu
  ctaBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: lightTheme.colors.primary,
    minWidth: 148,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { color: "#fff", fontWeight: "800" },

  // Fotoğraf yoksa
  photoPlaceholder: {
    height: PHOTO_H,
    borderRadius: 12,
    backgroundColor: lightTheme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: { color: lightTheme.colors.textSecondary },
});

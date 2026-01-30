// src/components/GetStartedModal.tsx
import React from "react";
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StyleSheet,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useGetStarted } from "../store/useGetStarted";

const SLIDES = [
  {
    key: "1",
    title: "Ana ekran ve hızlı erişim",
    body:
      "Rezvix ana ekranında paket servis butonu, kategori kısayolları ve keşfet alanı yer alır. " +
      "Buradan tek dokunuşla ihtiyaç duyduğun bölüme geçebilir, restoranları hızlıca incelemeye başlayabilirsin.",
    image: require("../assets/getStarted/1.png"),
  },
  {
    key: "2",
    title: "Keşfet ve listeleme",
    body:
      "Keşfet ekranında filtreler ve kart görünümüyle restoranları kolayca karşılaştırırsın. " +
      "Bölgeye göre sonuçları daraltabilir, menü ve detaylara hızlıca ulaşabilirsin.",
    image: require("../assets/getStarted/2.png"),
  },
  {
    key: "3",
    title: "Haritada yakınındaki mekanlar",
    body:
      "Harita görünümünde etrafındaki mekanları konuma göre görürsün. " +
      "Uygun noktayı seçerek en yakın restoranları keşfedebilir, mesafeye göre karar verebilirsin.",
    image: require("../assets/getStarted/3.png"),
  },
  {
    key: "4",
    title: "QR menü ile sipariş",
    body:
      "Mekandayken QR menüden siparişini oluşturabilir, kartla ödeme veya mekanda ödeme seçeneklerinden birini seçebilirsin. " +
      "Sipariş sürecini tek ekranda yönetirsin.",
    image: require("../assets/getStarted/4.png"),
  },
  {
    key: "5",
    title: "Teslimat adreslerini yönet",
    body:
      "Paket servis için adres ekleyebilir, düzenleyebilir ve varsayılan adresini belirleyebilirsin. " +
      "Sipariş verirken doğru adresin otomatik seçilmesini sağlarsın.",
    image: require("../assets/getStarted/5.png"),
  },
  {
    key: "6",
    title: "Paket servis ekranı",
    body:
      "Teslimat adresini gör, restoran ara ve paket servis siparişini hızlıca başlat. " +
      "Liste üzerinden fiyat, süre ve minimum tutar bilgilerini karşılaştırabilirsin.",
    image: require("../assets/getStarted/6.png"),
  },
  {
    key: "7",
    title: "Ödeme yöntemi seçimi",
    body:
      "Ödeme adımında online ödeme ya da kapıda kart/nakit seçeneklerinden birini seçersin. " +
      "Böylece siparişini güvenli ve esnek şekilde tamamlayabilirsin.",
    image: require("../assets/getStarted/7.png"),
  },
];

const { width, height } = Dimensions.get("window");
const IMAGE_HEIGHT = Math.min(
  Math.round(height * 0.6),
  Math.round(width * 1.15),
  520
);

export default function GetStartedModal() {
  const { isOpen, close, markSeen } = useGetStarted();
  const listRef = React.useRef<FlatList>(null);
  const [index, setIndex] = React.useState(0);
  const insets = useSafeAreaInsets();

  const closeAndRemember = React.useCallback(() => {
    markSeen().catch(() => {});
    close();
  }, [close, markSeen]);

  React.useEffect(() => {
    if (isOpen) {
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [isOpen]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, SLIDES.length - 1));
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    setIndex(clamped);
  };

  const onNext = () => {
    if (index >= SLIDES.length - 1) {
      closeAndRemember();
      return;
    }
    goTo(index + 1);
  };

  const onPrev = () => {
    if (index <= 0) return;
    goTo(index - 1);
  };

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={closeAndRemember}>
      <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
          <View style={{ width: 80 }} />
          <Text style={styles.headerTitle}>Nasıl Kullanılır</Text>
          <TouchableOpacity onPress={closeAndRemember} activeOpacity={0.8} style={styles.skipBtn}>
            <Text style={styles.skipText}>Atla</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={styles.imageWrap}>
                <Image source={item.image} style={styles.image} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                i === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            onPress={onPrev}
            activeOpacity={0.8}
            style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
            disabled={index === 0}
          >
            <Ionicons name="chevron-back" size={18} color={index === 0 ? "#9CA3AF" : "#fff"} />
            <Text style={[styles.navText, index === 0 && styles.navTextDisabled]}>Geri</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onNext} activeOpacity={0.9} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>
              {index === SLIDES.length - 1 ? "Başla" : "İleri"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: T.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: T.colors.text,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.colors.border,
    backgroundColor: "#fff",
  },
  skipText: {
    color: T.colors.textSecondary,
    fontWeight: "700",
  },
  slide: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  imageWrap: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    ...T.shadows.md,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
    backgroundColor: "#fff",
  },
  title: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: "800",
    color: T.colors.text,
    textAlign: "center",
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    color: T.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: T.colors.primary,
  },
  dotInactive: {
    backgroundColor: "#E5E7EB",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: T.colors.primary,
  },
  navBtnDisabled: {
    backgroundColor: "#F3F4F6",
  },
  navText: {
    fontWeight: "700",
    color: "#fff",
  },
  navTextDisabled: {
    color: "#9CA3AF",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: T.colors.primary,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
  },
});

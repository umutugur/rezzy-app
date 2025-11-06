// src/screens/ProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { lightTheme as T } from "../theme/theme";
import { useAuth } from "../store/useAuth";
import { getMyReservations } from "../api/reservations";
import { getMe, patchMe, uploadAvatarRN, changePassword } from "../api/user";
import { checkinByQR, checkinManual } from "../api/restaurantTools";
import { useNavigation } from "@react-navigation/native";
// ✅ Favori API'leri
import { listFavorites, removeFavorite, type FavoriteRestaurant } from "../api/favorites";

/** para formatı */
const Money = ({ n }: { n?: number }) => (
  <Text style={{ fontWeight: "800", color: T.colors.text }}>
    {n == null ? "₺0" : `₺${Number(n).toLocaleString("tr-TR")}`}
  </Text>
);

/** durum → {label,color} */
const statusMeta = (s: string) => {
  switch (String(s)) {
    case "pending":
      return { label: "Beklemede", bg: "#FEF3C7", fg: "#92400E" };
    case "confirmed":
      return { label: "Onaylı", bg: "#DCFCE7", fg: "#166534" };
    case "arrived":
      return { label: "Giriş Yapıldı", bg: "#DBEAFE", fg: "#1E40AF" };
    case "no_show":
      return { label: "Gelmedi", bg: "#FEE2E2", fg: "#991B1B" };
    case "cancelled":
      return { label: "İptal", bg: "#F3F4F6", fg: "#374151" };
    default:
      return { label: s, bg: "#EEE", fg: "#111" };
  }
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, updateUser, clear } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [prefs, setPrefs] = useState({
    push: user?.notificationPrefs?.push ?? true,
    sms: user?.notificationPrefs?.sms ?? false,
    email: user?.notificationPrefs?.email ?? false,
  });
  const [providers, setProviders] = useState<string[]>(user?.providers || []);
  const [resv, setResv] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ Favoriler
  const [favs, setFavs] = useState<FavoriteRestaurant[]>([]);
  const [favBusyId, setFavBusyId] = useState<string | null>(null);

  // şifre alanları
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNew2, setShowNew2] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // QR modal (kamera)
  const [qrOpen, setQrOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // QR sonrası arrived modalı
  const [qrArrivedOpen, setQrArrivedOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState<any>(null);
  const [qrArrivedInput, setQrArrivedInput] = useState("");

  // Manuel check-in modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualRid, setManualRid] = useState("");
  const [manualArrived, setManualArrived] = useState("");

  // ✅ Uygulama stiline uygun mesaj modalı (bilgi & hata & uyarı)
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgKind, setMsgKind] = useState<"info" | "error" | "warn">("info");
  const [msgOnRetry, setMsgOnRetry] = useState<null | (() => void)>(null);
  const [msgRetryLabel, setMsgRetryLabel] = useState<string>("Tekrar Dene");
  const showMsg = (title: string, body?: string) => {
    setMsgKind("info");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(null);
    setMsgOpen(true);
  };
  const showError = (title: string, body?: string, onRetry?: () => void, retryLabel: string = "Tekrar Dene") => {
    setMsgKind("error");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(onRetry || null);
    setMsgRetryLabel(retryLabel);
    setMsgOpen(true);
  };
  const showWarn = (title: string, body?: string) => {
    setMsgKind("warn");
    setMsgTitle(title);
    setMsgBody(body || "");
    setMsgOnRetry(null);
    setMsgOpen(true);
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        updateUser(me);
        setName(me.name || "");
        setEmail(me.email || "");
        setPhone(me.phone || "");
        setAvatarUrl(me.avatarUrl || null);
        setPrefs({
          push: me.notificationPrefs?.push ?? true,
          sms: me.notificationPrefs?.sms ?? false,
          email: me.notificationPrefs?.email ?? true,
        });
        setProviders(me.providers || []);
      } catch {}
      try {
        const list = await getMyReservations();
        setResv(list);
      } catch {}
      // ✅ Favoriler
      try {
        if (user?.role === "customer") {
          const fl = await listFavorites();
          setFavs(fl || []);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSave() {
    try {
      setLoading(true);
      const me = await patchMe({ name, email, phone, notificationPrefs: prefs });
      updateUser(me);
      Alert.alert("Kaydedildi", "Profiliniz güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Güncelleme başarısız");
    } finally {
      setLoading(false);
    }
  }

  async function onChangePassword() {
    try {
      if (!curPw || !newPw || !newPw2) {
        Alert.alert("Eksik", "Lütfen tüm şifre alanlarını doldurun.");
        return;
      }
      if (newPw.length < 8) {
        Alert.alert("Zayıf şifre", "Yeni şifre en az 8 karakter olmalı.");
        return;
      }
      if (newPw !== newPw2) {
        Alert.alert("Uyumsuz", "Yeni şifreler birbiriyle aynı olmalı.");
        return;
      }
      setPwLoading(true);
      await changePassword(curPw, newPw);
      setCurPw(""); setNewPw(""); setNewPw2("");
      Alert.alert("Tamam", "Şifreniz güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Şifre değiştirilemedi");
    } finally {
      setPwLoading(false);
    }
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    try {
      const url = await uploadAvatarRN({
        uri: a.uri,
        name: (a as any).fileName || "avatar.jpg",
        type: (a as any).mimeType || "image/jpeg",
      });
      setAvatarUrl(url);
      updateUser({ avatarUrl: url });
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Avatar yüklenemedi");
    }
  }

  // ---- Bildirim izin / tercih kontrolü ----
  async function togglePushPref() {
    try {
      // Eğer açılacaksa izinleri kontrol et
      if (!prefs.push) {
        const current = await Notifications.getPermissionsAsync();
        let granted = current.status === "granted";
        if (!granted) {
          const req = await Notifications.requestPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted) {
          Alert.alert("İzin gerekli", "Push bildirimleri açmak için bildirim izni vermelisiniz.");
          return;
        }
        // izin var → aç
        setPrefs((p) => ({ ...p, push: true }));
        try {
          await patchMe({ notificationPrefs: { ...prefs, push: true } });
        } catch {}
      } else {
        // kapat
        setPrefs((p) => ({ ...p, push: false }));
        try {
          await patchMe({ notificationPrefs: { ...prefs, push: false } });
        } catch {}
      }
    } catch (e) {
      Alert.alert("Hata", "Bildirim tercihi güncellenemedi.");
    }
  }
  // ---- Restoran kısayolları ----
  async function ensureCam() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) Alert.alert("İzin gerekli", "QR okumak için kamera izni gerekiyor.");
    }
  }

  function ReservationMini({ it }: { it: any }) {
    const m = statusMeta(it.status);
    return (
      <View style={{ paddingVertical: 12, borderTopWidth: 1, borderColor: T.colors.border, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "800", color: T.colors.text }}>
            {dayjs(it.dateTimeUTC).format("DD MMM YYYY HH:mm")} • {it.partySize} kişi
          </Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: m.bg }}>
            <Text style={{ color: m.fg, fontWeight: "800", fontSize: 12 }}>{m.label}</Text>
          </View>
        </View>
        <Text style={{ color: T.colors.textSecondary }}>{String(it?.restaurantId?.name || "Restoran")}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: T.colors.textSecondary }}>Toplam</Text>
          <Money n={it.totalPrice} />
        </View>
      </View>
    );
  }

  // ✅ Favori satırı
  function FavoriteRow({ it }: { it: FavoriteRestaurant }) {
    const thumb = it.photos?.[0];
    const busy = favBusyId === it._id;
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderColor: T.colors.border,
        }}
      >
        <Image
          source={thumb ? { uri: thumb } : require("../assets/restaurant-placeholder.png")}
          style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: T.colors.muted }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.colors.text, fontWeight: "800" }}>{it.name}</Text>
          <Text style={{ color: T.colors.textSecondary }}>
            {[it.city, it.priceRange].filter(Boolean).join(" • ")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <SecondaryButton
            title={busy ? "…" : "Kaldır"}
            onPress={async () => {
              if (busy) return;
              try {
                setFavBusyId(it._id);
                // optimistic
                setFavs((prev) => prev.filter((f) => f._id !== it._id));
                await removeFavorite(it._id);
              } catch (e: any) {
                // geri al
                setFavs((prev) => (prev.some((f) => f._id === it._id) ? prev : [it, ...prev]));
                Alert.alert("Hata", e?.response?.data?.message || e?.message || "Kaldırılamadı");
              } finally {
                setFavBusyId(null);
              }
            }}
          />
          <PrimaryButton title="Git" onPress={() => navigation.navigate("Restoran", { id: it._id })} />
        </View>
      </View>
    );
  }

  const isRestaurant = user?.role === "restaurant";

  // ---- Sayaçlar (müşteri) ----
  const counts = useMemo(() => {
    const c = { upcoming: 0, confirmed: 0, cancelled: 0, total: resv.length, spending: 0 };
    resv.forEach((r) => {
      if (r.status === "confirmed" || r.status === "pending") c.upcoming++;
      if (r.status === "confirmed") c.confirmed++;
      if (r.status === "cancelled") c.cancelled++;
      c.spending += Number(r.totalPrice || 0);
    });
    return c;
  }, [resv]);

  // ---- Çıkış ----
  function logout() {
    Alert.alert("Çıkış yap", "Hesabından çıkmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Evet",
        style: "destructive",
        onPress: async () => {
          await clear(); // store + storage temizlenir
          // ❗️Stack'te olduğumuz ekranı da misafir root'una resetleyelim
          navigation.reset({ index: 0, routes: [{ name: "TabsGuest" }] });
        },
      },
    ]);
  }

  // --- Yasal & Destek navigasyon kısayolları ---
  const goTerms = () => navigation.navigate("Terms");
  const goPrivacy = () => navigation.navigate("Privacy");
  const goSupport = () => navigation.navigate("Help");
  const goContact = () => navigation.navigate("Contact");
  const goLicenses = () => navigation.navigate("Licenses");
  const goAbout = () => navigation.navigate("About");
  const goDelete = () => navigation.navigate("DeleteAccount");

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }} style={{ flex: 1, backgroundColor: T.colors.background }}>
      {/* Kapak */}
      <View
        style={{
          backgroundColor: T.colors.primary,
          paddingHorizontal: 16,
          paddingTop: 28,
          paddingBottom: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>Profil</Text>
          <TouchableOpacity
            onPress={logout}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.35)",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Çıkış yap</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            <Image
              source={avatarUrl ? { uri: avatarUrl } : require("../assets/avatar-placeholder.png")}
              style={{
                width: 78,
                height: 78,
                borderRadius: 999,
                backgroundColor: "#ffffff22",
                borderWidth: 2,
                borderColor: "#ffffff55",
              }}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>{name || "(İsimsiz)"}</Text>
            <Text style={{ color: "#fff", opacity: 0.9 }}>{user?.email || user?.phone || "-"}</Text>
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {user?.role === "customer" ? "Müşteri" : user?.role === "restaurant" ? "Restoran" : "Admin"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stat kartları (müşteri) */}
      {user?.role === "customer" ? (
        <View style={{ paddingHorizontal: 16, marginTop: 14, flexDirection: "row", gap: 10 }}>
          <StatCard title="Gelecek" value={String(counts.upcoming)} />
          <StatCard title="Onaylı" value={String(counts.confirmed)} />
          <StatCard title="İptal" value={String(counts.cancelled)} />
        </View>
      ) : null}

      {/* Müşteri formu */}
      {user?.role === "customer" && (
        <Section title="Profil Bilgileri">
          <Label>Ad Soyad</Label>
          <TextInput value={name} onChangeText={setName} style={inputStyle} />

          <Label>E-posta</Label>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={inputStyle}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Label>Telefon</Label>
          <TextInput value={phone} onChangeText={setPhone} style={inputStyle} keyboardType="phone-pad" />

          <Text style={{ fontWeight: "800", fontSize: 16, marginTop: 12, color: T.colors.text }}>
            Bildirim Tercihleri
          </Text>
          <Toggle label="Anlık Bildirimler" value={!!prefs.push} onChange={togglePushPref} />
          <Toggle label="SMS (yakında)" value={!!prefs.sms} onChange={() => {}} disabled />
          <Toggle label="E-posta (yakında)" value={!!prefs.email} onChange={() => {}} disabled />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton title={loading ? "Kaydediliyor..." : "Kaydet"} onPress={onSave} />
          </View>
        </Section>

      )}

      {/* Şifre Değiştirme — yalnız password provider */}
      {providers?.includes("password") && (
        <Section title="Şifre Değiştirme">
          {/* mevcut şifre */}
          <Label>Mevcut Şifre</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={curPw}
              onChangeText={setCurPw}
              style={inputStyle}
              secureTextEntry={!showCur}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowCur((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons name={showCur ? "eye-off" : "eye"} size={20} color={T.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* yeni şifre */}
          <Label>Yeni Şifre</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={newPw}
              onChangeText={setNewPw}
              style={inputStyle}
              secureTextEntry={!showNew}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNew((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons name={showNew ? "eye-off" : "eye"} size={20} color={T.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* yeni şifre tekrar */}
          <Label>Yeni Şifre (Tekrar)</Label>
          <View style={{ position: "relative" }}>
            <TextInput
              value={newPw2}
              onChangeText={setNewPw2}
              style={inputStyle}
              secureTextEntry={!showNew2}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNew2((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
            >
              <Ionicons name={showNew2 ? "eye-off" : "eye"} size={20} color={T.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton title={pwLoading ? "Güncelleniyor..." : "Şifreyi Güncelle"} onPress={onChangePassword} />
          </View>
        </Section>
      )}

      {/* ✅ Favorilerim (müşteri) */}
      {user?.role === "customer" && (
        <Section title="Favorilerim">
          {favs?.length ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: T.colors.textSecondary }}>Toplam</Text>
                <Text style={{ fontWeight: "700", color: T.colors.text }}>{favs.length}</Text>
              </View>
              {favs.map((it) => (
                <FavoriteRow key={it._id} it={it} />
              ))}
            </>
          ) : (
            <Text style={{ color: T.colors.textSecondary }}>Henüz favori eklemediniz.</Text>
          )}
        </Section>
      )}

      {/* Rezervasyonlar (müşteri) */}
      {user?.role === "customer" && (
        <Section title="Rezervasyonlarım">
          {resv?.length ? (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                <Text style={{ color: T.colors.textSecondary }}>Toplam</Text>
                <Text style={{ fontWeight: "700", color: T.colors.text }}>{resv.length}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: T.colors.textSecondary }}>Toplam Harcama</Text>
                <Money n={counts.spending} />
              </View>
              {resv.map((it) => (
                <ReservationMini it={it} key={String(it._id)} />
              ))}
            </>
          ) : (
            <Text style={{ color: T.colors.textSecondary }}>Henüz rezervasyon yok.</Text>
          )}
        </Section>
      )}

      {/* Restoran & Admin kısa yolları */}
      {(user?.role === "restaurant" || user?.role === "admin") && (
        <Section title="Yönetim Kısayolları">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {user?.role === "restaurant" && (
              <PrimaryButton
                title="Restoran Paneli"
                onPress={() => navigation.navigate("RestaurantPanel", {
  screen: "RestaurantHub",
  params: { restaurantId: user?.restaurantId },
})}
              />
            )}
            {user?.role === "admin" && <PrimaryButton title="Admin Paneli" onPress={() => navigation.navigate("AdminPanel")} />}

            {/* Ortak kısa yollar (restoran için QR / manuel check-in) */}
            {isRestaurant && (
              <>
                <PrimaryButton
                  title="QR Tara"
                  onPress={async () => {
                    await ensureCam();
                    setQrOpen(true);
                  }}
                />
                <SecondaryButton
                  title="Manuel Check-in"
                  onPress={() => {
                    setManualRid("");
                    setManualArrived("");
                    setManualOpen(true);
                  }}
                />
              </>
            )}
          </View>
        </Section>
      )}

      {/* --- Yasal & Destek (liste kartı) --- */}
      <Section title="Yasal ve Destek">
        <ListCard>
          <ListRow icon="file-document-outline" label="Kullanım Koşulları" onPress={goTerms} />
          <Divider />
          <ListRow icon="shield-lock-outline" label="Gizlilik Politikası" onPress={goPrivacy} />
          <Divider />
          <ListRow icon="lifebuoy" label="Yardım & Destek" onPress={goSupport} />
          <Divider />
          <ListRow icon="email-outline" label="İletişim" onPress={goContact} />
          <Divider />
          <ListRow icon="certificate-outline" label="Lisanslar" onPress={goLicenses} />
          <Divider />
          <ListRow icon="information-outline" label="Hakkında" onPress={goAbout} />
          <Divider />
          <ListRow icon="trash-can-outline" label="Hesabı Sil" destructive onPress={goDelete} />
        </ListCard>
      </Section>

      {/* Alt kısım Çıkış */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 20 }}>
        <SecondaryButton title="Çıkış yap" onPress={logout} />
      </View>

      {/* QR Kamera Modalı */}
      <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={async (ev: any) => {
              try {
                const data = ev?.data || "";
                setQrOpen(false);
                setQrPayload(data);
                setQrArrivedInput("");
                setQrArrivedOpen(true);
              } catch (e: any) {
                setQrOpen(false);
                showError(
                  "Geçersiz QR",
                  e?.response?.data?.message || e?.message || "QR kodu doğrulanamadı.",
                  () => {
                    // tekrar tarama
                    setQrOpen(true);
                  },
                  "Tekrar Tara"
                );
              }
            }}
          />
          <View style={{ position: "absolute", top: 40, left: 20 }}>
            <SecondaryButton title="Kapat" onPress={() => setQrOpen(false)} />
          </View>
        </View>
      </Modal>

      {/* QR sonrası Gelen Kişi Sayısı Modalı */}
      <Modal visible={qrArrivedOpen} transparent animationType="fade" onRequestClose={() => setQrArrivedOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: T.colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.colors.text, marginBottom: 10 }}>
              Gelen Kişi Sayısı
            </Text>
            <Text style={{ color: T.colors.textSecondary, marginBottom: 6 }}>
              QR okundu. Lütfen gelen kişi sayısını girin (zorunlu).
            </Text>
            <TextInput
              value={qrArrivedInput}
              onChangeText={setQrArrivedInput}
              placeholder="Örn: 5"
              keyboardType={Platform.select({ ios: "number-pad", android: "numeric" }) as any}
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <SecondaryButton title="Vazgeç" onPress={() => setQrArrivedOpen(false)} />
              <PrimaryButton
                title="Onayla"
                onPress={async () => {
                  const n = Number(qrArrivedInput.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    showWarn("Uyarı", "Geçerli bir sayı girin (0 veya daha büyük).");
                    return;
                  }
                  try {
                    await checkinByQR(qrPayload, n);
                    setQrArrivedOpen(false);
                    setQrPayload(null);
                    setQrArrivedInput("");
                    showMsg("Check-in tamam", "Giriş başarıyla kaydedildi.");
                  } catch (e: any) {
                    showError("Check-in başarısız", e?.response?.data?.message || e?.message || "İşlem tamamlanamadı.");
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Manuel Check-in Modal (arrived zorunlu) */}
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: T.colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: T.colors.text, marginBottom: 10 }}>
              Manuel Check-in
            </Text>
            <Label>Rezervasyon ID (RID)</Label>
            <TextInput
              value={manualRid}
              onChangeText={setManualRid}
              placeholder="64b7… gibi Mongo ObjectId"
              autoCapitalize="none"
              style={inputStyle}
            />
            <Label>Gelen kişi sayısı (zorunlu)</Label>
            <TextInput
              value={manualArrived}
              onChangeText={setManualArrived}
              placeholder="Örn: 4"
              keyboardType={Platform.select({ ios: "number-pad", android: "numeric" }) as any}
              style={inputStyle}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <SecondaryButton title="Vazgeç" onPress={() => setManualOpen(false)} />
              <PrimaryButton
                title="Check-in"
                onPress={async () => {
                  if (!manualRid.trim()) {
                    showWarn("Uyarı", "Rezervasyon ID gerekli.");
                    return;
                  }
                  const n = Number(manualArrived.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    showWarn("Uyarı", "Geçerli bir sayı girin (0 veya daha büyük).");
                    return;
                  }
                  try {
                    await checkinManual(String(manualRid.trim()), n);
                    setManualOpen(false);
                    showMsg("Check-in tamam", "Giriş başarıyla kaydedildi.");
                  } catch (e: any) {
                    showError("İşlem başarısız", e?.response?.data?.message || e?.message || "Check-in gerçekleştirilemedi.");
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* ✅ Uygulama stili mesaj modalı (bilgi/hata/uyarı) */}
      <Modal visible={msgOpen} transparent animationType="fade" onRequestClose={() => setMsgOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor:
                msgKind === "error"
                  ? "#FCA5A5"
                  : msgKind === "warn"
                  ? "#FDE68A"
                  : T.colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color:
                  msgKind === "error"
                    ? "#B91C1C"
                    : msgKind === "warn"
                    ? "#92400E"
                    : T.colors.text,
                marginBottom: 8,
              }}
            >
              {msgTitle || (msgKind === "error" ? "Hata" : msgKind === "warn" ? "Uyarı" : "Bilgi")}
            </Text>
            {!!msgBody && (
              <Text style={{ color: T.colors.textSecondary, marginBottom: 12 }}>{msgBody}</Text>
            )}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
              <SecondaryButton title="Kapat" onPress={() => setMsgOpen(false)} />
              {msgOnRetry ? (
                <PrimaryButton
                  title={msgRetryLabel || "Tekrar Dene"}
                  onPress={() => {
                    const cb = msgOnRetry;
                    setMsgOpen(false);
                    setMsgOnRetry(null);
                    if (cb) cb();
                  }}
                />
              ) : (
                <PrimaryButton title="Tamam" onPress={() => setMsgOpen(false)} />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

/** ------ küçük UI yardımcıları ------ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        marginTop: 16,
        backgroundColor: T.colors.surface,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.colors.border,
        marginHorizontal: 16,
      }}
    >
      <Text style={{ fontWeight: "800", fontSize: 18, marginBottom: 10, color: T.colors.text }}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: T.colors.textSecondary, marginBottom: 6, fontWeight: "600" }}>{children}</Text>;
}

function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: T.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: T.colors.muted,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: T.colors.primary, fontWeight: "800" }}>{title}</Text>
    </TouchableOpacity>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onChange}
      activeOpacity={disabled ? 1 : 0.7}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
    >
      <Text style={{ color: T.colors.text }}>{label}</Text>
      <View
        style={{
          width: 52,
          height: 30,
          borderRadius: 999,
          backgroundColor: value ? T.colors.success : T.colors.border,
          padding: 4,
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
      </View>
    </TouchableOpacity>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: T.colors.border,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: T.colors.textSecondary, fontWeight: "600" }}>{title}</Text>
      <Text style={{ color: T.colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: T.colors.border,
  borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 10,
  backgroundColor: "#fff",
  color: T.colors.text,
} as const;

/** ---- Liste kartı bileşenleri ---- */
function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.colors.border,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: "#EFEFEF" }} />;
}

function ListRow({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 14,
          gap: 12,
          backgroundColor: "#fff",
        }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={destructive ? "#C0392B" : "#6B7280"}
          style={{ width: 24 }}
        />
        <Text
          style={{
            flex: 1,
            color: destructive ? "#C0392B" : T.colors.text,
            fontWeight: destructive ? "800" : "600",
          }}
        >
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}
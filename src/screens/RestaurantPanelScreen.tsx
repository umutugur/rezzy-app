// screens/RestaurantPanelScreen.tsx
// Bu ekran restoran sahiplerinin yönetim panelidir. Buradan genel bilgiler,
// menüler, masalar, çalışma saatleri ve rezervasyon politikaları düzenlenebilir.
// Bu sürümde ayrıca rezervasyon listesi, dekont önizleme ve QR ile check-in bulunur.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Linking,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import dayjs from "dayjs";
import "dayjs/locale/tr";

import { lightTheme } from "../theme/theme";
import {
  getRestaurant,
  updateRestaurant,
  updateOpeningHours,
  updateTables,
  updatePolicies,
  updateMenus,
  addPhoto,
  removePhoto,
  type OpeningHour,
} from "../api/restaurants";
import {
  fetchReservationsByRestaurant,
  updateReservationStatus,
  type Reservation,
} from "../api/reservations";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { checkinByQR, checkinManual } from "../api/restaurantTools";
import { api } from "../api/client"; // ham axios yanıtını/logları görmek için
const DEBUG_RES = true;

dayjs.locale("tr");

// Varsayılan çalışma saatleri (10:00 - 23:00 arası, her gün açık)
const DEFAULT_OPENING_HOURS: OpeningHour[] = Array.from({ length: 7 }, (_, i) => ({
  day: i,
  open: "10:00",
  close: "23:00",
  isClosed: false,
}));

// Küçük sekme bileşeni
function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function RestaurantPanelScreen() {
  const route = useRoute<any>();
  const restaurantId: string = route.params?.restaurantId || route.params?.id;

  // Genel bilgiler
  const [name, setName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [iban, setIban] = useState<string>("");
  const [ibanName, setIbanName] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");

  // Fotoğraflar
  const [photos, setPhotos] = useState<string[]>([]);

  // Menüler
  type MenuItem = { _id?: string; title: string; description?: string; pricePerPerson: number; isActive?: boolean };
  const [menus, setMenus] = useState<MenuItem[]>([]);

  // Masalar
  type Table = { name: string; capacity: number; isActive?: boolean };
  const [tables, setTables] = useState<Table[]>([]);

  // Çalışma saatleri
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(DEFAULT_OPENING_HOURS);

  // Politikalar
  const [minPartySize, setMinPartySize] = useState<number>(1);
  const [maxPartySize, setMaxPartySize] = useState<number>(8);
  const [slotMinutes, setSlotMinutes] = useState<number>(90);
  const [depositRequired, setDepositRequired] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState<string>("");

  // Rezervasyonlar
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resLoading, setResLoading] = useState<boolean>(false);

  // QR Check-in durumu
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState<boolean>(false);

  // QR akışı için ek state (ProfileScreen ile aynı mantık)
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [arrivedModalOpen, setArrivedModalOpen] = useState<boolean>(false);
  const [arrivedInput, setArrivedInput] = useState<string>("");

  // Sekme kontrolü
  const [activeTab, setActiveTab] = useState<string>("general");

  // Restoran verisini yükle
  useEffect(() => {
    async function loadRestaurant() {
      try {
        const r: any = await getRestaurant(restaurantId);
        setName(r.name || "");
        setCity(r.city || "");
        setAddress(r.address || "");
        setPhone(r.phone || "");
        setEmail(r.email || "");
        setPriceRange(r.priceRange || "");
        setDescription(r.description || "");
        setIban(r.iban || "");
        setIbanName((r as any).ibanName || "");
        setBankName((r as any).bankName || "");
        setPhotos(r.photos || []);
        setMenus(r.menus || []);
        setTables(r.tables || []);
        setOpeningHours(r.openingHours?.length ? r.openingHours : DEFAULT_OPENING_HOURS);
        setMinPartySize((r as any).minPartySize ?? 1);
        setMaxPartySize((r as any).maxPartySize ?? 8);
        setSlotMinutes((r as any).slotMinutes ?? 90);
        setDepositRequired((r as any).depositRequired ?? false);
        setDepositAmount((r as any).depositAmount ?? 0);
        setBlackoutDates((r as any).blackoutDates || []);
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Restoran yüklenemedi");
      }
    }
    if (restaurantId) loadRestaurant();
  }, [restaurantId]);

  // Rezervasyonları yükle (ham yanıtı loglayarak)
  useEffect(() => {
    async function loadReservations() {
      if (!restaurantId || activeTab !== "reservations") return;
      try {
        setResLoading(true);

        const url = `/restaurants/${restaurantId}/reservations?_cb=${Date.now()}`;
        if (DEBUG_RES) console.log("[RP] GET", url);

        const res = await api.get(url, {
          transformResponse: (v) => v,
          validateStatus: () => true,
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            "If-None-Match": "",
          },
        });

        if (DEBUG_RES) {
          console.log("[RP] status:", res.status);
          console.log("[RP] headers:", res.headers);
          console.log("[RP] raw data:", typeof res.data, res.data);
        }

        let parsed: any = null;
        try {
          parsed = typeof res.data === "string" && res.data ? JSON.parse(res.data) : res.data;
        } catch (e) {
          if (DEBUG_RES) console.log("[RP] JSON parse error:", (e as any)?.message);
        }

        const list = Array.isArray(parsed) ? parsed : parsed?.items ?? [];
        if (DEBUG_RES) console.log("[RP] parsed reservations length:", Array.isArray(list) ? list.length : "N/A");
        setReservations(Array.isArray(list) ? list : []);
      } catch (e: any) {
        console.log("[RP] loadReservations error:", e?.response?.data || e?.message || e);
        Alert.alert("Hata", e?.response?.data?.message || e?.message || "Rezervasyonlar yüklenemedi");
      } finally {
        setResLoading(false);
      }
    }

    loadReservations();
  }, [activeTab, restaurantId]);

  // Kaydet fonksiyonları
  const saveGeneral = async () => {
    try {
      const payload: any = {
        name,
        city,
        address,
        phone,
        email,
        priceRange,
        description,
        iban,
        ibanName,
        bankName,
        photos,
      };
      await updateRestaurant(restaurantId, payload);
      Alert.alert("Başarılı", "Genel bilgiler güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Güncellenemedi.");
    }
  };

  const saveMenus = async () => {
    try {
      await updateMenus(restaurantId, menus);
      Alert.alert("Başarılı", "Menüler güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Menüler güncellenemedi.");
    }
  };

  const saveTables = async () => {
    try {
      await updateTables(restaurantId, tables);
      Alert.alert("Başarılı", "Masalar güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Masalar güncellenemedi.");
    }
  };

  const saveHours = async () => {
    try {
      await updateOpeningHours(restaurantId, openingHours);
      Alert.alert("Başarılı", "Çalışma saatleri güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Çalışma saatleri güncellenemedi.");
    }
  };

  const savePolicies = async () => {
    try {
      const payload = {
        minPartySize: Math.max(1, minPartySize),
        maxPartySize: Math.max(minPartySize, maxPartySize),
        slotMinutes: Math.max(30, slotMinutes),
        depositRequired,
        depositAmount: Math.max(0, depositAmount),
        blackoutDates,
      };
      await updatePolicies(restaurantId, payload);
      Alert.alert("Başarılı", "Rezervasyon politikaları güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Politikalar güncellenemedi.");
    }
  };

  // Fotoğraf seçme
  const pickImage = async (): Promise<{ uri: string; fileName?: string; mimeType?: string } | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return null;
    return result.assets[0] as any;
  };

  const onAddPhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    try {
      const updated = await addPhoto(restaurantId, file.uri, file.fileName ?? "image.jpg", file.mimeType ?? "image/jpeg");
      setPhotos((updated as any).photos || []);
      Alert.alert("Başarılı", "Fotoğraf yüklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Fotoğraf yüklenemedi.");
    }
  };

  const onRemovePhoto = async (url: string) => {
    try {
      const updated = await removePhoto(restaurantId, url);
      setPhotos((updated as any).photos || []);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Fotoğraf silinemedi.");
    }
  };

  // Rezervasyon onaylama ve reddetme (backend /approve | /reject)
  const handleConfirmReservation = async (id: string) => {
    try {
      await updateReservationStatus(id, "confirmed");
      setReservations((prev) => prev.map((rv) => (rv._id === id ? { ...rv, status: "confirmed" } : rv)));
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Onaylanamadı");
    }
  };

  const handleRejectReservation = async (id: string) => {
    try {
      await updateReservationStatus(id, "cancelled");
      setReservations((prev) => prev.map((rv) => (rv._id === id ? { ...rv, status: "cancelled" } : rv)));
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Reddedilemedi");
    }
  };

  // QR kod tarayıcı callback'i: ProfileScreen ile aynı akış
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    try {
      // JSON varsayımı yok — ham metni sakla, kişi sayısı modalını aç
      setScannerVisible(false);
      setQrPayload(String(data || ""));
      setArrivedInput("");
      setArrivedModalOpen(true);
    } catch (err: any) {
      setScannerVisible(false);
      Alert.alert("Hata", err?.message || "QR kod okunamadı.");
    }
  };

  // UI render fonksiyonları
  const renderGeneral = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Genel Bilgiler</Text>
        <Text>İsim</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Restoran adı" />
        <Text>Şehir</Text>
        <TextInput value={city} onChangeText={setCity} style={styles.input} placeholder="Şehir" />
        <Text>Adres</Text>
        <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="Adres" />
        <Text>Telefon</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="Telefon" keyboardType="phone-pad" />
        <Text>E-mail</Text>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="E-mail" keyboardType="email-address" />
        <Text>Fiyat Aralığı</Text>
        <TextInput value={priceRange} onChangeText={setPriceRange} style={styles.input} placeholder="₺, ₺₺, ₺₺₺" />
        <Text>Açıklama</Text>
        <TextInput value={description} onChangeText={setDescription} style={[styles.input, { height: 80 }]} placeholder="Açıklama" multiline />
        <Text>IBAN</Text>
        <TextInput value={iban} onChangeText={setIban} style={styles.input} placeholder="TR..." />
        <Text>IBAN Adı</Text>
        <TextInput value={ibanName} onChangeText={setIbanName} style={styles.input} placeholder="Hesap Sahibi" />
        <Text>Banka Adı</Text>
        <TextInput value={bankName} onChangeText={setBankName} style={styles.input} placeholder="Banka Adı" />
        <TouchableOpacity style={styles.primaryBtn} onPress={saveGeneral}>
          <Text style={styles.primaryBtnText}>Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPhotos = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fotoğraflar</Text>
        {photos.length > 0 ? (
          <FlatList
            data={photos}
            horizontal
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View style={{ marginRight: 12 }}>
                <Image source={{ uri: item }} style={styles.photo} />
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onRemovePhoto(item)}>
                  <Text style={styles.deleteBtnText}>Sil</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <Text style={styles.muted}>Henüz fotoğraf yok.</Text>
        )}
        <TouchableOpacity style={styles.primaryBtn} onPress={onAddPhoto}>
          <Text style={styles.primaryBtnText}>+ Fotoğraf Yükle</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderMenus = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Menüler</Text>
        {menus.length === 0 && <Text style={styles.muted}>Henüz menü eklenmemiş.</Text>}
        {menus.map((m, idx) => (
          <View key={idx} style={[styles.tableCard, { marginBottom: 12 }]}>
            <TextInput
              value={m.title}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], title: v };
                setMenus(next);
              }}
              style={styles.input}
              placeholder="Menü adı"
            />
            <TextInput
              value={m.description ?? ""}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], description: v };
                setMenus(next);
              }}
              style={[styles.input, { height: 60 }]}
              placeholder="Açıklama"
              multiline
            />
            <TextInput
              value={String(m.pricePerPerson)}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], pricePerPerson: parseFloat(v || "0") };
                setMenus(next);
              }}
              style={styles.input}
              placeholder="Fiyat (kişi başı)"
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setMenus(menus.filter((_, i) => i !== idx))}>
              <Text style={styles.deleteBtnText}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setMenus((m) => [...m, { title: "Yeni Menü", description: "", pricePerPerson: 0, isActive: true }])}
        >
          <Text style={styles.secondaryBtnText}>+ Menü Ekle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={saveMenus}>
          <Text style={styles.primaryBtnText}>Menüleri Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderTables = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Masalar</Text>
        {tables.length === 0 && <Text style={styles.muted}>Henüz masa eklenmemiş.</Text>}
        {tables.map((t, idx) => (
          <View key={idx} style={[styles.tableCard, { marginBottom: 12 }]}>
            <TextInput
              value={t.name}
              onChangeText={(v) => {
                const next = [...tables];
                next[idx] = { ...next[idx], name: v };
                setTables(next);
              }}
              style={styles.input}
              placeholder="Masa adı"
            />
            <TextInput
              value={String(t.capacity)}
              onChangeText={(v) => {
                const cap = Math.max(1, parseInt(v || "1", 10));
                const next = [...tables];
                next[idx] = { ...next[idx], capacity: cap };
                setTables(next);
              }}
              style={styles.input}
              placeholder="Kapasite"
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                const next = [...tables];
                next[idx] = { ...next[idx], isActive: !(t.isActive ?? true) };
                setTables(next);
              }}
            >
              <Text style={styles.secondaryBtnText}>{t.isActive === false ? "Aktifleştir" : "Pasifleştir"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => setTables(tables.filter((_, i) => i !== idx))}>
              <Text style={styles.deleteBtnText}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setTables((t) => [...t, { name: `Masa ${t.length + 1}`, capacity: 2, isActive: true }])}
        >
          <Text style={styles.secondaryBtnText}>+ Masa Ekle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={saveTables}>
          <Text style={styles.primaryBtnText}>Masaları Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHours = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Çalışma Saatleri</Text>
        {openingHours.map((oh, idx) => (
          <View key={idx} style={[styles.tableCard, { flexDirection: "row", alignItems: "center", marginBottom: 8 }]}>
            <Text style={{ width: 40 }}>{["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][oh.day]}</Text>
            <TextInput
              value={oh.open}
              onChangeText={(v) => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], open: v };
                setOpeningHours(next);
              }}
              style={[styles.input, { flex: 1 }]}
              placeholder="10:00"
            />
            <TextInput
              value={oh.close}
              onChangeText={(v) => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], close: v };
                setOpeningHours(next);
              }}
              style={[styles.input, { flex: 1 }]}
              placeholder="23:00"
            />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], isClosed: !oh.isClosed };
                setOpeningHours(next);
              }}
            >
              <Text style={styles.secondaryBtnText}>{oh.isClosed ? "Açık Yap" : "Kapalı Gün"}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.primaryBtn} onPress={saveHours}>
          <Text style={styles.primaryBtnText}>Saatleri Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderPolicies = () => (
    <ScrollView style={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rezervasyon Politikaları</Text>
        <Text>Minimum kişi sayısı</Text>
        <TextInput
          value={String(minPartySize)}
          onChangeText={(v) => setMinPartySize(Math.max(1, parseInt(v || "1", 10)))}
          style={styles.input}
          keyboardType="numeric"
        />
        <Text>Maksimum kişi sayısı</Text>
        <TextInput
          value={String(maxPartySize)}
          onChangeText={(v) => setMaxPartySize(Math.max(minPartySize, parseInt(v || String(minPartySize), 10)))}
          style={styles.input}
          keyboardType="numeric"
        />
        <Text>Slot süresi (dakika)</Text>
        <TextInput
          value={String(slotMinutes)}
          onChangeText={(v) => setSlotMinutes(Math.max(30, parseInt(v || "30", 10)))}
          style={styles.input}
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setDepositRequired(!depositRequired)}>
          <Text style={styles.secondaryBtnText}>{depositRequired ? "Depozito: Açık" : "Depozito: Kapalı"}</Text>
        </TouchableOpacity>
        {depositRequired && (
          <>
            <Text>Depozito Tutarı (TRY)</Text>
            <TextInput
              value={String(depositAmount)}
              onChangeText={(v) => setDepositAmount(Math.max(0, parseFloat(v || "0")))}
              style={styles.input}
              keyboardType="numeric"
            />
          </>
        )}
        <Text style={styles.sectionLabel}>Kara Günler (YYYY-MM-DD)</Text>
        {blackoutDates.length > 0 ? (
          <FlatList
            data={blackoutDates}
            horizontal
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item}</Text>
                <TouchableOpacity onPress={() => setBlackoutDates(blackoutDates.filter((_, i) => i !== index))}>
                  <Text style={styles.badgeDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.muted}>Liste boş.</Text>}
          />
        ) : (
          <Text style={styles.muted}>Liste boş.</Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <TextInput value={newBlackout} onChangeText={setNewBlackout} style={[styles.input, { flex: 1 }]} placeholder="2025-12-31" />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              const v = newBlackout.trim();
              if (v && !blackoutDates.includes(v)) {
                setBlackoutDates([...blackoutDates, v]);
                setNewBlackout("");
              }
            }}
          >
            <Text style={styles.secondaryBtnText}>Ekle</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={savePolicies}>
          <Text style={styles.primaryBtnText}>Politikaları Kaydet</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderReservations = () => (
    <ScrollView style={styles.tabContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rezervasyonlar</Text>

        {DEBUG_RES && (
          <View
            style={{
              backgroundColor: "#FFF7ED",
              borderWidth: 1,
              borderColor: "#FDBA74",
              padding: 8,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: "#9A3412", fontWeight: "700" }}>DEBUG</Text>
            <Text style={{ color: "#9A3412" }}>restaurantId: {String(restaurantId)}</Text>
            <Text style={{ color: "#9A3412" }}>reservations.length: {reservations.length}</Text>
          </View>
        )}

        {/* QR check-in butonu */}
        <TouchableOpacity
          style={[styles.primaryBtn, { marginBottom: 8 }]}
          onPress={async () => {
            // kamera izni yoksa iste
            if (!permission?.granted) {
              const { granted } = await requestPermission();
              if (!granted) {
                Alert.alert("İzin gerekli", "QR okumak için kamera izni gerekiyor.");
                return;
              }
            }
            setScannerVisible(true);
          }}
        >
          <Text style={styles.primaryBtnText}>QR Okut ve Check-in</Text>
        </TouchableOpacity>

        {resLoading && <ActivityIndicator size="small" />}
        {!resLoading && reservations.length === 0 && <Text style={styles.muted}>Kayıt yok.</Text>}

        {!resLoading &&
          reservations.map((rv) => (
            <View key={rv._id} style={[styles.tableCard, { marginBottom: 12 }]}>
              <Text style={{ fontWeight: "600" }}>
                {dayjs(rv.dateTimeUTC).locale("tr").format("DD MMM, HH:mm")} • {rv.partySize} kişi
              </Text>
              <Text>Durum: {rv.status}</Text>
              {rv.totalPrice != null && <Text>Tutar: ₺{Number(rv.totalPrice).toLocaleString("tr-TR")}</Text>}
              {rv.depositAmount != null && <Text>Kapora: ₺{Number(rv.depositAmount).toLocaleString("tr-TR")}</Text>}

              {/* Dekont */}
              {rv.receiptUrl ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 6 }}>Dekont</Text>
                  {/\.((png|jpe?g|webp|gif))$/i.test(String(rv.receiptUrl)) ? (
                    <TouchableOpacity onPress={() => Linking.openURL(String(rv.receiptUrl))} style={{ alignSelf: "flex-start" }}>
                      <Image
                        source={{ uri: String(rv.receiptUrl) }}
                        style={{ width: 160, height: 100, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" }}
                      />
                      <Text style={{ marginTop: 6, color: lightTheme.colors.primary }}>Tam görüntüyü aç</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => Linking.openURL(String(rv.receiptUrl))} style={[styles.secondaryBtn, { marginTop: 0 }]}>
                      <Text style={styles.secondaryBtnText}>
                        {String(rv.receiptUrl).toLowerCase().endsWith(".pdf") ? "PDF Dekontu Aç" : "Dekontu Aç"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={[styles.muted, { marginTop: 8 }]}>Dekont yüklenmemiş.</Text>
              )}

              {rv.status === "pending" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={styles.successBtn} onPress={() => handleConfirmReservation(rv._id)}>
                    <Text style={styles.successBtnText}>Onayla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.warningBtn} onPress={() => handleRejectReservation(rv._id)}>
                    <Text style={styles.warningBtnText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
      </View>
    </ScrollView>
  );

  // Ana render
  return (
    <View style={styles.screen}>
      {/* Sekmeler */}
      <View style={styles.tabs}>
        <Tab label="Genel" active={activeTab === "general"} onPress={() => setActiveTab("general")} />
        <Tab label="Fotoğraflar" active={activeTab === "photos"} onPress={() => setActiveTab("photos")} />
        <Tab label="Menüler" active={activeTab === "menus"} onPress={() => setActiveTab("menus")} />
        <Tab label="Masalar" active={activeTab === "tables"} onPress={() => setActiveTab("tables")} />
        <Tab label="Saatler" active={activeTab === "hours"} onPress={() => setActiveTab("hours")} />
        <Tab label="Politikalar" active={activeTab === "policies"} onPress={() => setActiveTab("policies")} />
        <Tab label="Rezervasyonlar" active={activeTab === "reservations"} onPress={() => setActiveTab("reservations")} />
      </View>

      {/* Aktif sekme içeriği */}
      {activeTab === "general" && renderGeneral()}
      {activeTab === "photos" && renderPhotos()}
      {activeTab === "menus" && renderMenus()}
      {activeTab === "tables" && renderTables()}
      {activeTab === "hours" && renderHours()}
      {activeTab === "policies" && renderPolicies()}
      {activeTab === "reservations" && renderReservations()}

      {/* QR tarayıcı modalı */}
      {scannerVisible && (
        <Modal visible={scannerVisible} transparent animationType="fade" onRequestClose={() => setScannerVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center" }}>
            {permission === null && <ActivityIndicator size="large" color="#fff" />}
            {permission && !permission.granted && (
              <TouchableOpacity onPress={requestPermission} style={{ padding: 16, backgroundColor: "#1F2937", borderRadius: 8 }}>
                <Text style={{ color: "#fff" }}>Kamera izni ver</Text>
              </TouchableOpacity>
            )}
            {permission && permission.granted && (
              <View style={{ width: "90%", height: "70%" }}>
                <CameraView
                  style={{ flex: 1 }}
                  onBarcodeScanned={handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                />
                <TouchableOpacity
                  onPress={() => setScannerVisible(false)}
                  style={{ position: "absolute", bottom: 10, alignSelf: "center", padding: 12, backgroundColor: "#1F2937", borderRadius: 8 }}
                >
                  <Text style={{ color: "#fff" }}>Kapat</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* QR sonrası kişi sayısı modalı */}
      <Modal
        visible={arrivedModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setArrivedModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              width: "100%",
              padding: 16,
              borderWidth: 1,
              borderColor: lightTheme.colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: lightTheme.colors.text, marginBottom: 10 }}>
              Gelen Kişi Sayısı
            </Text>
            <Text style={{ color: lightTheme.colors.textSecondary, marginBottom: 6 }}>
              QR okundu. Lütfen gelen kişi sayısını girin (zorunlu).
            </Text>
            <TextInput
              value={arrivedInput}
              onChangeText={setArrivedInput}
              placeholder="Örn: 5"
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setArrivedModalOpen(false);
                  setQrPayload(null);
                  setArrivedInput("");
                }}
              >
                <Text style={styles.secondaryBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  const n = Number(arrivedInput.trim());
                  if (!Number.isFinite(n) || n < 0) {
                    Alert.alert("Uyarı", "Geçerli bir sayı girin (0 veya daha büyük).");
                    return;
                  }
                  try {
                    if (!qrPayload) throw new Error("QR verisi yok.");
                    await checkinByQR(qrPayload, n);
                    setArrivedModalOpen(false);
                    setQrPayload(null);
                    setArrivedInput("");
                    Alert.alert("Başarılı", "Müşteri check-in yapıldı.");
                    // isteğe bağlı: listedeki statüyü güncelle
                    // (rid bilgisini modal dönüşünde kullanmak istersen backend'den döndürmüyoruz; list yeniden yüklenebilir)
                  } catch (e: any) {
                    Alert.alert("Hata", e?.response?.data?.message || e?.message || "Check-in başarısız");
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Stil tanımları
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightTheme.colors.background },
  tabs: { flexDirection: "row", flexWrap: "wrap", padding: 8, gap: 6 },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: lightTheme.radius.sm,
    backgroundColor: lightTheme.colors.muted,
  },
  tabButtonActive: { backgroundColor: lightTheme.colors.primary },
  tabButtonText: { color: lightTheme.colors.text },
  tabButtonTextActive: { color: "#FFFFFF", fontWeight: "700" },
  tabContainer: { padding: 16 },
  card: {
    backgroundColor: lightTheme.colors.surface,
    padding: 16,
    borderRadius: lightTheme.radius.md,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    marginBottom: 16,
  },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: lightTheme.colors.text, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: lightTheme.radius.sm,
    marginBottom: 8,
    color: lightTheme.colors.text,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: lightTheme.colors.primary,
    paddingVertical: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: lightTheme.colors.muted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
    marginRight: 8,
  },
  secondaryBtnText: { color: lightTheme.colors.primary, fontWeight: "500" },
  successBtn: {
    backgroundColor: lightTheme.colors.success,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  successBtnText: { color: "#FFFFFF", fontWeight: "600" },
  warningBtn: {
    backgroundColor: lightTheme.colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  warningBtnText: { color: "#FFFFFF", fontWeight: "600" },
  deleteBtn: {
    backgroundColor: lightTheme.colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  deleteBtnText: { color: "#fff", fontWeight: "600" },
  photo: {
    width: 220,
    height: 130,
    borderRadius: lightTheme.radius.md,
    backgroundColor: lightTheme.colors.muted,
    marginBottom: 8,
  },
  tableCard: {
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    minWidth: "100%",
  },
  muted: { color: lightTheme.colors.textSecondary },
  sectionLabel: { marginTop: 10, marginBottom: 4, fontWeight: "600", color: lightTheme.colors.text },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: lightTheme.colors.muted,
    borderRadius: lightTheme.radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  badgeText: { color: lightTheme.colors.text },
  badgeDelete: { marginLeft: 6, color: lightTheme.colors.error, fontWeight: "700" },
});
// src/screens/RestaurantPanelScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Text,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { lightTheme } from "../theme/theme";
import {
  getRestaurant,
  updateRestaurant,
  updateOpeningHours,
  updateTables,
  updatePolicies,
  addPhoto,
  removePhoto,
  type Restaurant as ApiRestaurant,
  type OpeningHour,
  type TableItem,
} from "../api/restaurants";

import {
  fetchReservationsByRestaurant,
  updateReservationStatus,
  fetchReservationStats,
  uploadReservationReceipt,
  type Reservation,
  type ReservationStatus,
  type ReservationStats,
} from "../api/reservations";

import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera"; // ✅ expo-camera
import { api } from "../api/client";

dayjs.locale("tr");

// ---- Tipler ----
type FixMenu = {
  _id?: string;
  title: string;
  description?: string;
  pricePerPerson: number;
  isActive?: boolean;
};

type ExtendedRestaurant = ApiRestaurant & {
  iban?: string;
  ibanName?: string;
  bankName?: string;
  priceRange?: string;
  description?: string;
  menus?: FixMenu[];
};

type Range = "today" | "week" | "month" | "custom";

const DEFAULT_OPENING_HOURS: OpeningHour[] = Array.from({ length: 7 }, (_, i) => ({
  day: i,
  open: "10:00",
  close: "23:00",
  isClosed: false,
}));

function trStatus(s: ReservationStatus) {
  switch (s) {
    case "pending":
      return "Beklemede";
    case "confirmed":
      return "Onaylı";
    case "arrived":
      return "Geldi";
    case "no_show":
      return "Gelmedi";
    case "cancelled":
      return "İptal";
    default:
      return s;
  }
}
// ... importlar

function coerceRestaurantId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    // Yanlışlıkla { _id: new ObjectId('...') ... } string'i geldiyse 24 haneli hex’i çek.
    const m = val.match(/ObjectId\('([0-9a-fA-F]{24})'\)/);
    if (m) return m[1];
    try {
      const maybe = JSON.parse(val);
      if (maybe && typeof maybe === "object" && "_id" in (maybe as any)) {
        return String((maybe as any)._id || "");
      }
    } catch {}
    return val;
  }
  if (typeof val === "object" && val !== null && "_id" in (val as any)) {
    return String((val as any)._id || "");
  }
  return "";
}

export default function RestaurantPanelScreen({ route }: any) {
  // 🔧 DÜZELTME: ID’yi normalize et
  const raw = route?.params?.restaurantId ?? route?.params?.id;
  const restaurantId = coerceRestaurantId(raw);

  if (!restaurantId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>restaurantId parametresi eksik/geçersiz.</Text>
      </View>
    );
  }

  // ... dosyanın geri kalanı aynı (getRestaurant, fetchReservationsByRestaurant vs. hep bu restaurantId değişkenini kullansın)

  // ----- Genel state -----
  const [loading, setLoading] = useState(true);
  const [r, setR] = useState<ExtendedRestaurant | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "general"
    | "photos"
    | "menus"
    | "tables"
    | "hours"
    | "policies"
    | "reservations"
    | "analytics"
  >("general");

  // Genel form
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [iban, setIban] = useState("");
  const [ibanName, setIbanName] = useState("");
  const [bankName, setBankName] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [description, setDescription] = useState("");

  // Fotoğraflar
  const [photos, setPhotos] = useState<string[]>([]);

  // Menüler
  const [menus, setMenus] = useState<FixMenu[]>([]);

  // Masalar
  const [tables, setTables] = useState<TableItem[]>([]);

  // Saatler
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(DEFAULT_OPENING_HOURS);

  // Politikalar
  const [minPartySize, setMinPartySize] = useState(1);
  const [maxPartySize, setMaxPartySize] = useState(8);
  const [slotMinutes, setSlotMinutes] = useState(90);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [blackoutDates, setBlackoutDates] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState("");

  // Rezervasyonlar
  const [resLoading, setResLoading] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "all">("all");

  // Analitik
  const [statsLoading, setStatsLoading] = useState(false);
  const [range, setRange] = useState<Range>("today");
  const [customStart, setCustomStart] = useState(dayjs().format("YYYY-MM-DD"));
  const [customEnd, setCustomEnd] = useState(dayjs().format("YYYY-MM-DD"));
  const [stats, setStats] = useState<ReservationStats | null>(null);

  // =====================
  // ✅ QR & Manuel Check-in state’leri
  // =====================
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scanningResId, setScanningResId] = useState<string | null>(null);
  const [scannedOnce, setScannedOnce] = useState(false);

  // expo-camera izinleri
  const [permission, requestPermission] = useCameraPermissions();

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualResId, setManualResId] = useState<string | null>(null);
  const [manualCount, setManualCount] = useState<string>("");

  // hydrate: aynı id için yalnızca 1 kez
  const hydratedForId = useRef<string | null>(null);
  useEffect(() => {
    if (!restaurantId) return;
    if (hydratedForId.current === restaurantId) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = (await getRestaurant(restaurantId)) as ExtendedRestaurant;
        if (!alive) return;

        setR(data);
        setName(data.name || "");
        setCity(data.city || "");
        setAddress(data.address || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setCoverImage((data.photos && data.photos[0]) || "");
        setPhotos(data.photos || []);
        setIban(data.iban || "");
        setIbanName(data.ibanName || "");
        setBankName(data.bankName || "");
        setPriceRange(data.priceRange || "");
        setDescription(data.description || "");
        setMenus(((data.menus || []) as any[]).map((m) => ({
          _id: m._id,
          title: m.title ?? "",
          description: m.description ?? "",
          pricePerPerson:
            typeof m.pricePerPerson === "number" ? m.pricePerPerson : parseFloat((m as any).price) || 0,
          isActive: m.isActive ?? true,
        })));

        setOpeningHours(
          (data.openingHours?.length ? data.openingHours : DEFAULT_OPENING_HOURS).map((oh) => ({
            day: oh.day,
            open: oh.open,
            close: oh.close,
            isClosed: !!oh.isClosed,
          }))
        );
        setTables(data.tables || []);
        setMinPartySize(data.minPartySize ?? 1);
        setMaxPartySize(data.maxPartySize ?? 8);
        setSlotMinutes(data.slotMinutes ?? 90);
        setDepositRequired(!!data.depositRequired);
        setDepositAmount(data.depositAmount ?? 0);
        setBlackoutDates(data.blackoutDates || []);

        hydratedForId.current = restaurantId;
      } catch (e: any) {
        Alert.alert("Hata", e?.response?.data?.message || e.message || "Yüklenemedi");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  // Rezervasyonları çek
  const loadReservations = async () => {
    try {
      setResLoading(true);
      const res = await fetchReservationsByRestaurant({
        restaurantId,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setReservations(res.items);
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Rezervasyonlar yüklenemedi.");
    } finally {
      setResLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === "reservations") loadReservations();
  }, [activeTab, statusFilter, restaurantId]);

  // Analitik çek
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      let start: string | undefined;
      let end: string | undefined;
      if (range === "today") {
        start = dayjs().startOf("day").format("YYYY-MM-DD");
        end = dayjs().endOf("day").format("YYYY-MM-DD");
      } else if (range === "week") {
        start = dayjs().startOf("week").format("YYYY-MM-DD");
        end = dayjs().endOf("week").format("YYYY-MM-DD");
      } else if (range === "month") {
        start = dayjs().startOf("month").format("YYYY-MM-DD");
        end = dayjs().endOf("month").format("YYYY-MM-DD");
      } else {
        start = customStart;
        end = customEnd;
      }
      const s = await fetchReservationStats({ restaurantId, start, end });
      setStats(s);
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "İstatistik yüklenemedi.");
    } finally {
      setStatsLoading(false);
    }
  };
  useEffect(() => {
    if (activeTab === "analytics") loadStats();
  }, [activeTab, range, customStart, customEnd, restaurantId]);

  // ----- Kaydetmeler -----
  const saveGeneral = async () => {
    try {
      const payload: Partial<ExtendedRestaurant> = {
        name,
        city,
        address,
        phone,
        email,
        photos,
        iban,
        ibanName,
        bankName,
        priceRange,
        description,
      };
      const updated = (await updateRestaurant(restaurantId, payload as any)) as ExtendedRestaurant;
      setR(updated);
      Alert.alert("Başarılı", "Genel bilgiler güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Güncellenemedi.");
    }
  };

  const saveMenus = async () => {
    try {
      const updated = (await updateRestaurant(restaurantId, { menus } as any)) as ExtendedRestaurant;
      setMenus(updated.menus || []);
      setR(updated);
      Alert.alert("Başarılı", "Menüler güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Güncellenemedi.");
    }
  };

  const saveTables = async () => {
    try {
      const clean = tables.map((t) => ({
        ...t,
        name: t.name?.trim() || "Masa",
        capacity: Math.max(1, t.capacity || 1),
        isActive: t.isActive ?? true,
      }));
      const updated = (await updateTables(restaurantId, clean)) as ExtendedRestaurant;
      setTables(updated.tables || []);
      setR(updated);
      Alert.alert("Başarılı", "Masalar güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Güncellenemedi.");
    }
  };

  const saveHours = async () => {
    try {
      const updated = (await updateOpeningHours(restaurantId, openingHours)) as ExtendedRestaurant;
      setOpeningHours(updated.openingHours || []);
      setR(updated);
      Alert.alert("Başarılı", "Çalışma saatleri güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Güncellenemedi.");
    }
  };

  const savePolicies = async () => {
    try {
      const payload = {
        minPartySize: Math.max(1, minPartySize || 1),
        maxPartySize: Math.max(minPartySize, maxPartySize || minPartySize),
        slotMinutes: Math.max(30, slotMinutes || 90),
        depositRequired,
        depositAmount: Math.max(0, depositAmount || 0),
        blackoutDates,
      };
      const updated = (await updatePolicies(restaurantId, payload)) as ExtendedRestaurant;
      setR(updated);
      Alert.alert("Başarılı", "Rezervasyon politikaları güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Güncellenemedi.");
    }
  };

  // Fotoğraf ekle/sil
  const pickImage = async () => {
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
      const updated = (await addPhoto(
        restaurantId,
        file.uri,
        file.fileName ?? "image.jpg",
        file.mimeType ?? "image/jpeg"
      )) as ExtendedRestaurant;
      setPhotos(updated.photos || []);
      setR(updated);
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Fotoğraf yüklenemedi.");
    }
  };

  const onRemovePhoto = async (url: string) => {
    try {
      const updated = (await removePhoto(restaurantId, url)) as ExtendedRestaurant;
      setPhotos(updated.photos || []);
      setR(updated);
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Fotoğraf silinemedi.");
    }
  };

  // =====================
  // ✅ QR izin isteği (expo-camera)
  // =====================
  useEffect(() => {
    if (qrModalOpen) {
      setScannedOnce(false);
      if (!permission?.granted) {
        // Kamerayı açmadan önce izin iste
        requestPermission();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrModalOpen]);

  // QR payload parse helper
  function parseQRPayload(raw: string): null | { rid: string; mid: string; ts: string; sig: string } {
    try {
      const j = JSON.parse(raw);
      if (j?.rid && j?.mid && j?.ts && j?.sig) return j;
    } catch {}

    try {
      const u = new URL(raw);
      const rid = u.searchParams.get("rid");
      const mid = u.searchParams.get("mid");
      const ts = u.searchParams.get("ts");
      const sig = u.searchParams.get("sig");
      if (rid && mid && ts && sig) return { rid, mid, ts, sig };
    } catch {}

    try {
      const cleaned = raw.replace(/\s+/g, "");
      const parts = cleaned.includes("|") ? cleaned.split("|") : cleaned.split(",");
      if (parts.length === 4) {
        const [rid, mid, ts, sig] = parts;
        if (rid && mid && ts && sig) return { rid, mid, ts, sig };
      }
    } catch {}

    return null;
  }

  // ✅ QR ile check-in
  async function doQRCheckin(qrRaw: string, fallbackArrived?: number) {
    const parsed = parseQRPayload(qrRaw);
    if (!parsed) {
      Alert.alert("Hata", "QR verisi okunamadı.");
      return;
    }
    try {
      await api.post("/reservations/checkin", {
        ...parsed,
        arrivedCount: typeof fallbackArrived === "number" ? fallbackArrived : undefined,
      });
      Alert.alert("Başarılı", "Check-in tamamlandı.");
      setQrModalOpen(false);
      setScanningResId(null);
      loadReservations();
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Check-in başarısız.");
    }
  }

  // ✅ Manuel check-in
  async function doManualCheckin() {
    if (!manualResId) return;
    const arrivedCount = Math.max(0, parseInt(manualCount || "0", 10));
    try {
      await api.post(`/reservations/${manualResId}/checkin-manual`, { arrivedCount });
      Alert.alert("Başarılı", "Manuel check-in tamamlandı.");
      setManualModalOpen(false);
      setManualResId(null);
      setManualCount("");
      loadReservations();
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e.message || "Manuel check-in failed");
    }
  }

  // ----- UI Bölümleri -----
  const renderGeneral = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Temel Bilgiler">
        <Input label="Ad" value={name} onChangeText={setName} />
        <Row>
          <Input label="Şehir" value={city} onChangeText={setCity} />
          <Input label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </Row>
        <Input label="Adres" value={address} onChangeText={setAddress} />
        <Input label="E-posta" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input label="Fiyat Aralığı" value={priceRange} onChangeText={setPriceRange} />
        <Input label="Kapak Görseli (URL)" value={coverImage} onChangeText={setCoverImage} />

        <Input label="IBAN" value={iban} onChangeText={setIban} />
        <Row>
          <Input label="IBAN İsim" value={ibanName} onChangeText={setIbanName} />
          <Input label="Banka" value={bankName} onChangeText={setBankName} />
        </Row>

        <Input
          label="Hakkında"
          value={description}
          onChangeText={setDescription}
          placeholder="Restoran açıklaması"
        />

        <TouchableOpacity style={styles.primaryBtn} onPress={saveGeneral}>
          <Text style={styles.primaryBtnText}>Kaydet</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderPhotos = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Fotoğraflar">
        {photos.length > 0 ? (
          <FlatList
            data={photos}
            horizontal
            keyExtractor={(u, i) => `${u}-${i}`}
            showsHorizontalScrollIndicator={false}
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
        <TouchableOpacity style={styles.secondaryBtn} onPress={onAddPhoto}>
          <Text style={styles.secondaryBtnText}>+ Fotoğraf Yükle</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderMenus = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Fix Menüler">
        {menus.length === 0 ? (
          <Text style={styles.muted}>Henüz menü eklenmemiş.</Text>
        ) : (
          menus.map((m, idx) => (
            <View key={m._id ?? idx} style={styles.tableCard}>
              <Input
                label="Başlık"
                value={m.title}
                onChangeText={(v) => {
                  const next = [...menus];
                  next[idx] = { ...next[idx], title: v };
                  setMenus(next);
                }}
              />
              <Input
                label="Açıklama"
                value={m.description || ""}
                onChangeText={(v) => {
                  const next = [...menus];
                  next[idx] = { ...next[idx], description: v };
                  setMenus(next);
                }}
              />
              <Input
                label="Fiyat (kişi başı)"
                value={String(m.pricePerPerson ?? 0)}
                keyboardType="decimal-pad"
                onChangeText={(v) => {
                  const next = [...menus];
                  next[idx] = { ...next[idx], pricePerPerson: parseFloat(v || "0") };
                  setMenus(next);
                }}
              />
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setMenus(menus.filter((_, i) => i !== idx))}
              >
                <Text style={styles.deleteBtnText}>Sil</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            setMenus((m) => [
              ...m,
              { title: "Yeni Menü", description: "", pricePerPerson: 0, isActive: true },
            ])
          }
        >
          <Text style={styles.secondaryBtnText}>+ Menü Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveMenus}>
          <Text style={styles.primaryBtnText}>Menüleri Kaydet</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderTables = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Masalar">
        {tables.length === 0 ? (
          <Text style={styles.muted}>Henüz masa eklenmemiş.</Text>
        ) : (
          tables.map((t, idx) => (
            <View key={idx} style={styles.tableCard}>
              <Row>
                <Input
                  label="Ad"
                  value={t.name}
                  onChangeText={(v) => {
                    const next = [...tables];
                    next[idx] = { ...next[idx], name: v };
                    setTables(next);
                  }}
                />
                <Input
                  label="Kapasite"
                  value={String(t.capacity)}
                  keyboardType="number-pad"
                  onChangeText={(v) => {
                    const cap = Math.max(1, parseInt(v || "1", 10));
                    const next = [...tables];
                    next[idx] = { ...next[idx], capacity: cap };
                    setTables(next);
                  }}
                />
              </Row>

              <Row>
                <TouchableOpacity
                  style={t.isActive === false ? styles.secondaryBtn : styles.successBtn}
                  onPress={() => {
                    const next = [...tables];
                    next[idx] = { ...next[idx], isActive: !(t.isActive ?? true) };
                    setTables(next);
                  }}
                >
                  <Text
                    style={
                      t.isActive === false ? styles.secondaryBtnText : styles.successBtnText
                    }
                  >
                    {t.isActive === false ? "Aktifleştir" : "Pasifleştir"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => setTables(tables.filter((_, i) => i !== idx))}
                >
                  <Text style={styles.deleteBtnText}>Sil</Text>
                </TouchableOpacity>
              </Row>
            </View>
          ))
        )}

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setTables((t) => [...t, { name: `Masa ${t.length + 1}`, capacity: 2, isActive: true }])}
        >
          <Text style={styles.secondaryBtnText}>+ Masa Ekle</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveTables}>
          <Text style={styles.primaryBtnText}>Masaları Kaydet</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderHours = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Çalışma Saatleri">
        {openingHours.map((oh, idx) => (
          <View key={oh.day} style={styles.tableCard}>
            <Text style={{ fontWeight: "700", marginBottom: 6, color: lightTheme.colors.text }}>
              {["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][oh.day]}
            </Text>
            <Row>
              <Input
                label="Açılış"
                value={oh.open}
                onChangeText={(v) => {
                  const next = [...openingHours];
                  next[idx] = { ...next[idx], open: v };
                  setOpeningHours(next);
                }}
                placeholder="10:00"
              />
              <Input
                label="Kapanış"
                value={oh.close}
                onChangeText={(v) => {
                  const next = [...openingHours];
                  next[idx] = { ...next[idx], close: v };
                  setOpeningHours(next);
                }}
                placeholder="23:00"
              />
            </Row>
            <TouchableOpacity
              style={oh.isClosed ? styles.secondaryBtn : styles.warningBtn}
              onPress={() => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], isClosed: !oh.isClosed };
                setOpeningHours(next);
              }}
            >
              <Text style={oh.isClosed ? styles.secondaryBtnText : styles.warningBtnText}>
                {oh.isClosed ? "Açık Yap" : "Kapalı Gün"}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.primaryBtn} onPress={saveHours}>
          <Text style={styles.primaryBtnText}>Saatleri Kaydet</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderPolicies = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Rezervasyon Politikaları">
        <Row>
          <Input
            label="Min Kişi"
            value={String(minPartySize)}
            keyboardType="number-pad"
            onChangeText={(v) => setMinPartySize(Math.max(1, parseInt(v || "1", 10)))}
          />
          <Input
            label="Max Kişi"
            value={String(maxPartySize)}
            keyboardType="number-pad"
            onChangeText={(v) => {
              const val = Math.max(minPartySize, parseInt(v || String(minPartySize), 10));
              setMaxPartySize(val);
            }}
          />
        </Row>
        <Input
          label="Slot Süresi (dk)"
          value={String(slotMinutes)}
          keyboardType="number-pad"
          onChangeText={(v) => setSlotMinutes(Math.max(30, parseInt(v || "30", 10)))}
        />
        <Row>
          <TouchableOpacity
            style={depositRequired ? styles.successBtn : styles.secondaryBtn}
            onPress={() => setDepositRequired(!depositRequired)}
          >
            <Text style={depositRequired ? styles.successBtnText : styles.secondaryBtnText}>
              {depositRequired ? "Depozito: Açık" : "Depozito: Kapalı"}
            </Text>
          </TouchableOpacity>
          <Input
            label="Depozito Tutarı"
            value={String(depositAmount)}
            keyboardType="decimal-pad"
            onChangeText={(v) => setDepositAmount(Math.max(0, parseFloat(v || "0")))}
          />
        </Row>

        <Text style={styles.sectionLabel}>Kara Günler (YYYY-MM-DD)</Text>
        <FlatList
          data={blackoutDates}
          keyExtractor={(d, i) => `${d}-${i}`}
          horizontal
          renderItem={({ item, index }) => (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item}</Text>
              <TouchableOpacity
                onPress={() => setBlackoutDates(blackoutDates.filter((_, i) => i !== index))}
              >
                <Text style={styles.badgeDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.muted}>Liste boş.</Text>}
        />
        <Row>
          <Input
            label="Yeni Gün (YYYY-MM-DD)"
            value={newBlackout}
            onChangeText={setNewBlackout}
            placeholder="2025-10-15"
          />
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
        </Row>

        <TouchableOpacity style={styles.primaryBtn} onPress={savePolicies}>
          <Text style={styles.primaryBtnText}>Politikaları Kaydet</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );

  const renderReservations = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Rezervasyonlar">
        <Row>
          <FilterChip label="Tümü" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          <FilterChip label="Beklemede" active={statusFilter === "pending"} onPress={() => setStatusFilter("pending")} />
          <FilterChip label="Onaylı" active={statusFilter === "confirmed"} onPress={() => setStatusFilter("confirmed")} />
          <FilterChip label="İptal" active={statusFilter === "cancelled"} onPress={() => setStatusFilter("cancelled")} />
        </Row>

        {resLoading ? (
          <ActivityIndicator color={lightTheme.colors.primary} />
        ) : reservations.length === 0 ? (
          <Text style={styles.muted}>Kayıt yok.</Text>
        ) : (
          reservations.map((rv) => (
            <View key={rv._id} style={styles.tableCard}>
              <Text style={{ fontWeight: "700", color: lightTheme.colors.text }}>
                {dayjs(rv.dateTimeUTC).locale("tr").format("DD MMM, HH:mm")} • {rv.partySize} kişi
              </Text>
              <Text style={styles.muted}>Durum: {trStatus(rv.status)}</Text>
              {!!rv.totalPrice && (
                <Text style={styles.muted}>Tutar: ₺{rv.totalPrice.toLocaleString("tr-TR")}</Text>
              )}
              {!!rv.depositAmount && (
                <Text style={styles.muted}>Kapora: ₺{rv.depositAmount.toLocaleString("tr-TR")}</Text>
              )}

              {!!rv.receiptUrl && (
                <>
                  <Text style={styles.sectionLabel}>Dekont</Text>
                  <Image
                    source={{ uri: rv.receiptUrl }}
                    style={{
                      width: 220,
                      height: 130,
                      borderRadius: 8,
                      backgroundColor: lightTheme.colors.muted,
                    }}
                  />
                </>
              )}

              {rv.status === "pending" && (
                <Row>
                  <TouchableOpacity
                    style={styles.successBtn}
                    onPress={async () => {
                      try {
                        await updateReservationStatus(rv._id, "confirmed");
                        loadReservations();
                      } catch (e: any) {
                        Alert.alert("Hata", e?.response?.data?.message || e.message || "Onaylanamadı.");
                      }
                    }}
                  >
                    <Text style={styles.successBtnText}>Onayla</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={async () => {
                      try {
                        await updateReservationStatus(rv._id, "cancelled");
                        loadReservations();
                      } catch (e: any) {
                        Alert.alert("Hata", e?.response?.data?.message || e.message || "Reddedilemedi.");
                      }
                    }}
                  >
                    <Text style={styles.deleteBtnText}>Reddet</Text>
                  </TouchableOpacity>
                </Row>
              )}

              {/* ✅ Onaylı rezervasyon için QR ve manuel check-in */}
              {rv.status === "confirmed" && (
                <Row>
                  <TouchableOpacity
                    style={styles.warningBtn}
                    onPress={() => {
                      setScanningResId(rv._id);
                      setQrModalOpen(true);
                    }}
                  >
                    <Text style={styles.warningBtnText}>QR ile Check-in</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setManualResId(rv._id);
                      setManualCount(String(rv.partySize ?? 0));
                      setManualModalOpen(true);
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Manuel Check-in</Text>
                  </TouchableOpacity>
                </Row>
              )}

              {/* İsteğe bağlı: Panelden de dekont yükleme (genelde müşteri yükler) */}
              {rv.status !== "cancelled" && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={async () => {
                    try {
                      const picked = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.9,
                      });
                      if (picked.canceled) return;
                      const asset = picked.assets[0];
                      await uploadReservationReceipt(rv._id, {
                        uri: asset.uri,
                        name: asset.fileName ?? "receipt.jpg",
                        type: asset.mimeType ?? "image/jpeg",
                      });
                      loadReservations();
                    } catch (e: any) {
                      Alert.alert("Hata", e?.response?.data?.message || e.message || "Dekont yüklenemedi.");
                    }
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Dekont Yükle</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );

  const renderAnalytics = () => (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card title="Analitik">
        <Row>
          <FilterChip label="Bugün" active={range === "today"} onPress={() => setRange("today")} />
          <FilterChip label="Bu Hafta" active={range === "week"} onPress={() => setRange("week")} />
          <FilterChip label="Bu Ay" active={range === "month"} onPress={() => setRange("month")} />
          <FilterChip label="Özel" active={range === "custom"} onPress={() => setRange("custom")} />
        </Row>

        {range === "custom" && (
          <Row>
            <Input label="Başlangıç" value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" />
            <Input label="Bitiş" value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" />
          </Row>
        )}

        <TouchableOpacity style={styles.secondaryBtn} onPress={loadStats}>
          <Text style={styles.secondaryBtnText}>Yenile</Text>
        </TouchableOpacity>

        {statsLoading ? (
          <ActivityIndicator color={lightTheme.colors.primary} />
        ) : stats ? (
          <View style={styles.tableCard}>
            <Text style={{ fontWeight: "700", color: lightTheme.colors.text }}>{stats.rangeLabel}</Text>
            <Text style={styles.muted}>Toplam Rezervasyon: {stats.totalCount}</Text>
            <Text style={styles.muted}>Toplam Tutar: ₺{stats.totalAmount.toLocaleString("tr-TR")}</Text>
            <Text style={styles.muted}>
              Onaylı: {stats.confirmedCount} • Beklemede: {stats.pendingCount} • Reddedilen: {stats.rejectedCount}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Henüz veri yok.</Text>
        )}
      </Card>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lightTheme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabs}>
        <Tab label="Genel" active={activeTab === "general"} onPress={() => setActiveTab("general")} />
        <Tab label="Fotoğraflar" active={activeTab === "photos"} onPress={() => setActiveTab("photos")} />
        <Tab label="Menüler" active={activeTab === "menus"} onPress={() => setActiveTab("menus")} />
        <Tab label="Masalar" active={activeTab === "tables"} onPress={() => setActiveTab("tables")} />
        <Tab label="Saatler" active={activeTab === "hours"} onPress={() => setActiveTab("hours")} />
        <Tab label="Politikalar" active={activeTab === "policies"} onPress={() => setActiveTab("policies")} />
        <Tab label="Rezervasyonlar" active={activeTab === "reservations"} onPress={() => setActiveTab("reservations")} />
        <Tab label="Analitik" active={activeTab === "analytics"} onPress={() => setActiveTab("analytics")} />
      </View>

      {activeTab === "general" && renderGeneral()}
      {activeTab === "photos" && renderPhotos()}
      {activeTab === "menus" && renderMenus()}
      {activeTab === "tables" && renderTables()}
      {activeTab === "hours" && renderHours()}
      {activeTab === "policies" && renderPolicies()}
      {activeTab === "reservations" && renderReservations()}
      {activeTab === "analytics" && renderAnalytics()}

      {/* ===================== */}
      {/* ✅ QR SCAN MODAL (expo-camera) */}
      {/* ===================== */}
      <Modal
        visible={qrModalOpen}
        animationType="slide"
        onRequestClose={() => setQrModalOpen(false)}
        transparent={false}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {!permission ? (
            <View style={[styles.center, { backgroundColor: "#000" }]}>
              <Text style={{ color: "#fff" }}>Kamera izni kontrol ediliyor…</Text>
              <TouchableOpacity style={[styles.deleteBtn, { marginTop: 12 }]} onPress={() => setQrModalOpen(false)}>
                <Text style={styles.deleteBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : !permission.granted ? (
            <View style={[styles.center, { backgroundColor: "#000" }]}>
              <Text style={{ color: "#fff", marginBottom: 8 }}>Kamera izni gerekli</Text>
              <TouchableOpacity
                style={[styles.secondaryBtn]}
                onPress={() => {
                  requestPermission();
                }}
              >
                <Text style={styles.secondaryBtnText}>İzin ver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { marginTop: 12 }]} onPress={() => setQrModalOpen(false)}>
                <Text style={styles.deleteBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={({ data }) => {
                  if (scannedOnce) return;
                  setScannedOnce(true);
                  const rv = reservations.find((x) => x._id === scanningResId);
                  const fallback = rv?.partySize ?? undefined;
                  doQRCheckin(data, fallback);
                }}
              />
              <View style={{ position: "absolute", bottom: 30, left: 0, right: 0, alignItems: "center" }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setQrModalOpen(false)}>
                  <Text style={styles.secondaryBtnText}>Kapat</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* ===================== */}
      {/* ✅ MANUEL CHECK-IN MODAL */}
      {/* ===================== */}
      <Modal visible={manualModalOpen} animationType="fade" transparent onRequestClose={() => setManualModalOpen(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: lightTheme.colors.surface,
              padding: 16,
              borderRadius: 12,
              width: "86%",
            }}
          >
            <Text style={{ fontWeight: "700", color: lightTheme.colors.text, marginBottom: 8 }}>
              Manuel Check-in
            </Text>
            <Input label="Gelen Kişi" value={manualCount} onChangeText={setManualCount} keyboardType="number-pad" placeholder="0" />
            <Row>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setManualModalOpen(false)}>
                <Text style={styles.secondaryBtnText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={doManualCheckin}>
                <Text style={styles.primaryBtnText}>Onayla</Text>
              </TouchableOpacity>
            </Row>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---- küçük yardımcı UI parçaları ----
function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>{children}</View>;
}
function Input({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12, flex: 1, minWidth: 140 }}>
      <Text style={{ marginBottom: 4, color: lightTheme.colors.text }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{
          backgroundColor: lightTheme.colors.muted,
          borderRadius: lightTheme.radius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: lightTheme.colors.text,
          borderWidth: 1,
          borderColor: lightTheme.colors.border,
        }}
      />
    </View>
  );
}
function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          marginBottom: 8,
        },
        active
          ? { backgroundColor: lightTheme.colors.primary, borderColor: lightTheme.colors.primary }
          : { backgroundColor: lightTheme.colors.muted, borderColor: lightTheme.colors.border },
      ]}
    >
      <Text style={{ color: active ? "#fff" : lightTheme.colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ----- styles -----
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightTheme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: lightTheme.colors.background },
  tabs: { flexDirection: "row", padding: 8, gap: 6, flexWrap: "wrap" },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: lightTheme.radius.sm,
    backgroundColor: lightTheme.colors.muted,
  },
  tabButtonActive: { backgroundColor: lightTheme.colors.primary },
  tabButtonText: { color: lightTheme.colors.text },
  tabButtonTextActive: { color: "#FFFFFF", fontWeight: "700" },
  tabContainer: { padding: 16, gap: 12 },
  card: {
    backgroundColor: lightTheme.colors.surface,
    padding: 16,
    borderRadius: lightTheme.radius.md,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    marginBottom: 16,
  },
  cardTitle: { fontWeight: "700", marginBottom: 8, color: lightTheme.colors.text },
  primaryBtn: {
    backgroundColor: lightTheme.colors.primary,
    paddingVertical: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
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
  },
  secondaryBtnText: { color: lightTheme.colors.primary, fontWeight: "500" },
  successBtn: {
    backgroundColor: lightTheme.colors.success,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
  },
  successBtnText: { color: "#FFFFFF", fontWeight: "600" },
  warningBtn: {
    backgroundColor: lightTheme.colors.warning,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: lightTheme.radius.md,
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 6,
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
    marginRight: 12,
  },
  tableCard: {
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: lightTheme.colors.border,
    marginBottom: 10,
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
    marginTop: 8,
  },
  badgeText: { color: lightTheme.colors.text },
  badgeDelete: { marginLeft: 6, color: lightTheme.colors.error, fontWeight: "700" },
});

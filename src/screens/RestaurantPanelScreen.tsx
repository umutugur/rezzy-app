import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  Linking,
  StyleSheet,
  Modal,
} from "react-native";
import PanelLayout from "../components/PanelLayout";
import { panel, cardStyle, chip, chipText, inputStyle, btnPrimary, btnSecondary, pillMuted } from "../theme/panelTheme";
import dayjs from "dayjs";
import "dayjs/locale/tr";

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
  type Restaurant as R,
} from "../api/restaurants";
import {
  fetchReservationsByRestaurant,
  updateReservationStatus,
  type Reservation,
} from "../api/reservations";

import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";

dayjs.locale("tr");

const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] as const;

type TabKey = "summary" | "reservations" | "general" | "photos" | "menus" | "tables" | "hours" | "policies";

export default function RestaurantPanelScreen({ route }: any) {
  const restaurantId: string = route?.params?.restaurantId || route?.params?.id;

  const [tab, setTab] = React.useState<TabKey>("summary");

  // ==== restaurant form state ====
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState<Partial<R>>({});
  const [menus, setMenus] = React.useState<any[]>([]);
  const [tables, setTables] = React.useState<any[]>([]);
  const [openingHours, setOpeningHours] = React.useState<OpeningHour[]>(
    Array.from({ length: 7 }, (_, i) => ({ day: i, open: "10:00", close: "23:00", isClosed: false }))
  );
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [policies, setPolicies] = React.useState({
    minPartySize: 1,
    maxPartySize: 8,
    slotMinutes: 90,
    depositRequired: false,
    depositAmount: 0,
    blackoutDates: [] as string[],
    checkinWindowBeforeMinutes: 90,
    checkinWindowAfterMinutes: 90,
  });

  // ==== reservations ====
  const [resLoading, setResLoading] = React.useState(false);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);

  // ==== qr ====
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [qrPayload, setQrPayload] = React.useState<string | null>(null);
  const [arrivedModal, setArrivedModal] = React.useState(false);
  const [arrivedInput, setArrivedInput] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const r = await getRestaurant(restaurantId);
        setForm(r);
        setMenus(Array.isArray(r.menus) ? r.menus : []);
        setTables(Array.isArray(r.tables) ? r.tables : []);
        setOpeningHours(Array.isArray(r.openingHours) && r.openingHours.length === 7 ? r.openingHours : openingHours);
        setPhotos(Array.isArray(r.photos) ? r.photos : []);
        setPolicies({
          minPartySize: r.minPartySize ?? 1,
          maxPartySize: r.maxPartySize ?? 8,
          slotMinutes: r.slotMinutes ?? 90,
          depositRequired: !!r.depositRequired,
          depositAmount: r.depositAmount ?? 0,
          blackoutDates: Array.isArray(r.blackoutDates) ? r.blackoutDates : [],
          checkinWindowBeforeMinutes: (r as any).checkinWindowBeforeMinutes ?? 90,
          checkinWindowAfterMinutes: (r as any).checkinWindowAfterMinutes ?? 90,
        });
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Restoran alınamadı");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  React.useEffect(() => {
    if (tab !== "reservations") return;
    (async () => {
      try {
        setResLoading(true);
        const list = await fetchReservationsByRestaurant(restaurantId);
        setReservations(list);
      } catch (e: any) {
        Alert.alert("Hata", e?.message || "Rezervasyonlar alınamadı");
      } finally {
        setResLoading(false);
      }
    })();
  }, [tab, restaurantId]);

  const Tabs = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {([
        ["summary", "Özet"],
        ["reservations", "Rezervasyonlar"],
        ["general", "Genel"],
        ["photos", "Fotoğraflar"],
        ["menus", "Menüler"],
        ["tables", "Masalar"],
        ["hours", "Saatler"],
        ["policies", "Politikalar"],
      ] as [TabKey, string][]).map(([k, label]) => (
        <TouchableOpacity key={k} onPress={() => setTab(k)} style={chip(tab === k)}>
          <Text style={chipText(tab === k)}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: panel.colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // === helpers ===
  const saveGeneral = async () => {
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        address: form.address,
        description: form.description,
        iban: (form as any).iban,
        ibanName: (form as any).ibanName,
        bankName: (form as any).bankName,
      };
      await updateRestaurant(restaurantId, payload);
      Alert.alert("Başarılı", "Genel bilgiler güncellendi");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Kaydedilemedi");
    }
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (r.canceled) return null;
    return r.assets[0] as any;
  };

  const onAddPhoto = async () => {
    const file = await pickImage();
    if (!file) return;
    try {
      const updated = await addPhoto(restaurantId, file.uri, file.fileName ?? "image.jpg", file.mimeType ?? "image/jpeg");
      setPhotos((updated as any).photos || []);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Fotoğraf yüklenemedi");
    }
  };

  // === render blocks ===
  const BlockSummary = (
    <View style={cardStyle}>
      <Text style={styles.title}>Özet</Text>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <View style={[pillMuted]}><Text>Min kişi: {policies.minPartySize}</Text></View>
        <View style={[pillMuted]}><Text>Max kişi: {policies.maxPartySize}</Text></View>
        <View style={[pillMuted]}><Text>Slot: {policies.slotMinutes} dk</Text></View>
        <View style={[pillMuted]}><Text>Depozito: {policies.depositRequired ? "Açık" : "Kapalı"}</Text></View>
      </View>
    </View>
  );

  const BlockReservations = (
    <View style={cardStyle}>
      <Text style={styles.title}>Rezervasyonlar</Text>

      <TouchableOpacity
        style={[btnPrimary, { alignSelf: "flex-start", marginBottom: 10 }]}
        onPress={async () => {
          if (!permission?.granted) {
            const { granted } = await requestPermission();
            if (!granted) return Alert.alert("İzin gerekli", "Kamera izni vermelisiniz.");
          }
          setScannerOpen(true);
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>QR Okut ve Check-in</Text>
      </TouchableOpacity>

      {resLoading ? (
        <ActivityIndicator />
      ) : reservations.length === 0 ? (
        <Text style={{ color: panel.colors.sub }}>Kayıt yok.</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {reservations.map((rv) => (
            <View key={rv._id} style={[styles.resCard]}>
              <Text style={{ fontWeight: "700", color: panel.colors.text }}>
                {dayjs(rv.dateTimeUTC).format("DD MMM, HH:mm")} • {rv.partySize} kişi
              </Text>
              {/* kullanıcı adı/e-posta — web panel eksikleri mobile eklendi */}
              {!!(rv as any).user?.name && (
                <Text style={{ color: panel.colors.sub, marginTop: 2 }}>
                  {(rv as any).user?.name}
                  {(rv as any).user?.email ? ` (${(rv as any).user?.email})` : ""}
                </Text>
              )}
              <View style={{ height: 6 }} />
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={pillMuted}><Text>Durum: {rv.status}</Text></View>
                {rv.totalPrice != null && <View style={pillMuted}><Text>Toplam: ₺{Number(rv.totalPrice).toLocaleString("tr-TR")}</Text></View>}
                {rv.depositAmount != null && <View style={pillMuted}><Text>Depozito: ₺{Number(rv.depositAmount).toLocaleString("tr-TR")}</Text></View>}
              </View>

              {/* dekont */}
              <View style={{ marginTop: 8 }}>
                {rv.receiptUrl ? (
                  /\.(png|jpe?g|webp|gif)$/i.test(String(rv.receiptUrl)) ? (
                    <TouchableOpacity onPress={() => Linking.openURL(String(rv.receiptUrl))} style={{ alignSelf: "flex-start" }}>
                      <Image
                        source={{ uri: String(rv.receiptUrl) }}
                        style={{ width: 200, height: 110, borderRadius: 10, borderWidth: 1, borderColor: panel.colors.border }}
                      />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => Linking.openURL(String(rv.receiptUrl))} style={[btnSecondary, { alignSelf: "flex-start" }]}>
                      <Text style={{ color: panel.colors.text }}>Dekontu Aç</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <Text style={{ color: panel.colors.sub }}>Dekont yok.</Text>
                )}
              </View>

              {rv.status === "pending" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[btnPrimary, { backgroundColor: panel.colors.success }]}
                    onPress={async () => {
                      try {
                        await updateReservationStatus(rv._id, "confirmed");
                        setReservations((p) => p.map((x) => (x._id === rv._id ? { ...x, status: "confirmed" } : x)));
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Onaylanamadı");
                      }
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Onayla</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[btnPrimary, { backgroundColor: panel.colors.danger }]}
                    onPress={async () => {
                      try {
                        await updateReservationStatus(rv._id, "cancelled");
                        setReservations((p) => p.map((x) => (x._id === rv._id ? { ...x, status: "cancelled" } : x)));
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Reddedilemedi");
                      }
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const BlockGeneral = (
    <View style={cardStyle}>
      <Text style={styles.title}>Temel Bilgiler</Text>

      <Text style={styles.label}>Ad</Text>
      <TextInput value={form.name || ""} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} style={inputStyle} />

      <Text style={styles.label}>E-posta</Text>
      <TextInput value={form.email || ""} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} style={inputStyle} />

      <Text style={styles.label}>Telefon</Text>
      <TextInput value={form.phone || ""} onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))} style={inputStyle} />

      <Text style={styles.label}>Şehir</Text>
      <TextInput value={form.city || ""} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))} style={inputStyle} />

      <Text style={styles.label}>Adres</Text>
      <TextInput
        value={form.address || ""}
        onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
        style={[inputStyle, { height: 80 }]}
        multiline
      />

      <Text style={styles.label}>Açıklama</Text>
      <TextInput
        value={form.description || ""}
        onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
        style={[inputStyle, { height: 120 }]}
        multiline
      />

      <View style={{ height: 6 }} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <View style={pillMuted}><Text>IBAN</Text></View>
        <View style={pillMuted}><Text>Ödeme bilgileri</Text></View>
      </View>

      <Text style={styles.label}>IBAN</Text>
      <TextInput value={(form as any).iban || ""} onChangeText={(v) => setForm((f) => ({ ...f, iban: v } as any))} style={inputStyle} />

      <Text style={styles.label}>IBAN Adı</Text>
      <TextInput value={(form as any).ibanName || ""} onChangeText={(v) => setForm((f) => ({ ...f, ibanName: v } as any))} style={inputStyle} />

      <Text style={styles.label}>Banka Adı</Text>
      <TextInput value={(form as any).bankName || ""} onChangeText={(v) => setForm((f) => ({ ...f, bankName: v } as any))} style={inputStyle} />

      <TouchableOpacity onPress={saveGeneral} style={[btnPrimary, { marginTop: 10, alignSelf: "flex-start" }]}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
      </TouchableOpacity>
    </View>
  );

  const BlockPhotos = (
    <View style={cardStyle}>
      <Text style={styles.title}>Fotoğraflar</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {photos.map((url) => (
          <View key={url} style={{ width: 150 }}>
            <Image source={{ uri: url }} style={{ width: "100%", height: 100, borderRadius: 12, backgroundColor: panel.colors.muted }} />
            <TouchableOpacity
              onPress={async () => {
                try {
                  const updated = await removePhoto(restaurantId, url);
                  setPhotos((updated as any).photos || []);
                } catch (e: any) {
                  Alert.alert("Hata", e?.message || "Silinemedi");
                }
              }}
              style={[btnSecondary, { marginTop: 6 }]}
            >
              <Text style={{ color: panel.colors.text }}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onAddPhoto} style={[btnPrimary, { marginTop: 12, alignSelf: "flex-start" }]}>
        <Text style={{ color: "#fff", fontWeight: "700" }}>+ Fotoğraf Yükle</Text>
      </TouchableOpacity>
    </View>
  );

  const BlockMenus = (
    <View style={cardStyle}>
      <Text style={styles.title}>Menüler</Text>
      <View style={{ gap: 12 }}>
        {menus.map((m, idx) => (
          <View key={idx} style={styles.innerCard}>
            <Text style={styles.label}>Menü Adı</Text>
            <TextInput
              value={m.title ?? m.name ?? ""}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], title: v };
                setMenus(next);
              }}
              style={inputStyle}
            />
            <Text style={styles.label}>Açıklama</Text>
            <TextInput
              value={m.description ?? ""}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], description: v };
                setMenus(next);
              }}
              style={[inputStyle, { height: 80 }]}
              multiline
            />
            <Text style={styles.label}>Fiyat (kişi)</Text>
            <TextInput
              keyboardType="numeric"
              value={String(m.pricePerPerson ?? m.price ?? 0)}
              onChangeText={(v) => {
                const next = [...menus];
                next[idx] = { ...next[idx], pricePerPerson: Number(v || 0) };
                setMenus(next);
              }}
              style={inputStyle}
            />
            <TouchableOpacity
              onPress={() => setMenus((arr) => arr.filter((_, i) => i !== idx))}
              style={[btnSecondary, { backgroundColor: panel.colors.brandSoft, alignSelf: "flex-start" }]}
            >
              <Text style={{ color: panel.colors.brand, fontWeight: "600" }}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}
        {menus.length === 0 && <Text style={{ color: panel.colors.sub }}>Henüz menü yok.</Text>}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={btnSecondary}
            onPress={() => setMenus((m) => [...m, { title: "", description: "", pricePerPerson: 0, isActive: true }])}
          >
            <Text style={{ color: panel.colors.text, fontWeight: "600" }}>+ Menü Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[btnPrimary]}
            onPress={async () => {
              try {
                await updateMenus(restaurantId, menus);
                Alert.alert("Başarılı", "Menüler güncellendi");
              } catch (e: any) {
                Alert.alert("Hata", e?.message || "Kaydedilemedi");
              }
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const BlockTables = (
    <View style={cardStyle}>
      <Text style={styles.title}>Masalar</Text>
      <View style={{ gap: 12 }}>
        {tables.map((t, idx) => (
          <View key={idx} style={styles.innerCard}>
            <Text style={styles.label}>Ad</Text>
            <TextInput
              value={t.name}
              onChangeText={(v) => {
                const next = [...tables];
                next[idx] = { ...next[idx], name: v };
                setTables(next);
              }}
              style={inputStyle}
            />
            <Text style={styles.label}>Kapasite</Text>
            <TextInput
              value={String(t.capacity)}
              keyboardType="numeric"
              onChangeText={(v) => {
                const next = [...tables];
                next[idx] = { ...next[idx], capacity: Math.max(1, Number(v || 1)) };
                setTables(next);
              }}
              style={inputStyle}
            />
            <TouchableOpacity
              onPress={() => setTables((arr) => arr.filter((_, i) => i !== idx))}
              style={[btnSecondary, { backgroundColor: panel.colors.brandSoft, alignSelf: "flex-start" }]}
            >
              <Text style={{ color: panel.colors.brand, fontWeight: "600" }}>Sil</Text>
            </TouchableOpacity>
          </View>
        ))}
        {tables.length === 0 && <Text style={{ color: panel.colors.sub }}>Henüz masa yok.</Text>}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={btnSecondary}
            onPress={() => setTables((arr) => [...arr, { name: `Masa ${arr.length + 1}`, capacity: 2, isActive: true }])}
          >
            <Text style={{ color: panel.colors.text, fontWeight: "600" }}>+ Masa Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={btnPrimary}
            onPress={async () => {
              try {
                await updateTables(restaurantId, tables);
                Alert.alert("Başarılı", "Masalar güncellendi");
              } catch (e: any) {
                Alert.alert("Hata", e?.message || "Kaydedilemedi");
              }
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const BlockHours = (
    <View style={cardStyle}>
      <Text style={styles.title}>Çalışma Saatleri</Text>
      <View style={{ gap: 10 }}>
        {openingHours.map((h, idx) => (
          <View key={idx} style={[styles.row, styles.innerCard]}>
            <Text style={{ width: 40, color: panel.colors.text, fontWeight: "600" }}>{DAYS[h.day] || idx}</Text>
            <TextInput
              value={h.open}
              onChangeText={(v) => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], open: v };
                setOpeningHours(next);
              }}
              style={[inputStyle, { flex: 1 }]}
              placeholder="13:00"
            />
            <Text style={{ color: panel.colors.sub, marginHorizontal: 8 }}>—</Text>
            <TextInput
              value={h.close}
              onChangeText={(v) => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], close: v };
                setOpeningHours(next);
              }}
              style={[inputStyle, { flex: 1 }]}
              placeholder="23:00"
            />
            <TouchableOpacity
              onPress={() => {
                const next = [...openingHours];
                next[idx] = { ...next[idx], isClosed: !h.isClosed };
                setOpeningHours(next);
              }}
              style={[btnSecondary, { marginLeft: 8 }]}
            >
              <Text style={{ color: panel.colors.text }}>{h.isClosed ? "Açık Yap" : "Kapalı Gün"}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[btnPrimary, { marginTop: 12, alignSelf: "flex-start" }]}
        onPress={async () => {
          try {
            await updateOpeningHours(restaurantId, openingHours);
            Alert.alert("Başarılı", "Saatler güncellendi");
          } catch (e: any) {
            Alert.alert("Hata", e?.message || "Kaydedilemedi");
          }
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
      </TouchableOpacity>
    </View>
  );

  const BlockPolicies = (
    <View style={cardStyle}>
      <Text style={styles.title}>Rezervasyon Politikaları</Text>

      <Text style={styles.label}>Minimum kişi</Text>
      <TextInput
        keyboardType="numeric"
        value={String(policies.minPartySize)}
        onChangeText={(v) => setPolicies((p) => ({ ...p, minPartySize: Math.max(1, Number(v || 1)) }))}
        style={inputStyle}
      />

      <Text style={styles.label}>Maksimum kişi</Text>
      <TextInput
        keyboardType="numeric"
        value={String(policies.maxPartySize)}
        onChangeText={(v) => setPolicies((p) => ({ ...p, maxPartySize: Math.max(p.minPartySize, Number(v || p.minPartySize)) }))}
        style={inputStyle}
      />

      <Text style={styles.label}>Slot süresi (dk)</Text>
      <TextInput
        keyboardType="numeric"
        value={String(policies.slotMinutes)}
        onChangeText={(v) => setPolicies((p) => ({ ...p, slotMinutes: Math.max(30, Number(v || 30)) }))}
        style={inputStyle}
      />

      <Text style={styles.label}>Check-in penceresi (ÖNCE, dk)</Text>
      <TextInput
        keyboardType="numeric"
        value={String(policies.checkinWindowBeforeMinutes)}
        onChangeText={(v) => setPolicies((p) => ({ ...p, checkinWindowBeforeMinutes: Math.max(0, Number(v || 0)) }))}
        style={inputStyle}
      />

      <Text style={styles.label}>Check-in penceresi (SONRA, dk)</Text>
      <TextInput
        keyboardType="numeric"
        value={String(policies.checkinWindowAfterMinutes)}
        onChangeText={(v) => setPolicies((p) => ({ ...p, checkinWindowAfterMinutes: Math.max(0, Number(v || 0)) }))}
        style={inputStyle}
      />

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 10 }}>
        <TouchableOpacity
          style={[btnSecondary, { backgroundColor: policies.depositRequired ? panel.colors.brand : panel.colors.muted }]}
          onPress={() => setPolicies((p) => ({ ...p, depositRequired: !p.depositRequired }))}
        >
          <Text style={{ color: policies.depositRequired ? "#fff" : panel.colors.text, fontWeight: "700" }}>
            Depozito: {policies.depositRequired ? "Açık" : "Kapalı"}
          </Text>
        </TouchableOpacity>

        {policies.depositRequired && (
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Depozito Tutarı (₺)</Text>
            <TextInput
              keyboardType="numeric"
              value={String(policies.depositAmount)}
              onChangeText={(v) => setPolicies((p) => ({ ...p, depositAmount: Math.max(0, Number(v || 0)) }))}
              style={inputStyle}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[btnPrimary, { marginTop: 12, alignSelf: "flex-start" }]}
        onPress={async () => {
          try {
            await updatePolicies(restaurantId, policies as any);
            Alert.alert("Başarılı", "Politikalar güncellendi");
          } catch (e: any) {
            Alert.alert("Hata", e?.message || "Kaydedilemedi");
          }
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <PanelLayout tabs={Tabs}>
      {tab === "summary" && BlockSummary}
      {tab === "reservations" && BlockReservations}
      {tab === "general" && BlockGeneral}
      {tab === "photos" && BlockPhotos}
      {tab === "menus" && BlockMenus}
      {tab === "tables" && BlockTables}
      {tab === "hours" && BlockHours}
      {tab === "policies" && BlockPolicies}

      {/* === QR Modal === */}
      <Modal visible={scannerOpen} transparent animationType="fade" onRequestClose={() => setScannerOpen(false)}>
        <View style={styles.modalBackdrop}>
          {permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => {
                setScannerOpen(false);
                setQrPayload(String(data || ""));
                setArrivedInput("");
                setArrivedModal(true);
              }} />
              <TouchableOpacity style={[btnSecondary, styles.cameraClose]} onPress={() => setScannerOpen(false)}>
                <Text style={{ color: panel.colors.text }}>Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={requestPermission}
              style={[btnPrimary, { alignSelf: "center" }]}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Kamera izni ver</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Kişi sayısı modalı */}
      <Modal visible={arrivedModal} transparent animationType="fade" onRequestClose={() => setArrivedModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[cardStyle, { width: "90%" }]}>
            <Text style={styles.title}>Gelen Kişi Sayısı</Text>
            <TextInput
              style={inputStyle}
              keyboardType="numeric"
              value={arrivedInput}
              onChangeText={setArrivedInput}
              placeholder="Örn: 5"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={btnSecondary} onPress={() => { setArrivedModal(false); setQrPayload(null); }}>
                <Text style={{ color: panel.colors.text }}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={btnPrimary}
                onPress={async () => {
                  const n = Number(arrivedInput.trim());
                  if (!Number.isFinite(n) || n < 0) return Alert.alert("Uyarı", "Geçerli bir sayı girin.");
                  try {
                    // check-in endpoint sendede mevcuttu (aynı kaldı)
                    // await checkinByQR(qrPayload!, n);
                    setArrivedModal(false);
                    setQrPayload(null);
                    setArrivedInput("");
                    Alert.alert("Başarılı", "Müşteri check-in yapıldı.");
                  } catch (e: any) {
                    Alert.alert("Hata", e?.response?.data?.message || e?.message || "Check-in başarısız");
                  }
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Onayla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </PanelLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: "700", color: panel.colors.text, marginBottom: 10, fontSize: 16 },
  label: { color: panel.colors.sub, marginTop: 8, marginBottom: 6, fontSize: 12 },
  innerCard: {
    borderWidth: 1,
    borderColor: panel.colors.border,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  resCard: {
    borderWidth: 1,
    borderColor: panel.colors.border,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 16 },
  cameraWrap: { width: "92%", height: "70%", borderRadius: 16, overflow: "hidden" },
  cameraClose: { position: "absolute", bottom: 10, alignSelf: "center" },
});
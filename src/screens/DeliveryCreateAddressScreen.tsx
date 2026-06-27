// src/screens/DeliveryCreateAddressScreen.tsx — redesigned
import React from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, Region } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "../components/Themed";
import { createAddress, type UserAddress } from "../api/addresses";
import { useDeliveryAddress } from "../store/useDeliveryAddress";
import { useRegion } from "../store/useRegion";
import { useI18n } from "../i18n";
import { DeliveryColors } from "../delivery/deliveryTheme";
import { DeliveryRoutes, type DeliveryRouteName } from "../navigation/deliveryRoutes";

type RouteParams = { backTo?: DeliveryRouteName } | undefined;

type AddressParts = {
  district: string;
  street: string;
  buildingNo: string;
  doorNo: string;
  town: string;
  city: string;
};

// ── Palette (premium red delivery aesthetic) ──────────────────────────────────
const C = {
  primary: DeliveryColors.primary, // #7B2C2C
  primarySoft: DeliveryColors.primarySoft,
  bg: "#FAF7F5",
  surface: "#FFFFFF",
  text: "#1A1410",
  muted: "#8A7F79",
  line: "#ECE4DF",
  success: "#16A34A",
  successSoft: "#E9F7EF",
};

function safeNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

// ── Field ─────────────────────────────────────────────────────────────────────
type FieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  icon?: any;
};

function Field({ label, placeholder, value, onChangeText, keyboardType, icon }: FieldProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: 7, flex: 1 }}>
      <Text style={st.fieldLabel}>{label}</Text>
      <View
        style={[
          st.fieldBox,
          { borderColor: focused ? C.primary : C.line, backgroundColor: focused ? "#fff" : "#FBFAF9" },
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={focused ? C.primary : C.muted} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#B6ADA7"
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={st.input}
        />
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
const ADDRESS_TYPES: { key: "home" | "work" | "other"; icon: any }[] = [
  { key: "home", icon: "home" },
  { key: "work", icon: "briefcase" },
  { key: "other", icon: "ellipsis-horizontal" },
];

export default function DeliveryCreateAddressScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const params = (route.params || undefined) as RouteParams;

  const { t } = useI18n();
  const { region } = useRegion();
  const setSelected = useDeliveryAddress((s) => s.setSelectedAddress);

  const mapRef = React.useRef<MapView>(null);

  const [typeKey, setTypeKey] = React.useState<"home" | "work" | "other">("home");
  const [customTitle, setCustomTitle] = React.useState("");
  const [note, setNote] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(true);

  const [parts, setParts] = React.useState<AddressParts>({
    district: "", street: "", buildingNo: "", doorNo: "", town: "", city: "",
  });

  const [hasPerm, setHasPerm] = React.useState(false);
  const [permChecked, setPermChecked] = React.useState(false);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fallbackCenter = React.useMemo(() => {
    if (region === "CY") return { lat: 35.1856, lng: 33.3823 };
    if (region === "UK") return { lat: 51.509865, lng: -0.118092 };
    return { lat: 39.925533, lng: 32.866287 };
  }, [region]);

  const initialRegion = React.useMemo<Region>(() => {
    const c = coords ?? fallbackCenter;
    return { latitude: c.lat, longitude: c.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only seed; camera afterwards is driven by animateToRegion

  // BUG FIX 1: camera follows the chosen coordinate (GPS / tap / drag).
  React.useEffect(() => {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      450,
    );
  }, [coords]);

  const locateMe = React.useCallback(async () => {
    try {
      setLocLoading(true);
      let granted = hasPerm;
      if (!granted) {
        const perm = await Location.requestForegroundPermissionsAsync();
        granted = perm.status === "granted";
        setHasPerm(granted);
        setPermChecked(true);
        if (!granted) {
          Alert.alert(t("delivery.address.permissionTitle"), t("delivery.address.permissionBody"));
          return;
        }
      }
      const last = await Location.getLastKnownPositionAsync();
      const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const lat = Number(pos.coords.latitude);
      const lng = Number(pos.coords.longitude);
      if (!safeNum(lat) || !safeNum(lng)) throw new Error("Invalid location");
      setCoords({ lat, lng });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("delivery.address.locationFail"));
    } finally {
      setLocLoading(false);
    }
  }, [hasPerm, t]);

  React.useEffect(() => {
    if (permChecked) return;
    locateMe();
  }, [permChecked, locateMe]);

  const onDragEnd = React.useCallback((e: any) => {
    const { latitude, longitude } = e?.nativeEvent?.coordinate || {};
    if (!safeNum(latitude) || !safeNum(longitude)) return;
    setCoords({ lat: latitude, lng: longitude });
  }, []);

  const buildFullAddress = React.useCallback(() => {
    const p = parts;
    const district = String(p.district || "").trim();
    const street = String(p.street || "").trim();
    const buildingNo = String(p.buildingNo || "").trim();
    const doorNo = String(p.doorNo || "").trim();
    const town = String(p.town || "").trim();
    const city = String(p.city || "").trim();
    const score = (district ? 1 : 0) + (street ? 1 : 0) + (town ? 1 : 0) + (city ? 1 : 0);
    if (score < 3) return null;
    const chunks = [
      district,
      street,
      buildingNo ? `No:${buildingNo}` : null,
      doorNo ? `D:${doorNo}` : null,
      town && city ? `${town}/${city}` : town || city || null,
    ].filter(Boolean);
    const out = chunks.join(", ").trim();
    return out.length >= 5 ? out : null;
  }, [parts]);

  const effectiveTitle = typeKey === "other" ? customTitle.trim() : t(`delivery.address.${typeKey}`);

  const submit = React.useCallback(async () => {
    const addr = buildFullAddress();
    if (!addr) {
      Alert.alert(t("delivery.address.missingTitle"), t("delivery.address.missingBody"));
      return;
    }
    if (!coords) {
      Alert.alert(t("delivery.address.pinRequiredTitle"), t("delivery.address.pinRequiredBody"));
      return;
    }
    try {
      setSaving(true);
      const finalTitle = (effectiveTitle || t("delivery.address.home")).trim() || t("delivery.address.home");
      const created: UserAddress = await createAddress({
        title: finalTitle,
        fullAddress: addr,
        note: String(note || ""),
        makeDefault: !!makeDefault,
        location: { coordinates: [coords.lng, coords.lat] },
      });
      setSelected(created);
      const backTo = params?.backTo;
      if (backTo && backTo !== DeliveryRoutes.CreateAddress) nav.replace(backTo);
      else nav.replace(DeliveryRoutes.AddressPicker);
    } catch (e: any) {
      const raw = e?.response?.data;
      Alert.alert(t("common.error"), raw?.message || e?.message || t("delivery.address.saveFail"));
    } finally {
      setSaving(false);
    }
  }, [buildFullAddress, coords, effectiveTitle, note, makeDefault, setSelected, nav, params, t]);

  const goBack = () => (nav.canGoBack() ? nav.goBack() : nav.replace(DeliveryRoutes.AddressPicker));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Fixed header ── */}
      <View style={[st.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={st.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{t("delivery.address.title")}</Text>
          <Text style={st.headerSub}>{t("delivery.address.subtitle")}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Map card ── */}
          <View style={st.mapCard}>
            <View style={st.mapWrap}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={initialRegion}
                showsUserLocation={hasPerm}
                toolbarEnabled={false}
                onPress={(e) => {
                  const c = e?.nativeEvent?.coordinate;
                  if (!c || !safeNum(c.latitude) || !safeNum(c.longitude)) return;
                  setCoords({ lat: c.latitude, lng: c.longitude });
                }}
              >
                <Marker
                  draggable
                  coordinate={{
                    latitude: (coords ?? fallbackCenter).lat,
                    longitude: (coords ?? fallbackCenter).lng,
                  }}
                  onDragEnd={onDragEnd}
                  anchor={{ x: 0.5, y: 1 }}
                  pinColor={C.primary}
                />
              </MapView>

              {/* Locate-me FAB */}
              <Pressable
                onPress={locateMe}
                disabled={locLoading}
                style={({ pressed }) => [st.locateFab, pressed && { transform: [{ scale: 0.95 }] }]}
              >
                {locLoading ? (
                  <ActivityIndicator color={C.primary} size="small" />
                ) : (
                  <Ionicons name="locate" size={20} color={C.primary} />
                )}
              </Pressable>

              {/* Hint chip (top) */}
              <View style={st.mapHint}>
                <Ionicons name="hand-left-outline" size={13} color="#fff" />
                <Text style={st.mapHintTxt}>{t("delivery.address.pinHint")}</Text>
              </View>
            </View>

            {/* Coord status */}
            <View style={st.coordRow}>
              <View
                style={[
                  st.coordDot,
                  { backgroundColor: coords ? C.successSoft : "#F3EEEB" },
                ]}
              >
                <Ionicons name="pin" size={15} color={coords ? C.success : C.muted} />
              </View>
              <Text style={[st.coordTxt, { color: coords ? C.text : C.muted }]} numberOfLines={1}>
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : t("delivery.address.noPin")}
              </Text>
              <Pressable onPress={locateMe} hitSlop={8} style={st.useLocBtn}>
                <Ionicons name="navigate" size={14} color={C.primary} />
                <Text style={st.useLocTxt}>{t("delivery.address.useMyLocation")}</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Address type chips ── */}
          <View style={{ gap: 9 }}>
            <Text style={st.sectionLabel}>{t("delivery.address.labelTitle")}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ADDRESS_TYPES.map((tp) => {
                const active = typeKey === tp.key;
                return (
                  <Pressable
                    key={tp.key}
                    onPress={() => setTypeKey(tp.key)}
                    style={[st.typeChip, active ? st.typeChipOn : st.typeChipOff]}
                  >
                    <Ionicons name={tp.icon} size={17} color={active ? "#fff" : C.muted} />
                    <Text style={[st.typeChipTxt, { color: active ? "#fff" : C.text }]}>
                      {t(`delivery.address.${tp.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {typeKey === "other" && (
              <Field
                label={t("delivery.address.labelTitle")}
                placeholder={t("delivery.address.placeholderTitle")}
                value={customTitle}
                onChangeText={setCustomTitle}
                icon="pricetag-outline"
              />
            )}
          </View>

          {/* ── Address details ── */}
          <View style={st.card}>
            <Text style={st.cardTitle}>{t("delivery.address.labelAddress")}</Text>
            <Field
              label={t("delivery.address.district")}
              placeholder={t("delivery.address.districtPh")}
              value={parts.district}
              onChangeText={(v) => setParts((s) => ({ ...s, district: v }))}
              icon="business-outline"
            />
            <Field
              label={t("delivery.address.street")}
              placeholder={t("delivery.address.streetPh")}
              value={parts.street}
              onChangeText={(v) => setParts((s) => ({ ...s, street: v }))}
              icon="trail-sign-outline"
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field
                label={t("delivery.address.buildingNo")}
                placeholder="12"
                value={parts.buildingNo}
                onChangeText={(v) => setParts((s) => ({ ...s, buildingNo: v }))}
                keyboardType="number-pad"
                icon="albums-outline"
              />
              <Field
                label={t("delivery.address.doorNo")}
                placeholder="5"
                value={parts.doorNo}
                onChangeText={(v) => setParts((s) => ({ ...s, doorNo: v }))}
                keyboardType="number-pad"
                icon="enter-outline"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Field
                label={t("delivery.address.town")}
                placeholder={t("delivery.address.townPh")}
                value={parts.town}
                onChangeText={(v) => setParts((s) => ({ ...s, town: v }))}
                icon="map-outline"
              />
              <Field
                label={t("delivery.address.city")}
                placeholder={t("delivery.address.cityPh")}
                value={parts.city}
                onChangeText={(v) => setParts((s) => ({ ...s, city: v }))}
                icon="location-outline"
              />
            </View>
          </View>

          {/* ── Note ── */}
          <View style={st.card}>
            <Field
              label={t("delivery.address.note")}
              placeholder={t("delivery.address.notePh")}
              value={note}
              onChangeText={setNote}
              icon="chatbox-outline"
            />
          </View>

          {/* ── Default toggle ── */}
          <Pressable onPress={() => setMakeDefault((v) => !v)} style={st.toggleRow}>
            <View style={st.toggleIcon}>
              <Ionicons name="star" size={18} color={makeDefault ? C.primary : C.muted} />
            </View>
            <Text style={st.toggleTxt}>{t("delivery.address.makeDefault")}</Text>
            <View style={[st.switch, { backgroundColor: makeDefault ? C.primary : "#D8D0CB" }]}>
              <View style={[st.knob, { alignSelf: makeDefault ? "flex-end" : "flex-start" }]} />
            </View>
          </Pressable>
        </ScrollView>

        {/* ── Sticky save bar ── */}
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => [
              st.saveBtn,
              { opacity: saving ? 0.7 : 1 },
              pressed && { transform: [{ scale: 0.99 }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={21} color="#fff" />
                <Text style={st.saveTxt}>{t("common.save")}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontWeight: "900", color: C.text, fontSize: 19, letterSpacing: -0.3 },
  headerSub: { marginTop: 2, fontSize: 12.5, color: C.muted },

  mapCard: {
    backgroundColor: C.surface, borderRadius: 22, overflow: "hidden",
    borderWidth: 1, borderColor: C.line,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07, shadowRadius: 14, elevation: 4,
  },
  mapWrap: { height: 250, backgroundColor: "#EEE7E3" },
  locateFab: {
    position: "absolute", right: 12, bottom: 12,
    width: 46, height: 46, borderRadius: 23, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 5,
  },
  mapHint: {
    position: "absolute", top: 12, left: 12, right: 64,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(26,20,16,0.72)", borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  mapHintTxt: { color: "#fff", fontSize: 11.5, fontWeight: "600", flex: 1 },
  coordRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderTopWidth: 1, borderTopColor: C.line,
  },
  coordDot: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  coordTxt: { flex: 1, fontSize: 13, fontWeight: "700" },
  useLocBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  useLocTxt: { color: C.primary, fontWeight: "800", fontSize: 12.5 },

  sectionLabel: { fontWeight: "900", color: C.text, fontSize: 15 },
  typeChip: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: 15, borderWidth: 1.5,
  },
  typeChipOn: { backgroundColor: C.primary, borderColor: C.primary },
  typeChipOff: { backgroundColor: C.surface, borderColor: C.line },
  typeChipTxt: { fontWeight: "800", fontSize: 14 },

  card: {
    backgroundColor: C.surface, borderRadius: 20, padding: 16, gap: 13,
    borderWidth: 1, borderColor: C.line,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontWeight: "900", color: C.text, fontSize: 15.5 },

  fieldLabel: { fontWeight: "800", color: "#5C534E", fontSize: 12.5 },
  fieldBox: {
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 13,
    paddingVertical: Platform.select({ ios: 13, android: 9 }),
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  input: { flex: 1, color: C.text, fontWeight: "600", fontSize: 15, padding: 0 },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: C.surface, borderRadius: 16, padding: 15,
    borderWidth: 1, borderColor: C.line,
  },
  toggleIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  toggleTxt: { flex: 1, fontWeight: "800", color: C.text, fontSize: 14.5 },
  switch: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: "center" },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },

  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9,
    backgroundColor: C.primary, borderRadius: 17, paddingVertical: 16,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 6,
  },
  saveTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
});

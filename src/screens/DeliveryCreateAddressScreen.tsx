// src/screens/DeliveryCreateAddressScreen.tsx - MODERN VERSION
import React from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
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
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
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

const pad = DeliverySpacing.screenX;

function safeNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

type FieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  icon?: any;
};

function ModernField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  icon,
}: FieldProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontWeight: "900", color: "#111827", fontSize: 14 }}>{label}</Text>
      <View
        style={{
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: isFocused ? DeliveryColors.primary : "#E5E7EB",
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: Platform.select({ ios: 14, android: 12 }),
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {icon && <Ionicons name={icon} size={20} color={isFocused ? DeliveryColors.primary : "#9CA3AF"} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            color: "#111827",
            fontWeight: "600",
            fontSize: 15,
          }}
        />
      </View>
    </View>
  );
}

export default function DeliveryCreateAddressScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const params = (route.params || undefined) as RouteParams;

  const { t } = useI18n();
  const { region } = useRegion();

  const setSelected = useDeliveryAddress((s) => s.setSelectedAddress);

  const [title, setTitle] = React.useState("Ev");
  const [note, setNote] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(true);

  const [parts, setParts] = React.useState<AddressParts>({
    district: "",
    street: "",
    buildingNo: "",
    doorNo: "",
    town: "",
    city: "",
  });

  const [permChecked, setPermChecked] = React.useState(false);
  const [hasPerm, setHasPerm] = React.useState<boolean>(false);
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = React.useState(false);

  const [saving, setSaving] = React.useState(false);

  const fallbackCenter = React.useMemo(() => {
    if (region === "CY") return { lat: 35.1856, lng: 33.3823 };
    if (region === "UK") return { lat: 51.509865, lng: -0.118092 };
    return { lat: 39.925533, lng: 32.866287 };
  }, [region]);

  const mapRegion = React.useMemo<Region>(() => {
    const c = coords ?? fallbackCenter;
    return {
      latitude: c.lat,
      longitude: c.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }, [coords, fallbackCenter]);

  const askPermission = React.useCallback(async () => {
    try {
      setLocLoading(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      const ok = perm.status === "granted";
      setHasPerm(ok);
      setPermChecked(true);

      if (!ok) {
        Alert.alert(
          t("delivery.address.permissionTitle"),
          t("delivery.address.permissionBody")
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = Number(pos.coords.latitude);
      const lng = Number(pos.coords.longitude);
      if (!safeNum(lat) || !safeNum(lng)) throw new Error("Invalid location");

      setCoords({ lat, lng });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("delivery.address.locationFail"));
    } finally {
      setLocLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (permChecked) return;
    askPermission();
  }, [permChecked, askPermission]);

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

    const score =
      (district ? 1 : 0) + (street ? 1 : 0) + (town ? 1 : 0) + (city ? 1 : 0);

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

      const created: UserAddress = await createAddress({
        title: String(title || t("delivery.address.home")).trim() || t("delivery.address.home"),
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
  }, [buildFullAddress, coords, title, note, makeDefault, setSelected, nav, params, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // Header + safe-area offset so focused inputs are pushed above the keyboard
      keyboardVerticalOffset={Platform.OS === "ios" ? Math.max(insets.top, 12) + 12 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
        {/* Modern header */}
        <View
          style={{
            backgroundColor: "#fff",
            paddingHorizontal: pad,
            paddingTop: 20,
            paddingBottom: 24,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: "#FEF2F2",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="location" size={26} color={DeliveryColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 22, letterSpacing: -0.4 }}>
                {t("delivery.address.title")}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: "#6B7280" }}>
                {t("delivery.address.subtitle")}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: pad, gap: 16 }}>
          {/* Modern map section */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>
                📍 {t("delivery.address.pinTitle")}
              </Text>
              <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 18 }}>
                {t("delivery.address.pinHint")}
              </Text>

              {!hasPerm && (
                <Pressable
                  onPress={askPermission}
                  disabled={locLoading}
                  style={({ pressed }) => [
                    {
                      marginTop: 8,
                      backgroundColor: DeliveryColors.primary,
                      borderRadius: 14,
                      paddingVertical: 14,
                      alignItems: "center",
                      opacity: locLoading ? 0.7 : 1,
                      shadowColor: DeliveryColors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      elevation: 3,
                    },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {locLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                      {t("delivery.address.requestPermission")}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            <View style={{ height: 280, backgroundColor: "#E5E7EB" }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={mapRegion}
                showsUserLocation={hasPerm}
                toolbarEnabled={Platform.OS === "android"}
                onPress={(e) => {
                  const c = e?.nativeEvent?.coordinate;
                  if (!c) return;
                  if (!safeNum(c.latitude) || !safeNum(c.longitude)) return;
                  setCoords({ lat: c.latitude, lng: c.longitude });
                }}
              >
                {(coords || fallbackCenter) && (
                  <Marker
                    draggable
                    coordinate={{
                      latitude: (coords ?? fallbackCenter).lat,
                      longitude: (coords ?? fallbackCenter).lng,
                    }}
                    onDragEnd={onDragEnd}
                    anchor={{ x: 0.5, y: 1 }}
                  />
                )}
              </MapView>
            </View>

            <View style={{ padding: 16, backgroundColor: "#F9FAFB" }}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Ionicons name="pin" size={16} color={coords ? "#10B981" : "#9CA3AF"} />
                <Text style={{ fontSize: 12, color: coords ? "#10B981" : "#6B7280", fontWeight: "700" }}>
                  {coords
                    ? `Konum seçildi: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : t("delivery.address.noPin")}
                </Text>
              </View>
            </View>
          </View>

          {/* Address title */}
          <ModernField
            label={t("delivery.address.labelTitle")}
            placeholder={t("delivery.address.placeholderTitle")}
            value={title}
            onChangeText={setTitle}
            icon="home-outline"
          />

          {/* Address details card */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 16,
              gap: 14,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>
              🏠 {t("delivery.address.labelAddress")}
            </Text>

            <ModernField
              label={t("delivery.address.district")}
              placeholder={t("delivery.address.districtPh")}
              value={parts.district}
              onChangeText={(v) => setParts((s) => ({ ...s, district: v }))}
              icon="business-outline"
            />

            <ModernField
              label={t("delivery.address.street")}
              placeholder={t("delivery.address.streetPh")}
              value={parts.street}
              onChangeText={(v) => setParts((s) => ({ ...s, street: v }))}
              icon="trail-sign-outline"
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <ModernField
                  label={t("delivery.address.buildingNo")}
                  placeholder="12"
                  value={parts.buildingNo}
                  onChangeText={(v) => setParts((s) => ({ ...s, buildingNo: v }))}
                  keyboardType="number-pad"
                  icon="albums-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernField
                  label={t("delivery.address.doorNo")}
                  placeholder="5"
                  value={parts.doorNo}
                  onChangeText={(v) => setParts((s) => ({ ...s, doorNo: v }))}
                  keyboardType="number-pad"
                  icon="enter-outline"
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <ModernField
                  label={t("delivery.address.town")}
                  placeholder={t("delivery.address.townPh")}
                  value={parts.town}
                  onChangeText={(v) => setParts((s) => ({ ...s, town: v }))}
                  icon="map-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <ModernField
                  label={t("delivery.address.city")}
                  placeholder={t("delivery.address.cityPh")}
                  value={parts.city}
                  onChangeText={(v) => setParts((s) => ({ ...s, city: v }))}
                  icon="location-outline"
                />
              </View>
            </View>
          </View>

          {/* Note */}
          <ModernField
            label={t("delivery.address.note")}
            placeholder={t("delivery.address.notePh")}
            value={note}
            onChangeText={setNote}
            icon="chatbox-outline"
          />

          {/* Make default checkbox */}
          <Pressable
            onPress={() => setMakeDefault((v) => !v)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 18,
                backgroundColor: "#fff",
                borderRadius: 16,
                borderWidth: 2,
                borderColor: makeDefault ? DeliveryColors.primary : "#E5E7EB",
              },
              pressed && { backgroundColor: "#F9FAFB" },
            ]}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: makeDefault ? DeliveryColors.primary : "#fff",
                borderWidth: 2,
                borderColor: makeDefault ? DeliveryColors.primary : "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {makeDefault && <Ionicons name="checkmark" size={18} color="#fff" />}
            </View>
            <Text style={{ fontWeight: "800", color: "#111827", fontSize: 15 }}>
              {t("delivery.address.makeDefault")}
            </Text>
          </Pressable>

          {/* Save button */}
          <Pressable
            onPress={submit}
            disabled={saving}
            style={({ pressed }) => [
              {
                marginTop: 8,
                backgroundColor: DeliveryColors.primary,
                borderRadius: 18,
                paddingVertical: 16,
                alignItems: "center",
                opacity: saving ? 0.7 : 1,
                shadowColor: DeliveryColors.primary,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  {t("common.save")}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
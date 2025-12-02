import React from "react";
import {
  View,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Image,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Text } from "../components/Themed";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useRegion } from "../store/useRegion";
import * as Location from "expo-location";
import { useI18n } from "../i18n";
import { Ionicons } from "@expo/vector-icons";

type RouteParams = {
  city?: string;
  query?: string;
  fromAssistant?: boolean;
  people?: number;
  dateText?: string;
  timeRange?: string;
  budget?: string;
  style?: string;
};

export default function RestaurantMapScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params || {}) as RouteParams;

  const { region } = useRegion();
  const { t } = useI18n();

  const [data, setData] = React.useState<Restaurant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();

  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locationRequested, setLocationRequested] = React.useState(false);

  // Seçili marker
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [ignoreNextMapPress, setIgnoreNextMapPress] = React.useState(false);

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerTitle: t("map.title"),
    });
  }, [nav, t]);

  // Konum alma
  React.useEffect(() => {
    (async () => {
      if (locationRequested) return;
      try {
        setLocationRequested(true);
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch (e) {
        if (__DEV__) console.log("[map] location error", e);
      }
    })();
  }, [locationRequested]);

  // Restoranları yükle
  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(undefined);

        const cityParam =
          params.city &&
          params.city !== "Hepsi" &&
          params.city !== "All"
            ? params.city
            : undefined;

        const queryParam =
          params.query && params.query.length ? params.query : undefined;

        const list = await listRestaurants({
          region,
          city: cityParam,
          query: queryParam,
          lat: coords?.lat,
          lng: coords?.lng,
        });

        setData(list || []);
      } catch (e: any) {
        const raw = e?.response?.data;
        const isHtml = typeof raw === "string" && raw.startsWith("<!DOCTYPE html");
        const msg =
          (!isHtml && (raw?.message || e?.message)) || t("home.error");
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [region, coords?.lat, coords?.lng, params.city, params.query, t]);

  // Başlangıç region hesaplama
  const initialRegion = React.useMemo<Region | undefined>(() => {
    // Eğer kullanıcı konumu varsa onu merkez al
    if (coords) {
      return {
        latitude: coords.lat,
        longitude: coords.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Eğer listeden en az bir mekan geldiyse onu merkez al
    if (data.length > 0) {
      const first = data[0] as any;
      const loc = (first.location as any) || {};
      const [lng, lat] = Array.isArray(loc.coordinates)
        ? loc.coordinates
        : [undefined, undefined];

      const latitude = lat ?? first.lat ?? 0;
      const longitude = lng ?? first.lng ?? 0;

      return {
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    // Fallback: bölgeye göre kabaca merkez
    if (region === "CY") {
      return {
        latitude: 35.1856, // Lefkoşa civarı
        longitude: 33.3823,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      };
    }

    if (region === "UK") {
      return {
        latitude: 51.509865, // Londra civarı
        longitude: -0.118092,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    return undefined;
  }, [coords, data, region]);

  // Seçili restoran nesnesi
  const selectedRestaurant = React.useMemo<Restaurant | null>(() => {
    if (!selectedId) return null;
    const found = data.find(
      (r) => String((r as any)._id || (r as any).id) === selectedId
    );
    return found || null;
  }, [data, selectedId]);

  if (loading && !initialRegion) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
        <Text secondary style={{ marginTop: 8 }}>
          {t("home.loading")}
        </Text>
      </View>
    );
  }

  if (!initialRegion) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
        }}
      >
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>
          {t("common.error")}
        </Text>
        <Text secondary style={{ textAlign: "center" }}>
          {t("map.noLocation")}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation
        followsUserLocation={false}
        toolbarEnabled={Platform.OS === "android"}
        onPress={() => {
          if (ignoreNextMapPress) {
            setIgnoreNextMapPress(false);
            return;
          }
          if (selectedId) {
            setSelectedId(null);
          }
        }}
      >
        {data.map((r) => {
          const anyR = r as any;
          const loc = anyR.location || {};
          const [lng, lat] = Array.isArray(loc.coordinates)
            ? loc.coordinates
            : [anyR.lng, anyR.lat];

          const latitude = lat;
          const longitude = lng;

          if (typeof latitude !== "number" || typeof longitude !== "number") {
            return null;
          }

          const id = String(r._id || (anyR.id ?? ""));
          const selected = selectedId === id;

          return (
            <Marker
              key={id}
              coordinate={{ latitude, longitude }}
              onPress={() => {
                setSelectedId(id);
                setIgnoreNextMapPress(true);
              }}
              anchor={{ x: 0.5, y: 1 }}
            >
              {/* Rezvix tarzı yuvarlak pin */}
              <View style={styles.markerWrap}>
                <View
                  style={[
                    styles.markerBubble,
                    selected && styles.markerBubbleSelected,
                  ]}
                >
                  <Text style={styles.markerLabel}>R</Text>
                </View>
                <View
                  style={[
                    styles.markerTail,
                    selected && styles.markerTailSelected,
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Asistandan gelen filtreler için üst bilgilendirme */}
      {params.fromAssistant && (
        <View style={styles.assistantHintWrap} pointerEvents="none">
          <View style={styles.assistantHintChip}>
            <Ionicons
              name="sparkles-outline"
              size={14}
              color="#7B2C2C"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.assistantHintText} numberOfLines={2}>
              {params.city
                ? t("map.assistantCityHint", { city: params.city })
                : t("map.assistantHint")}
            </Text>
          </View>
        </View>
      )}

      {/* Alt bilgilendirme chip'i (hiç mekan yoksa) */}
      {!loading && data.length === 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 24,
            alignItems: "center",
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.9)",
            }}
          >
            <Text style={{ fontSize: 13 }}>{t("map.noResults")}</Text>
          </View>
        </View>
      )}

      {/* Seçili mekan kartı (bottom sheet tarzı) */}
      {selectedRestaurant && (
        <View style={styles.bottomCardWrap}>
          <Pressable
            style={styles.bottomCardPressable}
            onPress={() =>
              nav.navigate("Restoran", { id: (selectedRestaurant as any)._id })
            }
          >
            {/* Üstte büyük hero görsel */}
            {selectedRestaurant.photos && selectedRestaurant.photos[0] ? (
              <Image
                source={{ uri: selectedRestaurant.photos[0] }}
                style={styles.bottomHeroImage}
              />
            ) : (
              <View style={[styles.bottomHeroImage, styles.bottomHeroPlaceholder]}>
                <Text style={styles.bottomHeroPlaceholderText}>R</Text>
              </View>
            )}

            {/* Alt tarafta içerik */}
            <View style={styles.bottomCardBody}>
              <View style={styles.bottomHeaderRow}>
                <Text style={styles.calloutTitle} numberOfLines={1}>
                  {selectedRestaurant.name}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedId(null);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Adres satırı (varsa) */}
              {(selectedRestaurant as any).address ? (
                <View style={styles.bottomAddressRow}>
                  <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.bottomAddressText} numberOfLines={1}>
                    {(selectedRestaurant as any).address}
                  </Text>
                </View>
              ) : null}

              <View style={styles.bottomMetaRow}>
                {selectedRestaurant.city ? (
                  <Text style={styles.bottomCityText} numberOfLines={1}>
                    {selectedRestaurant.city}
                  </Text>
                ) : null}
                <View style={styles.bottomPricePill}>
                  <Text style={styles.bottomPriceText}>
                    {selectedRestaurant.priceRange || "₺₺"}
                  </Text>
                </View>
              </View>

              <View style={styles.bottomFooterRow}>
                <View style={styles.bottomCtaPill}>
                  <Text style={styles.bottomMoreText}>{t("map.calloutMore")}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color="#fff"
                  />
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#7B2C2C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerBubbleSelected: {
    backgroundColor: "#B91C1C",
    transform: [{ scale: 1.25 }],
  },
  markerLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  markerTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: "#7B2C2C",
    borderLeftWidth: 5,
    borderLeftColor: "transparent",
    borderRightWidth: 5,
    borderRightColor: "transparent",
    marginTop: -1,
  },
  markerTailSelected: {
    borderTopColor: "#B91C1C",
  },
  bottomCardWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  bottomCardPressable: {
    width: "92%",
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  bottomHeroImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#E5E7EB",
  },
  bottomHeroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomHeroPlaceholderText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#7B2C2C",
  },
  bottomCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bottomAddressRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomAddressText: {
    flex: 1,
    marginLeft: 4,
    fontSize: 12,
    color: "#4B5563",
  },
  bottomHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomCardPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#7B2C2C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bottomCardTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  bottomMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomCityText: {
    flex: 1,
    fontSize: 12,
    color: "#6B7280",
    marginRight: 8,
  },
  bottomPricePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F3E8E3",
  },
  bottomPriceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7B2C2C",
  },
  bottomCardImage: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: "#E5E7EB",
  },
  bottomFooterRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bottomCtaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#B91C1C",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 2,
  },
  bottomMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    marginRight: 4,
  },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
    color: "#111827",
  },
  calloutSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  assistantHintWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  assistantHintChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  assistantHintText: {
    fontSize: 12,
    color: "#374151",
    maxWidth: "88%",
  }
});
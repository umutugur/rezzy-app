// src/screens/DeliveryAddressPickerScreen.tsx - MODERN VERSION
import React from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { Text } from "../components/Themed";
import {
  listMyAddresses,
  makeDefaultAddress,
  type UserAddress,
} from "../api/addresses";
import { useDeliveryAddress } from "../store/useDeliveryAddress";
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
  DeliverySpacing,
} from "../delivery/deliveryTheme";
import { DeliveryRoutes } from "../navigation/deliveryRoutes";

export default function DeliveryAddressPickerScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();

  const returnTo: string = route?.params?.returnTo || DeliveryRoutes.DeliveryHome;
  const currentAddressIdParam: string | undefined = route?.params?.currentAddressId
    ? String(route.params.currentAddressId)
    : undefined;

  const setSelected = useDeliveryAddress((s) => s.setSelectedAddress);
  const selectedId = useDeliveryAddress((s) => s.selectedAddressId);

  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UserAddress[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyAddresses();
      setItems(rows);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Adresler alınamadı."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const pick = React.useCallback(
    (addr: UserAddress) => {
      setSelected(addr);

      const addressId = String(addr._id);
      const addressText = String(addr.fullAddress || "").trim();

      if (returnTo === DeliveryRoutes.DeliveryHome) {
        nav.replace(DeliveryRoutes.DeliveryHome, {
          addressId,
          addressText,
          address: addr,
        });
        return;
      }

      nav.navigate(returnTo, {
        addressId,
        addressText,
        address: addr,
        currentAddressId: currentAddressIdParam,
      });

      nav.goBack();
    },
    [setSelected, nav, returnTo, currentAddressIdParam]
  );

  const setDefault = React.useCallback(
    async (addr: UserAddress) => {
      try {
        const updated = await makeDefaultAddress(String(addr._id));
        await load();
        if (selectedId === String(addr._id)) setSelected(updated);
      } catch (e: any) {
        Alert.alert(
          "Hata",
          e?.response?.data?.message ||
            e?.message ||
            "Varsayılan adres ayarlanamadı."
        );
      }
    },
    [load, selectedId, setSelected]
  );

  const goCreateAddress = React.useCallback(() => {
    nav.navigate(DeliveryRoutes.CreateAddress, {
      backTo: returnTo,
      currentAddressId: currentAddressIdParam,
    });
  }, [nav, returnTo, currentAddressIdParam]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F9FAFB",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "#FEF2F2",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <ActivityIndicator size="large" color={DeliveryColors.primary} />
        </View>
        <Text style={{ color: "#6B7280", fontWeight: "600" }}>
          Adresler yükleniyor…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* Modern header */}
      <View
        style={{
          backgroundColor: "#fff",
          paddingHorizontal: DeliverySpacing.screenX,
          paddingTop: 16,
          paddingBottom: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "900", color: "#111827", letterSpacing: -0.5 }}>
          Teslimat Adreslerim
        </Text>
        <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Teslimat için bir adres seçin
        </Text>
      </View>

      {!!error && (
        <View
          style={{
            margin: DeliverySpacing.screenX,
            marginTop: 16,
            backgroundColor: "#FEF2F2",
            borderWidth: 1,
            borderColor: "#FCA5A5",
            padding: 14,
            borderRadius: 16,
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
          }}
        >
          <Ionicons name="alert-circle" size={24} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "900", color: "#DC2626" }}>Hata</Text>
            <Text style={{ color: "#991B1B", marginTop: 4, fontSize: 13 }}>{error}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(x) => String(x._id)}
        contentContainerStyle={{
          padding: DeliverySpacing.screenX,
          paddingTop: 16,
          gap: 12,
          paddingBottom: 24,
        }}
        ListHeaderComponent={
          items.length > 0 ? (
            <Pressable
              onPress={goCreateAddress}
              style={({ pressed }) => [
                {
                  backgroundColor: "#fff",
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#F3F4F6",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 2,
                },
                pressed && { transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: "#FEF2F2",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="add" size={22} color={DeliveryColors.primary} />
                </View>

                <View style={{ gap: 2 }}>
                  <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>
                    Yeni adres ekle
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 13 }}>
                    Paket servis için adres ekleyebilirsiniz
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={22} color="#D1D5DB" />
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 48 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#FEF2F2",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Ionicons
                name="location-outline"
                size={40}
                color={DeliveryColors.primary}
              />
            </View>
            <View style={{ alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "900", color: "#111827", fontSize: 18 }}>
                Adres yok
              </Text>
              <Text style={{ textAlign: "center", color: "#6B7280", lineHeight: 20, paddingHorizontal: 32 }}>
                Paket servis için önce profilinizden bir adres eklemelisiniz.
              </Text>
            </View>
            
            <Pressable
              onPress={() =>
                nav.navigate(DeliveryRoutes.CreateAddress, {
                  backTo: returnTo,
                })
              }
              style={({ pressed }) => [
                {
                  marginTop: 8,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: DeliveryColors.primary,
                  shadowColor: DeliveryColors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 4,
                },
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                + Adres Ekle
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => {
          const isSelected = selectedId === String(item._id);
          const isDefault = !!item.isDefault;

          return (
            <AnimatedAddressCard index={index}>
              <Pressable
                onPress={() => pick(item)}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#fff",
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: isSelected ? DeliveryColors.primary : "#F3F4F6",
                    shadowColor: isSelected ? DeliveryColors.primary : "#000",
                    shadowOffset: { width: 0, height: isSelected ? 6 : 3 },
                    shadowOpacity: isSelected ? 0.15 : 0.06,
                    shadowRadius: isSelected ? 12 : 8,
                    elevation: isSelected ? 5 : 2,
                  },
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                  {/* Icon */}
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      backgroundColor: isSelected ? DeliveryColors.primary : "#FEF2F2",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={isSelected ? "home" : "home-outline"}
                      size={24}
                      color={isSelected ? "#fff" : DeliveryColors.primary}
                    />
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Text style={{ fontWeight: "900", color: "#111827", fontSize: 16 }}>
                        {item.title || "Adres"}
                      </Text>
                      
                      {isDefault && (
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 12,
                            backgroundColor: "#10B981",
                          }}
                        >
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "900",
                              fontSize: 11,
                            }}
                          >
                            ✓ Varsayılan
                          </Text>
                        </View>
                      )}

                      {isSelected && (
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 12,
                            backgroundColor: `${DeliveryColors.primary}20`,
                          }}
                        >
                          <Text
                            style={{
                              color: DeliveryColors.primary,
                              fontWeight: "900",
                              fontSize: 11,
                            }}
                          >
                            SEÇİLİ
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={{ color: "#6B7280", lineHeight: 20, fontSize: 14 }} numberOfLines={3}>
                      {item.fullAddress}
                    </Text>

                    {/* Actions */}
                    {!isDefault && (
                      <View style={{ marginTop: 4 }}>
                        <Pressable
                          onPress={() => setDefault(item)}
                          style={({ pressed }) => [
                            {
                              paddingHorizontal: 14,
                              paddingVertical: Platform.select({ ios: 9, android: 8 }),
                              borderRadius: 12,
                              backgroundColor: "#F9FAFB",
                              borderWidth: 1,
                              borderColor: "#E5E7EB",
                              alignSelf: "flex-start",
                            },
                            pressed && { backgroundColor: "#F3F4F6" },
                          ]}
                        >
                          <Text
                            style={{
                              fontWeight: "900",
                              color: "#374151",
                              fontSize: 12,
                            }}
                          >
                            ★ Varsayılan Yap
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Chevron */}
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "chevron-forward"}
                    size={24}
                    color={isSelected ? DeliveryColors.primary : "#D1D5DB"}
                  />
                </View>
              </Pressable>
            </AnimatedAddressCard>
          );
        }}
      />
    </View>
  );
}

// Animated address card
function AnimatedAddressCard({ children, index }: { children: React.ReactNode; index: number }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      {children}
    </Animated.View>
  );
}
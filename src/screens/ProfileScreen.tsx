// src/screens/ProfileScreen.tsx
import React, { useMemo } from "react";
import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../components/Themed";
import Button from "../components/Button";
import { useAuth } from "../store/useAuth";

// restaurantId hem string hem {_id,name} gelebilir → stringe çevir
function coerceRestaurantId(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  // eski payload: { _id: string, name?: string }
  if (typeof val === "object" && val !== null && "_id" in (val as any)) {
    const id = (val as any)._id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  // restaurantId'yi güvenli şekilde çöz
  const rid = useMemo(() => coerceRestaurantId(user?.restaurantId as any), [user?.restaurantId]);

  return (
    <Screen>
      <Text style={{ fontWeight: "700", marginBottom: 8 }}>Profil</Text>

      {user?.role === "restaurant" && !!rid && (
        <Button
          title="Restoran Paneli"
          onPress={() => nav.navigate("RestaurantPanel", { restaurantId: rid })}
        />
      )}

      <Button title="Çıkış" variant="outline" onPress={clear} />
    </Screen>
  );
}

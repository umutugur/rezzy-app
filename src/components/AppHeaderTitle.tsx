import React from "react";
import { View, Image, Text } from "react-native";

export default function AppHeaderTitle() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Image
        source={require("../assets/icon.png")} // gerekirse küçük bir logo ekleyip değiştir
        style={{ width: 22, height: 22, borderRadius: 4, marginRight: 8 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#1A1A1A" }}>
        Rezzy
      </Text>
    </View>
  );
}
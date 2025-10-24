import React from "react";
import { View, Image, Text, Platform } from "react-native";

export default function AppHeaderTitle() {
  const logoSize = Platform.select({ ios: 40, android: 38, default: 38 });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      <Image
        source={require("../assets/icon.png")}
        style={{ width: logoSize, height: logoSize, borderRadius: 8, marginRight: 10 }}
        resizeMode="contain"
      />
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: "#7B2C2C",
          letterSpacing: 0.5,
        }}
      >
        Rezzy
      </Text>
    </View>
  );
}
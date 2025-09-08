import React from "react";
import { View, Image, Pressable } from "react-native";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

export default function Card({ photo, title, subtitle, onPress }:{
  photo?: string; title: string; subtitle?: string; onPress?: ()=>void;
}){
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: lightTheme.colors.surface, borderRadius: lightTheme.radius.md, overflow:"hidden",
      borderWidth:1, borderColor: lightTheme.colors.border, marginBottom: 12
    }}>
      {photo ? <Image source={{ uri: photo }} style={{ width: "100%", height: 160 }} /> : null}
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text secondary>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

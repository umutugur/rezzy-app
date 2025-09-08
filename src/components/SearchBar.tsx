// src/components/SearchBar.tsx
import React from "react";
import { View, TextInput } from "react-native";
import { Text } from "./Themed";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Restoran ara…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#F3F4F6",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
      }}
    >
      <Text>🔎</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        style={{ flex: 1 }}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

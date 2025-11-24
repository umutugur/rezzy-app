// components/SearchBar.tsx
import React from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";

export default function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string; // dışarıdan gelirse öncelik verilir
}) {
  const { t } = useI18n();
  const ph = placeholder ?? t("search.placeholder");

  const [isFocused, setIsFocused] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <Ionicons name="search" size={20} color={isFocused ? "#7B2C2C" : "#666666"} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        placeholder={ph}
        style={styles.input}
        placeholderTextColor="#999999"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {value.length > 0 && (
        <Pressable onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={18} color="#999999" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#FAFAFA", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16,
    borderWidth: 2, borderColor: "#E6E6E6",
  },
  containerFocused: { backgroundColor: "#FFF5F5", borderColor: "#7B2C2C" },
  input: { flex: 1, fontSize: 15, color: "#1A1A1A", padding: 0, margin: 0 },
  clearButton: { padding: 2 },
});
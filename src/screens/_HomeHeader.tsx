import React, { useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from "react-native";
import { Text } from "../components/Themed";

const HEADER_VSPACE = 4;
const SECTION_GAP = 4;
const CHIP_H = 36;

type Props = {
  searchOpen: boolean;
  inputRef: React.RefObject<TextInput | null>;
  cities: string[];
  city: string;
  setCity: (c: string) => void;
  query: string;
  setQuery: (t: string) => void;
  fetching: boolean;
  onSubmit: () => void;
  onClear: () => void;
};

export default function HomeHeader({
  searchOpen,
  inputRef,
  cities,
  city,
  setCity,
  query,
  setQuery,
  fetching,
  onSubmit,
  onClear,
}: Props) {
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      inputRef.current?.blur?.();
      Keyboard.dismiss();
    }
  }, [searchOpen, inputRef]);

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: HEADER_VSPACE,
        paddingBottom: SECTION_GAP,
      }}
    >
      {/* Search */}
      {searchOpen && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#E6E6E6",
            borderRadius: 12,
            backgroundColor: "#fff",
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 6,
          }}
        >
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Mekan ara (isim)"
            placeholderTextColor="#9CA3AF"
            selectionColor="#7B2C2C"
            style={{ flex: 1, color: "#111" }}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              inputRef.current?.blur();
              onSubmit();
            }}
            autoCorrect={false}
            blurOnSubmit={false}
          />

          {fetching && <ActivityIndicator size="small" style={{ marginLeft: 6 }} />}

          {query.length > 0 && (
            <Pressable
              onPress={() => {
                onClear();
                inputRef.current?.blur();
                Keyboard.dismiss();
              }}
              style={{
                marginLeft: 8,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Text secondary>Temizle</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* City chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {cities.map((c) => {
            const active = c === city;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  inputRef.current?.blur?.();
                  Keyboard.dismiss();
                  setCity(c);
                }}
                style={{
                  height: CHIP_H,
                  paddingHorizontal: 12,
                  borderRadius: CHIP_H / 2,
                  borderWidth: 1,
                  justifyContent: "center",
                  backgroundColor: active ? "#7B2C2C" : "#FFFFFF",
                  borderColor: active ? "#7B2C2C" : "#E6E6E6",
                }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : "#1A1A1A",
                    fontWeight: "600",
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
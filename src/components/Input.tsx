import React from "react";
import { TextInput, View } from "react-native";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

type Props = {
  label?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  error?: string;
  style?: any;
};

export default function Input(p: Props) {
  return (
    <View style={{ marginBottom: 12 }}>
      {p.label ? (
        <Text secondary style={{ marginBottom: 6 }}>
          {p.label}
        </Text>
      ) : null}

      <TextInput
        placeholder={p.placeholder}
        placeholderTextColor="#9CA3AF" // açık gri placeholder
        value={p.value}
        onChangeText={p.onChangeText}
        secureTextEntry={p.secureTextEntry}
        keyboardType={p.keyboardType}
        style={[
          {
            borderWidth: 1,
            borderColor: p.error
              ? lightTheme.colors.error
              : lightTheme.colors.border,
            borderRadius: lightTheme.radius.md,
            paddingHorizontal: 12,
            paddingVertical: 12,
            backgroundColor: "#FFFFFF", // beyaz arka plan
            color: "#111827", // koyu yazı rengi
          },
          p.style,
        ]}
      />

      {p.error ? (
        <Text
          secondary
          style={{ color: lightTheme.colors.error, marginTop: 4 }}
        >
          {p.error}
        </Text>
      ) : null}
    </View>
  );
}

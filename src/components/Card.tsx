import React from "react";
import { View, Image, Pressable } from "react-native";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

type Props = {
  photo?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;

  /** ✅ Opsiyonel: kartın sağ üstünde kalp göstermek için */
  isFav?: boolean;
  onToggleFav?: () => void;
};

export default function Card({ photo, title, subtitle, onPress, isFav, onToggleFav }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: lightTheme.colors.surface,
        borderRadius: lightTheme.radius.md,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: lightTheme.colors.border,
        marginBottom: 12,
        position: "relative",
      }}
    >
      {photo ? (
        <View style={{ position: "relative" }}>
          <Image source={{ uri: photo }} style={{ width: "100%", height: 160 }} />
          {/* ✅ Kalp butonu (opsiyonel) */}
          {typeof isFav === "boolean" && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onToggleFav?.();
              }}
              style={{
                position: "absolute",
                right: 10,
                top: 10,
                backgroundColor: "rgba(255,255,255,0.9)",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: lightTheme.colors.border,
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  color: isFav ? "#DC2626" : lightTheme.colors.text,
                }}
              >
                {isFav ? "♥" : "♡"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text secondary>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

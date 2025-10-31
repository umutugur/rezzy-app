import React from "react";
import { View, Image, Pressable, StyleSheet, Platform } from "react-native";
import { Text } from "./Themed";

const R = {
  bg: "#FFFFFF",
  border: "#E2E8F0",
  text: "#1E293B",
  muted: "#64748B",
  shadow:
    Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }
      : { elevation: 3 },
};

type Props = {
  photo?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isFav?: boolean;
  onToggleFav?: () => void;
};

export default function Card({ photo, title, subtitle, onPress, isFav, onToggleFav }: Props) {
  return (
    <Pressable onPress={onPress} android_ripple={{ color: "#f3f4f6" }} style={styles.card}>
      {photo ? (
        <View style={styles.imageBox}>
          <Image source={{ uri: photo }} style={styles.img} resizeMode="cover" />
          {typeof isFav === "boolean" && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onToggleFav?.();
              }}
              android_ripple={{ color: "#e5e7eb", borderless: true }}
              style={styles.favBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isFav ? "Favoriden çıkar" : "Favorilere ekle"}
            >
              <Text style={[styles.favTxt, isFav && styles.favTxtActive]}>
                {isFav ? "♥" : "♡"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: R.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: R.border,
    overflow: "hidden",
    marginBottom: 12,
    ...R.shadow,
  },
  imageBox: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  img: { width: "100%", height: "100%" },
  favBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: R.border,
  },
  favTxt: { fontSize: 16, fontWeight: "800", color: R.text },
  favTxtActive: { color: "#DC2626" },
  info: { padding: 12, gap: 2 },
  title: { fontSize: 17, fontWeight: "700", color: R.text },
  sub: { fontSize: 14, color: R.muted },
});
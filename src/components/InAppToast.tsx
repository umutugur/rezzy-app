import React, { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Platform, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "../store/useNotifications";
import { Text } from "./Themed";

type Props = {
  onPressItem?: (n: { id: string; data?: any }) => void;
};

export default function InAppToast({ onPressItem }: Props) {
  const latest = useNotifications((s) => s.latest);
  const clearLatest = useNotifications((s) => s.clearLatest);

  const [visible, setVisible] = useState(false);
  const [y] = useState(new Animated.Value(-100));

  useEffect(() => {
    if (!latest) return;
    setVisible(true);
    Animated.timing(y, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => hide(), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  const hide = () => {
    Animated.timing(y, {
      toValue: -100,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      clearLatest();
    });
  };

  if (!latest || !visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: Platform.select({ ios: 56, android: 24 }),
        left: 12,
        right: 12,
        transform: [{ translateY: y }],
        zIndex: 999,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          onPressItem?.({ id: latest.id, data: latest.data });
          hide();
        }}
        style={{
          backgroundColor: "#111827",
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Ionicons name="notifications" size={18} color="#fff" style={{ marginRight: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }} numberOfLines={1}>
            {latest.title}
          </Text>
          {!!latest.body && (
            <Text style={{ color: "#E5E7EB" }} numberOfLines={2}>
              {latest.body}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

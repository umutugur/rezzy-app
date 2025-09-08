import React from "react";
import { View, Image, TouchableOpacity } from "react-native";
import { Text } from "./Themed";
import StatusBadge from "./StatusBadge";
import { formatDateTime, isPast } from "../utils/format";

export default function ReservationCard({
  title,
  dateISO,
  status,
  thumb,
  onPress,
}: {
  title: string;
  dateISO: string;
  status: string;
  thumb?: string;
  onPress?: () => void;
}) {
  const dim = isPast(dateISO) ? 0.6 : 1;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: "#fff",
        marginBottom: 12,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
        opacity: dim,
      }}>
      {/* Thumb */}
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: 56, height: 56, borderRadius: 12 }} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems:"center", justifyContent:"center" }}>
          <Text>🧾</Text>
        </View>
      )}

      {/* Texts */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight:"800", fontSize: 16 }} numberOfLines={1}>{title}</Text>
        <Text secondary style={{ marginTop: 2 }}>📅 {formatDateTime(dateISO)}</Text>
        <View style={{ height: 6 }} />
        <StatusBadge status={status} size="sm" />
      </View>

      <Text secondary style={{ fontSize: 18, marginLeft: 8 }}>›</Text>
    </TouchableOpacity>
  );
}

import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./Themed";

export default function RadioRow({
  label,
  price,
  selected,
  onPress,
}: {
  label: string;
  price: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}
      style={{
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent:"space-between",
      }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontWeight:"700" }}>{label}</Text>
        <Text secondary style={{ marginTop: 2 }}>{price}</Text>
      </View>
      <View style={{
        width: 24, height: 24, borderRadius: 999,
        borderWidth: 2, borderColor: selected ? "#7C2D12" : "#D1D5DB",
        alignItems:"center", justifyContent:"center",
        backgroundColor: selected ? "#7C2D12" : "transparent"
      }}>
        {selected ? <View style={{ width:10, height:10, borderRadius:999, backgroundColor:"#fff" }} /> : null}
      </View>
    </TouchableOpacity>
  );
}

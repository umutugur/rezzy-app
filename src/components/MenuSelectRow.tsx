// src/components/MenuSelectRow.tsx
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "./Themed";

type Menu = { id: string; name: string; price: number };

export default function MenuSelectRow({
  personIndex,
  menus,
  selected,
  onSelect,
}: {
  personIndex: number;
  menus: Menu[];
  selected?: string;
  onSelect: (menuId: string) => void;
}) {
  if (!menus?.length) {
    return (
      <View style={{ paddingVertical: 8 }}>
        <Text secondary>Bu restoran için menü bulunamadı.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {menus.map((m) => {
        const isActive = selected === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            onPress={() => onSelect(m.id)}
            activeOpacity={0.9}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isActive ? "#7C2D12" : "#E5E7EB",
              backgroundColor: isActive ? "#FFF7ED" : "#FFF",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: "700" }} numberOfLines={1}>
                {m.name}
              </Text>
              <Text secondary>₺{m.price.toFixed(0)}</Text>
            </View>

            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: isActive ? "#7C2D12" : "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? "#7C2D12" : "transparent",
              }}
            >
              {isActive ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                  }}
                />
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

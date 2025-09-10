// components/FilterTabs.tsx
import React from "react";
import { View, Pressable, Text, Modal, FlatList } from "react-native";

export type FilterKey = "all" | "active" | "past";
export type AdvancedStatus =
  | "pending" | "confirmed" | "arrived" | "no_show" | "cancelled" | "rejected";

export default function FilterTabs({
  value,
  onChange,
  onAdvancedChange,  // opsiyonel: gelişmiş durum seçimi geldiğinde
  showAdvanced = true,
}: {
  value: FilterKey;
  onChange: (v: FilterKey) => void;
  onAdvancedChange?: (s: AdvancedStatus) => void;
  showAdvanced?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const TABS: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif" },
    { key: "past", label: "Geçmiş" },
  ];

  const ADVANCED: Array<{ key: AdvancedStatus; label: string }> = [
    { key: "pending",   label: "Bekleyen" },
    { key: "confirmed", label: "Onaylandı" },
    { key: "arrived",   label: "Geldi" },
    { key: "no_show",   label: "Gelmedi" },
    { key: "cancelled", label: "İptal" },
    { key: "rejected",  label: "Reddedildi" },
  ];

  return (
    <View style={{ gap: 10 }}>
      {/* Segmented control – 3 seçenek */}
      <View style={{
        flexDirection: "row",
        backgroundColor: "#F3F4F6",
        borderRadius: 12,
        padding: 4,
      }}>
        {TABS.map(t => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active ? "#0F172A" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: active ? "#fff" : "#0F172A", fontWeight: "700" }}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Gelişmiş filtre (opsiyonel) */}
      {showAdvanced && (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: "#EEF2FF",
            }}
          >
            <Text style={{ color: "#3730A3", fontWeight: "600" }}>Gelişmiş…</Text>
          </Pressable>

          <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <Pressable style={{ flex:1, backgroundColor: "rgba(0,0,0,0.25)" }} onPress={() => setOpen(false)}>
              <View
                style={{
                  position: "absolute",
                  left: 16, right: 16, bottom: 24,
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 12,
                  shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, elevation: 4,
                }}
              >
                <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Duruma göre filtrele</Text>
                <FlatList
                  data={ADVANCED}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => { onAdvancedChange?.(item.key); setOpen(false); }}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: "#F9FAFB",
                        marginVertical: 4,
                      }}
                    >
                      <Text style={{ fontWeight: "600" }}>{item.label}</Text>
                    </Pressable>
                  )}
                />
              </View>
            </Pressable>
          </Modal>
        </>
      )}
    </View>
  );
}

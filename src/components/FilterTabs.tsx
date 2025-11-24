// components/FilterTabs.tsx
import React from "react";
import { View, Pressable, Text, Modal, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../i18n";

export type FilterKey = "all" | "active" | "past";
export type AdvancedStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "no_show"
  | "cancelled"
  | "rejected";

export default function FilterTabs({
  value,
  onChange,
  onAdvancedChange,
  showAdvanced = true,
}: {
  value: FilterKey;
  onChange: (v: FilterKey) => void;
  onAdvancedChange?: (s: AdvancedStatus) => void;
  showAdvanced?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const TABS: Array<{ key: FilterKey; label: string; icon: string }> = [
    { key: "all",    label: t("filters.all"),   icon: "list-outline" },
    { key: "active", label: t("filters.active"),icon: "time-outline" },
    { key: "past",   label: t("filters.past"),  icon: "checkmark-done-outline" },
  ];

  // Etiketleri status sözlüğünden çekiyoruz ki tek kaynaktan yönetilsin.
  const ADVANCED: Array<{ key: AdvancedStatus; label: string; icon: string; color: string }> = [
    { key: "pending",   label: t("status.pending"),   icon: "time",            color: "#D4AF37" },
    { key: "confirmed", label: t("status.confirmed"), icon: "checkmark-circle",color: "#16A085" },
    { key: "arrived",   label: t("status.arrived"),   icon: "enter",           color: "#7B2C2C" },
    { key: "no_show",   label: t("status.no_show"),   icon: "close-circle",    color: "#E53935" },
    { key: "cancelled", label: t("status.cancelled"), icon: "ban",             color: "#666666" },
    { key: "rejected",  label: t("status.rejected"),  icon: "alert-circle",    color: "#E53935" },
  ];

  return (
    <View style={styles.container}>
      {/* Segmented control – 3 seçenek */}
      <View style={styles.segmentedControl}>
        {TABS.map((tab) => {
          const active = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={active ? "#fff" : "#1A1A1A"}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Gelişmiş filtre (opsiyonel) */}
      {showAdvanced && (
        <>
          <Pressable onPress={() => setOpen(true)} style={styles.advancedButton}>
            <Ionicons name="options-outline" size={16} color="#7B2C2C" />
            <Text style={styles.advancedButtonText}>{t("filters.advanced")}</Text>
            <Ionicons name="chevron-down" size={16} color="#7B2C2C" />
          </Pressable>

          <Modal
            visible={open}
            transparent
            animationType="fade"
            onRequestClose={() => setOpen(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleRow}>
                    <Ionicons name="funnel" size={22} color="#1A1A1A" />
                    <Text style={styles.modalTitle}>{t("filters.byStatus")}</Text>
                  </View>
                  <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#666666" />
                  </Pressable>
                </View>

                <FlatList
                  data={ADVANCED}
                  keyExtractor={(item) => item.key}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        onAdvancedChange?.(item.key);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.advancedItem,
                        pressed && styles.advancedItemPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.advancedIconContainer,
                          { backgroundColor: item.color + "15" },
                        ]}
                      >
                        <Ionicons name={item.icon as any} size={22} color={item.color} />
                      </View>
                      <Text style={styles.advancedItemText}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#666666" />
                    </Pressable>
                  )}
                  showsVerticalScrollIndicator={false}
                />

                <Pressable onPress={() => setOpen(false)} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingHorizontal: 16 },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: 10, gap: 6,
  },
  tabActive: { backgroundColor: "#7B2C2C" },
  tabText: { color: "#1A1A1A", fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  advancedButton: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#FFE0E0", gap: 6,
  },
  advancedButtonText: { color: "#7B2C2C", fontWeight: "600", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 20, paddingBottom: 20, paddingHorizontal: 16,
    maxHeight: "70%", shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E6E6E6",
  },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  closeButton: { padding: 4 },
  advancedItem: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: "#FAFAFA", marginBottom: 8, gap: 12,
  },
  advancedItemPressed: { backgroundColor: "#F3F4F6" },
  advancedIconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  advancedItemText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  cancelButton: { marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  cancelButtonText: { fontSize: 15, fontWeight: "700", color: "#666666" },
});
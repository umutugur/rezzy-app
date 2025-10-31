// components/TimeTabs.tsx
import React from "react";
import { View, Pressable, Text, Modal, Platform, StyleSheet } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

export type TimeKey = "all" | "today" | "week" | "custom";

export default function TimeTabs({
  value,
  onChange,
  onCustomChange,
}: {
  value: TimeKey;
  onChange: (v: TimeKey) => void;
  onCustomChange?: (startISO: string, endISO: string) => void;
}) {
  const [rangeOpen, setRangeOpen] = React.useState(false);
  const [activeIOS, setActiveIOS] = React.useState<null | "start" | "end">(null);

  const today00 = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [start, setStart] = React.useState<Date>(today00);
  const [end, setEnd] = React.useState<Date>(
    new Date(today00.getTime() + 6 * 24 * 3600 * 1000)
  );

  const handleTab = (k: TimeKey) => {
    if (k === "custom") {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      setStart(t);
      setEnd(new Date(t.getTime() + 6 * 24 * 3600 * 1000));
      setActiveIOS(null);
      setRangeOpen(true);
      onChange("custom");
      return;
    }
    onChange(k);
  };

  const openAndroidPicker = (which: "start" | "end") => {
    const current = which === "start" ? start : end;
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      display: "calendar",
      minimumDate: new Date(today00.getFullYear() - 5, 0, 1),
      maximumDate: new Date(today00.getFullYear() + 2, 11, 31),
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        const picked = new Date(date);
        picked.setHours(0, 0, 0, 0);
        if (which === "start") {
          setStart(picked);
          if (picked.getTime() > end.getTime()) setEnd(new Date(picked));
        } else {
          setEnd(picked);
          if (picked.getTime() < start.getTime()) setStart(new Date(picked));
        }
      },
    });
  };

  const onPickIOS = (_: any, d?: Date) => {
    if (!d || !activeIOS) return;
    const picked = new Date(d);
    picked.setHours(0, 0, 0, 0);
    if (activeIOS === "start") {
      setStart(picked);
      if (picked.getTime() > end.getTime()) setEnd(new Date(picked));
    } else {
      setEnd(picked);
      if (picked.getTime() < start.getTime()) setStart(new Date(picked));
    }
  };

  const applyRange = () => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(23, 59, 59, 999);
    if (s.getTime() > e.getTime()) {
      const tmp = new Date(s);
      (s as any) = e;
      (e as any) = tmp;
    }
    onCustomChange?.(s.toISOString(), e.toISOString());
    setRangeOpen(false);
    setActiveIOS(null);
  };

  const clearToAll = () => {
    setRangeOpen(false);
    setActiveIOS(null);
    onChange("all");
  };

  const formatShort = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}.${d.getFullYear()}`;

  const TABS: Array<{ key: TimeKey; label: string; icon: string }> = [
    { key: "all", label: "Tümü", icon: "infinite-outline" },
    { key: "today", label: "Bugün", icon: "today-outline" },
    { key: "week", label: "Bu Hafta", icon: "calendar-outline" },
    { key: "custom", label: "Tarih Seç", icon: "calendar-sharp" },
  ];

  return (
    <View style={styles.container}>
      {/* Segmented tabs */}
      <View style={styles.segmentedControl}>
        {TABS.map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => handleTab(t.key as TimeKey)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Ionicons
                name={t.icon as any}
                size={16}
                color={active ? "#fff" : "#1A1A1A"}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Modal: tarih aralığı paneli */}
      <Modal
        visible={rangeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRangeOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRangeOpen(false)}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="calendar" size={22} color="#1A1A1A" />
                <Text style={styles.modalTitle}>Tarih Aralığı Seçin</Text>
              </View>
              <Pressable onPress={() => setRangeOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666666" />
              </Pressable>
            </View>

            {/* Tarih alanları */}
            <View style={styles.dateFieldsContainer}>
              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") openAndroidPicker("start");
                  else setActiveIOS("start");
                }}
                style={[
                  styles.dateField,
                  activeIOS === "start" && styles.dateFieldActive,
                ]}
              >
                <View style={styles.dateFieldHeader}>
                  <Ionicons name="arrow-forward-outline" size={16} color="#7B2C2C" />
                  <Text style={styles.dateFieldLabel}>Başlangıç</Text>
                </View>
                <Text style={styles.dateFieldValue}>{formatShort(start)}</Text>
              </Pressable>

              <View style={styles.dateFieldDivider}>
                <Ionicons name="arrow-forward" size={20} color="#666666" />
              </View>

              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") openAndroidPicker("end");
                  else setActiveIOS("end");
                }}
                style={[
                  styles.dateField,
                  activeIOS === "end" && styles.dateFieldActive,
                ]}
              >
                <View style={styles.dateFieldHeader}>
                  <Ionicons name="checkmark-outline" size={16} color="#7B2C2C" />
                  <Text style={styles.dateFieldLabel}>Bitiş</Text>
                </View>
                <Text style={styles.dateFieldValue}>{formatShort(end)}</Text>
              </Pressable>
            </View>

            {/* iOS inline picker */}
            {Platform.OS === "ios" && activeIOS && (
              <View style={styles.iosPickerContainer}>
                <DateTimePicker
                  value={activeIOS === "start" ? start : end}
                  mode="date"
                  display="inline"
                  minimumDate={new Date(today00.getFullYear() - 5, 0, 1)}
                  maximumDate={new Date(today00.getFullYear() + 2, 11, 31)}
                  onChange={onPickIOS}
                />
              </View>
            )}

            {/* Aksiyonlar */}
            <View style={styles.actionsContainer}>
              <Pressable onPress={clearToAll} style={styles.clearButton}>
                <Ionicons name="close-circle-outline" size={18} color="#666666" />
                <Text style={styles.clearButtonText}>Temizle</Text>
              </Pressable>
              <Pressable onPress={applyRange} style={styles.applyButton}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.applyButtonText}>Uygula</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E6E6E6",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: "#7B2C2C",
  },
  tabText: {
    color: "#1A1A1A",
    fontWeight: "700",
    fontSize: 13,
  },
  tabTextActive: {
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  closeButton: {
    padding: 4,
  },
  dateFieldsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  dateField: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E6E6E6",
    backgroundColor: "#FAFAFA",
  },
  dateFieldActive: {
    borderColor: "#7B2C2C",
    backgroundColor: "#FFF5F5",
  },
  dateFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  dateFieldLabel: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },
  dateFieldValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  dateFieldDivider: {
    alignItems: "center",
    justifyContent: "center",
  },
  iosPickerContainer: {
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#FAFAFA",
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  clearButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    gap: 6,
  },
  clearButtonText: {
    fontWeight: "700",
    color: "#666666",
    fontSize: 15,
  },
  applyButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#7B2C2C",
    gap: 6,
  },
  applyButtonText: {
    fontWeight: "700",
    color: "#fff",
    fontSize: 15,
  },
});
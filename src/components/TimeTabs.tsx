// components/TimeTabs.tsx
import React from "react";
import { View, Pressable, Text, Modal, Platform } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

export type TimeKey = "all" | "today" | "week" | "custom";

export default function TimeTabs({
  value,
  onChange,
  onCustomChange, // (startISO, endISO)
}: {
  value: TimeKey;
  onChange: (v: TimeKey) => void;
  onCustomChange?: (startISO: string, endISO: string) => void;
}) {
  // --- state ---
  const [rangeOpen, setRangeOpen] = React.useState(false); // ANA MODAL (tarih aralığı paneli)
  const [activeIOS, setActiveIOS] = React.useState<null | "start" | "end">(null); // iOS için inline picker

  const today00 = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [start, setStart] = React.useState<Date>(today00);
  const [end, setEnd] = React.useState<Date>(new Date(today00.getTime() + 6 * 24 * 3600 * 1000));

  // “Tarih…” sekmesine basılınca ANA MODAL açılır (takvim hemen açılmaz)
  const handleTab = (k: TimeKey) => {
    if (k === "custom") {
      // varsayılan değerleri tazele
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

  // Android: tek adım—native dialog aç
  const openAndroidPicker = (which: "start" | "end") => {
    const current = which === "start" ? start : end;
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      display: "calendar",
      minimumDate: new Date(today00.getFullYear() - 5, 0, 1),
      maximumDate: new Date(today00.getFullYear() + 2, 11, 31),
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return; // kullanıcı iptal etti
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

  // iOS: inline picker aynı modal içinde gösterilir
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

  // “Uygula” → aralığı geri bildir ve ANA MODAL’ı kapat
  const applyRange = () => {
    const s = new Date(start); s.setHours(0, 0, 0, 0);
    const e = new Date(end);   e.setHours(23, 59, 59, 999);
    if (s.getTime() > e.getTime()) {
      const tmp = new Date(s); (s as any) = e; (e as any) = tmp;
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
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  return (
    <View style={{ gap: 10 }}>
      {/* Segmented tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 4 }}>
        {[
          { key: "all", label: "Tümü" },
          { key: "today", label: "Bugün" },
          { key: "week", label: "Bu Hafta" },
          { key: "custom", label: "Tarih…" },
        ].map((t) => {
          const active = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => handleTab(t.key as TimeKey)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active ? "#111827" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: active ? "#fff" : "#111827", fontWeight: "700" }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* --- ANA MODAL: tarih aralığı paneli (tek modal!) --- */}
      <Modal visible={rangeOpen} transparent animationType="fade" onRequestClose={() => setRangeOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }} onPress={() => setRangeOpen(false)}>
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 24,
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 4,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Tarih aralığı</Text>

            {/* Alanlar */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") openAndroidPicker("start");
                  else setActiveIOS("start");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#0F172A",
                  backgroundColor: "#F8FAFC",
                }}
              >
                <Text style={{ color: "#6B7280", marginBottom: 4, fontWeight: "600" }}>Başlangıç</Text>
                <Text style={{ fontWeight: "700" }}>{formatShort(start)}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") openAndroidPicker("end");
                  else setActiveIOS("end");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#0F172A",
                  backgroundColor: "#F8FAFC",
                }}
              >
                <Text style={{ color: "#6B7280", marginBottom: 4, fontWeight: "600" }}>Bitiş</Text>
                <Text style={{ fontWeight: "700" }}>{formatShort(end)}</Text>
              </Pressable>
            </View>

            {/* iOS inline picker (Android’de hiç render edilmez) */}
            {Platform.OS === "ios" && activeIOS && (
              <View style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, overflow: "hidden" }}>
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={clearToAll}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: "#111827" }}>Temizle</Text>
              </Pressable>
              <Pressable
                onPress={applyRange}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: "#0F172A",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>Uygula</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

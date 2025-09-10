// src/screens/ReservationStep1Screen.tsx
import React from "react";
import { View, Pressable, Text as RNText, Modal, Platform, FlatList } from "react-native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import Input from "../components/Input";
import { useReservation } from "../store/useReservation";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

// 30 dakikalık slot üretici (örnek: 10:00 - 23:30 arası)
function buildSlots(startH = 10, endH = 23) {
  const out: string[] = [];
  for (let h = startH; h <= endH; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
}
const TIME_SLOTS = buildSlots(10, 23); // gerekirse aralığı özelleştir

export default function ReservationStep1Screen() {
  const nav = useNavigation<any>();
  const setDateTime = useReservation((s) => s.setDateTime);
  const setParty = useReservation((s) => s.setParty);

  // — State —
  const todayLocal = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [date, setDate] = React.useState<Date>(todayLocal);
  const [time, setTime] = React.useState<string>("19:00");
  const [party, setPartyLocal] = React.useState<string>("2");
  const [err, setErr] = React.useState<string | null>(null);

  // Modallar
  const [dateModalOpen, setDateModalOpen] = React.useState(false); // iOS’ta inline picker için
  const [timeModalOpen, setTimeModalOpen] = React.useState(false);

  // — Utils —
  const fmtDateTR = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  const openDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: date,
        mode: "date",
        display: "calendar",
        onChange: (event, selected) => {
          if (event.type !== "set" || !selected) return;
          const picked = new Date(selected);
          picked.setHours(0, 0, 0, 0);
          setDate(picked);
        },
      });
    } else {
      // iOS: inline takvim modal içinde
      setDateModalOpen(true);
    }
  };

  const onContinue = () => {
    setErr(null);
    const p = Number.parseInt(party || "0", 10);
    if (!Number.isFinite(p) || p < 1) {
      setErr("Kişi sayısı en az 1 olmalı.");
      return;
    }

    // Seçilen yerel tarih + saatten ISO (UTC) oluştur
    // time: "HH:mm"
    const [hh, mm] = time.split(":").map((x) => parseInt(x, 10));
    const composed = new Date(date); // local midnight
    composed.setHours(hh || 0, mm || 0, 0, 0);

    const isoUTC = composed.toISOString(); // backend UTC bekliyor

    setDateTime(isoUTC);
    setParty(p);
    nav.navigate("Rezervasyon - Menü");
  };

  return (
    <Screen>
      <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 12 }}>Tarih & Saat</Text>

      {/* Tarih alanı */}
      <Pressable
        onPress={openDatePicker}
        style={{
          borderWidth: 1,
          borderColor: "#E5E7EB",
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 12,
          marginBottom: 10,
          backgroundColor: "#fff",
        }}
      >
        <RNText style={{ color: "#6B7280", marginBottom: 4, fontWeight: "600" }}>Tarih</RNText>
        <RNText style={{ fontWeight: "700" }}>{fmtDateTR(date)}</RNText>
      </Pressable>

      {/* Saat alanı */}
      <Pressable
        onPress={() => setTimeModalOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: "#E5E7EB",
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 12,
          marginBottom: 10,
          backgroundColor: "#fff",
        }}
      >
        <RNText style={{ color: "#6B7280", marginBottom: 4, fontWeight: "600" }}>Saat</RNText>
        <RNText style={{ fontWeight: "700" }}>{time}</RNText>
      </Pressable>

      {/* Kişi sayısı */}
      <Input
        label="Kişi Sayısı"
        value={party}
        onChangeText={setPartyLocal}
        keyboardType="number-pad"
      />

      {err ? <Text style={{ color: "red", marginTop: 6 }}>{err}</Text> : null}

      <View style={{ height: 12 }} />
      <Button title="Devam" onPress={onContinue} />

      {/* iOS tarih modalı (inline picker) */}
      <Modal
        visible={dateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
          onPress={() => setDateModalOpen(false)}
        >
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
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Tarih seç</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                onChange={(_, d) => {
                  if (!d) return;
                  const picked = new Date(d);
                  picked.setHours(0, 0, 0, 0);
                  setDate(picked);
                }}
              />
            </View>
            <Pressable
              onPress={() => setDateModalOpen(false)}
              style={{ paddingVertical: 10, borderRadius: 10, backgroundColor: "#0F172A", alignItems: "center" }}
            >
              <RNText style={{ color: "#fff", fontWeight: "700" }}>Tamam</RNText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Saat seçimi modalı */}
      <Modal
        visible={timeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModalOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
          onPress={() => setTimeModalOpen(false)}
        >
          <View
            style={{
              position: "absolute",
              left: 16,
              right: 16,
              bottom: 24,
              maxHeight: 420,
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 4,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Saat seç</Text>
            <FlatList
              data={TIME_SLOTS}
              keyExtractor={(t) => t}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setTime(item);
                    setTimeModalOpen(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: item === time ? "#0F172A" : "#E5E7EB",
                    backgroundColor: item === time ? "#F8FAFC" : "#FFFFFF",
                  }}
                >
                  <RNText style={{ fontWeight: "700" }}>{item}</RNText>
                </Pressable>
              )}
            />

            <Pressable
              onPress={() => setTimeModalOpen(false)}
              style={{ paddingVertical: 10, borderRadius: 10, backgroundColor: "#0F172A", alignItems: "center" }}
            >
              <RNText style={{ color: "#fff", fontWeight: "700" }}>Tamam</RNText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

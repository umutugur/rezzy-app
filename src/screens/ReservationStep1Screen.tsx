import React from "react";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import Input from "../components/Input";
import { useReservation } from "../store/useReservation";
import { useNavigation } from "@react-navigation/native";

export default function ReservationStep1Screen(){
  const nav = useNavigation<any>();
  const setDateTime = useReservation(s=>s.setDateTime);
  const setParty = useReservation(s=>s.setParty);

  const [date, setDate] = React.useState("2025-09-01");
  const [time, setTime] = React.useState("19:00");
  const [party, setPartyLocal] = React.useState("2");
  const [err, setErr] = React.useState<string | null>(null);

  const onContinue = () => {
    setErr(null);
    const p = Number.parseInt(party || "0", 10);
    if (!Number.isFinite(p) || p < 1) {
      setErr("Kişi sayısı en az 1 olmalı.");
      return;
    }
    // ISO: kullanıcının seçtiği tarih-saat UTC'ye göre (örnek)
    const iso = new Date(`${date}T${time}:00Z`).toISOString();

    setDateTime(iso);
    setParty(p);
    nav.navigate("Rezervasyon - Menü");
  };

  return (
    <Screen>
      <Text style={{ fontWeight:"700", marginBottom: 8 }}>Tarih & Saat</Text>
      <Input label="Tarih (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Input label="Saat (HH:mm)" value={time} onChangeText={setTime} />
      <Input
        label="Kişi Sayısı"
        value={party}
        onChangeText={setPartyLocal}
        keyboardType="number-pad"
      />
      {err ? <Text style={{ color: "red", marginTop: 6 }}>{err}</Text> : null}
      <Button title="Devam" onPress={onContinue} />
    </Screen>
  );
}

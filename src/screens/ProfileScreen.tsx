import React from "react";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import { useAuth } from "../store/useAuth";

export default function ProfileScreen(){
  const clear = useAuth(s=>s.clear);
  return (
    <Screen>
      <Text style={{ fontWeight:"700", marginBottom: 8 }}>Profil</Text>
      <Button title="Çıkış" variant="outline" onPress={clear} />
    </Screen>
  );
}

import React from "react";
import { View } from "react-native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import Button from "../components/Button";
import { login } from "../api/auth";
import { useAuth } from "../store/useAuth";

export default function LoginScreen() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = React.useState("new-owner@rezzy.app"); // istersen demo@rezzy.app
  const [password, setPassword] = React.useState("123456");
  const [loading, setLoading] = React.useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const { token, user } = await login(email, password);
      // 👇 Artık backend’ten gelen gerçek user'ı yazıyoruz
      setAuth(token, user);
      console.log("LOGIN OK ->", user); // { role:'restaurant', restaurantId:'...' }
    } catch (e: any) {
      console.log("LOGIN FAIL", e?.response?.data || e?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 16 }}>Rezzy</Text>

      <Input label="E-posta" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Input label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="******" />

      <Button title="Giriş Yap" onPress={onLogin} loading={loading} />

      <View style={{ height: 12 }} />
      <Text secondary>Demo giriş: new-owner@rezzy.app / 123456</Text>
    </Screen>
  );
}

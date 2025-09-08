import React from "react";
import { View } from "react-native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import Button from "../components/Button";
// Google/Apple importlarını geçici kaldırabilir ya da bırakabilirsiniz
// import * as WebBrowser from "expo-web-browser";
// import * as Google from "expo-auth-session/providers/google";
// import * as AppleAuth from "expo-apple-authentication";
import { login /*, googleSignIn, appleSignIn*/ } from "../api/auth";
import { useAuth } from "../store/useAuth";

// WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = React.useState("demo@rezzy.app");
  const [password, setPassword] = React.useState("123456");
  const [loading, setLoading] = React.useState(false);

  // DEMO bayrağı (istersen ortam değişkeni ya da sabit)
 // const DEMO = true;

  const onLogin = async () => {
    try {
      setLoading(true);
      // Normal backend login (hazırsa)
      const { token } = await login(email, password);
      setAuth(token, { id: "-", name: "Rezzy Kullanıcı", role: "customer" } as any);
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

      {/* Google/Apple butonlarını şimdilik gizliyoruz */}
      {/* <View style={{ height: 20 }} />
      <Button title="Google ile devam et" variant="outline" onPress={() => promptAsync()} disabled={!request || loading} />
      <View style={{ height: 12 }} />
      {appleAvailable ? <AppleAuth.AppleAuthenticationButton ... /> : null} */}
      
      <View style={{ height: 12 }} />
      <Text secondary>Demo giriş: demo@rezzy.app / 123456</Text>
    </Screen>
  );
}

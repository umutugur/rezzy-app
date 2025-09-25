import React from "react";
import { View, Alert, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import Button from "../components/Button";
import { login, googleSignIn, appleSignIn } from "../api/auth";
import { useAuth } from "../store/useAuth";

import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { registerPushToken } from "../hooks/usePushToken";
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "../config/keys";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const setAuth = useAuth((s) => s.setAuth);

  const [email, setEmail] = React.useState("new-owner@rezzy.app");
  const [password, setPassword] = React.useState("123456");
  const [loading, setLoading] = React.useState(false);
  const [gLoading, setGLoading] = React.useState(false);
  const [aLoading, setALoading] = React.useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const { token, user } = await login(email, password);
      setAuth(token, user);
      try { await registerPushToken(); } catch {}
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (e: any) {
      Alert.alert("Giriş Hatası", e?.response?.data?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE (ID Token flow, web fallback güvenceye alındı)
  const redirectUri = makeRedirectUri({
    native: "com.rezzy.app:/oauthredirect",
    // web fallback'te Expo proxy kullan: GCP'de redirect olarak zaten ekledin
    // useProxy: true,
  });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
  androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  clientId: GOOGLE_WEB_CLIENT_ID || undefined,
  redirectUri,
  scopes: ["openid", "profile", "email"],
});

  React.useEffect(() => {
    if (!response) return;

    // DEBUG: Gerekirse aç
    // console.log("Google response:", JSON.stringify(response, null, 2));

    if (response.type === "success") {
      const anyResp = response as any;
      const idToken: string | undefined =
        anyResp?.params?.id_token ||
        anyResp?.authentication?.idToken ||
        anyResp?.authentication?.params?.id_token;

      (async () => {
        try {
          if (!idToken) throw new Error("Google id_token alınamadı.");
          const { token, user } = await googleSignIn(idToken);
          setAuth(token, user);
          try { await registerPushToken(); } catch {}
          navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
        } catch (err: any) {
          Alert.alert("Google Girişi Hatası", err?.response?.data?.message || err?.message);
        } finally {
          setGLoading(false);
        }
      })();
    } else if (response.type === "error") {
      setGLoading(false);
      Alert.alert("Google Hatası", "Google ile giriş başarısız.");
    } else if (response.type === "dismiss") {
      setGLoading(false);
    }
  }, [response]);

  const onGoogle = async () => {
    try {
      setGLoading(true);
      // web fallback'te proxy kullanılacak, native'de normal akış
      await promptAsync();
    } catch (e: any) {
      setGLoading(false);
      Alert.alert("Google Girişi Hatası", e?.message || "Bilinmeyen hata");
    }
  };

  const onApple = async () => {
    try {
      if (Platform.OS !== "ios") return;
      setALoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const identityToken = credential.identityToken;
      if (!identityToken) throw new Error("Apple identityToken alınamadı.");
      const { token, user } = await appleSignIn(identityToken);
      setAuth(token, user);
      try { await registerPushToken(); } catch {}
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (e: any) {
      if (e?.code !== "ERR_CANCELED") {
        Alert.alert("Apple Girişi", e?.message || "Giriş başarısız.");
      }
    } finally {
      setALoading(false);
    }
  };

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 16 }}>Rezzy</Text>

      <Input label="E-posta" value={email} onChangeText={setEmail} placeholder="you@example.com" />
      <Input label="Şifre" value={password} onChangeText={setPassword} secureTextEntry placeholder="******" />

      <Button title="Giriş Yap" onPress={onLogin} loading={loading} />

      <View style={{ height: 24 }} />

      <Button
        title="Google ile devam et"
        onPress={onGoogle}
        loading={gLoading}
        variant="outline"
        disabled={!request}
      />

      {Platform.OS === "ios" ? (
        <>
          <View style={{ height: 12 }} />
          <Button title="Apple ile devam et" onPress={onApple} loading={aLoading} variant="outline" />
        </>
      ) : null}

      <View style={{ height: 12 }} />
      <Text secondary>Demo giriş: new-owner@rezzy.app / 123456</Text>
    </Screen>
  );
}

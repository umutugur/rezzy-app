// src/screens/LoginScreen.tsx
import React from "react";
import { View, Alert, Platform } from "react-native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import Button from "../components/Button";
import { login, googleSignIn, appleSignIn } from "../api/auth";
import { useAuth } from "../store/useAuth";

import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as AuthSession from "expo-auth-session";
import { useAuthRequest, makeRedirectUri, ResponseType } from "expo-auth-session";
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "../config/keys";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = React.useState("new-owner@rezzy.app");
  const [password, setPassword] = React.useState("123456");
  const [loading, setLoading] = React.useState(false);
  const [gLoading, setGLoading] = React.useState(false);
  const [aLoading, setALoading] = React.useState(false);

  // ---- Normal login
  const onLogin = async () => {
    try {
      setLoading(true);
      const { token, user } = await login(email, password);
      setAuth(token, user);
      console.log("LOGIN OK ->", user);
    } catch (e: any) {
      console.log("LOGIN FAIL", e?.response?.data || e?.message);
      Alert.alert("Giriş Hatası", e?.response?.data?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  // ---- Google (expo-auth-session) — id_token alacağız
  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
  };

  const redirectUri = makeRedirectUri({ scheme: "rezzy" }); // app.json -> scheme
  const [request, response, promptAsync] = useAuthRequest(
    {
       clientId:
        Platform.OS === "android"
          ? GOOGLE_ANDROID_CLIENT_ID
          : Platform.OS === "ios"
          ? GOOGLE_IOS_CLIENT_ID
          : GOOGLE_WEB_CLIENT_ID,
      responseType: ResponseType.IdToken, // id_token lazım
      redirectUri,
      scopes: ["openid", "email", "profile"],
      extraParams: {
        // Hesap seçimi pop-up
        prompt: "select_account",
      },
    },
    discovery
  );

  React.useEffect(() => {
    const run = async () => {
      if (response?.type === "success") {
        try {
          setGLoading(true);
          const idToken = (response.params as any)?.id_token;
          if (!idToken) throw new Error("Google id_token alınamadı.");

          const { token, user } = await googleSignIn(idToken);
          setAuth(token, user);
        } catch (err: any) {
          console.log("GOOGLE SIGNIN FAIL", err?.response?.data || err?.message);
          Alert.alert(
            "Google Girişi Hatası",
            err?.response?.data?.message || "Google girişi başarısız."
          );
        } finally {
          setGLoading(false);
        }
      }
    };
    run();
  }, [response]);

  const onGoogle = async () => {
    if (!GOOGLE_ANDROID_CLIENT_ID && !GOOGLE_IOS_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID) {
      Alert.alert("Kurulum Eksik", "Google client ID'leri app.json -> extra içine eklenmeli.");
      return;
    }
    await promptAsync();
  };

  // ---- Apple (iskelet) — iOS dışı platformda gizleyebiliriz
  const onApple = async () => {
    try {
      if (Platform.OS !== "ios") {
        Alert.alert("Apple Girişi", "Apple ile giriş sadece iOS'ta kullanılabilir.");
        return;
      }
      setALoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const identityToken = credential.identityToken;
      if (!identityToken) {
        Alert.alert("Apple", "identityToken alınamadı.");
        return;
      }

      // Not: Şu an çalışmayabilir, ama backend endpoint hazır.
      // İleride Apple portal ayarları tamamlanınca bu çağrı direkt çalışacak.
      const { token, user } = await appleSignIn(identityToken);
      setAuth(token, user);
    } catch (e: any) {
      // Kullanıcı iptal ettiyse:
      if (e?.code === "ERR_CANCELED") return;
      console.log("APPLE SIGNIN FAIL", e?.response?.data || e?.message);
      Alert.alert("Apple Girişi", "Şu an aktif değil. Apple ayarları tamamlanınca çalışacak.");
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
          <Button
            title="Apple ile devam et"
            onPress={onApple}
            loading={aLoading}
            variant="outline"
          />
        </>
      ) : null}

      <View style={{ height: 12 }} />
      <Text secondary>Demo giriş: new-owner@rezzy.app / 123456</Text>
    </Screen>
  );
}

import React from "react";
import {
  View,
  Alert,
  Platform,
  Pressable,
  ActivityIndicator,
  Text as RNText,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import { login, googleSignIn, appleSignIn } from "../api/auth";
import { useAuth } from "../store/useAuth";

import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { registerPushToken } from "../hooks/usePushToken";
import { AntDesign, Ionicons } from "@expo/vector-icons";
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
      try {
        await registerPushToken();
      } catch {}
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    } catch (e: any) {
      Alert.alert("Giriş Hatası", e?.response?.data?.message || "Giriş başarısız");
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE ID Token flow ---
  const redirectUri = makeRedirectUri({
    native: "com.rezzy.app:/oauthredirect",
    // useProxy: true, // gerekirse açarsın
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
          try {
            await registerPushToken();
          } catch {}
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
      await promptAsync();
    } catch (e: any) {
      setGLoading(false);
      Alert.alert("Google Girişi Hatası", e?.message || "Bilinmeyen hata");
    }
  };

  const onApple = async () => {
    try {
      if (Platform.OS !== "ios" || aLoading) return;
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
      try {
        await registerPushToken();
      } catch {}
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

      {/* Normal giriş */}
      <BrandButton
        title="Giriş Yap"
        onPress={onLogin}
        loading={loading}
        variant="primary"
        iconLeft={<Ionicons name="log-in-outline" size={18} color="#fff" />}
      />

      <View style={{ height: 20 }} />

      {/* Google ile devam et (brand guideline: beyaz buton, logo solda) */}
      <GoogleBrandButton title="Google ile devam et" onPress={onGoogle} loading={gLoading} disabled={!request} />

      {/* Apple ile devam et — Apple’ın native butonu */}
      {Platform.OS === "ios" ? (
        <>
          <View style={{ height: 12 }} />
          <View
            style={{
              width: "100%",
              opacity: aLoading ? 0.7 : 1,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={{ width: "100%", height: 50, borderRadius: 10 }}
              onPress={() => {
                if (!aLoading) onApple();
              }}
            />
          </View>
          {aLoading ? (
            <View style={{ marginTop: 10, alignSelf: "center" }}>
              <ActivityIndicator color="#000" />
            </View>
          ) : null}
        </>
      ) : null}

      <View style={{ height: 14 }} />
      <Text secondary>Demo giriş: new-owner@rezzy.app / 123456</Text>
    </Screen>
  );
}

/* -------------------- Özel Butonlar -------------------- */

type BrandButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
  iconLeft?: React.ReactNode;
};

function BrandButton({ title, onPress, loading, disabled, variant = "primary", iconLeft }: BrandButtonProps) {
  const isPrimary = variant === "primary";
  const bg = isPrimary ? "#7B2C2C" : "#FFFFFF";
  const fg = isPrimary ? "#FFFFFF" : "#111827";
  const borderColor = isPrimary ? "transparent" : "#E5E7EB";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        opacity: disabled || loading ? 0.6 : pressed ? 0.95 : 1,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        height: 50,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        width: "100%",
        shadowColor: isPrimary ? "#7B2C2C" : "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {iconLeft}
          <RNText style={{ color: fg, fontWeight: "700", fontSize: 16 }}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

type GoogleButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

function GoogleBrandButton({ title, onPress, loading, disabled }: GoogleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        opacity: disabled || loading ? 0.6 : pressed ? 0.97 : 1,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        height: 50,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        width: "100%",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      })}
    >
      {loading ? (
        <ActivityIndicator color="#111827" />
      ) : (
        <>
          <AntDesign name="google" size={18} color="#1F1F1F" />
          <RNText style={{ color: "#1F1F1F", fontWeight: "700", fontSize: 16 }}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}
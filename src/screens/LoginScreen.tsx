import React from "react";
import {
  View,
  Platform,
  Pressable,
  ActivityIndicator,
  Text as RNText,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen, Text } from "../components/Themed";
import Input from "../components/Input";
import { login, googleSignIn, appleSignIn } from "../api/auth";
import { useAuth } from "../store/useAuth";
import { friendlyAuthError } from "../utils/errorText";
import { useI18n } from "../i18n";

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
  const consumeIntended = useAuth((s) => s.consumeIntended);
  const clearAuth = useAuth((s) => s.clear);
  const { t } = useI18n();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [gLoading, setGLoading] = React.useState(false);
  const [aLoading, setALoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  // ------- Modal (Alert yerine) -------
  const [modalVisible, setModalVisible] = React.useState(false);
  const [modalMessage, setModalMessage] = React.useState<string>("");

  const showModal = (msg: string) => {
    setModalMessage(msg);
    setModalVisible(true);
  };

  // ------- Shake animation (login hatasında) -------
  const shakeAnim = React.useRef(new Animated.Value(0)).current;
  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  };

  const afterAuthNavigate = async () => {
    try {
      await registerPushToken();
    } catch {}
    const intended = await consumeIntended();

    const TAB_SCREENS = new Set(["Keşfet", "Rezervasyonlar", "Profil"]);
    if (intended?.name) {
      if (TAB_SCREENS.has(intended.name)) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Tabs", params: { screen: intended.name, params: intended.params } }],
        });
      } else {
        navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
        navigation.navigate(intended.name as never, intended.params as never);
      }
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  const onLogin = async () => {
    try {
      setLoading(true);
      const { token, refreshToken, user } = await login(email, password);
      await setAuth(token, user, refreshToken);
      await afterAuthNavigate();
    } catch (e: any) {
      const raw = e?.response?.data?.message ?? e?.message;
      const { title, message } = friendlyAuthError(raw);
      showModal(`${title}\n\n${message}`);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // --- Google ID token flow ---
  const redirectUri = makeRedirectUri({ native: "com.rezzy.app:/oauthredirect" });
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
          const { token, refreshToken, user } = await googleSignIn(idToken);
          await setAuth(token, user, refreshToken);
          await afterAuthNavigate();
        } catch (err: any) {
          const raw = err?.response?.data?.message ?? err?.message;
          const { title, message } = friendlyAuthError(raw);
          showModal(`${title}\n\n${message}`);
        } finally {
          setGLoading(false);
        }
      })();
    } else if (response.type === "error") {
      setGLoading(false);
      const { title, message } = friendlyAuthError("Google sign-in error");
      showModal(`${title}\n\n${message}`);
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
      const { title, message } = friendlyAuthError(e?.message || "Unknown error");
      showModal(`${title}\n\n${message}`);
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

      const { token, refreshToken, user } = await appleSignIn(identityToken);
      await setAuth(token, user, refreshToken);
      await afterAuthNavigate();
    } catch (e: any) {
      if (e?.code !== "ERR_CANCELED") {
        const raw = e?.response?.data?.message ?? e?.message;
        const { title, message } = friendlyAuthError(raw);
        showModal(`${title}\n\n${message}`);
      }
    } finally {
      setALoading(false);
    }
  };

  /** Misafir devam — sadece TabsGuest’e döner + Tüm auth state’i temizler */
  const onGuest = async () => {
    try {
      await clearAuth();
    } catch {}
    navigation.reset({ index: 0, routes: [{ name: "TabsGuest" }] });
  };

  return (
    <Screen style={{ flex: 1 }}>
      <View style={{ paddingBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 16 }}>Rezvix</Text>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <Input
            label={t("auth.emailLabel")}
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
          />

          <View style={{ position: "relative" }}>
            <Input
              label={t("auth.passwordLabel")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder={t("auth.passwordPlaceholder")}
              style={{ paddingRight: 48 }} // ikon için sağ boşluk
            />

            <Pressable
              android_ripple={{ color: "rgba(123,44,44,0.15)" }}
              onPress={() => setShowPassword((p) => !p)}
              style={{
                position: "absolute",
                right: 16,
                top: "50%",
                transform: [{ translateY: -12 }],
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#7B2C2C"
              />
            </Pressable>
          </View>
        </Animated.View>

        <BrandButton
          title={t("auth.loginButton")}
          onPress={onLogin}
          loading={loading}
          variant="primary"
          iconLeft={<Ionicons name="log-in-outline" size={18} color="#fff" />}
        />

        <View style={{ height: 20 }} />

        <GoogleBrandButton
          title={t("auth.continueWithGoogle")}
          onPress={onGoogle}
          loading={gLoading}
          disabled={!request}
        />

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
      </View>

      {/* --- En alt: Üye olmadan devam et --- */}
      <View style={{ marginTop: "auto" }}>
        <View style={{ height: 12 }} />
        <OutlineButton title={t("auth.continueAsGuest")} onPress={onGuest} />
      </View>

      {/* -------- Modal (Alert yerine) -------- */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#fff",
              borderRadius: 14,
              padding: 18,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <RNText style={{ fontSize: 16, color: "#111827" }}>{modalMessage}</RNText>

            <Pressable
              onPress={() => setModalVisible(false)}
              style={({ pressed }) => ({
                marginTop: 14,
                alignSelf: "flex-end",
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: pressed ? "#6D2626" : "#7B2C2C",
                borderRadius: 10,
              })}
            >
              <RNText style={{ color: "#fff", fontWeight: "700" }}>{t("common.ok")}</RNText>
            </Pressable>
          </View>
        </View>
      </Modal>
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

function OutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.95 : 1,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        height: 48,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      })}
    >
      <RNText style={{ color: "#111827", fontWeight: "800", fontSize: 15 }}>{title}</RNText>
    </Pressable>
  );
}
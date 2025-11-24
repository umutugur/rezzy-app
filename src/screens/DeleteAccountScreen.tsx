import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Button from "../components/Button";
import { useAuth } from "../store/useAuth";
import { deleteAccount } from "../api/user";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

// Tip: info modal state tipi
type InfoModalState =
  | null
  | {
      visible: boolean;
      type: "success" | "error";
      title?: string;
      message?: string;
    };

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { clear } = useAuth();
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalState>(null);

  // Animasyon değerleri (info modal)
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (infoModal?.visible) {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0.9,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [infoModal, modalOpacity, modalScale]);

  const onDelete = async () => {
    try {
      setLoading(true);
      await deleteAccount();
      await clear();
      setInfoModal({
        visible: true,
        type: "success",
        title: t("deleteAccount.successTitle"),
        message: t("deleteAccount.successMessage"),
      });
    } catch (e: any) {
      const fallback = t("deleteAccount.errorGeneric");
      setInfoModal({
        visible: true,
        type: "error",
        title: t("common.error"),
        message: e?.response?.data?.message || fallback,
      });
    } finally {
      setLoading(false);
    }
  };

  const closeInfoModal = () => {
    setInfoModal((prev) => (prev ? { ...prev, visible: false } : null));
    // animasyon bitince tamamen null'a çekmeye gerek yok, state hafif kalsın sorun olmaz
  };

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
        backgroundColor: T.colors.background,
      }}
    >
      {/* Başlık alanı */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: T.colors.text,
            marginBottom: 4,
          }}
        >
          {t("deleteAccount.title")}
        </Text>
        <Text style={{ color: T.colors.textSecondary }}>
          {t("deleteAccount.subtitle")}
        </Text>
      </View>

      {/* Kart */}
      <View
        style={{
          backgroundColor: T.colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: 18,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        {/* İkon rozet */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: "#FEE2E2",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Ionicons name="trash-bin" size={26} color="#B91C1C" />
        </View>

        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            marginBottom: 8,
            color: T.colors.text,
          }}
        >
          {t("deleteAccount.sectionTitle")}
        </Text>

        <Text
          style={{
            color: T.colors.textSecondary,
            marginBottom: 10,
            lineHeight: 20,
          }}
        >
          {t("deleteAccount.descriptionMain")}
        </Text>

        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              color: T.colors.text,
              fontWeight: "600",
              marginBottom: 4,
            }}
          >
            {t("deleteAccount.dataTitle")}
          </Text>
          <View style={{ paddingLeft: 6 }}>
            <Text
              style={{
                color: T.colors.textSecondary,
                marginBottom: 2,
              }}
            >
              • {t("deleteAccount.dataItemReservations")}
            </Text>
            <Text
              style={{
                color: T.colors.textSecondary,
                marginBottom: 2,
              }}
            >
              • {t("deleteAccount.dataItemProfile")}
            </Text>
            <Text style={{ color: T.colors.textSecondary }}>
              • {t("deleteAccount.dataItemAnalytics")}
            </Text>
          </View>
        </View>

        <View
          style={{
            padding: 10,
            borderRadius: 12,
            backgroundColor: "#FEF2F2",
            borderWidth: 1,
            borderColor: "#FECACA",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#B91C1C",
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            {t("deleteAccount.warningTitle")}
          </Text>
          <Text style={{ color: "#7F1D1D", lineHeight: 19 }}>
            {t("deleteAccount.warningText")}
          </Text>
        </View>

        <Button
          title={
            loading
              ? t("deleteAccount.buttonLoading")
              : t("deleteAccount.buttonLabel")
          }
          onPress={onDelete}
          variant="danger"
        />
      </View>

      {/* Bilgi / Hata modalı */}
      <Modal
        visible={!!infoModal?.visible}
        transparent
        animationType="fade"
        onRequestClose={closeInfoModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
          onPress={closeInfoModal}
        >
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor:
                infoModal?.type === "success" ? "#BBF7D0" : "#FCA5A5",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
            }}
          >
            <View
              style={{
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                  backgroundColor:
                    infoModal?.type === "success" ? "#22C55E" : "#EF4444",
                }}
              >
                <Ionicons
                  name={
                    infoModal?.type === "success"
                      ? "checkmark-circle"
                      : "alert-circle"
                  }
                  size={40}
                  color="#fff"
                />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color:
                    infoModal?.type === "success" ? "#166534" : "#991B1B",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                {infoModal?.title ||
                  (infoModal?.type === "success"
                    ? t("common.info")
                    : t("common.error"))}
              </Text>
            </View>

            {!!infoModal?.message && (
              <Text
                style={{
                  color: T.colors.textSecondary,
                  textAlign: "center",
                  marginBottom: 14,
                }}
              >
                {infoModal.message}
              </Text>
            )}

            <Button
              title={t("common.ok")}
              onPress={closeInfoModal}
            />
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}
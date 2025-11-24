// src/components/UploadButton.tsx
import React from "react";
import { View, Image, Modal, Pressable, Animated, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Button from "./Button";
import { Text } from "./Themed";
import { useI18n } from "../i18n";
import { Ionicons } from "@expo/vector-icons";

type PickedFile = { uri: string; name: string; type: string };

export default function UploadButton({
  onPicked,
}: {
  onPicked: (file: PickedFile) => void;
}) {
  const [preview, setPreview] = React.useState<string | undefined>();
  const { t } = useI18n();

  type InfoModalState = {
    type: "error" | "info" | "success";
    title?: string;
    message?: string;
  };

  const [infoModal, setInfoModal] = React.useState<InfoModalState | null>(null);
  const modalScale = React.useRef(new Animated.Value(0.9)).current;
  const modalOpacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (infoModal) {
      modalScale.setValue(0.9);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [infoModal, modalScale, modalOpacity]);

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setInfoModal({
          type: "error",
          title: t("upload.receipt.permissionTitle"),
          message: t("upload.receipt.permissionMessage"),
        });
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ sadece görseller
        quality: 0.9,
        selectionLimit: 1,
      });

      if (res.canceled || !res.assets?.[0]) return;

      const a = res.assets[0];
      const rawName = a.fileName || a.uri.split("/").pop() || "receipt.jpg";
      const ext = (rawName.split(".").pop() || "jpg").toLowerCase();

      // mimeType eksikse fallback yap
      const type =
        a.mimeType ||
        (ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : "image/jpeg");

      const name = /\./.test(rawName) ? rawName : `receipt.${ext}`;

      setPreview(a.uri);

      onPicked({ uri: a.uri, name, type });
    } catch (e: any) {
      console.log("ImagePicker error:", e?.message || e);
      setInfoModal({
        type: "error",
        title: t("upload.receipt.errorTitle"),
        message: t("upload.receipt.errorMessage"),
      });
    }
  };

  return (
    <>
      <View style={{ gap: 8 }}>
        <Button
          title={t("upload.receipt.button")}
          variant="outline"
          onPress={pick}
        />
        {preview ? (
          <Image
            source={{ uri: preview }}
            style={{ width: "100%", height: 140, borderRadius: 12 }}
            resizeMode="cover"
          />
        ) : (
          <Text secondary>{t("upload.receipt.acceptedTypes")}</Text>
        )}
      </View>

      <Modal
        visible={!!infoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setInfoModal(null)}
        >
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.modalContent,
              {
                transform: [{ scale: modalScale }],
                opacity: modalOpacity,
              },
            ]}
          >
            <View
              style={[
                styles.iconBadge,
                infoModal?.type === "error"
                  ? styles.iconBadgeError
                  : styles.iconBadgeSuccess,
              ]}
            >
              <Ionicons
                name={
                  infoModal?.type === "error"
                    ? "alert-circle"
                    : "checkmark-circle"
                }
                size={40}
                color="#fff"
              />
            </View>

            <Text
              style={[
                styles.modalTitle,
                infoModal?.type === "error"
                  ? { color: "#991B1B" }
                  : { color: "#166534" },
              ]}
            >
              {infoModal?.title ||
                (infoModal?.type === "error"
                  ? t("common.error")
                  : t("common.info"))}
            </Text>

            {!!infoModal?.message && (
              <Text style={styles.modalMessage}>{infoModal?.message}</Text>
            )}

            <View style={styles.modalButtonWrapper}>
              <Button
                title={t("common.ok")}
                onPress={() => setInfoModal(null)}
              />
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#fff",
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    position: "relative",
  },
  iconBadge: {
    position: "absolute",
    top: -32,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4B5563",
  },
  iconBadgeError: {
    backgroundColor: "#DC2626",
  },
  iconBadgeSuccess: {
    backgroundColor: "#16A34A",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 4,
    color: "#111827",
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 12,
  },
  modalButtonWrapper: {
    marginTop: 4,
    alignSelf: "stretch",
  },
});

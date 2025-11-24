// src/components/ReceiptCard.tsx
import React from "react";
import { View, Image, Modal, TouchableOpacity, Share } from "react-native";
import { Text } from "./Themed";
import Chip from "./Chip";
import UploadChip from "./UploadChip";
import { useI18n } from "../i18n";

type FileParam = { uri: string; name: string; type: string };

export default function ReceiptCard({
  url,
  onReplace,
  replacing = false,
  canReplace = true,
}: {
  url?: string;
  onReplace: (file: FileParam) => Promise<void> | void;
  replacing?: boolean;
  canReplace?: boolean;
}) {
  const { t } = useI18n();
  const [viewer, setViewer] = React.useState(false);

  // Henüz dekont yokken
  if (!url) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <UploadChip
            title={
              replacing
                ? t("bookings.receipt.uploading")
                : t("bookings.receipt.upload")
            }
            onPicked={onReplace}
            disabled={replacing}
          />
        </View>
        <Text secondary>{t("bookings.receipt.acceptedFormats")}</Text>
      </View>
    );
  }

  // Dekont varken
  return (
    <View style={{ gap: 10 }}>
      <TouchableOpacity onPress={() => setViewer(true)} activeOpacity={0.9}>
        <Image
          source={{ uri: url }}
          style={{
            width: "100%",
            height: 220,
            borderRadius: 12,
            backgroundColor: "#F3F4F6",
          }}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip
          title={t("bookings.receipt.view")}
          onPress={() => setViewer(true)}
        />

        {canReplace ? (
          <UploadChip
            title={
              replacing
                ? t("bookings.receipt.uploading")
                : t("bookings.receipt.replace")
            }
            onPicked={onReplace}
            disabled={replacing}
          />
        ) : null}

        <Chip
          title={t("bookings.receipt.share")}
          onPress={async () => {
            try {
              await Share.share({
                url,
                message: url,
              });
            } catch {
              // sessizce yut – ekstra hata gösterimine gerek yok
            }
          }}
        />
      </View>

      <Modal
        visible={viewer}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
          }}
          onPress={() => setViewer(false)}
        >
          <Image
            source={{ uri: url }}
            style={{ width: "100%", height: "80%", borderRadius: 8 }}
            resizeMode="contain"
          />
          <Text style={{ color: "#fff", marginTop: 8 }} secondary>
            {t("bookings.receipt.tapToClose")}
          </Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
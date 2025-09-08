import React from "react";
import { View, Image, Modal, TouchableOpacity, Share } from "react-native";
import { Text } from "./Themed";
import Chip from "./Chip";
import UploadChip from "./UploadChip";

type FileParam = { uri: string; name: string; type: string };

export default function ReceiptCard({
  url,
  onReplace,
  replacing = false,
  canReplace = true, // onaylandıysa gizlemek için
}: {
  url?: string;
  onReplace: (file: FileParam) => Promise<void> | void;
  replacing?: boolean;
  canReplace?: boolean;
}) {
  const [viewer, setViewer] = React.useState(false);

  // YOKSA: tek satır chip + bilgi metni
  if (!url) {
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <UploadChip title={replacing ? "Yükleniyor…" : "Dekont Yükle"} onPicked={onReplace} disabled={replacing} />
        </View>
        <Text secondary>Kabul edilen: JPG/PNG</Text>
      </View>
    );
  }

  // VARSA: görsel + küçük chip aksiyonlar
  return (
    <View style={{ gap: 10 }}>
      <TouchableOpacity onPress={() => setViewer(true)} activeOpacity={0.9}>
        <Image
          source={{ uri: url }}
          style={{ width: "100%", height: 220, borderRadius: 12 }}
          resizeMode="cover"
        />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip title="Görüntüle" onPress={() => setViewer(true)} />
        {canReplace ? (
          <UploadChip title={replacing ? "Yükleniyor…" : "Değiştir"} onPicked={onReplace} disabled={replacing} />
        ) : null}
        <Chip
          title="Paylaş"
          onPress={async () => {
            try { await Share.share({ url, message: url }); } catch {}
          }}
        />
      </View>

      <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)}>
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
          <Image source={{ uri: url }} style={{ width: "100%", height: "80%", borderRadius: 8 }} resizeMode="contain" />
          <Text style={{ color: "#fff", marginTop: 8 }} secondary>
            Kapatmak için dokun
          </Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}


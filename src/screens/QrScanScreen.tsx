// src/screens/QrScanScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useI18n } from "../i18n";

type ParsedQr = {
  restaurantId?: string;
  tableId?: string;
  sessionId?: string;
  reservationId?: string;
};

function parseQrData(raw: string): ParsedQr {
  const text = String(raw || "").trim();
  if (!text) return {};

  // 1) JSON dene
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object") {
      return {
        restaurantId: j.restaurantId || j.restId || j.rid,
        tableId: j.tableId || j.tid,
        sessionId: j.sessionId || j.sid,
        reservationId: j.reservationId || j.resId,
      };
    }
  } catch {}

  // 2) URL query dene
  try {
    if (text.startsWith("http")) {
      const u = new URL(text);
      const qp = u.searchParams;
      return {
        restaurantId: qp.get("restaurantId") || qp.get("rid") || undefined,
        tableId: qp.get("tableId") || qp.get("tid") || undefined,
        sessionId: qp.get("sessionId") || qp.get("sid") || undefined,
        reservationId:
          qp.get("reservationId") || qp.get("resId") || undefined,
      };
    }
  } catch {}

  // 3) Basit format: "rid|tid|sid|resId"
  if (text.includes("|")) {
    const [rid, tid, sid, resId] = text.split("|").map((x) => x.trim());
    return {
      restaurantId: rid,
      tableId: tid,
      sessionId: sid,
      reservationId: resId,
    };
  }

  // 4) sadece restaurantId geldiyse:
  if (/^[0-9a-fA-F]{24}$/.test(text)) return { restaurantId: text };

  return {};
}

export default function QrScanScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const onBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseQrData(data);

    if (!parsed.restaurantId) {
      Alert.alert(
        t("qrScan.invalidQrTitle"),
        t("qrScan.invalidQrMessage")
      );
      setTimeout(() => setScanned(false), 800);
      return;
    }

    nav.navigate("QR Menü", {
      restaurantId: parsed.restaurantId,
      tableId: parsed.tableId || null,
      sessionId: parsed.sessionId || null,
      reservationId: parsed.reservationId || null,
      _raw: data,
    });
  };

  const padTop = Math.max(insets.top, 12);

  // Ekran her açıldığında, izin yoksa iste
  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Henüz permission objesi gelmediyse
  if (!permission) {
    return (
      <View style={[styles.center, { paddingTop: padTop }]}>
        <Text>{t("qrScan.permissionCheckingText")}</Text>
      </View>
    );
  }

  // İzin kalıcı olarak reddedildiyse / şu an granted değilse
  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: padTop }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#7B2C2C" />
        <Text style={{ marginTop: 8, fontWeight: "700", fontSize: 16 }}>
          {t("qrScan.cameraRequiredTitle")}
        </Text>
        <Text style={{ marginTop: 6, color: "#666", textAlign: "center" }}>
          {t("qrScan.cameraRequiredMessage")}
        </Text>

        <TouchableOpacity onPress={requestPermission} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t("qrScan.askPermissionBtn")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => nav.goBack()}
          style={[styles.backBtn, { marginTop: 10 }]}
        >
          <Text style={styles.backBtnText}>{t("qrScan.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // İzin verilmiş: tam ekran kamera + overlay
  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={onBarCodeScanned}
        // Sadece QR kodları için kısıtlama istersen:
        // barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Üst bar */}
      <View style={[styles.topBar, { paddingTop: padTop }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.topBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t("qrScan.title")}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Scan frame */}
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>{t("qrScan.scanHint")}</Text>

        {scanned && (
          <TouchableOpacity
            onPress={() => setScanned(false)}
            style={styles.rescanBtn}
          >
            <Ionicons name="scan-outline" size={18} color="#fff" />
            <Text style={styles.rescanText}>{t("qrScan.rescan")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },

  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  topTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  frame: {
    width: 250,
    height: 250,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  hint: { marginTop: 16, color: "#fff", fontWeight: "700" },

  rescanBtn: {
    marginTop: 16,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  rescanText: { color: "#fff", fontWeight: "800" },

  backBtn: {
    marginTop: 16,
    backgroundColor: "#7B2C2C",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnText: { color: "#fff", fontWeight: "800" },
});
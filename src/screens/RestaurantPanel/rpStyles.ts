// Yumuşak "Claude" stili ortak stiller
import { StyleSheet } from "react-native";

export const rp = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fafafa" },

  container: { padding: 16 },

  // Üst sekme çubuğu
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f2f2f2",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  tabBtnActive: {
    backgroundColor: "#121212",
    borderColor: "#121212",
  },
  tabText: { color: "#333", fontWeight: "500" },
  tabTextActive: { color: "#fff", fontWeight: "700" },

  // Kart
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#222", marginBottom: 10 },

  // Input
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
    marginBottom: 10,
  },

  // Butonlar
  btnPrimary: {
    backgroundColor: "#121212",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },

  btnMuted: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    alignSelf: "flex-start",
  },
  btnMutedText: { color: "#111", fontWeight: "600" },

  btnDanger: {
    backgroundColor: "#dc2626",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnDangerText: { color: "#fff", fontWeight: "700" },

  row: { flexDirection: "row", alignItems: "center" },
  muted: { color: "#6b7280" },
});
// src/components/ModifierPickerModal.tsx
import React from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "../components/Themed";
import {
  DeliveryColors,
  DeliveryRadii,
  DeliveryShadow,
} from "../delivery/deliveryTheme";
import { formatMoney } from "../delivery/deliveryUtils";

/**
 * Minimal types (backend shape ile uyumlu)
 */
export type ModifierOption = {
  _id: string;
  title: string;
  price?: number;
  order?: number;
  isActive?: boolean;
};

export type ModifierGroup = {
  _id: string;
  title: string;
  description?: string | null;
  minSelect?: number; // default 0
  maxSelect?: number; // default 1
  order?: number;
  isActive?: boolean;
  options: ModifierOption[];
};

export type ModifierSelection = {
  groupId: string;
  optionIds: string[];
};

type Props = {
  visible: boolean;
  itemTitle: string;
  basePrice: number;
  currencySymbol: string;
  groups: ModifierGroup[];

  onClose: () => void;

  /**
   * confirm olduğunda: seçilenler + hesaplanan unitPrice + opsiyon özeti döner
   */
  onConfirm: (payload: {
    selections: ModifierSelection[];
    unitPrice: number;
    summary: string | null;
  }) => void;
};

function toNum(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ModifierPickerModal({
  visible,
  itemTitle,
  basePrice,
  currencySymbol,
  groups,
  onClose,
  onConfirm,
}: Props) {
  const [selections, setSelections] = React.useState<ModifierSelection[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // modal açıldığında reset
  React.useEffect(() => {
    if (visible) {
      setSelections([]);
      setError(null);
    }
  }, [visible]);

  const activeGroups = React.useMemo(() => {
    const gs = Array.isArray(groups) ? groups : [];
    return gs
      .filter((g) => (g?.isActive ?? true) && String(g?._id))
      .map((g) => ({
        ...g,
        minSelect: toNum((g as any).minSelect, 0),
        maxSelect: toNum((g as any).maxSelect, 1),
        options: Array.isArray(g.options) ? g.options : [],
      }))
      .sort((a, b) => toNum((a as any).order, 0) - toNum((b as any).order, 0));
  }, [groups]);

  const selMap = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of selections || []) {
      m.set(String(s.groupId), new Set((s.optionIds || []).map(String)));
    }
    return m;
  }, [selections]);

  const toggleOption = React.useCallback((group: ModifierGroup, opt: ModifierOption) => {
    const gId = String(group._id);
    const oId = String(opt._id);
    const maxSel = Math.max(0, toNum((group as any).maxSelect, 1));

    setSelections((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex((x) => String(x.groupId) === gId);

      const curIds = idx >= 0 ? [...(next[idx].optionIds || [])].map(String) : [];
      const has = curIds.includes(oId);

      let nextIds = has ? curIds.filter((x) => x !== oId) : [...curIds, oId];

      // maxSelect kuralı
      if (!has && maxSel > 0 && nextIds.length > maxSel) {
        // max=1 ise replace
        if (maxSel === 1) nextIds = [oId];
        else nextIds = nextIds.slice(0, maxSel);
      }

      // boşsa entry kaldır
      if (nextIds.length === 0) {
        if (idx >= 0) next.splice(idx, 1);
        return next;
      }

      const entry: ModifierSelection = {
        groupId: gId,
        optionIds: Array.from(new Set(nextIds)).sort(),
      };

      if (idx >= 0) next[idx] = entry;
      else next.push(entry);

      next.sort((a, b) => String(a.groupId).localeCompare(String(b.groupId)));
      return next;
    });

    setError(null);
  }, []);

  const modifiersDelta = React.useMemo(() => {
    let delta = 0;

    for (const g of activeGroups) {
      const chosen = selMap.get(String(g._id));
      if (!chosen || chosen.size === 0) continue;

      for (const o of (g.options || []) as any[]) {
        if (!((o as any)?.isActive ?? true)) continue;
        if (chosen.has(String((o as any)._id))) delta += toNum((o as any).price, 0);
      }
    }

    return delta;
  }, [activeGroups, selMap]);

  const unitPrice = React.useMemo(() => {
    return toNum(basePrice, 0) + toNum(modifiersDelta, 0);
  }, [basePrice, modifiersDelta]);

  const summary = React.useMemo(() => {
    const parts: string[] = [];
    for (const g of activeGroups) {
      const chosen = selMap.get(String(g._id));
      if (!chosen || chosen.size === 0) continue;

      const names = (g.options || [])
        .filter((o) => chosen.has(String((o as any)._id)))
        .map((o) => String((o as any).title || ""))
        .filter(Boolean);

      if (names.length) parts.push(`${(g as any).title}: ${names.join(", ")}`);
    }
    return parts.join(" • ") || null;
  }, [activeGroups, selMap]);

  const validate = React.useCallback(() => {
    for (const g of activeGroups) {
      const picked = selMap.get(String(g._id))?.size || 0;
      const minSel = Math.max(0, toNum((g as any).minSelect, 0));
      const maxSel = Math.max(0, toNum((g as any).maxSelect, 1));

      if (minSel > 0 && picked < minSel) return `${(g as any).title} için en az ${minSel} seçim gerekli.`;
      if (maxSel > 0 && picked > maxSel) return `${(g as any).title} için en fazla ${maxSel} seçim yapabilirsiniz.`;
    }
    return null;
  }, [activeGroups, selMap]);

  const handleConfirm = React.useCallback(() => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    onConfirm({
      selections,
      unitPrice,
      summary,
    });
  }, [validate, onConfirm, selections, unitPrice, summary]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {itemTitle}
            </Text>
            <Text secondary style={styles.subtitle} numberOfLines={2}>
              Opsiyon seç
            </Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={DeliveryColors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 14 }}>
          {activeGroups.length === 0 ? (
            <View style={{ padding: 14 }}>
              <Text secondary>Bu ürün için opsiyon yok.</Text>
            </View>
          ) : (
            <View style={{ gap: 12, paddingHorizontal: 14, paddingTop: 10 }}>
              {activeGroups.map((g) => {
                const chosen = selMap.get(String(g._id)) || new Set<string>();
                const minSel = Math.max(0, toNum((g as any).minSelect, 0));
                const maxSel = Math.max(0, toNum((g as any).maxSelect, 1));
                const helper =
                  minSel > 0
                    ? `${minSel}-${maxSel} seçim zorunlu`
                    : maxSel > 0
                    ? `En fazla ${maxSel} seçim`
                    : "";

                const opts = (g.options || [])
                  .filter((o) => ((o as any)?.isActive ?? true) && String((o as any)?._id))
                  .sort((a, b) => toNum((a as any).order, 0) - toNum((b as any).order, 0));

                return (
                  <View key={String(g._id)} style={styles.groupCard}>
                    <View style={{ gap: 2 }}>
                      <Text style={styles.groupTitle}>{(g as any).title}</Text>
                      {!!helper && (
                        <Text secondary style={styles.groupHint}>
                          {helper}
                        </Text>
                      )}
                      {!!(g as any).description && (
                        <Text secondary style={{ fontSize: 12, marginTop: 2 }}>
                          {String((g as any).description)}
                        </Text>
                      )}
                    </View>

                    <View style={{ gap: 8, marginTop: 10 }}>
                      {opts.map((o) => {
                        const selected = chosen.has(String((o as any)._id));
                        const price = toNum((o as any).price, 0);

                        return (
                          <Pressable
                            key={String((o as any)._id)}
                            onPress={() => toggleOption(g as any, o as any)}
                            style={({ pressed }) => [
                              styles.optRow,
                              selected ? styles.optRowOn : null,
                              pressed ? { opacity: 0.92 } : null,
                            ]}
                          >
                            <View style={[styles.check, selected ? styles.checkOn : null]}>
                              {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={styles.optTitle}>{(o as any).title}</Text>
                            </View>

                            <Text style={styles.optPrice}>
                              {price > 0 ? `+${formatMoney(price, currencySymbol)}` : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={DeliveryColors.primary} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text secondary style={{ fontSize: 12 }}>
              Toplam
            </Text>
            <Text style={styles.total}>{formatMoney(unitPrice, currencySymbol)}</Text>
          </View>

          <Pressable onPress={handleConfirm} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Sepete Ekle</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "82%" as any,
    backgroundColor: DeliveryColors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
    ...DeliveryShadow.card,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: DeliveryColors.line,
    backgroundColor: "#FAFAFA",
  },
  title: { fontWeight: "900", color: DeliveryColors.text, fontSize: 16 },
  subtitle: { marginTop: 2, fontSize: 12 },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
  },

  groupCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    borderRadius: 14,
    padding: 12,
  },
  groupTitle: { fontWeight: "900", color: DeliveryColors.text },
  groupHint: { fontSize: 12 },

  optRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
  },
  optRowOn: {
    backgroundColor: "#FFF5F5",
    borderColor: "#F3DADA",
  },

  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: DeliveryColors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: {
    backgroundColor: DeliveryColors.primary,
    borderColor: DeliveryColors.primary,
  },

  optTitle: { fontWeight: "900", color: DeliveryColors.text },
  optPrice: { fontWeight: "900", color: DeliveryColors.primary, fontSize: 12 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3DADA",
    backgroundColor: "#FFF5F5",
  },
  errorText: {
    color: DeliveryColors.text,
    fontWeight: "900",
    fontSize: 12,
    flex: 1,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: DeliveryColors.line,
    backgroundColor: "#fff",
  },
  total: {
    fontWeight: "900",
    color: DeliveryColors.text,
    fontSize: 16,
    marginTop: 2,
  },

  addBtn: {
    backgroundColor: DeliveryColors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "900" },
});
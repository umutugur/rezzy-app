import React, { useMemo, useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Switch, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type SelectedModifiersState = Record<string, string[]>;

type ModifierOption = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  price?: number;
  extraPrice?: number;
};

type ModifierGroup = {
  _id?: string;
  id?: string;
  title?: string;
  name?: string;
  min?: number;
  max?: number;
  required?: boolean;
  multiple?: boolean;
  allowMultiple?: boolean;
  options?: ModifierOption[];
  items?: ModifierOption[];
};

type Props = {
  visible: boolean;
  item: any | null;
  groups: ModifierGroup[];
  fmt: (n: number) => string;
  onClose: () => void;
  onConfirm: (payload: {
    selected: SelectedModifiersState;
    modifiersOut: Array<{
      groupId: string;
      groupTitle?: string;
      optionId: string;
      optionTitle: string;
      priceDelta: number;
    }>;
    unitTotal: number;
  }) => void;
};

const C = {
  primary: "#7B2C2C",
  bg: "#FFFFFF",
  border: "#E6E6E6",
  text: "#1A1A1A",
  muted: "#666666",
  soft: "#FFF5F5",
};

const getId = (x: any): string => String(x?._id ?? x?.id ?? "");
const getTitle = (x: any): string => String(x?.title ?? x?.name ?? "");
const getPrice = (x: any): number => Number(x?.price ?? x?.extraPrice ?? 0) || 0;

// Robust numeric parsing for max/min coming from different backends (string, {$numberInt}, etc.)
const toNum = (v: any): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === "object") {
    const maybe = (v as any).$numberInt ?? (v as any).$numberDouble ?? (v as any).value;
    if (maybe != null) {
      const n = Number(maybe);
      return Number.isFinite(n) ? n : undefined;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const boolish = (v: any): boolean => {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (!s) return false;
    return s === "true" || s === "1" || s === "yes" || s === "y";
  }
  return Boolean(v);
};

const pickFirstNum = (...vals: any[]): number | undefined => {
  for (const v of vals) {
    const n = toNum(v);
    if (n != null) return n;
  }
  return undefined;
};

const getMin = (g: any): number => {
  // Common aliases across different menu/override contracts
  const n = pickFirstNum(
    g?.min,
    g?.minSelect,
    g?.minSelections,
    g?.minSelectable,
    g?.selectionMin,
    g?.constraints?.min,
    g?.rules?.min
  );
  return n != null && n > 0 ? Math.floor(n) : 0;
};

const getMax = (g: any): number | undefined => {
  // Common aliases across different menu/override contracts
  const n = pickFirstNum(
    g?.max,
    g?.maxSelect,
    g?.maxSelections,
    g?.maxSelectable,
    g?.selectionMax,
    g?.constraints?.max,
    g?.rules?.max
  );
  if (n == null) return undefined;
  const m = Math.floor(n);
  return m > 0 ? m : undefined;
};

const isMultiple = (g: any): boolean => {
  // Prefer explicit boolean flags when present
  if (boolish(g?.multiple) || boolish(g?.allowMultiple)) return true;
  if (boolish(g?.multi) || boolish(g?.isMultiple) || boolish(g?.isMulti)) return true;

  // Otherwise infer from max
  const max = getMax(g);
  return typeof max === "number" ? max > 1 : false;
};

function computeModsExtra(groups: ModifierGroup[], selected: SelectedModifiersState): number {
  let total = 0;
  for (const g of groups) {
    const gid = getId(g);
    const chosen = selected?.[gid] || [];
    const opts: ModifierOption[] = Array.isArray((g as any)?.options)
      ? (g as any).options
      : Array.isArray((g as any)?.items)
      ? (g as any).items
      : [];

    for (const oid of chosen) {
      const opt = opts.find((o) => getId(o) === oid);
      if (opt) total += getPrice(opt);
    }
  }
  return total;
}

function validate(groups: ModifierGroup[], selected: SelectedModifiersState): { ok: true } | { ok: false; message: string } {
  for (const g of groups) {
    const gid = getId(g);
    const title = getTitle(g) || "Seçim";
    const min = getMin(g);
    const max = getMax(g);
    const required = Boolean((g as any)?.required) || min > 0;
    const chosen = selected?.[gid] || [];

    if (required && chosen.length < Math.max(1, min)) {
      return { ok: false, message: `${title} için en az ${Math.max(1, min)} seçim yapmalısın.` };
    }
    if (typeof max === "number" && max > 0 && chosen.length > max) {
      return { ok: false, message: `${title} için en fazla ${max} seçim yapabilirsin.` };
    }
  }
  return { ok: true };
}

const cardShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
});

export default function QrItemModifiersModal({ visible, item, groups, fmt, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<SelectedModifiersState>({});

  useEffect(() => {
    if (!visible) return;
    const init: SelectedModifiersState = {};
    for (const g of groups || []) init[getId(g)] = [];
    setSelected(init);
  }, [visible, groups]);

  const basePrice = Number(item?.price || 0) || 0;

  const extra = useMemo(() => computeModsExtra(groups || [], selected), [groups, selected]);
  const unitTotal = basePrice + extra;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropPress} activeOpacity={1} onPress={onClose} />

        <View style={s.card}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{String(item?.title || "")}</Text>
              <Text style={s.sub}>Toplam: {fmt(unitTotal)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.close}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
            {(groups || []).map((g) => {
              const gid = getId(g);
              const gTitle = getTitle(g) || "Seçenek";
              const min = getMin(g);
              const max = getMax(g);
              const required = Boolean((g as any)?.required) || min > 0;
              const multiple = isMultiple(g);

              const selectedIds = selected[gid] || [];
              const opts: ModifierOption[] = Array.isArray((g as any)?.options)
                ? (g as any).options
                : Array.isArray((g as any)?.items)
                ? (g as any).items
                : [];

              return (
                <View key={gid} style={s.group}>
                  <View style={s.groupHeader}>
                    <Text style={s.groupTitle}>{gTitle}</Text>
                    <Text style={s.groupMeta}>
                      {required ? "Zorunlu" : "Opsiyonel"}
                      {typeof max === "number" && max > 0 ? ` · Max ${max}` : multiple ? " · Çoklu" : ""}
                    </Text>
                  </View>

                  {opts.map((o) => {
                    const oid = getId(o);
                    const oTitle = getTitle(o) || "Seçenek";
                    const add = getPrice(o);
                    const checked = selectedIds.includes(oid);

                    const toggle = () => {
                      setSelected((prev) => {
                        const cur = prev[gid] || [];
                        if (!multiple) return { ...prev, [gid]: checked ? [] : [oid] };

                        const next = checked ? cur.filter((x) => x !== oid) : [...cur, oid];
                        if (typeof max === "number" && max > 0 && next.length > max) {
                          // keep previous state; show a quick UX message
                          Alert.alert("Limit", `${gTitle} için en fazla ${max} seçim yapabilirsin.`);
                          return prev;
                        }
                        return { ...prev, [gid]: next };
                      });
                    };

                    return (
                      <TouchableOpacity key={oid} style={[s.opt, checked && s.optOn]} activeOpacity={0.85} onPress={toggle}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.optTitle}>{oTitle}</Text>
                          {add > 0 && <Text style={s.optPrice}>+ {fmt(add)}</Text>}
                        </View>
                        <Switch
                          value={checked}
                          onValueChange={toggle}
                          trackColor={{ false: "#E5E7EB", true: "#E9B9B9" }}
                          thumbColor={checked ? C.primary : "#fff"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancel} activeOpacity={0.9} onPress={onClose}>
              <Text style={s.cancelText}>Vazgeç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.confirm}
              activeOpacity={0.9}
              onPress={() => {
                const v = validate(groups || [], selected);
                if (!v.ok) {
                  Alert.alert("Hata", v.message);
                  return;
                }

                const modifiersOut: Array<{
                  groupId: string;
                  groupTitle?: string;
                  optionId: string;
                  optionTitle: string;
                  priceDelta: number;
                }> = [];
                for (const g of groups || []) {
                  const gid = getId(g);
                  const gTitle = getTitle(g);
                  const chosen = selected[gid] || [];
                  const opts: ModifierOption[] = Array.isArray((g as any)?.options)
                    ? (g as any).options
                    : Array.isArray((g as any)?.items)
                    ? (g as any).items
                    : [];

                  for (const oid of chosen) {
                    const opt = opts.find((x) => getId(x) === oid);
                    if (!opt) continue;
                    modifiersOut.push({
                      groupId: gid,
                      groupTitle: gTitle,
                      optionId: oid,
                      optionTitle: getTitle(opt),
                      priceDelta: getPrice(opt),
                    });
                  }
                }

                onConfirm({ selected, modifiersOut, unitTotal });
              }}
            >
              <Text style={s.confirmText}>Sepete Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  backdropPress: { ...StyleSheet.absoluteFillObject },

  card: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    ...cardShadow,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "900", color: C.text },
  sub: { marginTop: 4, fontSize: 12, color: C.muted, fontWeight: "800" },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },

  group: { backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 10, marginBottom: 10 },
  groupHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  groupTitle: { fontWeight: "900", color: C.text, fontSize: 14 },
  groupMeta: { color: C.muted, fontSize: 11, fontWeight: "800" },

  opt: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#F0F0F0", borderRadius: 12, padding: 10, marginTop: 8 },
  optOn: { borderColor: "#E9B9B9", backgroundColor: C.soft },
  optTitle: { fontWeight: "900", color: C.text, fontSize: 13 },
  optPrice: { marginTop: 2, color: C.primary, fontWeight: "900", fontSize: 12 },

  footer: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancel: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  cancelText: { fontWeight: "900", color: C.text },
  confirm: { flex: 1, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  confirmText: { fontWeight: "900", color: "#fff" },
});
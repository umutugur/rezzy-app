import React from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Share,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import "dayjs/locale/tr";
dayjs.locale("tr");

// ---- Opsiyonel modüller (varsa kullan) ----
let AsyncStorage: any = null;
let Clipboard: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Clipboard = require("expo-clipboard");
} catch {}

// ---- Tema ----
let BRAND = "#7B2C2C";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { panel } = require("../../theme/panelTheme");
  if (panel?.colors?.brand) BRAND = panel.colors.brand as string;
} catch {}

// ---- API ----
import {
  adminListUsers,
  adminGetUser,
  adminBanUser,
  adminUnbanUser,
  adminUpdateUserRole,
  type AdminListUsersParams,
} from "../../api/admin";

// ---- Yardımcılar ----
const money = (n?: number) =>
  n == null ? "-" : `₺${Number(n).toLocaleString("tr-TR")}`;

const roleTR = (r?: "customer" | "restaurant" | "admin" | string) =>
  r === "customer" ? "Müşteri" : r === "restaurant" ? "Restoran" : r === "admin" ? "Admin" : (r || "-");

const badgeTone = {
  muted: { bg: "#F3F4F6", fg: "#374151", icon: "•" },
  success: { bg: "#E8F7EE", fg: "#166534", icon: "✓" },
  warn: { bg: "#FFF7ED", fg: "#9A3412", icon: "!" },
  danger: { bg: "#FEF2F2", fg: "#991B1B", icon: "!" },
} as const;

const hit = { top: 10, bottom: 10, left: 10, right: 10 } as const;

type UserLite = {
  _id: string;
  name?: string;
  email?: string;
  role?: "customer" | "restaurant" | "admin";
  banned?: boolean;
  banReason?: string;
  bannedUntil?: string;
};

// ---- Avatar (ilk harf) ----
function InitialAvatar({ name }: { name?: string }) {
  const ch = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{ch}</Text>
    </View>
  );
}

// ---- Chip ----
function Chip({
  label,
  active,
  onPress,
  maxW,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  maxW?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={hit}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.9}
      style={[styles.chip, active && styles.chipActive, maxW ? { maxWidth: maxW } : null]}
    >
      <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---- Badge ----
function Badge({
  text,
  tone = "muted",
}: {
  text: string;
  tone?: keyof typeof badgeTone;
}) {
  const t = badgeTone[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{t.icon} {text}</Text>
    </View>
  );
}

// ---- BAN Modal ----
function BanModal({
  open,
  onClose,
  target,
  onBanned,
}: {
  open: boolean;
  onClose: () => void;
  target: UserLite | null;
  onBanned: (u: UserLite, payload: { reason: string; bannedUntil?: string }) => Promise<void>;

}) {
  const [reason, setReason] = React.useState("");
  const [until, setUntil] = React.useState<string | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [temp, setTemp] = React.useState(new Date());

  React.useEffect(() => {
    if (open) { setReason(""); setUntil(undefined); }
  }, [open]);

  return !open ? null : (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Kullanıcıyı Banla</Text>
          <Text style={styles.sheetSub}>{target?.name} • {target?.email}</Text>

          <Text style={styles.label}>Sebep</Text>
          <TextInput
            style={[styles.input, { minHeight: 44 }]}
            placeholder="Sebep"
            value={reason}
            onChangeText={setReason}
            multiline
          />

          <Text style={[styles.label, { marginTop: 10 }]}>Bitiş (opsiyonel)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="YYYY-MM-DD"
              value={until}
              onChangeText={setUntil}
            />
            <TouchableOpacity
              style={styles.btnMuted}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={styles.btnMutedText}>Takvim</Text>
            </TouchableOpacity>
          </View>

          {/* Kısayollar */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.btnGhost} onPress={() => setUntil(dayjs().add(1, "day").format("YYYY-MM-DD"))}>
              <Text style={styles.btnGhostText}>+24 saat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={() => setUntil(dayjs().add(7, "day").format("YYYY-MM-DD"))}>
              <Text style={styles.btnGhostText}>+7 gün</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={() => setUntil(undefined)}>
              <Text style={styles.btnGhostText}>Süresiz</Text>
            </TouchableOpacity>
          </View>

          {/* Date picker */}
          {pickerOpen && (
            <Modal transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={[styles.sheet, { paddingBottom: 12 }]}>
                  <Text style={styles.sheetTitle}>Ban bitiş tarihi</Text>
                  <DateTimePicker
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    value={temp}
                    onChange={(e, d) => {
                      if (Platform.OS === "android") {
                        if (e?.type === "set" && d) setUntil(dayjs(d).format("YYYY-MM-DD"));
                        setPickerOpen(false);
                      } else {
                        if (d) setTemp(d);
                      }
                    }}
                  />
                  {Platform.OS === "ios" && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={styles.btnMuted} onPress={() => setPickerOpen(false)}>
                        <Text style={styles.btnMutedText}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnBrand}
                        onPress={() => {
                          setUntil(dayjs(temp).format("YYYY-MM-DD"));
                          setPickerOpen(false);
                        }}
                      >
                        <Text style={styles.btnBrandText}>Seç</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </Modal>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
            <TouchableOpacity style={styles.btnMuted} onPress={onClose} hitSlop={hit}>
              <Text style={styles.btnMutedText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnDanger}
              onPress={async () => {
                if (!target) return;
                await onBanned(target, { reason, bannedUntil: until });
                onClose();
              }}
              hitSlop={hit}
            >
              <Text style={styles.btnDangerText}>Banla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- ROLE Modal ----
function RoleModal({
  open,
  onClose,
  target,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  target: UserLite | null;
  current?: UserLite["role"];
  onSaved: (r: NonNullable<UserLite["role"]>) => Promise<void>;
}) {
  const [val, setVal] = React.useState<NonNullable<UserLite["role"]>>(current || "customer");
  React.useEffect(() => { if (open) setVal((current as any) || "customer"); }, [open, current]);

  const RoleChip = ({ v }: { v: NonNullable<UserLite["role"]> }) => (
    <TouchableOpacity
      style={[styles.chip, val === v && styles.chipActive]}
      onPress={() => setVal(v)}
      hitSlop={hit}
    >
      <Text style={[styles.chipText, val === v && styles.chipTextActive]}>
        {roleTR(v)}
      </Text>
    </TouchableOpacity>
  );

  return !open ? null : (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Rol Değiştir</Text>
          <Text style={styles.sheetSub}>{target?.name} • {target?.email}</Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <RoleChip v="customer" />
            <RoleChip v="restaurant" />
            <RoleChip v="admin" />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
            <TouchableOpacity style={styles.btnMuted} onPress={onClose} hitSlop={hit}>
              <Text style={styles.btnMutedText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnBrand}
              onPress={async () => {
                if (!target) return;
                // Onay diyaloğu
                Alert.alert("Onay", `${target.name} için rol ${roleTR(current)} → ${roleTR(val)} yapılacak.`, [
                  { text: "Vazgeç" },
                  { text: "Evet", onPress: async () => { await onSaved(val); onClose(); } },
                ]);
              }}
              hitSlop={hit}
            >
              <Text style={styles.btnBrandText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- KPI Modal ----
function KPIModal({
  open, onClose, data,
}: {
  open: boolean; onClose: () => void; data: any;
}) {
  return !open ? null : (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { maxHeight: "80%" }]}>
          <Text style={styles.sheetTitle}>Kullanıcı KPI</Text>
          {data ? (
            <View style={{ gap: 6 }}>
              <Row left="Toplam" right={String(data.kpi?.total ?? 0)} />
              <Row left="Onaylı" right={String(data.kpi?.confirmed ?? 0)} />
              <Row left="Check-in" right={String(data.kpi?.arrived ?? 0)} />
              <Row left="İptal" right={String(data.kpi?.cancelled ?? 0)} />
              <Row left="No-show" right={String(data.kpi?.no_show ?? 0)} />
              <Row left="Ciro" right={money(data.kpi?.revenue ?? 0)} />
              <Row left="Kapora" right={money(data.kpi?.deposits ?? 0)} />
            </View>
          ) : <Text style={styles.muted}>—</Text>}

          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
            <TouchableOpacity style={styles.btnMuted} onPress={onClose} hitSlop={hit}>
              <Text style={styles.btnMutedText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ left, right }: { left: string; right?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={styles.muted}>{left}</Text>
      <Text style={{ color: "#111", fontWeight: "700", fontSize: 16 }}>{right}</Text>
    </View>
  );
}

// =================== ANA EKRAN ===================
export default function AdminUsersScreen() {
  const [userQuery, setUserQuery] = React.useState("");
  const [userRole, setUserRole] = React.useState<AdminListUsersParams["role"]>("");
  const [userBanned, setUserBanned] = React.useState<AdminListUsersParams["banned"]>("");

  const [users, setUsers] = React.useState<UserLite[]>([]);
  const [cursor, setCursor] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);

  // Modals
  const [banOpen, setBanOpen] = React.useState(false);
  const [banTarget, setBanTarget] = React.useState<UserLite | null>(null);

  const [roleOpen, setRoleOpen] = React.useState(false);
  const [roleTarget, setRoleTarget] = React.useState<UserLite | null>(null);

  const [kpiOpen, setKpiOpen] = React.useState(false);
  const [kpiData, setKpiData] = React.useState<any>(null);

  // Filtreleri hatırla
  React.useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        const s = await AsyncStorage.getItem("admin_users_filters");
        if (s) {
          const f = JSON.parse(s);
          setUserQuery(f.q || "");
          setUserRole(f.r || "");
          setUserBanned(f.b || "");
        }
      } catch {}
    })();
  }, []);
  React.useEffect(() => {
    (async () => {
      if (!AsyncStorage) return;
      try {
        await AsyncStorage.setItem(
          "admin_users_filters",
          JSON.stringify({ q: userQuery, r: userRole, b: userBanned })
        );
      } catch {}
    })();
  }, [userQuery, userRole, userBanned]);

  // Auto load (debounced)
  const deb = React.useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(() => {
      load(true);
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery, userRole, userBanned]);

  async function load(reset = false) {
    try {
      if (reset) { setUsers([]); setCursor(undefined); }
      setLoading(true);
      const { items, nextCursor } = await adminListUsers({
        query: userQuery || undefined,
        role: userRole || undefined,
        banned: userBanned || undefined,
        limit: 30,
        cursor: reset ? undefined : cursor,
      });
      setUsers((p) => (reset ? (items as UserLite[]) : [...p, ...(items as UserLite[])]));
      setCursor(nextCursor);
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.message || e?.message || "Kullanıcılar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }
  async function loadMore() {
    if (!cursor || loading) return;
    await load(false);
  }

  // Optimistic ban
  // ⬇️ reason zorunlu string
async function doBan(u: UserLite, payload: { reason: string; bannedUntil?: string }) {
  const prev = users;
  setUsers(arr =>
    arr.map(x => x._id === u._id ? { ...x, banned: true, banReason: payload.reason, bannedUntil: payload.bannedUntil } : x)
  );
  try {
    // adminBanUser(reason: string, bannedUntil?: string)
    await adminBanUser(u._id, { reason: payload.reason, bannedUntil: payload.bannedUntil });
  } catch (e: any) {
    setUsers(prev);
    Alert.alert("Hata", e?.message || "Ban başarısız");
  }
}
  async function doUnban(u: UserLite) {
    const prev = users;
    setUsers((arr) => arr.map(x => x._id === u._id ? { ...x, banned: false, banReason: undefined, bannedUntil: undefined } : x));
    try {
      await adminUnbanUser(u._id);
    } catch (e: any) {
      setUsers(prev);
      Alert.alert("Hata", e?.message || "Ban kaldırılamadı");
    }
  }
  async function doRole(u: UserLite, newRole: NonNullable<UserLite["role"]>) {
    const prev = users;
    setUsers((arr) => arr.map(x => x._id === u._id ? { ...x, role: newRole } : x));
    try {
      await adminUpdateUserRole(u._id, newRole);
    } catch (e: any) {
      setUsers(prev);
      Alert.alert("Hata", e?.message || "Rol güncellenemedi");
    }
  }

  // CSV dışa aktar
  async function exportCSV() {
    try {
      const lines = [
        "id,name,email,role,banned,bannedUntil",
        ...users.map(u => [
          JSON.stringify(u._id),
          JSON.stringify(u.name || ""),
          JSON.stringify(u.email || ""),
          JSON.stringify(u.role || ""),
          JSON.stringify(!!u.banned),
          JSON.stringify(u.bannedUntil || "")
        ].join(","))
      ].join("\n");
      await Share.share({ message: lines, title: "users.csv" });
    } catch {}
  }

  // Header (Filtreler)
  const Header = (
    <View style={[styles.card, { marginBottom: 8 }]}>
      <Text style={styles.cardTitle}>Kullanıcı Filtreleri</Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          placeholder="Ara (isim / e-posta)"
          value={userQuery}
          onChangeText={setUserQuery}
          style={[styles.input, { flex: 1 }]}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => { setUserQuery(""); setUserRole(""); setUserBanned(""); }}
        >
          <Text style={styles.btnGhostText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Rol & Ban chipleri */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {[
          ["", "Tümü"],
          ["customer", "Müşteri"],
          ["restaurant", "Restoran"],
          ["admin", "Admin"],
        ].map(([val, lbl]) => (
          <Chip key={lbl} label={lbl} active={userRole === (val as any)} onPress={() => setUserRole(val as any)} />
        ))}

        {[
          ["", "Ban (hepsi)"],
          ["true", "Banlı"],
          ["false", "Banlı değil"],
        ].map(([val, lbl]) => (
          <Chip key={lbl} label={lbl} active={userBanned === (val as any)} onPress={() => setUserBanned(val as any)} />
        ))}

        <TouchableOpacity style={styles.btnMuted} onPress={exportCSV} hitSlop={hit}>
          <Text style={styles.btnMutedText}>CSV Dışa Aktar</Text>
        </TouchableOpacity>
      </View>

      {/* İnce yükleme şeridi */}
      {loading && <View style={styles.loadingBar} />}
    </View>
  );

  return (
    <>
      <FlatList
        data={users}
        keyExtractor={(it) => it._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={Header}
        stickyHeaderIndices={[0]}
        refreshing={loading}
        onRefresh={() => load(true)}
        onEndReachedThreshold={0.25}
        onEndReached={loadMore}
        ListEmptyComponent={!loading ? (
          <View style={{ padding: 24 }}>
            <Text style={styles.muted}>Sonuç bulunamadı.</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <InitialAvatar name={item.name} />
              <View style={{ flex: 1 }}>
                {/* İsim + e-posta + kopyala */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={styles.userTitle}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item?.name || "(isim yok)"} • {item?.email}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (Clipboard?.setStringAsync) await Clipboard.setStringAsync(item?.email || "");
                        else if (Clipboard?.setString) Clipboard.setString(item?.email || "");
                        Alert.alert("Kopyalandı", item?.email || "");
                      } catch {}
                    }}
                    hitSlop={hit}
                    style={{ marginLeft: 6 }}
                    accessibilityLabel="E-postayı kopyala"
                  >
                    <Text style={{ color: BRAND, fontWeight: "900" }}>⧉</Text>
                  </TouchableOpacity>
                </View>

                {/* Rozetler */}
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  <Badge text={`Rol: ${roleTR(item.role)}`} tone="muted" />
                  <Badge text={item.banned ? "Banlı" : "Aktif"} tone={item.banned ? "danger" : "success"} />
                  {item.banned && item.bannedUntil ? (
                    <Badge text={`Bitiş: ${dayjs(item.bannedUntil).format("YYYY-MM-DD")}`} tone="warn" />
                  ) : null}
                </View>

                {/* Aksiyonlar */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {!item.banned ? (
                    <TouchableOpacity
                      style={styles.btnDanger}
                      onPress={() => { setBanTarget(item); setBanOpen(true); }}
                      hitSlop={hit}
                    >
                      <Text style={styles.btnDangerText}>Banla</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.btnBrand}
                      onPress={() => doUnban(item)}
                      hitSlop={hit}
                    >
                      <Text style={styles.btnBrandText}>Banı Kaldır</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={() => { setRoleTarget(item); setRoleOpen(true); }}
                    hitSlop={hit}
                  >
                    <Text style={styles.btnMutedText}>Rol Değiştir</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnMuted}
                    onPress={async () => {
                      try {
                        const d = await adminGetUser(item._id);
                        setKpiData(d);
                        setKpiOpen(true);
                      } catch (e: any) {
                        Alert.alert("Hata", e?.message || "Detay alınamadı");
                      }
                    }}
                    hitSlop={hit}
                  >
                    <Text style={styles.btnMutedText}>Detay KPI</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ paddingVertical: 16 }}>
            {loading ? (
              <ActivityIndicator />
            ) : cursor ? (
              <TouchableOpacity style={styles.btnBrand} onPress={loadMore}>
                <Text style={styles.btnBrandText}>Daha Fazla</Text>
              </TouchableOpacity>
            ) : users.length > 0 ? (
              <Text style={{ textAlign: "center", color: "#6b7280" }}>Hepsi bu kadar.</Text>
            ) : null}
          </View>
        }
      />

      {/* Modals */}
      <BanModal
        open={banOpen}
        onClose={() => setBanOpen(false)}
        target={banTarget}
        onBanned={doBan}
      />
      <RoleModal
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        target={roleTarget}
        current={roleTarget?.role}
        onSaved={async (newRole) => {
          if (!roleTarget) return;
          await doRole(roleTarget, newRole);
        }}
      />
      <KPIModal open={kpiOpen} onClose={() => setKpiOpen(false)} data={kpiData} />
    </>
  );
}

// =================== STYLES ===================
const styles = StyleSheet.create({
  // Kart/Container
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#222", marginBottom: 10 },

  // İnce progress bar
  loadingBar: { height: 3, backgroundColor: BRAND, marginTop: 10, borderRadius: 999, opacity: 0.75 },

  // Inputs
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
  },
  label: { color: "#6b7280", fontWeight: "600", marginBottom: 4 },
  sheetSub: { color: "#6b7280", marginBottom: 8 },

  // Chips
  chip: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    maxWidth: 220,
  },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { color: "#333", fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "800" },

  // Buttons
  btnBrand: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnBrandText: { color: "#fff", fontWeight: "800" },
  btnMuted: {
    backgroundColor: "#f2f2f2",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    alignSelf: "flex-start",
  },
  btnMutedText: { color: "#111", fontWeight: "700" },
  btnGhost: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
    alignSelf: "flex-start",
  },
  btnGhostText: { color: "#111", fontWeight: "700" },
  btnDanger: {
    backgroundColor: "#B91C1C",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  btnDangerText: { color: "#fff", fontWeight: "800" },

  // User card
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16, // genişletildi
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  userTitle: { fontWeight: "800", color: "#111", fontSize: 16, flexShrink: 1 },

  // Avatar
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 2,
  },
  avatarText: { color: "#374151", fontWeight: "900", fontSize: 16 },

  // Modal / Sheet
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  sheetTitle: { fontWeight: "900", fontSize: 18, color: "#111", marginBottom: 6 },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { fontWeight: "800" },

  muted: { color: "#6b7280" },
});
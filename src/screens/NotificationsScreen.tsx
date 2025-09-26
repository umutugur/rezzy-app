import React, { useEffect } from "react";
import { View, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { Text } from "../components/Themed";
import { useNotifications } from "../store/useNotifications";
import { navigateFromNotification } from "../utils/notificationNav";

dayjs.locale("tr");

export default function NotificationsScreen({ navigation }: any) {
  const {
    items,
    unreadCount,
    fetchUnreadCount,
    fetchListRemote,
    markAllReadLocal,
    markAllReadRemote,
  } = useNotifications();

  useEffect(() => {
    // varsa server’dan liste ve sayaç dene (uç yoksa sessiz)
    fetchListRemote?.();
    fetchUnreadCount();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              fetchListRemote?.();
              fetchUnreadCount();
            }}
          />
        }
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 8, backgroundColor: "#fff" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800" }}>Bildirimler</Text>
              <TouchableOpacity
                onPress={() => markAllReadRemote?.() ?? markAllReadLocal()}
                disabled={unreadCount === 0}
                style={{
                  opacity: unreadCount === 0 ? 0.5 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: "#111827",
                }}
              >
                <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                <Text style={{ color: "#fff", marginLeft: 6, fontWeight: "700" }}>Hepsini okundu</Text>
              </TouchableOpacity>
            </View>
            <Text secondary style={{ marginTop: 6 }}>
              Okunmamış: {unreadCount}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigateFromNotification(navigation, item.data)}
            style={{
              backgroundColor: item.read ? "#F9FAFB" : "#FFF7ED",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={item.read ? "notifications-outline" : "notifications"}
                size={18}
                color={item.read ? "#6B7280" : "#7C2D12"}
                style={{ marginRight: 8 }}
              />
              <Text style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>
                {item.title || "Bildirim"}
              </Text>
            </View>
            {!!item.body && (
              <Text style={{ marginTop: 6 }} numberOfLines={3}>
                {item.body}
              </Text>
            )}
            <Text secondary style={{ marginTop: 6 }}>
              {dayjs(item.ts || Date.now()).format("DD MMM YYYY, HH:mm")}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text secondary>Henüz bildirimin yok.</Text>
          </View>
        }
      />
    </View>
  );
}

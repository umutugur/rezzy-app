import React from "react";
import { ScrollView, View, Text, TouchableOpacity, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const email = "info@rezvix.co.uk";

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingBottom: insets.bottom + 32,
        backgroundColor: T.colors.background,
        flexGrow: 1,
      }}
    >
      {/* Header */}
      <Text style={{ fontSize: 26, fontWeight: "800", color: T.colors.text, marginBottom: 6 }}>
        {t("contact.title")}
      </Text>
      <Text style={{ fontSize: 16, color: T.colors.textSecondary, marginBottom: 18 }}>
        {t("contact.subtitle")}
      </Text>

      {/* Contact Card */}
      <View
        style={{
          backgroundColor: "#fff",
          padding: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          marginBottom: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <MaterialCommunityIcons name="email-outline" size={30} color={T.colors.primary} />
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "700", color: T.colors.text }}>
            {t("contact.emailTitle")}
          </Text>
        </View>

        <Text style={{ color: T.colors.textSecondary, marginBottom: 10, lineHeight: 20 }}>
          {t("contact.emailDesc")}
        </Text>

        <TouchableOpacity
          onPress={() => Linking.openURL(`mailto:${email}`)}
          activeOpacity={0.7}
          style={{
            backgroundColor: T.colors.primary,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{email}</Text>
        </TouchableOpacity>
      </View>

      {/* Work Hours */}
      <View
        style={{
          backgroundColor: "#fff",
          padding: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          marginBottom: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <MaterialCommunityIcons name="clock-outline" size={28} color={T.colors.primary} />
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "700", color: T.colors.text }}>
            {t("contact.workHoursTitle")}
          </Text>
        </View>

        <Text style={{ fontSize: 15, color: T.colors.textSecondary, marginBottom: 6 }}>
          {t("contact.workdays")}
        </Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: T.colors.text }}>
          {t("contact.workhours")}
        </Text>
      </View>

      {/* Social / Placeholder (Future use) */}
      <View
        style={{
          backgroundColor: "#fff",
          padding: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <MaterialCommunityIcons name="information-outline" size={28} color={T.colors.primary} />
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "700", color: T.colors.text }}>
            {t("contact.moreInfo")}
          </Text>
        </View>

        <Text style={{ color: T.colors.textSecondary, lineHeight: 20 }}>
          {t("contact.moreInfoDesc")}
        </Text>
      </View>
    </ScrollView>
  );
}

import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const card = {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.colors.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  } as const;

  const headerBadge = {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(123,44,44,0.08)",
    marginRight: 12,
  } as const;

  const iconBadge = {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(123,44,44,0.06)",
    marginRight: 8,
  } as const;

  const sectionTitle = {
    fontSize: 15,
    fontWeight: "700",
    color: T.colors.text,
    marginBottom: 6,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.colors.background }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <View style={headerBadge}>
          <Ionicons name="document-text-outline" size={24} color={T.colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: T.colors.text,
              marginBottom: 4,
            }}
          >
            {t("licenses.title")}
          </Text>
          <Text style={{ color: T.colors.textSecondary, fontSize: 13 }}>
            {t("licenses.subtitle")}
          </Text>
        </View>
      </View>

      {/* Overview */}
      <View style={card}>
        <SectionHeader
          icon="information-outline"
          title={t("licenses.section.overviewTitle")}
        />
        <Text style={bodyText}>{t("licenses.section.overviewBody1")}</Text>
        <Text style={bodyText}>{t("licenses.section.overviewBody2")}</Text>
      </View>

      {/* Core libs */}
      <View style={card}>
        <SectionHeader
          icon="web-box"
          title={t("licenses.section.coreTitle")}
        />
        <LicenseItem name="React Native" note="MIT" />
        <LicenseItem name="Expo" note="MIT" />
        <LicenseItem name="React Navigation" note="MIT" />
        <LicenseItem name="@tanstack/react-query" note="MIT" />
        <LicenseItem name="Axios" note="MIT" />
      </View>

      {/* UI libs */}
      <View style={card}>
        <SectionHeader
          icon="palette-outline"
          title={t("licenses.section.uiTitle")}
        />
        <LicenseItem name="react-native-safe-area-context" note="MIT" />
        <LicenseItem name="@expo/vector-icons" note="MIT" />
        <LicenseItem name="react-native-gesture-handler" note="MIT" />
        <LicenseItem name="react-native-reanimated" note="MIT" />
      </View>

      {/* Tooling */}
      <View style={card}>
        <SectionHeader
          icon="cogs"
          title={t("licenses.section.toolingTitle")}
        />
        <LicenseItem name="dayjs" note="MIT" />
        <LicenseItem name="zustand" note="MIT" />
        <LicenseItem name="i18next / react-i18next" note="MIT" />
      </View>

      {/* Notes */}
      <View style={[card, { marginBottom: 0 }]}>
        <SectionHeader
          icon="note-text-outline"
          title={t("licenses.section.noteTitle")}
        />
        <Text style={bodyText}>{t("licenses.section.noteBody1")}</Text>
        <Text style={bodyText}>{t("licenses.section.noteBody2")}</Text>
      </View>
    </ScrollView>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(123,44,44,0.06)",
          marginRight: 8,
        }}
      >
        <MaterialCommunityIcons name={icon} size={18} color={T.colors.primary} />
      </View>

      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: T.colors.text,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

const bodyText = {
  color: T.colors.textSecondary,
  fontSize: 13,
  lineHeight: 19,
  marginBottom: 4,
} as const;

function LicenseItem({ name, note }: { name: string; note?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        marginBottom: 4,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: T.colors.text,
          flexShrink: 1,
        }}
      >
        • {name}
      </Text>
      {note ? (
        <Text
          style={{
            fontSize: 12,
            color: T.colors.textSecondary,
            marginLeft: 6,
          }}
        >
          ({note})
        </Text>
      ) : null}
    </View>
  );
}
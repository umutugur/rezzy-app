import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

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
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(123,44,44,0.08)",
            marginRight: 12,
          }}
        >
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
            {t("terms.title")}
          </Text>
          <Text style={{ color: T.colors.textSecondary, fontSize: 13 }}>
            {t("terms.subtitle")}
          </Text>
        </View>
      </View>

      {/* Section: Account & Security */}
      <Card>
        <CardHeader
          icon="account-lock-outline"
          title={t("terms.accountTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.accountText")}</Text>
      </Card>

      {/* Section: Reservations & Cancellations */}
      <Card>
        <CardHeader
          icon="calendar-check-outline"
          title={t("terms.reservationsTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.reservationsText1")}</Text>
        <Text style={paragraphStyle}>{t("terms.reservationsText2")}</Text>
      </Card>

      {/* Section: Prohibited Use */}
      <Card>
        <CardHeader
          icon="alert-circle-outline"
          title={t("terms.prohibitedTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.prohibitedText")}</Text>
      </Card>

      {/* Section: Liability */}
      <Card>
        <CardHeader
          icon="shield-half-full"
          title={t("terms.liabilityTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.liabilityText")}</Text>
      </Card>

      {/* Section: Changes */}
      <Card>
        <CardHeader
          icon="update"
          title={t("terms.changesTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.changesText")}</Text>
      </Card>

      {/* Section: Legal Info */}
      <Card>
        <CardHeader
          icon="scale-balance"
          title={t("terms.legalTitle")}
        />
        <Text style={paragraphStyle}>{t("terms.legalText1")}</Text>
        <Text style={paragraphStyle}>{t("terms.legalText2")}</Text>
        <Text
          style={{
            color: T.colors.textSecondary,
            fontSize: 11,
            marginTop: 8,
          }}
        >
          {t("terms.disclaimer")}
        </Text>
        <Text
          style={{
            color: T.colors.textSecondary,
            fontSize: 11,
            marginTop: 2,
          }}
        >
          {t("terms.lastUpdate")}
        </Text>
      </Card>
    </ScrollView>
  );
}

/** --- Small UI helpers (same file) --- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
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
      }}
    >
      {children}
    </View>
  );
}

function CardHeader({
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

const paragraphStyle = {
  color: T.colors.textSecondary,
  fontSize: 13,
  lineHeight: 19,
  marginBottom: 4,
} as const;
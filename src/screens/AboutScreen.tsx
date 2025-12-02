import React from "react";
import { ScrollView, Text, View, Image } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? "-";
  const { t } = useI18n();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.colors.background }}
      contentContainerStyle={{
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      {/* Header */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: T.colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Rezvix
        </Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            marginTop: 4,
            color: T.colors.text,
          }}
        >
          {t("about.title")}
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: T.colors.textSecondary,
            fontSize: 14,
          }}
        >
          {t("about.subtitle")}
        </Text>
      </View>

      {/* Main card */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: T.colors.muted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
              overflow: "hidden",
            }}
          >
           
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: T.colors.text,
              }}
            >
              {t("about.headline")}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 13,
                color: T.colors.textSecondary,
              }}
            >
              {t("about.description")}
            </Text>
          </View>
        </View>

        {/* Feature list */}
        <View style={{ marginTop: 4 }}>
          <FeatureRow
            icon="calendar-outline"
            title={t("about.features.smartBooking.title")}
            desc={t("about.features.smartBooking.desc")}
          />
          <FeatureRow
            icon="shield-checkmark-outline"
            title={t("about.features.deposit.title")}
            desc={t("about.features.deposit.desc")}
          />
          <FeatureRow
            icon="qr-code-outline"
            title={t("about.features.qr.title")}
            desc={t("about.features.qr.desc")}
          />
          <FeatureRow
            icon="stats-chart-outline"
            title={t("about.features.transparency.title")}
            desc={t("about.features.transparency.desc")}
          />
        </View>
      </View>

      {/* Meta / version info card */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: T.colors.border,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: T.colors.text,
            marginBottom: 8,
          }}
        >
          {t("about.meta.title")}
        </Text>

        <MetaRow
          label={t("about.meta.version")}
          value={version}
          icon="information-circle-outline"
        />
        <MetaRow
          label={t("about.meta.regions")}
          value={t("about.meta.regionsValue")}
          icon="location-outline"
        />
        <MetaRow
          label={t("about.meta.contact")}
          value="rezvixapp7@gmail.com"
          icon="mail-outline"
        />
      </View>
    </ScrollView>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  desc: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 10,
      }}
    >
      <View
        style={{
          width: 28,
          alignItems: "center",
          paddingTop: 2,
        }}
      >
        <Ionicons name={icon} size={18} color={T.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: T.colors.text,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: T.colors.textSecondary,
            marginTop: 2,
          }}
        >
          {desc}
        </Text>
      </View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={16} color={T.colors.textSecondary} />
        <Text style={{ color: T.colors.textSecondary, fontSize: 13 }}>{label}</Text>
      </View>
      <Text
        style={{
          color: T.colors.text,
          fontWeight: "600",
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
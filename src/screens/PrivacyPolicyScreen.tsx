import React from "react";
import { ScrollView, Text, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const sectionCard = {
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

  const sectionTitle = {
    fontSize: 15,
    fontWeight: "700",
    color: T.colors.text,
  } as const;

  const sectionItem = {
    fontSize: 13,
    color: T.colors.textSecondary,
    marginBottom: 4,
    lineHeight: 19,
  } as const;

  const iconBadgeBase = {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.colors.background }}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: insets.bottom + 32,
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
          <Ionicons
            name="shield-checkmark"
            size={24}
            color={T.colors.primary}
          />
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
            {t("privacy.title")}
          </Text>
          <Text style={{ color: T.colors.textSecondary, fontSize: 13 }}>
            {t("privacy.subtitle")}
          </Text>
        </View>
      </View>

      {/* Section 1: Collected Data */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <Ionicons
              name="finger-print-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.collected")}</Text>
        </View>
        <Text style={sectionItem}>• {t("privacy.collected_id")}</Text>
        <Text style={sectionItem}>• {t("privacy.collected_usage")}</Text>
        <Text style={sectionItem}>• {t("privacy.collected_device")}</Text>
      </View>

      {/* Section 2: Usage */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.usage")}</Text>
        </View>
        <Text style={sectionItem}>• {t("privacy.usage_reservation")}</Text>
        <Text style={sectionItem}>• {t("privacy.usage_notifications")}</Text>
        <Text style={sectionItem}>• {t("privacy.usage_security")}</Text>
      </View>

      {/* Section 3: Sharing */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <MaterialCommunityIcons
              name="account-multiple-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.sharing")}</Text>
        </View>
        <Text style={sectionItem}>• {t("privacy.sharing_restaurants")}</Text>
        <Text style={sectionItem}>• {t("privacy.sharing_law")}</Text>
      </View>

      {/* Section 4: Retention */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.retention")}</Text>
        </View>
        <Text style={sectionItem}>{t("privacy.retention_text")}</Text>
      </View>

      {/* Section 5: Rights */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.rights")}</Text>
        </View>
        <Text style={sectionItem}>{t("privacy.rights_text")}</Text>
      </View>

      {/* Section 6: Cookies */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <MaterialCommunityIcons
              name="cookie-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.cookies")}</Text>
        </View>
        <Text style={sectionItem}>{t("privacy.cookies_text")}</Text>
      </View>

      {/* Section 7: Contact */}
      <View style={sectionCard}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={[
              iconBadgeBase,
              { backgroundColor: "rgba(123,44,44,0.06)" },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={T.colors.primary}
            />
          </View>
          <Text style={sectionTitle}>{t("privacy.contact")}</Text>
        </View>
        <Text style={sectionItem}>{t("privacy.contact_text") ?? ""}</Text>
        <Text
          style={[sectionItem, { color: T.colors.primary, marginTop: 4 }]}
          onPress={() => Linking.openURL("mailto:info@rezvix.co.uk")}
        >
          info@rezvix.co.uk
        </Text>
      </View>

      <Text
        style={{
          color: T.colors.textSecondary,
          marginTop: 16,
          fontSize: 11,
          textAlign: "center",
        }}
      >
        {t("privacy.disclaimer")}
      </Text>
    </ScrollView>
  );
}

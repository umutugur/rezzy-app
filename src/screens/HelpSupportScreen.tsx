import React from "react";
import { ScrollView, Text, View, TouchableOpacity, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme as T } from "../theme/theme";
import { useI18n } from "../i18n";

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
    >
      {/* Header */}
      <View style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: T.colors.text,
            marginBottom: 4,
          }}
        >
          {t("helpSupport.title")}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: T.colors.textSecondary,
          }}
        >
          {t("helpSupport.subtitle")}
        </Text>
      </View>

      {/* FAQ Card */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: 16,
          marginBottom: 16,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(123,44,44,0.08)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Ionicons name="help-circle" size={20} color={T.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: T.colors.text,
              }}
            >
              {t("helpSupport.faq.title")}
            </Text>
            <Text style={{ fontSize: 12, color: T.colors.textSecondary }}>
              {t("helpSupport.faq.subtitle")}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          <FaqRow
            label={t("helpSupport.faq.q1")}
            answer={t("helpSupport.faq.a1")}
          />
          <FaqRow
            label={t("helpSupport.faq.q2")}
            answer={t("helpSupport.faq.a2")}
          />
          <FaqRow
            label={t("helpSupport.faq.q3")}
            answer={t("helpSupport.faq.a3")}
          />
          <FaqRow
            label={t("helpSupport.faq.q4")}
            answer={t("helpSupport.faq.a4")}
          />
        </View>
      </View>

      {/* Tips Card */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: 16,
          marginBottom: 16,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(16,185,129,0.08)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Ionicons name="bulb-outline" size={20} color={T.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: T.colors.text,
              }}
            >
              {t("helpSupport.tips.title")}
            </Text>
            <Text style={{ fontSize: 12, color: T.colors.textSecondary }}>
              {t("helpSupport.tips.subtitle")}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 4 }}>
          <TipRow label={t("helpSupport.tips.item1")} />
          <TipRow label={t("helpSupport.tips.item2")} />
          <TipRow label={t("helpSupport.tips.item3")} />
        </View>
      </View>

      {/* Still need help? */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: 16,
          marginBottom: 8,
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: T.colors.text,
            marginBottom: 4,
          }}
        >
          {t("helpSupport.contact.title")}
        </Text>
        <Text style={{ color: T.colors.textSecondary, marginBottom: 12 }}>
          {t("helpSupport.contact.subtitle")}
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            const email = "rezvixapp7@gmail.com";
            const subject = encodeURIComponent("Rezvix - Yardım Talebi");
            const body = encodeURIComponent(
              "Merhaba Rezvix ekibi,\n\nUygulama ile ilgili yardım almak istiyorum.\n\nCihaz / Platform:\nAçıklama:"
            );
            const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
            Linking.openURL(mailto).catch(() => {
              // Eğer mail uygulaması açılamazsa sessizce başarısız olsun;
              // istenirse daha sonra burada toast/modal eklenebilir.
              return;
            });
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: T.colors.primary,
          }}
        >
          <Ionicons name="mail" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {t("helpSupport.contact.button")}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function FaqRow({ label, answer }: { label: string; answer: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 10,
      }}
    >
      <Ionicons
        name="help-buoy-outline"
        size={18}
        color={T.colors.primary}
        style={{ marginRight: 6, marginTop: 4 }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: T.colors.text,
            fontWeight: "600",
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: T.colors.textSecondary,
            fontSize: 13,
          }}
        >
          {answer}
        </Text>
      </View>
    </View>
  );
}

function TipRow({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 6,
      }}
    >
      <Ionicons
        name="checkmark-circle-outline"
        size={18}
        color={T.colors.success}
        style={{ marginRight: 6, marginTop: 2 }}
      />
      <Text style={{ color: T.colors.textSecondary, flex: 1 }}>{label}</Text>
    </View>
  );
}
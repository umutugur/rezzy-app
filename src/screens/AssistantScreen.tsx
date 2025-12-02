// src/screens/AssistantScreen.tsx
import React from "react";
import {
  View,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Screen, Text } from "../components/Themed";
import { useI18n } from "../i18n";
import { sendAssistantMessage, type AssistantSuggestion } from "../api/assistant";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

type ChatMessage = {
  id: string;
  from: "user" | "bot";
  text: string;
  suggestions?: AssistantSuggestion[];
};

export default function AssistantScreen() {
  const { t, language } = useI18n();
  const navigation = useNavigation<any>();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [initializing, setInitializing] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const listRef = React.useRef<FlatList<ChatMessage> | null>(null);

  // İlk greeting mesajı (backend'ten)
  React.useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        setInitializing(true);
        setError(null);

        // Dile göre basit bir merhaba mesajı
        const hello =
          language === "en"
            ? "Hi"
            : language === "ru"
            ? "Привет"
            : language === "el"
            ? "Γεια"
            : "Merhaba";

        const res = await sendAssistantMessage({
          message: hello,
          language,
        });

        if (cancelled) return;

        if (!res.ok) {
          throw new Error("assistant_not_ok");
        }

        const firstBot: ChatMessage = {
          id: "bot-0",
          from: "bot",
          text: res.reply,
          suggestions: res.suggestions || [],
        };

        setMessages([firstBot]);
      } catch (e) {
        if (cancelled) return;
        console.error("[assistant] bootstrap error:", e);
        setError(
          t("assistant.errorInit", {
            defaultValue:
              "Asistan şu anda başlatılamadı. Lütfen tekrar dene ya da birazdan yeniden aç.",
          }) as string
        );
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const scrollToEnd = React.useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, []);

  const handleSend = React.useCallback(
  async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading || initializing) return;

    setInput("");
    setError(null);

    // 1) @search komutlarını yakala (LLM → keşif/harita ekranı)
    if (content.startsWith("@search ")) {
      // Komut içeriğini parse et: city=Girne;people=4;date=yarın;...
      const payload = content.slice("@search ".length);
      const filters: Record<string, string> = {};

      payload.split(";").forEach((part) => {
        const [k, v] = part.split("=");
        if (!k || !v) return;
        filters[k.trim()] = v.trim();
      });

      // İstersen bu komutu da user mesajı gibi göster
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        from: "user",
        text: content, // veya filters.city vb. daha okunur bir şey
      };
      setMessages((prev) => [...prev, userMsg]);
      scrollToEnd();

      // 👉 Burada kendi keşif / harita ekranına yönlendir
      // Route adını PROJENE GÖRE değiştir:
      // Örn: "NearbyRestaurants", "Explore", "NearbyMap" vs.
      navigation.navigate("Harita", {
        fromAssistant: true,
        city: filters.city || undefined,
        people: filters.people ? Number(filters.people) : undefined,
        dateText: filters.date || undefined,
        timeRange: filters.timerange || undefined,
        budget: filters.budget || undefined,
        style: filters.style || undefined,
      });

      return; // backend'e istek yok
    }

    // 2) Normal assistant mesaj akışı
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      from: "user",
      text: content,
    };

    setMessages((prev) => [...prev, userMsg]);
    scrollToEnd();

    setLoading(true);
    try {
      const res = await sendAssistantMessage({
        message: content,
        language,
      });

      if (!res.ok) {
        throw new Error("assistant_not_ok");
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        from: "bot",
        text: res.reply,
        suggestions: res.suggestions || [],
      };

      setMessages((prev) => [...prev, botMsg]);
      scrollToEnd();
    } catch (e) {
      console.error("[assistant] send error:", e);
      setError(
        t("assistant.errorSend", {
          defaultValue:
            "Şu anda mesajını işleyemedim. Lütfen tekrar dene.",
        }) as string
      );
    } finally {
      setLoading(false);
    }
  },
  [
    input,
    loading,
    initializing,
    language,
    t,
    scrollToEnd,
    navigation, // <- unutma
  ]
);
  const handleSuggestionPress = React.useCallback(
    (sugg: AssistantSuggestion) => {
      handleSend(sugg.message);
    },
    [handleSend]
  );

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.from === "user";

    return (
      <View style={styles.row}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleBot,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.text}
          </Text>

          {/* Suggestions sadece bot mesajlarında */}
          {!isUser && item.suggestions && item.suggestions.length > 0 && (
            <View style={styles.suggestionRow}>
              {item.suggestions.map((s) => (
                <Pressable
                  key={s.label + s.message}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionPress(s)}
                >
                  <Text style={styles.suggestionChipText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const placeholder =
    (t("assistant.inputPlaceholder", {
      defaultValue: "Mekan, rezervasyon veya Rezvix ile ilgili bir soru sor...",
    }) as string) || "Mesaj yaz...";

  return (
    <Screen
      style={{
        flex: 1,
        backgroundColor: "#F5F5F5",
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {/* Mesaj listesi */}
        <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
          {initializing ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator />
              <Text secondary style={{ marginTop: 8 }}>
                {t("assistant.loading", {
                  defaultValue: "Asistan hazırlanıyor...",
                })}
              </Text>
            </View>
          ) : (
            <>
              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{
                  paddingVertical: 8,
                  paddingBottom: 16,
                }}
                onContentSizeChange={scrollToEnd}
              />
            </>
          )}
        </View>

        {/* Input alanı */}
        <View style={styles.inputBarWrap}>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              multiline
            />

            <Pressable
              onPress={() => handleSend()}
              disabled={!input.trim() || loading || initializing}
              style={({ pressed }) => [
                styles.sendButton,
                (!input.trim() || loading || initializing) &&
                  styles.sendButtonDisabled,
                pressed && !loading && !initializing && { opacity: 0.85 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          <Text style={styles.hintText}>
            {t("assistant.hint", {
              defaultValue:
                "Örn: “Bu akşam 4 kişi Girne’de meyhane önerir misin?”",
            })}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    marginBottom: 6,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleUser: {
    backgroundColor: "#7B2C2C",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 14,
    color: "#111827",
  },
  bubbleTextUser: {
    color: "#FFFFFF",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 6,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F3E8E3",
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7B2C2C",
  },
  inputBarWrap: {
    paddingHorizontal: 12,
    paddingBottom: Platform.select({ ios: 12, android: 10 }),
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F9FAFB",
  },
  textInput: {
    flex: 1,
    minHeight: 34,
    maxHeight: 100,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "#7B2C2C",
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  errorBox: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 13,
    color: "#B91C1C",
  },
  hintText: {
    marginTop: 4,
    fontSize: 11,
    color: "#9CA3AF",
  },
});
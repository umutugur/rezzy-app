// rezzy-app/src/components/ui/ReviewSection.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { StarRating } from "./StarRating";
import {
  getReviews,
  submitReview,
  type ReviewEntityType,
  type Review,
  type ReviewSummary,
} from "../../api/reviews";
import { useAuth } from "../../store/useAuth";

interface ReviewSectionProps {
  entityType: ReviewEntityType;
  entityId: string;
  style?: ViewStyle;
}

function ReviewCard({ review }: { review: Review }) {
  const theme = useTheme();
  const userName =
    typeof review.userId === "object" ? review.userId.name : "Kullanıcı";
  const date = new Date(review.createdAt).toLocaleDateString("tr-TR");

  return (
    <View
      style={{
        padding: theme.space[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.borderDefault,
        gap: theme.space[1],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{ ...theme.typography.labelMd, color: theme.colors.textPrimary }}
        >
          {userName}
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: theme.space[2] }}
        >
          <StarRating rating={review.rating} size="sm" readonly />
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.textSecondary,
            }}
          >
            {date}
          </Text>
        </View>
      </View>
      {!!review.comment && (
        <Text
          style={{ ...theme.typography.bodyMd, color: theme.colors.textSecondary }}
        >
          {review.comment}
        </Text>
      )}
      {review.verifiedPurchase && (
        <Text
          style={{ ...theme.typography.caption, color: theme.colors.success }}
        >
          ✓ Doğrulanmış müşteri
        </Text>
      )}
    </View>
  );
}

function SummaryBar({ summary }: { summary: ReviewSummary }) {
  const theme = useTheme();
  if (summary.totalCount === 0) return null;

  return (
    <View
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radius.lg,
        marginBottom: theme.space[3],
        gap: theme.space[2],
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: theme.space[3] }}
      >
        <Text
          style={{
            ...theme.typography.displayLg,
            color: theme.colors.textPrimary,
          }}
        >
          {summary.averageRating.toFixed(1)}
        </Text>
        <View style={{ gap: theme.space[1] }}>
          <StarRating rating={summary.averageRating} size="sm" readonly />
          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.textSecondary,
            }}
          >
            {summary.totalCount} değerlendirme
          </Text>
        </View>
      </View>
      {[5, 4, 3, 2, 1].map((star) => {
        const count =
          summary.distribution.find((d) => d.star === star)?.count ?? 0;
        const pct =
          summary.totalCount > 0 ? (count / summary.totalCount) * 100 : 0;
        return (
          <View
            key={star}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.space[2],
            }}
          >
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.textSecondary,
                width: 10,
              }}
            >
              {star}
            </Text>
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.borderDefault,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  backgroundColor: theme.colors.warning,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.textSecondary,
                width: 24,
              }}
            >
              {count}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function ReviewSection({ entityType, entityId, style }: ReviewSectionProps) {
  const theme = useTheme();
  const token = useAuth((s) => s.token);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [writeOpen, setWriteOpen] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (cursor?: string | null) => {
      try {
        if (!cursor) setLoading(true);
        else setLoadingMore(true);
        const res = await getReviews(entityType, entityId, cursor);
        setReviews((prev) =>
          cursor ? [...prev, ...res.reviews] : res.reviews
        );
        setSummary(res.summary);
        setNextCursor(res.nextCursor);
        setUserReview(res.userReview);
      } catch {
        // sessiz
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityType, entityId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      Alert.alert("Giriş Gerekli", "Yorum yazmak için giriş yapmalısınız.");
      return;
    }
    setSubmitting(true);
    try {
      const review = await submitReview(entityType, entityId, {
        rating: newRating,
        comment: newComment.trim() || undefined,
      });
      setUserReview(review);
      setWriteOpen(false);
      setNewComment("");
      load();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === "NOT_ELIGIBLE") {
        Alert.alert(
          "Yorum Yapılamıyor",
          "Bu yer için yorum yapabilmek için önce sipariş vermiş veya ziyaret etmiş olmanız gerekiyor."
        );
      } else {
        Alert.alert(
          "Hata",
          e?.response?.data?.message ?? "Yorum gönderilemedi."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [token, entityType, entityId, newRating, newComment, load]);

  if (loading) {
    return (
      <View style={[{ padding: theme.space[4], alignItems: "center" }, style]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ gap: theme.space[3] }, style]}>
      <Text
        style={{
          ...theme.typography.headingMd,
          color: theme.colors.textPrimary,
        }}
      >
        Değerlendirmeler
      </Text>

      {summary && <SummaryBar summary={summary} />}

      {token && !userReview && !writeOpen && (
        <TouchableOpacity
          onPress={() => setWriteOpen(true)}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.lg,
            paddingVertical: theme.space[3],
            alignItems: "center",
          }}
        >
          <Text
            style={{
              ...theme.typography.labelLg,
              color: theme.colors.textInverse,
            }}
          >
            Yorum Yaz
          </Text>
        </TouchableOpacity>
      )}

      {writeOpen && (
        <View
          style={{
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.lg,
            padding: theme.space[4],
            gap: theme.space[3],
            borderWidth: 1,
            borderColor: theme.colors.borderDefault,
          }}
        >
          <Text
            style={{
              ...theme.typography.headingSm,
              color: theme.colors.textPrimary,
            }}
          >
            Değerlendirmeniz
          </Text>
          <StarRating value={newRating} onChange={setNewRating} size="lg" />
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Yorumunuzu yazın (opsiyonel)"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            style={{
              borderWidth: 1,
              borderColor: theme.colors.borderDefault,
              borderRadius: theme.radius.md,
              padding: theme.space[3],
              color: theme.colors.textPrimary,
              minHeight: 80,
              ...theme.typography.bodyMd,
            }}
          />
          <View style={{ flexDirection: "row", gap: theme.space[2] }}>
            <TouchableOpacity
              onPress={() => setWriteOpen(false)}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: theme.colors.borderDefault,
                borderRadius: theme.radius.md,
                paddingVertical: theme.space[2],
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  ...theme.typography.labelMd,
                  color: theme.colors.textSecondary,
                }}
              >
                İptal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.md,
                paddingVertical: theme.space[2],
                alignItems: "center",
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator
                  color={theme.colors.textInverse}
                  size="small"
                />
              ) : (
                <Text
                  style={{
                    ...theme.typography.labelMd,
                    color: theme.colors.textInverse,
                  }}
                >
                  Gönder
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {userReview && (
        <View>
          <Text
            style={{
              ...theme.typography.labelSm,
              color: theme.colors.textSecondary,
              marginBottom: theme.space[1],
            }}
          >
            Yorumunuz
          </Text>
          <ReviewCard review={userReview} />
        </View>
      )}

      {reviews
        .filter((r) => r._id !== userReview?._id)
        .map((review) => (
          <ReviewCard key={review._id} review={review} />
        ))}

      {summary?.totalCount === 0 && !userReview && (
        <Text
          style={{
            ...theme.typography.bodyMd,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}
        >
          Henüz yorum yok. İlk yorumu sen yaz!
        </Text>
      )}

      {nextCursor && (
        <TouchableOpacity
          onPress={() => load(nextCursor)}
          disabled={loadingMore}
          style={{ alignItems: "center", paddingVertical: theme.space[3] }}
        >
          {loadingMore ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Text
              style={{
                ...theme.typography.labelMd,
                color: theme.colors.primary,
              }}
            >
              Daha Fazla Göster
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

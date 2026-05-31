// rezzy-app/src/api/reviews.ts
import api from "./client";

export type ReviewEntityType = "restaurant" | "market" | "delivery" | "taxi_driver";

export type Review = {
  _id: string;
  entityType: ReviewEntityType;
  entityId: string;
  userId: string | { _id: string; name: string; avatar?: string | null };
  rating: number;
  comment?: string | null;
  verifiedPurchase: boolean;
  status: "visible" | "hidden" | "removed";
  createdAt: string;
};

export type ReviewSummary = {
  averageRating: number;
  totalCount: number;
  distribution: { star: 1 | 2 | 3 | 4 | 5; count: number }[];
};

export type ReviewsResponse = {
  reviews: Review[];
  summary: ReviewSummary;
  nextCursor: string | null;
  userReview: Review | null;
};

export async function getReviews(
  entityType: ReviewEntityType,
  entityId: string,
  cursor?: string | null,
): Promise<ReviewsResponse> {
  const params: Record<string, any> = { limit: 20 };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get<ReviewsResponse>(
    `/reviews/${entityType}/${entityId}`,
    { params },
  );
  return data;
}

export async function submitReview(
  entityType: ReviewEntityType,
  entityId: string,
  payload: { rating: number; comment?: string },
): Promise<Review> {
  const { data } = await api.post<Review>(
    `/reviews/${entityType}/${entityId}`,
    payload,
  );
  return data;
}

// Geriye dönük uyumluluk — RestaurantDetailScreen
export async function getRestaurantReviews(restaurantId: string): Promise<ReviewsResponse> {
  return getReviews("restaurant", restaurantId);
}

import api from "./client";

export type BannerTargetType = "delivery" | "reservation";

export type BannerItem = {
  _id: string;
  title?: string | null;
  imageUrl: string;
  linkUrl?: string | null;

  placement: string;
  region?: string | null;
  order?: number;

  targetType: BannerTargetType;
  restaurantId: string;
};

export async function listActiveBanners(input?: {
  placement?: string;
  region?: string | null;
}): Promise<BannerItem[]> {
  const placement = input?.placement ?? "home_top";
  const region = input?.region ?? null;

  const { data } = await api.get("/banners", {
    params: {
      placement,
      // backend query param ile çalışıyor; header’dan gelene güvenmeyelim
      ...(region ? { region } : {}),
    },
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  return items as BannerItem[];
}
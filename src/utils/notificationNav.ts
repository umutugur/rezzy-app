// src/utils/notificationNav.ts
import {
  CommonActions,
  NavigationContainerRefWithCurrent,
} from "@react-navigation/native";

type AnyNav =
  | NavigationContainerRefWithCurrent<any>
  | {
      navigate: (name: string, params?: any) => void;
      dispatch: (action: any) => void;
      getRootState?: () => { routeNames: string[] };
      getState?: () => { routeNames: string[] };
      isReady?: () => boolean;
    };

// --- küçük yardımcılar ---
const has = (nav: AnyNav, name: string) => {
  const root = nav?.getRootState?.() ?? nav?.getState?.();
  return !!root?.routeNames?.includes?.(name);
};

const toStr = (v: any) => (v == null ? "" : String(v));
const lower = (v: any) => toStr(v).toLowerCase();

/** url/deeplink içinden tip & id yakalamaya çalış */
function parseLink(raw?: string) {
  const s = toStr(raw);
  if (!s) return {};
  // ör: rezzy://reservation/ID veya /reservation/ID
  const m1 = s.match(/(?:^|\/)(reservation|booking|rezervasyon)\/([A-Za-z0-9_-]+)/i);
  if (m1) return { type: "reservation", id: m1[2] };
  const m2 = s.match(/(?:^|\/)(restaurant|restoran)\/([A-Za-z0-9_-]+)/i);
  if (m2) return { type: "restaurant", id: m2[2] };
  return {};
}

/** server payload’ını tek biçime indir */
function normalize(data: any) {
  const dl =
    parseLink(data?.url) ||
    parseLink(data?.deepLink) ||
    parseLink(data?.link);

  // tip tahmini
  let type =
    lower(data?.type) ||
    (dl as any)?.type ||
    (data?.action && lower(data.action).includes("reservation") ? "reservation" : "") ||
    (data?.action && lower(data.action).includes("restaurant") ? "restaurant" : "") ||
    "";

  // id toplamaya çalış
  const reservationId =
    toStr(data?.reservationId) ||
    toStr(data?.rezervationId) || // olası yazım yanlışı
    toStr(data?.bookingId) ||
    (type === "reservation" ? toStr(data?.id) : "") ||
    toStr((dl as any)?.id);

  const restaurantId =
    toStr(data?.restaurantId) ||
    toStr(data?.rid) ||
    (type === "restaurant" ? toStr(data?.id) : "") ||
    toStr((dl as any)?.id);

  // eğer id’lerden biri geldiyse type’ı ona göre zorla
  if (!type) {
    if (reservationId) type = "reservation";
    else if (restaurantId) type = "restaurant";
  }

  // explicit hedef anahtarları
  const screen = toStr(data?.screen || data?.route);
  const tab = toStr(data?.tab);

  return { type, reservationId, restaurantId, screen, tab };
}

export function navigateFromNotification(navRef: AnyNav, rawData: any) {
  // isReady varsa kontrol et
  if (typeof navRef?.isReady === "function" && !navRef.isReady()) return;

  const { type, reservationId, restaurantId, screen, tab } = normalize(rawData);

  const go = navRef as unknown as {
    navigate: (name: string, params?: any) => void;
    dispatch: (action: any) => void;
  };

  // 1) Bildirim explicit bir screen istiyorsa önce onu dene
  if (screen) {
    // Rezervasyon detay
    if (/rezervasyon( )?detay/i.test(screen) && reservationId) {
      go.navigate("Rezervasyon Detayı", { id: reservationId });
      return;
    }
    // Restoran detay
    if (/restoran/i.test(screen) && restaurantId) {
      go.navigate("Restoran", { id: restaurantId });
      return;
    }
    // Genel bir screen adı verilmişse doğrudan dene
    go.navigate(screen);
    return;
  }

  // 2) Tip + id ile yönlendir
  if (type === "reservation" && reservationId) {
    go.navigate("Rezervasyon Detayı", { id: reservationId });
    return;
  }
  if (type === "restaurant" && restaurantId) {
    go.navigate("Restoran", { id: restaurantId });
    return;
  }

  // 3) Tab hedefi verilmişse onu dene
  if (tab) {
    if (has(navRef, "Tabs")) {
      go.navigate("Tabs", { screen: tab });
      return;
    }
    if (has(navRef, "TabsGuest")) {
      go.navigate("TabsGuest", { screen: tab });
      return;
    }
    go.navigate(tab);
    return;
  }

  // 4) Varsayılan: Rezervasyonlar tabı
  if (has(navRef, "Tabs")) {
    go.navigate("Tabs", { screen: "Rezervasyonlar" });
    return;
  }
  if (has(navRef, "TabsGuest")) {
    go.navigate("TabsGuest", { screen: "Rezervasyonlar" });
    return;
  }
  if (has(navRef, "Rezervasyonlar")) {
    go.navigate("Rezervasyonlar");
    return;
  }

  // 5) Son çare: common action
  go.dispatch(
    CommonActions.navigate({
      name: has(navRef, "Tabs") ? "Tabs" : has(navRef, "TabsGuest") ? "TabsGuest" : "Rezervasyonlar",
      params: has(navRef, "Tabs") || has(navRef, "TabsGuest") ? { screen: "Rezervasyonlar" } : undefined,
    })
  );
}
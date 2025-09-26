import { NavigationContainerRefWithCurrent } from "@react-navigation/native";

type NavRef = NavigationContainerRefWithCurrent<any>;

// Sunucunun push `data` payload formatı değişebilir.
// Beklenen alanlar: { type: 'reservation'|'restaurant'|..., id?: string, restaurantId?: string, reservationId?: string }
export function navigateFromNotification(navRef: NavRef, data: any) {
  const t = String(data?.type || "").toLowerCase();
  const rid = String(data?.restaurantId || data?.id || "");
  const rezId = String(data?.reservationId || data?.id || "");

  if (t === "reservation" && rezId) {
    navRef.navigate("Rezervasyon Detayı" as never, { id: rezId } as never);
    return;
  }
  if ((t === "restaurant" || t === "restoran") && rid) {
    navRef.navigate("Restoran" as never, { id: rid } as never);
    return;
  }

  // Varsayılan: Rezervasyonlar tabına at
  navRef.navigate("Tabs" as never);
  navRef.navigate("Rezervasyonlar" as never);
}

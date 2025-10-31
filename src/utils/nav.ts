// src/utils/nav.ts
export function goToReservations(navigation: any) {
  const state = navigation.getState?.();
  const names: string[] = state?.routeNames ?? [];

  if (names.includes("Tabs")) {
    navigation.navigate("Tabs", { screen: "Rezervasyonlar" });
    return;
  }
  if (names.includes("TabsGuest")) {
    navigation.navigate("TabsGuest", { screen: "Rezervasyonlar" });
    return;
  }
  // fallback: direkt ada sahipsen (genelde gerekmez)
  navigation.navigate("Rezervasyonlar");
}

export function goToReservationDetail(navigation: any, id: string) {
  // Detay, Stack seviyesinde tanımlı: doğrudan gidebilir
  navigation.navigate("Rezervasyon Detayı", { id });
}
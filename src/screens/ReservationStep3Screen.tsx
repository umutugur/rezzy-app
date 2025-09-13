import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { useReservation } from "../store/useReservation";
import { getRestaurant, type Restaurant as ApiRestaurant } from "../api/restaurants";

dayjs.locale("tr");

type FixMenu = { _id?: string; title: string; description?: string; pricePerPerson: number; isActive?: boolean };
type ExtendedRestaurant = ApiRestaurant & {
  iban?: string; ibanName?: string; bankName?: string;
  priceRange?: string; description?: string; menus?: FixMenu[];
};

export default function ReservationStep3Screen({ route }: any) {
  const res = useReservation((s: any) => ({
    restaurantId: s.restaurant,
    dateTime: s.dateTime,
    party: s.party,
    menu: s.menu,
  }));

  const restaurantId: string = String(route?.params?.restaurantId ?? res.restaurantId ?? "");
  const dateTime: string = String(route?.params?.dateTime ?? res.dateTime ?? "");
  const partySize: number = Number(route?.params?.party ?? res.party ?? 2);

  const [restaurant, setRestaurant] = useState<ExtendedRestaurant | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const data = (await getRestaurant(restaurantId)) as ExtendedRestaurant;
      setRestaurant(data);
    })();
  }, [restaurantId]);

  const dateTimeLabel = dateTime ? dayjs(dateTime).format("DD MMM, HH:mm") : "";

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontWeight: "700", marginBottom: 8 }}>Rezervasyon Özeti</Text>
      <Text>{restaurant?.name ?? "Restoran"}</Text>
      {!!dateTimeLabel && <Text>{dateTimeLabel}</Text>}
      <Text>Kişi: {partySize}</Text>
      {!!restaurant?.bankName && <Text>Banka: {restaurant.bankName}</Text>}
      {!!restaurant?.ibanName && !!restaurant?.iban && (
        <Text>IBAN: {restaurant.ibanName} • {restaurant.iban}</Text>
      )}
    </View>
  );
}

import React from "react";
import { View, Image, ScrollView } from "react-native";
import { Screen, Text } from "../components/Themed";
import Button from "../components/Button";
import { getRestaurant } from "../api/restaurants";
import { useReservation } from "../store/useReservation";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function RestaurantDetailScreen(){
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id } = route.params;
  const [data, setData] = React.useState<any>(null);
  const setRestaurant = useReservation(s=>s.setRestaurant);

  React.useEffect(()=>{
    getRestaurant(id).then(setData);
  }, [id]);

  if (!data) return <Screen><Text>Yükleniyor…</Text></Screen>;

  return (
    <Screen>
      {data.photos?.length ? <Image source={{ uri: data.photos[0] }} style={{ width:"100%", height: 200, borderRadius: 12 }} /> : null}
      <Text style={{ fontSize:22, fontWeight:"700", marginTop: 12 }}>{data.name}</Text>
      <Text secondary>{data.city} • {data.priceRange}</Text>
      <Text secondary style={{ marginVertical: 8 }}>{data.description}</Text>

      <Text style={{ fontWeight:"700", marginTop: 12, marginBottom: 8 }}>Fix Menüler</Text>
      <ScrollView style={{ maxHeight: 180 }}>
        {data.menus?.map((m:any)=>(
          <View key={m._id} style={{ borderWidth:1, borderColor:"#eee", borderRadius:12, padding:12, marginBottom: 8 }}>
            <Text>{m.title} — ₺{m.pricePerPerson}</Text>
            {m.description ? <Text secondary>{m.description}</Text> : null}
          </View>
        ))}
      </ScrollView>

      <Button title="Rezervasyon Yap" onPress={()=>{ setRestaurant(id); nav.navigate("Rezervasyon - Tarih", { restaurant: data }); }} />
    </Screen>
  );
}

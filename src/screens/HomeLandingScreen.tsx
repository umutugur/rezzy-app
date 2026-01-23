import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import Card from "../components/Card";
import { listRestaurants, type Restaurant } from "../api/restaurants";
import { useRegion } from "../store/useRegion";
import { useShallow } from "zustand/react/shallow";

type Preset = {
  businessType?: string | null;
  deliveryOnly?: boolean;
  mustServeSelectedAddress?: boolean;
};

const BUSINESS_TYPE_MAP: Record<
  "bar" | "cafe" | "meyhane" | "restaurant" | "coffee" | "more",
  string | null
> = {
  bar: "bar",
  cafe: "cafe",
  meyhane: "meyhane",
  restaurant: "restaurant",
  coffee: "coffee_shop",
  more: null,
};

export default function HomeLandingScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const { region, regionHydrated } = useRegion(
    useShallow((s: any) => ({
      region: s.region,
      regionHydrated: s.hydrated === true,
    }))
  );

  const [featured, setFeatured] = React.useState<Restaurant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openExplore = (preset?: Preset) => {
    nav.navigate("KeşfetListe", { preset: preset || {} });
  };

  React.useEffect(() => {
    if (!regionHydrated) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await listRestaurants({ region, limit: 10 });
        if (!alive) return;
        setFeatured(Array.isArray(list) ? list : []);
      } catch (e: any) {
        if (!alive) return;
        const raw = e?.response?.data;
        const msg = raw?.message || e?.message || "Bir hata oluştu";
        setError(msg);
        setFeatured([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [regionHydrated, region]);

  const renderFeatured = ({ item, index }: { item: Restaurant; index: number }) => {
    const isRight = index % 2 === 1;
    return (
      <View style={[styles.featuredItem, isRight && styles.featuredItemRight]}>
        <Card
          photo={item.photos?.[0]}
          title={item.name}
          subtitle={[item.city, item.priceRange || "₺₺"].filter(Boolean).join(" • ")}
          onPress={() => nav.navigate("Restoran", { id: item._id })}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bannerCard}>
          <Image
            source={require("../assets/firsat-carki.png")}
            style={styles.bannerImg}
            resizeMode="cover"
          />
        </View>

       <Pressable
  style={styles.deliveryBtn}
  onPress={() => nav.navigate("Delivery")}
>
          <View style={styles.deliveryIconWrap}>
            <Ionicons name="bag-handle-outline" size={22} color="#F2C14E" />
          </View>
          <Text style={styles.deliveryText}>Paket Servis</Text>
        </Pressable>

        <View style={styles.grid}>
          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.bar })}
          >
            <Ionicons name="wine-outline" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Bar</Text>
          </Pressable>

          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.cafe })}
          >
            <Ionicons name="cafe-outline" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Kafe</Text>
          </Pressable>

          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.meyhane })}
          >
            <Ionicons name="beer-outline" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Meyhane</Text>
          </Pressable>

          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.restaurant })}
          >
            <Ionicons name="restaurant-outline" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Restoran</Text>
          </Pressable>

          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.coffee })}
          >
            <Ionicons name="cafe-outline" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Coffee Shop</Text>
          </Pressable>

          <Pressable
            style={styles.gridItem}
            onPress={() => openExplore({ businessType: BUSINESS_TYPE_MAP.more })}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color="#7A1E1E" />
            <Text style={styles.gridLabel}>Daha Fazla</Text>
          </Pressable>
        </View>

        <Pressable style={styles.exploreBtn} onPress={() => openExplore({})}>
          <Text style={styles.exploreTitle}>Keşfet</Text>
          <Ionicons name="chevron-forward" size={20} color="#7A1E1E" />
        </Pressable>

        {loading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <Text style={{ color: "#991B1B", fontWeight: "700" }}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={featured}
            keyExtractor={(i) => String(i._id)}
            renderItem={renderFeatured}
            numColumns={2}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10,
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { paddingBottom: 120, flexGrow: 1 },

  bannerCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#EEE",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bannerImg: { width: "100%", height: 170 },

  deliveryBtn: {
    marginTop: 14,
    marginHorizontal: 16,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#7A1E1E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  deliveryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deliveryText: { color: "#fff", fontSize: 20, fontWeight: "800" },

  grid: {
    marginTop: 14,
    marginHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridItem: {
    width: "31.5%", // 3'lü görünüm
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 12,
  },
  gridLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#2A2A2A",
    textAlign: "center",
  },

  exploreBtn: {
    marginTop: 18,
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EFEFEF",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  exploreTitle: { fontSize: 22, fontWeight: "900", color: "#1E1E1E" },

  featuredItem: {
    flex: 1,
    marginBottom: 12,
  },
  featuredItemRight: {
    marginLeft: 12,
  },
});
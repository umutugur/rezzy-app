import { api } from "./client";
export type Restaurant = { _id:string; name:string; city?:string; priceRange?:string; rating?:number; photos?:string[]; description?:string; };
export async function listRestaurants(city?: string) {
  const { data } = await api.get<Restaurant[]>("/restaurants", {
    params: city ? { city } : {},
  });
  return data;
}
export async function getRestaurant(id:string){
  const { data } = await api.get(`/restaurants/${id}`);
  return data;
}


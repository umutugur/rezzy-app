// src/api/addresses.ts
import api from "./client";

export type UserAddress = {
  _id: string;
  userId?: string;
  title?: string;
  fullAddress: string;
  googleMapsUrl?: string | null;
  placeId?: string | null;
  note?: string;
  isDefault?: boolean;
  isActive?: boolean;
  location?: { type: "Point"; coordinates: [number, number] };
  createdAt?: string;
  updatedAt?: string;
};

export async function listMyAddresses(): Promise<UserAddress[]> {
  const res = await api.get("/addresses");
  const items = res.data?.items;
  return Array.isArray(items) ? (items as UserAddress[]) : [];
}

export async function createAddress(input: {
  title?: string;
  fullAddress: string;
  note?: string;
  makeDefault?: boolean;
  location: { coordinates: [number, number] }; // [lng,lat]
  googleMapsUrl?: string | null;
  placeId?: string | null;
}): Promise<UserAddress> {
  const res = await api.post("/addresses", input);
  const item = res.data?.item;
  if (!item?._id) throw new Error("Adres oluşturulamadı.");
  return item as UserAddress;
}

export async function makeDefaultAddress(id: string): Promise<UserAddress> {
  const res = await api.post(`/addresses/${id}/make-default`);
  const item = res.data?.item;
  if (!item?._id) throw new Error("Varsayılan adres ayarlanamadı.");
  return item as UserAddress;
}

export async function updateAddress(id: string, patch: any): Promise<UserAddress> {
  const res = await api.put(`/addresses/${id}`, patch);
  const item = res.data?.item;
  if (!item?._id) throw new Error("Adres güncellenemedi.");
  return item as UserAddress;
}

export async function deleteAddress(id: string): Promise<boolean> {
  const res = await api.delete(`/addresses/${id}`);
  return !!res.data?.ok;
}
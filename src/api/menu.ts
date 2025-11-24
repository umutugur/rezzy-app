// src/api/menu.ts
import { api } from "./client";

export type MenuCategory = {
  _id: string;
  title: string;
  description?: string;
  order: number;
  isActive: boolean;
};

export type MenuItem = {
  _id: string;
  categoryId: string;
  title: string;
  description?: string;
  price: number;
  photoUrl?: string;
  tags: string[];
  order: number;
  isActive: boolean;
  isAvailable: boolean;
};

export async function rpListCategories(rid: string): Promise<MenuCategory[]> {
  const { data } = await api.get(`/panel/restaurants/${rid}/menu/categories`);
  return (data?.items ?? data ?? []) as MenuCategory[];
}

export async function rpCreateCategory(
  rid: string,
  input: { title: string; description?: string; order?: number }
) {
  const { data } = await api.post(
    `/panel/restaurants/${rid}/menu/categories`,
    input
  );
  return data;
}

export async function rpUpdateCategory(
  rid: string,
  cid: string,
  input: Partial<Pick<MenuCategory, "title" | "description" | "order" | "isActive">>
) {
  const { data } = await api.patch(
    `/panel/restaurants/${rid}/menu/categories/${cid}`,
    input
  );
  return data;
}

export async function rpDeleteCategory(rid: string, cid: string) {
  const { data } = await api.delete(
    `/panel/restaurants/${rid}/menu/categories/${cid}`
  );
  return data;
}

export async function rpListItems(
  rid: string,
  params?: { categoryId?: string }
): Promise<MenuItem[]> {
  const { data } = await api.get(
    `/panel/restaurants/${rid}/menu/items`,
    { params }
  );
  return (data?.items ?? data ?? []) as MenuItem[];
}

export async function rpCreateItem(
  rid: string,
  input: {
    categoryId: string;
    title: string;
    description?: string;
    price: number;
    tags?: string[];
    order?: number;
    isAvailable?: boolean;
    // mobil: fotoğraf opsiyonel
    photoUri?: string | null;
    photoName?: string | null;
    photoType?: string | null;
  }
) {
  const fd = new FormData();
  fd.append("categoryId", input.categoryId);
  fd.append("title", input.title);
  fd.append("description", input.description ?? "");
  fd.append("price", String(input.price));
  fd.append("order", String(input.order ?? 0));
  fd.append("isAvailable", String(input.isAvailable ?? true));
  (input.tags ?? []).forEach((t) => t && fd.append("tags", t));

  if (input.photoUri && input.photoName && input.photoType) {
    fd.append("photo", {
      uri: input.photoUri,
      name: input.photoName,
      type: input.photoType,
    } as any);
  }

  const { data } = await api.post(
    `/panel/restaurants/${rid}/menu/items`,
    fd
  );
  return data;
}

export async function rpUpdateItem(
  rid: string,
  iid: string,
  input: {
    categoryId?: string;
    title?: string;
    description?: string;
    price?: number;
    tags?: string[];
    order?: number;
    isAvailable?: boolean;
    isActive?: boolean;
    removePhoto?: boolean;

    photoUri?: string | null;
    photoName?: string | null;
    photoType?: string | null;
  }
) {
  const fd = new FormData();
  if (input.categoryId) fd.append("categoryId", input.categoryId);
  if (input.title != null) fd.append("title", input.title);
  if (input.description != null) fd.append("description", input.description);
  if (input.price != null) fd.append("price", String(input.price));
  if (input.order != null) fd.append("order", String(input.order));
  if (input.isAvailable != null) fd.append("isAvailable", String(input.isAvailable));
  if (input.isActive != null) fd.append("isActive", String(input.isActive));
  if (input.removePhoto != null) fd.append("removePhoto", String(input.removePhoto));
  (input.tags ?? []).forEach((t) => t && fd.append("tags", t));

  if (input.photoUri && input.photoName && input.photoType) {
    fd.append("photo", {
      uri: input.photoUri,
      name: input.photoName,
      type: input.photoType,
    } as any);
  }

  const { data } = await api.patch(
    `/panel/restaurants/${rid}/menu/items/${iid}`,
    fd
  );
  return data;
}

export async function rpDeleteItem(rid: string, iid: string) {
  const { data } = await api.delete(
    `/panel/restaurants/${rid}/menu/items/${iid}`
  );
  return data;
}
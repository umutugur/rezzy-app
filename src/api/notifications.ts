import { api } from "./client";

export async function getUnreadCount() {
  const { data } = await api.get("/notifications/unread-count");
  return Number(data?.count || 0);
}

export async function listNotifications() {
  const { data } = await api.get("/notifications/list");
  return Array.isArray(data?.items) ? data.items : [];
}

export async function markRead(id: string) {
  await api.post("/notifications/mark-read", { id });
}

export async function markAllRead() {
  await api.post("/notifications/mark-all-read");
}

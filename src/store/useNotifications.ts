import { create } from "zustand";
import { api } from "../api/client";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  data?: any;
  read?: boolean;
  ts?: number;
};

type State = {
  items: AppNotification[];
  unreadCount: number;
  latest?: AppNotification | null;

  addFromPush: (n: AppNotification) => void;
  clearLatest: () => void;

  markAllReadLocal: () => void;
  fetchUnreadCount: () => Promise<void>;

  // opsiyonel server API’leri — varsa çalışır, yoksa sessiz geçer
  markReadRemote?: (id: string) => Promise<void>;
  markAllReadRemote?: () => Promise<void>;
  fetchListRemote?: () => Promise<void>;
};

export const useNotifications = create<State>((set, get) => ({
  items: [],
  unreadCount: 0,
  latest: null,

  addFromPush: (n) => {
    const item: AppNotification = {
      ...n,
      read: false,
      ts: n.ts ?? Date.now(),
    };
    set((s) => ({
      items: [item, ...s.items].slice(0, 50),
      unreadCount: s.unreadCount + 1,
      latest: item,
    }));
  },

  clearLatest: () => set({ latest: null }),

  markAllReadLocal: () =>
    set((s) => ({
      items: s.items.map((x) => ({ ...x, read: true })),
      unreadCount: 0,
      latest: null,
    })),

  fetchUnreadCount: async () => {
    try {
      // Sunucuda varsa:
      const { data } = await api.get("/notifications/unread-count");
      if (typeof data?.count === "number") {
        set({ unreadCount: data.count });
      }
    } catch {
      // uç yoksa sessiz
    }
  },

  // Opsiyonel — mevcutsa kullanın
  markReadRemote: async (id: string) => {
    try {
      await api.post("/notifications/mark-read", { id });
      set((s) => ({
        items: s.items.map((x) => (x.id === id ? { ...x, read: true } : x)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {}
  },

  markAllReadRemote: async () => {
    try {
      await api.post("/notifications/mark-all-read");
      get().markAllReadLocal();
    } catch {
      get().markAllReadLocal();
    }
  },

  fetchListRemote: async () => {
    try {
      const { data } = await api.get("/notifications/list");
      if (Array.isArray(data?.items)) {
        const items: AppNotification[] = data.items.map((d: any) => ({
          id: String(d.id || d._id || d.key || d.ts || Math.random()),
          title: d.title || "Bildirim",
          body: d.body || "",
          data: d.data || {},
          read: !!d.read,
          ts: d.ts ? +new Date(d.ts) : Date.now(),
        }));
        const unread = items.filter((x) => !x.read).length;
        set({ items, unreadCount: unread });
      }
    } catch {}
  },
}));

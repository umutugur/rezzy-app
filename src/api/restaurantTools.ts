// src/api/restaurantTools.ts
import { api } from "./client";

type QrPayload = { rid: string; mid: string; ts: string; sig: string };

function parseQrPayload(raw: string | Record<string, any>): QrPayload {
  // Zaten obje geldiyse:
  if (raw && typeof raw === "object") {
    const rid = String((raw as any).rid ?? "");
    const mid = String((raw as any).mid ?? "");
    const ts  = String((raw as any).ts  ?? "");
    const sig = String((raw as any).sig ?? "");
    return { rid, mid, ts, sig };
  }

  const text = String(raw || "").trim();

  // 1) URL formatı: rezzy://checkin?rid=...&mid=...&ts=...&sig=...
  try {
    const u = new URL(text);
    const rid = u.searchParams.get("rid") || "";
    const mid = u.searchParams.get("mid") || "";
    const ts  = u.searchParams.get("ts")  || "";
    const sig = u.searchParams.get("sig") || "";
    if (rid && mid && ts && sig) return { rid, mid, ts, sig };
  } catch { /* URL değil */ }

  // 2) JSON formatı
  try {
    const j = JSON.parse(text);
    const rid = String(j?.rid ?? "");
    const mid = String(j?.mid ?? "");
    const ts  = String(j?.ts  ?? "");
    const sig = String(j?.sig ?? "");
    if (rid && mid && ts && sig) return { rid, mid, ts, sig };
  } catch { /* JSON değil */ }

  // 3) Querystring
  const parts = Object.fromEntries(
    text.split("&").map(p => {
      const [k, v] = p.split("=");
      return [decodeURIComponent(k || ""), decodeURIComponent(v || "")];
    })
  );
  const rid = String(parts["rid"] ?? "");
  const mid = String(parts["mid"] ?? "");
  const ts  = String(parts["ts"]  ?? "");
  const sig = String(parts["sig"] ?? "");
  if (rid && mid && ts && sig) return { rid, mid, ts, sig };

  throw new Error("QR verisi beklenen formatta değil (rid/mid/ts/sig yok).");
}

/** ✅ QR ile check-in — arrivedCount ZORUNLU (backend validator: required) */
export async function checkinByQR(
  scanned: string | Record<string, any>,
  arrivedCount: number
) {
  if (arrivedCount == null || Number.isNaN(Number(arrivedCount))) {
    throw new Error("arrivedCount gerekli ve sayı olmalı.");
  }
  const { rid, mid, ts, sig } = parseQrPayload(scanned);
  const body = { rid, mid, ts, sig, arrivedCount: Number(arrivedCount) };
  const { data } = await api.post("/reservations/checkin", body);
  return data as { ok: boolean; arrivedCount: number; lateMinutes: number; underattended?: boolean };
}

/** ✅ Manuel check-in — arrivedCount opsiyonel (backend’de validation yok) */
export async function checkinManual(rid: string, arrivedCount?: number) {
  const payload: any = {};
  if (arrivedCount != null) payload.arrivedCount = Number(arrivedCount);
  const { data } = await api.post(`/reservations/${rid}/checkin-manual`, payload);
  return data as { ok: boolean; arrivedCount: number; lateMinutes: number; underattended?: boolean };
}

/** ✅ Check-in sonrası gelen kişi sayısını düzelt (number gönder) */
export async function updateArrivedCount(rid: string, arrivedCount: number) {
  const { data } = await api.patch(`/reservations/${rid}/arrived-count`, {
    arrivedCount: Number(arrivedCount),
  });
  return data as { ok: boolean; arrivedCount: number; underattended?: boolean };
}

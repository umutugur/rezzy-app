// src/api/restaurantTools.ts
import { api } from "./client";

type QrPayload = { rid: string; mid: string; ts: string; sig: string };

function parseQrPayload(raw: string | Record<string, any>): QrPayload {
  // Zaten obje geldiyse:
  if (raw && typeof raw === "object") {
    const rid = String(raw.rid ?? "");
    const mid = String(raw.mid ?? "");
    const ts  = String(raw.ts  ?? "");
    const sig = String(raw.sig ?? "");
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

/** ✅ QR ile check-in — arrivedCount varsa backend’e gönderilir */
export async function checkinByQR(
  scanned: string | Record<string, any>,
  arrivedCount?: number
) {
  const { rid, mid, ts, sig } = parseQrPayload(scanned);
  const body: any = { rid, mid, ts, sig };
  if (arrivedCount != null) body.arrivedCount = String(arrivedCount);
  const { data } = await api.post("/reservations/checkin", body);
  return data; // { ok:true, arrivedCount, lateMinutes }
}

/** ✅ Manuel check-in — arrivedCount opsiyonel */
export async function checkinManual(rid: string, arrivedCount?: number) {
  const { data } = await api.post(`/reservations/${rid}/checkin-manual`, {
    arrivedCount: arrivedCount != null ? String(arrivedCount) : undefined,
  });
  return data; // { ok:true, arrivedCount, lateMinutes }
}

/** ✅ Check-in sonrası gelen kişi sayısını düzelt */
export async function updateArrivedCount(rid: string, arrivedCount: number) {
  const { data } = await api.patch(`/reservations/${rid}/arrived-count`, {
    arrivedCount: String(arrivedCount),
  });
  return data; // { ok:true, arrivedCount, ... }
}

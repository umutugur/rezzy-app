import { api } from "./client";

type QrPayload = { rid: string; mid: string; ts: string; sig: string };

function decodeField(val: any): string {
  const str = String(val ?? "");
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Normalize and decode a QR payload into its constituent parts.
 * Supports URL (rezzy://checkin?rid=...&mid=...&ts=...&sig=...),
 * JSON string, slash-separated (rid/mid/ts/sig) and querystring formats.
 */
function parseQrPayload(raw: string | Record<string, any>): QrPayload {
  // Obje olarak geldiyse alanları decode et
  if (raw && typeof raw === "object") {
    const rid = decodeField((raw as any).rid);
    const mid = decodeField((raw as any).mid);
    const ts  = decodeField((raw as any).ts);
    const sig = decodeField((raw as any).sig);
    return { rid, mid, ts, sig };
  }

  const text = String(raw || "").trim();

  // rezzy:// URL formatı
  try {
    const u = new URL(text);
    const rid = decodeField(u.searchParams.get("rid"));
    const mid = decodeField(u.searchParams.get("mid"));
    const ts  = decodeField(u.searchParams.get("ts"));
    const sig = decodeField(u.searchParams.get("sig"));
    if (rid && mid && ts && sig) return { rid, mid, ts, sig };
  } catch {
    // URL değil
  }

  // JSON formatı
  try {
    const j = JSON.parse(text);
    const rid = decodeField(j?.rid);
    const mid = decodeField(j?.mid);
    const ts  = decodeField(j?.ts);
    const sig = decodeField(j?.sig);
    if (rid && mid && ts && sig) return { rid, mid, ts, sig };
  } catch {
    // JSON değil
  }

  // Slash ile ayrılmış format: rid/mid/ts/sig
  const slashParts = text.split("/");
  if (slashParts.length >= 4) {
    const [ridRaw, midRaw, tsRaw, sigRaw] = slashParts;
    const rid = decodeField(ridRaw);
    const mid = decodeField(midRaw);
    const ts  = decodeField(tsRaw);
    const sig = decodeField(sigRaw);
    if (rid && mid && ts && sig) {
      return { rid, mid, ts, sig };
    }
  }

  // Querystring formatı: rid=...&mid=...&ts=...&sig=...
  const params: Record<string, string> = {};
  text.split("&").forEach((pair) => {
    const [k, v] = pair.split("=");
    if (!k) return;
    params[decodeField(k)] = decodeField(v);
  });
  const rid = decodeField(params["rid"]);
  const mid = decodeField(params["mid"]);
  const ts  = decodeField(params["ts"]);
  const sig = decodeField(params["sig"]);
  if (rid && mid && ts && sig) return { rid, mid, ts, sig };

  throw new Error("QR verisi beklenen formatta değil (rid/mid/ts/sig yok).");
}

/**
 * ✅ QR ile check-in. arrivedCount parametresi isteğe bağlıdır; gönderilmezse
 * backend rezervasyonun partySize değerini kullanır.
 */
export async function checkinByQR(
  scanned: string | Record<string, any>,
  arrivedCount?: number
) {
  const { rid, mid, ts, sig } = parseQrPayload(scanned);
  const body: any = { rid, mid, ts, sig };
  if (arrivedCount != null && !Number.isNaN(Number(arrivedCount))) {
    body.arrivedCount = Number(arrivedCount);
  }
  const { data } = await api.post("/reservations/checkin", body);
  return data as {
    ok: boolean;
    arrivedCount: number;
    lateMinutes: number;
    underattended?: boolean;
  };
}

/**
 * ✅ Manuel check-in — arrivedCount opsiyonel (backend’de validation yok)
 */
export async function checkinManual(rid: string, arrivedCount?: number) {
  const payload: any = {};
  if (arrivedCount != null) payload.arrivedCount = Number(arrivedCount);
  const { data } = await api.post(`/reservations/${rid}/checkin-manual`, payload);
  return data as {
    ok: boolean;
    arrivedCount: number;
    lateMinutes: number;
    underattended?: boolean;
  };
}

/**
 * ✅ Check-in sonrası gelen kişi sayısını düzelt (sayı gönder)
 */
export async function updateArrivedCount(rid: string, arrivedCount: number) {
  const { data } = await api.patch(`/reservations/${rid}/arrived-count`, {
    arrivedCount: Number(arrivedCount),
  });
  return data as {
    ok: boolean;
    arrivedCount: number;
    underattended?: boolean;
  };
}

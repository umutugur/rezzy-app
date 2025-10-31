// src/utils/maps.ts
import { Linking } from "react-native";

/** Varsa doğrudan URL'yi döndürür, yoksa lat/lng ile bir arama linki üretir */
export function buildMapsUrl(opts: { googleMapsUrl?: string; lat?: number; lng?: number }) {
  const u = String(opts.googleMapsUrl || "").trim();
  if (u) return u; // Kayıtlı URL varsa onu kullan
  const { lat, lng } = opts;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return "";
}

export async function openInMaps(url: string) {
  if (!url) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {}
}

/** Google Maps linklerinden lat/lng çıkarmaya çalışır. Bulamazsa null döner. */
export function tryExtractLatLngFromMapsUrl(input?: string | null): { lat: number; lng: number } | null {
  if (!input) return null;
  const u = String(input).trim();
  if (!u) return null;

  // 1) "@lat,lng," paterni: .../@38.4189,27.1287,15z
  let m = u.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:,|$)/);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }

  // 2) "!3dlat!4dlng" paterni: ...!3d38.4189!4d27.1287
  m = u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }

  // 3) query=lat,lng
  m = u.match(/[?&]q=([-?\d.]+),\s*([-?\d.]+)/i) || u.match(/[?&]query=([-?\d.]+),\s*([-?\d.]+)/i);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }

  // 4) saf "https://.../maps/place/38.4189,27.1287" gibi
  m = u.match(/\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)(?:[/?#]|$)/);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }

  return null;
}
// src/hooks/useReservationDetail.ts
import * as React from "react";
import { getReservation, ReservationDto } from "../api/reservations";

export function useReservationDetail(rid: string, intervalMs = 5000) {
  const [data, setData] = React.useState<ReservationDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchOnce = React.useCallback(async () => {
    try {
      const d = await getReservation(rid);
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [rid]);

  React.useEffect(() => {
    fetchOnce();
    const t = setInterval(fetchOnce, intervalMs);
    return () => clearInterval(t);
  }, [fetchOnce, intervalMs]);

  return { data, loading, error, refetch: fetchOnce, setData };
}

// src/utils/format.ts
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(); // istersen TR locale sabitle: toLocaleString("tr-TR")
};
export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}
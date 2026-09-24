/** Wiedergabezeit als M:SS (abgerundet, nicht negativ). */
export function formatPlaybackTime(seconds: number): string {
  const total = Math.max(Math.round(seconds), 0);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

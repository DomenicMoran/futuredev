/** Returns the original ISO value for the chronologically earliest future card. */
export function earliestFutureDueAt(dueDates: readonly string[], now: Date): string | null {
  let earliest: { source: string; timestamp: number } | null = null;
  for (const source of dueDates) {
    const timestamp = Date.parse(source);
    if (!Number.isFinite(timestamp) || timestamp <= now.getTime()) continue;
    if (!earliest || timestamp < earliest.timestamp) earliest = { source, timestamp };
  }
  return earliest?.source ?? null;
}

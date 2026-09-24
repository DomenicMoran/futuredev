/** Reine Hilfsfunktionen für Fortschrittsbalken und Seek (ohne TrackPlayer). */

export function clampSeekPosition(seconds: number, durationSeconds: number): number {
  if (!Number.isFinite(seconds) || durationSeconds <= 0) return 0;
  return Math.min(Math.max(seconds, 0), durationSeconds);
}

export function ratioFromPosition(positionSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return clampSeekPosition(positionSeconds, durationSeconds) / durationSeconds;
}

export function positionFromRatio(ratio: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  return clampedRatio * durationSeconds;
}

/** `localX` relativ zur linken Kante der Spur; `trackWidth` in Layout-Pixeln. */
export function ratioFromTouchX(localX: number, trackWidth: number): number {
  if (trackWidth <= 0) return 0;
  return Math.min(Math.max(localX / trackWidth, 0), 1);
}

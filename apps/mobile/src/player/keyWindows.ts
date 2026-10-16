export interface KeyWindow {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export function keySentenceWindows(
  blocks: readonly { isKeySentence: boolean; startSeconds: number; durationSeconds: number }[],
): KeyWindow[] {
  return blocks
    .filter((block) => block.isKeySentence)
    .map((block) => ({
      startSeconds: block.startSeconds,
      endSeconds: block.startSeconds + block.durationSeconds,
    }));
}

/** null: die Position liegt in einer Schlüsselstelle. Eine Zahl: dorthin springen. pause: nach der letzten Stelle. */
export function keyListenTarget(positionSeconds: number, windows: readonly KeyWindow[]): number | 'pause' | null {
  if (windows.length === 0) return null;
  const inside = windows.some(
    (window) => positionSeconds >= window.startSeconds && positionSeconds < window.endSeconds - 0.05,
  );
  if (inside) return null;
  const next = windows.find((window) => window.startSeconds > positionSeconds + 0.05);
  if (next) return next.startSeconds;
  return 'pause';
}

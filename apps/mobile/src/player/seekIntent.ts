let seekIntent = 0;

/** Invalidates an in-flight chapter seek when a newer selection/track intent arrives. */
export function beginSeekIntent(): number {
  seekIntent += 1;
  return seekIntent;
}

export function invalidateSeekIntent(): void {
  seekIntent += 1;
}

export function isCurrentSeekIntent(intent: number): boolean {
  return intent === seekIntent;
}

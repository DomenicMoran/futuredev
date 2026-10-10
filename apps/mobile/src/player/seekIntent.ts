import { resetHearingBaseline } from './hearingProgress.js';
let seekIntent = 0;

/** Invalidates an in-flight chapter seek when a newer selection/track intent arrives. */
export function beginSeekIntent(): number {
  resetHearingBaseline();
  seekIntent += 1;
  return seekIntent;
}

export function invalidateSeekIntent(): void {
  resetHearingBaseline();
  seekIntent += 1;
}

export function isCurrentSeekIntent(intent: number): boolean {
  return intent === seekIntent;
}

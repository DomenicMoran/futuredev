export const MOTION_STAGGER_MS = 40;
export const MOTION_STAGGER_MAX_ITEMS = 3;

/** Stagger enter delay for list/card index; capped at 3 items (total feel under ~250 ms). */
export function motionStaggerDelay(index: number): number {
  const capped = Math.min(Math.max(index, 0), MOTION_STAGGER_MAX_ITEMS - 1);
  return capped * MOTION_STAGGER_MS;
}

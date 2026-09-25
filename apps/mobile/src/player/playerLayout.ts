/** Layout-Hilfen für Player/MiniPlayer (Breite/Höhe in px). */

export const TABLET_MIN_WIDTH = 768;
export const COMPACT_MAX_HEIGHT = 640;

export function playerCoverSize(width: number, height: number): number {
  const horizontalCap = Math.max(120, width - 48);
  if (height < COMPACT_MAX_HEIGHT) {
    return Math.min(160, horizontalCap);
  }
  if (width >= TABLET_MIN_WIDTH) {
    return Math.min(280, horizontalCap);
  }
  return Math.min(240, horizontalCap);
}

export function playerHorizontalPadding(width: number): number {
  if (width >= TABLET_MIN_WIDTH) return 32;
  return 16;
}

export function miniPlayerCoverSize(width: number): number {
  return width >= TABLET_MIN_WIDTH ? 52 : 44;
}

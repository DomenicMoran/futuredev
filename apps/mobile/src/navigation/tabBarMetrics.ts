import type { Theme } from '../theme/useTheme.js';
import { miniPlayerLayoutHeight } from '../player/miniPlayerLayout.js';

/** Reiterleisten-Höhe inkl. unterem Safe-Area-Inset (Gesture/Nav-Leiste). */
export function tabBarHeight(theme: Theme, bottomInset = 0, fontScale = 1): number {
  const scaledLabelRoom = Math.max(0, Math.min(30, (fontScale - 1) * 22));
  return 56 + theme.spacing.xs + bottomInset + scaledLabelRoom;
}

/** Höhe des Mini-Players (geteilt mit MiniPlayer.tsx über miniPlayerLayout). */
export function miniPlayerHeight(theme: Theme): number {
  return miniPlayerLayoutHeight(theme);
}

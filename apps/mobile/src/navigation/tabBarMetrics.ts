import type { Theme } from '../theme/useTheme.js';
import { miniPlayerLayoutHeight } from '../player/miniPlayerLayout.js';

/** Reiterleisten-Höhe inkl. unterem Safe-Area-Inset (Gesture/Nav-Leiste). */
export function tabBarHeight(theme: Theme, bottomInset = 0): number {
  return 56 + theme.spacing.xs + bottomInset;
}

/** Höhe des Mini-Players (geteilt mit MiniPlayer.tsx über miniPlayerLayout). */
export function miniPlayerHeight(theme: Theme): number {
  return miniPlayerLayoutHeight(theme);
}

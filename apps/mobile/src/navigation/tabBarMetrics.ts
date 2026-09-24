import type { Theme } from '../theme/useTheme.js';
import { miniPlayerLayoutHeight } from '../player/miniPlayerLayout.js';

/** Sichtbare Reiterleisten-Höhe (muss mit app/(tabs)/_layout.tsx übereinstimmen). */
export function tabBarHeight(theme: Theme): number {
  return 56 + theme.spacing.xs;
}

/** Höhe des Mini-Players (geteilt mit MiniPlayer.tsx über miniPlayerLayout). */
export function miniPlayerHeight(theme: Theme): number {
  return miniPlayerLayoutHeight(theme);
}

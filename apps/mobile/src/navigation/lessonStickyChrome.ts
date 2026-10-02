import type { Theme } from '../theme/useTheme.js';
/** Kleine Lese-Endkante; Aktionen und unteres Player-/Safe-Area-Chrome liegen im normalen Layoutfluss. */
export function lessonContentBottomPadding(theme: Theme): number {
  return theme.spacing.base;
}

import type { Theme } from '../theme/useTheme.js';
import type { BottomChromeLayout } from './useBottomChromeInset.js';

/** Höhe der Hören/Quiz-Leiste inkl. Zeilenlayout (LessonStickyActions). */
export const LESSON_STICKY_ACTIONS_HEIGHT = 72;

/** Scroll-Padding: Mini-Player/Reiter + sticky Leiste, damit Sprechtext darüber endet. */
export function lessonContentBottomPadding(theme: Theme, layout: BottomChromeLayout): number {
  const stickyBarTotal = LESSON_STICKY_ACTIONS_HEIGHT + theme.spacing.sm * 2;
  return layout.contentInset + stickyBarTotal + theme.spacing.xs;
}

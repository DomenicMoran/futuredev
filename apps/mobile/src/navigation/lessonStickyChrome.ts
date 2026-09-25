import type { Theme } from '../theme/useTheme.js';
import type { BottomChromeLayout } from './useBottomChromeInset.js';

/** Höhe der Hören/Quiz-Leiste inkl. Zeilenlayout (LessonStickyActions). */
export const LESSON_STICKY_ACTIONS_HEIGHT = 72;

/** Scroll-Padding: Abstand über Mini-Player/Reiter + sticky Leiste, damit Sprechtext darüber endet. */
export function lessonContentBottomPadding(theme: Theme, layout: BottomChromeLayout): number {
  const stickyBarTotal = LESSON_STICKY_ACTIONS_HEIGHT + theme.spacing.sm * 2;
  return layout.stickyBottomOffset + stickyBarTotal + theme.spacing['2xl'] + theme.minTapTarget;
}

import { describe, expect, it } from 'vitest';
import { colors, minTapTarget, motion, radius, spacing, type } from '@futuredev/design-tokens';
import type { Theme } from '../theme/useTheme.js';
import { lessonContentBottomPadding, LESSON_STICKY_ACTIONS_HEIGHT } from './lessonStickyChrome.js';

function testTheme(): Theme {
  return {
    colors: colors.light,
    spacing,
    radius,
    type,
    motion,
    minTapTarget,
    scheme: 'light',
  };
}

describe('lessonContentBottomPadding', () => {
  it('reserves sticky bar height above bottom chrome offset', () => {
    const layout = { contentInset: 220, stickyBottomOffset: 180 };
    const padding = lessonContentBottomPadding(testTheme(), layout);
    const stickyBarTotal = LESSON_STICKY_ACTIONS_HEIGHT + spacing.sm * 2;
    expect(padding).toBeGreaterThanOrEqual(
      layout.stickyBottomOffset + stickyBarTotal + spacing['2xl'] + minTapTarget,
    );
  });
});

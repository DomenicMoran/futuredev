import { describe, expect, it } from 'vitest';
import { colors, minTapTarget, motion, radius, spacing, type } from '@futuredev/design-tokens';
import type { Theme } from '../theme/useTheme.js';
import { lessonContentBottomPadding } from './lessonStickyChrome.js';

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
  it('keeps only a small reading-content end gutter because controls occupy normal layout flow', () => {
    expect(lessonContentBottomPadding(testTheme())).toBe(spacing.base);
  });
});

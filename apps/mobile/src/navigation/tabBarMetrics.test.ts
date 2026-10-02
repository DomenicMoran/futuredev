import { describe, expect, it } from 'vitest';
import { colors, minTapTarget, motion, radius, spacing, type } from '@futuredev/design-tokens';
import { tabBarHeight } from './tabBarMetrics.js';
import type { Theme } from '../theme/useTheme.js';
import {
  MINI_PLAYER_SCRUBBER_HIT_HEIGHT,
  miniPlayerLayoutHeight,
  miniPlayerRowContentHeight,
  miniPlayerRowMinHeight,
  miniPlayerTitleBlockHeight,
} from '../player/miniPlayerLayout.js';
import { miniPlayerHeight } from './tabBarMetrics.js';

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

describe('miniPlayerHeight', () => {
  it('ist mindestens Fortschritt + Padding×2 + Zeileninhalt', () => {
    const theme = testTheme();
    const measured =
      MINI_PLAYER_SCRUBBER_HIT_HEIGHT +
      theme.spacing.sm * 2 +
      Math.max(minTapTarget, miniPlayerTitleBlockHeight(theme));
    expect(miniPlayerHeight(theme)).toBeGreaterThanOrEqual(measured);
    expect(miniPlayerHeight(theme)).toBe(miniPlayerLayoutHeight(theme));
    expect(miniPlayerHeight(theme)).toBeGreaterThanOrEqual(
      MINI_PLAYER_SCRUBBER_HIT_HEIGHT +
        theme.spacing.sm * 2 +
        Math.max(miniPlayerRowMinHeight(theme), miniPlayerRowContentHeight(theme)),
    );
  });
});

describe('tab bar accessibility geometry', () => {
  it('preserves bottom inset and grows label room at large font scales without shrinking', () => {
    const theme = testTheme();
    const standard = tabBarHeight(theme, 24, 1);
    const large = tabBarHeight(theme, 24, 2);
    const capped = tabBarHeight(theme, 24, 5);
    expect(standard).toBe(84);
    expect(large).toBeGreaterThan(standard);
    expect(capped).toBe(standard + 30);
  });
});

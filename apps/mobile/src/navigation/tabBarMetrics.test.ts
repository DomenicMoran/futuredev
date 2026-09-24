import { describe, expect, it } from 'vitest';
import { colors, minTapTarget, motion, radius, spacing, type } from '@futuredev/design-tokens';
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

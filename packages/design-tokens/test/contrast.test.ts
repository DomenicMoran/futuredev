import { describe, expect, it } from 'vitest';
import { colors, WCAG_AA_TEXT_MINIMUM } from '../src/index.js';
import { contrastRatio } from '../src/contrast.js';

describe('Kontrast Text auf Hintergrund, WCAG AA (mindestens 4.5:1)', () => {
  it.each([
    ['light.textPrimary/background', colors.light.textPrimary, colors.light.background],
    ['light.textSecondary/background', colors.light.textSecondary, colors.light.background],
    ['light.accent/background', colors.light.accent, colors.light.background],
    ['dark.textPrimary/background', colors.dark.textPrimary, colors.dark.background],
    ['dark.textSecondary/background', colors.dark.textSecondary, colors.dark.background],
    ['dark.accent/background', colors.dark.accent, colors.dark.background],
  ])('%s erreicht mindestens 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT_MINIMUM);
  });

  it('scheitert bei einem zu schwachen Kontrast (Gegenprobe der Formel)', () => {
    // Hellgrau auf Weiß: bekannt zu schwach, belegt dass der Test echte Fehler findet.
    expect(contrastRatio('#CCCCCC', '#FFFFFF')).toBeLessThan(WCAG_AA_TEXT_MINIMUM);
  });
});

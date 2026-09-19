import { describe, expect, it } from 'vitest';
import { colors, WCAG_AA_TEXT_MINIMUM } from '../src/index.js';
import { contrastRatio } from '../src/contrast.js';

describe('Kontrast Text auf Hintergrund, WCAG AA (mindestens 4.5:1)', () => {
  it.each([
    ['light.text/bg', colors.light.text, colors.light.bg],
    ['light.textWeak/bg', colors.light.textWeak, colors.light.bg],
    ['light.accent/bg', colors.light.accent, colors.light.bg],
    ['light.accentText/accent', colors.light.accentText, colors.light.accent],
    ['dark.text/bg', colors.dark.text, colors.dark.bg],
    ['dark.textWeak/bg', colors.dark.textWeak, colors.dark.bg],
    ['dark.accent/bg', colors.dark.accent, colors.dark.bg],
    ['dark.accentText/accent', colors.dark.accentText, colors.dark.accent],
  ])('%s erreicht mindestens 4.5:1', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT_MINIMUM);
  });

  it('scheitert bei einem zu schwachen Kontrast (Gegenprobe der Formel)', () => {
    // Hellgrau auf Weiß: bekannt zu schwach, belegt dass der Test echte Fehler findet.
    expect(contrastRatio('#CCCCCC', '#FFFFFF')).toBeLessThan(WCAG_AA_TEXT_MINIMUM);
  });
});

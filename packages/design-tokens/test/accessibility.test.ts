import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, minTapTarget } from '../src/index.js';

describe('Android accessibility palette and targets', () => {
  it('provides 48 dp touch targets', () => expect(minTapTarget).toBeGreaterThanOrEqual(48));
  for (const mode of ['light', 'dark'] as const) {
    for (const background of ['bg', 'surface'] as const) {
      for (const foreground of ['text', 'textWeak', 'accent', 'success', 'warning', 'error'] as const) {
        it(`${mode} ${foreground}/${background} meets 4.5:1`, () => {
          expect(contrastRatio(colors[mode][foreground], colors[mode][background])).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

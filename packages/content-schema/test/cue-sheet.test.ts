import { describe, expect, it } from 'vitest';
import { cueSheetSchema } from '../src/cue-sheet.js';

function makeValidCueSheet() {
  return {
    lessonId: 'M01-01-01',
    blocks: [
      { index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 2.4, isKeySentence: false },
      { index: 1, speaker: 'A', startSeconds: 2.7, durationSeconds: 3.1, isKeySentence: false, section: 'body' },
    ],
  };
}

describe('cueSheetSchema', () => {
  it('akzeptiert eine gültige Cue-Datei, auch ohne section', () => {
    const result = cueSheetSchema.safeParse(makeValidCueSheet());
    expect(result.success).toBe(true);
  });

  it('akzeptiert alle fünf Abschnittswerte (AW-045)', () => {
    const sheet = makeValidCueSheet();
    for (const section of ['body', 'terms', 'example', 'task', 'faq']) {
      const result = cueSheetSchema.safeParse({
        ...sheet,
        blocks: [{ ...sheet.blocks[0], section }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('lehnt einen unbekannten Abschnittswert ab', () => {
    const sheet = makeValidCueSheet();
    const result = cueSheetSchema.safeParse({
      ...sheet,
      blocks: [{ ...sheet.blocks[0], section: 'intro' }],
    });
    expect(result.success).toBe(false);
  });

  it('lehnt eine leere Blockliste ab', () => {
    const result = cueSheetSchema.safeParse({ lessonId: 'M01-01-01', blocks: [] });
    expect(result.success).toBe(false);
  });

  it('lehnt eine falsche Lektionskennung ab', () => {
    const result = cueSheetSchema.safeParse({ ...makeValidCueSheet(), lessonId: 'foo' });
    expect(result.success).toBe(false);
  });
});

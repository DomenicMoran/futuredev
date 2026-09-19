import { describe, expect, it } from 'vitest';
import { buildCueSheet, type CueSourceBlock } from '../src/cues.js';

const A = (overrides: Partial<CueSourceBlock> = {}): CueSourceBlock => ({
  speaker: 'A',
  isKeySentence: false,
  role: 'explain',
  ...overrides,
});
const B = (overrides: Partial<CueSourceBlock> = {}): CueSourceBlock => ({
  speaker: 'B',
  isKeySentence: false,
  role: 'question',
  ...overrides,
});

describe('buildCueSheet', () => {
  it('setzt den ersten Block auf Startzeit 0', () => {
    const sheet = buildCueSheet('M01-01-01', [A()], [2]);
    expect(sheet.blocks[0]).toMatchObject({ index: 0, startSeconds: 0, durationSeconds: 2 });
  });

  it('reiht drei gleichbleibende Sprecher mit 300 ms Pause aneinander', () => {
    const sheet = buildCueSheet('M01-01-01', [A(), A(), A()], [2, 3, 1]);
    // Block 0: 0..2, Pause 0.3, Block 1: 2.3..5.3, Pause 0.3, Block 2: 5.6..6.6
    expect(sheet.blocks.map((b) => b.startSeconds)).toEqual([0, 2.3, 5.6]);
  });

  it('nutzt 600 ms Pause bei Sprecherwechsel', () => {
    const sheet = buildCueSheet('M01-01-01', [A(), B()], [1, 1]);
    expect(sheet.blocks[1]?.startSeconds).toBe(1.6);
  });

  it('übernimmt isKeySentence und leitet section aus role ab', () => {
    const sheet = buildCueSheet(
      'M01-01-01',
      [A({ isKeySentence: true, role: 'explain' }), B({ role: 'terms_list' })],
      [1, 1],
    );
    expect(sheet.blocks[0]).toMatchObject({ isKeySentence: true, section: 'body' });
    expect(sheet.blocks[1]).toMatchObject({ isKeySentence: false, section: 'terms' });
  });

  it('leitet section faq/terms/example korrekt aus role ab, sonst body', () => {
    const sheet = buildCueSheet(
      'M01-01-01',
      [A({ role: 'faq' }), A({ role: 'terms_list' }), A({ role: 'example' }), A({ role: 'key' })],
      [1, 1, 1, 1],
    );
    expect(sheet.blocks.map((b) => b.section)).toEqual(['faq', 'terms', 'example', 'body']);
  });

  it('wirft bei unterschiedlicher Länge der Eingaben', () => {
    expect(() => buildCueSheet('M01-01-01', [A(), A()], [1])).toThrow();
  });

  it('wirft bei leerer Blockliste', () => {
    expect(() => buildCueSheet('M01-01-01', [], [])).toThrow();
  });

  it('rundet auf drei Nachkommastellen (Millisekunden)', () => {
    const sheet = buildCueSheet('M01-01-01', [A(), A()], [1.23456, 1]);
    expect(sheet.blocks[1]?.startSeconds).toBe(1.535);
  });
});

import { describe, expect, it } from 'vitest';
import { buildCueSheet, type CueSourceBlock } from '../src/cues.js';

const A = (overrides: Partial<CueSourceBlock> = {}): CueSourceBlock => ({
  speaker: 'A',
  isKeySentence: false,
  ...overrides,
});
const B = (overrides: Partial<CueSourceBlock> = {}): CueSourceBlock => ({
  speaker: 'B',
  isKeySentence: false,
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

  it('übernimmt isKeySentence und section je Block', () => {
    const sheet = buildCueSheet(
      'M01-01-01',
      [A({ isKeySentence: true, section: 'body' }), B({ section: 'terms' })],
      [1, 1],
    );
    expect(sheet.blocks[0]).toMatchObject({ isKeySentence: true, section: 'body' });
    expect(sheet.blocks[1]).toMatchObject({ isKeySentence: false, section: 'terms' });
  });

  it('lässt section weg, wenn sie im Quellblock fehlt', () => {
    const sheet = buildCueSheet('M01-01-01', [A()], [1]);
    expect(sheet.blocks[0]).not.toHaveProperty('section');
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

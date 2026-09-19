import { describe, expect, it } from 'vitest';
import type { CueSheet } from '@futuredev/content-schema';
import { blocksInSection, findBlockAtPosition, findNextKeySentenceBlock, findPositionForBlock } from './cues.js';

const sheet: CueSheet = {
  lessonId: 'M01-01-01',
  blocks: [
    { index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 2, isKeySentence: false, section: 'body' },
    { index: 1, speaker: 'A', startSeconds: 2.3, durationSeconds: 3, isKeySentence: true, section: 'body' },
    { index: 2, speaker: 'B', startSeconds: 5.9, durationSeconds: 1.5, isKeySentence: false, section: 'terms' },
  ],
};

describe('findBlockAtPosition', () => {
  it('findet den ersten Block bei Position 0', () => {
    expect(findBlockAtPosition(sheet, 0).index).toBe(0);
  });

  it('findet den ersten Block noch vor Beginn (negative/kleine Position)', () => {
    expect(findBlockAtPosition(sheet, -1).index).toBe(0);
  });

  it('findet den mittleren Block innerhalb seiner Spanne', () => {
    expect(findBlockAtPosition(sheet, 3).index).toBe(1);
  });

  it('findet den letzten Block exakt an seiner Startzeit', () => {
    expect(findBlockAtPosition(sheet, 5.9).index).toBe(2);
  });

  it('bleibt am letzten Block, wenn die Position dahinter liegt', () => {
    expect(findBlockAtPosition(sheet, 999).index).toBe(2);
  });

  it('wirft bei einer Cue-Datei ohne Blöcke', () => {
    expect(() => findBlockAtPosition({ lessonId: 'M01-01-01', blocks: [] }, 0)).toThrow();
  });
});

describe('findPositionForBlock', () => {
  it('liefert die Startzeit eines bekannten Blocks', () => {
    expect(findPositionForBlock(sheet, 2)).toBe(5.9);
  });

  it('liefert 0 für einen unbekannten Blockindex', () => {
    expect(findPositionForBlock(sheet, 99)).toBe(0);
  });
});

describe('findNextKeySentenceBlock', () => {
  it('findet den nächsten Kernsatz nach einer Position', () => {
    expect(findNextKeySentenceBlock(sheet, 0)?.index).toBe(1);
  });

  it('liefert undefined, wenn kein Kernsatz mehr folgt', () => {
    expect(findNextKeySentenceBlock(sheet, 3)).toBeUndefined();
  });
});

describe('blocksInSection', () => {
  it('filtert nach Abschnitt', () => {
    expect(blocksInSection(sheet, 'terms').map((b) => b.index)).toEqual([2]);
  });

  it('behandelt fehlende section als body', () => {
    const withoutSection: CueSheet = {
      lessonId: 'M01-01-01',
      blocks: [{ index: 0, speaker: 'A', startSeconds: 0, durationSeconds: 1, isKeySentence: false }],
    };
    expect(blocksInSection(withoutSection, 'body')).toHaveLength(1);
  });
});

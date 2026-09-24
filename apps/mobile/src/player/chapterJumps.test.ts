import { describe, expect, it } from 'vitest';
import type { CueSheet } from '@futuredev/content-schema';
import {
  buildChapterJumps,
  CHAPTER_JUMP_MAX,
  CHAPTER_JUMP_MIN,
  findActiveChapterJumpIndex,
  hasSectionJumpStructure,
} from './chapterJumps.js';

function block(
  index: number,
  startSeconds: number,
  section: 'body' | 'terms' | 'example' | 'faq' = 'body',
  isKeySentence = false,
): CueSheet['blocks'][number] {
  return {
    index,
    speaker: 'A',
    startSeconds,
    durationSeconds: 2,
    isKeySentence,
    section,
  };
}

describe('hasSectionJumpStructure', () => {
  it('ist false, wenn alle Bloecke body sind', () => {
    expect(hasSectionJumpStructure([block(0, 0), block(1, 2)])).toBe(false);
  });

  it('ist true, wenn ein Nicht-body-Abschnitt vorkommt', () => {
    expect(hasSectionJumpStructure([block(0, 0), block(1, 2, 'terms')])).toBe(true);
  });
});

describe('buildChapterJumps', () => {
  it('faellt auf Sprechbloecke zurueck ohne Abschnittsstruktur', () => {
    const sheet: CueSheet = {
      lessonId: 'M01-01-01',
      blocks: [block(0, 0), block(1, 2), block(2, 4)],
    };
    expect(buildChapterJumps(sheet, ['a', 'b', 'c'])).toHaveLength(3);
  });

  it('reduziert auf Abschnitts- und Rollenanker statt 77 Zeilen', () => {
    const blocks: CueSheet['blocks'] = [];
    for (let i = 0; i < 40; i++) {
      blocks.push(block(i, i * 2, 'body'));
    }
    blocks.push(block(40, 80, 'terms'));
    blocks.push(block(41, 82, 'faq'));
    const sheet: CueSheet = { lessonId: 'M01-01-01', blocks };
    const roles = blocks.map((_, i) => (i === 5 ? 'term' : i === 10 ? 'why' : 'explain')) as import('@futuredev/content-schema').BlockRole[];
    const jumps = buildChapterJumps(sheet, blocks.map((_, i) => `Text ${i}`), roles);
    expect(jumps.length).toBeGreaterThanOrEqual(CHAPTER_JUMP_MIN);
    expect(jumps.length).toBeLessThanOrEqual(CHAPTER_JUMP_MAX);
    expect(jumps.length).toBeLessThan(blocks.length);
    expect(jumps.some((j) => j.block.section === 'terms')).toBe(true);
  });

  it('verwendet keinen Sprecher-Fallback solange Sprechtexte fehlen', () => {
    const sheet: CueSheet = {
      lessonId: 'M01-01-01',
      blocks: [block(0, 0), block(1, 2), block(2, 4)],
    };
    const jumps = buildChapterJumps(sheet, undefined);
    expect(jumps.every((j) => !j.label.includes('Sprecher'))).toBe(true);
    expect(jumps.every((j) => j.label === '…')).toBe(true);
  });

  it('kennzeichnet terms-Abschnitt mit menschlicher Ueberschrift', () => {
    const sheet: CueSheet = {
      lessonId: 'M01-01-01',
      blocks: [block(0, 0), block(1, 2, 'terms')],
    };
    const jumps = buildChapterJumps(sheet, ['Intro', 'Begriffe wiederholen']);
    const termsJump = jumps.find((j) => j.block.section === 'terms');
    expect(termsJump?.sectionHeading).toBeTruthy();
    expect(termsJump?.label).toContain('Begriffe');
  });
});

describe('findActiveChapterJumpIndex', () => {
  const jumps = buildChapterJumps(
    {
      lessonId: 'M01-01-01',
      blocks: [block(0, 0), block(5, 10, 'terms'), block(6, 12, 'faq')],
    },
    ['a', 'b', 'c'],
  );

  it('markiert den Sprung, in dessen Blockbereich die Position liegt', () => {
    expect(findActiveChapterJumpIndex(jumps, 0)).toBe(0);
    expect(findActiveChapterJumpIndex(jumps, 5)).toBeGreaterThanOrEqual(1);
  });
});

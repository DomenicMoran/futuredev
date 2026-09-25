import { describe, expect, it } from 'vitest';
import { resolveNextLessonId } from './startData.js';

describe('resolveNextLessonId', () => {
  it('nutzt Curriculum-Reihenfolge (nicht alphabetisch)', () => {
    const ordered = ['M02-01-01', 'M01-01-01'];
    expect(resolveNextLessonId(ordered, new Set())).toBe('M02-01-01');
  });

  it('liefert erste offene Lektion nach Abschlüssen', () => {
    const ordered = ['M01-01-01', 'M01-01-02', 'M02-01-01'];
    expect(resolveNextLessonId(ordered, new Set(['M01-01-01']))).toBe('M01-01-02');
  });
});

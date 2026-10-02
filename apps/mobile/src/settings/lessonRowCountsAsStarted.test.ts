import { describe, expect, it } from 'vitest';
import type { ProgressRow } from '../data/types.js';
import { lessonRowCountsAsStarted } from './profile.js';

function row(partial: Partial<ProgressRow> & Pick<ProgressRow, 'lessonId'>): ProgressRow {
  return {
    state: 'new',
    readUntil: null,
    listenedUntil: null,
    quizScore: null,
    quizPassed: false,
    updatedAt: '2026-09-25T12:00:00.000Z',
    ...partial,
  };
}

describe('lessonRowCountsAsStarted', () => {
  it('treats any non-new lesson state as activity', () => {
    expect(lessonRowCountsAsStarted(row({ lessonId: 'M01-01-01', state: 'started' }))).toBe(true);
    expect(lessonRowCountsAsStarted(row({ lessonId: 'M01-01-01', state: 'completed' }))).toBe(true);
  });

  it('counts quiz-only activity on a new row without implying read/listen completion', () => {
    expect(lessonRowCountsAsStarted(row({ lessonId: 'M01-01-01', state: 'new', quizScore: 0, quizPassed: false }))).toBe(true);
    expect(lessonRowCountsAsStarted(row({ lessonId: 'M01-01-01', state: 'new', quizPassed: true, quizScore: 100 }))).toBe(true);
  });

  it('ignores untouched new lessons', () => {
    expect(lessonRowCountsAsStarted(undefined)).toBe(false);
    expect(lessonRowCountsAsStarted(row({ lessonId: 'M01-01-01', state: 'new' }))).toBe(false);
  });
});

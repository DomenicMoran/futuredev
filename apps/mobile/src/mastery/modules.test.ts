import { beforeEach, describe, expect, it } from 'vitest';
import { answer, begin, emptyState, finish, makeBank, parseState, summary } from './engine.js';
import { resetToMemoryDatabase } from '../data/db.js';
import { loadMastery, saveMastery } from './persistence.js';
import {
  beginHearing,
  listReviewHearingProgress,
  recordHearingSample,
  resetHearingBaseline,
} from '../player/hearingProgress.js';

const bank = makeBank(
  ['M01-01-01', 'M02-01-01', 'M03-01-01'].flatMap((sourceLessonId) =>
    [1, 2].map((i) => ({
      sourceLessonId,
      questionId: `q${i}`,
      question: `Question ${i}`,
      options: [
        { text: 'yes', isCorrect: true, explanation: 'yes' },
        { text: 'no', isCorrect: false, explanation: 'no' },
      ],
    })),
  ),
);
const moduleScope = (id: string) => ({ lessonIds: [id], title: id });
describe('modular exams and shared review', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
    resetHearingBaseline();
  });
  it('accumulates errors across modules and retests only those errors, never unseen modules', () => {
    let s = begin(emptyState(), bank, moduleScope('M01-01-01'));
    expect(s.session?.keys).toHaveLength(2);
    s = finish(answer(answer(s, 0, bank), -1, bank), bank);
    s = begin(s, bank, moduleScope('M02-01-01'));
    s = finish(answer(answer(s, -1, bank), 0, bank), bank);
    expect(summary(s, bank)).toMatchObject({ passed: 2, unseen: 2, remaining: 4 });
    expect(summary(s, bank).wrong).toHaveLength(2);
    s = begin(s, bank, 'review');
    expect(s.session?.keys).toHaveLength(2);
    expect(s.session?.keys.every((k) => !k.startsWith('M03'))).toBe(true);
    s = finish(answer(answer(s, 0, bank), -1, bank), bank);
    expect(summary(s, bank).wrong).toHaveLength(1);
    s = finish(answer(begin(s, bank, 'review'), 0, bank), bank);
    expect(summary(s, bank)).toMatchObject({ passed: 4, unseen: 2, percent: 66 });
    expect(() => begin(s, bank, 'review')).toThrow();
    s = begin(s, bank, moduleScope('M03-01-01'));
    s = finish(answer(answer(s, 0, bank), 0, bank), bank);
    expect(summary(s, bank).percent).toBe(100);
    expect(begin(s, bank, moduleScope('M01-01-01')).session?.keys).toHaveLength(2);
    expect(begin(s, bank, 'all').session?.keys).toHaveLength(6);
  });
  it('preserves preferences, module title and paused answers through restart; old saves still work', async () => {
    const old = emptyState();
    expect(parseState(JSON.stringify(old))).toEqual(old);
    const s = answer(
      begin({ ...old, examMode: 'modules', selectedModule: 'M02' }, bank, moduleScope('M02-01-01')),
      -1,
      bank,
    );
    await saveMastery(s);
    expect(await loadMastery()).toEqual(s);
    expect(s.session?.title).toBe('M02-01-01');
    expect(() => begin(s, bank, 'review')).toThrow();
    expect(() => begin(old, bank, moduleScope('nonexistent'))).toThrow();
    expect(() => parseState(JSON.stringify({ ...old, examMode: 'bad' }))).toThrow();
  });
  it('partial module results never erase unrelated errors or review marks', () => {
    let s = finish(answer(begin(emptyState(), bank, moduleScope('M01-01-01')), -1, bank), bank);
    s.reviewed = ['M01-01-01'];
    s = finish(answer(begin(s, bank, moduleScope('M02-01-01')), -1, bank), bank);
    expect(summary(s, bank).wrong).toHaveLength(2);
    expect(summary(s, bank).unseen).toBe(4);
    expect(s.reviewed).toEqual(['M01-01-01']);
    s = finish(answer(begin(s, bank, moduleScope('M01-01-01')), -1, bank), bank);
    expect(s.reviewed).toEqual([]);
  });
  it('preserves audio repetition from other modules and resets only evaluated lessons', async () => {
    let s = finish(answer(begin(emptyState(), bank, moduleScope('M01-01-01')), -1, bank), bank);
    await saveMastery(s);
    beginHearing('M01-01-01', 0, true, 0);
    await recordHearingSample('M01-01-01', 20, 20, false, 1, 20000);
    expect((await listReviewHearingProgress())['M01-01-01']?.completed).toBe(true);
    s = finish(answer(begin(s, bank, moduleScope('M02-01-01')), -1, bank), bank);
    await saveMastery(s);
    expect((await listReviewHearingProgress())['M01-01-01']?.completed).toBe(true);
    expect((await listReviewHearingProgress())['M02-01-01']).toBeUndefined();
    s = finish(answer(begin(s, bank, moduleScope('M01-01-01')), -1, bank), bank);
    await saveMastery(s);
    expect((await listReviewHearingProgress())['M01-01-01']).toBeUndefined();
  });
});

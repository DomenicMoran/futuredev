import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase } from '../data/db.js';
import { answer, begin, emptyState, finish, makeBank, parseState, summary } from './engine.js';
import { loadMastery, recoverMastery, saveMastery } from './persistence.js';
import { updateRecall } from './retention.js';
import { drawRound, evaluateRound } from '../quiz/roundLogic.js';
import { recordQuizRound } from '../quiz/results.js';
import { exportAllFrom, importAllInto } from '../data/exportImport.js';
import { canCompletePractice, emptyPractice, loadPractice, savePractice } from './practice.js';
import { getBundledLesson } from '../content/bundledData.js';
const pool = [
  {
    questionId: 'q1',
    sourceLessonId: 'M01-01-01',
    question: 'Why?',
    options: [
      { text: 'Yes', isCorrect: true, explanation: 'Reason' },
      { text: 'No', isCorrect: false, explanation: 'Wrong' },
    ],
  },
];
const bank = makeBank(pool);
const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));
describe('durable and shared learning evidence', () => {
  it('rejects incomplete session objects with an actionable error, not a runtime TypeError', () => {
    for (const answers of [undefined, null, false, {}, 'bad']) {
      const broken = { ...emptyState(), session: { unsure: [0], answers } };
      expect(() => parseState(JSON.stringify(broken))).toThrow('gespeicherte Prüfung');
    }
  });
  it('explains malformed learning state with local and file recovery options', () => {
    expect(() => parseState('{')).toThrow('lokalen Lernstand wiederherstellen');
    expect(() => parseState('{')).toThrow('Datensicherung importieren');
  });
  beforeEach(() => {
    resetToMemoryDatabase();
  });
  it('requires spaced correct recalls; early repetitions do not advance or defer the due date', () => {
    let r = updateRecall(undefined, true, day(0));
    expect(r).toMatchObject({ stage: 1, successes: 1, dueAt: day(1).toISOString() });
    for (let i = 0; i < 100; i++) r = updateRecall(r, true, day(0));
    expect(r.successes).toBe(1);
    r = updateRecall(r, true, day(1));
    expect(r).toMatchObject({ stage: 2, successes: 2, dueAt: day(3).toISOString() });
    r = updateRecall(r, true, day(3));
    expect(r).toMatchObject({ stage: 3, successes: 3, dueAt: day(7).toISOString() });
    r = updateRecall(r, true, day(100));
    expect(r.successes).toBe(4); // Never award skipped months.
    r = updateRecall(r, false, day(101));
    expect(r).toMatchObject({ stage: 1, successes: 0, errors: 1, dueAt: day(102).toISOString() });
    expect(() => updateRecall(r, true, day(100))).toThrow('Gerätezeit');
  });
  it('does not award mastery for guessed correct answers and keeps early wins distinct from confirmed knowledge', () => {
    const s = finish(answer(begin(emptyState(), bank), 0, bank, false), bank, day(0));
    expect(summary(s, bank, day(0))).toMatchObject({ passed: 0, confirmed: 0, remaining: 1 });
    let next = finish(answer(begin(s, bank), 0, bank), bank, day(1));
    expect(summary(next, bank, day(1))).toMatchObject({ passed: 1, confirmed: 0 });
    expect(summary(next, bank, day(2)).due).toHaveLength(1);
    next = finish(answer(begin(next, bank, 'all'), 0, bank), bank, day(2));
    next = finish(answer(begin(next, bank, 'all'), 0, bank), bank, day(4));
    expect(summary(next, bank, day(4)).confirmed).toBe(1);
  });
  it('shares exact questions between shuffled regular quizzes, mastery and the daily Leitner queue', async () => {
    const round = drawRound(pool, 1, 88);
    const answers = round.drawn.map((q, questionIndex) => ({
      questionIndex,
      chosenOptionIndex: q.options.findIndex((o) => o.isCorrect),
    }));
    const input = {
      scope: { type: 'all' as const },
      round,
      answers,
      result: evaluateRound(round, answers),
      now: day(0),
    };
    await recordQuizRound(input);
    await recordQuizRound(input);
    let s = await loadMastery(bank);
    expect(s.history.at(-1)?.remainingScope).toBe('round');
    expect(summary(s, bank, day(0))).toMatchObject({ passed: 1, confirmed: 0 });
    const db = resetToMemoryDatabase(); // Round trip the state independently of the quiz.
    await saveMastery(s);
    expect((await db.listReviews())[0]).toMatchObject({ leitnerStage: 1, errorCount: 0 });
    s = finish(answer(begin(s, bank, 'all'), 0, bank), bank, day(1));
    await saveMastery(s);
    expect((await db.listReviews())[0]).toMatchObject({
      leitnerStage: 2,
      dueAt: day(3).toISOString(),
    });
    const wrongRound = drawRound(pool, 1, 89);
    const wrong = wrongRound.drawn.map((q, questionIndex) => ({
      questionIndex,
      chosenOptionIndex: q.options.findIndex((o) => !o.isCorrect),
    }));
    await recordQuizRound({
      scope: { type: 'review', cardIds: [] },
      round: wrongRound,
      answers: wrong,
      result: evaluateRound(wrongRound, wrong),
      now: day(3),
    });
    expect(summary(await loadMastery(bank), bank, day(3)).wrong).toHaveLength(1);
  });
  it('migrates legacy hashes and paused keys without crediting changed content', async () => {
    const q = bank[0];
    if (!q) throw new Error('fixture');
    const original = pool[0];
    if (!original) throw new Error('fixture');
    const old = { ...emptyState(), results: { [q.legacyKey]: true } };
    await saveMastery(old);
    expect(summary(await loadMastery(bank), bank).passed).toBe(1);
    expect(
      summary(
        await loadMastery(makeBank([{ ...original, question: 'Changed?' }])),
        makeBank([{ ...original, question: 'Changed?' }]),
      ).passed,
    ).toBe(0);
  });
  it('does not keep an obsolete wrong question version in the audio scope after the updated question passes', async () => {
    const db = resetToMemoryDatabase();
    const original = pool[0];
    if (!original) throw new Error('fixture');
    const revised = makeBank([{ ...original, question: 'Updated question?' }]);
    const first = finish(answer(begin(emptyState(), bank), 1, bank), bank, day(0));
    await saveMastery(first);
    const next = finish(answer(begin(first, revised), 0, revised), revised, day(1));
    await saveMastery(next);
    expect(JSON.parse((await db.getSetting('mastery_audio_scope_v1')) ?? '{}').ids).toEqual([]);
  });
  it('rolls back mastery, backup and Leitner on storage failure; refuses stale writes and recovers a valid snapshot', async () => {
    const db = resetToMemoryDatabase();
    const initial = emptyState();
    await saveMastery(initial);
    const next = finish(answer(begin(initial, bank), 0, bank), bank, day(0));
    const original = db.upsertReview;
    db.upsertReview = async () => {
      throw new Error('SQLITE_FULL');
    };
    await expect(saveMastery(next, initial)).rejects.toThrow('SQLITE_FULL');
    expect(await loadMastery()).toEqual(initial);
    expect(await db.listReviews()).toEqual([]);
    db.upsertReview = original;
    await saveMastery(next, initial);
    await expect(saveMastery(initial, initial)).rejects.toThrow('inzwischen');
    await db.setSetting('mastery_v1', '{');
    await recoverMastery();
    expect(await loadMastery()).toEqual(initial);
    expect((await db.listReviews())[0]?.leitnerStage).toBe(1);
    expect(new Date((await db.listReviews())[0]?.dueAt ?? '').getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });
  it('exports/imports paused answers, confidence, recall and independent practice evidence', async () => {
    const lesson = getBundledLesson('M01-00-01');
    if (!lesson) throw new Error('fixture');
    const db = resetToMemoryDatabase();
    let s = finish(answer(begin(emptyState(), bank), 0, bank), bank, day(0));
    s = answer(begin(s, bank, 'all'), 0, bank, false);
    await saveMastery(s);
    const practice = {
      ...emptyPractice(lesson),
      spoken: true,
      checked: lesson.practiceTask.checklist.map((_, i) => i),
      completedAt: day(0).toISOString(),
    };
    expect(canCompletePractice(practice, lesson)).toBe(true);
    await savePractice(lesson, practice);
    const bundle = await exportAllFrom(db);
    const restored = resetToMemoryDatabase();
    await importAllInto(restored, bundle);
    expect(await loadMastery()).toEqual(s);
    expect(await loadPractice(lesson)).toEqual(practice);
    expect(parseState(JSON.stringify(s))).toEqual(s);
    expect(canCompletePractice({ ...practice, checked: [] }, lesson)).toBe(false);
    const updated = { ...lesson, practiceTask: { ...lesson.practiceTask, task: 'New task' } };
    expect((await loadPractice(updated)).completedAt).toBeNull();
  });
});

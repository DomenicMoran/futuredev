import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { getProgress, markLessonRead, markLessonState } from '../data/progress.js';
import { drawRound, evaluateRound } from './roundLogic.js';
import { recordQuizRound } from './results.js';
import { makeTestPool, must } from './testPool.js';

describe('recordQuizRound (AP-3.5, Punkt 1: Ergebnis nach exam_results/progress, Leitner-Fach je Frage)', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('speichert Quizpass bei neuer Lektion, behauptet nicht gelesen und verbindet späteren Leseabschluss', async () => {
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 1);
    const answers = round.drawn.map((q, i) => ({
      questionIndex: i,
      chosenOptionIndex: q.options.findIndex((o) => o.isCorrect),
    }));
    const result = evaluateRound(round, answers);
    expect(result.passed).toBe(true);

    await recordQuizRound({ scope: { type: 'lesson', lessonId: 'M01-01-01' }, round, answers, result });

    const progress = await getProgress('M01-01-01');
    expect(progress).toMatchObject({ state: 'new', quizScore: 100, quizPassed: true });
    expect((await markLessonRead('M01-01-01')).state).toBe('completed');
    expect(await (await getDatabase()).listExamResults('M01-01-01')).toHaveLength(1);
  });

  it('trägt ein bestandenes Lektionsquiz als completed in progress ein und legt exam_results an', async () => {
    // Core erlaubt "quiz_passed" nur nach "read" oder "listened" (progress.ts,
    // ALLOWED_TRANSITIONS): erst die Lektion wie beim normalen Durchgang lesen.
    await markLessonState('M01-01-01', 'started');
    await markLessonState('M01-01-01', 'read');

    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 1);
    const answers = round.drawn.map((q, i) => ({
      questionIndex: i,
      chosenOptionIndex: q.options.findIndex((o) => o.isCorrect),
    }));
    const result = evaluateRound(round, answers);
    expect(result.passed).toBe(true);

    await recordQuizRound({ scope: { type: 'lesson', lessonId: 'M01-01-01' }, round, answers, result });

    const progress = await getProgress('M01-01-01');
    expect(progress?.state).toBe('completed');
    expect(progress?.quizPassed).toBe(true);

    const db = await getDatabase();
    const examResults = await db.listExamResults('M01-01-01');
    expect(examResults).toHaveLength(1);
    expect(must(examResults[0]).passed).toBe(true);
    expect(must(examResults[0]).score).toBe(100);
  });

  it('lässt progress unverändert, wenn die Runde nicht bestanden ist, setzt aber das Leitner-Fach falscher Fragen zurück', async () => {
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 1);
    // Erst alles richtig beantworten, damit die erste Karte ein höheres Fach hat...
    const allCorrect = round.drawn.map((q, i) => ({ questionIndex: i, chosenOptionIndex: q.options.findIndex((o) => o.isCorrect) }));
    await recordQuizRound({
      scope: { type: 'lesson', lessonId: 'M01-01-01' },
      round,
      answers: allCorrect,
      result: evaluateRound(round, allCorrect),
    });
    const db = await getDatabase();
    const firstQuestion = must(round.drawn[0]);
    const sourceLessonId = must(firstQuestion.sourceLessonId);
    const questionId = must(firstQuestion.questionId);
    const afterCorrect = await db.getReview(sourceLessonId, questionId);
    expect(afterCorrect?.leitnerStage).toBe(2);

    // ...dann dieselbe Frage falsch beantworten: Fach fällt auf 1 zurück.
    const wrongRound = drawRound(pool, 10, 9);
    const targetIndex = wrongRound.drawn.findIndex((question) => question.questionId === questionId);
    const wrongOptionIndex = must(wrongRound.drawn[targetIndex]).options.findIndex((o) => !o.isCorrect);
    const mostlyWrong = wrongRound.drawn.map((q, i) => ({
      questionIndex: i,
      chosenOptionIndex: i === targetIndex ? wrongOptionIndex : q.options.findIndex((o) => o.isCorrect),
    }));
    // Nur eine Frage falsch von zehn reicht nicht, um durchzufallen (90 %),
    // trotzdem muss das Leitner-Fach dieser einen Frage zurückfallen.
    await recordQuizRound({
      scope: { type: 'lesson', lessonId: 'M01-01-01' },
      round: wrongRound,
      answers: mostlyWrong,
      result: evaluateRound(wrongRound, mostlyWrong),
    });
    const afterWrong = await db.getReview(sourceLessonId, questionId);
    expect(afterWrong?.leitnerStage).toBe(1);
    expect(afterWrong?.errorCount).toBe(1);
  });

  it('trägt eine Modulprüfung mit ihrem eigenen Geltungsbereich nach exam_results ein, ohne progress zu berühren', async () => {
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 1);
    const answers = round.drawn.map((q, i) => ({ questionIndex: i, chosenOptionIndex: q.options.findIndex((o) => o.isCorrect) }));
    const result = evaluateRound(round, answers);

    await recordQuizRound({ scope: { type: 'module', moduleId: 'M01' }, round, answers, result });

    const db = await getDatabase();
    const examResults = await db.listExamResults('module:M01');
    expect(examResults).toHaveLength(1);
    expect(await getProgress('M01-01-01')).toBeUndefined();
  });

  it('speichert Passflag bei started ohne falschen Lesestatus; Pass bleibt bei schlechterem Retake und Score ist bestes Ergebnis', async () => {
    await markLessonState('M01-01-01', 'started');
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 71);
    const correct = round.drawn.map((q, i) => ({ questionIndex: i, chosenOptionIndex: q.options.findIndex((o) => o.isCorrect) }));
    await recordQuizRound({ scope: { type: 'lesson', lessonId: 'M01-01-01' }, round, answers: correct, result: evaluateRound(round, correct) });
    expect(await getProgress('M01-01-01')).toMatchObject({ state: 'started', quizScore: 100, quizPassed: true });
    const failedRound = drawRound(pool, 10, 72);
    const wrong = failedRound.drawn.map((q, i) => ({ questionIndex: i, chosenOptionIndex: q.options.findIndex((o) => !o.isCorrect) }));
    const failedResult = evaluateRound(failedRound, wrong);
    expect(failedResult.passed).toBe(false);
    await recordQuizRound({ scope: { type: 'lesson', lessonId: 'M01-01-01' }, round: failedRound, answers: wrong, result: failedResult });
    expect(await getProgress('M01-01-01')).toMatchObject({ state: 'started', quizScore: 100, quizPassed: true });
    expect((await markLessonRead('M01-01-01')).state).toBe('completed');
  });

  it('verknüpft gemischte/all-Prüfungsfragen trotz Shuffle mit unveränderten Content-Identitäten', async () => {
    const pool = [
      ...makeTestPool(10).map((question, index) => ({ ...question, sourceLessonId: 'M01-01-01', questionId: `q-a-${index}` })),
      ...makeTestPool(10).map((question, index) => ({ ...question, sourceLessonId: 'M02-01-01', questionId: `q-b-${index}` })),
    ];
    const round = drawRound(pool, 20, 127);
    const answers = round.drawn.map((question, questionIndex) => ({
      questionIndex,
      chosenOptionIndex: question.options.findIndex((option) => option.isCorrect),
    }));
    await recordQuizRound({ scope: { type: 'all' }, round, answers, result: evaluateRound(round, answers) });
    const rows = await (await getDatabase()).listReviews();
    expect(rows).toHaveLength(20);
    expect(new Set(rows.map((row) => `${row.sourceLessonId}:${row.questionId}`))).toEqual(
      new Set(pool.map((question) => `${question.sourceLessonId}:${question.questionId}`)),
    );
  });

  it('rollt bei letztem Leitner-Schreibfehler die gesamte Runde zurück und retryt genau einmal', async () => {
    const db = resetToMemoryDatabase();
    const pool = makeTestPool(10);
    const round = drawRound(pool, 10, 981);
    const answers = round.drawn.map((question, questionIndex) => ({
      questionIndex,
      chosenOptionIndex: question.options.findIndex((option) => option.isCorrect),
    }));
    const input = { scope: { type: 'lesson' as const, lessonId: 'M01-01-01' }, round, answers, result: evaluateRound(round, answers) };
    const originalUpsert = db.upsertReview.bind(db);
    let writeCount = 0;
    db.upsertReview = async (row) => {
      writeCount += 1;
      if (writeCount === 10) throw new Error('forced failure on last card');
      return originalUpsert(row);
    };

    await expect(recordQuizRound(input)).rejects.toThrow('forced failure on last card');
    expect(await db.listExamResults()).toEqual([]);
    expect(await db.listReviews()).toEqual([]);

    db.upsertReview = originalUpsert;
    await recordQuizRound(input);
    const savedRows = await db.listReviews();
    expect(savedRows).toHaveLength(10);
    expect(savedRows.every((row) => row.leitnerStage === 2 && row.errorCount === 0)).toBe(true);
    const beforeRetry = await db.listExamResults();
    expect(beforeRetry).toHaveLength(1);
    await recordQuizRound(input);
    expect(await db.listReviews()).toEqual(savedRows);
    expect(await db.listExamResults()).toEqual(beforeRetry);
  });
});

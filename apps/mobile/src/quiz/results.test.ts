import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase, getDatabase } from '../data/db.js';
import { getProgress, markLessonState } from '../data/progress.js';
import { drawRound, evaluateRound } from './roundLogic.js';
import { recordQuizRound, reviewCardId } from './results.js';
import { makeTestPool, must } from './testPool.js';

describe('recordQuizRound (AP-3.5, Punkt 1: Ergebnis nach exam_results/progress, Leitner-Fach je Frage)', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('trägt ein bestandenes Lektionsquiz als quiz_passed in progress ein und legt exam_results an', async () => {
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
    expect(progress?.state).toBe('quiz_passed');
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
    const cardId = reviewCardId('M01-01-01', 0);
    const afterCorrect = await db.getReview(cardId);
    expect(afterCorrect?.leitnerStage).toBe(2);

    // ...dann dieselbe Frage falsch beantworten: Fach fällt auf 1 zurück.
    const wrongOptionIndex = must(round.drawn[0]).options.findIndex((o) => !o.isCorrect);
    const mostlyWrong = round.drawn.map((q, i) => ({
      questionIndex: i,
      chosenOptionIndex: i === 0 ? wrongOptionIndex : q.options.findIndex((o) => o.isCorrect),
    }));
    // Nur eine Frage falsch von zehn reicht nicht, um durchzufallen (90 %),
    // trotzdem muss das Leitner-Fach dieser einen Frage zurückfallen.
    await recordQuizRound({
      scope: { type: 'lesson', lessonId: 'M01-01-01' },
      round,
      answers: mostlyWrong,
      result: evaluateRound(round, mostlyWrong),
    });
    const afterWrong = await db.getReview(cardId);
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
});

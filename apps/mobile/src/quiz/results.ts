// Schreibt das Ergebnis einer Quizrunde über Agent B's Datenzugriffsschicht
// (`src/data/`: exam_results, reviews, progress).
import { createCard, reviewCard, transitionLesson, createLessonProgress, PASS_THRESHOLD_PERCENT, type LeitnerBox, type QuizAnswer, type QuizResult } from '@futuredev/core';
import { getDatabase } from '../data/db.js';
import type { QuizRound, QuizScope } from './roundLogic.js';
import { scopeKey } from './roundLogic.js';
import { reviewCardKey } from '../review/cards.js';

/** Durable identity independent of round/module/all shuffle indices. */
export function reviewCardId(sourceLessonId: string, questionId: string): string {
  return reviewCardKey(sourceLessonId, questionId);
}

export interface RecordQuizRoundInput {
  scope: QuizScope;
  round: QuizRound;
  answers: QuizAnswer[];
  result: QuizResult;
  now?: Date;
}

/**
 * Speichert das Ergebnis einer Runde: exam_results immer, bei einer Lektionsrunde
 * zusätzlich bestes Ergebnis/Passflag (unabhängig vom Lesen) und je Frage die
 * Leitner-Karte (richtig beantwortet rückt vor, falsch fällt zurück).
 */
export async function recordQuizRound(input: RecordQuizRoundInput): Promise<void> {
  const db = await getDatabase();
  const now = input.now ?? new Date();
  const id = `${scopeKey(input.scope)}-${input.round.id}`;
  await db.transaction(async (tx) => {
    // A retry after an ambiguous UI/network failure sees the transaction's
    // durable result ID and does not advance any Leitner card a second time.
    if ((await tx.listExamResults()).some((existing) => existing.id === id)) return;
    await tx.insertExamResult({
      id,
      scope: input.scope.type === 'lesson' ? input.scope.lessonId : scopeKey(input.scope),
      score: Math.round(input.result.scorePercent),
      passed: input.result.passed,
      takenAt: now.toISOString(),
    });

    for (const answer of input.answers) {
      const question = input.round.drawn[answer.questionIndex];
      if (!question) continue;
      if (!question.questionId || !question.sourceLessonId) {
        throw new Error('Quizfrage ohne stabile Herkunftskennung kann nicht für Wiederholung gespeichert werden.');
      }
      const existing = await tx.getReview(question.sourceLessonId, question.questionId);
      const cardId = reviewCardId(question.sourceLessonId, question.questionId);
      const card = existing
        ? { id: cardId, box: (existing.leitnerStage || 1) as LeitnerBox, dueAt: existing.dueAt, errorCount: existing.errorCount }
        : createCard(cardId, now);
      const updated = reviewCard(card, Boolean(question.options[answer.chosenOptionIndex]?.isCorrect), now);
      await tx.upsertReview({
        sourceLessonId: question.sourceLessonId,
        questionId: question.questionId,
        leitnerStage: updated.box,
        dueAt: updated.dueAt,
        errorCount: updated.errorCount,
      });
    }

    // Best score is monotonic; an earned pass is sticky. A quiz alone does not
    // prove reading, so new/started remain there until explicit content completion.
    if (input.scope.type === 'lesson') {
      const lessonId = input.scope.lessonId;
      const progress = await tx.getProgress(lessonId) ?? {
        ...createLessonProgress(lessonId), readUntil: null, listenedUntil: null,
        quizScore: null, quizPassed: false, updatedAt: now.toISOString(),
      };
      const passed = progress.quizPassed || input.result.scorePercent >= PASS_THRESHOLD_PERCENT;
      let state = progress.state;
      if (passed && (state === 'read' || state === 'listened')) {
        state = transitionLesson({ lessonId, state }, 'quiz_passed').state;
        state = transitionLesson({ lessonId, state }, 'completed').state;
      }
      const score = Math.round(input.result.scorePercent);
      await tx.upsertProgress({
        ...progress, state,
        quizScore: progress.quizScore === null ? score : Math.max(progress.quizScore, score),
        quizPassed: passed,
        updatedAt: now.toISOString(),
      });
    }
  });
}

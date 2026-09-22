// Schreibt das Ergebnis einer Quizrunde über Agent B's Datenzugriffsschicht
// (`src/data/`: exam_results, reviews, progress).
import { createCard, reviewCard, PASS_THRESHOLD_PERCENT, type LeitnerBox, type QuizAnswer, type QuizResult } from '@futuredev/core';
import { getDatabase } from '../data/db.js';
import { getProgress, markLessonState } from '../data/progress.js';
import type { QuizRound, QuizScope } from './roundLogic.js';
import { scopeKey } from './roundLogic.js';

// Reviews sind laut datenmodell.md je Lektion (`lesson_id` Primärschlüssel),
// die Wiederholung im Quiz läuft aber je Frage (AP-3.5, Punkt 1: "Fehler je
// Frage nach reviews"). Angenommene Erweiterung, dokumentiert hier: die
// Karten-Kennung kombiniert Lektion und Fragenindex.
export function reviewCardId(lessonId: string, questionIndex: number): string {
  return `${lessonId}#q${questionIndex}`;
}

/** Bewertet eine beantwortete Frage in der Leitner-Wiederholung (richtig rückt vor, falsch fällt auf Fach 1). */
export async function updateReviewCard(cardId: string, wasCorrect: boolean, now: Date = new Date()): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getReview(cardId);
  const card = existing
    ? { id: cardId, box: (existing.leitnerStage || 1) as LeitnerBox, dueAt: existing.dueAt, errorCount: existing.errorCount }
    : createCard(cardId, now);
  const updated = reviewCard(card, wasCorrect, now);
  await db.upsertReview({
    lessonId: updated.id,
    leitnerStage: updated.box,
    dueAt: updated.dueAt,
    errorCount: updated.errorCount,
  });
}

/** Core erlaubt quiz_passed nur aus read/listened — fehlende Zwischenzustände nachholen. */
async function ensureLessonReadyForQuizPass(lessonId: string): Promise<void> {
  let row = await getProgress(lessonId);
  let state = row?.state ?? 'new';
  if (state === 'new') {
    row = await markLessonState(lessonId, 'started');
    state = row.state;
  }
  if (state === 'started') {
    await markLessonState(lessonId, 'read');
  }
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
 * zusätzlich den Fortschritt (`quiz_passed` und `completed` ab 80 Prozent) und je Frage die
 * Leitner-Karte (richtig beantwortet rückt vor, falsch fällt zurück).
 */
export async function recordQuizRound(input: RecordQuizRoundInput): Promise<void> {
  const db = await getDatabase();
  const now = input.now ?? new Date();
  const id = `${scopeKey(input.scope)}-${now.getTime()}`;
  await db.insertExamResult({
    id,
    scope: input.scope.type === 'lesson' ? input.scope.lessonId : scopeKey(input.scope),
    score: Math.round(input.result.scorePercent),
    passed: input.result.passed,
    takenAt: now.toISOString(),
  });

  const lessonIdForCard = input.scope.type === 'lesson' ? input.scope.lessonId : scopeKey(input.scope);
  for (const answer of input.answers) {
    const question = input.round.drawn[answer.questionIndex];
    if (!question) continue;
    const chosen = question.options[answer.chosenOptionIndex];
    await updateReviewCard(reviewCardId(lessonIdForCard, answer.questionIndex), Boolean(chosen?.isCorrect), now);
  }

  if (input.scope.type === 'lesson' && input.result.scorePercent >= PASS_THRESHOLD_PERCENT) {
    const lessonId = input.scope.lessonId;
    await ensureLessonReadyForQuizPass(lessonId);
    await markLessonState(lessonId, 'quiz_passed', {
      quizScore: Math.round(input.result.scorePercent),
      quizPassed: true,
    });
    await markLessonState(lessonId, 'completed');
  }
}

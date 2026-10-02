// Bestimmt, welche Lektion für die Tagesration geöffnet wird. Vereinfachung
// (Stand dieses Auftrags, nur eine veröffentlichte Lektion): die
// Wiederholungsrunde läuft über die normale Lektionsquiz-Route
// (app/quiz/[lessonId].tsx), weil sie ohnehin jede beantwortete Frage in
// `reviews` einträgt (src/quiz/results.ts), unabhängig vom Geltungsbereich.
// Bei mehreren Lektionen mit fälligen Karten wird die mit den meisten
// fälligen Fragen gewählt; eine gemischte Runde über mehrere Lektionen ist
// eine spätere Ausbaustufe, sobald Agent B mehrere Lektionen liefert.
import type { LeitnerCard } from '@futuredev/core';
import type { QuizQuestionInput } from '@futuredev/core';
import { reviewCardKey } from './cards.js';

/** Resolves due review-card IDs to their exact content questions, never whole lessons. */
export function selectReviewQuestionsForCards(
  pool: QuizQuestionInput[],
  cardIds: string[],
): { questions: QuizQuestionInput[]; missingCardIds: string[] } {
  const requested = [...new Set(cardIds)];
  const wanted = new Set(requested);
  const questions = pool.filter((question) =>
    wanted.has(reviewCardKey(question.sourceLessonId, question.questionId)),
  );
  const found = new Set(questions.map((question) => reviewCardKey(question.sourceLessonId, question.questionId)));
  return { questions, missingCardIds: requested.filter((id) => !found.has(id)) };
}

export function lessonIdOfCard(cardId: string): string {
  if (cardId.startsWith('review:')) {
    const separator = cardId.indexOf(':', 7);
    if (separator < 0) return '';
    try { return decodeURIComponent(cardId.slice(7, separator)); } catch { return ''; }
  }
  return '';
}

export function pickReviewLesson(cards: LeitnerCard[]): string | null {
  if (cards.length === 0) return null;
  const counts = new Map<string, number>();
  for (const card of cards) {
    const lessonId = lessonIdOfCard(card.id);
    counts.set(lessonId, (counts.get(lessonId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [lessonId, count] of counts) {
    if (count > bestCount) {
      best = lessonId;
      bestCount = count;
    }
  }
  return best;
}

// Bestimmt, welche Lektion für die Tagesration geöffnet wird. Vereinfachung
// (Stand dieses Auftrags, nur eine veröffentlichte Lektion): die
// Wiederholungsrunde läuft über die normale Lektionsquiz-Route
// (app/quiz/[lessonId].tsx), weil sie ohnehin jede beantwortete Frage in
// `reviews` einträgt (src/quiz/results.ts), unabhängig vom Geltungsbereich.
// Bei mehreren Lektionen mit fälligen Karten wird die mit den meisten
// fälligen Fragen gewählt; eine gemischte Runde über mehrere Lektionen ist
// eine spätere Ausbaustufe, sobald Agent B mehrere Lektionen liefert.
import type { LeitnerCard } from '@futuredev/core';

export function lessonIdOfCard(cardId: string): string {
  return cardId.split('#')[0] ?? cardId;
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

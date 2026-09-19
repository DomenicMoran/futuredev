// Leitner-Wiederholung mit fünf Fächern und den Abständen 1/2/4/8/16 Tage
// (Zusatzauftrag Phase 2, Punkt 6; Vorbild 10_Projekte/Sprechzettel/Wissen/
// wiederholung-und-lernpfad.md, hier auf fünf feste Fächer vereinfacht statt
// wachsender Abstände bis 30 Tage).

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

const DAY_MS = 24 * 60 * 60 * 1000;

// Index 0 = Fach 1, Index 4 = Fach 5.
export const BOX_INTERVAL_DAYS: readonly number[] = [1, 2, 4, 8, 16];

export interface LeitnerCard {
  id: string;
  box: LeitnerBox;
  dueAt: string; // ISO-Zeitstempel
  errorCount: number;
}

function intervalDaysForBox(box: LeitnerBox): number {
  const days = BOX_INTERVAL_DAYS[box - 1];
  if (days === undefined) {
    throw new Error(`unbekanntes Leitner-Fach: ${box}`);
  }
  return days;
}

export function createCard(id: string, now: Date = new Date()): LeitnerCard {
  return {
    id,
    box: 1,
    dueAt: new Date(now.getTime() + intervalDaysForBox(1) * DAY_MS).toISOString(),
    errorCount: 0,
  };
}

/**
 * Bewertet eine Karte: richtig beantwortet rückt ein Fach auf (höchstens Fach 5),
 * falsch beantwortet fällt auf Fach 1 zurück und erhöht die Fehlerzahl. Der neue
 * Fälligkeitstermin folgt aus dem Abstand des neuen Fachs.
 */
export function reviewCard(card: LeitnerCard, wasCorrect: boolean, now: Date = new Date()): LeitnerCard {
  const nextBox: LeitnerBox = wasCorrect
    ? (Math.min(5, card.box + 1) as LeitnerBox)
    : 1;
  return {
    id: card.id,
    box: nextBox,
    dueAt: new Date(now.getTime() + intervalDaysForBox(nextBox) * DAY_MS).toISOString(),
    errorCount: wasCorrect ? card.errorCount : card.errorCount + 1,
  };
}

export function isDue(card: LeitnerCard, now: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

/**
 * Priorität = Fehlerzahl gewichtet mit Überfälligkeit. Überfälligkeit misst, wie
 * viele eigene Fach-Abstände die Karte bereits über ihre Fälligkeit hinaus ist
 * (0, wenn noch nicht fällig). (errorCount + 1) sorgt dafür, dass auch fehlerfreie
 * fällige Karten eine Priorität über 0 bekommen, mehrfach falsch beantwortete
 * Karten aber stärker wiegen.
 */
export function priority(card: LeitnerCard, now: Date = new Date()): number {
  const dueAtMs = new Date(card.dueAt).getTime();
  const overdueMs = now.getTime() - dueAtMs;
  if (overdueMs <= 0) return 0;
  const intervalMs = intervalDaysForBox(card.box) * DAY_MS;
  const overdueRatio = overdueMs / intervalMs;
  return (card.errorCount + 1) * overdueRatio;
}

/** Sortiert Karten absteigend nach Priorität, überfällige und fehlerreiche zuerst. */
export function sortByPriority(cards: LeitnerCard[], now: Date = new Date()): LeitnerCard[] {
  return [...cards].sort((a, b) => priority(b, now) - priority(a, now));
}

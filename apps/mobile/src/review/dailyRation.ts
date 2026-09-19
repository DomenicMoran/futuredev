// Tagesration aus @futuredev/core (leitner.ts): fällige Karten nach Priorität,
// Anzahl aus settings.dailyGoalMinutes skaliert mit der Wiederholungsintensität
// (lehrplan-konzept.md, Abschnitt 6). Reine Logik, ohne SQLite, damit sie ohne
// Gerät testbar bleibt.
import { isDue, sortByPriority, type LeitnerCard } from '@futuredev/core';
import { REVIEW_INTENSITY_FACTOR, type ReviewIntensity } from '../settings/types.js';

// Annahme (im Auftrag nicht beziffert): im Schnitt zwei Minuten je
// Wiederholungsfrage, daraus folgt die Rationsgröße aus dem Tagesziel in
// Minuten. Untergrenze eine Frage, auch bei einem sehr kleinen Tagesziel.
const MINUTES_PER_REVIEW_QUESTION = 2;

export function dailyRationSize(dailyGoalMinutes: number, intensity: ReviewIntensity): number {
  const factor = REVIEW_INTENSITY_FACTOR[intensity];
  return Math.max(1, Math.round((dailyGoalMinutes / MINUTES_PER_REVIEW_QUESTION) * factor));
}

/** Fällige Karten, sortiert nach Priorität, auf die Rationsgröße gekappt. */
export function selectDailyRation(cards: LeitnerCard[], size: number, now: Date = new Date()): LeitnerCard[] {
  const due = cards.filter((c) => isDue(c, now));
  return sortByPriority(due, now).slice(0, size);
}

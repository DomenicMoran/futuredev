import type { LessonState } from '@futuredev/core';
import { transitionLesson, createLessonProgress } from '@futuredev/core';
import { getDatabase } from './db.js';
import type { ProgressRow } from './types.js';

/** Fortschritt einer Lektion lesen, oder `undefined`, wenn sie noch nie geoeffnet wurde. */
export async function getProgress(lessonId: string): Promise<ProgressRow | undefined> {
  const db = await getDatabase();
  return db.getProgress(lessonId);
}

export async function listProgress(): Promise<ProgressRow[]> {
  const db = await getDatabase();
  return db.listProgress();
}

export async function upsertProgress(row: ProgressRow): Promise<void> {
  const db = await getDatabase();
  await db.upsertProgress(row);
}

/**
 * Wendet einen erlaubten Zustandsuebergang an (siehe `@futuredev/core`,
 * `transitionLesson`) und speichert das Ergebnis. Nicht erlaubte Uebergaenge
 * (etwa "gehoert" nach bereits "abgeschlossen") lassen den Zustand
 * unveraendert, aendern aber `readUntil`/`listenedUntil` trotzdem, falls
 * mitgegeben.
 */
export async function markLessonState(
  lessonId: string,
  nextState: LessonState,
  extra: Partial<Pick<ProgressRow, 'readUntil' | 'listenedUntil' | 'quizScore' | 'quizPassed'>> = {},
): Promise<ProgressRow> {
  const existing = await getProgress(lessonId);
  const current = existing ?? {
    lessonId,
    state: createLessonProgress(lessonId).state,
    readUntil: null,
    listenedUntil: null,
    quizScore: null,
    quizPassed: false,
    updatedAt: new Date().toISOString(),
  };
  const transitioned = transitionLesson({ lessonId, state: current.state }, nextState);
  const updated: ProgressRow = {
    ...current,
    ...extra,
    state: transitioned.state,
    updatedAt: new Date().toISOString(),
  };
  await upsertProgress(updated);
  return updated;
}

/** Merkt sich den zuletzt sichtbaren Sprechblock (Lesefortschritt). */
export async function saveReadPosition(lessonId: string, blockIndex: number): Promise<ProgressRow> {
  const existing = await getProgress(lessonId);
  const nextState: LessonState = existing?.state === 'new' ? 'started' : (existing?.state ?? 'started');
  return markLessonState(lessonId, nextState, { readUntil: blockIndex });
}

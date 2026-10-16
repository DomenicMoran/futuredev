import { createCard, reviewCard, type LeitnerBox } from '@futuredev/core';

/** Evidence, not a promise of permanent mastery. Only spaced, confident recalls advance. */
export interface RecallEvidence {
  stage: LeitnerBox;
  successes: number;
  errors: number;
  lastAt: string;
  dueAt: string;
}

export function updateRecall(
  previous: RecallEvidence | undefined,
  correct: boolean,
  now: Date,
): RecallEvidence {
  if (!Number.isFinite(now.getTime())) throw new Error('Ungültiger Prüfungszeitpunkt.');
  if (previous && now.getTime() < Date.parse(previous.lastAt))
    throw new Error(
      'Die Gerätezeit liegt vor der letzten Antwort. Bitte Datum und Uhrzeit prüfen.',
    );
  // Practising early is allowed, but must not manufacture days of consolidation.
  if (correct && previous && previous.successes > 0 && now.getTime() < Date.parse(previous.dueAt))
    return { ...previous, lastAt: now.toISOString() };
  const card =
    previous && correct && previous.successes > 0
      ? reviewCard(
          { id: '', box: previous.stage, errorCount: previous.errors, dueAt: previous.dueAt },
          true,
          now,
        )
      : createCard('', now);
  return {
    stage: card.box,
    successes: correct ? (previous?.successes ?? 0) + 1 : 0,
    errors: (previous?.errors ?? 0) + (correct ? 0 : 1),
    lastAt: now.toISOString(),
    dueAt: card.dueAt,
  };
}

export function validRecall(value: RecallEvidence): boolean {
  return (
    !!value &&
    Number.isInteger(value.stage) &&
    value.stage >= 1 &&
    value.stage <= 5 &&
    Number.isInteger(value.successes) &&
    value.successes >= 0 &&
    value.stage === Math.min(5, Math.max(1, value.successes)) &&
    Number.isInteger(value.errors) &&
    value.errors >= 0 &&
    typeof value.lastAt === 'string' &&
    typeof value.dueAt === 'string' &&
    Number.isFinite(Date.parse(value.lastAt)) &&
    Number.isFinite(Date.parse(value.dueAt)) &&
    Date.parse(value.dueAt) >= Date.parse(value.lastAt)
  );
}

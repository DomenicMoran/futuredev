// Schlaf-Timer-Berechnung als reine Funktion: aus dem gewählten Modus und dem
// aktuellen Zeitpunkt (bzw. der Lektionsdauer) wird der Zielzeitpunkt/die
// Ziel-Position berechnet, an der die Wiedergabe ausgeblendet werden soll.
import type { SleepTimerMode } from './types.js';

export interface SleepTimerTarget {
  // Zeitpunkt (ms seit Epoch), an dem der Timer ablaeuft.
  readonly endsAtMs: number;
}

/**
 * nowMs: aktueller Zeitpunkt. Bei "Ende der Lektion" wird die verbleibende
 * Zeit aus positionSeconds/durationSeconds berechnet (aktuelle
 * Wiedergabegeschwindigkeit bleibt unberuecksichtigt, der Timer bezieht sich
 * auf Wiedergabezeit, nicht auf Medienzeit, siehe startSleepTimer in index.ts,
 * das bei Tempoaenderung neu rechnet).
 */
export function computeSleepTimerTarget(
  mode: SleepTimerMode,
  nowMs: number,
  positionSeconds: number,
  durationSeconds: number,
): SleepTimerTarget {
  if (mode.kind === 'minutes') {
    return { endsAtMs: nowMs + mode.minutes * 60_000 };
  }
  const remainingSeconds = Math.max(durationSeconds - positionSeconds, 0);
  return { endsAtMs: nowMs + remainingSeconds * 1000 };
}

/** Ob der Timer bereits abgelaufen ist. */
export function isSleepTimerElapsed(target: SleepTimerTarget, nowMs: number): boolean {
  return nowMs >= target.endsAtMs;
}

// Sanftes Ausblenden statt hartem Abbruch (Vorgabe UX Abschnitt 4): letzte
// FADE_OUT_MS vor dem Zielzeitpunkt linear auf 0 fahren.
export const SLEEP_TIMER_FADE_OUT_MS = 8_000;

export function volumeForSleepTimer(target: SleepTimerTarget, nowMs: number): number {
  const remainingMs = target.endsAtMs - nowMs;
  if (remainingMs <= 0) return 0;
  if (remainingMs >= SLEEP_TIMER_FADE_OUT_MS) return 1;
  return remainingMs / SLEEP_TIMER_FADE_OUT_MS;
}

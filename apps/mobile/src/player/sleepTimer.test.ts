import { describe, expect, it } from 'vitest';
import {
  SLEEP_TIMER_FADE_OUT_MS,
  computeSleepTimerTarget,
  isSleepTimerElapsed,
  volumeForSleepTimer,
} from './sleepTimer.js';

describe('computeSleepTimerTarget', () => {
  it('berechnet den Zielzeitpunkt aus Minuten', () => {
    const target = computeSleepTimerTarget({ kind: 'minutes', minutes: 15 }, 0, 0, 600);
    expect(target.endsAtMs).toBe(15 * 60_000);
  });

  it('berechnet "Ende der Lektion" aus der verbleibenden Spielzeit', () => {
    const target = computeSleepTimerTarget({ kind: 'endOfLesson' }, 1_000, 100, 160);
    expect(target.endsAtMs).toBe(1_000 + 60_000);
  });

  it('wird bei "Ende der Lektion" nach dem Ende nicht negativ', () => {
    const target = computeSleepTimerTarget({ kind: 'endOfLesson' }, 1_000, 200, 160);
    expect(target.endsAtMs).toBe(1_000);
  });
});

describe('isSleepTimerElapsed', () => {
  it('ist erst ab dem Zielzeitpunkt abgelaufen', () => {
    const target = { endsAtMs: 1_000 };
    expect(isSleepTimerElapsed(target, 999)).toBe(false);
    expect(isSleepTimerElapsed(target, 1_000)).toBe(true);
  });
});

describe('volumeForSleepTimer', () => {
  it('liefert volle Lautstärke außerhalb des Ausblendfensters', () => {
    const target = { endsAtMs: 100_000 };
    expect(volumeForSleepTimer(target, 100_000 - SLEEP_TIMER_FADE_OUT_MS - 1)).toBe(1);
  });

  it('blendet linear auf 0 aus', () => {
    const target = { endsAtMs: 100_000 };
    expect(volumeForSleepTimer(target, 100_000 - SLEEP_TIMER_FADE_OUT_MS / 2)).toBeCloseTo(0.5);
  });

  it('ist 0 nach Ablauf', () => {
    const target = { endsAtMs: 100_000 };
    expect(volumeForSleepTimer(target, 100_001)).toBe(0);
  });
});

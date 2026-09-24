import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase } from '../data/db.js';
import { setSetting } from '../data/settings.js';
import {
  applyDeltaToDailyTotal,
  clampListenDelta,
  computeListenDelta,
  DAILY_LEARNING_DATE_KEY,
  DAILY_LEARNING_SECONDS_KEY,
  MAX_DAILY_LEARNING_SECONDS,
  MAX_LISTEN_DELTA_SECONDS,
  resolveStoredDailySeconds,
} from './dailyLearning.js';

describe('dailyLearning accumulator (pure)', () => {
  const today = '2026-09-24';

  it('clamp: negative und NaN-Deltas werden 0', () => {
    expect(clampListenDelta(-3)).toBe(0);
    expect(clampListenDelta(Number.NaN)).toBe(0);
  });

  it('clamp: Delta über dem Save-Intervall wird begrenzt', () => {
    expect(clampListenDelta(120, MAX_LISTEN_DELTA_SECONDS)).toBe(MAX_LISTEN_DELTA_SECONDS);
    expect(clampListenDelta(4, MAX_LISTEN_DELTA_SECONDS)).toBe(4);
  });

  it('computeListenDelta: Rückwärts-Seek liefert 0', () => {
    expect(computeListenDelta(100, 40)).toBe(0);
    expect(computeListenDelta(10, 10)).toBe(0);
  });

  it('Tagwechsel: gespeicherter Stand zählt nur am selben Datum', () => {
    expect(resolveStoredDailySeconds('2026-09-23', 600, today)).toBe(0);
    expect(resolveStoredDailySeconds(today, 600, today)).toBe(600);
  });

  it('applyDeltaToDailyTotal: addiert und setzt Datum auf heute', () => {
    const result = applyDeltaToDailyTotal(today, 120, today, 5);
    expect(result).toEqual({ date: today, seconds: 125 });
  });

  it('applyDeltaToDailyTotal: nach Mitternacht startet der Zähler bei 0', () => {
    const delta = MAX_LISTEN_DELTA_SECONDS;
    const result = applyDeltaToDailyTotal('2026-09-23', 900, today, delta);
    expect(result).toEqual({ date: today, seconds: delta });
  });

  it('applyDeltaToDailyTotal: Tagesmaximum wird eingehalten', () => {
    const nearMax = MAX_DAILY_LEARNING_SECONDS - 3;
    const result = applyDeltaToDailyTotal(today, nearMax, today, 60);
    expect(result.seconds).toBe(MAX_DAILY_LEARNING_SECONDS);
  });
});

describe('dailyLearning persist (memory DB)', () => {
  beforeEach(() => {
    resetToMemoryDatabase();
  });

  it('readDailyLearningSecondsToday respektiert gespeichertes Datum', async () => {
    const { readDailyLearningSecondsToday } = await import('./dailyLearning.js');
    await setSetting(DAILY_LEARNING_DATE_KEY, '2026-09-24');
    await setSetting(DAILY_LEARNING_SECONDS_KEY, '180');
    expect(await readDailyLearningSecondsToday(new Date('2026-09-24T12:00:00'))).toBe(180);
    expect(await readDailyLearningSecondsToday(new Date('2026-09-25T08:00:00'))).toBe(0);
  });
});

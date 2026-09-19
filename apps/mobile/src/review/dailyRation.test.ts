import { describe, expect, it } from 'vitest';
import type { LeitnerCard } from '@futuredev/core';
import { dailyRationSize, selectDailyRation } from './dailyRation.js';
import { must } from '../quiz/testPool.js';

function card(id: string, dueAt: string, errorCount = 0): LeitnerCard {
  return { id, box: 1, dueAt, errorCount };
}

describe('dailyRationSize', () => {
  it('skaliert mit der Wiederholungsintensität', () => {
    const normal = dailyRationSize(20, 'normal');
    expect(dailyRationSize(20, 'leicht')).toBeLessThan(normal);
    expect(dailyRationSize(20, 'intensiv')).toBeGreaterThan(normal);
  });

  it('liefert mindestens eine Frage, auch bei einem sehr kleinen Tagesziel', () => {
    expect(dailyRationSize(1, 'leicht')).toBeGreaterThanOrEqual(1);
  });
});

describe('selectDailyRation', () => {
  const now = new Date('2026-09-19T12:00:00Z');

  it('wählt nur fällige Karten aus', () => {
    const cards = [card('a', '2026-09-18T00:00:00Z'), card('b', '2026-09-20T00:00:00Z')];
    const ration = selectDailyRation(cards, 10, now);
    expect(ration.map((c) => c.id)).toEqual(['a']);
  });

  it('sortiert überfällige, fehlerreiche Karten nach vorn und kappt auf die Rationsgröße', () => {
    const cards = [
      card('kaum-ueberfaellig', '2026-09-19T11:00:00Z', 0),
      card('stark-ueberfaellig-fehlerreich', '2026-09-10T00:00:00Z', 5),
    ];
    const ration = selectDailyRation(cards, 1, now);
    expect(ration).toHaveLength(1);
    expect(must(ration[0]).id).toBe('stark-ueberfaellig-fehlerreich');
  });
});

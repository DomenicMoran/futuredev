import { describe, expect, it } from 'vitest';
import { earliestFutureDueAt } from './nextDue.js';

describe('earliestFutureDueAt', () => {
  it('compares absolute instants across offset date boundaries, not ISO text', () => {
    const a = '2026-09-26T00:30:00+14:00'; // 25 Sep 10:30Z
    const b = '2026-09-25T23:00:00Z';
    expect(earliestFutureDueAt([b, a], new Date('2026-09-25T09:00:00Z'))).toBe(a);
  });

  it('treats equivalent offset/millisecond representations as the same instant', () => {
    const first = '2026-09-26T00:30:00+14:00';
    const equivalent = '2026-09-25T10:30:00.000Z';
    expect(earliestFutureDueAt([first, equivalent], new Date('2026-09-25T09:00:00Z'))).toBe(first);
  });
});

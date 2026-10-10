import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase } from '../data/db.js';
import { beginHearing, listHearingProgress, mergeHearingRanges, recordHearingSample, resetHearingBaseline } from './hearingProgress.js';

describe('durable actual hearing coverage', () => {
  beforeEach(() => { resetToMemoryDatabase(); resetHearingBaseline(); });
  it('merges overlaps without crediting repeated seconds or filling gaps', () => {
    expect(mergeHearingRanges([[0, 10], [20, 30]], [5, 15], 30)).toEqual([[0, 15], [20, 30]]);
  });
  it('persists finished listening independently of lesson/quiz state', async () => {
    beginHearing('a', 0, true, 0);
    await recordHearingSample('a', 10, 20, true, 1, 10_000);
    await recordHearingSample('a', 20, 20, false, 1, 20_000);
    resetHearingBaseline();
    expect((await listHearingProgress()).a).toEqual({ seconds: 20, duration: 20, completed: true });
  });
  it('never labels a seek to the end as heard', async () => {
    beginHearing('a', 0, true, 0);
    await recordHearingSample('a', 5, 1000, true, 1, 5000);
    await recordHearingSample('a', 1000, 1000, false, 1, 6000);
    expect((await listHearingProgress()).a?.completed).toBe(false);
    expect((await listHearingProgress()).a?.seconds).toBe(5);
  });
  it('supports 2x speed and delayed background samples without a 7-second cutoff', async () => {
    beginHearing('a', 0, true, 0);
    await recordHearingSample('a', 60, 120, true, 2, 30_000);
    await recordHearingSample('a', 120, 120, false, 2, 60_000);
    expect((await listHearingProgress()).a?.completed).toBe(true);
  });
  it('does not double count replay, paused time or a different title', async () => {
    beginHearing('a', 0, true, 0);
    await recordHearingSample('a', 10, 20, false, 1, 10_000);
    await recordHearingSample('a', 10, 20, false, 1, 60_000);
    beginHearing('a', 0, true, 70_000);
    await recordHearingSample('a', 10, 20, true, 1, 80_000);
    await recordHearingSample('b', 10, 20, true, 1, 90_000);
    expect((await listHearingProgress()).a?.seconds).toBe(10);
    expect((await listHearingProgress()).b).toBeUndefined();
  });
  it('ignores malformed imported hearing values', async () => {
    const db = resetToMemoryDatabase();
    await db.setSetting('hearing.v1.a', '{"ranges":[null],"duration":20,"ended":true}');
    expect(await listHearingProgress()).toEqual({});
  });
});

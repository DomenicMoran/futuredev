import { describe, expect, it } from 'vitest';
import { getMeasuredMiniPlayerHeight, setMeasuredMiniPlayerHeight } from './miniPlayerMeasurement.js';

describe('measured mini-player chrome', () => {
  it('updates the reserved height when dynamic text wrapping changes the rendered player size', () => {
    setMeasuredMiniPlayerHeight(112);
    expect(getMeasuredMiniPlayerHeight()).toBe(112);
    setMeasuredMiniPlayerHeight(184);
    expect(getMeasuredMiniPlayerHeight()).toBe(184);
  });

  it('ignores invalid measurements rather than shrinking the reading viewport unpredictably', () => {
    setMeasuredMiniPlayerHeight(160);
    setMeasuredMiniPlayerHeight(Number.NaN);
    expect(getMeasuredMiniPlayerHeight()).toBe(160);
  });
});

import { describe, expect, it } from 'vitest';
import { formatLearningDuration } from './formatDuration.js';

describe('curriculum duration', () => {
  it('uses minutes for lessons and hours for module totals', () => {
    expect(formatLearningDuration(20)).toBe('20 Min.');
    expect(formatLearningDuration(60)).toBe('1 Std.');
    expect(formatLearningDuration(482)).toBe('8 Std. 2 Min.');
    expect(formatLearningDuration(898)).toBe('14 Std. 58 Min.');
  });
});

import { describe, expect, it } from 'vitest';
import { getReviewDeckStatus } from './deckStatus.js';

describe('review deck status', () => {
  it('distinguishes not-yet-loaded, truly empty, future-only, due, and failed refresh with cached rows', () => {
    expect(getReviewDeckStatus(null, null, false)).toBe('loading');
    expect(getReviewDeckStatus(0, 0, false)).toBe('empty');
    expect(getReviewDeckStatus(8, 0, false)).toBe('future');
    expect(getReviewDeckStatus(8, 2, false)).toBe('due');
    expect(getReviewDeckStatus(8, 2, true)).toBe('error');
  });
});

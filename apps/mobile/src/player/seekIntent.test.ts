import { beforeEach, describe, expect, it } from 'vitest';
import { beginSeekIntent, invalidateSeekIntent, isCurrentSeekIntent } from './seekIntent.js';

describe('seek intents', () => {
  beforeEach(() => invalidateSeekIntent());

  it('invalidates an older pending seek after a new seek or track selection', () => {
    const old = beginSeekIntent();
    expect(isCurrentSeekIntent(old)).toBe(true);
    const newer = beginSeekIntent();
    expect(isCurrentSeekIntent(old)).toBe(false);
    expect(isCurrentSeekIntent(newer)).toBe(true);
    invalidateSeekIntent();
    expect(isCurrentSeekIntent(newer)).toBe(false);
  });
});

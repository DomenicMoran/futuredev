import { describe, expect, it } from 'vitest';
import { resolveAnimationDuration } from './motion.js';

describe('resolveAnimationDuration', () => {
  it('liefert die normale Dauer, wenn Reduced Motion aus ist', () => {
    expect(resolveAnimationDuration(false, 200)).toBe(200);
  });

  it('liefert 0 (keine Bewegung), wenn Reduced Motion an ist', () => {
    expect(resolveAnimationDuration(true, 200)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { motionDurationMs } from '../accessibility/motion.js';

describe('useMotionDuration / motionDurationMs', () => {
  it('returns 0 when reduced motion is enabled', () => {
    expect(motionDurationMs(true, 200)).toBe(0);
    expect(motionDurationMs(true, 150)).toBe(0);
  });

  it('returns the requested duration when reduced motion is off', () => {
    expect(motionDurationMs(false, 200)).toBe(200);
    expect(motionDurationMs(false, 180)).toBe(180);
  });
});

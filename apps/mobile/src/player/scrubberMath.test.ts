import { describe, expect, it } from 'vitest';
import {
  clampSeekPosition,
  positionFromRatio,
  ratioFromPosition,
  ratioFromTouchX,
} from './scrubberMath.js';

describe('scrubberMath', () => {
  it('clampSeekPosition bounds to [0, duration]', () => {
    expect(clampSeekPosition(-5, 120)).toBe(0);
    expect(clampSeekPosition(60, 120)).toBe(60);
    expect(clampSeekPosition(999, 120)).toBe(120);
    expect(clampSeekPosition(10, 0)).toBe(0);
  });

  it('ratioFromPosition and positionFromRatio are inverse', () => {
    expect(ratioFromPosition(30, 120)).toBe(0.25);
    expect(positionFromRatio(0.25, 120)).toBe(30);
  });

  it('ratioFromTouchX maps touch to ratio', () => {
    expect(ratioFromTouchX(0, 200)).toBe(0);
    expect(ratioFromTouchX(100, 200)).toBe(0.5);
    expect(ratioFromTouchX(250, 200)).toBe(1);
    expect(ratioFromTouchX(50, 0)).toBe(0);
  });
});

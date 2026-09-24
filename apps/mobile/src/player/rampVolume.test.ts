import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rampVolume, SOFT_START_RAMP_MS, SOFT_START_STEPS } from './rampVolume.js';

describe('rampVolume (soft-start proof)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls setVolume monotonically from 0 to 1 over ~180ms', async () => {
    const volumes: number[] = [];
    const setVolume = vi.fn(async (v: number) => {
      volumes.push(v);
    });
    const sleep = vi.fn(async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    });

    const promise = rampVolume(setVolume, 0, 1, SOFT_START_RAMP_MS, sleep);

    await vi.runAllTimersAsync();
    await promise;

    expect(SOFT_START_STEPS).toBe(6);
    expect(setVolume).toHaveBeenCalledTimes(SOFT_START_STEPS + 1);
    expect(volumes[0]).toBeCloseTo(1 / SOFT_START_STEPS, 5);
    expect(volumes[volumes.length - 1]).toBe(1);

    for (let i = 1; i < volumes.length; i++) {
      const prev = volumes[i - 1];
      const curr = volumes[i];
      expect(prev).toBeDefined();
      expect(curr).toBeDefined();
      if (prev !== undefined && curr !== undefined) {
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }

    const stepMs = Math.floor(SOFT_START_RAMP_MS / SOFT_START_STEPS);
    expect(sleep).toHaveBeenCalledTimes(SOFT_START_STEPS);
    for (const call of sleep.mock.calls) {
      expect(call[0]).toBe(stepMs);
    }
  });
});

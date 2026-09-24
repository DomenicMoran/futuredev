/** Soft-start ramp duration used when playback begins (see softStartPlay). */
export const SOFT_START_RAMP_MS = 180;
export const SOFT_START_STEPS = 6;

export type VolumeSetter = (volume: number) => void | Promise<void>;
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Linear volume ramp in fixed steps — exported for unit tests (media_session cannot observe ramp).
 */
export async function rampVolume(
  setVolume: VolumeSetter,
  from: number,
  to: number,
  durationMs: number,
  sleep: SleepFn = defaultSleep,
): Promise<void> {
  const stepMs = Math.max(1, Math.floor(durationMs / SOFT_START_STEPS));
  for (let step = 1; step <= SOFT_START_STEPS; step++) {
    const t = step / SOFT_START_STEPS;
    await setVolume(from + (to - from) * t);
    await sleep(stepMs);
  }
  await setVolume(to);
}

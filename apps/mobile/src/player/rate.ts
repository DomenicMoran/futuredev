// Tempo-Grenzen (0,8 bis 2,0 in 0,1-Schritten), als reine Funktionen, damit
// store.ts nie einen Wert ausserhalb setzen kann, auch nicht durch
// wiederholtes +0.1 (Fliesskomma-Drift).
import { PLAYBACK_RATE_MAX, PLAYBACK_RATE_MIN, PLAYBACK_RATE_STEP } from './types.js';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampRate(rate: number): number {
  return round1(Math.min(Math.max(rate, PLAYBACK_RATE_MIN), PLAYBACK_RATE_MAX));
}

export function increaseRate(rate: number): number {
  return clampRate(rate + PLAYBACK_RATE_STEP);
}

export function decreaseRate(rate: number): number {
  return clampRate(rate - PLAYBACK_RATE_STEP);
}

export const RATE_OPTIONS: readonly number[] = Array.from(
  { length: Math.round((PLAYBACK_RATE_MAX - PLAYBACK_RATE_MIN) / PLAYBACK_RATE_STEP) + 1 },
  (_, i) => clampRate(PLAYBACK_RATE_MIN + i * PLAYBACK_RATE_STEP),
);

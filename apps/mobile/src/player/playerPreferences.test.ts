import { beforeEach, describe, expect, it } from 'vitest';
import { resetToMemoryDatabase } from '../data/db.js';
import {
  loadPlayerPreferences,
  persistPlaybackRate,
  PLAYBACK_RATE_SETTING_KEY,
} from './playerPreferences.js';
import { runPlayerUiAction } from './uiActions.js';
import { usePlayerStore } from './store.js';
beforeEach(() => {
  resetToMemoryDatabase();
  usePlayerStore.getState().reset();
});
describe('durable playback preference and action errors', () => {
  it('keeps the selected speed across store restarts', async () => {
    expect((await loadPlayerPreferences()).rate).toBe(1);
    await persistPlaybackRate(1.5);
    usePlayerStore.getState().reset();
    expect((await loadPlayerPreferences()).rate).toBe(1.5);
  });
  it('uses safe defaults for invalid stored values and rejects nonfinite writes', async () => {
    const db = resetToMemoryDatabase();
    for (const value of ['NaN', 'Infinity', 'not-a-number', '']) {
      await db.setSetting(PLAYBACK_RATE_SETTING_KEY, value);
      expect((await loadPlayerPreferences()).rate).toBe(1);
    }
    await expect(persistPlaybackRate(NaN)).rejects.toThrow('Ungültiges');
    await db.setSetting(PLAYBACK_RATE_SETTING_KEY, '8');
    expect((await loadPlayerPreferences()).rate).toBe(2);
  });
  it('contains asynchronous and synchronous UI errors and exposes an actionable message', async () => {
    expect(
      await runPlayerUiAction(async () => {
        throw new Error('Nicht gespeichert');
      }),
    ).toBe(false);
    expect(usePlayerStore.getState().playbackError).toBe('Nicht gespeichert');
    expect(
      await runPlayerUiAction(() => {
        throw 'invalid';
      }),
    ).toBe(false);
    expect(usePlayerStore.getState().playbackError).toContain('erneut versuchen');
    expect(await runPlayerUiAction(async () => undefined)).toBe(true);
    expect(usePlayerStore.getState().playbackError).toBeNull();
    await runPlayerUiAction(async () => {
      usePlayerStore.getState().setPlaybackError('Neuer unabhängiger Fehler');
    });
    expect(usePlayerStore.getState().playbackError).toBe('Neuer unabhängiger Fehler');
  });
});

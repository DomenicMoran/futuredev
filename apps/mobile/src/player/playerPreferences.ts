import { getDatabase } from '../data/db.js';
import type { AppRepeatMode } from './types.js';

export const AUTOPLAY_NEXT_SETTING_KEY = 'player.autoplayNext';
export const REPEAT_MODE_SETTING_KEY = 'player.repeatMode';

function parseRepeatMode(raw: string | undefined): AppRepeatMode {
  if (raw === 'one' || raw === 'all') return raw;
  return 'off';
}

export async function loadPlayerPreferences(): Promise<{ autoplayNext: boolean; repeatMode: AppRepeatMode }> {
  const db = await getDatabase();
  const [autoplayRaw, repeatRaw] = await Promise.all([
    db.getSetting(AUTOPLAY_NEXT_SETTING_KEY),
    db.getSetting(REPEAT_MODE_SETTING_KEY),
  ]);
  return {
    autoplayNext: autoplayRaw !== 'false',
    repeatMode: parseRepeatMode(repeatRaw),
  };
}

export async function persistAutoplayNext(value: boolean): Promise<void> {
  const db = await getDatabase();
  await db.setSetting(AUTOPLAY_NEXT_SETTING_KEY, value ? 'true' : 'false');
}

export async function persistRepeatMode(value: AppRepeatMode): Promise<void> {
  const db = await getDatabase();
  await db.setSetting(REPEAT_MODE_SETTING_KEY, value);
}

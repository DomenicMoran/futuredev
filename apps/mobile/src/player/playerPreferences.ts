import { getDatabase } from '../data/db.js';
import { clampRate } from './rate.js';
import type { AppRepeatMode } from './types.js';

export const AUTOPLAY_NEXT_SETTING_KEY = 'player.autoplayNext';
export const PLAYBACK_RATE_SETTING_KEY = 'player.rate';
export const REPEAT_MODE_SETTING_KEY = 'player.repeatMode';

function parseRepeatMode(raw: string | undefined): AppRepeatMode {
  if (raw === 'one' || raw === 'all') return raw;
  return 'off';
}

export async function loadPlayerPreferences(): Promise<{
  autoplayNext: boolean;
  repeatMode: AppRepeatMode;
  rate: number;
}> {
  const db = await getDatabase();
  const [autoplayRaw, repeatRaw, rateRaw] = await Promise.all([
    db.getSetting(AUTOPLAY_NEXT_SETTING_KEY),
    db.getSetting(REPEAT_MODE_SETTING_KEY),
    db.getSetting(PLAYBACK_RATE_SETTING_KEY),
  ]);
  const parsedRate = rateRaw === undefined || !rateRaw.trim() ? 1 : Number(rateRaw);
  return {
    rate: Number.isFinite(parsedRate) ? clampRate(parsedRate) : 1,
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

export async function persistPlaybackRate(value: number): Promise<void> {
  if (!Number.isFinite(value)) throw new Error('Ungültiges Wiedergabetempo.');
  await (await getDatabase()).setSetting(PLAYBACK_RATE_SETTING_KEY, String(clampRate(value)));
}

// Tagesziel: ehrliche Lernminuten aus Hörposition (Delta zwischen Saves) und
// Lesefokus auf dem Lektionsbildschirm (Intervall-Ticks bei aktiver App).
// Persistenz in `settings`: daily_learning_seconds + daily_learning_date (YYYY-MM-DD, lokal).
import { getSetting, setSetting } from '../data/settings.js';
import { POSITION_SAVE_INTERVAL_SECONDS } from '../player/types.js';

export const DAILY_LEARNING_SECONDS_KEY = 'daily_learning_seconds';
export const DAILY_LEARNING_DATE_KEY = 'daily_learning_date';

/** Max. Delta pro Save-Tick (5 s Intervall + Puffer gegen Seek-Sprünge). */
export const MAX_LISTEN_DELTA_SECONDS = POSITION_SAVE_INTERVAL_SECONDS + 2;

/** Lesefokus: Tick-Intervall auf dem Lektionsbildschirm (Sekunden). */
export const READ_FOCUS_TICK_SECONDS = POSITION_SAVE_INTERVAL_SECONDS;

export const MAX_READ_FOCUS_DELTA_SECONDS = READ_FOCUS_TICK_SECONDS + 2;

/** Obergrenze pro Kalendertag (24 h), verhindert Korruption durch fehlerhafte Deltas. */
export const MAX_DAILY_LEARNING_SECONDS = 24 * 60 * 60;

const lastListenPositionByLesson = new Map<string, number>();

export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function clampListenDelta(deltaSeconds: number, maxDelta = MAX_LISTEN_DELTA_SECONDS): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, maxDelta);
}

export function computeListenDelta(previousPosition: number, nextPosition: number): number {
  if (!Number.isFinite(previousPosition) || !Number.isFinite(nextPosition)) return 0;
  if (nextPosition <= previousPosition) return 0;
  return nextPosition - previousPosition;
}

export function resolveStoredDailySeconds(
  storedDate: string | undefined,
  storedSeconds: number,
  today: string,
): number {
  if (!storedDate || storedDate !== today) return 0;
  if (!Number.isFinite(storedSeconds) || storedSeconds < 0) return 0;
  return Math.min(storedSeconds, MAX_DAILY_LEARNING_SECONDS);
}

export function applyDeltaToDailyTotal(
  storedDate: string | undefined,
  storedSeconds: number,
  today: string,
  deltaSeconds: number,
): { date: string; seconds: number } {
  const base = resolveStoredDailySeconds(storedDate, storedSeconds, today);
  const delta = clampListenDelta(deltaSeconds);
  const next = Math.min(MAX_DAILY_LEARNING_SECONDS, base + delta);
  return { date: today, seconds: Math.round(next) };
}

/** Setzt die Baseline für Deltas (Session-Start / Lesson-Wechsel), ohne zu persistieren. */
export function setListenProgressBaseline(lessonId: string, positionSeconds: number): void {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return;
  lastListenPositionByLesson.set(lessonId, positionSeconds);
}

export function clearListenProgressBaselines(): void {
  lastListenPositionByLesson.clear();
}

function parseStoredSeconds(raw: string | undefined): number {
  if (raw === undefined) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function readDailyLearningSecondsToday(now: Date = new Date()): Promise<number> {
  const today = localDateKey(now);
  const [storedDate, storedRaw] = await Promise.all([
    getSetting(DAILY_LEARNING_DATE_KEY),
    getSetting(DAILY_LEARNING_SECONDS_KEY),
  ]);
  return resolveStoredDailySeconds(storedDate, parseStoredSeconds(storedRaw), today);
}

export async function persistDailyLearningTotal(
  totalSeconds: number,
  date: string,
): Promise<void> {
  const clamped = Math.min(MAX_DAILY_LEARNING_SECONDS, Math.max(0, Math.round(totalSeconds)));
  await Promise.all([
    setSetting(DAILY_LEARNING_DATE_KEY, date),
    setSetting(DAILY_LEARNING_SECONDS_KEY, String(clamped)),
  ]);
}

/**
 * Erhöht die Tagessekunden anhand einer absoluten Hörposition (Save/markListened).
 * Erster Aufruf pro Lektion in der Session: Baseline setzen, kein Delta.
 */
/** Erhöht Tagessekunden um einen Lesefokus-Tick (Lesson-Screen, App aktiv). */
export async function accumulateReadFocusTick(now: Date = new Date()): Promise<number> {
  const today = localDateKey(now);
  const [storedDate, storedRaw] = await Promise.all([
    getSetting(DAILY_LEARNING_DATE_KEY),
    getSetting(DAILY_LEARNING_SECONDS_KEY),
  ]);
  const next = applyDeltaToDailyTotal(
    storedDate,
    parseStoredSeconds(storedRaw),
    today,
    READ_FOCUS_TICK_SECONDS,
  );
  await persistDailyLearningTotal(next.seconds, next.date);
  return next.seconds;
}

export async function accumulateListenProgress(
  lessonId: string,
  positionSeconds: number,
  now: Date = new Date(),
): Promise<number> {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return readDailyLearningSecondsToday(now);
  }

  const previous = lastListenPositionByLesson.get(lessonId);
  lastListenPositionByLesson.set(lessonId, positionSeconds);

  if (previous === undefined) {
    return readDailyLearningSecondsToday(now);
  }

  const delta = computeListenDelta(previous, positionSeconds);
  if (delta <= 0) {
    return readDailyLearningSecondsToday(now);
  }

  const today = localDateKey(now);
  const [storedDate, storedRaw] = await Promise.all([
    getSetting(DAILY_LEARNING_DATE_KEY),
    getSetting(DAILY_LEARNING_SECONDS_KEY),
  ]);
  const next = applyDeltaToDailyTotal(storedDate, parseStoredSeconds(storedRaw), today, delta);
  await persistDailyLearningTotal(next.seconds, next.date);
  return next.seconds;
}

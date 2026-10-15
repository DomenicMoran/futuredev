import type { Database } from '../data/types.js';
import { getDatabase } from '../data/db.js';

const PREFIX = 'hearing.v1.';
type Range = [number, number];
export interface HearingProgress {
  seconds: number;
  duration: number;
  completed: boolean;
}
interface StoredHearing {
  ranges: Range[];
  duration: number;
  ended: boolean;
}
let baseline: { id: string; position: number; time: number; playing: boolean } | null = null;

export function resetHearingBaseline(): void {
  baseline = null;
}
export function beginHearing(
  id: string,
  position: number,
  playing = true,
  time = Date.now(),
): void {
  baseline = { id, position, time, playing };
}

export function mergeHearingRanges(
  ranges: readonly Range[],
  added: Range,
  duration: number,
): Range[] {
  const sorted = [...ranges, added]
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a, b]): Range => [Math.max(0, a), Math.min(duration, b)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const result: Range[] = [];
  for (const range of sorted) {
    const previous = result[result.length - 1];
    if (previous && range[0] <= previous[1] + 0.05) previous[1] = Math.max(previous[1], range[1]);
    else result.push([...range]);
  }
  return result;
}

function parse(raw: string | undefined): StoredHearing | null {
  try {
    const value = JSON.parse(raw ?? 'null') as StoredHearing | null;
    if (
      !value ||
      !Number.isFinite(value.duration) ||
      value.duration <= 0 ||
      typeof value.ended !== 'boolean' ||
      !Array.isArray(value.ranges) ||
      !value.ranges.every((r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite))
    )
      return null;
    return { ...value, ranges: mergeHearingRanges(value.ranges, [0, 0], value.duration) };
  } catch {
    return null;
  }
}

function summarize(value: StoredHearing): HearingProgress {
  const seconds = value.ranges.reduce((sum, [a, b]) => sum + b - a, 0);
  // Allow tiny sampling gaps, never mistake seeking to the end for hearing it.
  return {
    seconds,
    duration: value.duration,
    completed: value.ended && seconds >= value.duration * 0.98,
  };
}

export async function listHearingProgress(
  database?: Database,
): Promise<Record<string, HearingProgress>> {
  const db = database ?? (await getDatabase());
  const result: Record<string, HearingProgress> = {};
  for (const row of await db.listSettings()) {
    if (!row.key.startsWith(PREFIX)) continue;
    const value = parse(row.value);
    if (value) result[row.key.slice(PREFIX.length)] = summarize(value);
  }
  return result;
}

/** Position samples, not furthest position: replay doesn't double-count and seeks earn nothing. */
export async function recordHearingSample(
  id: string,
  position: number,
  duration: number,
  playing: boolean,
  rate: number,
  time = Date.now(),
): Promise<HearingProgress | null> {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || position < 0 || duration <= 0)
    return null;
  const previous = baseline;
  baseline = { id, position, time, playing };
  if (!previous || previous.id !== id || !previous.playing) return null;
  const delta = position - previous.position;
  const elapsed = Math.max(0, (time - previous.time) / 1000);
  if (delta <= 0 || delta > elapsed * Math.min(2, Math.max(0.8, rate)) + 1) return null;
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const key = PREFIX + id;
    const stored = parse(await tx.getSetting(key));
    const value: StoredHearing =
      stored && Math.abs(stored.duration - duration) <= 2
        ? stored
        : { ranges: [], duration, ended: false };
    value.ranges = mergeHearingRanges(value.ranges, [previous.position, position], duration);
    value.ended ||= position >= duration - 1;
    await tx.setSetting(key, JSON.stringify(value));
    const scope = parseReviewScope(await tx.getSetting('mastery_audio_scope_v1'));
    if (scope?.ids.includes(id)) {
      const reviewKey = REVIEW_PREFIX + id;
      const review = parseReview(await tx.getSetting(reviewKey), scope.cycle);
      const repeated: StoredHearing =
        review && Math.abs(review.duration - duration) <= 2
          ? review
          : { ranges: [], duration, ended: false };
      repeated.ranges = mergeHearingRanges(
        repeated.ranges,
        [previous.position, position],
        duration,
      );
      repeated.ended ||= position >= duration - 1;
      await tx.setSetting(reviewKey, JSON.stringify({ cycle: scope.cycle, value: repeated }));
    }
    return summarize(value);
  });
}

const REVIEW_PREFIX = 'mastery.hearing.v1.';
function parseReviewScope(raw: string | undefined): { cycle: string; ids: string[] } | null {
  try {
    const s = JSON.parse(raw ?? 'null');
    return s &&
      typeof s.cycle === 'string' &&
      Array.isArray(s.ids) &&
      s.ids.every((id: unknown) => typeof id === 'string')
      ? s
      : null;
  } catch {
    return null;
  }
}
function parseReview(raw: string | undefined, cycle: string): StoredHearing | null {
  try {
    const s = JSON.parse(raw ?? 'null');
    return s?.cycle === cycle ? parse(JSON.stringify(s.value)) : null;
  } catch {
    return null;
  }
}
export async function listReviewHearingProgress(): Promise<Record<string, HearingProgress>> {
  const db = await getDatabase();
  const scope = parseReviewScope(await db.getSetting('mastery_audio_scope_v1'));
  if (!scope) return {};
  const rows = await db.listSettings();
  const result: Record<string, HearingProgress> = {};
  for (const row of rows) {
    if (!row.key.startsWith(REVIEW_PREFIX)) continue;
    const id = row.key.slice(REVIEW_PREFIX.length);
    if (!scope.ids.includes(id)) continue;
    const value = parseReview(row.value, scope.cycle);
    if (value) result[id] = summarize(value);
  }
  return result;
}
export async function clearReviewHearing(id: string): Promise<void> {
  await (await getDatabase()).setSetting(REVIEW_PREFIX + id, 'null');
}
